# Cursor-Based 分页实现指南

## 📋 任务概述

将排行榜的OFFSET分页改为cursor-based分页，解决大偏移量时的性能问题。

## 🎯 优化目标

### 当前问题
```sql
-- OFFSET 10000时，数据库需要跳过10000行，效率低下
SELECT * FROM leaderboard_personal
WHERE period = 'daily' AND period_start = '2026-02-22'
ORDER BY rank ASC
LIMIT 50 OFFSET 10000;  -- ❌ 慢查询
```

### 优化方案
```sql
-- 使用WHERE rank > lastRank，利用索引直接定位
SELECT * FROM leaderboard_personal
WHERE period = 'daily' AND period_start = '2026-02-22'
  AND rank > 10000  -- ✅ 索引查询
ORDER BY rank ASC
LIMIT 50;
```

## 🔧 实现步骤

### 1. API 参数设计

#### 新增查询参数
- `cursor` (string, optional): Base64编码的游标，包含分页状态
- `lastRank` (number, optional, deprecated): 兼容旧版本
- 保留 `offset` 参数但标记为 deprecated

#### Cursor 格式
```json
{
  "rank": 100,
  "id": "12345",  // 作为次要排序字段，处理rank相同的情况
  "period": "daily",
  "periodStart": "2026-02-22T00:00:00.000Z"
}
```

Base64编码示例：
```javascript
const cursor = Buffer.from(JSON.stringify({
  rank: 100,
  id: "12345",
  period: "daily",
  periodStart: "2026-02-22T00:00:00.000Z"
})).toString('base64');
```

### 2. Controller 修改

#### 文件: `backend/src/controllers/leaderboardController.js`

```javascript
// 获取个人排行榜 - 支持cursor分页
static async getPersonalLeaderboard(req, res) {
  const startTime = Date.now();

  try {
    let { period = 'daily', limit = 50, offset, cursor } = req.query;
    const currentUserId = req.user ? req.user.id : null;

    // 🚀 优先使用cursor分页
    let useCursor = false;
    let cursorData = null;

    if (cursor) {
      try {
        cursorData = JSON.parse(Buffer.from(cursor, 'base64').toString('utf8'));
        useCursor = true;
      } catch (error) {
        console.warn('Invalid cursor format:', error.message);
        // 降级到offset分页
      }
    }

    // 验证cursor数据
    if (useCursor && cursorData) {
      // 确保period匹配
      if (cursorData.period !== period) {
        return res.status(400).json({
          success: false,
          message: 'Cursor period mismatch'
        });
      }
    }

    // 将 allTime 映射到 yearly
    if (period === 'allTime') {
      period = 'yearly';
    }

    // 计算时间范围
    const { periodStart, periodEnd } = LeaderboardController.getPeriodRange(period);

    // 构建查询
    let query = db('leaderboard_personal')
      .leftJoin('privacy_settings', 'leaderboard_personal.user_id', 'privacy_settings.user_id')
      .leftJoin('alliance_members', function () {
        this.on('leaderboard_personal.user_id', '=', 'alliance_members.user_id')
          .andOn('alliance_members.status', '=', db.raw('?', ['active']));
      })
      .leftJoin('alliances', 'alliance_members.alliance_id', 'alliances.id')
      .select(/* ... 同现有查询 ... */)
      .where('leaderboard_personal.period', period)
      .where('leaderboard_personal.period_start', periodStart)
      .orderBy('leaderboard_personal.rank', 'asc')
      .limit(parseInt(limit));

    // 🚀 cursor分页条件
    if (useCursor && cursorData) {
      query = query
        .andWhere(function() {
          this.where('leaderboard_personal.rank', '>', cursorData.rank)
            .orWhere(function() {
              this.where('leaderboard_personal.rank', '=', cursorData.rank)
                .andWhere('leaderboard_personal.id', '>', cursorData.id);
            });
        });
    }
    // 降级：使用offset分页
    else if (offset) {
      query = query.offset(parseInt(offset));
    }

    const results = await query;

    // ... 后续处理逻辑 ...

    // 🆕 生成下一页cursor
    let nextCursor = null;
    if (results.length === parseInt(limit)) {
      const lastItem = results[results.length - 1];
      const cursorObj = {
        rank: lastItem.rank,
        id: lastItem.id,
        period,
        periodStart
      };
      nextCursor = Buffer.from(JSON.stringify(cursorObj)).toString('base64');
    }

    const leaderboard = {
      period,
      data: mappedResults,
      myRank,
      pagination: {
        limit: parseInt(limit),
        hasMore: results.length === parseInt(limit),
        nextCursor,  // 🆕 新增cursor
        // 兼容旧版本
        offset: offset ? parseInt(offset) : undefined,
        total: useCursor ? undefined : total  // cursor模式不返回total
      }
    };

    res.json({
      success: true,
      data: leaderboard,
      _meta: {
        paginationType: useCursor ? 'cursor' : 'offset'
      }
    });

  } catch (error) {
    // ... 错误处理 ...
  }
}
```

### 3. 前端适配

