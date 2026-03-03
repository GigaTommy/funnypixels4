# 像素历史系统部署指南

## 🚀 快速部署

### 1. 数据库迁移

```bash
# 运行迁移创建分区表
npm run migrate

# 验证迁移结果
npm run pixels-history:test
```

### 2. 启动系统

```bash
# 启动完整系统（包括队列处理器）
npm run pixels-history:start

# 或者只启动队列处理器
npm run pixels-history:queue
```

### 3. 验证部署

```bash
# 运行完整测试
npm run pixels-history:test

# 检查系统状态
npm run pixels-history:manage stats
```

## 🔧 生产环境配置

### 环境变量

确保以下环境变量已正确设置：

```bash
# 数据库配置
DB_HOST=your-db-host
DB_PORT=5432
DB_NAME=your-db-name
DB_USER=your-db-user
DB_PASSWORD=your-db-password

# Redis配置
UPSTASH_REDIS_REST_URL=your-redis-url
UPSTASH_REDIS_REST_TOKEN=your-redis-token

# 应用配置
NODE_ENV=production
```

### 系统要求

- **PostgreSQL 12+** - 支持分区表
- **Redis** - 用于队列处理
- **Node.js 16+** - 运行时环境
- **内存**: 最少 512MB，推荐 1GB+
- **存储**: 根据数据量，推荐 SSD

## 📊 监控和维护

### 定期任务

建议设置以下定时任务：

```bash
# 每天凌晨2点创建未来分区
0 2 * * * cd /path/to/project && npm run pixels-history:manage create-partition $(date -d "+1 month" +%Y-%m-01)

# 每周日凌晨3点优化索引
0 3 * * 0 cd /path/to/project && npm run pixels-history:manage optimize-indexes

# 每月1号凌晨4点清理旧分区
0 4 1 * * cd /path/to/project && npm run pixels-history:manage cleanup-partitions 12
```

### 监控指标

关键监控指标：

1. **队列长度**: 监控 `pixel_history_queue` 长度
2. **分区大小**: 监控各分区表大小
3. **查询性能**: 监控API响应时间
4. **存储使用**: 监控数据库存储空间

### 告警设置

建议设置以下告警：

- 队列积压超过 1000 条消息
- 分区表大小超过 1GB
- API响应时间超过 2 秒
- 数据库连接失败

## 🔍 故障排除

### 常见问题

1. **迁移失败**
   ```bash
   # 检查数据库连接
   npm run check:env
   
   # 手动运行迁移
   npx knex migrate:latest
   ```

2. **队列积压**
   ```bash
   # 检查队列状态
   npm run pixels-history:queue --status
   
   # 增加队列处理器
   npm run pixels-history:queue --interval 1000
   ```

3. **查询性能慢**
   ```bash
   # 优化索引
   npm run pixels-history:manage optimize-indexes
   
   # 更新统计信息
   npm run pixels-history:manage stats
   ```

4. **存储空间不足**
   ```bash
   # 清理旧分区
   npm run pixels-history:manage cleanup-partitions 6
   
   # 归档旧数据
   npm run pixels-history:archive archive 2024-06-01
   ```

### 日志位置

- 应用日志: `backend/logs/`
- 数据库日志: PostgreSQL 日志
- 系统日志: `/var/log/`

## 📈 性能优化

### 数据库优化

1. **分区策略**
   - 按月分区，每个分区不超过 1GB
   - 定期清理 12 个月前的旧分区

2. **索引优化**
   - 定期运行 `ANALYZE` 更新统计信息
   - 监控索引使用情况

3. **查询优化**
   - 使用日期范围限制查询
   - 避免全表扫描

### 应用优化

1. **队列处理**
   - 调整批处理大小
   - 优化处理间隔

2. **缓存策略**
   - 缓存热点查询结果
   - 使用 Redis 缓存

## 🔒 安全考虑

### 数据安全

1. **访问控制**
   - 使用 JWT 认证
   - 实施速率限制

2. **数据保护**
   - 定期备份数据
   - 加密敏感信息

3. **审计日志**
   - 记录所有操作
   - 监控异常行为

## 📞 支持

如有问题，请：

1. 查看日志文件
2. 运行诊断命令
3. 联系开发团队
4. 提交 Issue

---

**注意**: 在生产环境中部署前，请务必在测试环境中验证所有功能。
