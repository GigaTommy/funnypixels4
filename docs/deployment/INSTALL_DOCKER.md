# Docker 环境快速启动指南

## 📋 前置要求

在启动 Docker 服务之前，请确保已安装以下软件：

### 1. 安装 Docker Desktop

**macOS**:
```bash
# 使用 Homebrew 安装
brew install --cask docker

# 或访问官网下载
# https://www.docker.com/products/docker-desktop
```

**Windows**:
```bash
# 访问官网下载安装程序
# https://www.docker.com/products/docker-desktop
```

**Linux (Ubuntu)**:
```bash
# 更新包索引
sudo apt-get update

# 安装依赖
sudo apt-get install ca-certificates curl gnupg lsb-release

# 添加 Docker 官方 GPG key
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

# 设置仓库
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# 安装 Docker Engine
sudo apt-get update
sudo apt-get install docker-ce docker-ce-cli containerd.io docker-compose-plugin
```

### 2. 启动 Docker Desktop

1. 打开 Docker Desktop 应用程序
2. 等待 Docker 引擎启动（状态栏显示 "Docker Desktop is running"）
3. 验证 Docker 是否正常运行：
   ```bash
   docker info
   docker-compose version
   ```

## 🚀 快速启动

### 方式一：使用管理脚本（推荐）

```bash
# 进入项目根目录
cd /Users/ginochow/code/funnypixels3

# 启动所有服务
./docker-services.sh start

# 查看服务状态
./docker-services.sh status

# 查看服务日志
./docker-services.sh logs
```

### 方式二：使用 Docker Compose

```bash
# 进入项目根目录
cd /Users/ginochow/code/funnypixels3

# 启动所有服务
docker-compose up -d

# 查看服务状态
docker-compose ps

# 查看服务日志
docker-compose logs -f
```

## 📊 服务说明

启动后，以下服务将可用：

| 服务 | 地址 | 用户名 | 密码 | 说明 |
|------|------|--------|------|------|
| PostgreSQL | localhost:5432 | postgres | password | 主数据库 + PostGIS |
| Redis | localhost:6379 | - | - | 缓存服务 |
| pgAdmin | http://localhost:5050 | admin@funnypixels.com | admin123 | 数据库管理界面 |

## ✅ 验证安装

### 1. 检查 Docker 服务

```bash
# 检查 Docker 是否运行
docker info

# 检查容器状态
docker ps

# 应该看到以下容器运行中：
# - funnypixels_postgres
# - funnypixels_redis
# - funnypixels_pgadmin
```

### 2. 测试 PostgreSQL 连接

```bash
# 使用管理脚本进入 PostgreSQL
./docker-services.sh psql

# 或使用 docker-compose
docker-compose exec postgres psql -U postgres funnypixels_postgres

# 在 psql 中执行
\conninfo          # 查看连接信息
SELECT version();   # 查看 PostgreSQL 版本
SELECT PostGIS_Version();  # 查看 PostGIS 版本
\dt                # 列出所有表
\q                 # 退出
```

### 3. 测试 Redis 连接

```bash
# 使用管理脚本进入 Redis
./docker-services.sh redis

# 或使用 docker-compose
docker-compose exec redis redis-cli

# 在 redis-cli 中执行
PING               # 应返回 PONG
SET test "hello"   # 设置测试值
GET test           # 获取值，应返回 "hello"
exit               # 退出
```

### 4. 访问 pgAdmin

1. 打开浏览器访问: http://localhost:5050
2. 登录：
   - Email: admin@funnypixels.com
   - Password: admin123
3. 点击左侧 "Servers" 展开
4. 点击 "FunnyPixels PostgreSQL"
5. 输入密码: password
6. 浏览数据库对象

## 🔧 常用管理命令

```bash
# 启动服务
./docker-services.sh start

# 停止服务
./docker-services.sh stop

# 重启服务
./docker-services.sh restart

# 查看状态
./docker-services.sh status

# 查看日志
./docker-services.sh logs

# 进入 PostgreSQL
./docker-services.sh psql

# 进入 Redis
./docker-services.sh redis

# 备份数据库
./docker-services.sh backup

# 恢复数据库
./docker-services.sh restore <backup_file>

# 清理所有数据（危险！）
./docker-services.sh clean
```

## 🎯 下一步

Docker 服务启动后，你可以：

1. **运行数据库迁移**:
   ```bash
   cd backend
   npm run migrate
   ```

2. **启动后端服务**:
   ```bash
   npm run dev
   ```

3. **启动前端服务**:
   ```bash
   cd admin-frontend
   npm run dev
   ```

4. **运行 iOS App**:
   - 打开 Xcode
   - 选择 FunnyPixelsApp 项目
   - 点击 Run 按钮

## ❓ 遇到问题？

### Docker Desktop 无法启动

**macOS**:
- 检查系统偏好设置是否允许 Docker
- 重启 Docker Desktop
- 查看日志: Help -> Troubleshooting -> Diagnostics & Logs

**Windows**:
- 确保 WSL 2 已安装
- 检查 Hyper-V 是否启用
- 以管理员身份运行 Docker Desktop

### 端口已被占用

修改 `docker-compose.yml` 中的端口映射：

```yaml
services:
  postgres:
    ports:
      - "5433:5432"  # 改为 5433

  redis:
    ports:
      - "6380:6379"  # 改为 6380

  pgadmin:
    ports:
      - "5051:80"    # 改为 5051
```

同时更新 `.env.local`:
```env
DB_PORT=5433
REDIS_PORT=6380
```

### 容器启动失败

```bash
# 查看详细日志
docker-compose logs postgres
docker-compose logs redis
docker-compose logs pgadmin

# 重启特定服务
docker-compose restart postgres

# 完全重建
docker-compose down -v
docker-compose up -d
```

### 内存不足

在 Docker Desktop 中增加资源限制：
- Docker Desktop -> Settings -> Resources
- 增加 Memory 和 Swap
- 点击 "Apply & Restart"

## 📚 更多信息

详细配置和使用说明，请参考：
- [DOCKER_SETUP.md](./DOCKER_SETUP.md) - 完整的 Docker 配置指南
- [BACKEND_SETUP.md](./BACKEND_SETUP.md) - 后端服务配置
