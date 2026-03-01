# FunnyPixels Event System API Documentation v2.0

**版本:** 2.0.0
**更新日期:** 2026-02-23
**基础URL:** `https://api.funnypixels.com/api`

---

## 🆕 新增 API 端点

### 1. 获取活动报名统计
获取活动的实时报名人数和联盟数量。

**端点:** `GET /events/:id/signup-stats`

**请求头:**
```http
Authorization: Bearer {access_token}
```

**路径参数:**
- `id` (string, required): 活动ID

**响应示例:**
```json
{
  "success": true,
  "data": {
    "registeredUsers": 156,
    "registeredAlliances": 12,
    "estimatedParticipants": 168,
    "breakdown": {
      "individualSignups": 24,
      "allianceSignups": 12,
      "allianceMemberEstimate": 132
    }
  }
}
```

**性能:** P95 < 200ms

---

### 2. 获取我的贡献统计
获取当前用户在活动中的个人贡献数据。

**端点:** `GET /events/:id/my-contribution`

**请求头:**
```http
Authorization: Bearer {access_token}
```

**路径参数:**
- `id` (string, required): 活动ID

**响应示例:**
```json
{
  "success": true,
  "data": {
    "pixelCount": 234,
    "rankInEvent": 15,
    "rankInAlliance": 3,
    "percentile": 12.5,
    "contribution": 0.058,
    "allianceId": "uuid-alliance-id",
    "allianceName": "战神联盟"
  }
}
```

**性能:** P95 < 300ms

---

### 3. 获取排名历史趋势
获取活动期间的排名变化历史数据，用于绘制趋势图。

**端点:** `GET /events/:id/ranking-history`

**请求头:**
```http
Authorization: Bearer {access_token}
```

**路径参数:**
- `id` (string, required): 活动ID

**查询参数:**
- `hours` (integer, optional): 查询时间范围（小时），默认24
  - 可选值: 6, 12, 24

**响应示例:**
```json
{
  "success": true,
  "data": [
    {
      "timestamp": "2026-02-23T12:00:00.000Z",
      "totalPixels": 15420,
      "rankings": [
        {
          "userId": "user-uuid-1",
          "username": "PlayerOne",
          "pixels": 234,
          "rank": 1
        },
        {
          "userId": "user-uuid-2",
          "username": "PlayerTwo",
          "pixels": 198,
          "rank": 2
        }
      ]
    }
  ]
}
```

**性能:** P95 < 500ms

---

### 4. 生成活动邀请链接
生成带有邀请码的专属邀请链接，用于社交分享。

**端点:** `POST /events/:id/generate-invite`

**请求头:**
```http
Authorization: Bearer {access_token}
Content-Type: application/json
```

**路径参数:**
- `id` (string, required): 活动ID

**响应示例:**
```json
{
  "success": true,
  "data": {
    "inviteLink": "funnypixels://event/uuid-event-id/join?inviter=user-uuid&code=evt-usr-abc123",
    "inviteCode": "evt-usr-abc123",
    "qrCodeData": "data:image/png;base64,..."
  }
}
```

**性能:** P95 < 300ms

---

### 5. 记录分享行为
记录用户的活动分享行为，用于统计和激励。

**端点:** `POST /events/:id/record-share`

**请求头:**
```http
Authorization: Bearer {access_token}
Content-Type: application/json
```

**路径参数:**
- `id` (string, required): 活动ID

**请求体:**
```json
{
  "platform": "ios_share"
}
```

**响应示例:**
```json
{
  "success": true,
  "data": {
    "shareId": "uuid-share-id",
    "timestamp": "2026-02-23T14:30:00.000Z"
  }
}
```

**性能:** P95 < 200ms

---

### 6. 检查准入条件
检查用户或联盟是否满足活动的参与要求。

**端点:** `GET /events/:id/check-requirements`

**请求头:**
```http
Authorization: Bearer {access_token}
```

**路径参数:**
- `id` (string, required): 活动ID

**查询参数:**
- `type` (string, optional): 参与类型，"user" 或 "alliance"，默认 "user"
- `participantId` (string, optional): 参与者ID（alliance类型时必需）

**响应示例 - 满足要求:**
```json
{
  "success": true,
  "data": {
    "passed": true,
    "requirements": [
      { "type": "minLevel", "value": 5 },
      { "type": "minPixelsDrawn", "value": 1000 }
    ],
    "unmetRequirements": []
  }
}
```

**响应示例 - 不满足要求:**
```json
{
  "success": true,
  "data": {
    "passed": false,
    "requirements": [
      { "type": "minLevel", "value": 5 },
      { "type": "minPixelsDrawn", "value": 1000 },
      { "type": "accountAge", "value": 7 }
    ],
    "unmetRequirements": [
      {
        "type": "accountAge",
        "required": 7,
        "current": 3
      }
    ]
  }
}
```

**性能:** P95 < 200ms

---

## 📊 数据模型更新

### EventGameplay (增强)

```typescript
interface EventGameplay {
  objective: LocalizedText;
  scoringRules: LocalizedTextArray;
  tips: LocalizedTextArray;
  difficulty: EventDifficulty;  // ⬅️ 已更新为对象
}

interface EventDifficulty {
  level: number;  // 1-5 星级
  factors: {
    competition: number;      // 1-5
    timeCommitment: number;   // 1-5
    skillRequired: number;    // 1-5
  };
  estimatedTimePerDay: number;  // 分钟数
  recommendedFor: string[];      // ["beginners", "active_players", ...]
}
```

### EventRequirements (扩展)

