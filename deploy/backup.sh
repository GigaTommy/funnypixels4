#!/bin/bash
# ===========================================
# FunnyPixels Database Backup Script
# Run via cron (daily) or manually
# Usage: ./deploy/backup.sh
# ===========================================

set -euo pipefail

PROJECT_DIR="/opt/funnypixels"
BACKUP_DIR="/data/funnypixels/backups"
COMPOSE_FILE="docker-compose.production.yml"
TIMESTAMP=$(date '+%Y%m%d_%H%M%S')
BACKUP_FILE="funnypixels_${TIMESTAMP}.dump"
KEEP_DAYS=30

# Remote backup toggle (set in .env.production or export before running)
REMOTE_BACKUP_ENABLED="${REMOTE_BACKUP_ENABLED:-false}"
REMOTE_BACKUP_TARGET="${REMOTE_BACKUP_TARGET:-remote:funnypixels-backups/db/}"

cd "$PROJECT_DIR"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting database backup..."

# Ensure backup directory exists
mkdir -p "$BACKUP_DIR"

# Read database config from .env.production
if [ -f .env.production ]; then
    DB_NAME=$(grep -E '^DB_NAME=' .env.production | cut -d= -f2 | tr -d ' "'"'"'')
    DB_USER=$(grep -E '^DB_USER=' .env.production | cut -d= -f2 | tr -d ' "'"'"'')
fi

DB_NAME="${DB_NAME:-funnypixels_postgres}"
DB_USER="${DB_USER:-postgres}"

# Execute backup
# -Fc: custom format (built-in compression, smaller than sql+gzip, supports parallel restore)
# -Z6: compression level 6 (good balance of speed vs size)
# nice/ionice: lowest CPU/IO priority so backup doesn't starve production queries
nice -n 19 ionice -c 3 \
    docker compose -f "$COMPOSE_FILE" exec -T postgres \
    pg_dump -U "$DB_USER" -d "$DB_NAME" \
    --no-owner --no-privileges \
    -Fc -Z6 \
    > "$BACKUP_DIR/$BACKUP_FILE"

# Verify backup file
BACKUP_SIZE=$(stat -c%s "$BACKUP_DIR/$BACKUP_FILE" 2>/dev/null || stat -f%z "$BACKUP_DIR/$BACKUP_FILE" 2>/dev/null || echo "0")
if [ "$BACKUP_SIZE" -gt 0 ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Backup successful: $BACKUP_FILE ($(numfmt --to=iec $BACKUP_SIZE 2>/dev/null || echo "${BACKUP_SIZE} bytes"))"
else
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Backup failed: file size is 0"
    rm -f "$BACKUP_DIR/$BACKUP_FILE"
    exit 1
fi

# Clean up old backups (keep last N days)
echo "Cleaning up backups older than ${KEEP_DAYS} days..."
find "$BACKUP_DIR" -name "funnypixels_*.dump" -type f -mtime +${KEEP_DAYS} -delete
# Also clean legacy .sql.gz backups
find "$BACKUP_DIR" -name "funnypixels_*.sql.gz" -type f -mtime +${KEEP_DAYS} -delete
REMAINING=$(find "$BACKUP_DIR" -name "funnypixels_*" -type f | wc -l)
echo "Current backup count: $REMAINING"

# Remote backup upload via rclone
# Configure rclone first: rclone config
# Example targets:
#   r2:funnypixels-backups/db/       (Cloudflare R2)
#   s3:funnypixels-backups/db/       (AWS S3)
if [ "$REMOTE_BACKUP_ENABLED" = "true" ]; then
    if command -v rclone &> /dev/null; then
        echo "Uploading to remote storage: $REMOTE_BACKUP_TARGET"
        nice -n 19 rclone copy "$BACKUP_DIR/$BACKUP_FILE" "$REMOTE_BACKUP_TARGET" \
            --bwlimit 10M --progress
        echo "Remote upload complete"

        # Clean up old remote backups
        rclone delete "$REMOTE_BACKUP_TARGET" --min-age "${KEEP_DAYS}d" 2>/dev/null || true
    else
        echo "WARNING: rclone not installed, skipping remote backup"
    fi
fi

# Restore instructions (for reference):
#   pg_restore -U postgres -d funnypixels_postgres --no-owner --no-privileges -j4 backup.dump
#   (-j4 = 4 parallel jobs, significantly faster than sql import)

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Backup process complete"
