# 赛事活动 API 文档

## 概述

本文档描述赛事活动系统的API接口和关键技术细节，特别是PostGIS空间查询优化。

---

## 坐标系统说明

### GeoJSON格式
- **坐标顺序**: `[经度, 纬度]` (lng, lat)
- **示例**: `[120.1365, 30.2489]`
- **用途**: 存储boundary边界数据

### API参数
- **函数参数**: `(lat, lng)` 顺序
- **示例**: `checkEventParticipation(30.2489, 120.1365)`
- **用途**: 函数调用

### 网格系统
- **精度**: 0.0001° ≈ 11米
- **Grid ID格式**: `grid_{lngIndex}_{latIndex}`
- **自动对齐**: 所有坐标自动对齐到网格
- **示例**: `grid_1201365_1202489`

---

## 管理端 API

### POST /admin/events
创建新赛事

**请求头**:
```
Authorization: Bearer <admin_token>
Content-Type: application/json
```

**请求体**:
```json
{
  "title": "春节赛事",
  "type": "leaderboard",
  "status": "draft",
  "start_time": "2026-02-01T00:00:00Z",
  "end_time": "2026-02-07T23:59:59Z",
  "signup_end_time": "2026-01-31T23:59:59Z",
  "boundary": {
    "type": "Polygon",
    "coordinates": [
      [
        [120.0, 30.0],
        [120.1, 30.0],
        [120.1, 30.1],
        [120.0, 30.1],
        [120.0, 30.0]
      ]
    ]
  },
  "config": {
    "rewards": {
      "rankingRewards": [
        {
          "rank_min": 1,
          "rank_max": 1,
          "target": "alliance_members",
          "rewards": {
            "points": 1000,
            "exclusiveFlag": "champion_flag"
          }
        }
      ]
    },
    "requirements": {
      "minLevel": 5,
      "minPixelsDrawn": 100
    }
  }
}
```

**boundary 验证规则**:
- ✅ 必须是有效的GeoJSON Polygon
- ✅ 坐标范围: lat ∈ [-90, 90], lng ∈ [-180, 180]
- ✅ 首尾坐标必须相同（闭合环）
- ✅ 不能有自相交
- ✅ 面积范围: 100 m² ~ 10,000 km²
- ✅ 至少4个坐标点

**响应**:
```json
{
  "id": "uuid-v4",
  "title": "春节赛事",
  "type": "leaderboard",
  "status": "draft",
  "boundary": {...},
  "created_at": "2026-01-15T12:00:00Z",
  "updated_at": "2026-01-15T12:00:00Z"
}
```

**自动处理**:
- 🚀 **PostGIS几何列**: 自动生成 `boundary_geom`, `center_geom`, `bbox`
- 🔄 **缓存清空**: 自动清空活动事件缓存
- 📡 **实时广播**: 通知所有连接的客户端

**错误响应**:
```json
{
  "error": "Invalid event boundary: Polygon has self-intersections"
}
```

---

### PUT /admin/events/:id
更新赛事

**请求头**:
```
Authorization: Bearer <admin_token>
Content-Type: application/json
```

**请求体** (所有字段可选):
```json
{
  "title": "新标题",
  "status": "published",
  "boundary": {
    "type": "Polygon",
    "coordinates": [...]
  }
}
```

**注意事项**:
- 如果更新 `boundary`，会自动重新生成PostGIS几何列
- 更新后会清空缓存并广播更新事件
- boundary必须通过相同的验证规则

---

### GET /admin/events
获取赛事列表

**查询参数**:
- `current`: 当前页码 (默认: 1)
- `pageSize`: 每页数量 (默认: 10)
- `status`: 过滤状态 (可选: draft, published, active, ended)

**响应**:
```json
{
  "list": [...],
  "total": 100,
  "current": 1,
  "pageSize": 10
}
```

---

### DELETE /admin/events/:id
删除赛事

**响应**:
```json
{
  "success": true,
  "deleted": 1
}
```

---

## 用户端 API

