# Docker 服务配置总结

## ✅ 已完成的配置

### 1. Docker Compose 配置
- **文件**: `docker-compose.yml`
- **服务**:
  - PostgreSQL 15 + PostGIS 3.3 (端口 5432)
  - Redis 7 (端口 6379)
  - pgAdmin (端口 5050)

### 2. 管理脚本
- **文件**: `docker-services.sh`
- **功能**:
  - 一键启动/停止/重启服务
  - 查看服务状态和日志
  - 数据库备份和恢复
  - 进入 PostgreSQL/Redis 命令行
  - 清理所有数据

### 3. 配置文件
- **文件**: `config/pgadmin-servers.json`
- **功能**: pgAdmin 自动连接配置

### 4. 文档
- `INSTALL_DOCKER.md` - Docker 安装和快速启动指南
- `DOCKER_SETUP.md` - 完整的 Docker 配置和使用文档
- `DOCKER_QUICK_REF.md` - 快速参考脚本

## 🚀 快速使用

### 第一步：安装 Docker Desktop

如果尚未安装，请访问：
- macOS/Windows: https://www.docker.com/products/docker-desktop
- 或使用 Homebrew: `brew install --cask docker`

### 第二步：启动 Docker Desktop

打开 Docker Desktop 应用程序，等待引擎启动完成。

### 第三步：启动服务

```bash
# 进入项目根目录
cd /Users/ginochow/code/funnypixels3

# 使用管理脚本启动（推荐）
./docker-services.sh start

# 或使用 docker-compose
docker-compose up -d
```

### 第四步：验证服务

```bash
# 查看服务状态
./docker-services.sh status

# 应该看到以下服务运行中：
# ✅ funnypixels_postgres (PostgreSQL + PostGIS)
# ✅ funnypixels_redis (Redis)
# ✅ funnypixels_pgadmin (pgAdmin)
```

## 📍 服务访问

### PostgreSQL
```
地址: localhost:5432
数据库: funnypixels_postgres
用户: postgres
密码: password
```

**连接方式**:
```bash
# 命令行
./docker-services.sh psql

# 代码连接（.env配置）
DB_HOST=localhost
DB_PORT=5432
DB_NAME=funnypixels_postgres
DB_USER=postgres
DB_PASSWORD=password
```

### Redis
```
地址: localhost:6379
无密码
```

**连接方式**:
```bash
# 命令行
./docker-services.sh redis

# 代码连接（.env配置）
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
```

### pgAdmin
```
地址: http://localhost:5050
邮箱: admin@funnypixels.com
密码: admin123
```

## 🛠️ 常用命令

### 服务管理
```bash
# 启动所有服务
./docker-services.sh start

# 停止所有服务
./docker-services.sh stop

# 重启所有服务
./docker-services.sh restart

# 查看服务状态
./docker-services.sh status

# 查看服务日志
./docker-services.sh logs
```

### 数据库操作
```bash
# 进入 PostgreSQL 命令行
./docker-services.sh psql

# 备份数据库
./docker-services.sh backup

# 恢复数据库
./docker-services.sh restore funnypixels_backup_20250108_120000.sql

# 运行数据库迁移
cd backend
npm run migrate
```

### 清理操作
```bash
# 停止并删除容器（保留数据）
docker-compose down

# 停止并删除容器和数据（危险！）
./docker-services.sh clean
```

## 📋 数据库迁移

Docker 服务启动后，运行数据库迁移：

```bash
# 进入后端目录
cd backend

# 确保环境变量正确配置
# .env.local 应该包含：
# DB_HOST=localhost
# DB_PORT=5432
# DB_NAME=funnypixels_postgres
# DB_USER=postgres
# DB_PASSWORD=password
# LOCAL_VALIDATION=true

# 运行迁移
npm run migrate

# 应该看到：
# ✅ Migration completed successfully
```

## 🎯 完整工作流程

### 1. 启动开发环境
```bash
# 1. 启动 Docker 服务
./docker-services.sh start

# 2. 等待服务就绪（约5-10秒）

# 3. 运行数据库迁移（如果需要）
cd backend && npm run migrate && cd ..

# 4. 启动后端服务
cd backend && npm run dev &

# 5. 启动前端服务（可选）
cd admin-frontend && npm run dev &
```

### 2. 访问应用
```
后端 API:        http://localhost:3000
前端管理界面:    http://localhost:5173 (或配置的端口)
pgAdmin:         http://localhost:5050
```

### 3. 停止开发环境
```bash
# 停止后端和前端（按 Ctrl+C）

# 停止 Docker 服务
./docker-services.sh stop
```

## 🔍 故障排查

### 问题 1: Docker 未运行
```bash
# 解决方案：启动 Docker Desktop 应用程序
# 等待状态栏显示 "Docker Desktop is running"
```

### 问题 2: 端口已被占用
```bash
# 检查端口占用
lsof -i :5432  # PostgreSQL
lsof -i :6379  # Redis
lsof -i :5050  # pgAdmin

# 修改 docker-compose.yml 中的端口映射
```

### 问题 3: 容器启动失败
```bash
# 查看详细日志
docker-compose logs postgres
docker-compose logs redis
docker-compose logs pgadmin

# 重启服务
./docker-services.sh restart
```

### 问题 4: 数据库连接失败
```bash
# 检查服务状态
./docker-services.sh status

# 验证 PostgreSQL 是否正常
docker-compose exec postgres pg_isready -U postgres

# 测试连接
./docker-services.sh psql
```

## 📊 监控和维护

### 定期备份
```bash
# 设置每日自动备份（使用 cron）
crontab -e

# 添加以下行（每天凌晨2点备份）
0 2 * * * cd /Users/ginochow/code/funnypixels3 && ./docker-services.sh backup
```

### 清理旧备份
```bash
# 保留最近7天的备份
find backups/ -name "funnypixels_backup_*.sql" -mtime +7 -delete
```

### 监控磁盘使用
```bash
# 查看 Docker 磁盘使用
docker system df

# 清理未使用的资源
docker system prune -a
```

## 📚 相关文档

- [INSTALL_DOCKER.md](./INSTALL_DOCKER.md) - Docker 安装和启动指南
- [DOCKER_SETUP.md](./DOCKER_SETUP.md) - 完整配置文档
- [BACKEND_SETUP.md](../deployment/BACKEND_SETUP.md) - 后端配置
- [README.md](./README.md) - 项目总览

## 🆘 获取帮助

```bash
# 显示帮助信息
./docker-services.sh help

# 查看详细文档
cat INSTALL_DOCKER.md
cat DOCKER_SETUP.md
```
