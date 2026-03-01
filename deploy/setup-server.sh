#!/bin/bash
# ===========================================
# FunnyPixels VPS Server Initialization Script
# Run as root on first deployment
# Usage: chmod +x deploy/setup-server.sh && sudo ./deploy/setup-server.sh
# ===========================================

set -euo pipefail

echo "=========================================="
echo "  FunnyPixels VPS Server Initialization"
echo "=========================================="

# ------------------------------------------
# 1. System Update
# ------------------------------------------
echo "[1/8] Updating system packages..."
apt-get update && apt-get upgrade -y

# ------------------------------------------
# 2. Install Docker + Docker Compose
# ------------------------------------------
echo "[2/8] Installing Docker..."
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com | bash
    systemctl enable docker
    systemctl start docker
    echo "Docker installed: $(docker --version)"
else
    echo "Docker already installed: $(docker --version)"
fi

# Docker Compose V2 comes with Docker, verify
if docker compose version &> /dev/null; then
    echo "Docker Compose ready: $(docker compose version)"
else
    echo "Installing Docker Compose plugin..."
    apt-get install -y docker-compose-plugin
fi

# ------------------------------------------
# 3. Create Data Directories
# ------------------------------------------
echo "[3/8] Creating data directories..."
mkdir -p /data/funnypixels/{postgres,redis,backups,logs,uploads}
chmod 750 /data/funnypixels
echo "Data directories created: /data/funnypixels/"

# ------------------------------------------
# 4. Create Deploy User
# ------------------------------------------
echo "[4/8] Creating deploy user..."
if ! id "deploy" &>/dev/null; then
    useradd -m -s /bin/bash -G docker deploy
    mkdir -p /home/deploy/.ssh
    chmod 700 /home/deploy/.ssh
    # Copy root's authorized_keys to deploy user if exists
    if [ -f /root/.ssh/authorized_keys ]; then
        cp /root/.ssh/authorized_keys /home/deploy/.ssh/authorized_keys
    fi
    chown -R deploy:deploy /home/deploy/.ssh
    chmod 600 /home/deploy/.ssh/authorized_keys 2>/dev/null || true
    echo "Deploy user 'deploy' created"
else
    echo "Deploy user 'deploy' already exists"
    usermod -aG docker deploy
fi

# Grant deploy user data directory permissions
chown -R deploy:deploy /data/funnypixels

# ------------------------------------------
# 5. Configure Firewall
# ------------------------------------------
echo "[5/8] Configuring firewall..."
if command -v ufw &> /dev/null; then
    ufw --force enable
    ufw default deny incoming
    ufw default allow outgoing
    ufw allow 22/tcp    # SSH
    ufw allow 80/tcp    # HTTP (Cloudflare → Nginx)
    ufw allow 443/tcp   # HTTPS (Cloudflare → Nginx)
    ufw reload
    echo "Firewall configured (open 22/80/443)"
else
    echo "Installing ufw..."
    apt-get install -y ufw
    ufw --force enable
    ufw default deny incoming
    ufw default allow outgoing
    ufw allow 22/tcp
    ufw allow 80/tcp
    ufw allow 443/tcp
    ufw reload
    echo "Firewall installed and configured"
fi

# ------------------------------------------
# 6. Install Nginx
# ------------------------------------------
echo "[6/8] Installing Nginx..."
if ! command -v nginx &> /dev/null; then
    apt-get install -y nginx
    systemctl enable nginx
    echo "Nginx installed"
else
    echo "Nginx already installed"
fi

# ------------------------------------------
# 7. Setup Cloudflare Origin Certificate Directory
# ------------------------------------------
echo "[7/8] Setting up SSL certificate directory..."
mkdir -p /etc/ssl/cloudflare
chmod 700 /etc/ssl/cloudflare
echo "SSL directory created: /etc/ssl/cloudflare/"
echo ""
echo "  >> Upload your Cloudflare Origin Certificate:"
echo "     - Certificate: /etc/ssl/cloudflare/funnypixels.pem"
echo "     - Private key: /etc/ssl/cloudflare/funnypixels.key"
echo "  >> Generate at: Cloudflare Dashboard → SSL/TLS → Origin Server → Create Certificate"
echo ""

