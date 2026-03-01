# 赛事活动系统 - 定位功能问题诊断报告

**生成时间**: 2026-02-24
**审查范围**: 运营端 → 用户端全链路
**重点关注**: 定位相关功能和数据一致性

---

## 🔴 严重问题 (P0 - 需要立即修复)

### 1. **PostGIS几何列未自动更新** ⚠️ CRITICAL

**问题描述**:
管理后台创建/更新赛事时，`boundary_geom`、`center_geom`、`bbox` 三个PostGIS列不会自动更新。

**影响范围**:
- 新创建的赛事无法通过PostGIS空间索引查询
- 定位检测会降级到Turf.js（性能降低10-50倍）
- 用户画像素时可能无法正确匹配赛事区域

**根本原因**:
```javascript
// backend/src/services/eventService.js:299-304
async createEvent(data) {
    const [event] = await knex('events').insert(data).returning('*');
    // ❌ 直接插入，没有处理boundary_geom
    this.lastRefresh = 0;
    this.broadcastEventsUpdated();
    return event;
}

// backend/src/services/eventService.js:307-318
async updateEvent(id, data) {
    const [event] = await knex('events').where({ id }).update({
        ...data,
        updated_at: new Date()
    }).returning('*');
    // ❌ 直接更新，没有处理boundary_geom
    this.lastRefresh = 0;
    this.broadcastEventsUpdated();
    return event;
}
```

**验证方法**:
```sql
-- 检查现有赛事是否有PostGIS几何列
SELECT id, title,
       boundary IS NOT NULL as has_boundary_json,
       boundary_geom IS NOT NULL as has_boundary_geom
FROM events
WHERE status IN ('published', 'active');
```

**修复方案**:
```javascript
async createEvent(data) {
    // 1. 提取boundary GeoJSON
    const boundary = data.boundary;

    // 2. 如果有boundary，计算PostGIS列
    if (boundary) {
        const boundaryJSON = typeof boundary === 'string'
            ? boundary
            : JSON.stringify(boundary);

        // 使用SQL函数计算geometry
        data.boundary_geom = knex.raw('ST_GeomFromGeoJSON(?)', [boundaryJSON]);
        data.center_geom = knex.raw('ST_Centroid(ST_GeomFromGeoJSON(?))', [boundaryJSON]);
        data.bbox = knex.raw('ST_Envelope(ST_GeomFromGeoJSON(?))::box2d', [boundaryJSON]);
    }

    const [event] = await knex('events').insert(data).returning('*');
    this.lastRefresh = 0;
    this.broadcastEventsUpdated();
    return event;
}
```

**优先级**: 🔴 P0 - 最高优先级
**预计工作量**: 2小时

---

### 2. **坐标参数顺序潜在混淆**

**问题描述**:
GeoJSON使用 `[lng, lat]` 顺序，但业务代码常用 `(lat, lng)` 顺序，容易混淆。

**发现位置**:
```javascript
// ✅ 正确使用 (lat, lng)
eventService.checkEventParticipation(lat, lng)

// 内部转换为 ST_MakePoint(lng, lat) - 正确
ST_SetSRID(ST_MakePoint(?, ?), 4326)  // [lng, lat]

// ✅ Turf.js 使用 [lng, lat]
const point = turf.point([lng, lat]);
```

**当前状态**: 代码正确，但缺少注释说明

**修复方案**: 添加明确的参数文档
```javascript
/**
 * Check if a coordinate is within any active event boundary
 * @param {number} lat - 纬度 (Latitude, Y坐标, -90 to 90)
 * @param {number} lng - 经度 (Longitude, X坐标, -180 to 180)
 * @returns {Promise<Object[]>} Matching events
 */
async checkEventParticipation(lat, lng) { ... }
```

**优先级**: 🟡 P1 - 高优先级
**预计工作量**: 30分钟

---

## 🟠 重要问题 (P1 - 应尽快修复)

### 3. **像素坐标转换精度问题**

**问题描述**:
像素网格ID（gridId）转经纬度的转换逻辑可能存在精度损失。

**发现位置**:
```javascript
// backend/src/services/pixelDrawService.js:450
await eventService.checkEventParticipation(snappedLat, snappedLng)
```

