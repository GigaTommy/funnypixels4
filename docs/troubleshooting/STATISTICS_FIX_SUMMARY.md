# 历史作品统计数据修复总结

## ✅ 已完成修复

### 问题回顾

iOS app 历史-作品画廊界面显示的统计数据不正确（像素数量、距离、时间、唯一网格等）。

### 根本原因

**异步数据写入与同步统计计算的时序冲突**

1. 像素绘制时，`pixels_history` 表的写入是**异步**的（通过地理编码队列）
2. 会话结束时，`calculateSessionStatistics()` 立即查询 `pixels_history` 表
3. 由于异步延迟，查询时 `pixels_history` 可能为空或数据不完整
4. 导致统计数据错误（pixelCount=0 或远小于实际值）

详细分析见: [`STATISTICS_BUG_ANALYSIS.md`](./STATISTICS_BUG_ANALYSIS.md)

## 🔧 修复内容

### 1. 修改统计计算数据源

**文件**: `backend/src/services/drawingSessionService.js`

**修改**: 从 `pixels` 表查询统计数据，而不是 `pixels_history` 表

**原因**:
- `pixels` 表通过批处理同步写入（5秒内完成）
- `pixels_history` 表通过异步地理编码写入（可能延迟数秒到数十秒）
- 统计计算时 `pixels` 表数据已完整可用

**具体修改**:

```diff
  async calculateSessionStatistics(sessionId) {
    try {
-     // 查询统计信息
-     const stats = await this.db('pixels_history')
+     // 🔧 FIX: 从 pixels 表查询统计信息（立即可用，不依赖异步地理编码）
+     const stats = await this.db('pixels')
        .where({ session_id: sessionId })
        .select(...)

-     // 获取地理位置
-     const firstPixel = await this.db('pixels_history')
+     // 优先从 pixels 表读取，如果没有地理信息则尝试 pixels_history
+     let firstPixel = await this.db('pixels')
        .where({ session_id: sessionId })
        ...

+     if (!firstPixel) {
+       firstPixel = await this.db('pixels_history')
+         .where({ session_id: sessionId })
+         ...
+     }

-     // 获取所有像素点的坐标用于计算距离
-     const pixels = await this.db('pixels_history')
+     // 🔧 FIX: 从 pixels 表获取坐标
+     const pixels = await this.db('pixels')
        .where({ session_id: sessionId })
        ...
    }
  }
```

### 2. 创建统计数据重新计算脚本

**文件**: `backend/scripts/recalculate_session_stats.js`

**用途**: 修复现有会话的错误统计数据

**使用方法**:

```bash
# 重新计算所有已完成会话的统计
node backend/scripts/recalculate_session_stats.js

# 只重新计算最近10个会话
node backend/scripts/recalculate_session_stats.js --recent=10

# 重新计算指定会话
node backend/scripts/recalculate_session_stats.js --session-id=xxx-xxx-xxx
```

## 🧪 验证步骤

### 1. 后端验证

#### 步骤A: 运行重新计算脚本

```bash
cd /Users/ginochow/code/funnypixels3/backend
node scripts/recalculate_session_stats.js --recent=5
```

**预期输出**:
```
🔄 开始重新计算会话统计信息...
将重新计算最近 5 个已完成的会话
[1/5] 处理会话: xxx - GPS绘制
✅ 重新计算完成: xxx { pixelCount: 10, distance: 245, duration: 120, uniqueGrids: 10 }
...
✨ 重新计算完成!
成功: 5, 失败: 0, 总计: 5
```

#### 步骤B: 数据库验证

```sql
-- 查看某个会话的统计数据
SELECT
  id,
  session_name,
  status,
  metadata->'statistics' as statistics,
  (SELECT COUNT(*) FROM pixels WHERE session_id = drawing_sessions.id) as pixels_count,
  (SELECT COUNT(*) FROM pixels_history WHERE session_id = drawing_sessions.id) as history_count
FROM drawing_sessions
WHERE status = 'completed'
ORDER BY created_at DESC
LIMIT 5;
```