#### iOS Swift 示例
```swift
struct LeaderboardPagination {
    var limit: Int
    var hasMore: Bool
    var nextCursor: String?  // 新增
    var offset: Int?         // 兼容旧版
    var total: Int?
}

// 使用示例
func fetchNextPage() {
    var params: [String: String] = ["limit": "50"]

    if let cursor = currentPagination.nextCursor {
        // 优先使用cursor
        params["cursor"] = cursor
    } else if let offset = currentPagination.offset {
        // 降级到offset
        params["offset"] = String(offset + 50)
    }

    apiManager.fetchLeaderboard(params: params) { result in
        // ...
    }
}
```

#### React/TypeScript 示例
```typescript
interface LeaderboardPagination {
  limit: number;
  hasMore: boolean;
  nextCursor?: string;  // 新增
  offset?: number;      // deprecated
  total?: number;
}

async function loadMore(nextCursor?: string) {
  const params = new URLSearchParams({
    period: 'daily',
    limit: '50',
  });

  if (nextCursor) {
    params.set('cursor', nextCursor);
  }

  const response = await fetch(`/api/leaderboard/personal?${params}`);
  const data = await response.json();

  // 检查是否还有更多数据
  if (data.pagination.hasMore) {
    // 保存nextCursor用于下次加载
    setNextCursor(data.pagination.nextCursor);
  }
}
```

### 4. 单元测试

#### 文件: `backend/src/__tests__/leaderboard.cursor.test.js`

```javascript
const request = require('supertest');
const app = require('../server');

describe('Leaderboard Cursor Pagination', () => {
  it('should return nextCursor when has more data', async () => {
    const res = await request(app)
      .get('/api/leaderboard/personal')
      .query({ period: 'daily', limit: 10 });

    expect(res.status).toBe(200);
    expect(res.body.data.pagination.nextCursor).toBeDefined();
    expect(res.body.data.pagination.hasMore).toBe(true);
  });

  it('should fetch next page using cursor', async () => {
    // 第一页
    const page1 = await request(app)
      .get('/api/leaderboard/personal')
      .query({ period: 'daily', limit: 10 });

    const nextCursor = page1.body.data.pagination.nextCursor;

    // 第二页
    const page2 = await request(app)
      .get('/api/leaderboard/personal')
      .query({ period: 'daily', limit: 10, cursor: nextCursor });

    expect(page2.status).toBe(200);
    expect(page2.body.data.data[0].rank).toBeGreaterThan(
      page1.body.data.data[page1.body.data.data.length - 1].rank
    );
  });

  it('should handle invalid cursor gracefully', async () => {
    const res = await request(app)
      .get('/api/leaderboard/personal')
      .query({ period: 'daily', cursor: 'invalid-cursor' });

    // 应该降级到offset分页
    expect(res.status).toBe(200);
  });

  it('should reject cursor with period mismatch', async () => {
    const invalidCursor = Buffer.from(JSON.stringify({
      rank: 10,
      id: '123',
      period: 'weekly',  // 不匹配
      periodStart: '2026-02-22'
    })).toString('base64');

    const res = await request(app)
      .get('/api/leaderboard/personal')
      .query({ period: 'daily', cursor: invalidCursor });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('mismatch');
  });
});
```

### 5. 性能对比测试

#### 测试脚本
```bash
# 测试OFFSET分页 (旧方案)
ab -n 100 -c 10 "http://localhost:3000/api/leaderboard/personal?period=daily&limit=50&offset=10000"

# 测试CURSOR分页 (新方案)
ab -n 100 -c 10 "http://localhost:3000/api/leaderboard/personal?period=daily&limit=50&cursor=<cursor_value>"
```

#### 预期结果
| 方案 | OFFSET=0 | OFFSET=1000 | OFFSET=10000 |
|------|----------|-------------|--------------|
| OFFSET分页 | ~50ms | ~150ms | ~500ms |
| CURSOR分页 | ~50ms | ~50ms | ~50ms |

## 📝 迁移策略

### 阶段1: 双模式支持 (Week 1-2)
- ✅ 后端同时支持cursor和offset
- ✅ 优先使用cursor，降级到offset
- ✅ 前端保持使用offset

### 阶段2: 前端迁移 (Week 3-4)
- 🔄 iOS App更新使用cursor
- 🔄 Web Frontend更新使用cursor
- 🔄 监控错误率和性能

### 阶段3: 弃用offset (Week 5+)
- ⚠️ 添加deprecation警告日志
- ⚠️ 文档标记offset为deprecated
- 🚫 3个月后移除offset支持

## ⚠️ 注意事项

### 1. Cursor失效场景
- 数据被删除（rank变化）
- period切换（必须验证period匹配）
- 排行榜重新计算（periodStart变化）

### 2. 边界情况
- 最后一页：nextCursor为null，hasMore为false
- 空结果：返回空数组，nextCursor为null
- rank相同：使用id作为次要排序字段

### 3. 兼容性
- 保留offset参数3个月
- 移动端强制更新前必须支持双模式
- API版本号：v1支持双模式，v2仅支持cursor

## 🔗 相关资源

- [Cursor Pagination Best Practices](https://slack.engineering/evolving-api-pagination-at-slack/)
- [PostgreSQL Index-Only Scans](https://www.postgresql.org/docs/current/indexes-index-only-scans.html)
- [GraphQL Cursor Connections Specification](https://relay.dev/graphql/connections.htm)

---

**实施时间**: 预计2-3周
**优先级**: High
**影响范围**: 所有排行榜API (personal, alliance, city)