**需要验证**:
- `snappedLat/snappedLng` 的计算是否准确？
- 是否与地图瓦片的坐标系一致？
- 边界像素是否会因精度问题被误判？

**建议**: 添加单元测试验证边界点
```javascript
// test/pixel-coordinate-conversion.test.js
it('should correctly convert boundary pixel to lat/lng', () => {
    const gridId = 'z14/13440/6701'; // 边界像素
    const { lat, lng } = gridIdToLatLng(gridId);

    // 验证是否在赛事区域内
    const inBoundary = turf.booleanPointInPolygon(
        turf.point([lng, lat]),
        eventBoundary
    );
    expect(inBoundary).toBe(true);
});
```

**优先级**: 🟠 P1
**预计工作量**: 4小时（调查+测试）

---

### 4. **批量检查性能未充分利用**

**问题描述**:
`batchCheckEventParticipation()` 方法已实现，但在像素绘制流程中未使用。

**当前实现**:
```javascript
// pixelDrawService.js - 逐个检查（低效）
await eventService.checkEventParticipation(snappedLat, snappedLng)
```

**优化方案**:
```javascript
// 如果用户一次绘制多个像素（batch drawing）
const points = pixels.map(p => ({ lat: p.lat, lng: p.lng }));
const matchMap = await eventService.batchCheckEventParticipation(points);

// 批量处理结果
matchMap.forEach((events, pointIndex) => {
    events.forEach(event => {
        eventService.recordPixelLog(event.id, pixels[pointIndex]);
    });
});
```

**适用场景**: 填充工具、批量导入、机器人绘制

**优先级**: 🟠 P1
**预计工作量**: 3小时

---

### 5. **空间索引使用未验证**

**问题描述**:
虽然创建了GiST索引，但没有验证生产环境是否真正使用。

**验证方法**:
```sql
-- 查看查询计划
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, title FROM events
WHERE boundary_geom IS NOT NULL
  AND ST_Contains(
      boundary_geom,
      ST_SetSRID(ST_MakePoint(120.1, 30.2), 4326)
  );

-- 应该看到: "Index Scan using events_boundary_geom_idx"
```

**可能问题**:
- 数据库未运行 `VACUUM ANALYZE events;`
- 索引未被正确创建
- PostgreSQL版本不支持GiST索引

**修复方案**:
添加启动时检查和自动优化
```javascript
// backend/src/services/eventService.js - constructor
async initializePostGIS() {
    try {
        // 1. 验证PostGIS扩展
        await knex.raw("SELECT PostGIS_version()");

        // 2. 验证索引存在
        const indexCheck = await knex.raw(`
            SELECT indexname FROM pg_indexes
            WHERE tablename = 'events' AND indexname = 'events_boundary_geom_idx'
        `);

        if (indexCheck.rows.length === 0) {
            logger.warn('⚠️ PostGIS spatial index not found, performance may be degraded');
        }

        // 3. 运行ANALYZE优化
        await knex.raw('ANALYZE events');
        logger.info('✅ PostGIS initialized and optimized');

    } catch (err) {
        logger.error('❌ PostGIS initialization failed:', err);
    }
}
```

**优先级**: 🟠 P1
**预计工作量**: 2小时

---

## 🟡 中等问题 (P2 - 建议修复)

### 6. **降级方案缓存刷新频率过低**

**问题描述**:
Turf.js降级方案的缓存每1分钟刷新，但赛事可能在这期间状态变化。

**影响**:
- 新发布的赛事最多延迟1分钟才能被检测到
- 结束的赛事可能仍然匹配像素

**当前配置**:
```javascript
this.REFRESH_INTERVAL = 1 * 60 * 1000; // 1 minute
```

**优化方案**:
1. 降低刷新间隔（30秒）
2. 事件变更时强制刷新
```javascript
async createEvent(data) {
    const [event] = await knex('events').insert(data).returning('*');
    this.lastRefresh = 0; // ✅ 已实现
    this.activeEventsCache = []; // 🔧 添加：清空缓存
    this.broadcastEventsUpdated();
    return event;
}
```

