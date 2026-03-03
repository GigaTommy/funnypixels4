# FunnyPixels 海外生产环境部署指南 (Cloudflare 免费版)

## 📋 部署架构总览

```
用户 (全球各地)
    ↓
Cloudflare 免费 CDN (全球边缘节点)
├─ HTTPS/SSL 终端 (免费证书)
├─ DDoS 防护
├─ 静态资源缓存 (sprites, tiles)
├─ WebSocket 支持
└─ 智能路由
    ↓
源服务器 (2台 VPS)
├─ 服务器 1: 应用服务器 (美国/新加坡/日本)
│   ├─ Nginx (反向代理)
│   ├─ Node.js Backend (14 workers)
│   └─ 监控 (Prometheus + Grafana)
│
└─ 服务器 2: 数据服务器 (同区域内网互联)
    ├─ PostgreSQL + PostGIS
    ├─ Redis
    └─ 定时备份
```

---

## 一、服务器选型与区域建议

### 1.1 服务商选择

#### 推荐方案 A: Vultr (最推荐)
```
优点:
✅ 全球 32 个数据中心，覆盖亚太/欧美
✅ 按小时计费，随时删除服务器
✅ 性价比高 (16核32GB约 $96/月)
✅ 支持内网互联 (同区域服务器免费内网)
✅ 客服响应快

区域建议:
- 亚太用户为主: 新加坡 (Singapore)
- 欧美用户为主: 美国洛杉矶 (Los Angeles)
- 日韩用户为主: 日本东京 (Tokyo)
- 全球用户: 美国纽约 (New York) 或新加坡

配置:
- 服务器 1: Regular Performance, 16 vCPU, 32GB RAM
  价格: $96/月
- 服务器 2: High Frequency, 16 vCPU, 64GB RAM, NVMe
  价格: $192/月
总计: ~$288/月 (¥2,070/月)
```

#### 推荐方案 B: DigitalOcean
```
优点:
✅ 界面友好，文档丰富
✅ 全球 13 个数据中心
✅ 免费监控和告警
✅ VPC 内网免费

区域建议:
- 亚太: 新加坡 (sgp1)
- 欧美: 旧金山 (sfo3) 或纽约 (nyc3)

配置:
- 服务器 1: CPU-Optimized, 16 vCPU, 32GB RAM
  价格: $168/月
- 服务器 2: CPU-Optimized, 16 vCPU, 64GB RAM
  价格: $336/月
总计: ~$504/月 (¥3,630/月)
```

#### 推荐方案 C: Linode (Akamai)
```
优点:
✅ 性价比高
✅ 全球 11 个数据中心
✅ 被 Akamai 收购，网络稳定

区域建议:
- 亚太: 新加坡 (ap-south)
- 欧美: 美国弗里蒙特 (us-west)

配置:
- 服务器 1: Dedicated 16GB, 8 vCPU, 32GB RAM
  价格: $120/月
- 服务器 2: Dedicated 32GB, 16 vCPU, 64GB RAM
  价格: $240/月
总计: ~$360/月 (¥2,590/月)
```

### 1.2 区域延迟参考

**从中国到各海外区域的典型延迟**:
| 区域 | 延迟 (ms) | Cloudflare 加速后 | 适用场景 |
|------|-----------|------------------|---------|
| 香港 | 20-40 | 15-30 | 大陆用户 (但政策风险) |
| 新加坡 | 60-80 | 40-60 | 亚太用户 ⭐ |
| 日本东京 | 70-100 | 50-80 | 亚太用户 |
| 美国西海岸 | 150-180 | 120-150 | 全球用户 |
| 美国东海岸 | 200-230 | 150-180 | 欧美用户 |
| 欧洲法兰克福 | 220-250 | 180-200 | 欧洲用户 |

**推荐**: 新加坡 (平衡亚太和全球用户延迟)

---

## 二、Cloudflare 配置详解

### 2.1 域名配置

