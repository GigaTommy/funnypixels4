# Module 2: 关注系统 - 完整技术方案

> **模块名称**: 关注系统（用户关注/粉丝/推荐）
> **优先级**: P0（Feed系统的前置依赖）
> **工作量**: 1周（5个工作日）
> **依赖**: 无
> **状态**: 📝 设计中

---

## 目录

1. [产品需求细化](#1-产品需求细化)
2. [系统架构设计](#2-系统架构设计)
3. [数据库设计](#3-数据库设计)
4. [后端API设计](#4-后端api设计)
5. [推荐关注算法](#5-推荐关注算法)
6. [前端UI设计](#6-前端ui设计)
7. [缓存策略](#7-缓存策略)
8. [性能优化](#8-性能优化)
9. [实施步骤](#9-实施步骤)
10. [测试方案](#10-测试方案)
11. [验收标准](#11-验收标准)

---

## 1. 产品需求细化

### 1.1 功能需求

#### FR1: 关注/取关用户

**需求描述**: 用户可以关注和取消关注其他用户

**交互流程**:
1. 点击用户头像/昵称 → 进入用户主页
2. 用户主页显示"关注"按钮（未关注）或"已关注"按钮（已关注）
3. 点击"关注" → 按钮变为"已关注"，关注数+1
4. 点击"已关注" → 弹出确认弹窗 → 确认后取消关注

**按钮状态**:

| 状态 | 按钮文字 | 按钮样式 | 点击行为 |
|------|---------|---------|---------|
| 未关注 | "关注" | 蓝色实心按钮 | 执行关注 |
| 已关注 | "已关注" | 灰色边框按钮 | 弹出确认弹窗 |
| 互相关注 | "互相关注" | 蓝色边框按钮 + ✓图标 | 弹出确认弹窗 |
| 自己 | - | 隐藏按钮 | - |

**验收标准**:
- [ ] 点击"关注"后立即变为"已关注"（乐观UI更新）
- [ ] 网络失败时回滚UI状态 + Toast提示
- [ ] 取消关注时显示确认弹窗："确定不再关注XXX吗？"
- [ ] 关注数和粉丝数实时更新
- [ ] 无法关注自己（按钮隐藏）

---

#### FR2: 关注列表与粉丝列表

**需求描述**: 用户可以查看自己或他人的关注列表、粉丝列表

**入口**:
- 个人主页 → 点击"关注数" → 进入关注列表页
- 个人主页 → 点击"粉丝数" → 进入粉丝列表页

**列表页结构**:
```
┌────────────────────────────────┐
│ ← 关注列表                      │  ← 导航栏
├────────────────────────────────┤
│  关注 (123) | 粉丝 (456)       │  ← Tab切换器
├────────────────────────────────┤
│  🔍 搜索用户...                 │  ← 搜索框
├────────────────────────────────┤
│  [头像] 张三                    │
│         杭州·像素联盟  [已关注] │
├────────────────────────────────┤
│  [头像] 李四                    │
│         上海·独行侠    [关注]   │
├────────────────────────────────┤
│  ...更多用户...                 │
└────────────────────────────────┘
```

**每个用户卡片包含**:
- 头像（40x40）
- 昵称 + 段位徽章
- 城市 + 联盟名称（如有）
- 关注按钮（状态根据关系显示）

**验收标准**:
- [ ] 默认显示"关注"Tab，显示我关注的人
- [ ] 点击"粉丝"Tab，显示关注我的人
- [ ] 每页显示20个用户，支持无限滚动
- [ ] 搜索框实时过滤（防抖300ms）
- [ ] 互相关注的用户在列表中有"互关"标记
- [ ] 点击用户卡片跳转到该用户主页

---

#### FR3: 推荐关注

**需求描述**: 为新用户推荐值得关注的活跃玩家

**推荐入口**:
1. 新用户注册后引导页："推荐关注本地活跃玩家"
2. 关注列表为空时："推荐一些有趣的玩家"
3. "我的"Tab → "推荐关注"菜单项

**推荐策略（优先级递减）**:
1. **同城活跃用户**（50km内，总像素数Top 10）
2. **同联盟用户**（如果已加入联盟，Top 5）
3. **全站Top用户**（总像素数Top 10）

**推荐卡片**:
```
┌────────────────────────────────┐
│ 推荐关注                        │
├────────────────────────────────┤
│  [头像] 张三      同城活跃玩家  │
│         总像素: 12,345  [关注] │
├────────────────────────────────┤
│  [头像] 李四      同联盟成员    │
│         总像素: 9,876   [关注] │
└────────────────────────────────┘
```

**验收标准**:
- [ ] 推荐用户不包括已关注的人
- [ ] 推荐用户不包括自己
- [ ] 推荐理由清晰（同城/同联盟/全站Top）
- [ ] 一次最多推荐10个用户
- [ ] 点击"关注"后该用户从推荐列表移除

---

#### FR4: 关注关系查询（API支持）

**需求描述**: 其他模块需要查询用户的关注关系

**支持的查询**:
- 获取用户A的所有关注列表（ID数组）
- 获取用户A的所有粉丝列表（ID数组）
- 判断用户A是否关注用户B（布尔值）
- 判断用户A和用户B是否互相关注（布尔值）
- 批量查询：用户A与用户列表[B, C, D]的关注关系

**用途**:
- **Feed系统**: 查询关注列表，过滤"关注"筛选器
- **用户主页**: 显示关注按钮的正确状态
- **推荐系统**: 排除已关注的用户

---

### 1.2 非功能需求

#### NFR1: 性能

| 指标 | 目标 | 测试方法 |
|------|------|---------|
| 关注/取关响应时间 | < 200ms | 乐观UI更新 |
| 关注列表加载时间 | < 500ms | 首页20条 |
| 推荐关注计算时间 | < 1秒 | 后端API P95 |
| 批量关系查询 | < 100ms | Redis缓存命中 |

#### NFR2: 可扩展性

- [ ] user_follows表支持100万+条记录
- [ ] 关注列表查询支持1000+并发
- [ ] 推荐算法支持10,000+活跃用户

#### NFR3: 数据一致性

- [ ] 关注关系唯一约束（防止重复关注）
- [ ] 关注数与实际记录最终一致（允许10秒延迟）
- [ ] 用户删除后，关注关系自动删除（级联）

---

## 2. 系统架构设计

### 2.1 整体架构

```
┌─────────────────────────────────────────────────────────┐
│                     iOS App (Client)                     │
├─────────────────────────────────────────────────────────┤
│  UserProfileView (用户主页)                              │
│    └─ FollowButton (关注按钮)                            │
│  FollowListView (关注/粉丝列表)                          │
│    ├─ Tab切换器（关注/粉丝）                              │
│    ├─ 搜索框                                             │
│    └─ UserCard (用户卡片)                                │
│  RecommendedUsersView (推荐关注)                         │
└─────────────────────────────────────────────────────────┘
                            ↓ HTTP REST API
┌─────────────────────────────────────────────────────────┐
│                  Backend (Node.js)                       │
├─────────────────────────────────────────────────────────┤
│  followController.js                                     │
│    ├─ POST /api/follows/:userId (关注)                  │
│    ├─ DELETE /api/follows/:userId (取关)                │
│    ├─ GET /api/follows/following (关注列表)             │
│    ├─ GET /api/follows/followers (粉丝列表)             │
│    ├─ GET /api/follows/check/:userId (检查关注状态)     │
│    └─ GET /api/follows/recommended (推荐关注)           │
├─────────────────────────────────────────────────────────┤
│  followService.js                                        │
│    ├─ followUser(followerId, followingId)               │
│    ├─ unfollowUser(followerId, followingId)             │
│    ├─ getFollowing(userId, limit, offset)               │
│    ├─ getFollowers(userId, limit, offset)               │
│    ├─ checkFollowStatus(userId, targetId)               │
│    └─ getRecommendedUsers(userId)                       │
├─────────────────────────────────────────────────────────┤
│  followCacheService.js (Redis)                           │
│    ├─ 关注列表缓存（用户维度）                           │
│    ├─ 关注数/粉丝数缓存                                  │
│    └─ 关注状态缓存                                       │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│              Database (PostgreSQL)                       │
├─────────────────────────────────────────────────────────┤
│  user_follows (关注关系表)                               │
│  users (用户表，已有)                                    │
└─────────────────────────────────────────────────────────┘
```

---

### 2.2 关注流程

```
┌──────────────────────────────────────────────────────┐
│ 1. 用户点击"关注"按钮                                 │
│    FollowButton.onTap()                               │
└────────────────┬─────────────────────────────────────┘
                 ↓
┌────────────────▼─────────────────────────────────────┐
│ 2. 乐观UI更新（立即）                                 │
│    - 按钮文字变为"已关注"                             │
│    - 关注数+1                                         │
└────────────────┬─────────────────────────────────────┘
                 ↓
┌────────────────▼─────────────────────────────────────┐
│ 3. 发送API请求                                        │
│    POST /api/follows/:userId                          │
└────────────────┬─────────────────────────────────────┘
                 ↓
┌────────────────▼─────────────────────────────────────┐
│ 4. 后端处理                                           │
│    - 检查是否已关注（幂等性）                         │
│    - 插入user_follows记录                             │
│    - 更新users.following_count（follower）           │
│    - 更新users.followers_count（following）          │
└────────────────┬─────────────────────────────────────┘
                 ↓
┌────────────────▼─────────────────────────────────────┐
│ 5. 清除相关缓存                                       │
│    - 清除follower的关注列表缓存                       │
│    - 清除following的粉丝列表缓存                      │
│    - 清除关注状态缓存                                 │
└────────────────┬─────────────────────────────────────┘
                 ↓
┌────────────────▼─────────────────────────────────────┐
│ 6. 返回结果 + 前端确认                                │
│    - 成功: UI保持更新状态                             │
│    - 失败: 回滚UI + Toast提示                         │
└──────────────────────────────────────────────────────┘
```

---

## 3. 数据库设计

### 3.1 user_follows表（关注关系表）

**用途**: 记录用户之间的关注关系（单向）

```sql
CREATE TABLE user_follows (
  -- 主键
  id SERIAL PRIMARY KEY,

  -- 关注者（发起关注的人）
  follower_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- 被关注者（被关注的人）
  following_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- 时间戳
  created_at TIMESTAMP DEFAULT NOW(),

  -- 唯一约束（同一对关系只能存在一次）
  UNIQUE (follower_id, following_id),

  -- 索引
  INDEX idx_follower (follower_id),
  INDEX idx_following (following_id),
  INDEX idx_created (created_at DESC)
);

-- 防止自己关注自己的约束
ALTER TABLE user_follows
  ADD CONSTRAINT check_no_self_follow
  CHECK (follower_id != following_id);
```

**字段说明**:

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | SERIAL | 主键 |
| `follower_id` | INTEGER | 关注者ID（外键 → users.id） |
| `following_id` | INTEGER | 被关注者ID（外键 → users.id） |
| `created_at` | TIMESTAMP | 关注时间 |

**约束**:
1. `UNIQUE (follower_id, following_id)` - 防止重复关注
2. `CHECK (follower_id != following_id)` - 防止自己关注自己
3. `ON DELETE CASCADE` - 用户删除时自动删除关注关系

**索引策略**:
1. `idx_follower`: 查询"我关注的人"（`WHERE follower_id = ?`）
2. `idx_following`: 查询"关注我的人"（`WHERE following_id = ?`）
3. `idx_created`: 按时间排序最近关注

**估算容量**:
- 假设10,000活跃用户，平均每人关注50人
- 总记录数: 10,000 × 50 = 500,000条
- 3年数据: 假设用户持续增长，约100万条
- 单表可承受

---

### 3.2 users表扩展（关注数/粉丝数字段）

**现有users表需要添加的字段**:

```sql
ALTER TABLE users
  ADD COLUMN following_count INTEGER DEFAULT 0,
  ADD COLUMN followers_count INTEGER DEFAULT 0;

-- 创建索引（用于排序）
CREATE INDEX idx_followers_count ON users(followers_count DESC);
```

**字段说明**:

| 字段 | 类型 | 说明 |
|------|------|------|
| `following_count` | INTEGER | 我关注的人数（缓存） |
| `followers_count` | INTEGER | 关注我的人数（缓存） |

**为什么缓存计数？**
- 频繁查询：个人主页需要显示关注数/粉丝数
- 性能优化：避免每次都`COUNT(*) FROM user_follows`
- 最终一致性：通过触发器或定时任务同步

**同步策略**:
- **方案A: 触发器**（推荐，实时同步）
- **方案B: 应用层更新**（关注时手动+1/-1）
- **方案C: 定时任务**（每小时重新计算）

---

### 3.3 触发器实现（自动更新计数）

**触发器1: 关注时更新计数**

```sql
CREATE OR REPLACE FUNCTION update_follow_counts_on_insert()
RETURNS TRIGGER AS $$
BEGIN
  -- 关注者的following_count +1
  UPDATE users
  SET following_count = following_count + 1
  WHERE id = NEW.follower_id;

  -- 被关注者的followers_count +1
  UPDATE users
  SET followers_count = followers_count + 1
  WHERE id = NEW.following_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_follow_insert
AFTER INSERT ON user_follows
FOR EACH ROW
EXECUTE FUNCTION update_follow_counts_on_insert();
```

**触发器2: 取关时更新计数**

```sql
CREATE OR REPLACE FUNCTION update_follow_counts_on_delete()
RETURNS TRIGGER AS $$
BEGIN
  -- 关注者的following_count -1
  UPDATE users
  SET following_count = GREATEST(following_count - 1, 0)
  WHERE id = OLD.follower_id;

  -- 被关注者的followers_count -1
  UPDATE users
  SET followers_count = GREATEST(followers_count - 1, 0)
  WHERE id = OLD.following_id;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_follow_delete
AFTER DELETE ON user_follows
FOR EACH ROW
EXECUTE FUNCTION update_follow_counts_on_delete();
```

**注意**: `GREATEST(count - 1, 0)` 防止计数为负数

---

### 3.4 迁移脚本

**文件**: `backend/src/database/migrations/20260228130000_create_follow_system.js`

```javascript
exports.up = function(knex) {
  return knex.schema
    // 1. 创建user_follows表
    .createTable('user_follows', (table) => {
      table.increments('id').primary();
      table.integer('follower_id').unsigned().notNullable()
        .references('id').inTable('users').onDelete('CASCADE');
      table.integer('following_id').unsigned().notNullable()
        .references('id').inTable('users').onDelete('CASCADE');
      table.timestamp('created_at').defaultTo(knex.fn.now());

      // 唯一约束
      table.unique(['follower_id', 'following_id']);

      // 索引
      table.index('follower_id', 'idx_follower');
      table.index('following_id', 'idx_following');
      table.index('created_at', 'idx_created');
    })
    // 2. 添加防止自己关注自己的约束
    .then(() => {
      return knex.raw(`
        ALTER TABLE user_follows
        ADD CONSTRAINT check_no_self_follow
        CHECK (follower_id != following_id)
      `);
    })
    // 3. 扩展users表（关注数/粉丝数）
    .then(() => {
      return knex.schema.table('users', (table) => {
        table.integer('following_count').defaultTo(0);
        table.integer('followers_count').defaultTo(0);
      });
    })
    // 4. 创建索引
    .then(() => {
      return knex.raw('CREATE INDEX idx_followers_count ON users(followers_count DESC)');
    })
    // 5. 创建触发器（关注时更新计数）
    .then(() => {
      return knex.raw(`
        CREATE OR REPLACE FUNCTION update_follow_counts_on_insert()
        RETURNS TRIGGER AS $$
        BEGIN
          UPDATE users SET following_count = following_count + 1 WHERE id = NEW.follower_id;
          UPDATE users SET followers_count = followers_count + 1 WHERE id = NEW.following_id;
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;

        CREATE TRIGGER trigger_follow_insert
        AFTER INSERT ON user_follows
        FOR EACH ROW
        EXECUTE FUNCTION update_follow_counts_on_insert();
      `);
    })
    // 6. 创建触发器（取关时更新计数）
    .then(() => {
      return knex.raw(`
        CREATE OR REPLACE FUNCTION update_follow_counts_on_delete()
        RETURNS TRIGGER AS $$
        BEGIN
          UPDATE users SET following_count = GREATEST(following_count - 1, 0) WHERE id = OLD.follower_id;
          UPDATE users SET followers_count = GREATEST(followers_count - 1, 0) WHERE id = OLD.following_id;
          RETURN OLD;
        END;
        $$ LANGUAGE plpgsql;

        CREATE TRIGGER trigger_follow_delete
        AFTER DELETE ON user_follows
        FOR EACH ROW
        EXECUTE FUNCTION update_follow_counts_on_delete();
      `);
    });
};

exports.down = function(knex) {
  return knex.raw('DROP TRIGGER IF EXISTS trigger_follow_delete ON user_follows')
    .then(() => knex.raw('DROP TRIGGER IF EXISTS trigger_follow_insert ON user_follows'))
    .then(() => knex.raw('DROP FUNCTION IF EXISTS update_follow_counts_on_delete()'))
    .then(() => knex.raw('DROP FUNCTION IF EXISTS update_follow_counts_on_insert()'))
    .then(() => knex.schema.table('users', (table) => {
      table.dropColumn('following_count');
      table.dropColumn('followers_count');
    }))
    .then(() => knex.schema.dropTableIfExists('user_follows'));
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
| POST | `/api/follows/:userId` | 关注用户 | 必须 | P0 |
| DELETE | `/api/follows/:userId` | 取消关注 | 必须 | P0 |
| GET | `/api/follows/following` | 我的关注列表 | 必须 | P0 |
| GET | `/api/follows/followers` | 我的粉丝列表 | 必须 | P0 |
| GET | `/api/follows/check/:userId` | 检查关注状态 | 必须 | P0 |
| GET | `/api/follows/recommended` | 推荐关注 | 必须 | P0 |
| GET | `/api/users/:userId/following` | 查看他人的关注列表 | 可选 | P1 |
| GET | `/api/users/:userId/followers` | 查看他人的粉丝列表 | 可选 | P1 |

---

### 4.2 POST /api/follows/:userId - 关注用户

**端点**: `POST /api/follows/:userId`

**路径参数**:

| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `userId` | Integer | 是 | 要关注的用户ID |

**请求示例**:
```http
POST /api/follows/456
Authorization: Bearer <token>
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "follower_id": 123,
    "following_id": 456,
    "is_following": true,
    "is_mutual": false,
    "created_at": "2026-02-28T10:30:00Z"
  }
}
```

**错误响应**:

| HTTP状态码 | 错误码 | 描述 |
|-----------|--------|------|
| 400 | `CANNOT_FOLLOW_SELF` | 不能关注自己 |
| 404 | `USER_NOT_FOUND` | 目标用户不存在 |
| 409 | `ALREADY_FOLLOWING` | 已经关注过（幂等性，返回成功） |

---

### 4.3 DELETE /api/follows/:userId - 取消关注

**端点**: `DELETE /api/follows/:userId`

**请求示例**:
```http
DELETE /api/follows/456
Authorization: Bearer <token>
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "follower_id": 123,
    "following_id": 456,
    "is_following": false,
    "is_mutual": false
  }
}
```

---

### 4.4 GET /api/follows/following - 我的关注列表

**端点**: `GET /api/follows/following`

**Query参数**:

| 参数 | 类型 | 必填 | 默认值 | 描述 |
|------|------|------|--------|------|
| `limit` | Integer | 否 | `20` | 每页条数 |
| `offset` | Integer | 否 | `0` | 偏移量 |
| `search` | String | 否 | - | 搜索关键词（昵称） |

**请求示例**:
```http
GET /api/follows/following?limit=20&offset=0&search=张三
Authorization: Bearer <token>
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": 456,
        "username": "张三",
        "avatar_url": "https://cdn.funnypixels.com/avatars/456.png",
        "city": "杭州",
        "alliance": {
          "id": 10,
          "name": "像素联盟",
          "flag_pattern_id": "emoji_cn"
        },
        "total_pixels": 12345,
        "is_following": true,
        "is_follower": false,
        "is_mutual": false,
        "followed_at": "2026-02-28T10:30:00Z"
      }
    ],
    "pagination": {
      "total": 123,
      "limit": 20,
      "offset": 0,
      "has_more": true
    }
  }
}
```

---

### 4.5 GET /api/follows/followers - 我的粉丝列表

**端点**: `GET /api/follows/followers`

**Query参数**: 同上（limit/offset/search）

**响应格式**: 同上

---

### 4.6 GET /api/follows/check/:userId - 检查关注状态

**端点**: `GET /api/follows/check/:userId`

**用途**: 查询当前用户与目标用户的关注关系

**请求示例**:
```http
GET /api/follows/check/456
Authorization: Bearer <token>
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "user_id": 456,
    "is_following": true,
    "is_follower": false,
    "is_mutual": false
  }
}
```

**字段说明**:
- `is_following`: 我是否关注了对方
- `is_follower`: 对方是否关注了我
- `is_mutual`: 是否互相关注

---

### 4.7 GET /api/follows/recommended - 推荐关注

**端点**: `GET /api/follows/recommended`

**Query参数**:

| 参数 | 类型 | 必填 | 默认值 | 描述 |
|------|------|------|--------|------|
| `limit` | Integer | 否 | `10` | 推荐用户数量 |

**请求示例**:
```http
GET /api/follows/recommended?limit=10
Authorization: Bearer <token>
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": 789,
        "username": "李四",
        "avatar_url": "https://cdn.funnypixels.com/avatars/789.png",
        "city": "杭州",
        "total_pixels": 23456,
        "recommendation_reason": "same_city",
        "recommendation_reason_text": "同城活跃玩家"
      },
      {
        "id": 101112,
        "username": "王五",
        "avatar_url": "https://cdn.funnypixels.com/avatars/101112.png",
        "alliance": {
          "id": 10,
          "name": "像素联盟"
        },
        "total_pixels": 19876,
        "recommendation_reason": "same_alliance",
        "recommendation_reason_text": "同联盟成员"
      }
    ]
  }
}
```

**推荐理由枚举**:
- `same_city`: 同城活跃玩家
- `same_alliance`: 同联盟成员
- `top_user`: 全站Top用户

---

## 5. 推荐关注算法

### 5.1 推荐策略

**文件**: `backend/src/services/followService.js`

```javascript
const db = require('../config/database');
const redis = require('../config/redis');

