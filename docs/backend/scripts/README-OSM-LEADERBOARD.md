# OpenStreetMap 城市排行榜优化指南

## 📋 概述

本次优化将城市排行榜从基于简单经纬度匹配的旧服务切换到基于 OpenStreetMap PostGIS 精确空间匹配的新服务，大幅提升排行榜的准确性。

## 🔄 主要改进

### 1. 服务切换

**旧服务** (`geographicLeaderboardService`)：
- ❌ 使用经纬度近似匹配（误差约11公里）
- ❌ 依赖不准确的 `regions` 表
- ❌ 无法处理复杂的行政边界

**新服务** (`cityLeaderboardService`)：
- ✅ 使用 PostGIS `ST_Contains` 精确空间匹配
- ✅ 基于 OpenStreetMap 权威数据
- ✅ 支持复杂多边形边界
- ✅ 提供匹配质量评级（perfect/excellent/good/fair/poor）
- ✅ 智能回退机制（距离匹配）

### 2. 数据填充

新增 OSM 匹配字段到 `pixels_history` 表：
- `osm_id` - OpenStreetMap 区域 ID
- `admin_level` - 行政级别（6=地级市）
- `matched_method` - 匹配方法（contains/distance）
- `distance_m` - 匹配距离（米）
- `match_quality` - 匹配质量
- `match_source` - 数据源（postgis_osm）
- `match_version` - 匹配算法版本

## 🚀 使用步骤

### 步骤1: 检查 OSM 数据状态

运行检查脚本确认 OpenStreetMap 数据已导入：

```bash
node backend/scripts/check-osm-data-status.js
```

**预期输出**：
```
✅ planet_osm_polygon 表存在
  地级市(admin_level=6): 334
✅ PostGIS 匹配函数存在
  pixels_history 表匹配率: 0% (需要填充)
```

### 步骤2: 填充 OSM 匹配数据

首次运行需要填充历史数据的 OSM 匹配信息：

```bash
node backend/scripts/fill-osm-match-data.js
```

**功能**：
- 批量处理 `pixels_history` 表中的像素点
- 使用 PostGIS 函数精确匹配到城市
- 自动填充城市、省份等地理信息
- 提供详细的匹配质量统计

**预期输出**：
```
🌍 开始填充pixels_history表的OSM匹配数据...
📊 需要处理的记录数: 123,456
🔄 处理批次 1 (0 / 123,456)...
  ✅ 批次 1 完成: 1000 条成功匹配 (250 条/秒)
...
🎉 OSM匹配数据填充完成！
📊 匹配质量统计:
  perfect   :   98,234 (79.6%) ████████████████████████████████████████
  excellent :   15,678 (12.7%) ████████████
  good      :    7,890 ( 6.4%) ██████
  fair      :    1,234 ( 1.0%) █
  poor      :      420 ( 0.3%)
```

**注意事项**：
- 首次运行可能需要较长时间（取决于数据量）
- 使用批处理，每批1000条记录
- 自动延迟避免数据库过载
- 可多次运行，仅处理未匹配的记录

### 步骤3: 测试新服务

验证新的城市排行榜服务是否正常工作：

```bash
node backend/scripts/test-new-city-leaderboard.js
```

**功能**：
- 测试所有时间周期（daily/weekly/monthly/yearly/allTime）
- 验证缓存机制
- 显示 Top 10 城市
- 统计数据质量分布

**预期输出**：
```
🧪 开始测试新的城市排行榜服务...

📅 测试 daily 排行榜...
✅ daily 排行榜生成成功
⏱️  耗时: 1234ms
📊 城市总数: 156

🏆 前10名城市:
  🥇 北京         (北京市)     -  15678 像素,  1234 用户
  🥈 上海         (上海市)     -  12345 像素,   987 用户
  🥉 深圳         (广东省)     -   9876 像素,   765 用户
  ...

🧹 缓存加速: 15.6x
🎉 所有测试完成！
```

### 步骤4: 重启后端服务

修改已生效，重启服务以应用新的排行榜逻辑：

```bash
npm restart
```

或者在开发环境：

```bash
npm run dev
```

### 步骤5: 测试前端排行榜

在浏览器中访问排行榜页面，切换到"城市榜"标签：

1. 打开前端应用
2. 导航到排行榜页面
3. 点击"城市榜"标签
4. 切换不同的时间周期（日榜/周榜/月榜/年榜/总榜）
5. 验证城市信息是否准确显示

## 📊 数据质量说明

### 匹配质量等级

- **perfect** (完美): 点完全在城市边界内（ST_Contains）
- **excellent** (优秀): 距离 ≤ 1km
- **good** (良好): 距离 ≤ 5km
- **fair** (一般): 距离 ≤ 10km
- **poor** (较差): 距离 ≤ 20km
- **unmatched** (未匹配): 距离 > 20km 或无法匹配

### 数据源