### GET /api/events/active
获取活跃赛事列表

**说明**: 返回状态为 `published` 或 `active` 且未结束的赛事

**响应**:
```json
{
  "events": [
    {
      "id": "uuid",
      "title": "春节赛事",
      "type": "leaderboard",
      "status": "active",
      "start_time": "2026-02-01T00:00:00Z",
      "end_time": "2026-02-07T23:59:59Z",
      "boundary": {...},
      "config": {...}
    }
  ]
}
```

---

### GET /api/events/:id
获取赛事详情

**响应**:
```json
{
  "event": {...},
  "userStatus": {
    "signedUp": true,
    "type": "alliance",
    "joinedAt": "2026-01-20T12:00:00Z"
  }
}
```

---

### POST /api/events/:id/signup
报名参加赛事

**请求体**:
```json
{
  "type": "user",
  "id": "user-uuid"
}
```
或
```json
{
  "type": "alliance",
  "id": "alliance-uuid"
}
```

**响应**:
```json
{
  "participant": {
    "event_id": "event-uuid",
    "participant_type": "user",
    "participant_id": "user-uuid",
    "joined_at": "2026-01-20T12:00:00Z"
  }
}
```

**错误响应**:
```json
{
  "error": "User does not meet event requirements",
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

### GET /api/events/:id/rankings
获取实时排名

**响应**:
```json
{
  "eventId": "uuid",
  "alliances": [
    {
      "id": "alliance-1",
      "name": "联盟A",
      "color": "#FF0000",
      "pixelCount": 1000,
      "score": 0.4
    },
    {
      "id": "alliance-2",
      "name": "联盟B",
      "color": "#00FF00",
      "pixelCount": 800,
      "score": 0.32
    },
    {
      "id": "others",
      "name": "其他",
      "color": "#888888",
      "pixelCount": 700,
      "score": 0.28
    }
  ],
  "totalPixels": 2500,
  "updatedAt": "2026-02-05T12:00:00Z"
}
```

---

## 空间查询API (内部)

### eventService.checkEventParticipation(lat, lng)

检查坐标是否在任何活动赛事区域内

**性能**: 🚀 10-50倍提升（使用PostGIS空间索引）

**参数**:
- `lat` (number): 纬度，范围 -90 到 90
- `lng` (number): 经度，范围 -180 到 180

**返回**: `Promise<Array<Event>>`

**示例**:
```javascript
const events = await eventService.checkEventParticipation(30.2489, 120.1365);
// events = [{ id: '...', title: '西湖赛事', ... }]
```

**查询原理**:
1. **优先使用PostGIS**: 使用 `ST_Contains()` + GiST索引
2. **自动降级**: PostGIS失败时使用Turf.js
3. **性能对比**:
   - PostGIS: < 5ms (使用索引)
   - Turf.js: 50-500ms (遍历所有边界)

**SQL示例**:
```sql
SELECT * FROM events
WHERE status IN ('published', 'active')
  AND end_time >= NOW()
  AND boundary_geom IS NOT NULL
  AND ST_Contains(boundary_geom, ST_SetSRID(ST_MakePoint(lng, lat), 4326))
```

---

### eventService.batchCheckEventParticipation(points)

批量检查多个像素点

**性能**: 单次查询替代N次查询

**参数**:
- `points` (Array): 最多1000个点 `[{lat, lng}, ...]`

**返回**: `Promise<Map<number, Array<Event>>>`

**示例**:
```javascript
const points = [
  { lat: 30.2489, lng: 120.1365 },
  { lat: 30.2501, lng: 120.1375 }
];
const matches = await eventService.batchCheckEventParticipation(points);
// matches.get(0) = [event1, event2]
// matches.get(1) = []
```

**SQL原理**:
```sql
WITH input_points AS (
  SELECT * FROM (VALUES
    (0, ST_SetSRID(ST_MakePoint(120.1365, 30.2489), 4326)),
    (1, ST_SetSRID(ST_MakePoint(120.1375, 30.2501), 4326))
  ) AS t(point_id, geom)
)
SELECT ip.point_id, e.*
FROM input_points ip
JOIN events e ON ST_Contains(e.boundary_geom, ip.geom)
WHERE e.status IN ('published', 'active')
  AND e.boundary_geom IS NOT NULL
