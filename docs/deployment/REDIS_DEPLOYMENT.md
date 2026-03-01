# Redis 生产环境部署指南

本文档提供 FunnyPixels 项目中 Redis 的生产环境部署指南。

## 目录

- [架构概述](#架构概述)
- [开发环境设置](#开发环境设置)
- [生产环境设置](#生产环境设置)
- [环境变量配置](#环境变量配置)
- [监控和健康检查](#监控和健康检查)
- [性能优化](#性能优化)
- [故障排查](#故障排查)

## 架构概述

### 开发环境（单实例）
- 1 个 Redis Master
- Redis Commander（Web 管理界面）
- 内存：512MB
- 持久化：AOF（everysec）

### 生产环境（主从 + Sentinel）
- 1 个 Redis Master
- 2 个 Redis Slaves
- 3 个 Redis Sentinels（仲裁）
- 自动故障转移
- 读写分离

## 开发环境设置

### 1. 使用 Docker Compose 启动 Redis

```bash
# 启动开发环境 Redis
docker-compose -f docker-compose.redis.yml --profile dev up -d

# 查看日志
docker-compose -f docker-compose.redis.yml logs -f redis-master

# 查看所有服务状态
docker-compose -f docker-compose.redis.yml ps
```

### 2. 验证 Redis 连接

```bash
# 通过 redis-cli 连接
docker exec -it funnypixels-redis-master redis-cli -a funnypixels_redis_dev ping

# 输出应该是: PONG
```

### 3. 访问 Redis Commander（可选）

访问 http://localhost:8081

用户名：无（直接访问）
密码：无需密码

### 4. 配置后端环境变量

在 `backend/.env` 中设置：

```bash
# Redis 配置（开发环境）
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=funnypixels_redis_dev
REDIS_DB=0
REDIS_SENTINEL_ENABLED=false
```

## 生产环境设置

### 1. 使用 Docker Compose 启动集群

```bash
# 启动生产环境 Redis 集群
docker-compose -f docker-compose.redis.yml --profile prod up -d

# 查看集群状态
docker-compose -f docker-compose.redis.yml ps
```

### 2. 验证主从复制

```bash
# 连接到 Master
docker exec -it funnypixels-redis-master redis-cli -a YOUR_PASSWORD ping

# 连接到 Slave 1
docker exec -it funnypixels-redis-slave-1 redis-cli -a YOUR_PASSWORD ping

# 检查复制状态
docker exec -it funnypixels-redis-slave-1 redis-cli -a YOUR_PASSWORD info replication
```

### 3. 验证 Sentinel 配置

```bash
# 连接到 Sentinel 1
docker exec -it funnypixels-redis-sentinel-1 redis-cli -p 26379 ping

# 查看 Sentinel 监控的 Master
docker exec -it funnypixels-redis-sentinel-1 redis-cli -p 26379 sentinel masters
```

### 4. 配置后端环境变量

在生产环境（如 Render、Railway）的 `.env` 中设置：

```bash
# Redis 配置（生产环境 - Sentinel 模式）
REDIS_SENTINEL_ENABLED=true
REDIS_SENTINEL_HOSTS=sentinel-1.example.com:26379,sentinel-2.example.com:26379,sentinel-3.example.com:26379
REDIS_SENTINEL_MASTER_NAME=mymaster
REDIS_PASSWORD=YOUR_SECURE_PASSWORD

# 或者使用单实例模式（如果没有 Sentinel）
# REDIS_HOST=redis.example.com
# REDIS_PORT=6379
# REDIS_PASSWORD=YOUR_SECURE_PASSWORD
# REDIS_SENTINEL_ENABLED=false
```

## 环境变量配置

### 完整环境变量列表

| 变量名 | 开发环境默认值 | 生产环境 | 说明 |
|--------|---------------|----------|------|
| `REDIS_HOST` | `localhost` | Redis Master 地址 | 单实例模式使用 |
| `REDIS_PORT` | `6379` | `6379` | Redis 端口 |
| `REDIS_PASSWORD` | `funnypixels_redis_dev` | 强密码 | Redis 认证密码 |
| `REDIS_DB` | `0` | `0` | Redis 数据库编号 |
| `REDIS_SENTINEL_ENABLED` | `false` | `true` | 是否启用 Sentinel |
| `REDIS_SENTINEL_HOSTS` | - | `host1:26379,host2:26379,host3:26379` | Sentinel 地址列表 |
| `REDIS_SENTINEL_MASTER_NAME` | `mymaster` | `mymaster` | Master 名称 |

## 监控和健康检查

### 1. 基础健康检查端点

```bash
# 综合健康检查
curl http://localhost:3001/api/health

# Redis 详细状态
curl http://localhost:3001/api/health/redis
```

### 2. 健康检查响应示例

```json
{
  "connected": true,
  "subscriberConnected": true,
  "host": "localhost",
  "port": "6379",
  "mode": "standalone",
  "info": {
    "version": "7.0.0",
    "uptime": "12345",
    "connectedClients": "10",
    "usedMemory": "256M",
    "totalMemory": "512M",
    "opsPerSecond": "1500"
  },
  "error": null
}
```

### 3. Prometheus 监控

```bash
# 访问 Prometheus 指标
curl http://localhost:3001/metrics
```

### 4. 关键监控指标

- **连接状态**: `redis_connected_clients`
- **内存使用**: `redis_memory_used_bytes`
- **操作频率**: `redis_instantaneous_ops_per_sec`
- **命中率**: `redis_keyspace_hits` / `redis_keyspace_misses`
- **Pub/Sub 消息**: `redis_pubsub_channels`

## 性能优化

### 1. 内存优化

```bash
# 在 redis.conf 中设置
maxmemory 512mb
maxmemory-policy allkeys-lru
```

### 2. 持久化策略

**开发环境（AOF）：**
```bash
appendonly yes
appendfsync everysec
```

**生产环境（RDB + AOF）：**
```bash
appendonly yes
appendfsync everysec
save 900 1
save 300 10
save 60 10000
```

### 3. 网络优化

```bash
# 启用 TCP 快速打开
tcp-backlog 511

# 禁用 Nagle 算法
tcp-nodelay yes
```

### 4. 客户端连接池

```javascript
// 在 redis.js 中配置
const redisConfig = {
  socket: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    connectTimeout: 10000,
    reconnectStrategy: (retries) => {
      if (retries > 10) return new Error('重连次数超过限制');
      return Math.min(retries * 100, 3000);
    }
  },
  maxRetriesPerRequest: 3
};
```

## 故障排查

### 1. 连接失败

**症状**: `ECONNREFUSED` 或 `Connection timeout`

**解决方案**:
```bash
# 检查 Redis 是否运行
docker ps | grep redis

# 检查 Redis 日志
docker logs funnypixels-redis-master

# 测试连接
docker exec -it funnypixels-redis-master redis-cli -a YOUR_PASSWORD ping
```

### 2. 内存不足

**症状**: `OOM command not allowed when used memory > 'maxmemory'`

**解决方案**:
```bash
# 检查内存使用
docker exec -it funnypixels-redis-master redis-cli -a YOUR_PASSWORD info memory

# 调整 maxmemory 策略
docker exec -it funnypixels-redis-master redis-cli -a YOUR_PASSWORD CONFIG SET maxmemory-policy allkeys-lru
```

### 3. 主从同步问题

**症状**: Slave 无法连接到 Master

**解决方案**:
```bash
# 检查 Slave 状态
docker exec -it funnypixels-redis-slave-1 redis-cli -a YOUR_PASSWORD info replication

# 检查 Master 连接
docker exec -it funnypixels-redis-slave-1 redis-cli -a YOUR_PASSWORD -h redis-master ping
```

### 4. Sentinel 故障转移

**症状**: Sentinel 无法检测 Master 故障

**解决方案**:
```bash
# 检查 Sentinel 状态
docker exec -it funnypixels-redis-sentinel-1 redis-cli -p 26379 sentinel masters

# 手动触发故障转移（仅用于测试）
docker exec -it funnypixels-redis-sentinel-1 redis-cli -p 26379 SENTINEL failover mymaster
```

### 5. Pub/Sub 消息丢失

**症状**: WebSocket 更新未推送

**解决方案**:
```bash
# 检查订阅状态
docker exec -it funnypixels-redis-master redis-cli -a YOUR_PASSWORD PUBSUB CHANNELS

# 检查订阅者数量
docker exec -it funnypixels-redis-master redis-cli -a YOUR_PASSWORD PUBSUB NUMSUB tile-updates
```

## 生产环境最佳实践

### 1. 安全性

- 使用强密码（至少 32 字符，包含大小写字母、数字、特殊符号）
- 禁用 `CONFIG` 命令（`rename-command CONFIG ""`）
- 使用防火墙限制 Redis 端口访问
- 启用 TLS（生产环境）

### 2. 高可用性

- 至少 3 个 Sentinel 实例
- 部署在不同可用区
- 使用健康检查自动重启
- 配置自动故障转移

### 3. 备份策略

```bash
# 手动触发 RDB 快照
docker exec -it funnypixels-redis-master redis-cli -a YOUR_PASSWORD BGSAVE

# 备份 AOF 文件
docker cp funnypixels-redis-master:/data/appendonly.aof ./backup/
```

### 4. 容量规划

| 场景 | 预期 QPS | 内存需求 | 推荐配置 |
|------|----------|----------|----------|
| 开发环境 | < 1,000 | 512MB | 单实例 |
| 小规模生产 | 1,000-10,000 | 1-2GB | 主从 + Sentinel |
| 大规模生产 | 10,000-50,000 | 4-8GB | 主从 + Sentinel + 分片 |

## 常见问题

### Q: 如何在不停止服务的情况下备份 Redis？

```bash
# 使用 BGSAVE 创建后台快照
docker exec -it funnypixels-redis-master redis-cli -a YOUR_PASSWORD BGSAVE

# 等待快照完成
docker exec -it funnypixels-redis-master redis-cli -a YOUR_PASSWORD LASTSAVE
```

### Q: 如何监控 Redis 性能？

```bash
# 使用 INFO 命令
docker exec -it funnypixels-redis-master redis-cli -a YOUR_PASSWORD INFO

# 使用 --latency 监控延迟
docker exec -it funnypixels-redis-master redis-cli -a YOUR_PASSWORD --latency
```

### Q: 如何清空所有缓存？

```bash
# 警告：此操作不可逆
docker exec -it funnypixels-redis-master redis-cli -a YOUR_PASSWORD FLUSHALL
```

## 参考资源

- [Redis 官方文档](https://redis.io/documentation)
- [Redis Sentinel 高可用](https://redis.io/topics/sentinel)
- [Node Redis 客户端](https://github.com/NodeRedis/node-redis)
- [BullMQ 文档](https://docs.bullmq.io/)
