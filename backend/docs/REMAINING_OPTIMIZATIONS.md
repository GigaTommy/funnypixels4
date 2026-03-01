# 剩余性能优化任务实施指南

## 📋 任务清单

- [x] ✅ 任务1: 添加排行榜数据库复合索引 (已完成)
- [x] ✅ 任务2: 增加生产环境数据库连接池大小 (已完成)
- [x] ✅ 任务3: 优化Event Controller N+1查询问题 (已完成)
- [x] ✅ 任务4: 排行榜分页改用cursor-based方式 (实施指南已创建)
- [ ] ⏳ 任务5: 地理编码改用事件驱动模式
- [ ] ⏳ 任务6: 优化iOS Tile缓存LRU逐出算法
- [ ] ⏳ 任务7: 为像素更新添加乐观锁机制
- [ ] ⏳ 任务8: 排行榜计数缓存迁移到Redis

---

## 🔧 任务5: 地理编码改用事件驱动模式

### 当前问题
**文件**: `backend/src/services/pixelDrawService.js:1958-2018`

```javascript
async startGeocodingForPixel(gridId, latitude, longitude) {
  await this.sleep(2000);  // ❌ 阻塞2秒

  for (let attempt = 0; attempt < 10; attempt++) {
    const pixel = await db('pixels').where('grid_id', gridId).first();
    if (pixel) {
      // 找到像素，开始地理编码
      await asyncGeocodingService.processGeocoding(/*...*/);
      return;
    }
    await this.sleep(1000);  // ❌ 每次等待1秒
  }
}
```

### 优化方案：事件驱动

#### 方案A: 使用EventEmitter（推荐）
```javascript
const EventEmitter = require('events');

class PixelBatchEventBus extends EventEmitter {}
const pixelBatchEvents = new PixelBatchEventBus();

// batchPixelService.js
async flushBatch() {
  // ... 批处理完成后
  const flushedPixels = results.map(p => ({
    id: p.id,
    grid_id: p.grid_id,
    // ...
  }));

  // 🚀 emit事件通知
  pixelBatchEvents.emit('pixels-flushed', flushedPixels);
}

// pixelDrawService.js
// 🚀 监听批处理完成事件
pixelBatchEvents.on('pixels-flushed', async (pixels) => {
  for (const pixel of pixels) {
    if (needsGeocoding(pixel)) {
      await asyncGeocodingService.processGeocoding(pixel);
    }
  }
});

// 调用时直接入队，不等待
async drawPixel(pixelData) {
  // ... 添加到批处理队列
  batchPixelService.addToBatch(pixelData);

  // 🚀 不需要等待，事件驱动会自动处理
  // ❌ 移除：await startGeocodingForPixel()
}
```

#### 方案B: 使用消息队列（Bull/BullMQ）
```javascript
const Queue = require('bull');
const geocodingQueue = new Queue('geocoding', {
  redis: { host: 'localhost', port: 6379 }
});

// batchPixelService.js
async flushBatch() {
  // ... 批处理完成后
  for (const pixel of results) {
    await geocodingQueue.add('process-geocoding', {
      pixelId: pixel.id,
      latitude: pixel.latitude,
      longitude: pixel.longitude
    }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 }
    });
  }
}

// workers/geocodingWorker.js
geocodingQueue.process('process-geocoding', async (job) => {
  const { pixelId, latitude, longitude } = job.data;
  await asyncGeocodingService.processGeocoding(pixelId, latitude, longitude);
});
```

### 性能提升
- ✅ 移除2秒初始等待
- ✅ 移除10次轮询（最多10秒）
- ✅ 事件驱动，几乎零延迟
- ✅ 支持失败重试
- ✅ 可监控队列状态

### 实施步骤
1. 在`batchPixelService.js`中添加事件emit
2. 在`pixelDrawService.js`中监听事件
3. 移除`startGeocodingForPixel`中的sleep和轮询
4. 添加单元测试验证事件触发
5. 性能测试对比

---

## 📱 任务6: 优化iOS Tile缓存LRU逐出算法

