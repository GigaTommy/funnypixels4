# FunnyPixels 生产环境快速部署 (15 分钟)

## 📋 前提条件

- [x] 已购买 2 台 VPS (推荐 Vultr 新加坡)
- [x] 域名已添加到 Cloudflare
- [x] Cloudflare Origin Certificate 已生成
- [x] 已准备好环境变量 (JWT密钥、数据库密码等)

---

## 🚀 快速部署流程

### 第 1 步: 服务器基础信息

填写你的服务器信息:

```
服务器 1 (应用):
  公网 IP: _________________
  内网 IP: _________________
  SSH: ssh root@<公网IP>

服务器 2 (数据):
  公网 IP: _________________
  内网 IP: _________________
  SSH: ssh root@<公网IP>
```

### 第 2 步: Cloudflare 配置 (5 分钟)

#### 2.1 添加 DNS 记录

登录 Cloudflare → 你的域名 → DNS → 添加记录

| 类型 | 名称 | 内容 | 代理状态 |
|------|------|------|---------|
| A | @ | `服务器1公网IP` | ☁️ 已代理 |
| A | api | `服务器1公网IP` | ☁️ 已代理 |
| A | admin | `服务器1公网IP` | ☁️ 已代理 |
| A | monitor | `服务器1公网IP` | ☁️ 已代理 |

#### 2.2 SSL/TLS 配置

**SSL/TLS → 概述**: 选择 **Full (strict)**

**SSL/TLS → Origin Server → Create Certificate**:
- Hostnames: `*.funnypixelsapp.com`, `funnypixelsapp.com`
- Validity: 15 years

**下载证书保存为**:
- `funnypixels.pem` (Origin Certificate)
- `funnypixels.key` (Private Key)

#### 2.3 页面规则

创建 3 条页面规则:

1. **API 绕过缓存**:
   - URL: `api.funnypixelsapp.com/api/*`
   - 设置: Cache Level → Bypass

2. **Sprites 缓存**:
   - URL: `api.funnypixelsapp.com/api/sprites/*`
   - 设置: Cache Level → Cache Everything, Edge TTL → 1 month

3. **MVT Tiles 缓存**:
   - URL: `api.funnypixelsapp.com/api/tiles/pixels/*`
   - 设置: Cache Level → Cache Everything, Edge TTL → 1 hour

#### 2.4 其他设置

- **Network → WebSockets**: ✅ 启用
- **Speed → Auto Minify**: ✅ 全部启用
- **Security → Bots → Bot Fight Mode**: ✅ 启用

---

### 第 3 步: 部署服务器 2 (数据库) (5 分钟)

```bash
# 连接到服务器 2
ssh root@<服务器2公网IP>

# 1. 下载并运行初始化脚本
curl -fsSL https://raw.githubusercontent.com/your-username/funnypixels3/main/deploy/setup-database-server.sh | bash

# 2. 创建数据库和用户
sudo -u postgres psql

CREATE DATABASE funnypixels_production;
CREATE USER funnypixels WITH PASSWORD 'YOUR_DB_PASSWORD';
GRANT ALL PRIVILEGES ON DATABASE funnypixels_production TO funnypixels;
\c funnypixels_production
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
\q

# 3. 配置访问权限
echo "host funnypixels_production funnypixels <服务器1内网IP>/32 scram-sha-256" | \
  sudo tee -a /etc/postgresql/15/main/pg_hba.conf

# 4. 配置 PostgreSQL 监听内网
sudo sed -i "s/#listen_addresses = 'localhost'/listen_addresses = '<服务器2内网IP>,127.0.0.1'/" \
  /etc/postgresql/15/main/postgresql.conf

# 5. 重启 PostgreSQL
sudo systemctl restart postgresql

# 6. 配置 Redis 密码
sudo sed -i "s/# requirepass foobared/requirepass YOUR_REDIS_PASSWORD/" /etc/redis/redis.conf
sudo sed -i "s/bind 127.0.0.1 ::1/bind <服务器2内网IP> 127.0.0.1/" /etc/redis/redis.conf
sudo systemctl restart redis-server

# 7. 配置防火墙
sudo ufw allow from <服务器1内网IP> to any port 5432 proto tcp
sudo ufw allow from <服务器1内网IP> to any port 6379 proto tcp
sudo ufw allow 22/tcp
sudo ufw --force enable

echo "✅ 数据库服务器配置完成"
```

---

### 第 4 步: 部署服务器 1 (应用) (5 分钟)

```bash
# 连接到服务器 1
ssh root@<服务器1公网IP>

# 1. 运行初始化脚本
cd /opt
git clone https://github.com/your-username/funnypixels3.git
cd funnypixels3
chmod +x deploy/setup-server.sh
sudo ./deploy/setup-server.sh

# 2. 切换到 deploy 用户
su - deploy
cd /opt/funnypixels3

# 3. 配置环境变量
cp deploy/.env.production.template .env.production
vi .env.production

# 必须修改的配置:
# - DB_HOST=<服务器2内网IP>
# - DB_PASSWORD=YOUR_DB_PASSWORD
# - REDIS_HOST=<服务器2内网IP>
# - REDIS_PASSWORD=YOUR_REDIS_PASSWORD
# - JWT_SECRET=YOUR_JWT_SECRET
# - JWT_REFRESH_SECRET=YOUR_JWT_REFRESH_SECRET

# 4. 上传 Cloudflare 证书
sudo mkdir -p /etc/ssl/cloudflare
sudo vi /etc/ssl/cloudflare/funnypixels.pem  # 粘贴 Origin Certificate
sudo vi /etc/ssl/cloudflare/funnypixels.key  # 粘贴 Private Key
sudo chmod 644 /etc/ssl/cloudflare/funnypixels.pem
sudo chmod 600 /etc/ssl/cloudflare/funnypixels.key

# 5. 配置 Nginx
sudo cp deploy/nginx.conf /etc/nginx/sites-available/funnypixels
sudo ln -s /etc/nginx/sites-available/funnypixels /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx

# 6. 安装依赖并运行迁移
cd backend
npm ci --production
npx knex migrate:latest --env production

# 7. 启动应用
sudo npm install -g pm2
pm2 start src/cluster.js --name funnypixels-backend -i 1 --env production
pm2 startup
pm2 save

echo "✅ 应用服务器配置完成"
```