```

---

## PostGIS技术细节

### 几何列

每个赛事自动生成3个PostGIS几何列:

1. **boundary_geom** (geometry(Polygon, 4326))
   - 从boundary GeoJSON生成
   - 用于空间查询 `ST_Contains()`
   - 有GiST索引

2. **center_geom** (geometry(Point, 4326))
   - 边界的质心
   - 用于计算距离、展示中心点

3. **bbox** (box2d)
   - 边界的包围盒
   - 用于快速过滤

### 索引

```sql
CREATE INDEX events_boundary_geom_idx ON events USING GIST (boundary_geom);
CREATE INDEX events_spatial_search_idx ON events (status, end_time) WHERE boundary_geom IS NOT NULL;
```

### 性能基准

| 操作 | PostGIS | Turf.js | 提升 |
|------|---------|---------|------|
| 单点查询 (10个活动) | < 5ms | 50-100ms | 10-20x |
| 单点查询 (100个活动) | < 10ms | 200-500ms | 20-50x |
| 批量100点查询 | < 50ms | 5-10s | 100-200x |

---

## 数据迁移

### 修复现有赛事

如果现有赛事缺失PostGIS几何列，运行:

```bash
# Dry run - 查看需要修复的赛事
node backend/scripts/fix-existing-events-geometry.js --dry-run

# 执行修复
node backend/scripts/fix-existing-events-geometry.js
```

**脚本功能**:
1. 查找所有 `boundary IS NOT NULL AND boundary_geom IS NULL` 的赛事
2. 生成PostGIS几何列
3. 验证结果
4. 优化索引 (`VACUUM ANALYZE`)

---

## 错误处理

### 常见错误

1. **Invalid event boundary: Polygon has self-intersections**
   - 原因: 边界多边形自相交
   - 解决: 检查坐标顺序，确保多边形不交叉

2. **Invalid event boundary: Coordinates out of range**
   - 原因: 坐标超出范围 (lat: -90~90, lng: -180~180)
   - 解决: 检查坐标值

3. **Invalid event boundary: Event area too small**
   - 原因: 面积小于100平方米
   - 解决: 扩大边界范围

4. **PostGIS query failed, falling back to Turf.js**
   - 原因: PostGIS查询失败（可能是几何列缺失）
   - 影响: 性能下降，但不影响功能
   - 解决: 运行修复脚本

---

## 最佳实践

### 创建赛事
1. ✅ 使用有效的GeoJSON Polygon
2. ✅ 确保边界不自相交
3. ✅ 面积适中 (100 m² ~ 10,000 km²)
4. ✅ 使用 `draft` 状态创建，测试后再发布

### 性能优化
1. ✅ 使用批量API (`batchCheckEventParticipation`) 处理多个点
2. ✅ 定期运行 `VACUUM ANALYZE events` 优化索引
3. ✅ 监控PostGIS初始化日志，确保索引正常

### 监控
1. ✅ 检查启动日志中的PostGIS初始化信息
2. ✅ 使用 `EXPLAIN ANALYZE` 验证空间查询使用索引
3. ✅ 监控查询响应时间

---

## 版本历史

### v2.0 - PostGIS优化 (2026-02-24)
- ✅ 自动生成PostGIS几何列
- ✅ GeoJSON边界验证
- ✅ 批量空间查询API
- ✅ 性能提升10-50倍

### v1.0 - 初始版本
- 基于Turf.js的空间查询
- 缓存优化

---

## 技术支持

遇到问题？

1. 检查PostGIS初始化日志
2. 运行修复脚本 `fix-existing-events-geometry.js`
3. 查看 `docs/event-system-location-issues-report.md`
4. 运行测试: `npm test -- eventService`

---

**最后更新**: 2026-02-24
**文档版本**: 2.0
