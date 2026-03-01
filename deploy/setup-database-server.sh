#!/bin/bash
# ========================================
# FunnyPixels 数据库服务器初始化脚本
# 运行在服务器 2 (数据库服务器)
# Usage: curl -fsSL https://raw.githubusercontent.com/.../setup-database-server.sh | bash
# ========================================

set -euo pipefail

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# 检查是否为 root
if [ "$EUID" -ne 0 ]; then
  log_error "请使用 root 运行此脚本"
  exit 1
fi

log_info "=========================================="
log_info "  FunnyPixels 数据库服务器初始化"
log_info "=========================================="

# ==========================================
# 1. 系统更新
# ==========================================
log_info "[1/7] 更新系统软件包..."

export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get upgrade -y -qq
apt-get install -y -qq \
  curl \
  wget \
  gnupg \
  lsb-release \
  ca-certificates \
  ufw \
  htop \
  iftop \
  sysstat

log_info "✅ 系统更新完成"

# ==========================================
# 2. 安装 PostgreSQL 15 + PostGIS
# ==========================================
log_info "[2/7] 安装 PostgreSQL 15 + PostGIS..."

# 添加 PostgreSQL 官方仓库
sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | apt-key add -

apt-get update -qq
apt-get install -y -qq \
  postgresql-15 \
  postgresql-15-postgis-3 \
  postgresql-client-15 \
  postgresql-contrib-15

# 启用并启动 PostgreSQL
systemctl enable postgresql
systemctl start postgresql

log_info "✅ PostgreSQL 安装完成"

# ==========================================
# 3. 配置 PostgreSQL
# ==========================================
log_info "[3/7] 配置 PostgreSQL 性能参数..."

PG_CONF="/etc/postgresql/15/main/postgresql.conf"

# 备份原配置
cp $PG_CONF ${PG_CONF}.backup

# 获取系统内存
TOTAL_MEM_KB=$(grep MemTotal /proc/meminfo | awk '{print $2}')
TOTAL_MEM_GB=$((TOTAL_MEM_KB / 1024 / 1024))

# 性能参数 (针对 64GB 服务器优化)
cat >> $PG_CONF <<EOF

# ==========================================
# FunnyPixels Production Tuning
# ==========================================

# 连接配置
max_connections = 200
superuser_reserved_connections = 5

# 内存配置 (64GB 服务器)
shared_buffers = 16GB
effective_cache_size = 48GB
maintenance_work_mem = 2GB
work_mem = 64MB
wal_buffers = 16MB

# 查询规划器
random_page_cost = 1.1
effective_io_concurrency = 200
default_statistics_target = 100

# WAL 配置
wal_level = replica
max_wal_size = 4GB
min_wal_size = 1GB
checkpoint_completion_target = 0.9
checkpoint_timeout = 15min

# 日志配置
logging_collector = on
log_directory = '/var/log/postgresql'
log_filename = 'postgresql-%Y-%m-%d_%H%M%S.log'
log_rotation_age = 1d
log_rotation_size = 100MB
log_line_prefix = '%t [%p]: [%l-1] user=%u,db=%d,app=%a,client=%h '
log_min_duration_statement = 200
log_checkpoints = on
log_connections = on
log_disconnections = on
log_lock_waits = on
log_temp_files = 0

# 性能监控
shared_preload_libraries = 'pg_stat_statements'
pg_stat_statements.track = all
pg_stat_statements.max = 10000
track_activity_query_size = 2048

# 自动清理
autovacuum = on
autovacuum_max_workers = 4
autovacuum_naptime = 30s
autovacuum_vacuum_scale_factor = 0.05
autovacuum_analyze_scale_factor = 0.02

EOF

log_info "✅ PostgreSQL 配置完成"

# ==========================================
# 4. 安装 Redis
# ==========================================
log_info "[4/7] 安装 Redis..."

apt-get install -y -qq redis-server

# Redis 配置
REDIS_CONF="/etc/redis/redis.conf"
cp $REDIS_CONF ${REDIS_CONF}.backup

# 性能优化
sed -i 's/^maxmemory .*/maxmemory 6gb/' $REDIS_CONF
sed -i 's/^# maxmemory-policy .*/maxmemory-policy allkeys-lru/' $REDIS_CONF
sed -i 's/^appendonly no/appendonly yes/' $REDIS_CONF
sed -i 's/^appendfsync .*/appendfsync everysec/' $REDIS_CONF

# 持久化配置
sed -i 's/^save .*/# save disabled/' $REDIS_CONF
cat >> $REDIS_CONF <<EOF

