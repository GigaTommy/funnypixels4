# Redis Infrastructure - Redis 基础设施层

FunnyPixels 项目的 Redis 客户端隔离架构，提供**工程级、可扩展、可治理**的 Redis 访问方案。

---

## 📋 目录

- [架构概述](#架构概述)
- [域（Domain）划分](#域domain划分)
- [快速开始](#快速开始)
- [使用示例](#使用示例)
- [迁移指南](#迁移指南)
- [配置说明](#配置说明)
- [故障处理](#故障处理)
- [监控与指标](#监控与指标)
- [最佳实践](#最佳实践)

---

## 架构概述

### 设计目标

1. **客户端隔离**：不同工作负载使用专用客户端，互不影响
2. **故障隔离**：队列阻塞不影响缓存，Pub/Sub 失败不影响主业务
3. **可扩展性**：支持单机、Sentinel、未来可平滑迁移到 Cluster
4. **可观测性**：每个域独立监控，统一聚合
5. **工程化**：统一入口、类型安全、易测试

### 架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                         业务层                                   │
│  (PixelService, TileService, LeaderboardService, ...)            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    RedisManager (统一入口)                       │
│  - 客户端注册表                                                  │
│  - 生命周期管理                                                  │
│  - 健康检查聚合                                                  │
└───┬──────────┬──────────┬──────────┬──────────┬────────────────┘
    │          │          │          │          │
    ▼          ▼          ▼          ▼          ▼
┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐
│ Cache  │ │ Queue  │ │Pub/Sub │ │RateLimit│ │Session │
│        │ │        │ │        │ │        │ │        │
│Node v4 │ │ioredis │ │Node v4 │ │Node v4 │ │Node v4 │
└────────┘ └────────┘ └────────┘ └────────┘ └────────┘
    │          │          │          │          │
    └──────────┴──────────┴──────────┴──────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Redis 服务器                                  │
│  Standalone / Sentinel / Cluster                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 域（Domain）划分

| 域 | 用途 | 客户端 | Key 前缀 | 故障策略 | QPS 预估 |
|----|------|--------|----------|----------|----------|
| **CACHE** | 像素、瓦片、排行榜、Pattern | Node Redis v4 | `cache:` | Degrade | 5k-20k |
| **QUEUE** | BullMQ 瓦片渲染队列 | ioredis | `queue:` | Fail-Closed | 100-500 |
| **PUBSUB** | WebSocket 实时推送 | Node Redis v4 | `pubsub:` | Fail-Open | 50-200 msg/s |
| **RATELIMIT** | API 限流、像素限流 | Node Redis v4 | `ratelimit:` | Fail-Open | 1k-5k |
| **META** | 统计、全局计数 | Node Redis v4 | `meta:` | Fail-Open | <100 |
| **SESSION** | 用户会话、心跳 | Node Redis v4 | `session:` | Degrade | 500-1k |

### 域特性对比

```typescript
// Cache 域 - 高并发、短 TTL、可降级
const cache = RedisManager.getCache();
await cache.set('pixel:123', '{"color":"red"}', 3600);

// Queue 域 - 高可靠、阻塞风险
const queue = RedisManager.getQueue();
const connection = queue.getBullMQConnection(); // 用于 BullMQ

// PubSub 域 - 长连接、订阅模式
const pubsub = RedisManager.getPubSub();
await pubsub.subscribe('tile-updates', (message) => {
  console.log('收到更新:', message);
});

// RateLimit 域 - 滑动窗口、fail-open
const ratelimit = RedisManager.getRateLimit();
const result = await ratelimit.checkSlidingWindow('user:123', 10, 60);
if (!result.allowed) {
  throw new Error('请求过于频繁');
}

// Session 域 - 中频、可降级到内存
const session = RedisManager.getSession();
await session.setSession('sess:123', { userId: '123', lastActivity: Date.now() });

// Meta 域 - 低频、持久化
const meta = RedisManager.getMeta();
await meta.incrGlobal('pixelCount');
```

---

## 快速开始

### 1. 初始化（应用启动时）

```typescript
// src/server.js 或 src/app.ts
import RedisManager from './infra/redis/RedisManager';

async function startServer() {
  // 初始化所有 Redis 客户端
  await RedisManager.initialize();

  // ... 其他初始化代码

  // 启动服务器
  server.listen(PORT, () => {
    console.log('Server started');
  });
}

// 优雅关闭
process.on('SIGTERM', async () => {
  await RedisManager.close();
  process.exit(0);
});
```

### 2. 环境变量配置

```bash
# .env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_password
REDIS_DB=0

# Sentinel 配置（生产环境）
REDIS_SENTINEL_ENABLED=true
REDIS_SENTINEL_HOSTS=sentinel1:26379,sentinel2:26379,sentinel3:26379
REDIS_SENTINEL_MASTER_NAME=mymaster
```

---

## 使用示例

### Cache 域 - 缓存操作

```typescript
import RedisManager from '../infra/redis/RedisManager';

class PixelService {
  private cache = RedisManager.getCache();

  async getPixel(id: string) {
    // 先查缓存
    const cached = await this.cache.get(`pixel:${id}`);
    if (cached) {
      return JSON.parse(cached);
    }

    // 缓存未命中，查数据库
    const pixel = await db.query('SELECT * FROM pixels WHERE id = ?', [id]);

    // 写入缓存
    await this.cache.set(`pixel:${id}`, JSON.stringify(pixel), 3600);

    return pixel;
  }

  async invalidatePixel(id: string) {
    await this.cache.del(`pixel:${id}`);
  }
}
```

### Queue 域 - BullMQ 队列

```typescript
import { Queue } from 'bullmq';
import RedisManager from '../infra/redis/RedisManager';

// 初始化队列
const tileRenderQueue = new Queue('tile-render-queue', {
  connection: RedisManager.getQueue().getBullMQConnection(),
});

// 添加任务
await tileRenderQueue.add('render-tile', {
  tileId: '14/123/456',
  z: 14,
  x: 123,
  y: 456,
});
```

### PubSub 域 - WebSocket 推送

```typescript
import RedisManager from '../infra/redis/RedisManager';

class TileUpdateHandler {
  private pubsub = RedisManager.getPubSub();

  async initialize() {
    // 订阅瓦片更新
    await this.pubsub.subscribe('tile-updates', (message) => {
      // 广播给 WebSocket 客户端
      this.broadcastToClients(message);
    });
  }

  async publishUpdate(tileId: string, pixelData: any) {
    await this.pubsub.publish('tile-updates', JSON.stringify({
      tileId,
      pixel: pixelData,
      timestamp: Date.now(),
    }));
  }
}
```

### RateLimit 域 - 速率限制

```typescript
import RedisManager from '../infra/redis/RedisManager';

class RateLimitMiddleware {
  private ratelimit = RedisManager.getRateLimit();

  async checkLimit(userId: string) {
    const result = await this.ratelimit.checkSlidingWindow(
      `draw:${userId}`,
      10,      // 限制：10 次
      60       // 窗口：60 秒
    );

    if (!result.allowed) {
      throw new Error('绘制过于频繁，请稍后再试');
    }

    return result;
  }
}
```

### Session 域 - 会话管理

```typescript
import RedisManager from '../infra/redis/RedisManager';

class SessionService {
  private session = RedisManager.getSession();

  async createSession(userId: string) {
    const sessionId = `sess:${userId}`;
    await this.session.setSession(sessionId, {
      userId,
      username: 'test',
      lastActivity: Date.now(),
      pixelPoints: 64,
    }, 3600); // 1 小时

    return sessionId;
  }

  async updateHeartbeat(sessionId: string) {
    await this.session.heartbeat(sessionId);
  }

  async getSession(sessionId: string) {
    return await this.session.getSession(sessionId);
  }
}
```

### Meta 域 - 统计数据

```typescript
import RedisManager from '../infra/redis/RedisManager';

class StatsService {
  private meta = RedisManager.getMeta();

  async incrementPixelCount() {
    await this.meta.incrGlobal('pixelCount');
  }

  async recordEvent(event: string) {
    await this.meta.recordEvent(event);
  }

  async getStats() {
    return await this.meta.getStats(['pixelCount', 'userCount', 'drawCount']);
  }
}
```

---

## 迁移指南

### 从旧 redis.js 迁移

#### 旧代码

```typescript
// ❌ 旧代码
const { redis, redisUtils } = require('./config/redis');
await redis.set('key', 'value');
await redisUtils.hset('hash', 'field', 'value');
```

#### 新代码

```typescript
// ✅ 新代码
import RedisManager from './infra/redis/RedisManager';

// Cache 域
const cache = RedisManager.getCache();
await cache.set('key', 'value');
await cache.hset('hash', 'field', 'value');

// 或使用便捷方法
import { getCache } from './infra/redis/RedisManager';
const cache = getCache();
```

### 迁移步骤

1. **安装依赖**

```bash
npm install redis@^4.6.0
# ioredis 已经安装（BullMQ 依赖）
```

2. **更新 server.js**

```typescript
// src/server.js
import RedisManager from './infra/redis/RedisManager';

async function startServer() {
  // 替换旧的 initializeRedis
  await RedisManager.initialize();

  // ... 其他代码
}
```

3. **更新业务代码**

```typescript
// 逐个替换
// 旧: const { redis } = require('./config/redis');
// 新: import RedisManager from './infra/redis/RedisManager';
//     const cache = RedisManager.getCache();
```

4. **测试验证**

```bash
npm test
# 检查 Redis 连接
curl http://localhost:3001/api/health/redis
```

---

## 配置说明

### 域配置（可自定义）

```typescript
// src/infra/redis/config/base.config.ts

export const CACHE_DOMAIN_CONFIG: DomainConfig = {
  poolSize: 10,                  // 连接池大小
  keyPrefix: 'cache:',           // Key 前缀
  defaultTTL: 3600,              // 默认 TTL（秒）
  failureStrategy: 'degrade',    // 故障策略
  metricsEnabled: true,          // 是否启用指标
  healthCheckInterval: 30000,    // 健康检查间隔（ms）
};
```

### 故障策略说明

| 策略 | 说明 | 适用场景 |
|------|------|----------|
| `fail-open` | 失败时开放访问 | RateLimit、Meta、PubSub |
| `fail-closed` | 失败时拒绝请求 | Queue（重要任务） |
| `degrade` | 失败时降级策略 | Cache、Session |

---

## 故障处理

### 客户端重连

所有客户端内置指数退避重连策略：

```typescript
reconnectStrategy: (retries: number) => {
  if (retries > 10) {
    return new Error('重连次数超过限制');
  }
  // 100ms, 200ms, 400ms, ..., 最大 3s
  return Math.min(retries * 100, 3000);
}
```

### 故障隔离示例

```typescript
// Queue 故障不影响 Cache
const cache = RedisManager.getCache();
const queue = RedisManager.getQueue();

try {
  await queue.addJob('render-tile', { ... });
} catch (error) {
  // Queue 故障，但 Cache 仍可用
  logger.error('Queue 暂时不可用', error);
  // Cache 操作不受影响
  await cache.set('fallback', 'value');
}
```

---

## 监控与指标

### 健康检查

```typescript
// 获取所有客户端健康状态
const health = RedisManager.getHealthStatus();
console.log(health);
// {
//   cache: true,
//   queue: true,
//   pubsub: false,  // PubSub 可能断线
//   ratelimit: true,
//   meta: true,
//   session: true
// }
```

### 指标收集

```typescript
// 获取所有客户端指标
const metrics = RedisManager.getMetrics();
console.log(metrics);
// {
//   total_clients: 6,
//   connected_clients: 5,
//   cache_commands_total: 15234,
//   cache_errors_total: 3,
//   // ... 其他指标
// }
```

### API 端点

```bash
# 综合健康检查
GET /api/health

# Redis 详细状态
GET /api/health/redis
```

---

## 最佳实践

### 1. 使用正确的域

```typescript
// ✅ 正确
const cache = RedisManager.getCache();
await cache.set('pixel:123', 'value');

// ❌ 错误 - 不要用 Queue 客户端做缓存
const queue = RedisManager.getQueue();
// queue 没有方法，且 ioredis API 不同
```

### 2. 不要跳过 RedisManager

```typescript
// ✅ 正确
const cache = RedisManager.getCache();

// ❌ 错误 - 不要直接创建客户端
import { createClient } from 'redis';
const client = createClient({ ... });
```

### 3. 处理降级场景

```typescript
// Cache 域会自动降级，但建议显式处理
try {
  const cached = await cache.get(key);
  if (cached) return cached;
} catch (error) {
  // Cache 失败，直接查数据库
  logger.warn('Cache 降级到数据库');
}

const data = await db.query(...);
return data;
```

### 4. BullMQ 只使用 Queue 域

```typescript
// ✅ 正确
const queue = new Queue('tile-render-queue', {
  connection: RedisManager.getQueue().getBullMQConnection(),
});

// ❌ 错误 - 不要用 Cache 域初始化 BullMQ
const queue = new Queue('tile-render-queue', {
  connection: RedisManager.getCache().getRawClient(), // 类型不匹配
});
```

### 5. 键命名规范

```typescript
// 使用域前缀 + 有意义的名称
await cache.set('pixel:123:456', data);  // ✅
await cache.set('user:profile:123', data);  // ✅

// 不要跳过前缀
await cache.set('random-key', data);  // ⚠️ 可能与其他域冲突
```

---

## 未来扩展

### 支持 Redis Cluster

当数据量增长时，可以平滑迁移到 Redis Cluster：

```typescript
// 只需修改配置，业务代码无需改动
const config = {
  mode: RedisMode.CLUSTER,
  nodes: [
    { host: 'node1', port: 6379 },
    { host: 'node2', port: 6379 },
    { host: 'node3', port: 6379 },
  ],
};
```

### 添加新域

```typescript
// 1. 定义新域
export enum RedisDomain {
  // ... 现有域
  SEARCH = 'search',  // 新增：搜索域
}

// 2. 创建客户端
export class SearchRedisClient extends BaseRedisClient {
  // ... 实现
}

// 3. 注册到 RedisManager
private createClient(domain: RedisDomain) {
  switch (domain) {
    // ... 现有域
    case RedisDomain.SEARCH:
      return new SearchRedisClient();
  }
}

// 4. 添加便捷方法
static getSearch(): SearchRedisClient {
  return RedisManager.getInstance().getClient(RedisDomain.SEARCH);
}
```

---

## 故障排查

### 常见问题

**Q: Pub/Sub 连接断开**

```bash
# 检查订阅状态
curl http://localhost:3001/api/health/redis

# 查看日志
tail -f backend.log | grep PubSub
```

**Q: Queue 任务积压**

```typescript
// 获取队列指标
const queue = new Queue('tile-render-queue', {
  connection: RedisManager.getQueue().getBullMQConnection(),
});

const counts = await queue.getJobCounts();
console.log(counts);
// { waiting: 100, active: 2, completed: 500, failed: 10 }
```

**Q: Cache 降级频繁**

```bash
# 检查 Redis 内存
docker exec funnypixels_redis redis-cli INFO memory

# 检查命中率
docker exec funnypixels_redis redis-cli INFO stats
```

---

## 贡献指南

1. **新增方法**：在对应的 Client 中添加，更新类型定义
2. **新域**：按照上述"添加新域"步骤
3. **测试**：为每个新方法添加单元测试
4. **文档**：更新 README.md

---

## 许可证

MIT