#### 第 1 步: 添加站点到 Cloudflare

1. 登录 Cloudflare Dashboard
2. 点击 "添加站点" (Add a Site)
3. 输入域名: `funnypixelsapp.com`
4. 选择 **Free 免费计划**
5. Cloudflare 扫描 DNS 记录
6. 前往域名注册商修改 Nameservers 为 Cloudflare 提供的 NS

**Cloudflare Nameservers 示例**:
```
aria.ns.cloudflare.com
ted.ns.cloudflare.com
```

#### 第 2 步: 配置 DNS 记录

**A 记录 (指向应用服务器公网 IP)**:
```
类型    名称    内容                代理状态    TTL
A       @       <服务器1公网IP>     已代理 ☁️   自动
A       api     <服务器1公网IP>     已代理 ☁️   自动
A       admin   <服务器1公网IP>     已代理 ☁️   自动
A       www     <服务器1公网IP>     已代理 ☁️   自动
A       monitor <服务器1公网IP>     已代理 ☁️   自动
```

**重要**:
- ✅ 所有记录必须启用 "已代理" (橙色云朵)
- ⚠️ 数据库服务器不需要 DNS 记录 (内网互联)

### 2.2 SSL/TLS 配置

#### 第 1 步: 选择 SSL/TLS 加密模式

**路径**: SSL/TLS → 概述

**选择**: **Full (strict)** 完全（严格）

**加密路径**:
```
用户浏览器 <--HTTPS--> Cloudflare <--HTTPS--> 源服务器 Nginx
```

**其他模式对比**:
- ❌ Off: 不加密 (不推荐)
- ❌ Flexible: Cloudflare↔用户加密，Cloudflare↔源不加密 (不安全)
- ⚠️ Full: 源服务器可用自签名证书 (中等安全)
- ✅ Full (strict): 源服务器必须用有效证书 (最安全) ← **推荐**

#### 第 2 步: 生成 Cloudflare Origin Certificate

**路径**: SSL/TLS → Origin Server → Create Certificate

**配置**:
```
Private key type: RSA (2048)
Certificate Validity: 15 years (最长)
Hostnames:
  - *.funnypixelsapp.com
  - funnypixelsapp.com
```

**下载证书**:
- `funnypixelsapp.com.pem` (Origin Certificate)
- `funnypixelsapp.com.key` (Private Key)

**部署到服务器**:
```bash
# 在服务器 1 上执行
sudo mkdir -p /etc/ssl/cloudflare
sudo vi /etc/ssl/cloudflare/funnypixels.pem
# 粘贴 Origin Certificate 内容

sudo vi /etc/ssl/cloudflare/funnypixels.key
# 粘贴 Private Key 内容

sudo chmod 644 /etc/ssl/cloudflare/funnypixels.pem
sudo chmod 600 /etc/ssl/cloudflare/funnypixels.key
```

### 2.3 缓存配置

#### 第 1 步: 缓存级别

**路径**: Caching → Configuration

**设置**:
- **Caching Level**: Standard (标准缓存)
- **Browser Cache TTL**: Respect Existing Headers (遵循源服务器 Cache-Control)

#### 第 2 步: 页面规则 (Page Rules)

**免费计划限制**: 3 条规则

**规则 1: API 动态内容 - 绕过缓存**
```
URL: api.funnypixelsapp.com/api/*
设置:
  - Cache Level: Bypass (绕过)
```

**规则 2: 静态资源 - 激进缓存**
```
URL: api.funnypixelsapp.com/api/sprites/*
设置:
  - Cache Level: Cache Everything
  - Edge Cache TTL: 1 month
  - Browser Cache TTL: 1 month
```

**规则 3: MVT 地图瓦片 - 缓存**
```
URL: api.funnypixelsapp.com/api/tiles/pixels/*
设置:
  - Cache Level: Cache Everything
  - Edge Cache TTL: 1 hour
  - Browser Cache TTL: 1 hour
```