---

## ✅ 验证部署

### 本地测试

```bash
# 1. 健康检查
curl -I https://api.funnypixelsapp.com/api/health
# 应返回 200 OK

# 2. 测试 API
curl https://api.funnypixelsapp.com/api/stats
# 应返回 JSON

# 3. 检查缓存
curl -I https://api.funnypixelsapp.com/api/sprites/icon/1/emoji/🔥.png | grep CF-Cache-Status
# 第一次: MISS
# 第二次: HIT ✅

# 4. 测试 WebSocket (浏览器控制台)
const socket = io('wss://api.funnypixelsapp.com');
socket.on('connect', () => console.log('✅ Connected'));
```

### 服务器检查

```bash
# 服务器 1
pm2 status
pm2 logs funnypixels-backend --lines 20
sudo systemctl status nginx

# 服务器 2
sudo systemctl status postgresql
sudo systemctl status redis-server
sudo -u postgres psql -c "SELECT count(*) FROM pg_stat_activity WHERE datname='funnypixels_production';"
```

---

## 📊 访问地址

部署完成后，可访问:

- 🌐 **API**: https://api.funnypixelsapp.com
- 📱 **前端**: https://funnypixelsapp.com (需单独部署)
- 🔧 **管理后台**: https://admin.funnypixelsapp.com
- 📊 **监控**: https://monitor.funnypixelsapp.com

---

## 🛠️ 常用运维命令

### 应用管理

```bash
# 查看状态
pm2 status

# 重启应用
pm2 restart funnypixels-backend

# 查看日志
pm2 logs funnypixels-backend

# 查看实时日志
pm2 logs funnypixels-backend --lines 100 -f

# 重新部署
cd /opt/funnypixels3
chmod +x deploy/deploy-app-server.sh
./deploy/deploy-app-server.sh
```

### 数据库管理

```bash
# 连接数据库
sudo -u postgres psql funnypixels_production

# 查看连接数
SELECT count(*) FROM pg_stat_activity;

# 查看数据库大小
SELECT pg_size_pretty(pg_database_size('funnypixels_production'));

# 手动备份
sudo -u postgres pg_dump -F c funnypixels_production > /data/backups/manual_$(date +%Y%m%d).dump
```

### Nginx 管理

```bash
# 测试配置
sudo nginx -t

# 重载配置
sudo systemctl reload nginx

# 查看访问日志
sudo tail -f /var/log/nginx/funnypixels_api_access.log

# 查看错误日志
sudo tail -f /var/log/nginx/funnypixels_api_error.log
```

### Cloudflare 管理

```bash
# 清除所有缓存
Cloudflare Dashboard → Caching → Purge Everything

# 清除特定 URL
Cloudflare Dashboard → Caching → Custom Purge → 输入 URL

# 查看分析数据
Cloudflare Dashboard → Analytics
```

---

## 🆘 常见问题

### Q: 502 Bad Gateway

**检查**:
```bash
# 1. 检查后端是否运行
pm2 status

# 2. 检查日志
pm2 logs funnypixels-backend --lines 50

# 3. 重启应用
pm2 restart funnypixels-backend
```

### Q: 数据库连接失败

**检查**:
```bash
# 1. 测试内网连通性 (在服务器 1)
ping <服务器2内网IP>
telnet <服务器2内网IP> 5432

# 2. 检查防火墙 (在服务器 2)
sudo ufw status

# 3. 检查 PostgreSQL 监听
sudo netstat -tlnp | grep 5432

# 4. 检查 pg_hba.conf
sudo cat /etc/postgresql/15/main/pg_hba.conf | grep <服务器1内网IP>
```

### Q: Cloudflare 缓存未生效

**检查**:
```bash
# 1. 检查页面规则
Cloudflare Dashboard → Rules → Page Rules

# 2. 检查响应头
curl -I https://api.funnypixelsapp.com/api/sprites/icon/1/emoji/🔥.png

# 应包含:
# - CF-Cache-Status: HIT
# - Cache-Control: public, immutable
```

---

## 🎉 部署完成！

恭喜！你的 FunnyPixels 已成功部署到生产环境。

**下一步**:
1. 部署前端应用 (Cloudflare Pages 免费托管)
2. 配置监控告警
3. 设置定时备份
4. 性能优化调整

**需要帮助?**
- 📖 完整文档: `deploy/CLOUDFLARE_DEPLOYMENT_GUIDE.md`
- 🐛 问题反馈: GitHub Issues
- 💬 技术支持: 联系开发团队
