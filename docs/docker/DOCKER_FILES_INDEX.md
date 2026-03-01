# Docker 环境配置文件清单

## 📁 已创建/更新的文件

### 核心配置文件
1. **docker-compose.yml** - Docker 服务编排配置
   - PostgreSQL 15 + PostGIS 3.3
   - Redis 7
   - pgAdmin 4

2. **config/pgadmin-servers.json** - pgAdmin 服务器配置
   - 自动连接配置

### 管理脚本
3. **docker-services.sh** - Docker 服务管理脚本
   - 启动/停止/重启服务
   - 查看状态和日志
   - 数据库备份恢复
   - 进入命令行工具

4. **DOCKER_QUICK_REF.md** - 快速启动脚本（可执行）

### 文档文件
5. **INSTALL_DOCKER.md** - Docker 安装和快速启动指南
   - 系统要求
   - 安装步骤
   - 快速开始
   - 故障排查

6. **DOCKER_SETUP.md** - 完整的 Docker 配置指南
   - 详细配置说明
   - 高级功能
   - 备份恢复
   - 性能优化

7. **DOCKER_SUMMARY.md** - Docker 配置总结
   - 快速使用指南
   - 常用命令
   - 工作流程
   - 监控维护

### 环境配置
8. **backend/.env.local** - 后端环境变量
   - 数据库连接配置
   - Redis 连接配置
   - 本地验证模式

## 🚀 快速开始

### 1. 安装 Docker
```bash
# macOS
brew install --cask docker

# 或访问官网下载
# https://www.docker.com/products/docker-desktop
```

### 2. 启动 Docker Desktop
打开 Docker Desktop 应用程序，等待启动完成。

### 3. 启动服务
```bash
cd /Users/ginochow/code/funnypixels3

# 方式一：使用管理脚本（推荐）
./docker-services.sh start

# 方式二：使用 docker-compose
docker-compose up -d

# 方式三：使用快速启动脚本
./DOCKER_QUICK_REF.md
```

### 4. 验证服务
```bash
# 查看服务状态
./docker-services.sh status

# 测试 PostgreSQL
./docker-services.sh psql

# 测试 Redis
./docker-services.sh redis

# 访问 pgAdmin
# http://localhost:5050
```

## 📍 服务地址

| 服务 | 地址 | 用户名 | 密码 |
|------|------|--------|------|
| PostgreSQL + PostGIS | localhost:5432 | postgres | password |
| Redis | localhost:6379 | - | - |
| pgAdmin | http://localhost:5050 | admin@funnypixels.com | admin123 |

## 🛠️ 管理命令

```bash
# 服务管理
./docker-services.sh start      # 启动所有服务
./docker-services.sh stop       # 停止所有服务
./docker-services.sh restart    # 重启所有服务
./docker-services.sh status     # 查看服务状态
./docker-services.sh logs       # 查看服务日志

# 数据库管理
./docker-services.sh psql       # 进入 PostgreSQL
./docker-services.sh redis      # 进入 Redis
./docker-services.sh backup     # 备份数据库
./docker-services.sh restore    # 恢复数据库

# 系统管理
./docker-services.sh clean      # 清理所有数据（危险！）
./docker-services.sh help       # 显示帮助信息
```

## 📚 文档导航

### 新手入门
1. 📖 [INSTALL_DOCKER.md](./INSTALL_DOCKER.md) - 从这里开始
   - Docker 安装
   - 服务启动
   - 基础验证

### 快速参考
2. 📋 [DOCKER_SUMMARY.md](./DOCKER_SUMMARY.md) - 快速查阅
   - 常用命令
   - 服务地址
   - 工作流程

### 深入学习
3. 📚 [DOCKER_SETUP.md](./DOCKER_SETUP.md) - 完整指南
   - 高级配置
   - 备份恢复
   - 性能优化
   - 故障排查

## 🎯 下一步

### 1. 运行数据库迁移
```bash
cd backend
npm run migrate
```

### 2. 启动后端服务
```bash
cd backend
npm run dev
```

### 3. 启动前端服务（可选）
```bash
cd admin-frontend
npm run dev
```

### 4. 运行 iOS App
- 使用 Xcode 打开项目
- 点击 Run 按钮

## 🔍 验证安装

### 检查 Docker
```bash
docker --version
docker-compose --version
docker info
```

### 检查服务
```bash
docker ps
# 应该看到：
# - funnypixels_postgres
# - funnypixels_redis
# - funnypixels_pgadmin
```

### 测试连接
```bash
# PostgreSQL
docker-compose exec postgres pg_isready -U postgres

# Redis
docker-compose exec redis redis-cli ping
# 应返回: PONG
```

## ❓ 常见问题

### Q1: Docker 命令找不到？
**A**: 确保 Docker Desktop 已安装并运行。
```bash
# 检查 Docker
docker info

# 重新安装
brew install --cask docker
```

### Q2: 端口已被占用？
**A**: 修改 docker-compose.yml 中的端口映射。
```yaml
ports:
  - "5433:5432"  # 改为其他端口
```

### Q3: 服务启动失败？
**A**: 查看日志并重启。
```bash
docker-compose logs postgres
./docker-services.sh restart
```

### Q4: 如何完全清理？
**A**: 使用清理命令（会删除所有数据！）。
```bash
./docker-services.sh clean
```

## 📞 获取帮助

```bash
# 显示帮助
./docker-services.sh help

# 查看日志
./docker-services.sh logs

# 查看状态
./docker-services.sh status
```

## ✅ 检查清单

启动前检查：
- [ ] Docker Desktop 已安装
- [ ] Docker Desktop 正在运行
- [ ] 端口 5432、6379、5050 未被占用
- [ ] 有足够的磁盘空间（至少 2GB）

启动后验证：
- [ ] funnypixels_postgres 容器运行中
- [ ] funnypixels_redis 容器运行中
- [ ] funnypixels_pgadmin 容器运行中
- [ ] 可以连接到 PostgreSQL
- [ ] 可以连接到 Redis
- [ ] 可以访问 pgAdmin 界面

数据库迁移：
- [ ] 运行了 npm run migrate
- [ ] 数据库表创建成功
- [ ] 种子数据导入成功（可选）

应用启动：
- [ ] 后端服务运行在端口 3000
- [ ] 前端服务运行（如需要）
- [ ] iOS App 可以连接到后端