/**
 * 获取推荐关注用户
 * @param {Number} userId - 当前用户ID
 * @param {Number} limit - 推荐数量（默认10）
 * @returns {Promise<Array>} 推荐用户列表
 */
async function getRecommendedUsers(userId, limit = 10) {
  // 1. 获取当前用户信息
  const currentUser = await db('users')
    .where({ id: userId })
    .first();

  if (!currentUser) {
    throw new Error('用户不存在');
  }

  // 2. 获取已关注的用户ID（排除）
  const followingIds = await db('user_follows')
    .where({ follower_id: userId })
    .pluck('following_id');

  // 3. 推荐用户列表
  let recommended = [];

  // 策略1: 同城活跃用户（50km内，Top 10）
  if (currentUser.last_known_location) {
    const nearbyUsers = await db('users')
      .select('id', 'username', 'avatar_url', 'city', 'total_pixels')
      .where('id', '!=', userId)
      .whereNotIn('id', followingIds)
      .whereRaw(
        `ST_DWithin(last_known_location, ST_SetSRID(ST_MakePoint(?, ?), 4326)::geography, ?)`,
        [
          currentUser.last_known_location.coordinates[0], // lng
          currentUser.last_known_location.coordinates[1], // lat
          50000 // 50km
        ]
      )
      .orderBy('total_pixels', 'desc')
      .limit(10);

    recommended = recommended.concat(nearbyUsers.map(u => ({
      ...u,
      recommendation_reason: 'same_city',
      recommendation_reason_text: '同城活跃玩家'
    })));
  }

  // 策略2: 同联盟成员（如果已加入联盟，Top 5）
  const userAlliance = await db('alliance_members')
    .where({ user_id: userId })
    .first();

  if (userAlliance) {
    const allianceUsers = await db('alliance_members')
      .join('users', 'alliance_members.user_id', 'users.id')
      .join('alliances', 'alliance_members.alliance_id', 'alliances.id')
      .where('alliance_members.alliance_id', userAlliance.alliance_id)
      .where('users.id', '!=', userId)
      .whereNotIn('users.id', followingIds)
      .select(
        'users.id',
        'users.username',
        'users.avatar_url',
        'users.total_pixels',
        'alliances.id as alliance_id',
        'alliances.name as alliance_name'
      )
      .orderBy('users.total_pixels', 'desc')
      .limit(5);

    recommended = recommended.concat(allianceUsers.map(u => ({
      id: u.id,
      username: u.username,
      avatar_url: u.avatar_url,
      total_pixels: u.total_pixels,
      alliance: {
        id: u.alliance_id,
        name: u.alliance_name
      },
      recommendation_reason: 'same_alliance',
      recommendation_reason_text: '同联盟成员'
    })));
  }

  // 策略3: 全站Top用户（Top 10）
  if (recommended.length < limit) {
    const topUsers = await db('users')
      .select('id', 'username', 'avatar_url', 'city', 'total_pixels')
      .where('id', '!=', userId)
      .whereNotIn('id', followingIds.concat(recommended.map(u => u.id)))
      .orderBy('total_pixels', 'desc')
      .limit(10);

    recommended = recommended.concat(topUsers.map(u => ({
      ...u,
      recommendation_reason: 'top_user',
      recommendation_reason_text: '全站活跃玩家'
    })));
  }

  // 4. 去重 + 限制数量
  const seen = new Set();
  const uniqueRecommended = recommended.filter(u => {
    if (seen.has(u.id)) return false;
    seen.add(u.id);
    return true;
  }).slice(0, limit);

  return uniqueRecommended;
}