**优先级**: 🟡 P2
**预计工作量**: 1小时

---

### 7. **事件边界验证缺失**

**问题描述**:
管理后台创建赛事时，没有验证boundary GeoJSON的合法性。

**可能的问题边界**:
- 自相交的多边形（self-intersection）
- 坐标超出范围（lat > 90 或 lng > 180）
- 空的coordinates数组
- 非Polygon类型（如LineString）

**修复方案**:
```javascript
function validateEventBoundary(boundary) {
    const geojson = typeof boundary === 'string'
        ? JSON.parse(boundary)
        : boundary;

    // 1. 检查类型
    if (geojson.type !== 'Polygon') {
        throw new Error('Event boundary must be a Polygon');
    }

    // 2. 检查coordinates
    if (!geojson.coordinates || geojson.coordinates.length === 0) {
        throw new Error('Invalid coordinates');
    }

    // 3. 使用Turf.js验证
    try {
        const polygon = turf.polygon(geojson.coordinates);
        const kinks = turf.kinks(polygon); // 检查自相交
        if (kinks.features.length > 0) {
            throw new Error('Polygon has self-intersections');
        }
    } catch (err) {
        throw new Error(`Invalid GeoJSON: ${err.message}`);
    }

    // 4. 检查坐标范围
    const bbox = turf.bbox(geojson);
    if (bbox[0] < -180 || bbox[1] < -90 || bbox[2] > 180 || bbox[3] > 90) {
        throw new Error('Coordinates out of valid range');
    }

    return true;
}
```

在`createEvent`和`updateEvent`中添加：
```javascript
if (data.boundary) {
    validateEventBoundary(data.boundary);
}
```

**优先级**: 🟡 P2
**预计工作量**: 3小时

---

### 8. **边界外像素的赛事日志泄漏**

**问题描述**:
理论上，只有在赛事边界内的像素才应记录日志。需要确认是否有遗漏检查。

**检查点**:
```javascript
// pixelDrawService.js:450-465
await eventService.checkEventParticipation(snappedLat, snappedLng)
    .then(async matchingEvents => {
        if (matchingEvents && matchingEvents.length > 0) {
            // ✅ 只有匹配的才记录
            for (const event of matchingEvents) {
                eventService.recordPixelLog(event.id, {...});
            }
        }
    });
```

**验证方法**:
```sql
-- 查找可能的异常日志（边界外的像素）
SELECT epl.id, epl.pixel_id, e.title
FROM event_pixel_logs epl
JOIN events e ON e.id = epl.event_id
WHERE e.boundary_geom IS NOT NULL
  AND NOT ST_Contains(
      e.boundary_geom,
      ST_SetSRID(ST_MakePoint(
          -- 从pixel_id反推经纬度
          -- 需要实现gridIdToLatLng
      ), 4326)
  );
```

**优先级**: 🟡 P2
**预计工作量**: 2小时（调查）

---

## 🟢 次要问题 (P3 - 可选优化)

### 9. **地图中心点未使用**

**问题描述**:
`center_geom` 列已创建，但在代码中未被使用。

**潜在用途**:
- 赛事列表按距离排序
- "附近赛事"功能
- 地图视图默认中心

**实现示例**:
```javascript
async getNearbyEvents(userLat, userLng, radius = 50000) {
    // radius in meters
    const results = await knex.raw(`
        SELECT
            id, title, type, status,
            ST_Distance(
                center_geom,
                ST_SetSRID(ST_MakePoint(?, ?), 4326)::geography
            ) as distance
        FROM events
        WHERE status IN ('published', 'active')
          AND ST_DWithin(
              center_geom::geography,
              ST_SetSRID(ST_MakePoint(?, ?), 4326)::geography,
              ?
          )
        ORDER BY distance
        LIMIT 10
    `, [userLng, userLat, userLng, userLat, radius]);

    return results.rows;
}
```

**优先级**: 🟢 P3
**预计工作量**: 4小时

---

### 10. **BBox预筛选未在PostGIS查询中使用**

**问题描述**:
`bbox` 列已创建但未在查询中使用。可以进一步优化性能。