### 2.4 速度优化

#### 路径: Speed → Optimization

**Auto Minify (自动压缩)**: ✅ 全部启用
- JavaScript
- CSS
- HTML

**Brotli (Brotli 压缩)**: ✅ 启用

**Early Hints**: ✅ 启用 (HTTP 103 Early Hints，预加载资源)

**HTTP/2**: 自动启用
**HTTP/3 (QUIC)**: ✅ 启用

### 2.5 安全配置

#### 安全级别

**路径**: Security → Settings

**Security Level**: Medium (中等)
- High: 太严格，可能误拦截
- Medium: 平衡安全和用户体验 ✅
- Low: 较宽松

#### Bot Fight Mode (免费版 DDoS 防护)

**路径**: Security → Bots

**Bot Fight Mode**: ✅ 启用

**说明**: 免费提供基础 DDoS 防护，阻止恶意爬虫

#### 防火墙规则 (可选)

**路径**: Security → WAF

免费计划限制: 5 条规则

**示例规则: 仅允许移动端和 Web 访问 API**
```
表达式:
(http.host eq "api.funnypixelsapp.com" and
 not http.user_agent contains "okhttp" and
 not http.user_agent contains "Alamofire" and
 not http.user_agent contains "Mozilla")

操作: Block
```

### 2.6 网络配置

#### WebSocket 支持

**路径**: Network

**WebSockets**: ✅ 启用 (免费版支持)

**注意**: Cloudflare 免费版 WebSocket 限制:
- 超时时间: 100 秒 (源服务器需配置 keepalive < 100s)
- 连接数: 无限制

---

## 三、服务器部署详细步骤

### 3.1 准备工作

#### 材料清单
- [ ] 2 台 VPS 服务器 (已购买并获得 IP)
- [ ] 域名已添加到 Cloudflare
- [ ] Cloudflare Origin Certificate 已生成
- [ ] SSH 密钥已配置
- [ ] 代码仓库 (GitHub/GitLab)

#### 环境变量准备

**生成随机密钥**:
```bash
# JWT Secret (64 字符)
openssl rand -base64 48

# JWT Refresh Secret (64 字符)
openssl rand -base64 48

# 数据库密码 (32 字符)
openssl rand -base64 24

# Redis 密码 (32 字符)
openssl rand -base64 24
```

### 3.2 服务器 1 部署 (应用服务器)

#### 第 1 步: 初始化服务器

```bash
# 本地执行，通过 SSH 连接到服务器 1
ssh root@<服务器1公网IP>

# 在服务器上执行
cd /opt
git clone https://github.com/your-username/funnypixels3.git
cd funnypixels3

# 运行初始化脚本
chmod +x deploy/setup-server.sh
sudo ./deploy/setup-server.sh
```

**setup-server.sh 会自动执行**:
1. ✅ 系统更新
2. ✅ 安装 Docker + Docker Compose
3. ✅ 创建数据目录 `/data/funnypixels/`
4. ✅ 创建 deploy 用户
5. ✅ 配置防火墙 (UFW)
6. ✅ 安装 Nginx
7. ✅ 安装监控工具

#### 第 2 步: 配置环境变量

```bash
# 切换到 deploy 用户
su - deploy
cd /opt/funnypixels3

# 复制环境变量模板
cp deploy/.env.production.template .env.production

# 编辑配置文件
vi .env.production
```

**关键配置项**:
```bash
# 数据库连接 (指向服务器 2 内网 IP)
DB_HOST=<服务器2内网IP>
DB_PASSWORD=<生成的数据库密码>

# Redis 连接 (指向服务器 2 内网 IP)
REDIS_HOST=<服务器2内网IP>
REDIS_PASSWORD=<生成的Redis密码>

# JWT 密钥
JWT_SECRET=<生成的JWT密钥>
JWT_REFRESH_SECRET=<生成的刷新密钥>

# URL 配置
BASE_URL=https://api.funnypixelsapp.com
FRONTEND_URL=https://funnypixelsapp.com
WS_URL=wss://api.funnypixelsapp.com

# CORS
CORS_ORIGIN=https://funnypixelsapp.com,https://admin.funnypixelsapp.com

# 集群配置
CLUSTER_WORKERS=14

# 性能优化 (基于压测结果)
BG_CONCURRENCY_LIMIT=200
BG_QUEUE_MAX=1000
DB_POOL_MAX=75
```