module.exports = {
  getRecommendedUsers
};
```

---

### 5.2 推荐优化

**缓存推荐结果**:

```javascript
async function getRecommendedUsers(userId, limit = 10) {
  // 1. 检查Redis缓存
  const cacheKey = `follow:recommended:${userId}`;
  const cached = await redis.get(cacheKey);

  if (cached) {
    return JSON.parse(cached);
  }

  // 2. 计算推荐（原逻辑）
  const recommended = await calculateRecommended(userId, limit);

  // 3. 写入Redis缓存（TTL=1小时）
  await redis.setex(cacheKey, 3600, JSON.stringify(recommended));

  return recommended;
}
```

**定时预计算**（可选优化）:

```javascript
// 定时任务：每天0点为活跃用户预计算推荐
const cron = require('node-cron');

cron.schedule('0 0 * * *', async () => {
  console.log('开始预计算推荐关注...');

  const activeUsers = await db('users')
    .where('last_active_at', '>', db.raw("NOW() - INTERVAL '7 days'"))
    .select('id');

  for (const user of activeUsers) {
    try {
      await getRecommendedUsers(user.id);
      console.log(`用户${user.id}推荐计算完成`);
    } catch (error) {
      console.error(`用户${user.id}推荐计算失败:`, error);
    }
  }

  console.log('推荐关注预计算完成');
});
```

---

## 6. 前端UI设计

### 6.1 FollowButton（关注按钮组件）

**文件**: `FunnyPixelsApp/Views/Components/FollowButton.swift`

```swift
import SwiftUI