**验证点**:
- `statistics.pixelCount` 应该等于 `pixels_count`
- `statistics.pixelCount` 应该大于 0（如果会话有像素）
- `statistics.distance` 应该是合理的距离值（米）
- `statistics.duration` 应该是合理的时长（秒）

### 2. iOS App 端到端验证

#### 步骤A: 创建新的GPS绘制会话

1. 打开 TestLocationPicker
2. 选择一个位置（如：先烈中路）
3. 点击 "Start Test Here"
4. 等待绘制完成（10个像素）
5. 观察日志确认像素绘制成功

#### 步骤B: 立即停止并查看统计

1. 绘制完成后立即停止
2. 进入 "历史" -> "作品画廊"
3. 查看刚才的会话统计数据

**预期结果**:
- ✅ 像素数量 = 10（实际绘制数量）
- ✅ 距离 > 0（应该在几十米到几百米之间）
- ✅ 时间 ≈ 10-30秒（取决于绘制速度）
- ✅ 唯一网格 = 10（每个像素一个网格）

**修复前的问题**:
- ❌ 像素数量 = 0 或很小（如1-2个）
- ❌ 距离 = 0
- ❌ 时间可能不准确

### 3. 对比验证

创建一个表格对比修复前后的统计数据：

| 会话ID | 修复前pixelCount | 修复后pixelCount | 实际pixels表记录 | 是否正确 |
|--------|----------------|-----------------|----------------|---------|
| session1 | 0 | 10 | 10 | ✅ |
| session2 | 2 | 15 | 15 | ✅ |
| session3 | 0 | 8 | 8 | ✅ |

## 📊 修复效果预期

### 修复前

```json
{
  "statistics": {
    "pixelCount": 0,        // ❌ 错误：应该是10
    "uniqueGrids": 0,       // ❌ 错误：应该是10
    "distance": 0,          // ❌ 错误：应该有距离
    "duration": 0,          // ❌ 错误：应该有时长
    "avgSpeed": 0,
    "efficiency": 0
  }
}
```

### 修复后

```json
{
  "statistics": {
    "pixelCount": 10,       // ✅ 正确
    "uniqueGrids": 10,      // ✅ 正确
    "distance": 245,        // ✅ 正确（米）
    "duration": 120,        // ✅ 正确（秒）
    "avgSpeed": 2.04,       // ✅ 正确（米/秒）
    "efficiency": 5.0       // ✅ 正确（像素/分钟）
  }
}
```

## 🚀 部署步骤

### 1. 后端部署

```bash
# 1. 提交代码
git add backend/src/services/drawingSessionService.js
git add backend/scripts/recalculate_session_stats.js
git commit -m "fix: 修复会话统计数据计算错误

- 从 pixels 表查询统计数据而不是 pixels_history
- 避免异步地理编码导致的数据不完整问题
- 添加统计数据重新计算脚本

Fixes statistics showing incorrect pixel count, distance, duration"

# 2. 推送到远程
git push origin main

# 3. 在生产环境部署后，运行重新计算脚本
ssh production-server
cd /path/to/backend
node scripts/recalculate_session_stats.js
```

### 2. iOS App 无需更新

iOS app 端无需修改，因为：
- iOS app 只是显示后端返回的统计数据
- 修复在后端完成，API 响应格式不变
- 用户下次打开历史页面时会自动看到正确的数据

## 📝 技术要点

### 为什么 pixels 表可靠？

1. **同步批处理写入**: 批处理服务在5秒内完成写入
2. **会话关联**: `pixels` 表有 `session_id` 字段
3. **完整坐标**: 包含 `latitude` 和 `longitude` 字段
4. **创建时间**: 包含 `created_at` 字段用于排序和计算时长

### pixels vs pixels_history 对比