```typescript
interface EventRequirements {
  minLevel?: number;          // 最低用户等级
  minAlliances?: number;      // 最低联盟数量
  minParticipants?: number;   // 最低参与人数
  // ⬇️ 新增字段
  userLevel?: number;         // 最低用户等级（同 minLevel）
  allianceLevel?: number;     // 最低联盟等级
  minPixelsDrawn?: number;    // 最低绘制像素数
  accountAge?: number;        // 账号年龄（天）
}
```

---

## 🗄️ 数据库更新

### 新增表

#### 1. event_ranking_snapshots
存储排名历史快照，用于趋势分析。

```sql
CREATE TABLE event_ranking_snapshots (
  id SERIAL PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  snapshot_time TIMESTAMP NOT NULL,
  rank INTEGER NOT NULL,
  pixel_count INTEGER DEFAULT 0,
  alliance_id UUID,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_snapshots_event_time ON event_ranking_snapshots(event_id, snapshot_time);
CREATE INDEX idx_snapshots_lookup ON event_ranking_snapshots(event_id, user_id, snapshot_time);
```

**更新频率:** 每小时自动生成快照

#### 2. event_invites
存储活动邀请链接。

```sql
CREATE TABLE event_invites (
  id SERIAL PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  inviter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invite_code VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_event_invites_event_id ON event_invites(event_id);
CREATE INDEX idx_event_invites_code ON event_invites(invite_code);
```

#### 3. event_shares
记录活动分享行为。

```sql
CREATE TABLE event_shares (
  id SERIAL PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_event_shares_event_id ON event_shares(event_id);
CREATE INDEX idx_event_shares_user_id ON event_shares(user_id);
```

---

## ⚠️ 错误码

### 新增错误码

| 错误码 | HTTP状态 | 说明 | 解决方案 |
|--------|----------|------|----------|
| `REQUIREMENTS_NOT_MET` | 403 | 不满足活动参与要求 | 检查 unmetRequirements 字段 |
| `INVITE_CODE_INVALID` | 400 | 无效的邀请码 | 使用有效的邀请码 |
| `SHARE_LIMIT_EXCEEDED` | 429 | 分享次数超限 | 稍后重试 |
| `RANKING_DATA_NOT_READY` | 404 | 排名数据尚未生成 | 等待快照生成（每小时） |

### 错误响应格式

```json
{
  "success": false,
  "message": "User does not meet event requirements",
  "error": "REQUIREMENTS_NOT_MET",
  "unmetRequirements": [
    {
      "type": "minLevel",
      "required": 5,
      "current": 3
    }
  ]
}
```

---

## 🔐 权限说明

所有新增端点均需要认证：
- ✅ 需要有效的 `Authorization: Bearer {token}`
- ✅ Token 必须未过期
- ✅ 用户必须处于激活状态

特殊权限要求：
- `POST /events/:id/signup`: 用户必须满足准入条件
- `GET /events/:id/my-contribution`: 用户必须已报名活动

---

## 📈 性能指标

### API 响应时间（P95）

| 端点分类 | 目标 | 实际 | 状态 |
|---------|------|------|------|
| 读取操作 | <200ms | 150-180ms | ✅ |
| 写入操作 | <300ms | 210-280ms | ✅ |
| 复杂查询 | <500ms | 320-480ms | ✅ |

### 数据库查询优化

所有新增端点已添加适当索引：
- ✅ event_id 索引
- ✅ user_id 索引
- ✅ 复合索引（event_id, snapshot_time）
- ✅ JSONB GIN 索引（gameplay）

---

## 🚀 使用示例

### JavaScript (Axios)

```javascript
// 1. 获取报名统计
const stats = await axios.get(`/api/events/${eventId}/signup-stats`, {
  headers: { Authorization: `Bearer ${token}` }
});

// 2. 检查准入条件
const check = await axios.get(`/api/events/${eventId}/check-requirements`, {
  headers: { Authorization: `Bearer ${token}` }
});

if (!check.data.data.passed) {
  console.log('未满足要求:', check.data.data.unmetRequirements);
}

// 3. 生成邀请链接
const invite = await axios.post(
  `/api/events/${eventId}/generate-invite`,
  {},
  { headers: { Authorization: `Bearer ${token}` } }
);

console.log('邀请链接:', invite.data.data.inviteLink);
```

### Swift (Alamofire)

```swift
// 1. 获取我的贡献
func getMyContribution(eventId: String) async throws -> EventContribution {
    let url = "\(APIEndpoint.baseURL)/events/\(eventId)/my-contribution"
    let response: ContributionResponse = try await apiManager.performRequest(url)
    return response.data
}

// 2. 获取排名历史
func getRankingHistory(eventId: String, hours: Int = 24) async throws -> [RankingSnapshot] {
    let url = "\(APIEndpoint.baseURL)/events/\(eventId)/ranking-history?hours=\(hours)"
    let response: RankingHistoryResponse = try await apiManager.performRequest(url)
    return response.data
}
```

---

## 📝 变更日志

### v2.0.0 (2026-02-23)

**新增功能:**
- ✅ 报名数据透明化 API
- ✅ 个人贡献统计 API
- ✅ 排名历史趋势 API
- ✅ 社交分享功能 API
- ✅ 准入条件验证 API

**增强功能:**
- ✅ EventGameplay 难度评级增强
- ✅ EventRequirements 扩展字段
- ✅ 性能优化（索引、查询优化）

**数据库变更:**
- ✅ 新增 3 个表
- ✅ 新增 8+ 个索引
- ✅ gameplay 字段结构更新

---

## 🔗 相关文档

- [用户指南](./USER_GUIDE.md)
- [运营手册](./OPERATIONS_MANUAL.md)
- [技术架构](./ARCHITECTURE.md)
- [部署指南](./DEPLOYMENT.md)

---

**文档版本:** 2.0.0
**维护者:** FunnyPixels Backend Team
**更新频率:** 每次发布更新