struct FollowButton: View {
    let userId: Int
    @StateObject private var viewModel: FollowButtonViewModel

    init(userId: Int, initialFollowState: FollowState? = nil) {
        self.userId = userId
        self._viewModel = StateObject(wrappedValue: FollowButtonViewModel(
            userId: userId,
            initialState: initialFollowState
        ))
    }

    var body: some View {
        Button(action: {
            viewModel.toggleFollow()
        }) {
            HStack(spacing: 4) {
                if viewModel.followState.isMutual {
                    Image(systemName: "checkmark")
                        .font(.caption)
                }

                Text(viewModel.followState.buttonText)
                    .font(.subheadline)
                    .fontWeight(.medium)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 8)
            .background(viewModel.followState.buttonColor)
            .foregroundColor(viewModel.followState.textColor)
            .cornerRadius(8)
        }
        .disabled(viewModel.isLoading)
        .confirmationDialog(
            "确定不再关注\(viewModel.username ?? "该用户")吗？",
            isPresented: $viewModel.showUnfollowConfirm,
            titleVisibility: .visible
        ) {
            Button("取消关注", role: .destructive) {
                viewModel.confirmUnfollow()
            }
            Button("取消", role: .cancel) {}
        }
    }
}

// MARK: - ViewModel

class FollowButtonViewModel: ObservableObject {
    @Published var followState: FollowState
    @Published var isLoading = false
    @Published var showUnfollowConfirm = false