# ------------------------------------------
# 8. Configure Log Rotation, Backup Cron, Partition Cleanup
# ------------------------------------------
echo "[8/8] Configuring log rotation and scheduled tasks..."

# Logrotate configuration
cat > /etc/logrotate.d/funnypixels << 'LOGROTATE'
/data/funnypixels/logs/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    copytruncate
}
LOGROTATE
echo "Log rotation configured"

# Daily backup cron (03:00 UTC)
BACKUP_CRON="0 3 * * * /opt/funnypixels/deploy/backup.sh >> /data/funnypixels/logs/backup.log 2>&1"
(crontab -u deploy -l 2>/dev/null | grep -v "backup.sh"; echo "$BACKUP_CRON") | crontab -u deploy -
echo "Daily backup configured (03:00 UTC)"

# Monthly partition cleanup cron (1st of each month, 04:00 UTC)
PARTITION_CRON="0 4 1 * * cd /opt/funnypixels && docker compose -f docker-compose.production.yml exec -T postgres psql -U postgres -d funnypixels_postgres -c \"SELECT cleanup_old_partitions(12);\" >> /data/funnypixels/logs/partition_cleanup.log 2>&1"
(crontab -u deploy -l 2>/dev/null | grep -v "cleanup_old_partitions"; echo "$PARTITION_CRON") | crontab -u deploy -
echo "Monthly partition cleanup configured (1st of month, 04:00 UTC)"

# Install rclone for remote backups (optional but recommended)
if ! command -v rclone &> /dev/null; then
    echo ""
    echo "Installing rclone for remote backups..."
    curl -s https://rclone.org/install.sh | bash
    echo "rclone installed. Configure with: rclone config"
else
    echo "rclone already installed"
fi

# ------------------------------------------
# Clone code directory (if not exists)
# ------------------------------------------
if [ ! -d /opt/funnypixels ]; then
    mkdir -p /opt/funnypixels
    chown deploy:deploy /opt/funnypixels
    echo ""
    echo "Clone code as deploy user:"
    echo "  su - deploy"
    echo "  git clone git@github.com:YOUR_REPO/funnypixels3.git /opt/funnypixels"
fi

echo ""
echo "=========================================="
echo "  Initialization Complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "  1. Upload Cloudflare Origin Certificate to /etc/ssl/cloudflare/"
echo "     - funnypixels.pem (certificate)"
echo "     - funnypixels.key (private key)"
echo "  2. Configure SSH key: add deploy public key to /home/deploy/.ssh/authorized_keys"
echo "  3. Clone code to /opt/funnypixels"
echo "  4. Copy env template: cp deploy/.env.production.template .env.production"
echo "  5. Edit .env.production with actual values"
echo "  6. Deploy Nginx config:"
echo "     cp deploy/nginx.conf /etc/nginx/sites-available/funnypixels"
echo "     ln -s /etc/nginx/sites-available/funnypixels /etc/nginx/sites-enabled/"
echo "     rm -f /etc/nginx/sites-enabled/default"
echo "     nginx -t && systemctl reload nginx"
echo "  7. Set Cloudflare SSL mode to Full (Strict)"
echo "  8. First start: docker compose -f docker-compose.production.yml up -d"
echo "  9. Run migrations: docker compose -f docker-compose.production.yml run --rm backend npx knex migrate:latest"
echo "  10. Run seeds: docker compose -f docker-compose.production.yml run --rm backend npx knex seed:run --specific=000_main_seed.js"
echo "  11. Configure rclone for remote backups: rclone config"
echo "     Then set REMOTE_BACKUP_ENABLED=true in .env.production"
echo ""
