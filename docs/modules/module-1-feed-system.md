# Module 1: Feed系统 - 完整技术方案

> **模块名称**: Feed系统（社交动态流）
> **优先级**: P0（最高，社交核心功能）
> **工作量**: 2-3周（10-15个工作日）
> **依赖**: Module 0（Tab架构）、Module 2（关注系统）
> **状态**: 📝 设计中

---

## 目录

1. [产品需求细化](#1-产品需求细化)
2. [系统架构设计](#2-系统架构设计)
3. [数据库设计](#3-数据库设计)
4. [后端API设计](#4-后端api设计)
5. [Feed生成引擎](#5-feed生成引擎)
6. [Feed聚合查询](#6-feed聚合查询)
7. [前端UI设计](#7-前端ui设计)
8. [点赞系统](#8-点赞系统)
9. [缓存策略](#9-缓存策略)
10. [性能优化](#10-性能优化)
11. [冷启动方案](#11-冷启动方案)
12. [实施步骤](#12-实施步骤)
13. [测试方案](#13-测试方案)
14. [验收标准](#14-验收标准)

---

## 1. 产品需求细化

### 1.1 功能需求

#### FR1: Feed动态类型

**需求描述**: Feed支持多种类型的动态内容

| 类型 | type字段 | 描述 | 数据来源 | 优先级 |
|------|---------|------|---------|--------|
| Session动态 | `session` | 用户完成一次绘画Session | `drawing_sessions`表 | P0 |
| 成就解锁 | `achievement` | 用户解锁成就 | 成就系统钩子 | P1 |
| 联盟事件 | `alliance_event` | 联盟战报、领地变更 | 联盟系统钩子 | P1 |
| 系统公告 | `system_announcement` | 运营发布的公告 | 后台手动创建 | P2 |

**MVP范围（P0）**:
- ✅ Session动态（必须）
- ❌ 成就解锁（延后P1）
- ❌ 联盟事件（延后P1）
- ❌ 系统公告（延后P2）

**验收标准**:
- [ ] Feed列表可以展示Session动态
- [ ] 每条动态包含：用户头像、昵称、时间、Session摘要、地图缩略图
- [ ] 点击动态卡片跳转到Session详情页

---

#### FR2: Feed筛选器

**需求描述**: 支持4种筛选模式查看Feed

| 筛选器 | filter参数 | 数据源 | 排序规则 | 优先级 |
|--------|-----------|--------|---------|--------|
| 全部 | `all` | 全站公开动态 | 时间倒序 + 热度加权 | P0 |
| 关注 | `following` | 已关注用户的动态 | 时间倒序 | P0 |
| 联盟 | `alliance` | 本联盟成员的动态 | 时间倒序 | P0 |
| 附近 | `nearby` | 5km范围内的动态 | 距离优先，时间次之 | P1 |

**筛选器切换UI**:
```
┌────────────────────────────────┐
│ 全部 | 关注 | 联盟 | 附近     │  ← 横向滑动选择器
└────────────────────────────────┘
```

**验收标准**:
- [ ] 默认显示"全部"筛选器
- [ ] 点击筛选器立即切换，Feed列表重新加载
- [ ] "关注"筛选器：未关注任何人时显示引导文案
- [ ] "联盟"筛选器：未加入联盟时显示引导文案
- [ ] "附近"筛选器：基于用户当前GPS位置（需要位置权限）

---

#### FR3: Feed无限滚动

**需求描述**: 支持分页加载，下拉刷新，无限滚动

**交互规则**:
- 每页加载20条动态
- 滚动到底部自动加载下一页
- 下拉刷新加载最新动态（最多50条）
- 加载时显示Loading指示器
- 到达末尾显示"没有更多了"

**验收标准**:
- [ ] 首次进入加载前20条动态
- [ ] 滚动到倒数第5条时触发加载下一页
- [ ] 下拉刷新成功后滚动到顶部
- [ ] 无网络时显示缓存的动态（离线模式）

---

#### FR4: 点赞功能

**需求描述**: 用户可以点赞Feed动态

**交互流程**:
1. 点击❤️图标 → 图标变红 + 数字+1 + 动画
2. 再次点击 → 取消点赞，图标变灰 + 数字-1
3. 已点赞的动态，进入页面时图标默认为红色

**乐观UI更新**:
- 点击后立即更新UI，不等待API响应
- API失败时回滚UI状态 + Toast提示

**验收标准**:
- [ ] 点赞响应时间 < 100ms（乐观更新）
- [ ] 点赞动画流畅（心形放大+缩小）
- [ ] 点赞数字实时更新
- [ ] 网络失败时回滚并提示

---

#### FR5: 评论功能（简化版，完整版在Module 3）

**需求描述**: 点击💬图标查看评论数量，点击进入评论详情（暂不实现评论发布）

**MVP范围**:
- ✅ 显示评论数量
- ✅ 点击跳转到Session详情页（未来在详情页实现评论）
- ❌ 评论列表（延后Module 3）
- ❌ 发布评论（延后Module 3）

---

### 1.2 非功能需求

#### NFR1: 性能

| 指标 | 目标 | 测试方法 |
|------|------|---------|
| Feed首屏加载时间 | < 1秒 | 从点击"动态"Tab到显示第1条 |
| Feed滚动帧率 | 60fps | Instruments - Core Animation |
| Feed聚合查询时间 | < 200ms | 后端日志统计P95 |
| Feed生成延迟 | < 3秒 | Session完成到Feed Item创建 |
| 点赞响应时间 | < 100ms | 乐观UI更新 |

#### NFR2: 可扩展性

- [ ] Feed表支持1000万+条记录（分表策略）
- [ ] Feed查询支持1万+并发读取（Redis缓存）
- [ ] Feed生成支持1000+并发写入（异步队列）

#### NFR3: 数据一致性

- [ ] 点赞数与实际点赞记录最终一致（允许10秒延迟）
- [ ] Feed生成必须幂等（重复触发不会创建重复Feed Item）
- [ ] 用户删除Session后，对应Feed Item自动删除（级联）

---

## 2. 系统架构设计

### 2.1 整体架构

```
┌─────────────────────────────────────────────────────────┐
│                     iOS App (Client)                     │
├─────────────────────────────────────────────────────────┤
│  PlazaView (Feed列表)                                    │
│    ├─ 筛选器切换                                         │
│    ├─ FeedItemCard (动态卡片)                            │
│    │   ├─ 用户信息                                       │
│    │   ├─ Session摘要                                    │
│    │   ├─ 地图缩略图                                     │
│    │   └─ 互动按钮（点赞/评论/分享）                      │
│    ├─ 下拉刷新                                           │
│    └─ 无限滚动                                           │
└─────────────────────────────────────────────────────────┘
                            ↓ HTTP REST API
┌─────────────────────────────────────────────────────────┐
│                  Backend (Node.js)                       │
├─────────────────────────────────────────────────────────┤
│  feedController.js                                       │
│    ├─ GET /api/feed?filter=all&limit=20&offset=0       │
│    ├─ POST /api/feed/:feedId/like                       │
│    └─ DELETE /api/feed/:feedId/like                     │
├─────────────────────────────────────────────────────────┤
│  feedService.js                                          │
│    ├─ generateFeedItem(userId, sessionId, type)         │
│    ├─ aggregateFeed(userId, filter, limit, offset)      │
│    └─ toggleLike(userId, feedId)                         │
├─────────────────────────────────────────────────────────┤
│  feedCacheService.js (Redis)                             │
│    ├─ 时间线缓存（用户维度）                             │
│    ├─ 点赞数缓存                                         │
│    └─ Feed Item缓存                                      │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│              Database (PostgreSQL + PostGIS)             │
├─────────────────────────────────────────────────────────┤
│  feed_items (Feed条目表)                                 │
│  feed_likes (点赞关系表)                                 │
│  drawing_sessions (Session表，已有)                      │
│  users (用户表，已有)                                    │
│  user_follows (关注关系表，Module 2)                     │
│  alliances (联盟表，已有)                                │
└─────────────────────────────────────────────────────────┘
```

---

### 2.2 Feed生成流程

```
┌──────────────────────────────────────────────────────┐
│ 1. 用户完成Session                                    │
│    pixelDrawService.completeSession()                 │
└────────────────┬─────────────────────────────────────┘
                 ↓
┌────────────────▼─────────────────────────────────────┐
│ 2. 触发Feed生成钩子                                   │
│    feedService.generateFeedItem(userId, sessionId)    │
│    - 检查是否已存在（幂等性）                         │
│    - 创建feed_items记录                               │
│    - visibility = 'public'（根据用户隐私设置）        │
└────────────────┬─────────────────────────────────────┘
                 ↓
┌────────────────▼─────────────────────────────────────┐
│ 3. 分发到时间线（Fan-out，可选优化）                  │
│    - 方案A: Fan-out on Read（读取时聚合，MVP）       │
│    - 方案B: Fan-out on Write（写入时分发，高级）     │
└────────────────┬─────────────────────────────────────┘
                 ↓
┌────────────────▼─────────────────────────────────────┐
│ 4. 清除相关缓存                                       │
│    - 清除作者的关注者时间线缓存                       │
│    - 清除联盟成员时间线缓存                           │
└──────────────────────────────────────────────────────┘
```

---

### 2.3 Feed聚合查询流程

```
┌──────────────────────────────────────────────────────┐
│ 1. 客户端请求Feed                                     │
│    GET /api/feed?filter=following&limit=20&offset=0   │
└────────────────┬─────────────────────────────────────┘
                 ↓
┌────────────────▼─────────────────────────────────────┐
│ 2. 检查Redis缓存                                      │
│    key: feed:timeline:{userId}:{filter}:{offset}      │
│    - 命中：直接返回（TTL=5分钟）                      │
│    - 未命中：执行DB查询                               │
└────────────────┬─────────────────────────────────────┘
                 ↓
┌────────────────▼─────────────────────────────────────┐
│ 3. 数据库聚合查询（根据filter）                       │
│    - following: JOIN user_follows                     │
│    - alliance: JOIN alliance_members                  │
│    - nearby: WHERE ST_DWithin(location, user, 5km)   │
│    - 分页: LIMIT 20 OFFSET 0                          │
│    - 排序: ORDER BY created_at DESC                   │
└────────────────┬─────────────────────────────────────┘
                 ↓
┌────────────────▼─────────────────────────────────────┐
│ 4. 数据补全                                           │
│    - JOIN users (头像、昵称)                          │
│    - JOIN drawing_sessions (距离、像素数)             │
│    - 查询点赞状态（当前用户是否已点赞）               │
│    - 查询点赞数量（Redis缓存 or DB COUNT）            │
└────────────────┬─────────────────────────────────────┘
                 ↓
┌────────────────▼─────────────────────────────────────┐
│ 5. 写入Redis缓存 + 返回客户端                         │
│    - 缓存结果（TTL=5分钟）                            │
│    - 返回JSON                                         │
└──────────────────────────────────────────────────────┘
```

---

## 3. 数据库设计

### 3.1 feed_items表（Feed条目表）

**用途**: 存储所有Feed动态条目

```sql
CREATE TABLE feed_items (
  -- 主键
  id SERIAL PRIMARY KEY,

  -- 关联用户（动态的发布者）
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- 动态类型
  type VARCHAR(50) NOT NULL DEFAULT 'session',
  -- 枚举: 'session', 'achievement', 'alliance_event', 'system_announcement'

  -- 关联数据ID（根据type不同，关联不同的表）
  session_id INTEGER REFERENCES drawing_sessions(id) ON DELETE CASCADE,
  achievement_id INTEGER REFERENCES achievements(id) ON DELETE SET NULL,
  alliance_id INTEGER REFERENCES alliances(id) ON DELETE SET NULL,

  -- 可见性
  visibility VARCHAR(20) NOT NULL DEFAULT 'public',
  -- 枚举: 'public', 'followers', 'alliance', 'private'

  -- 地理位置（用于"附近"筛选）
  location GEOGRAPHY(POINT, 4326),
  -- 从drawing_sessions.center_point复制，或成就位置

  -- 时间戳
  created_at TIMESTAMP DEFAULT NOW(),

  -- 索引
  INDEX idx_user_created (user_id, created_at DESC),
  INDEX idx_type_created (type, created_at DESC),
  INDEX idx_created (created_at DESC),
  INDEX idx_location USING GIST (location) -- 地理空间索引
);
```

**字段说明**:

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | SERIAL | 主键，自增ID |
| `user_id` | INTEGER | 动态发布者（外键 → users.id） |
| `type` | VARCHAR(50) | 动态类型（session/achievement/alliance_event/system_announcement） |
| `session_id` | INTEGER | 关联Session（type='session'时有值） |
| `achievement_id` | INTEGER | 关联成就（type='achievement'时有值） |
| `alliance_id` | INTEGER | 关联联盟（type='alliance_event'时有值） |
| `visibility` | VARCHAR(20) | 可见性（public/followers/alliance/private） |
| `location` | GEOGRAPHY | 地理位置（用于附近筛选，PostGIS类型） |
| `created_at` | TIMESTAMP | 创建时间（用于排序） |

**索引策略**:

1. `idx_user_created`: 查询某用户的所有动态
2. `idx_type_created`: 按类型筛选
3. `idx_created`: 全局时间倒序（"全部"筛选器）
4. `idx_location`: 地理空间索引（"附近"筛选器）

**估算容量**:
- 假设10,000活跃用户，每天平均1个Session
- 每天新增Feed Item: 10,000条
- 每年: 365万条
- 3年数据: 约1,095万条
- 单表可承受，无需立即分表

---

### 3.2 feed_likes表（点赞关系表）

**用途**: 记录用户对Feed的点赞关系

```sql
CREATE TABLE feed_likes (
  -- 主键
  id SERIAL PRIMARY KEY,

  -- 关联Feed Item
  feed_item_id INTEGER NOT NULL REFERENCES feed_items(id) ON DELETE CASCADE,

  -- 关联用户（点赞者）
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- 时间戳
  created_at TIMESTAMP DEFAULT NOW(),

  -- 唯一约束（同一用户对同一Feed只能点赞一次）
  UNIQUE (feed_item_id, user_id),

  -- 索引
  INDEX idx_feed_item (feed_item_id),
  INDEX idx_user (user_id),
  INDEX idx_created (created_at DESC)
);
```

**字段说明**:

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | SERIAL | 主键 |
| `feed_item_id` | INTEGER | Feed Item ID（外键） |
| `user_id` | INTEGER | 点赞用户ID（外键） |
| `created_at` | TIMESTAMP | 点赞时间 |

**唯一约束**: `(feed_item_id, user_id)` - 防止重复点赞

**估算容量**:
- 假设每个Feed平均被点赞3次
- 每天10,000个Feed → 30,000条点赞
- 每年: 1,095万条
- 3年数据: 约3,285万条

---

### 3.3 迁移脚本

**文件**: `backend/src/database/migrations/20260228120000_create_feed_tables.js`

```javascript
exports.up = function(knex) {
  return knex.schema
    // 创建feed_items表
    .createTable('feed_items', (table) => {
      table.increments('id').primary();
      table.integer('user_id').unsigned().notNullable()
        .references('id').inTable('users').onDelete('CASCADE');
      table.string('type', 50).notNullable().defaultTo('session');
      table.integer('session_id').unsigned()
        .references('id').inTable('drawing_sessions').onDelete('CASCADE');
      table.integer('achievement_id').unsigned()
        .references('id').inTable('achievements').onDelete('SET NULL');
      table.integer('alliance_id').unsigned()
        .references('id').inTable('alliances').onDelete('SET NULL');
      table.string('visibility', 20).notNullable().defaultTo('public');
      table.specificType('location', 'GEOGRAPHY(POINT, 4326)');
      table.timestamp('created_at').defaultTo(knex.fn.now());

      // 索引
      table.index(['user_id', 'created_at'], 'idx_user_created');
      table.index(['type', 'created_at'], 'idx_type_created');
      table.index('created_at', 'idx_created');
    })
    // 创建地理空间索引（单独执行，因为Knex不直接支持GIST）
    .then(() => {
      return knex.raw('CREATE INDEX idx_location ON feed_items USING GIST (location)');
    })
    // 创建feed_likes表
    .then(() => {
      return knex.schema.createTable('feed_likes', (table) => {
        table.increments('id').primary();
        table.integer('feed_item_id').unsigned().notNullable()
          .references('id').inTable('feed_items').onDelete('CASCADE');
        table.integer('user_id').unsigned().notNullable()
          .references('id').inTable('users').onDelete('CASCADE');
        table.timestamp('created_at').defaultTo(knex.fn.now());

        // 唯一约束
        table.unique(['feed_item_id', 'user_id']);

        // 索引
        table.index('feed_item_id', 'idx_feed_item');
        table.index('user_id', 'idx_user');
        table.index('created_at', 'idx_created');
      });
    });
};

exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('feed_likes')
    .dropTableIfExists('feed_items');
};
```

**运行迁移**:
```bash
cd backend
npx knex migrate:latest --env production
```

---

## 4. 后端API设计

### 4.1 API端点列表

| 方法 | 端点 | 描述 | 认证 | 优先级 |
|------|------|------|------|--------|
| GET | `/api/feed` | 获取Feed列表 | 必须 | P0 |
| POST | `/api/feed/:feedId/like` | 点赞Feed | 必须 | P0 |
| DELETE | `/api/feed/:feedId/like` | 取消点赞 | 必须 | P0 |
| GET | `/api/feed/:feedId` | 获取单个Feed详情 | 可选 | P1 |

---

### 4.2 GET /api/feed - 获取Feed列表

**端点**: `GET /api/feed`

**Query参数**:

| 参数 | 类型 | 必填 | 默认值 | 描述 |
|------|------|------|--------|------|
| `filter` | String | 否 | `all` | 筛选模式：`all`/`following`/`alliance`/`nearby` |
| `limit` | Integer | 否 | `20` | 每页条数（最大50） |
| `offset` | Integer | 否 | `0` | 偏移量（分页） |
| `lat` | Float | 否 | - | 当前纬度（filter=nearby时必填） |
| `lng` | Float | 否 | - | 当前经度（filter=nearby时必填） |

**请求示例**:
```http
GET /api/feed?filter=following&limit=20&offset=0
Authorization: Bearer <token>
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": 12345,
        "type": "session",
        "user": {
          "id": 456,
          "username": "张三",
          "avatar_url": "https://cdn.funnypixels.com/avatars/456.png",
          "alliance": {
            "id": 10,
            "name": "像素联盟",
            "flag_pattern_id": "emoji_cn"
          }
        },
        "session": {
          "id": 789,
          "distance": 3200, // 米
          "pixel_count": 234,
          "duration": 1800, // 秒
          "center_point": {
            "lat": 30.2741,
            "lng": 120.1551
          },
          "map_snapshot_url": "https://cdn.funnypixels.com/snapshots/789.png"
        },
        "like_count": 12,
        "is_liked": false, // 当前用户是否已点赞
        "comment_count": 3,
        "created_at": "2026-02-28T10:30:00Z",
        "visibility": "public"
      },
      // ... 更多Feed Item
    ],
    "pagination": {
      "total": 156,
      "limit": 20,
      "offset": 0,
      "has_more": true
    }
  }
}
```

**错误响应**:

| HTTP状态码 | 错误码 | 描述 |
|-----------|--------|------|
| 400 | `INVALID_FILTER` | filter参数无效 |
| 400 | `MISSING_LOCATION` | filter=nearby但缺少lat/lng |
| 401 | `UNAUTHORIZED` | 未登录或token失效 |

---

### 4.3 POST /api/feed/:feedId/like - 点赞

**端点**: `POST /api/feed/:feedId/like`

**请求示例**:
```http
POST /api/feed/12345/like
Authorization: Bearer <token>
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "feed_item_id": 12345,
    "like_count": 13, // 更新后的点赞数
    "is_liked": true
  }
}
```

**错误响应**:

| HTTP状态码 | 错误码 | 描述 |
|-----------|--------|------|
| 404 | `FEED_NOT_FOUND` | Feed Item不存在 |
| 409 | `ALREADY_LIKED` | 已经点赞过（幂等性，返回成功） |

---

### 4.4 DELETE /api/feed/:feedId/like - 取消点赞

**端点**: `DELETE /api/feed/:feedId/like`

**请求示例**:
```http
DELETE /api/feed/12345/like
Authorization: Bearer <token>
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "feed_item_id": 12345,
    "like_count": 12,
    "is_liked": false
  }
}
```

---

## 5. Feed生成引擎

### 5.1 生成触发点

**文件**: `backend/src/services/pixelDrawService.js`

**在Session完成逻辑中插入钩子**:

```javascript
const feedService = require('./feedService');

async function completeSession(userId, sessionId) {
  // ... 原有Session完成逻辑 ...

  // 生成Feed Item（异步，不阻塞Session完成）
  feedService.generateFeedItem(userId, sessionId, 'session')
    .catch(err => {
      console.error('Feed生成失败:', err);
      // 失败不影响Session完成，只记录日志
    });

  return session;
}
```

---

### 5.2 Feed生成逻辑

**文件**: `backend/src/services/feedService.js`

```javascript
const db = require('../config/database');
const redis = require('../config/redis');

/**
 * 生成Feed Item
 * @param {Number} userId - 用户ID
 * @param {Number} sessionId - Session ID
 * @param {String} type - Feed类型（'session'/'achievement'/etc）
 * @returns {Promise<Object>} 创建的Feed Item
 */
async function generateFeedItem(userId, sessionId, type = 'session') {
  // 1. 幂等性检查：防止重复创建
  const existing = await db('feed_items')
    .where({ user_id: userId, session_id: sessionId, type })
    .first();

  if (existing) {
    console.log(`Feed Item已存在: ${existing.id}`);
    return existing;
  }

  // 2. 获取Session数据（用于提取location）
  const session = await db('drawing_sessions')
    .where({ id: sessionId })
    .first();

  if (!session) {
    throw new Error(`Session不存在: ${sessionId}`);
  }

  // 3. 获取用户隐私设置（决定visibility）
  const user = await db('users')
    .where({ id: userId })
    .select('privacy_feed_visibility')
    .first();

  const visibility = user?.privacy_feed_visibility || 'public';

  // 4. 创建Feed Item
  const [feedItem] = await db('feed_items').insert({
    user_id: userId,
    type: type,
    session_id: sessionId,
    visibility: visibility,
    location: session.center_point, // PostGIS GEOGRAPHY类型
    created_at: new Date()
  }).returning('*');

  console.log(`Feed Item创建成功: ${feedItem.id}`);

  // 5. 清除相关用户的Feed缓存（异步，不阻塞）
  clearRelatedFeedCache(userId).catch(err => {
    console.error('清除Feed缓存失败:', err);
  });

  return feedItem;
}

/**
 * 清除相关用户的Feed缓存
 * @param {Number} userId - 发布者用户ID
 */
async function clearRelatedFeedCache(userId) {
  // 1. 获取关注该用户的所有粉丝
  const followers = await db('user_follows')
    .where({ following_id: userId })
    .select('follower_id');

  // 2. 清除粉丝的"关注"时间线缓存
  const followerIds = followers.map(f => f.follower_id);
  for (const followerId of followerIds) {
    await redis.del(`feed:timeline:${followerId}:following:0`);
  }

  // 3. 清除"全部"时间线缓存（全局）
  await redis.del('feed:timeline:all:0');

  // 4. 获取用户所在联盟
  const allianceMember = await db('alliance_members')
    .where({ user_id: userId })
    .first();

  if (allianceMember) {
    // 5. 清除联盟成员的"联盟"时间线缓存
    const allianceMembers = await db('alliance_members')
      .where({ alliance_id: allianceMember.alliance_id })
      .select('user_id');

    for (const member of allianceMembers) {
      await redis.del(`feed:timeline:${member.user_id}:alliance:0`);
    }
  }
}

module.exports = {
  generateFeedItem,
  clearRelatedFeedCache
};
```

**关键设计点**:

1. **幂等性**: 检查是否已存在相同Feed Item，避免重复创建
2. **异步处理**: Feed生成失败不影响Session完成
3. **缓存清除**: 只清除受影响用户的缓存，不是全量清除
4. **隐私控制**: 尊重用户的`privacy_feed_visibility`设置

---

## 6. Feed聚合查询

### 6.1 聚合查询核心逻辑

**文件**: `backend/src/services/feedService.js`

```javascript
/**
 * 聚合Feed列表
 * @param {Number} currentUserId - 当前用户ID
 * @param {String} filter - 筛选模式（'all'/'following'/'alliance'/'nearby'）
 * @param {Number} limit - 每页条数
 * @param {Number} offset - 偏移量
 * @param {Object} location - 位置（仅nearby时需要）{ lat, lng }
 * @returns {Promise<Object>} { items: [], total, has_more }
 */
async function aggregateFeed(currentUserId, filter = 'all', limit = 20, offset = 0, location = null) {
  limit = Math.min(limit, 50); // 最大50条

  // 1. 检查Redis缓存
  const cacheKey = `feed:timeline:${currentUserId}:${filter}:${offset}`;
  const cached = await redis.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }

  // 2. 构建查询（根据filter）
  let query = db('feed_items as f')
    .select(
      'f.id',
      'f.type',
      'f.user_id',
      'f.session_id',
      'f.created_at',
      'f.visibility',
      // 用户信息
      'u.username',
      'u.avatar_url',
      'u.alliance_id',
      // 联盟信息
      'a.name as alliance_name',
      'a.flag_pattern_id',
      // Session信息
      's.distance',
      's.pixel_count',
      's.duration',
      's.center_point'
    )
    .leftJoin('users as u', 'f.user_id', 'u.id')
    .leftJoin('alliances as a', 'u.alliance_id', 'a.id')
    .leftJoin('drawing_sessions as s', 'f.session_id', 's.id')
    .where('f.visibility', 'public'); // 只显示公开动态

  // 3. 根据filter添加条件
  switch (filter) {
    case 'following':
      // 关注用户的动态
      const followingIds = await db('user_follows')
        .where({ follower_id: currentUserId })
        .pluck('following_id');

      if (followingIds.length === 0) {
        // 未关注任何人，返回空
        return { items: [], total: 0, has_more: false };
      }

      query = query.whereIn('f.user_id', followingIds);
      break;

    case 'alliance':
      // 联盟成员的动态
      const currentUserAlliance = await db('alliance_members')
        .where({ user_id: currentUserId })
        .first();

      if (!currentUserAlliance) {
        // 未加入联盟，返回空
        return { items: [], total: 0, has_more: false };
      }

      const allianceMemberIds = await db('alliance_members')
        .where({ alliance_id: currentUserAlliance.alliance_id })
        .pluck('user_id');

      query = query.whereIn('f.user_id', allianceMemberIds);
      break;

    case 'nearby':
      // 附近动态（5km范围内）
      if (!location || !location.lat || !location.lng) {
        throw new Error('nearby筛选需要提供lat和lng参数');
      }

      // PostGIS地理查询
      query = query.whereRaw(
        `ST_DWithin(f.location, ST_SetSRID(ST_MakePoint(?, ?), 4326)::geography, ?)`,
        [location.lng, location.lat, 5000] // 5000米 = 5km
      );

      // 按距离排序（近的优先）
      query = query.orderByRaw(
        `ST_Distance(f.location, ST_SetSRID(ST_MakePoint(?, ?), 4326)::geography)`,
        [location.lng, location.lat]
      );
      break;

    case 'all':
    default:
      // 全部公开动态（无额外条件）
      break;
  }

  // 4. 排序（nearby已经按距离排序，其他按时间）
  if (filter !== 'nearby') {
    query = query.orderBy('f.created_at', 'desc');
  }

  // 5. 分页
  const total = await query.clone().count('* as count').first();
  const items = await query.limit(limit).offset(offset);

  // 6. 补全点赞信息
  const feedIds = items.map(item => item.id);
  const likeData = await getLikeData(feedIds, currentUserId);

  // 7. 组装结果
  const result = {
    items: items.map(item => ({
      id: item.id,
      type: item.type,
      user: {
        id: item.user_id,
        username: item.username,
        avatar_url: item.avatar_url,
        alliance: item.alliance_id ? {
          id: item.alliance_id,
          name: item.alliance_name,
          flag_pattern_id: item.flag_pattern_id
        } : null
      },
      session: item.session_id ? {
        id: item.session_id,
        distance: item.distance,
        pixel_count: item.pixel_count,
        duration: item.duration,
        center_point: item.center_point,
        map_snapshot_url: generateSnapshotUrl(item.session_id)
      } : null,
      like_count: likeData[item.id]?.count || 0,
      is_liked: likeData[item.id]?.isLiked || false,
      comment_count: 0, // TODO: 评论系统（Module 3）
      created_at: item.created_at,
      visibility: item.visibility
    })),
    pagination: {
      total: total.count,
      limit: limit,
      offset: offset,
      has_more: offset + limit < total.count
    }
  };

  // 8. 写入Redis缓存（TTL=5分钟）
  await redis.setex(cacheKey, 300, JSON.stringify(result));

  return result;
}

/**
 * 获取点赞数据
 * @param {Array<Number>} feedIds - Feed Item IDs
 * @param {Number} currentUserId - 当前用户ID
 * @returns {Promise<Object>} { feedId: { count, isLiked } }
 */
async function getLikeData(feedIds, currentUserId) {
  if (feedIds.length === 0) return {};

  // 1. 从Redis批量获取点赞数（如果有缓存）
  const likeCountsFromRedis = await redis.mget(
    feedIds.map(id => `feed:like_count:${id}`)
  );

  // 2. 未命中的从DB查询
  const missingIds = feedIds.filter((id, index) => !likeCountsFromRedis[index]);

  let likeCountsFromDB = [];
  if (missingIds.length > 0) {
    likeCountsFromDB = await db('feed_likes')
      .select('feed_item_id')
      .count('* as count')
      .whereIn('feed_item_id', missingIds)
      .groupBy('feed_item_id');

    // 写回Redis（TTL=10分钟）
    for (const row of likeCountsFromDB) {
      await redis.setex(`feed:like_count:${row.feed_item_id}`, 600, row.count);
    }
  }

  // 3. 合并Redis和DB的点赞数
  const likeCounts = {};
  feedIds.forEach((id, index) => {
    likeCounts[id] = parseInt(likeCountsFromRedis[index] || 0);
  });
  likeCountsFromDB.forEach(row => {
    likeCounts[row.feed_item_id] = parseInt(row.count);
  });

  // 4. 查询当前用户是否点赞
  const userLikes = await db('feed_likes')
    .select('feed_item_id')
    .whereIn('feed_item_id', feedIds)
    .where('user_id', currentUserId);

  const userLikedSet = new Set(userLikes.map(l => l.feed_item_id));

  // 5. 组装结果
  const result = {};
  feedIds.forEach(id => {
    result[id] = {
      count: likeCounts[id] || 0,
      isLiked: userLikedSet.has(id)
    };
  });

  return result;
}

/**
 * 生成地图快照URL
 * @param {Number} sessionId - Session ID
 * @returns {String} Snapshot URL
 */
function generateSnapshotUrl(sessionId) {
  // TODO: 实际实现可能需要调用地图截图服务
  return `https://cdn.funnypixels.com/snapshots/${sessionId}.png`;
}

module.exports = {
  aggregateFeed,
  getLikeData
};
```

---

### 6.2 性能优化要点

**1. 索引优化**:
- `feed_items(user_id, created_at)` - 复合索引，支持按用户和时间查询
- `feed_items(created_at)` - 全局时间倒序
- `feed_items(location)` - GIST索引，支持地理空间查询

**2. 查询优化**:
- 使用`LEFT JOIN`而非子查询，减少嵌套
- `whereIn`提前过滤，减少JOIN数据量
- 分页查询避免OFFSET过大（建议OFFSET < 1000）

**3. 缓存策略**:
- Feed列表缓存：5分钟（`feed:timeline:{userId}:{filter}:{offset}`）
- 点赞数缓存：10分钟（`feed:like_count:{feedId}`）
- 用户关注列表缓存：1小时（`user:following:{userId}`）

---

## 7. 前端UI设计

### 7.1 PlazaView（Feed列表）

**文件**: `FunnyPixelsApp/Views/FeedTab/PlazaView.swift`

```swift
import SwiftUI

struct PlazaView: View {
    @StateObject private var viewModel = PlazaViewModel()
    @EnvironmentObject var appState: AppState

    var body: some View {
        VStack(spacing: 0) {
            // 筛选器
            FeedFilterPicker(selection: $viewModel.selectedFilter)
                .padding(.horizontal)
                .padding(.vertical, 8)

            // Feed列表
            ScrollView {
                LazyVStack(spacing: 12) {
                    ForEach(viewModel.feedItems) { item in
                        FeedItemCard(feedItem: item)
                            .onAppear {
                                // 滚动到倒数第5条时加载下一页
                                if viewModel.shouldLoadMore(currentItem: item) {
                                    viewModel.loadMore()
                                }
                            }
                    }

                    // Loading指示器
                    if viewModel.isLoadingMore {
                        ProgressView()
                            .padding()
                    }

                    // 末尾提示
                    if !viewModel.hasMore && !viewModel.feedItems.isEmpty {
                        Text("没有更多了")
                            .foregroundColor(.secondary)
                            .padding()
                    }
                }
                .padding(.horizontal)
            }
            .refreshable {
                await viewModel.refresh()
            }

            // 空状态
            if viewModel.feedItems.isEmpty && !viewModel.isLoading {
                EmptyFeedView(filter: viewModel.selectedFilter)
            }

            // 错误提示
            if let error = viewModel.error {
                ErrorBanner(message: error)
            }
        }
        .onAppear {
            viewModel.loadInitial()
        }
        .onChange(of: viewModel.selectedFilter) { _ in
            viewModel.loadInitial()
        }
    }
}
```

---

### 7.2 PlazaViewModel

**文件**: `FunnyPixelsApp/ViewModels/PlazaViewModel.swift`

```swift
import Foundation
import Combine

class PlazaViewModel: ObservableObject {
    @Published var feedItems: [FeedItem] = []
    @Published var selectedFilter: FeedFilter = .all
    @Published var isLoading = false
    @Published var isLoadingMore = false
    @Published var hasMore = true
    @Published var error: String?

    private var currentOffset = 0
    private let limit = 20
    private var cancellables = Set<AnyCancellable>()

    private let feedService = FeedService.shared

    // MARK: - Public Methods

    func loadInitial() {
        currentOffset = 0
        hasMore = true
        feedItems = []
        load()
    }

    func refresh() async {
        currentOffset = 0
        hasMore = true
        await loadAsync()
    }

    func loadMore() {
        guard !isLoadingMore && hasMore else { return }
        currentOffset += limit
        load(isMore: true)
    }

    func shouldLoadMore(currentItem: FeedItem) -> Bool {
        guard let index = feedItems.firstIndex(where: { $0.id == currentItem.id }) else {
            return false
        }
        return index >= feedItems.count - 5
    }

    // MARK: - Private Methods

    private func load(isMore: Bool = false) {
        if isMore {
            isLoadingMore = true
        } else {
            isLoading = true
        }

        feedService.getFeed(filter: selectedFilter, limit: limit, offset: currentOffset)
            .receive(on: DispatchQueue.main)
            .sink { [weak self] completion in
                self?.isLoading = false
                self?.isLoadingMore = false

                if case .failure(let error) = completion {
                    self?.error = error.localizedDescription
                }
            } receiveValue: { [weak self] response in
                guard let self = self else { return }

                if isMore {
                    self.feedItems.append(contentsOf: response.items)
                } else {
                    self.feedItems = response.items
                }

                self.hasMore = response.pagination.hasMore
                self.error = nil
            }
            .store(in: &cancellables)
    }

    private func loadAsync() async {
        do {
            let response = try await feedService.getFeedAsync(
                filter: selectedFilter,
                limit: limit,
                offset: 0
            )

            await MainActor.run {
                self.feedItems = response.items
                self.hasMore = response.pagination.hasMore
                self.error = nil
            }
        } catch {
            await MainActor.run {
                self.error = error.localizedDescription
            }
        }
    }
}
```

---

### 7.3 FeedItemCard（动态卡片）

**文件**: `FunnyPixelsApp/Views/FeedTab/FeedItemCard.swift`

```swift
import SwiftUI

struct FeedItemCard: View {
    let feedItem: FeedItem
    @EnvironmentObject var appState: AppState
    @StateObject private var likeViewModel: LikeViewModel

    init(feedItem: FeedItem) {
        self.feedItem = feedItem
        self._likeViewModel = StateObject(wrappedValue: LikeViewModel(feedItem: feedItem))
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            // 用户信息
            HStack {
                // 头像
                AsyncImage(url: URL(string: feedItem.user.avatarUrl ?? "")) { image in
                    image.resizable()
                } placeholder: {
                    Circle().fill(Color.gray.opacity(0.3))
                }
                .frame(width: 40, height: 40)
                .clipShape(Circle())

                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: 4) {
                        Text(feedItem.user.username)
                            .font(.subheadline)
                            .fontWeight(.semibold)

                        // 联盟旗帜（如果有）
                        if let alliance = feedItem.user.alliance {
                            SmallAllianceFlagBadge(patternId: alliance.flagPatternId)
                        }
                    }

                    Text(feedItem.createdAt.timeAgo())
                        .font(.caption)
                        .foregroundColor(.secondary)
                }

                Spacer()
            }

            // Session摘要
            if let session = feedItem.session {
                HStack(spacing: 16) {
                    Label("\(session.distance)m", systemImage: "point.topleft.down.curvedto.point.bottomright.up")
                    Label("\(session.pixelCount)px", systemImage: "square.grid.3x3.fill")
                    Label(session.duration.formatted(), systemImage: "clock")
                }
                .font(.caption)
                .foregroundColor(.secondary)
            }

            // 地图缩略图
            if let session = feedItem.session {
                Button {
                    // 跳转到地图
                    appState.navigateToMap(location: session.centerPoint)
                } label: {
                    AsyncImage(url: URL(string: session.mapSnapshotUrl)) { image in
                        image.resizable()
                            .aspectRatio(contentMode: .fill)
                    } placeholder: {
                        Rectangle().fill(Color.gray.opacity(0.2))
                    }
                    .frame(height: 200)
                    .clipped()
                    .cornerRadius(8)
                }
            }

            // 互动按钮
            HStack(spacing: 24) {
                // 点赞
                Button {
                    likeViewModel.toggleLike()
                } label: {
                    HStack(spacing: 4) {
                        Image(systemName: likeViewModel.isLiked ? "heart.fill" : "heart")
                            .foregroundColor(likeViewModel.isLiked ? .red : .primary)
                        Text("\(likeViewModel.likeCount)")
                            .font(.subheadline)
                    }
                }
                .buttonStyle(.plain)

                // 评论（跳转到Session详情）
                Button {
                    // TODO: 跳转到Session详情页
                } label: {
                    HStack(spacing: 4) {
                        Image(systemName: "bubble.right")
                        Text("\(feedItem.commentCount)")
                            .font(.subheadline)
                    }
                }
                .buttonStyle(.plain)

                Spacer()

                // 分享
                Button {
                    // TODO: 分享功能
                } label: {
                    Image(systemName: "square.and.arrow.up")
                }
                .buttonStyle(.plain)
            }
        }
        .padding()
        .background(Color(.systemBackground))
        .cornerRadius(12)
        .shadow(color: Color.black.opacity(0.1), radius: 4, x: 0, y: 2)
    }
}
```

---

### 7.4 FeedService

**文件**: `FunnyPixelsApp/Services/FeedService.swift`

```swift
import Foundation
import Combine

class FeedService {
    static let shared = FeedService()

    private let apiManager = APIManager.shared

    // MARK: - Get Feed (Combine)

    func getFeed(filter: FeedFilter, limit: Int = 20, offset: Int = 0) -> AnyPublisher<FeedResponse, Error> {
        var queryItems = [
            URLQueryItem(name: "filter", value: filter.rawValue),
            URLQueryItem(name: "limit", value: "\(limit)"),
            URLQueryItem(name: "offset", value: "\(offset)")
        ]

        // 如果是附近筛选，添加位置参数
        if filter == .nearby, let location = LocationManager.shared.currentLocation {
            queryItems.append(URLQueryItem(name: "lat", value: "\(location.coordinate.latitude)"))
            queryItems.append(URLQueryItem(name: "lng", value: "\(location.coordinate.longitude)"))
        }

        return apiManager.request(
            endpoint: .feed,
            method: .get,
            queryItems: queryItems
        )
    }

    // MARK: - Get Feed (Async/Await)

    func getFeedAsync(filter: FeedFilter, limit: Int = 20, offset: Int = 0) async throws -> FeedResponse {
        var queryItems = [
            URLQueryItem(name: "filter", value: filter.rawValue),
            URLQueryItem(name: "limit", value: "\(limit)"),
            URLQueryItem(name: "offset", value: "\(offset)")
        ]

        if filter == .nearby, let location = LocationManager.shared.currentLocation {
            queryItems.append(URLQueryItem(name: "lat", value: "\(location.coordinate.latitude)"))
            queryItems.append(URLQueryItem(name: "lng", value: "\(location.coordinate.longitude)"))
        }

        return try await apiManager.requestAsync(
            endpoint: .feed,
            method: .get,
            queryItems: queryItems
        )
    }

    // MARK: - Toggle Like

    func toggleLike(feedId: Int, isCurrentlyLiked: Bool) -> AnyPublisher<LikeResponse, Error> {
        let method: HTTPMethod = isCurrentlyLiked ? .delete : .post
        let endpoint = APIEndpoint.feedLike(feedId: feedId)

        return apiManager.request(endpoint: endpoint, method: method)
    }
}

// MARK: - Models

enum FeedFilter: String, CaseIterable {
    case all = "all"
    case following = "following"
    case alliance = "alliance"
    case nearby = "nearby"

    var title: String {
        switch self {
        case .all: return "全部"
        case .following: return "关注"
        case .alliance: return "联盟"
        case .nearby: return "附近"
        }
    }
}

struct FeedResponse: Codable {
    let items: [FeedItem]
    let pagination: Pagination

    struct Pagination: Codable {
        let total: Int
        let limit: Int
        let offset: Int
        let hasMore: Bool

        enum CodingKeys: String, CodingKey {
            case total, limit, offset
            case hasMore = "has_more"
        }
    }
}

struct FeedItem: Codable, Identifiable {
    let id: Int
    let type: String
    let user: FeedUser
    let session: FeedSession?
    let likeCount: Int
    let isLiked: Bool
    let commentCount: Int
    let createdAt: Date
    let visibility: String

    enum CodingKeys: String, CodingKey {
        case id, type, user, session, visibility
        case likeCount = "like_count"
        case isLiked = "is_liked"
        case commentCount = "comment_count"
        case createdAt = "created_at"
    }
}

struct FeedUser: Codable {
    let id: Int
    let username: String
    let avatarUrl: String?
    let alliance: FeedAlliance?

    enum CodingKeys: String, CodingKey {
        case id, username, alliance
        case avatarUrl = "avatar_url"
    }
}

struct FeedAlliance: Codable {
    let id: Int
    let name: String
    let flagPatternId: String

    enum CodingKeys: String, CodingKey {
        case id, name
        case flagPatternId = "flag_pattern_id"
    }
}

struct FeedSession: Codable {
    let id: Int
    let distance: Int
    let pixelCount: Int
    let duration: Int
    let centerPoint: Coordinate
    let mapSnapshotUrl: String

    enum CodingKeys: String, CodingKey {
        case id, distance, duration
        case pixelCount = "pixel_count"
        case centerPoint = "center_point"
        case mapSnapshotUrl = "map_snapshot_url"
    }
}

struct Coordinate: Codable {
    let lat: Double
    let lng: Double
}

struct LikeResponse: Codable {
    let feedItemId: Int
    let likeCount: Int
    let isLiked: Bool

    enum CodingKeys: String, CodingKey {
        case likeCount = "like_count"
        case isLiked = "is_liked"
        case feedItemId = "feed_item_id"
    }
}
```

---

## 8. 点赞系统

### 8.1 后端点赞逻辑

**文件**: `backend/src/controllers/feedController.js`

```javascript
const feedService = require('../services/feedService');

/**
 * POST /api/feed/:feedId/like - 点赞
 */
async function likeFeed(req, res) {
  try {
    const { feedId } = req.params;
    const userId = req.user.id;

    const result = await feedService.toggleLike(parseInt(feedId), userId, true);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('点赞失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * DELETE /api/feed/:feedId/like - 取消点赞
 */
async function unlikeFeed(req, res) {
  try {
    const { feedId } = req.params;
    const userId = req.user.id;

    const result = await feedService.toggleLike(parseInt(feedId), userId, false);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('取消点赞失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

module.exports = {
  likeFeed,
  unlikeFeed
};
```

**文件**: `backend/src/services/feedService.js`

```javascript
/**
 * 切换点赞状态
 * @param {Number} feedId - Feed Item ID
 * @param {Number} userId - 用户ID
 * @param {Boolean} shouldLike - true=点赞, false=取消点赞
 * @returns {Promise<Object>} { feed_item_id, like_count, is_liked }
 */
async function toggleLike(feedId, userId, shouldLike) {
  // 1. 检查Feed Item是否存在
  const feedItem = await db('feed_items').where({ id: feedId }).first();
  if (!feedItem) {
    throw new Error('Feed Item不存在');
  }

  if (shouldLike) {
    // 点赞
    try {
      await db('feed_likes').insert({
        feed_item_id: feedId,
        user_id: userId,
        created_at: new Date()
      });
    } catch (error) {
      // 如果已存在（UNIQUE约束冲突），忽略错误（幂等性）
      if (error.code !== '23505') { // PostgreSQL唯一约束错误码
        throw error;
      }
    }
  } else {
    // 取消点赞
    await db('feed_likes')
      .where({ feed_item_id: feedId, user_id: userId })
      .delete();
  }

  // 2. 更新Redis缓存的点赞数
  const likeCount = await db('feed_likes')
    .where({ feed_item_id: feedId })
    .count('* as count')
    .first();

  await redis.setex(`feed:like_count:${feedId}`, 600, likeCount.count);

  // 3. 返回结果
  return {
    feed_item_id: feedId,
    like_count: parseInt(likeCount.count),
    is_liked: shouldLike
  };
}

module.exports = {
  toggleLike
};
```

---

### 8.2 前端点赞ViewModel

**文件**: `FunnyPixelsApp/ViewModels/LikeViewModel.swift`

```swift
import Foundation
import Combine

class LikeViewModel: ObservableObject {
    @Published var isLiked: Bool
    @Published var likeCount: Int

    private let feedId: Int
    private let feedService = FeedService.shared
    private var cancellables = Set<AnyCancellable>()

    init(feedItem: FeedItem) {
        self.feedId = feedItem.id
        self.isLiked = feedItem.isLiked
        self.likeCount = feedItem.likeCount
    }

    // MARK: - Toggle Like

    func toggleLike() {
        // 乐观UI更新
        let previousIsLiked = isLiked
        let previousLikeCount = likeCount

        isLiked.toggle()
        likeCount += isLiked ? 1 : -1

        // 防抖：避免用户快速点击导致多次请求
        NSObject.cancelPreviousPerformRequests(withTarget: self)
        perform(#selector(sendLikeRequest), with: nil, afterDelay: 0.3)
    }

    @objc private func sendLikeRequest() {
        feedService.toggleLike(feedId: feedId, isCurrentlyLiked: !isLiked)
            .receive(on: DispatchQueue.main)
            .sink { completion in
                if case .failure(let error) = completion {
                    print("点赞失败:", error)
                    // 回滚UI
                    self.isLiked.toggle()
                    self.likeCount += self.isLiked ? 1 : -1

                    // 显示错误Toast
                    // TODO: Toast提示
                }
            } receiveValue: { response in
                // 使用服务器返回的准确值
                self.likeCount = response.likeCount
                self.isLiked = response.isLiked
            }
            .store(in: &cancellables)
    }
}
```

---

## 9. 缓存策略

### 9.1 多层缓存架构

```
┌─────────────────────────────────────────┐
│  L1: iOS本地缓存（UserDefaults/SQLite） │
│  - 最近查看的Feed（离线访问）           │
│  - TTL: 24小时                          │
└────────────────┬────────────────────────┘
                 ↓
┌────────────────▼────────────────────────┐
│  L2: Redis缓存（服务器端）               │
│  - Feed时间线: 5分钟                    │
│  - 点赞数: 10分钟                       │
│  - 用户关注列表: 1小时                  │
└────────────────┬────────────────────────┘
                 ↓
┌────────────────▼────────────────────────┐
│  L3: PostgreSQL数据库（持久化）          │
│  - feed_items                           │
│  - feed_likes                           │
└─────────────────────────────────────────┘
```

---

### 9.2 Redis缓存键设计

| 缓存键 | 值类型 | TTL | 示例 |
|--------|-------|-----|------|
| `feed:timeline:{userId}:{filter}:{offset}` | String (JSON) | 5分钟 | `feed:timeline:123:following:0` |
| `feed:like_count:{feedId}` | String (数字) | 10分钟 | `feed:like_count:456` |
| `user:following:{userId}` | Set | 1小时 | `user:following:123` |
| `feed:item:{feedId}` | String (JSON) | 30分钟 | `feed:item:789` |

---

### 9.3 缓存失效策略

**写入时失效（Write-Through）**:

| 操作 | 失效缓存 |
|------|---------|
| 新增Feed Item | 清除相关用户的`feed:timeline:*` |
| 删除Feed Item | 清除该Feed的所有缓存 |
| 点赞/取消点赞 | 更新`feed:like_count:{feedId}` |
| 关注/取关 | 清除`user:following:{userId}` + `feed:timeline:*` |

**定时失效（TTL）**:
- Feed时间线：5分钟（平衡实时性与性能）
- 点赞数：10分钟（允许短暂不一致）
- 关注列表：1小时（变化频率低）

---

## 10. 性能优化

### 10.1 数据库优化

#### 索引优化

```sql
-- 已创建的索引（在迁移脚本中）
CREATE INDEX idx_user_created ON feed_items(user_id, created_at DESC);
CREATE INDEX idx_type_created ON feed_items(type, created_at DESC);
CREATE INDEX idx_created ON feed_items(created_at DESC);
CREATE INDEX idx_location ON feed_items USING GIST (location);

-- 额外推荐索引（如果查询慢）
CREATE INDEX idx_session_id ON feed_items(session_id);
CREATE INDEX idx_visibility_created ON feed_items(visibility, created_at DESC);
```

#### 查询优化

**1. 避免 N+1 查询**:
```javascript
// ❌ 错误示例（N+1）
const feedItems = await db('feed_items').limit(20);
for (const item of feedItems) {
  item.user = await db('users').where({ id: item.user_id }).first();
}

// ✅ 正确示例（JOIN）
const feedItems = await db('feed_items')
  .leftJoin('users', 'feed_items.user_id', 'users.id')
  .select('feed_items.*', 'users.username', 'users.avatar_url')
  .limit(20);
```

**2. 使用COUNT优化**:
```javascript
// ❌ 慢查询
const total = (await db('feed_items').select('*')).length;

// ✅ 快查询
const total = await db('feed_items').count('* as count').first();
```

---

### 10.2 API优化

#### 批量查询

**优化点赞数查询**:
```javascript
// ❌ 逐个查询（N次DB查询）
for (const feedItem of feedItems) {
  const likeCount = await db('feed_likes')
    .where({ feed_item_id: feedItem.id })
    .count();
}

// ✅ 批量查询（1次DB查询）
const feedIds = feedItems.map(f => f.id);
const likeCounts = await db('feed_likes')
  .select('feed_item_id')
  .count('* as count')
  .whereIn('feed_item_id', feedIds)
  .groupBy('feed_item_id');
```

---

### 10.3 前端优化

#### 图片懒加载

```swift
// 使用AsyncImage自带懒加载
AsyncImage(url: URL(string: imageUrl)) { phase in
    switch phase {
    case .success(let image):
        image.resizable()
    case .failure:
        Image(systemName: "photo")
    case .empty:
        ProgressView()
    @unknown default:
        EmptyView()
    }
}
```

#### 列表虚拟化

```swift
// 使用LazyVStack而非VStack
LazyVStack(spacing: 12) {
    ForEach(feedItems) { item in
        FeedItemCard(feedItem: item)
    }
}
```

---

## 11. 冷启动方案

### 11.1 新用户Feed为空问题

**场景**: 新用户未关注任何人，"关注"筛选器返回空列表

**解决方案A: 推荐关注**

**后端API**: `GET /api/users/recommended`

```javascript
/**
 * 推荐关注用户
 * @param {Number} userId - 当前用户ID
 * @returns {Promise<Array>} 推荐用户列表
 */
async function getRecommendedUsers(userId) {
  // 1. 获取用户位置
  const user = await db('users').where({ id: userId }).first();
  const userLocation = user.last_known_location;

  // 2. 推荐策略（优先级递减）
  let recommended = [];

  // 策略1: 同城活跃用户（Top 10）
  if (userLocation) {
    const nearbyUsers = await db('users')
      .select('id', 'username', 'avatar_url')
      .where('id', '!=', userId)
      .whereRaw(
        `ST_DWithin(last_known_location, ST_SetSRID(ST_MakePoint(?, ?), 4326)::geography, ?)`,
        [userLocation.lng, userLocation.lat, 50000] // 50km
      )
      .orderBy('total_pixels', 'desc')
      .limit(10);

    recommended = recommended.concat(nearbyUsers);
  }

  // 策略2: 同联盟用户
  const userAlliance = await db('alliance_members')
    .where({ user_id: userId })
    .first();

  if (userAlliance) {
    const allianceUsers = await db('alliance_members')
      .join('users', 'alliance_members.user_id', 'users.id')
      .where('alliance_members.alliance_id', userAlliance.alliance_id)
      .where('users.id', '!=', userId)
      .select('users.id', 'users.username', 'users.avatar_url')
      .orderBy('users.total_pixels', 'desc')
      .limit(5);

    recommended = recommended.concat(allianceUsers);
  }

  // 策略3: 全站Top用户
  if (recommended.length < 10) {
    const topUsers = await db('users')
      .where('id', '!=', userId)
      .orderBy('total_pixels', 'desc')
      .limit(10)
      .select('id', 'username', 'avatar_url');

    recommended = recommended.concat(topUsers);
  }

  // 去重
  const seen = new Set();
  return recommended.filter(u => {
    if (seen.has(u.id)) return false;
    seen.add(u.id);
    return true;
  }).slice(0, 10);
}
```

**前端UI**: 当"关注"筛选器为空时显示

```swift
if viewModel.feedItems.isEmpty && viewModel.selectedFilter == .following {
    VStack(spacing: 16) {
        Image(systemName: "person.2")
            .font(.system(size: 60))
            .foregroundColor(.secondary)

        Text("还没有关注任何人")
            .font(.headline)

        Text("推荐关注这些活跃玩家")
            .font(.subheadline)
            .foregroundColor(.secondary)

        // 推荐用户列表
        ForEach(viewModel.recommendedUsers) { user in
            RecommendedUserCard(user: user)
        }
    }
    .padding()
}
```

---

**解决方案B: 自动关注官方账号**

**实现**: 新用户注册时自动关注官方账号

```javascript
// 在authService.js的register方法中
async function register(email, password, username) {
  // ... 创建用户 ...

  const newUser = await db('users').insert({
    email, password_hash, username
  }).returning('*');

  // 自动关注官方账号（ID=1）
  await db('user_follows').insert({
    follower_id: newUser[0].id,
    following_id: 1, // 官方账号
    created_at: new Date()
  });

  return newUser[0];
}
```

**官方账号发布内容**: 定期发布游戏攻略、活动公告等

---

## 12. 实施步骤

### 12.1 任务拆解

| Task ID | 任务描述 | 工作量 | 依赖 | 负责人 | 优先级 |
|---------|---------|-------|------|-------|--------|
| **后端（7-9天）** |
| T1.1 | 创建feed_items、feed_likes表（迁移脚本） | 2h | - | Backend | P0 |
| T1.2 | feedService.generateFeedItem（Feed生成逻辑） | 4h | T1.1 | Backend | P0 |
| T1.3 | feedService.aggregateFeed（Feed聚合查询） | 8h | T1.1 | Backend | P0 |
| T1.4 | feedService.toggleLike（点赞逻辑） | 3h | T1.1 | Backend | P0 |
| T1.5 | feedController（API端点） | 4h | T1.2-T1.4 | Backend | P0 |
| T1.6 | Feed缓存Service（Redis） | 6h | T1.3 | Backend | P0 |
| T1.7 | 推荐用户API | 4h | - | Backend | P1 |
| T1.8 | Session完成钩子集成 | 2h | T1.2 | Backend | P0 |
| T1.9 | 性能优化（索引、查询） | 4h | T1.3 | Backend | P1 |
| T1.10 | 单元测试 | 6h | T1.2-T1.5 | Backend | P0 |
| **前端 iOS（8-10天）** |
| T1.11 | FeedItem模型 | 2h | - | iOS | P0 |
| T1.12 | FeedService（API调用） | 4h | T1.11 | iOS | P0 |
| T1.13 | PlazaViewModel | 6h | T1.12 | iOS | P0 |
| T1.14 | FeedItemCard组件 | 6h | T1.11 | iOS | P0 |
| T1.15 | FeedFilterPicker组件 | 2h | - | iOS | P0 |
| T1.16 | PlazaView（Feed列表） | 4h | T1.13-T1.15 | iOS | P0 |
| T1.17 | LikeViewModel（点赞逻辑） | 3h | T1.12 | iOS | P0 |
| T1.18 | 下拉刷新 + 无限滚动 | 4h | T1.16 | iOS | P0 |
| T1.19 | 空状态UI（EmptyFeedView） | 2h | T1.16 | iOS | P0 |
| T1.20 | 推荐关注UI | 4h | T1.19 | iOS | P1 |
| T1.21 | 本地缓存（离线模式） | 6h | T1.12 | iOS | P1 |
| T1.22 | UI测试 | 4h | T1.16 | iOS | P0 |
| **联调与测试（2-3天）** |
| T1.23 | 前后端联调 | 8h | All | Both | P0 |
| T1.24 | 性能测试 | 4h | T1.23 | QA | P0 |
| T1.25 | 用户验收测试 | 4h | T1.23 | QA | P0 |
| **总计** | **~90小时** | **12-15个工作日** |

---

### 12.2 里程碑

**Milestone 1: 后端基础（Week 1）**
- [ ] T1.1 - T1.5完成
- [ ] 验收: Postman可以调用Feed API，返回正确数据

**Milestone 2: Feed缓存与优化（Week 2）**
- [ ] T1.6 - T1.9完成
- [ ] 验收: Feed查询 P95 < 200ms，Redis缓存命中率 > 70%

**Milestone 3: 前端UI（Week 2）**
- [ ] T1.11 - T1.16完成
- [ ] 验收: iOS可以展示Feed列表，点击筛选器切换

**Milestone 4: 点赞与交互（Week 3）**
- [ ] T1.17 - T1.19完成
- [ ] 验收: 点赞功能正常，乐观UI更新流畅

**Milestone 5: 冷启动与测试（Week 3）**
- [ ] T1.20 - T1.25完成
- [ ] 验收: 所有测试通过，准备上线

---

### 12.3 每周计划

**Week 1（后端基础）**:
- Day 1: T1.1 - T1.2（数据库 + Feed生成）
- Day 2-3: T1.3（Feed聚合查询，核心逻辑）
- Day 4: T1.4 - T1.5（点赞 + API）
- Day 5: T1.10（单元测试）

**Week 2（前端 + 缓存）**:
- Day 1-2: T1.6（Redis缓存）
- Day 3: T1.11 - T1.13（iOS模型 + Service + ViewModel）
- Day 4-5: T1.14 - T1.16（UI组件 + Feed列表）

**Week 3（交互 + 优化）**:
- Day 1: T1.17 - T1.18（点赞 + 滚动）
- Day 2: T1.9 + T1.19（性能优化 + 空状态）
- Day 3: T1.20 - T1.21（推荐 + 离线）
- Day 4-5: T1.23 - T1.25（联调 + 测试）

---

## 13. 测试方案

### 13.1 后端单元测试

**文件**: `backend/tests/services/feedService.test.js`

```javascript
const { expect } = require('chai');
const feedService = require('../../src/services/feedService');
const db = require('../../src/config/database');

describe('FeedService', () => {
  before(async () => {
    // 创建测试数据
    await db('users').insert({ id: 1, username: 'testuser' });
    await db('drawing_sessions').insert({ id: 1, user_id: 1 });
  });

  after(async () => {
    // 清理测试数据
    await db('feed_items').delete();
    await db('drawing_sessions').delete();
    await db('users').delete();
  });

  describe('generateFeedItem', () => {
    it('应该成功创建Feed Item', async () => {
      const result = await feedService.generateFeedItem(1, 1, 'session');
      expect(result).to.have.property('id');
      expect(result.user_id).to.equal(1);
      expect(result.session_id).to.equal(1);
    });

    it('应该防止重复创建（幂等性）', async () => {
      const result1 = await feedService.generateFeedItem(1, 1, 'session');
      const result2 = await feedService.generateFeedItem(1, 1, 'session');
      expect(result1.id).to.equal(result2.id);
    });
  });

  describe('aggregateFeed', () => {
    it('应该返回正确格式的Feed列表', async () => {
      const result = await feedService.aggregateFeed(1, 'all', 20, 0);
      expect(result).to.have.property('items');
      expect(result).to.have.property('pagination');
      expect(result.items).to.be.an('array');
    });
  });

  describe('toggleLike', () => {
    let feedId;

    before(async () => {
      const feedItem = await feedService.generateFeedItem(1, 1, 'session');
      feedId = feedItem.id;
    });

    it('应该成功点赞', async () => {
      const result = await feedService.toggleLike(feedId, 1, true);
      expect(result.is_liked).to.be.true;
      expect(result.like_count).to.equal(1);
    });

    it('应该成功取消点赞', async () => {
      const result = await feedService.toggleLike(feedId, 1, false);
      expect(result.is_liked).to.be.false;
      expect(result.like_count).to.equal(0);
    });
  });
});
```

---

### 13.2 前端UI测试

**文件**: `FunnyPixelsAppUITests/FeedTests.swift`

```swift
import XCTest

class FeedTests: XCTestCase {
    var app: XCUIApplication!

    override func setUp() {
        super.setUp()
        app = XCUIApplication()
        app.launch()
    }

    func testFeedListDisplays() {
        // 进入动态Tab
        app.tabBars.buttons["动态"].tap()

        // 等待Feed列表加载
        let feedList = app.scrollViews.firstMatch
        XCTAssertTrue(feedList.exists)

        // 验证至少有1个Feed Item
        XCTAssertTrue(feedList.staticTexts.count > 0)
    }

    func testFilterSwitch() {
        app.tabBars.buttons["动态"].tap()

        // 点击"关注"筛选器
        app.buttons["关注"].tap()

        // 验证内容变化（具体验证逻辑取决于数据）
        // 这里简化为验证Feed列表重新加载
        sleep(1)
        XCTAssertTrue(app.scrollViews.firstMatch.exists)
    }

    func testLikeButton() {
        app.tabBars.buttons["动态"].tap()

        // 找到第一个点赞按钮
        let likeButton = app.buttons.matching(identifier: "likeButton").firstMatch
        XCTAssertTrue(likeButton.exists)

        // 点击点赞
        likeButton.tap()

        // 验证图标变化（从heart到heart.fill）
        // 这里简化，实际需要检查图标状态
        XCTAssertTrue(likeButton.exists)
    }

    func testInfiniteScroll() {
        app.tabBars.buttons["动态"].tap()

        let feedList = app.scrollViews.firstMatch
        XCTAssertTrue(feedList.exists)

        // 滚动到底部
        feedList.swipeUp()
        feedList.swipeUp()
        feedList.swipeUp()

        // 验证加载指示器出现（简化验证）
        sleep(1)
        XCTAssertTrue(feedList.exists)
    }
}
```

---

### 13.3 性能测试

**测试指标**:

| 指标 | 目标 | 测试方法 |
|------|------|---------|
| Feed首屏加载时间 | < 1秒 | 从点击"动态"Tab到第1条Feed显示 |
| Feed聚合查询P95 | < 200ms | 后端日志统计 |
| Feed生成延迟 | < 3秒 | Session完成到Feed Item创建 |
| 点赞响应 | < 100ms | 乐观UI更新 |
| 滚动帧率 | 60fps | Instruments - Core Animation |

**k6压测脚本**:

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  stages: [
    { duration: '30s', target: 100 }, // 100并发用户
    { duration: '1m', target: 100 },
    { duration: '30s', target: 0 },
  ],
};

export default function () {
  const token = 'your_test_token';
  const headers = { Authorization: `Bearer ${token}` };

  // 查询Feed
  const res = http.get('https://api.funnypixels.com/api/feed?filter=all&limit=20', { headers });

  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 200ms': (r) => r.timings.duration < 200,
  });

  sleep(1);
}
```

---

## 14. 验收标准

### 14.1 功能验收

- [ ] **F1**: Feed列表显示Session动态，包含用户头像、昵称、时间、Session摘要
- [ ] **F2**: 4个筛选器（全部/关注/联盟/附近）可以切换，数据正确
- [ ] **F3**: "关注"筛选器：未关注任何人时显示推荐关注
- [ ] **F4**: "联盟"筛选器：未加入联盟时显示引导
- [ ] **F5**: "附近"筛选器：基于GPS位置显示5km内动态
- [ ] **F6**: 下拉刷新加载最新动态，最多50条
- [ ] **F7**: 滚动到底部自动加载下一页，每页20条
- [ ] **F8**: 点击地图缩略图跳转到地图Tab并飞往该位置
- [ ] **F9**: 点赞按钮点击后立即变红，数字+1
- [ ] **F10**: 再次点击取消点赞，按钮变灰，数字-1
- [ ] **F11**: 网络失败时点赞回滚并提示

### 14.2 性能验收

- [ ] **P1**: Feed首屏加载时间 < 1秒（测试10次取平均）
- [ ] **P2**: Feed聚合查询P95 < 200ms（后端日志统计）
- [ ] **P3**: Feed生成延迟 < 3秒（Session完成到Feed Item创建）
- [ ] **P4**: 点赞响应 < 100ms（乐观UI更新）
- [ ] **P5**: 滚动帧率 60fps（Instruments测试）
- [ ] **P6**: 100并发用户Feed查询成功率 > 99%

### 14.3 数据验收

- [ ] **D1**: Feed Item创建后，相关用户的时间线缓存已清除
- [ ] **D2**: 点赞数与feed_likes表记录一致（允许10秒延迟）
- [ ] **D3**: 重复点赞幂等，不会创建多条记录
- [ ] **D4**: 删除Session后，对应Feed Item自动删除

---

**文档版本**: v1.0
**最后更新**: 2026-02-28
**审批状态**: ✅ 待开发启动