    let userId: Int
    var username: String?

    private let followService = FollowService.shared

    init(userId: Int, initialState: FollowState? = nil) {
        self.userId = userId
        self.followState = initialState ?? .notFollowing
    }

    func toggleFollow() {
        if followState.isFollowing {
            // 已关注 → 弹出确认弹窗
            showUnfollowConfirm = true
        } else {
            // 未关注 → 直接关注
            performFollow()
        }
    }

    func confirmUnfollow() {
        performUnfollow()
    }

    private func performFollow() {
        // 乐观UI更新
        let previousState = followState
        followState = .following

        isLoading = true

        followService.followUser(userId: userId)
            .receive(on: DispatchQueue.main)
            .sink { [weak self] completion in
                self?.isLoading = false

                if case .failure(let error) = completion {
                    print("关注失败:", error)
                    // 回滚UI
                    self?.followState = previousState

                    // TODO: 显示错误Toast
                }
            } receiveValue: { [weak self] response in
                // 使用服务器返回的准确状态
                self?.followState = FollowState.from(response)
            }
            .store(in: &cancellables)
    }

    private func performUnfollow() {
        let previousState = followState
        followState = .notFollowing

        isLoading = true

        followService.unfollowUser(userId: userId)
            .receive(on: DispatchQueue.main)
            .sink { [weak self] completion in
                self?.isLoading = false

                if case .failure(let error) = completion {
                    print("取关失败:", error)
                    self?.followState = previousState
                }
            } receiveValue: { [weak self] response in
                self?.followState = FollowState.from(response)
            }
            .store(in: &cancellables)
    }

