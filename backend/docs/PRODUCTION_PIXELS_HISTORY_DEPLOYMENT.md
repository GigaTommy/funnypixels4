# 生产环境像素历史系统部署指南

## 📋 概述

本指南详细说明如何在生产环境中部署像素历史系统，包括数据库设置、服务部署和验证步骤。

## 🚀 部署步骤

### 1. 数据库设置

#### 方法一：直接执行SQL脚本（推荐）

```bash
# 连接到生产数据库
psql -h your-db-host -U your-username -d your-database

# 执行设置脚本
\i backend/scripts/production-pixels-history-setup.sql
```

#### 方法二：通过数据库管理工具

1. 打开你的数据库管理工具（如pgAdmin、DBeaver等）
2. 连接到生产数据库
3. 执行 `backend/scripts/production-pixels-history-setup.sql` 文件内容

### 2. 验证数据库设置

```sql
-- 检查表是否创建成功
SELECT table_name FROM information_schema.tables 
WHERE table_name LIKE 'pixels_history%' 
ORDER BY table_name;

-- 检查索引是否创建成功
SELECT indexname FROM pg_indexes 
WHERE tablename LIKE 'pixels_history%' 
ORDER BY indexname;

-- 检查函数是否创建成功
SELECT proname FROM pg_proc 
WHERE proname LIKE '%pixels_history%' OR proname LIKE '%partition%';
```

### 3. 部署后端服务

#### 3.1 更新代码

确保以下文件已更新到生产环境：

- `backend/src/services/pixelsHistoryService.js`
- `backend/src/controllers/pixelsHistoryController.js`
- `backend/src/routes/pixelsHistory.js`
- `backend/src/models/Store.js`
- `backend/src/services/pixelDrawService.js`
- `backend/src/server.js`

#### 3.2 重启服务

```bash
# 如果使用Docker
docker-compose restart backend

# 如果使用PM2
pm2 restart backend

# 如果使用systemd
sudo systemctl restart your-backend-service
```

### 4. 启动队列处理器

```bash
# 启动像素历史队列处理器
npm run pixels-history:queue

# 或者使用PM2管理
pm2 start backend/scripts/process-pixels-history-queue.js --name "pixels-history-queue"
```

### 5. 设置定时任务

#### 5.1 分区管理定时任务

```bash
# 编辑crontab
crontab -e

# 添加以下任务（每月1号创建新分区）
0 0 1 * * cd /path/to/your/project/backend && npm run pixels-history:manage -- create-monthly

# 添加清理任务（每月15号清理旧分区）
0 2 15 * * cd /path/to/your/project/backend && npm run pixels-history:manage -- cleanup
```

#### 5.2 数据归档定时任务

```bash
# 添加归档任务（每月1号归档3个月前的数据）
0 1 1 * * cd /path/to/your/project/backend && npm run pixels-history:archive
```

## 🔧 配置检查

### 1. 环境变量

确保生产环境配置了以下变量：

```bash
# 数据库配置
DATABASE_URL=postgresql://username:password@host:port/database

# Redis配置
REDIS_HOST=your-redis-host
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password

# 或者使用Upstash Redis
UPSTASH_REDIS_REST_URL=https://your-redis-url
UPSTASH_REDIS_REST_TOKEN=your-redis-token
```

### 2. 服务配置

检查以下服务是否正常运行：

- 数据库连接
- Redis连接
- 队列处理器
- API服务

## 🧪 验证部署

### 1. API测试

```bash
# 测试API端点
curl -X GET "https://your-api-domain/api/pixels-history/stats" \
  -H "Authorization: Bearer your-token"

# 测试用户历史查询
curl -X GET "https://your-api-domain/api/pixels-history/user/your-user-id" \
  -H "Authorization: Bearer your-token"
```

### 2. 功能测试

```bash
# 运行测试脚本
cd backend
npm run pixels-history:test
```

### 3. 监控检查

- 检查队列处理器日志
- 监控数据库性能
- 检查API响应时间
- 监控存储空间使用

## 📊 性能优化

### 1. 数据库优化

```sql
-- 检查分区效果
EXPLAIN (ANALYZE, BUFFERS) 
SELECT * FROM pixels_history 
WHERE history_date >= '2025-09-01' 
AND history_date < '2025-10-01';

-- 检查索引使用情况
SELECT schemaname, tablename, attname, n_distinct, correlation 
FROM pg_stats 
WHERE tablename LIKE 'pixels_history%';
```

### 2. 队列优化

- 调整队列处理批次大小
- 监控队列积压情况
- 设置合适的重试策略

### 3. 存储优化

- 定期清理旧分区
- 监控存储空间使用
- 设置数据归档策略

## 🚨 故障排除

### 1. 常见问题

#### 问题：分区创建失败
```sql
-- 检查分区是否存在
SELECT tablename FROM pg_tables WHERE tablename LIKE 'pixels_history_%';

-- 手动创建分区
SELECT create_monthly_partition('pixels_history', '2025-10-01');
```

#### 问题：队列处理失败
```bash
# 检查队列状态
npm run pixels-history:manage -- stats

# 重启队列处理器
pm2 restart pixels-history-queue
```

#### 问题：API响应慢
```sql
-- 检查索引使用情况
EXPLAIN (ANALYZE, BUFFERS) 
SELECT * FROM pixels_history 
WHERE user_id = 'your-user-id' 
ORDER BY created_at DESC 
LIMIT 100;
```

### 2. 日志检查

```bash
# 检查应用日志
tail -f /var/log/your-app.log

# 检查队列处理器日志
pm2 logs pixels-history-queue

# 检查数据库日志
tail -f /var/log/postgresql/postgresql.log
```

## 📈 监控和维护

### 1. 关键指标

- 队列处理速度
- 数据库查询性能
- 存储空间使用
- API响应时间

### 2. 定期维护

- 每月创建新分区
- 定期清理旧分区
- 监控索引使用情况
- 备份重要数据

### 3. 告警设置

- 队列积压告警
- 数据库连接告警
- 存储空间告警
- API错误率告警

## 🔒 安全考虑

1. **数据库访问控制**
   - 使用专用数据库用户
   - 限制权限范围
   - 启用SSL连接

2. **API安全**
   - 使用JWT认证
   - 实施速率限制
   - 验证输入参数

3. **数据保护**
   - 定期备份
   - 加密敏感数据
   - 访问日志记录

## 📞 支持

如果遇到问题，请检查：

1. 数据库连接状态
2. Redis连接状态
3. 服务日志
4. 系统资源使用情况

---

**注意**: 在生产环境部署前，请务必在测试环境中验证所有功能。