#### 第 3 步: 配置 Nginx

```bash
# 复制 Nginx 配置
sudo cp deploy/nginx.conf /etc/nginx/sites-available/funnypixels

# 上传 Cloudflare Origin Certificate
sudo mkdir -p /etc/ssl/cloudflare
sudo vi /etc/ssl/cloudflare/funnypixels.pem
# 粘贴证书内容

sudo vi /etc/ssl/cloudflare/funnypixels.key
# 粘贴私钥内容

sudo chmod 644 /etc/ssl/cloudflare/funnypixels.pem
sudo chmod 600 /etc/ssl/cloudflare/funnypixels.key

# 启用配置
sudo ln -s /etc/nginx/sites-available/funnypixels /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# 测试配置
sudo nginx -t

# 重载 Nginx
sudo systemctl reload nginx
```

#### 第 4 步: 构建应用

```bash
cd /opt/funnypixels3/backend

# 安装依赖
npm ci --production

# 如果需要编译 TypeScript
npm run build
```

### 3.3 服务器 2 部署 (数据服务器)

#### 第 1 步: 初始化服务器

```bash
# 本地执行，连接到服务器 2
ssh root@<服务器2公网IP>

# 在服务器上执行
apt-get update && apt-get upgrade -y

# 创建数据目录
mkdir -p /data/{postgres,redis,backups}
chmod 750 /data
```

#### 第 2 步: 安装 PostgreSQL 15

```bash
# 添加 PostgreSQL 官方仓库
sudo sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
wget -qO- https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo tee /etc/apt/trusted.gpg.d/pgdg.asc &>/dev/null

sudo apt-get update
sudo apt-get install -y postgresql-15 postgresql-15-postgis-3

# 启动 PostgreSQL
sudo systemctl enable postgresql
sudo systemctl start postgresql
```

#### 第 3 步: 配置 PostgreSQL

**修改 postgresql.conf**:
```bash
sudo vi /etc/postgresql/15/main/postgresql.conf
```

**关键配置** (基于 64GB 内存):
```ini
# 连接配置
listen_addresses = '<服务器2内网IP>,127.0.0.1'
max_connections = 200

# 内存配置
shared_buffers = 16GB
effective_cache_size = 48GB
work_mem = 64MB
maintenance_work_mem = 2GB
wal_buffers = 64MB

# 存储优化 (NVMe SSD)
random_page_cost = 1.1
effective_io_concurrency = 200

# 检查点
checkpoint_completion_target = 0.9
max_wal_size = 4GB
min_wal_size = 1GB
wal_compression = on

# WAL 归档 (用于备份)
archive_mode = on
archive_command = 'test ! -f /data/backups/wal/%f && cp %p /data/backups/wal/%f'

# 并发
max_worker_processes = 8
max_parallel_workers_per_gather = 4
max_parallel_workers = 8

# 日志
log_min_duration_statement = 1000
log_line_prefix = '%t [%p]: [%l-1] user=%u,db=%d '
log_checkpoints = on
logging_collector = on
log_directory = '/var/log/postgresql'

# 扩展
shared_preload_libraries = 'pg_stat_statements'
```

**修改 pg_hba.conf** (访问控制):
```bash
sudo vi /etc/postgresql/15/main/pg_hba.conf
```

**添加**:
```ini
# 允许服务器 1 通过内网连接
host    funnypixels_production    funnypixels    <服务器1内网IP>/32    scram-sha-256
```