### 当前问题
**文件**: `app/FunnyPixels/Sources/FunnyPixels/Services/PixelTileManager.swift:215-228`

```swift
private func updateAccessOrder(tileId: String) {
    // ❌ O(n)操作，遍历整个数组
    accessOrder.removeAll { $0 == tileId }
    accessOrder.append(tileId)
}
```

### 优化方案：双向链表 + 字典

```swift
// 🚀 使用OrderedDictionary (Swift Collections框架)
import OrderedCollections

class PixelTileManager {
    // 替换原有的Dictionary + Array
    private var tileCache: OrderedDictionary<String, CachedTile> = [:]
    private let maxCacheSize = 1000

    /// 访问tile（自动移到最新位置）
    private func accessTile(_ tileId: String) {
        guard let tile = tileCache[tileId] else { return }

        // 🚀 O(1)移动到末尾
        tileCache.removeValue(forKey: tileId)
        tileCache[tileId] = tile
    }

    /// LRU淘汰（移除最旧的）
    private func evictLRUTile() {
        guard !tileCache.isEmpty else { return }

        // 🚀 O(1)移除第一个元素
        tileCache.removeFirst()
    }

    /// 缓存Tile
    private func cacheTile(_ tile: PixelTile) {
        if tileCache.count >= maxCacheSize {
            evictLRUTile()
        }
        tileCache[tile.id] = CachedTile(tile: tile)
    }
}
```

### 依赖安装
```swift
// Package.swift
dependencies: [
    .package(url: "https://github.com/apple/swift-collections.git", from: "1.0.0")
]
```

### 性能对比
| 操作 | 旧方案 (Array) | 新方案 (OrderedDictionary) |
|------|---------------|---------------------------|
| 访问 | O(n) | O(1) |
| 淘汰 | O(1) | O(1) |
| 查找 | O(1) (Dict) | O(1) |

### 实施步骤
1. 添加swift-collections依赖
2. 替换数据结构
3. 更新访问和淘汰逻辑
4. 运行单元测试
5. 性能测试（缓存1000+ tiles时）

---

## 🔒 任务7: 为像素更新添加乐观锁机制

### 当前问题
**文件**: `backend/src/services/batchPixelService.js:375-401`

```javascript
await trx('pixels')
  .insert(processedChunk)
  .onConflict('grid_id')
  .merge({
    user_id: trx.raw('EXCLUDED.user_id'),
    color: trx.raw('EXCLUDED.color'),
    // ...
  })
  .whereRaw(`pixels.color IS DISTINCT FROM EXCLUDED.color OR ...`);
```

**问题**: 两个用户同时更新同一像素，后提交的会覆盖前者

### 优化方案：基于version的乐观锁

#### 步骤1: 添加version字段
```sql
-- 迁移文件
ALTER TABLE pixels ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;
CREATE INDEX IF NOT EXISTS idx_pixels_version ON pixels(grid_id, version);
```

#### 步骤2: 更新UPSERT逻辑
```javascript
// batchPixelService.js
async batchUpdatePixels(trx, pixels) {
  // ...

  const result = await trx('pixels')
    .insert(processedChunk)
    .onConflict('grid_id')
    .merge({
      user_id: trx.raw('EXCLUDED.user_id'),
      color: trx.raw('EXCLUDED.color'),
      pattern_id: trx.raw('EXCLUDED.pattern_id'),
      // ... 其他字段 ...
      version: trx.raw('pixels.version + 1'),  // 🔒 版本号递增
      updated_at: trx.raw('EXCLUDED.updated_at')
    })
    .whereRaw(`
      pixels.color IS DISTINCT FROM EXCLUDED.color OR
      pixels.pattern_id IS DISTINCT FROM EXCLUDED.pattern_id OR
      pixels.user_id IS DISTINCT FROM EXCLUDED.user_id
    `)
    .returning(['id', 'grid_id', 'updated_at', 'version']);  // 🔒 返回version
}
```