    private var cancellables = Set<AnyCancellable>()
}

// MARK: - FollowState

enum FollowState {
    case notFollowing
    case following
    case mutual

    var isFollowing: Bool {
        self == .following || self == .mutual
    }

    var isMutual: Bool {
        self == .mutual
    }

    var buttonText: String {
        switch self {
        case .notFollowing: return "关注"
        case .following: return "已关注"
        case .mutual: return "互相关注"
        }
    }

    var buttonColor: Color {
        switch self {
        case .notFollowing: return .blue
        case .following, .mutual: return Color(.systemGray5)
        }
    }

    var textColor: Color {
        switch self {
        case .notFollowing: return .white
        case .following, .mutual: return .primary
        }
    }

    static func from(_ response: FollowResponse) -> FollowState {
        if response.isMutual {
            return .mutual
        } else if response.isFollowing {
            return .following
        } else {
            return .notFollowing
        }
    }
}
```

---

### 6.2 FollowListView（关注/粉丝列表）

**文件**: `FunnyPixelsApp/Views/FollowTab/FollowListView.swift`

```swift
import SwiftUI

struct FollowListView: View {
    let userId: Int
    @State private var selectedTab: FollowListTab = .following
    @StateObject private var viewModel: FollowListViewModel

    init(userId: Int, initialTab: FollowListTab = .following) {
        self.userId = userId
        self._selectedTab = State(initialValue: initialTab)
        self._viewModel = StateObject(wrappedValue: FollowListViewModel(userId: userId))
    }

    var body: some View {
        VStack(spacing: 0) {
            // Tab切换器
            Picker("", selection: $selectedTab) {
                Text("关注 (\(viewModel.followingCount))").tag(FollowListTab.following)
                Text("粉丝 (\(viewModel.followersCount))").tag(FollowListTab.followers)
            }
            .pickerStyle(.segmented)
            .padding()

            // 搜索框
            SearchBar(text: $viewModel.searchText, placeholder: "搜索用户...")
                .padding(.horizontal)

            // 用户列表
            ScrollView {
                LazyVStack(spacing: 12) {
                    ForEach(currentUsers) { user in
                        UserCard(user: user)
                            .onAppear {
                                if viewModel.shouldLoadMore(currentUser: user) {
                                    viewModel.loadMore(tab: selectedTab)
                                }
                            }
                    }

                    if viewModel.isLoadingMore {
                        ProgressView()
                            .padding()
                    }

                    if !viewModel.hasMore && !currentUsers.isEmpty {
                        Text("没有更多了")
                            .foregroundColor(.secondary)
                            .padding()
                    }
                }
                .padding(.horizontal)
            }
            .refreshable {
                await viewModel.refresh(tab: selectedTab)
            }

            // 空状态
            if currentUsers.isEmpty && !viewModel.isLoading {
                EmptyFollowListView(tab: selectedTab)
            }
        }
        .navigationTitle(selectedTab == .following ? "关注列表" : "粉丝列表")
        .onAppear {
            viewModel.loadInitial(tab: selectedTab)
        }
        .onChange(of: selectedTab) { newTab in
            viewModel.loadInitial(tab: newTab)
        }
    }

    private var currentUsers: [FollowUser] {
        selectedTab == .following ? viewModel.followingUsers : viewModel.followersUsers
    }
}

enum FollowListTab {
    case following
    case followers
}
```

---

### 6.3 UserCard（用户卡片）

**文件**: `FunnyPixelsApp/Views/Components/UserCard.swift`

```swift
import SwiftUI

struct UserCard: View {
    let user: FollowUser