**重启 PostgreSQL**:
```bash
sudo systemctl restart postgresql
```

#### 第 4 步: 创建数据库和用户

```bash
sudo -u postgres psql

-- 创建数据库
CREATE DATABASE funnypixels_production;

-- 创建用户
CREATE USER funnypixels WITH PASSWORD '<数据库密码>';

-- 授权
GRANT ALL PRIVILEGES ON DATABASE funnypixels_production TO funnypixels;

-- 启用 PostGIS
\c funnypixels_production
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- 退出
\q
```

#### 第 5 步: 安装 Redis

```bash
# 安装 Redis
sudo apt-get install -y redis-server

# 配置 Redis
sudo vi /etc/redis/redis.conf
```

**关键配置**:
```ini
# 网络
bind <服务器2内网IP> 127.0.0.1
port 6379
protected-mode yes

# 密码
requirepass <Redis密码>

# 内存
maxmemory 6gb
maxmemory-policy allkeys-lru

# 持久化
save 900 1
save 300 10
save 60 10000
appendonly yes
appendfsync everysec

# 慢查询
slowlog-log-slower-than 10000
slowlog-max-len 128
```

**重启 Redis**:
```bash
sudo systemctl restart redis-server
sudo systemctl enable redis-server
```

#### 第 6 步: 配置防火墙

```bash
# 只允许服务器 1 内网访问数据库
sudo ufw allow from <服务器1内网IP> to any port 5432 proto tcp
sudo ufw allow from <服务器1内网IP> to any port 6379 proto tcp

# 允许 SSH
sudo ufw allow 22/tcp

# 启用防火墙
sudo ufw --force enable
sudo ufw status
```

### 3.4 数据库迁移

**在服务器 1 上执行**:
```bash
cd /opt/funnypixels3/backend

# 测试数据库连接
node -e "const knex = require('knex')(require('./knexfile').production); knex.raw('SELECT 1').then(() => console.log('✅ DB Connected')).catch(err => console.error('❌ DB Error:', err)).finally(() => process.exit());"

# 运行数据库迁移
npx knex migrate:latest --env production

# 运行种子数据 (可选)
npx knex seed:run --env production
```

### 3.5 启动应用

#### 使用 PM2 (推荐)

```bash
# 安装 PM2
sudo npm install -g pm2

# 启动应用
cd /opt/funnypixels3/backend
pm2 start src/cluster.js --name funnypixels-backend -i 1 --env production

# 设置开机自启
pm2 startup
pm2 save

# 查看状态
pm2 status
pm2 logs funnypixels-backend
```

#### 使用 Docker Compose (备选)

```bash
cd /opt/funnypixels3

# 修改 docker-compose.production.yml 中的环境变量

# 启动
docker-compose -f docker-compose.production.yml up -d

# 查看日志
docker-compose -f docker-compose.production.yml logs -f backend
```

---

## 四、验证部署

### 4.1 健康检查

```bash
# 本地执行

# 1. API 健康检查
curl -I https://api.funnypixelsapp.com/api/health
# 应返回 200 OK

# 2. 测试 API 端点
curl https://api.funnypixelsapp.com/api/stats
# 应返回 JSON

# 3. 检查 Cloudflare 缓存
curl -I https://api.funnypixelsapp.com/api/sprites/icon/1/emoji/🔥.png
# 查看 CF-Cache-Status 头
# HIT = 缓存命中 ✅
# MISS = 缓存未命中 (首次请求正常)
```

### 4.2 性能测试

```bash
# 延迟测试
ping api.funnypixelsapp.com

# 负载测试 (使用 ApacheBench)
ab -n 1000 -c 10 https://api.funnypixelsapp.com/api/health
```

### 4.3 WebSocket 测试

**浏览器控制台**:
```javascript
const socket = io('wss://api.funnypixelsapp.com');
socket.on('connect', () => console.log('✅ WebSocket Connected'));
socket.on('disconnect', () => console.log('❌ WebSocket Disconnected'));
```