**优化方案**:
```sql
-- 添加bbox预筛选（减少ST_Contains计算）
SELECT id, title FROM events
WHERE boundary_geom IS NOT NULL
  AND bbox && ST_MakePoint(?, ?)::geometry  -- 快速bbox检查
  AND ST_Contains(boundary_geom, ST_SetSRID(ST_MakePoint(?, ?), 4326))
```

**性能提升**: 5-15%（在复杂多边形上效果明显）

**优先级**: 🟢 P3
**预计工作量**: 1小时

---

## 📊 数据一致性问题

### 11. **排名快照表结构疑问**

**问题**: `event_ranking_snapshots` 表有 `user_id` 字段，但实际使用是联盟排名

**表结构**:
```sql
CREATE TABLE event_ranking_snapshots (
    id increments,
    event_id UUID,
    user_id UUID,  -- ❓ 用于联盟还是用户？
    alliance_id UUID,
    rank int,
    pixel_count int,
    snapshot_time timestamp
);
```

**实际使用**（eventService.js）:
```javascript
async saveRankingSnapshot(eventId) {
    const rankings = await this.processEventScores(eventId);
    // rankings是联盟排名，不是用户排名

    // ❓ 如何存储到包含user_id的表？
}
```

**需要澄清**:
1. 是否应该同时保存联盟排名和用户排名？
2. 还是只保存联盟排名，user_id允许NULL？
3. 或者需要两张表？

**优先级**: 🟡 P2
**预计工作量**: 调研后确定

---

## 🚀 前端/iOS缺失功能

### 12. **前端Web赛事页面未实现**

**缺失页面**:
- [ ] EventListPage - 赛事列表
- [ ] EventDetailPage - 赛事详情
- [ ] EventRankingPage - 实时排名
- [ ] EventSignupPage - 报名流程
- [ ] EventHistoryPage - 历史赛事和战绩

**后端API已就绪**: ✅
**优先级**: 🔴 P0（如果需要Web端）
**预计工作量**: 20小时

---

### 13. **iOS App赛事模块未实现**

**缺失模块**:
- [ ] EventModel.swift - 数据模型
- [ ] EventService.swift - API调用
- [ ] EventListView.swift - 赛事列表
- [ ] EventDetailView.swift - 赛事详情
- [ ] EventRankingView.swift - 排名显示
- [ ] EventMapOverlay.swift - 地图叠加层

**后端API已就绪**: ✅
**优先级**: 🔴 P0（如果需要iOS端）
**预计工作量**: 30小时

---

## 🧪 测试覆盖缺失

### 14. **缺少单元测试和集成测试**

**需要测试的关键功能**:
```
[ ] 坐标转换准确性测试
[ ] PostGIS空间查询测试
[ ] 批量检查性能测试
[ ] 边界验证测试
[ ] 降级方案测试
[ ] 排名计算正确性测试
[ ] 奖励分配逻辑测试
[ ] 并发报名测试
```

**优先级**: 🟠 P1
**预计工作量**: 15小时

---

## 📋 总结和优先级路线图

### 立即修复 (本周内)
1. ✅ 修复PostGIS几何列自动更新 (P0)
2. ✅ 添加坐标参数文档注释 (P1)
3. ✅ 验证空间索引使用情况 (P1)

### 短期优化 (2周内)
4. 像素坐标转换精度验证 (P1)
5. 实现批量检查优化 (P1)
6. 添加边界验证 (P2)
7. 优化缓存刷新机制 (P2)

### 中期开发 (1月内)
8. 实现前端Web赛事页面 (P0, if needed)
9. 实现iOS赛事模块 (P0, if needed)
10. 补充单元测试 (P1)

### 长期优化 (可选)
11. 实现"附近赛事"功能 (P3)
12. BBox预筛选优化 (P3)

---

## 🛠️ 快速修复脚本

### 验证PostGIS状态
```bash
cd backend
node scripts/check-postgis.js
```

### 修复现有赛事的几何列
```bash
node scripts/migrate-to-postgis.js
```

### 优化数据库索引
```sql
VACUUM ANALYZE events;
```

---

**报告完成时间**: 2026-02-24
**下一步**: 按优先级路线图执行修复
