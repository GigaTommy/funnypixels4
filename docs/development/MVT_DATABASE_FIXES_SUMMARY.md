# MVT 数据库修复总结

## 问题
1. `pattern_assets` 表缺少 `render_type` 列
2. `pixels` 表缺少 `lat`/`lng` 字段（与 `latitude`/`longitude` 对应）
3. MVT 查询中引用了不存在的 `emoji` 字段
4. 数据库索引需要优化以支持 MVT 瓦片生成

## 解决方案

### 1. 运行的迁移
- `20251211_mvt_production_indexes.js`: 添加了 render_type 列、量化坐标和空间索引
- `20251213_add_lat_lng_fields_to_pixels.js`: 为 pixels 表添加了 lat/lng 字段

### 2. 修复的文件
- `backend/src/models/productionPixelTileQuery.js`:
  - 修复了引用不存在的 `emoji` 字段的问题
  - 改用 `CASE` 语句从 `color` 字段提取 emoji 值

### 3. 数据更新
- 更新了 `pattern_assets` 表的 `render_type` 数据：
  - emoji 类型: 39 条记录
  - color 类型: 528 条记录
  - complex 类型: 16 条记录

## 数据库结构变化

### pattern_assets 表
- 新增列: `render_type` (varchar(50), default 'complex')
- 新增索引: `idx_pattern_assets_render_type`

### pixels 表
- 新增列:
  - `lat` (decimal(10,8))
  - `lng` (decimal(11,8))
- 新增列（来自之前的迁移）:
  - `render_type` (varchar, default 'pixel')
  - `lng_quantized` (numeric)
  - `lat_quantized` (numeric)
  - `geom_quantized` (geometry)
- 新增索引:
  - `idx_pixels_render_type`
  - `idx_pixels_mvt_composite`
  - `idx_pixels_geom_spgist`
  - `idx_pixels_lat_lng`

## MVT 瓦片生成逻辑
现在正确支持三种像素类型：
1. **Color 纯色像素**: `pixels-color` 层
2. **Emoji 像素**: `pixels-emoji` 层（emoji 存储在 color 字段）
3. **Complex 复杂图案**: `pixels-complex` 层（使用 pattern_id）

## 下一步
1. 启动服务器测试 MVT 端点
2. 验证前端是否能正确加载和显示 MVT 瓦片
3. 检查性能表现，确保满足 P95 < 200ms 的目标