---

## 五、监控与告警

### 5.1 Cloudflare Analytics

**路径**: Analytics → Traffic

**免费提供**:
- 请求数
- 带宽使用
- 缓存命中率
- 威胁分析
- 响应状态码分布

### 5.2 服务器监控 (Grafana)

**访问**: https://monitor.funnypixelsapp.com

**默认看板**:
- 系统资源 (CPU, 内存, 磁盘, 网络)
- 应用性能 (RPS, P95/P99 延迟)
- 数据库性能 (连接数, QPS, 慢查询)
- Redis 性能 (命中率, 内存)

### 5.3 告警配置

**Grafana Alert**:
```yaml
规则:
  - CPU > 80% (持续 5 分钟)
  - 内存 > 85% (持续 5 分钟)
  - 磁盘 > 80%
  - DB 连接 > 150
  - Write P95 > 500ms (持续 5 分钟)
  - 错误率 > 5% (持续 3 分钟)

通知渠道:
  - Email
  - Slack (可选)
  - 企业微信 (可选)
```

---

## 六、备份策略

### 6.1 数据库备份

**Cron 任务** (服务器 2):
```bash
sudo crontab -e
```

**添加**:
```bash
# 每天凌晨 2 点全量备份
0 2 * * * /opt/scripts/backup-postgres.sh

# 每 6 小时归档 WAL
0 */6 * * * /opt/scripts/archive-wal.sh
```

**备份脚本** (`/opt/scripts/backup-postgres.sh`):
```bash
#!/bin/bash
set -e

BACKUP_DIR="/data/backups/postgres"
DATE=$(date +%Y%m%d_%H%M%S)
DBNAME="funnypixels_production"

mkdir -p $BACKUP_DIR

# 全量备份
sudo -u postgres pg_dump -F c -b -v $DBNAME -f $BACKUP_DIR/db_${DATE}.dump

# 压缩
gzip $BACKUP_DIR/db_${DATE}.dump

# 保留 30 天
find $BACKUP_DIR -name "*.gz" -mtime +30 -delete

echo "✅ Backup completed: db_${DATE}.dump.gz"
```

### 6.2 Redis 备份

**Cron 任务**:
```bash
# 每小时备份 RDB
0 * * * * cp /var/lib/redis/dump.rdb /data/backups/redis/dump_$(date +\%Y\%m\%d_\%H\%M).rdb
```

### 6.3 上传到云存储 (可选)

**使用 Cloudflare R2** (免费 10GB 存储):
```bash
# 安装 AWS CLI (R2 兼容 S3 API)
sudo apt-get install -y awscli

# 配置 R2
aws configure --profile r2
# Access Key: <R2 Access Key>
# Secret Key: <R2 Secret>
# Region: auto
# Output: json

# 上传备份
aws s3 sync /data/backups/ s3://funnypixels-backups/ \
  --endpoint-url https://<account-id>.r2.cloudflarestorage.com \
  --profile r2
```

---

## 七、扩展与优化

### 7.1 Cloudflare 免费版限制

| 功能 | 免费版 | 付费版 (Pro $20/月) |
|------|--------|-------------------|
| DDoS 防护 | ✅ 基础 | ✅ 高级 |
| SSL 证书 | ✅ 共享 | ✅ 专用 |
| 页面规则 | 3 条 | 20 条 |
| 缓存 | ✅ 基础 | ✅ 高级 (Cache Reserve) |
| 图片优化 | ❌ | ✅ Polish, Mirage |
| 视频流 | ❌ | ✅ Stream |
| WAF 规则 | 5 条 | 20 条 |
| 负载均衡 | ❌ | ✅ |

**免费版足够支持 10,000 用户，后续按需升级**

### 7.2 从 2 服务器扩展到 6 服务器

**触发条件**: 用户增长到 20,000+