    var body: some View {
        NavigationLink(destination: UserProfileView(userId: user.id)) {
            HStack(spacing: 12) {
                // 头像
                AsyncImage(url: URL(string: user.avatarUrl ?? "")) { image in
                    image.resizable()
                } placeholder: {
                    Circle().fill(Color.gray.opacity(0.3))
                }
                .frame(width: 40, height: 40)
                .clipShape(Circle())

                // 用户信息
                VStack(alignment: .leading, spacing: 4) {
                    HStack(spacing: 4) {
                        Text(user.username)
                            .font(.subheadline)
                            .fontWeight(.semibold)

                        // 联盟旗帜（如有）
                        if let alliance = user.alliance {
                            SmallAllianceFlagBadge(patternId: alliance.flagPatternId)
                        }
                    }

                    HStack(spacing: 8) {
                        if let city = user.city {
                            Text(city)
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }

                        if let alliance = user.alliance {
                            Text(alliance.name)
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                    }
                }

                Spacer()

                // 关注按钮
                FollowButton(
                    userId: user.id,
                    initialFollowState: FollowState.from(user)
                )
            }
            .padding()
            .background(Color(.systemBackground))
            .cornerRadius(12)
            .shadow(color: Color.black.opacity(0.05), radius: 2, x: 0, y: 1)
        }
        .buttonStyle(.plain)
    }
}
```

---

## 7. 缓存策略

### 7.1 Redis缓存键设计

| 缓存键 | 值类型 | TTL | 示例 |
|--------|-------|-----|------|
| `follow:following:{userId}` | Set | 1小时 | 我关注的用户ID集合 |
| `follow:followers:{userId}` | Set | 1小时 | 关注我的用户ID集合 |
| `follow:status:{userId}:{targetId}` | String (JSON) | 10分钟 | 关注状态缓存 |
| `follow:recommended:{userId}` | String (JSON) | 1小时 | 推荐关注列表 |

---

### 7.2 缓存失效策略

**写入时失效（Write-Through）**:

| 操作 | 失效缓存 |
|------|---------|
| 关注 | 清除`follow:following:{followerId}` + `follow:followers:{followingId}` |
| 取关 | 清除`follow:following:{followerId}` + `follow:followers:{followingId}` |
| 关注状态查询 | 更新`follow:status:{userId}:{targetId}` |

---

## 8. 性能优化

### 8.1 批量查询关注状态

**场景**: Feed列表需要批量查询当前用户与每个Feed作者的关注关系

**优化前（N次查询）**:
```javascript
for (const feedItem of feedItems) {
  const isFollowing = await db('user_follows')
    .where({ follower_id: currentUserId, following_id: feedItem.user_id })
    .first();
}
```

**优化后（1次查询）**:
```javascript
const userIds = feedItems.map(item => item.user_id);
const followRelations = await db('user_follows')
  .where('follower_id', currentUserId)
  .whereIn('following_id', userIds)
  .pluck('following_id');

const followingSet = new Set(followRelations);

feedItems.forEach(item => {
  item.is_following = followingSet.has(item.user_id);
});
```

---

### 8.2 Redis缓存关注列表

**文件**: `backend/src/services/followCacheService.js`

```javascript
const redis = require('../config/redis');
const db = require('../config/database');

/**
 * 获取用户的关注列表（带缓存）
 * @param {Number} userId - 用户ID
 * @returns {Promise<Array<Number>>} 关注的用户ID数组
 */
async function getFollowingIds(userId) {
  const cacheKey = `follow:following:${userId}`;

  // 1. 尝试从Redis获取
  const cached = await redis.smembers(cacheKey);

  if (cached && cached.length > 0) {
    return cached.map(id => parseInt(id));
  }

  // 2. 从DB查询
  const followingIds = await db('user_follows')
    .where({ follower_id: userId })
    .pluck('following_id');

  // 3. 写入Redis（TTL=1小时）
  if (followingIds.length > 0) {
    await redis.sadd(cacheKey, ...followingIds);
    await redis.expire(cacheKey, 3600);
  }

  return followingIds;
}

/**
 * 清除用户的关注列表缓存
 * @param {Number} userId - 用户ID
 */
async function clearFollowingCache(userId) {
  await redis.del(`follow:following:${userId}`);
}

module.exports = {
  getFollowingIds,
  clearFollowingCache
};
```

---

## 9. 实施步骤

### 9.1 任务拆解

| Task ID | 任务描述 | 工作量 | 依赖 | 负责人 | 优先级 |
|---------|---------|-------|------|-------|--------|
| **后端（3-4天）** |
| T2.1 | 创建user_follows表（迁移脚本+触发器） | 3h | - | Backend | P0 |
| T2.2 | followService.followUser（关注逻辑） | 2h | T2.1 | Backend | P0 |
| T2.3 | followService.unfollowUser（取关逻辑） | 2h | T2.1 | Backend | P0 |
| T2.4 | followService.getFollowing/Followers（列表查询） | 3h | T2.1 | Backend | P0 |
| T2.5 | followService.checkFollowStatus（状态查询） | 2h | T2.1 | Backend | P0 |
| T2.6 | followService.getRecommendedUsers（推荐算法） | 4h | T2.1 | Backend | P0 |
| T2.7 | followController（API端点） | 3h | T2.2-T2.6 | Backend | P0 |
| T2.8 | followCacheService（Redis缓存） | 3h | T2.4 | Backend | P0 |
| T2.9 | 单元测试 | 4h | T2.2-T2.7 | Backend | P0 |
| **前端 iOS（2-3天）** |
| T2.10 | FollowUser模型 | 1h | - | iOS | P0 |
| T2.11 | FollowService（API调用） | 3h | T2.10 | iOS | P0 |
| T2.12 | FollowButton组件 | 4h | T2.11 | iOS | P0 |
| T2.13 | FollowButtonViewModel | 3h | T2.11 | iOS | P0 |
| T2.14 | UserCard组件 | 2h | T2.10 | iOS | P0 |
| T2.15 | FollowListView（关注/粉丝列表） | 4h | T2.14 | iOS | P0 |
| T2.16 | FollowListViewModel | 3h | T2.11 | iOS | P0 |
| T2.17 | EmptyFollowListView（空状态） | 1h | - | iOS | P0 |
| T2.18 | UI测试 | 2h | T2.12-T2.17 | iOS | P0 |
| **联调与测试（1天）** |
| T2.19 | 前后端联调 | 4h | All | Both | P0 |
| T2.20 | 性能测试 | 2h | T2.19 | QA | P0 |
| T2.21 | 用户验收测试 | 2h | T2.19 | QA | P0 |
| **总计** | **~51小时** | **6-7个工作日** |

---

### 9.2 里程碑

**Milestone 1: 后端基础（Day 1-2）**
- [ ] T2.1 - T2.5完成
- [ ] 验收: Postman可以关注/取关/查询列表

**Milestone 2: 推荐算法与缓存（Day 3）**
- [ ] T2.6 - T2.8完成
- [ ] 验收: 推荐关注返回正确用户，Redis缓存命中

**Milestone 3: 前端UI（Day 4-5）**
- [ ] T2.10 - T2.17完成
- [ ] 验收: iOS可以关注/取关，查看列表

**Milestone 4: 测试与上线（Day 6）**
- [ ] T2.19 - T2.21完成
- [ ] 验收: 所有测试通过，准备合并

---

### 9.3 每日计划

**Day 1（后端基础）**:
- 上午: T2.1（数据库迁移）
- 下午: T2.2 - T2.3（关注/取关逻辑）

**Day 2（后端查询）**:
- 上午: T2.4 - T2.5（列表查询、状态查询）
- 下午: T2.6（推荐算法）

**Day 3（后端完善）**:
- 上午: T2.7（API控制器）
- 下午: T2.8 - T2.9（缓存 + 测试）

**Day 4（前端基础）**:
- 上午: T2.10 - T2.11（模型 + Service）
- 下午: T2.12 - T2.13（FollowButton）

**Day 5（前端列表）**:
- 上午: T2.14 - T2.16（列表页面）
- 下午: T2.17 - T2.18（空状态 + UI测试）

**Day 6（联调）**:
- 上午: T2.19（前后端联调）
- 下午: T2.20 - T2.21（性能测试 + 验收）

---

## 10. 测试方案

### 10.1 后端单元测试

**文件**: `backend/tests/services/followService.test.js`

```javascript
const { expect } = require('chai');
const followService = require('../../src/services/followService');
const db = require('../../src/config/database');

describe('FollowService', () => {
  let user1, user2;

  before(async () => {
    user1 = await db('users').insert({ username: 'user1' }).returning('*').then(r => r[0]);
    user2 = await db('users').insert({ username: 'user2' }).returning('*').then(r => r[0]);
  });

  after(async () => {
    await db('user_follows').delete();
    await db('users').whereIn('id', [user1.id, user2.id]).delete();
  });

  describe('followUser', () => {
    it('应该成功关注用户', async () => {
      const result = await followService.followUser(user1.id, user2.id);
      expect(result.is_following).to.be.true;

      const follow = await db('user_follows')
        .where({ follower_id: user1.id, following_id: user2.id })
        .first();
      expect(follow).to.exist;
    });

    it('应该防止重复关注（幂等性）', async () => {
      await followService.followUser(user1.id, user2.id);
      const result = await followService.followUser(user1.id, user2.id);
      expect(result.is_following).to.be.true;
    });

    it('应该防止自己关注自己', async () => {
      try {
        await followService.followUser(user1.id, user1.id);
        expect.fail('应该抛出错误');
      } catch (error) {
        expect(error.message).to.include('自己');
      }
    });

    it('应该更新关注数/粉丝数', async () => {
      await followService.followUser(user1.id, user2.id);

      const follower = await db('users').where({ id: user1.id }).first();
      const following = await db('users').where({ id: user2.id }).first();

      expect(follower.following_count).to.be.greaterThan(0);
      expect(following.followers_count).to.be.greaterThan(0);
    });
  });

  describe('unfollowUser', () => {
    beforeEach(async () => {
      await followService.followUser(user1.id, user2.id);
    });

    it('应该成功取消关注', async () => {
      const result = await followService.unfollowUser(user1.id, user2.id);
      expect(result.is_following).to.be.false;

      const follow = await db('user_follows')
        .where({ follower_id: user1.id, following_id: user2.id })
        .first();
      expect(follow).to.not.exist;
    });
  });

  describe('getRecommendedUsers', () => {
    it('应该返回推荐用户', async () => {
      const recommended = await followService.getRecommendedUsers(user1.id);
      expect(recommended).to.be.an('array');
      expect(recommended.length).to.be.greaterThan(0);
      expect(recommended[0]).to.have.property('recommendation_reason');
    });

    it('推荐用户不应包括已关注的人', async () => {
      await followService.followUser(user1.id, user2.id);
      const recommended = await followService.getRecommendedUsers(user1.id);
      const recommendedIds = recommended.map(u => u.id);
      expect(recommendedIds).to.not.include(user2.id);
    });
  });
});
```

---

### 10.2 前端UI测试

**文件**: `FunnyPixelsAppUITests/FollowTests.swift`

```swift
import XCTest

class FollowTests: XCTestCase {
    var app: XCUIApplication!