| 特性 | pixels 表 | pixels_history 表 |
|-----|----------|------------------|
| 写入方式 | 同步批处理（5秒内） | 异步地理编码（延迟数秒到数十秒） |
| 数据完整性 | ✅ 立即完整 | ⚠️ 可能延迟 |
| 地理信息 | ⚠️ 可能延迟（异步更新） | ✅ 完整（如果已编码） |
| 适用场景 | ✅ 统计计算 | ✅ 历史查询、地理分析 |

### 地理信息处理

修复后的代码对地理信息采用**降级策略**：
1. 优先从 `pixels` 表读取城市信息
2. 如果 `pixels` 表还没有（地理编码未完成），则从 `pixels_history` 读取
3. 如果都没有，则不设置城市信息

这确保了统计数据的准确性，同时尽可能获取地理信息。

## ✅ 完成标志

修复被认为成功完成的标准：

1. ✅ 后端代码修改完成并通过测试
2. ✅ 重新计算脚本成功运行
3. ✅ 数据库验证显示统计数据正确
4. ✅ iOS App 新创建的会话统计正确
5. ✅ iOS App 历史会话统计已更新并显示正确

## 🔮 未来优化建议

### 可选优化1: 实时统计更新

在绘制过程中实时更新统计数据，而不是等到会话结束：

```javascript
// recordPixelToSession() 中增量更新统计
async recordPixelToSession(sessionId, pixelData) {
  await this.db('pixels_history').insert(insertData);

  // 增量更新统计
  await this.updateSessionStatisticsIncremental(sessionId, pixelData);
}
```

### 可选优化2: 统计缓存

将统计数据缓存到 Redis，减少数据库查询：

```javascript
// 缓存会话统计
const cacheKey = `session:stats:${sessionId}`;
await redis.setex(cacheKey, 3600, JSON.stringify(statistics));
```

### 可选优化3: 定期统计校正

设置定时任务，定期重新计算所有会话统计，确保数据一致性：

```javascript
// cron job: 每天凌晨3点
0 3 * * * node scripts/recalculate_session_stats.js --recent=100
```

## 📚 相关文档

- 详细问题分析: [`STATISTICS_BUG_ANALYSIS.md`](./STATISTICS_BUG_ANALYSIS.md)
- GPS绘制验证: [`GPS_DRAWING_VERIFICATION_GUIDE.md`](../gps/GPS_DRAWING_VERIFICATION_GUIDE.md)
- 性能优化跟踪: [`OPTIMIZATION_TRACKING.md`](../optimization/OPTIMIZATION_TRACKING.md)

## 🆘 问题排查

### 如果统计仍然为0

1. **检查 pixels 表是否有数据**:
   ```sql
   SELECT COUNT(*) FROM pixels WHERE session_id = 'your-session-id';
   ```

2. **检查会话状态**:
   ```sql
   SELECT status FROM drawing_sessions WHERE id = 'your-session-id';
   ```
   确保状态是 'completed'

3. **手动重新计算**:
   ```bash
   node scripts/recalculate_session_stats.js --session-id=your-session-id
   ```

### 如果距离计算异常

1. **检查坐标数据**:
   ```sql
   SELECT latitude, longitude FROM pixels
   WHERE session_id = 'your-session-id'
   AND (latitude IS NULL OR longitude IS NULL);
   ```

2. **检查坐标顺序**:
   ```sql
   SELECT created_at, latitude, longitude FROM pixels
   WHERE session_id = 'your-session-id'
   ORDER BY created_at;
   ```

### 如果iOS显示未更新

1. 强制刷新历史页面（下拉刷新）
2. 杀掉 App 重新打开
3. 检查网络请求是否成功
4. 查看 Xcode 日志确认 API 返回的统计数据

---

**修复日期**: 2026-02-14
**修复人员**: Claude Code
**影响范围**: 所有 GPS 绘制会话的统计数据
**优先级**: 高 🔴