**扩展步骤**:
1. 增加 1 台应用服务器 (负载均衡)
2. 增加 1 台 PostgreSQL 只读副本
3. Redis 主从哨兵 (2 台)

**成本**: ¥2,070/月 → ¥6,000/月

---

## 八、常见问题

### Q1: Cloudflare 显示 "Error 521 - Web server is down"

**原因**: Nginx 未启动或防火墙阻止

**解决**:
```bash
# 检查 Nginx 状态
sudo systemctl status nginx

# 检查防火墙
sudo ufw status

# 确保开放 80/443
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

### Q2: 502 Bad Gateway

**原因**: 后端应用未启动

**解决**:
```bash
# 检查 PM2
pm2 status

# 重启应用
pm2 restart funnypixels-backend

# 查看日志
pm2 logs funnypixels-backend --lines 50
```

### Q3: WebSocket 连接频繁断开

**原因**: Cloudflare 超时

**解决**: 后端配置 keepalive < 100s
```javascript
// backend/src/websocket/index.js
io.set('heartbeat interval', 25000);
io.set('heartbeat timeout', 60000);
```

### Q4: 静态资源缓存未生效

**检查**:
```bash
curl -I https://api.funnypixelsapp.com/api/sprites/icon/1/emoji/🔥.png | grep CF-Cache-Status
```

**如果返回 BYPASS**:
1. 检查 Cloudflare 页面规则
2. 检查源服务器 Cache-Control 头
3. 强制刷新缓存: Cloudflare Dashboard → Caching → Purge Everything

---

## 九、部署检查清单

### 服务器配置
- [ ] 服务器 1 已初始化 (setup-server.sh)
- [ ] 服务器 2 PostgreSQL 已配置
- [ ] 服务器 2 Redis 已配置
- [ ] 内网互联已测试 (ping + telnet)
- [ ] 防火墙规则已配置

### Cloudflare 配置
- [ ] 域名 NS 已切换到 Cloudflare
- [ ] DNS 记录已配置 (A记录 + 已代理)
- [ ] SSL/TLS 模式: Full (strict)
- [ ] Origin Certificate 已部署
- [ ] 页面规则已配置 (3条)
- [ ] WebSocket 已启用
- [ ] Bot Fight Mode 已启用

### 应用配置
- [ ] .env.production 已配置
- [ ] Nginx 配置已部署
- [ ] 数据库迁移已完成
- [ ] 后端应用已启动 (PM2)
- [ ] Admin 前端已部署
- [ ] Grafana 监控可访问

### 验证测试
- [ ] API /health 返回 200
- [ ] WebSocket 连接成功
- [ ] 静态资源缓存命中
- [ ] 数据库备份脚本运行
- [ ] 告警通知测试

---

## 十、成本总结

### 基础配置 (Vultr)

| 项目 | 配置 | 月成本 (USD) | 月成本 (CNY) |
|------|------|-------------|-------------|
| 服务器 1 | 16核32GB | $96 | ¥690 |
| 服务器 2 | 16核64GB NVMe | $192 | ¥1,380 |
| Cloudflare | 免费版 | $0 | ¥0 |
| 域名 | .com | $1 | ¥7 |
| **总计** | | **$289** | **¥2,077** |

### 可选增值服务

| 服务 | 说明 | 月成本 |
|------|------|--------|
| Cloudflare Pro | 高级缓存 + 图片优化 | $20 |
| Cloudflare R2 | 10GB 免费，超出 $0.015/GB | $0-5 |
| 备份存储 | 云存储备份 | $5-10 |
| CDN 流量 | Cloudflare 免费无限 | $0 |

**首年总成本**: 约 ¥25,000 (¥2,077 × 12)

---

**部署文档完成！**

如需帮助，请参考:
- 项目文档: `docs/backend/scripts/PRODUCTION_DEPLOYMENT_GUIDE.md`
- Cloudflare 文档: https://developers.cloudflare.com/
- 技术支持: 提交 GitHub Issue