- **osm_postgis**: 基于 OpenStreetMap PostGIS 精确匹配（推荐）
- **fallback**: 回退到基于 city 字段的统计（仅当 OSM 数据不可用时）

## 🔧 维护命令

### 清理缓存

如果需要强制刷新排行榜数据：

```bash
# 在 Node.js 环境中
const CityLeaderboardService = require('./backend/src/services/cityLeaderboardService');
await CityLeaderboardService.clearCache();
```

### 查看服务状态

```bash
# 在 Node.js 环境中
const CityLeaderboardService = require('./backend/src/services/cityLeaderboardService');
const status = await CityLeaderboardService.getServiceStatus();
console.log(status);
```

### 重新填充特定时间段数据

如果需要重新匹配特定时间段的数据，可以在数据库中执行：

```sql
-- 清除特定时间段的 OSM 匹配数据
UPDATE pixels_history
SET osm_id = NULL,
    match_quality = NULL,
    matched_method = NULL
WHERE created_at >= '2025-01-01'
  AND created_at < '2025-02-01';

-- 然后重新运行填充脚本
```

## 🐛 故障排查

### 问题1: planet_osm_polygon 表不存在

**解决方案**：
```bash
# 使用 osm2pgsql 导入 OSM 数据
osm2pgsql -d funnypixels_postgres \
  -U funnypixels \
  -H dpg-d2tfm0ndiees73879o80-a.singapore-postgres.render.com \
  -P 5432 \
  --create \
  --slim \
  china-latest.osm.pbf
```

### 问题2: PostGIS 函数不存在

**解决方案**：
```bash
# 运行数据库迁移
npm run migrate:latest
```

### 问题3: 排行榜数据为空

**检查步骤**：
1. 运行 `check-osm-data-status.js` 检查匹配率
2. 如果匹配率为0，运行 `fill-osm-match-data.js`
3. 检查 `pixels_history` 表是否有数据

### 问题4: 缓存未生效

**解决方案**：
```bash
# 检查 Redis 连接
# 确认环境变量设置正确
echo $UPSTASH_REDIS_REST_URL
echo $UPSTASH_REDIS_REST_TOKEN
```

## 📈 性能优化

### 缓存配置

通过环境变量调整缓存参数：

```bash
# .env 文件
LEADERBOARD_CACHE_TTL=300      # 缓存有效期（秒）
LEADERBOARD_BATCH_SIZE=1000    # 批处理大小
LEADERBOARD_MAX_CITIES=100     # 最大城市数量
```

### 数据库索引

确保以下索引已创建（迁移脚本已自动创建）：

- `idx_pixels_history_osm_id`
- `idx_pixels_history_match_quality`
- `idx_pixels_history_city_created`
- `idx_planet_osm_polygon_admin_level`
- `idx_planet_osm_polygon_way_gist` (空间索引)

## 🔄 回滚方案

如果需要回滚到旧服务：

1. 编辑 `backend/src/controllers/geographicController.js`
2. 将 `getCityLeaderboard` 方法恢复为：

```javascript
static async getCityLeaderboard(req, res) {
  const { period = 'daily', limit = 20 } = req.query;
  const controller = new GeographicController();
  const leaderboard = await controller.geographicLeaderboardService.getCityLeaderboard(
    period,
    parseInt(limit)
  );
  res.json({ success: true, data: leaderboard });
}
```

3. 重启服务

## 📝 相关文件

### 修改的文件

- `backend/src/services/cityLeaderboardService.js` - 新服务主文件
- `backend/src/controllers/geographicController.js` - 控制器修改

### 新增的脚本

- `backend/scripts/fill-osm-match-data.js` - OSM 数据填充脚本
- `backend/scripts/test-new-city-leaderboard.js` - 服务测试脚本
- `backend/scripts/check-osm-data-status.js` - 数据状态检查脚本

### 数据库迁移

- `backend/src/database/migrations/20251028000003_create_postgis_match_functions.js`
- `backend/src/database/migrations/20251028000004_add_postgis_match_fields_to_pixels.js`

## 💡 最佳实践

1. **定期检查数据质量**: 每周运行 `check-osm-data-status.js` 检查匹配率
2. **监控缓存命中率**: 观察日志中的缓存使用情况
3. **增量更新**: 新像素会在绘制时自动匹配，无需重新运行填充脚本
4. **备份数据**: 在大规模数据操作前备份数据库

## 🎯 预期效果

优化后的城市排行榜应该：

- ✅ 显示准确的城市名称（基于 OSM 官方数据）
- ✅ 正确归属跨边界的像素点
- ✅ 提供稳定的排名顺序
- ✅ 响应速度快（缓存机制）
- ✅ 支持所有时间周期（日/周/月/年/总榜）

## 📞 支持

如有问题，请：
1. 查看日志输出
2. 运行检查脚本诊断
3. 检查数据库连接和 PostGIS 扩展
4. 提交 Issue 并附上详细的错误信息