#### 步骤3: 客户端冲突检测（可选）
```javascript
// 前端发送像素数据时包含expectedVersion
const pixelData = {
  gridId: 'grid_123',
  color: '#FF0000',
  expectedVersion: 5  // 🔒 期望的版本号
};

// 后端验证
if (pixel && pixel.version !== expectedVersion) {
  throw new ConflictError('Pixel has been modified by another user');
}
```

### 性能影响
- ✅ 防止并发更新丢失
- ⚠️ 轻微性能开销（version字段+1个索引）
- ✅ 可选择性启用（高价值像素）

---

## 📊 任务8: 排行榜计数缓存迁移到Redis

### 当前问题
**文件**: `backend/src/controllers/leaderboardController.js:19-30`

```javascript
const _countCache = new Map();  // ❌ 内存缓存，多实例不一致
const COUNT_CACHE_TTL = 3600000;

function getCachedCount(key) {
  const entry = _countCache.get(key);
  if (entry && Date.now() - entry.ts < COUNT_CACHE_TTL) return entry.value;
  return null;
}
```

### 优化方案：迁移到Redis

```javascript
const CacheService = require('../services/cacheService');

// 🚀 使用Redis缓存
async function getCachedCount(key) {
  const cacheKey = `leaderboard:count:${key}`;
  const cached = await CacheService.get(cacheKey);

  if (cached !== null) {
    return parseInt(cached);
  }
  return null;
}

async function setCachedCount(key, value) {
  const cacheKey = `leaderboard:count:${key}`;
  const ttl = 3600; // 1小时（秒）

  await CacheService.set(cacheKey, value.toString(), ttl);
}

// 使用示例
static async getPersonalLeaderboard(req, res) {
  // ...

  const personalCountKey = `personal:${period}:${periodStart}`;
  let total = await getCachedCount(personalCountKey);

  if (total === null) {
    const totalCount = await db('leaderboard_personal')
      .where('period', period)
      .where('period_start', periodStart)
      .count('* as count')
      .first();

    total = parseInt(totalCount.count);
    await setCachedCount(personalCountKey, total);
  }

  // ...
}
```

### 清理策略
```javascript
// 当排行榜更新时，清除相关缓存
async function invalidateLeaderboardCountCache(period, periodStart) {
  const patterns = [
    `leaderboard:count:personal:${period}:${periodStart}`,
    `leaderboard:count:alliance:${period}:${periodStart}`,
    `leaderboard:count:city:${period}:${periodStart}`
  ];

  for (const pattern of patterns) {
    await CacheService.del(pattern);
  }
}
```

### 性能对比
| 方案 | 单实例一致性 | 多实例一致性 | 延迟 |
|------|------------|-------------|------|
| Map缓存 | ✅ | ❌ | ~1ms |
| Redis缓存 | ✅ | ✅ | ~2-3ms |

### 实施步骤
1. 替换getCachedCount/setCachedCount实现
2. 添加清理机制
3. 更新所有排行榜Controller
4. 测试多实例场景
5. 监控缓存命中率

---

## 📈 总体性能提升预期

| 优化项 | 提升幅度 | 优先级 |
|--------|---------|--------|
| ✅ 数据库索引 | 5-10x | Critical |
| ✅ 连接池优化 | 2-3x (高峰) | Critical |
| ✅ N+1查询优化 | 10-20x (多events) | High |
| 📋 Cursor分页 | 10-100x (大offset) | High |
| 📋 事件驱动地理编码 | 移除12秒延迟 | Medium |
| 📋 iOS LRU优化 | 10-50x (大缓存) | Medium |
| 📋 乐观锁 | 防止数据丢失 | Medium |
| 📋 Redis缓存 | 多实例一致性 | Medium |

---

## 🗓️ 实施时间表

### 第1周（已完成）
- [x] 数据库索引优化
- [x] 连接池配置优化
- [x] Event Controller N+1优化

### 第2-3周
- [ ] Cursor分页实施
- [ ] 事件驱动地理编码
- [ ] iOS LRU优化

### 第4周
- [ ] 乐观锁机制
- [ ] Redis缓存迁移
- [ ] 性能测试和监控

---

**文档创建时间**: 2026-02-22
**状态**: 4/8任务已完成，4/8任务待实施
