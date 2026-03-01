# FunnyPixels 后端服务快速启动指南

## 🚀 快速启动（推荐）

### 一键启动所有服务

```bash
cd /Users/ginochow/code/funnypixels3
./start-all.sh
```

这个脚本会自动：
1. ✅ 启动 PostgreSQL 和 Redis（Docker）
2. ✅ 检查并安装依赖
3. ✅ 运行数据库迁移
4. ✅ 填充种子数据
5. ✅ 启动后端服务

---

## 📋 手动启动（分步详解）

如果一键启动失败，请按以下步骤手动操作：

### 步骤 1: 启动数据库服务

```bash
cd /Users/ginochow/code/funnypixels3
docker-compose up -d postgres redis
```

**验证数据库：**
```bash
docker ps | grep funnypixels
```

应该看到：
```
funnypixels_postgres
funnypixels_redis
```

---

### 步骤 2: 等待数据库启动

```bash
# 等待 10 秒让数据库完全启动
sleep 10

# 验证 PostgreSQL
docker exec funnypixels_postgres pg_isready -U postgres

# 验证 Redis
docker exec funnypixels_redis redis-cli ping
```

---

### 步骤 3: 安装后端依赖

```bash
cd backend

# 首次运行需要安装依赖
npm install
```

---

### 步骤 4: 配置环境变量

```bash
# 使用已创建的本地配置
export LOCAL_VALIDATION=true

# 或直接使用配置文件
cp .env.local .env
```

**已配置的关键变量：**
- `DB_HOST=localhost`
- `DB_PORT=5432`
- `DB_NAME=funnypixels_postgres`
- `DB_USER=postgres`
- `DB_PASSWORD=password`
- `REDIS_HOST=localhost`
- `REDIS_PORT=6379`

---

### 步骤 5: 运行数据库迁移

```bash
cd backend

# 运行所有迁移
npm run migrate

# 如果遇到错误，可以尝试：
npm run migrate:rollback --all
npm run migrate
```

**预期输出：**
```
Batch 1 run: 1 migrations
...
Migration completed successfully
```

---

### 步骤 6: 填充种子数据

```bash
npm run seed
```

**预期输出：**
```
🌱 开始运行所有种子数据...
...
🎉 所有种子数据运行完成!
```

---

### 步骤 7: 启动后端服务

```bash
# 开发模式（自动重启）
npm run dev

# 或生产模式
npm start
```

**成功标志：**
```
🚀 FunnyPixels Server started on port 3000
📡 WebSocket server ready
✅ Database connected
```

---

## ✅ 验证服务状态

### 检查所有服务

```bash
# 后端 API
curl http://localhost:3000/api/health

# 数据库
docker exec funnypixels_postgres psql -U postgres -c "SELECT version();"

# Redis
docker exec funnypixels_redis redis-cli ping
```

### 访问服务

| 服务 | URL | 用途 |
|------|-----|------|
| **后端 API** | http://localhost:3000 | REST API |
| **WebSocket** | ws://localhost:3000 | 实时通信 |
| **PgAdmin** | http://localhost:5050 | 数据库管理 |

**PgAdmin 登录：**
- Email: `admin@funnypixels.com`
- Password: `admin123`

---

## 🛠️ 常见问题排查

### ❌ "Cannot connect to database"

**原因：** PostgreSQL 未启动或未初始化

**解决：**
```bash
# 1. 检查 Docker 容器
docker ps | grep postgres

# 2. 如果没有运行，启动它
docker-compose up -d postgres

# 3. 等待 10 秒
sleep 10

# 4. 运行迁移
cd backend
npm run migrate
```

---

### ❌ "ECONNREFUSED: Connection refused"

**原因：** 后端服务未启动

**解决：**
```bash
cd backend
npm run dev
```

---

### ❌ "Migration failed"

**原因：** 数据库表已存在或冲突

**解决：**
```bash
# 回滚所有迁移
npm run migrate:rollback --all

# 重新运行
npm run migrate
```

---

### ❌ "Redis connection error"

**原因：** Redis 未启动

**解决：**
```bash
docker-compose up -d redis
```

---

### ❌ "Port 3000 is already in use"

**原因：** 端口被占用

**解决：**
```bash
# 查找占用进程
lsof -i :3000

# 杀死进程
kill -9 <PID>

# 或者使用其他端口
PORT=3001 npm run dev
```

---

## 📊 数据库管理

### 查看所有表

```bash
docker exec -it funnypixels_postgres psql -U postgres -d funnypixels_postgres

\dt  # 列出所有表
\d users  # 查看 users 表结构
SELECT COUNT(*) FROM users;  # 统计用户数
```

### 重置数据库

```bash
cd backend
npm run db:reset
```

这会：
1. 回滚所有迁移
2. 重新运行迁移
3. 填充种子数据

---

## 🎯 下一步

启动成功后，您可以：

1. **启动 iOS App**
   - 在 Xcode 中运行项目
   - 应该能看到地图并登录

2. **启动 Web 端（可选）**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
   访问 http://localhost:5173

3. **查看 API 文档**
   - Swagger: http://localhost:3000/api-docs
   - 或查看 `README.md`

---

## 💡 开发提示

### 查看日志

```bash
# 后端日志在终端输出
# 或查看特定日志
tail -f backend/logs/app.log

# Docker 日志
docker logs funnypixels_postgres
docker logs funnypixels_redis
```

### 重启服务

```bash
# 重启后端
# 按 Ctrl+C 停止，然后：
npm run dev

# 重启数据库
docker-compose restart postgres redis
```

### 清理环境

```bash
# 停止所有服务
docker-compose down

# 删除数据（谨慎！）
docker-compose down -v
```

---

## 📞 获取帮助

如果以上步骤都无法解决问题，请检查：

1. **Docker 是否运行**
   ```bash
   docker info
   ```

2. **端口是否被占用**
   ```bash
   lsof -i :3000
   lsof -i :5432
   lsof -i :6379
   ```

3. **环境变量是否正确**
   ```bash
   cat backend/.env.local
   ```

4. **查看错误日志**
   - 后端日志在终端
   - Docker 日志：`docker-compose logs`

---

## ✨ 成功标志

当所有服务正常运行时，您应该看到：

```
✅ Docker 容器运行中
✅ 数据库迁移完成
✅ 种子数据填充成功
✅ 后端服务监听端口 3000
✅ WebSocket 服务就绪
✅ 可以访问健康检查端点
```

现在您可以开始开发了！🎉