    override func setUp() {
        super.setUp()
        app = XCUIApplication()
        app.launch()
    }

    func testFollowButton() {
        // 进入其他用户主页
        // (假设有导航路径)

        // 查找关注按钮
        let followButton = app.buttons["关注"]
        XCTAssertTrue(followButton.exists)

        // 点击关注
        followButton.tap()

        // 验证按钮文字变为"已关注"
        XCTAssertTrue(app.buttons["已关注"].exists)
    }

    func testUnfollowConfirmation() {
        // 点击"已关注"按钮
        app.buttons["已关注"].tap()

        // 验证确认弹窗出现
        XCTAssertTrue(app.alerts.firstMatch.exists)

        // 点击"取消关注"
        app.alerts.buttons["取消关注"].tap()

        // 验证按钮变回"关注"
        XCTAssertTrue(app.buttons["关注"].exists)
    }

    func testFollowList() {
        // 进入我的Tab
        app.tabBars.buttons["我的"].tap()

        // 点击关注数
        app.buttons["关注数"].tap()

        // 验证关注列表显示
        XCTAssertTrue(app.navigationBars["关注列表"].exists)

        // 验证Tab切换器
        XCTAssertTrue(app.buttons["关注"].exists)
        XCTAssertTrue(app.buttons["粉丝"].exists)

        // 切换到粉丝Tab
        app.buttons["粉丝"].tap()
        sleep(1)

        // 验证列表存在
        XCTAssertTrue(app.scrollViews.firstMatch.exists)
    }
}
```

---

## 11. 验收标准

### 11.1 功能验收

- [ ] **F1**: 点击"关注"按钮，立即变为"已关注"（乐观UI）
- [ ] **F2**: 网络失败时回滚UI + Toast提示
- [ ] **F3**: 点击"已关注"弹出确认弹窗，确认后取消关注
- [ ] **F4**: 关注数和粉丝数实时更新
- [ ] **F5**: 查看自己的主页，关注按钮隐藏
- [ ] **F6**: 互相关注时显示"互相关注"按钮 + ✓图标
- [ ] **F7**: 关注列表显示我关注的人，每页20条
- [ ] **F8**: 粉丝列表显示关注我的人，每页20条
- [ ] **F9**: 搜索框实时过滤用户（防抖300ms）
- [ ] **F10**: 推荐关注显示10个用户，包含推荐理由
- [ ] **F11**: 推荐用户不包括已关注的人和自己

### 11.2 性能验收

- [ ] **P1**: 关注/取关响应时间 < 200ms（乐观UI）
- [ ] **P2**: 关注列表首页加载 < 500ms
- [ ] **P3**: 推荐关注计算 < 1秒（后端P95）
- [ ] **P4**: 批量关注状态查询 < 100ms（Redis缓存）
- [ ] **P5**: 100并发关注操作成功率 > 99%

### 11.3 数据验收

- [ ] **D1**: 关注关系唯一约束生效（重复关注幂等）
- [ ] **D2**: 关注数与user_follows表记录一致
- [ ] **D3**: 触发器正确更新following_count/followers_count
- [ ] **D4**: 用户删除后，关注关系级联删除

---

**文档版本**: v1.0
**最后更新**: 2026-02-28
**审批状态**: ✅ 待开发启动