# FunnyPixels Production Config
save ""
appendonly yes
appendfsync everysec
auto-aof-rewrite-percentage 100
auto-aof-rewrite-min-size 64mb

EOF

systemctl enable redis-server
systemctl restart redis-server

log_info "✅ Redis 安装完成"

# ==========================================
# 5. 配置防火墙
# ==========================================
log_info "[5/7] 配置防火墙..."

# 允许 SSH
ufw allow 22/tcp comment 'SSH'

# 默认策略
ufw default deny incoming
ufw default allow outgoing

log_warn "⚠️  数据库端口 (5432, 6379) 需要手动配置，仅允许应用服务器内网 IP"
log_warn "    示例: ufw allow from <应用服务器内网IP> to any port 5432 proto tcp"

# 启用防火墙
ufw --force enable

log_info "✅ 防火墙配置完成"

# ==========================================
# 6. 配置监控
# ==========================================
log_info "[6/7] 安装监控工具..."

# Node Exporter (Prometheus 指标)
EXPORTER_VERSION="1.7.0"
cd /tmp
wget -q https://github.com/prometheus/node_exporter/releases/download/v${EXPORTER_VERSION}/node_exporter-${EXPORTER_VERSION}.linux-amd64.tar.gz
tar xzf node_exporter-${EXPORTER_VERSION}.linux-amd64.tar.gz
cp node_exporter-${EXPORTER_VERSION}.linux-amd64/node_exporter /usr/local/bin/
rm -rf node_exporter-*

# 创建 systemd 服务
cat > /etc/systemd/system/node_exporter.service <<EOF
[Unit]
Description=Node Exporter
After=network.target

[Service]
Type=simple
User=nobody
ExecStart=/usr/local/bin/node_exporter --web.listen-address=:9100
Restart=on-failure

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable node_exporter
systemctl start node_exporter

log_info "✅ 监控工具安装完成 (Node Exporter on :9100)"

# ==========================================
# 7. 创建备份目录
# ==========================================
log_info "[7/7] 创建备份目录..."

mkdir -p /data/backups/postgresql
mkdir -p /data/backups/redis
chown -R postgres:postgres /data/backups/postgresql
chown -R redis:redis /data/backups/redis

log_info "✅ 备份目录创建完成"

# ==========================================
# 完成
# ==========================================
log_info "=========================================="
log_info "  数据库服务器初始化完成！"
log_info "=========================================="
log_info ""
log_info "下一步操作:"
log_info "1. 设置 PostgreSQL 访问权限:"
log_info "   sudo -u postgres psql"
log_info "   CREATE DATABASE funnypixels_production;"
log_info "   CREATE USER funnypixels WITH PASSWORD 'YOUR_PASSWORD';"
log_info "   GRANT ALL PRIVILEGES ON DATABASE funnypixels_production TO funnypixels;"
log_info "   \\c funnypixels_production"
log_info "   CREATE EXTENSION IF NOT EXISTS postgis;"
log_info "   CREATE EXTENSION IF NOT EXISTS pg_stat_statements;"
log_info ""
log_info "2. 配置远程访问 (pg_hba.conf):"
log_info "   echo \"host funnypixels_production funnypixels <应用服务器内网IP>/32 scram-sha-256\" | \\"
log_info "     sudo tee -a /etc/postgresql/15/main/pg_hba.conf"
log_info ""
log_info "3. 配置监听地址 (postgresql.conf):"
log_info "   sudo sed -i \"s/#listen_addresses = 'localhost'/listen_addresses = '<本机内网IP>,127.0.0.1'/\" \\"
log_info "     /etc/postgresql/15/main/postgresql.conf"
log_info "   sudo systemctl restart postgresql"
log_info ""
log_info "4. 配置 Redis 密码和监听:"
log_info "   sudo sed -i 's/# requirepass foobared/requirepass YOUR_REDIS_PASSWORD/' /etc/redis/redis.conf"
log_info "   sudo sed -i 's/bind 127.0.0.1 ::1/bind <本机内网IP> 127.0.0.1/' /etc/redis/redis.conf"
log_info "   sudo systemctl restart redis-server"
log_info ""
log_info "5. 配置防火墙允许应用服务器:"
log_info "   sudo ufw allow from <应用服务器内网IP> to any port 5432 proto tcp"
log_info "   sudo ufw allow from <应用服务器内网IP> to any port 6379 proto tcp"
log_info ""
log_info "=========================================="
