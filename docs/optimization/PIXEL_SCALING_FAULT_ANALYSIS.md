# 像素无法随地图缩放故障分析

## A. 关键差异分析

### 1. 数据源差异
- **预期**: MVT矢量瓦片包含三层（pixels-color, pixels-emoji, pixels-complex）
- **实际**: 只有pixels-complex层有数据，其他两层为空

### 2. 图层类型差异
- **预期**: symbol层（矢量符号）支持动态缩放
- **实际**: raster层（栅格瓦片）固定分辨率，无法矢量缩放

### 3. 数据格式差异
- **预期**: Point几何体 + type属性
- **实际**: Polygon几何体（后端生成）vs Point几何体（前端期望）

### 4. 配置差异
- **预期**: VITE_MVT_TILE_URL配置，使用MVT矢量瓦片
- **实际**: 未配置，使用mock GeoJSON数据

### 5. 渲染路径差异
- **预期**:
  - color → SDF symbol layer → icon-size插值缩放
  - emoji → text symbol layer → text-size插值缩放
  - complex → raster tiles → 预合成缩放
- **实际**:
  - 所有类型 → mock数据 → 随机生成 → 不真实缩放

## B. 故障链路

```
数据存储方式错误
    ↓
pixelTileQuery.js查询限制（只查complex）
    ↓
MVT瓦片生成缺陷（mvtTileService.js）
    ↓
pixels-color和pixels-emoji层为空
    ↓
前端symbol层无要素渲染
    ↓
icon-size/text-size插值无目标对象
    ↓
地图缩放时像素视觉大小不变
    ↓
用户感知：像素格子没有随地图缩放
```

### 详细链路分析：

1. **数据层故障**：
   - emoji存储在`pixels.color`字段（如'🔥'）
   - 但代码期望emoji在独立的`emoji`字段
   - 类型判断逻辑错误

2. **查询层故障**（pixelTileQuery.js:64）：
   ```sql
   AND pa.render_type = 'complex'  -- ❌ 只查询complex像素
   ```
   - filter条件排除了color和emoji像素
   - LEFT JOIN pattern_assets后，无关联记录的像素被过滤

3. **MVT生成层故障**（mvtTileService.js:131-133）：
   ```javascript
   const colorPixels = pixels.filter(p => p.color);      // ❌ 空数组
   const emojiPixels = pixels.filter(p => p.emoji);      // ❌ 空数组
   const complexPixels = pixels.filter(p => p.pattern_id); // ✅ 有数据
   ```

4. **前端渲染层故障**：
   - MapCanvas.tsx:307 filter: ['==', ['get', 'type'], 'color'] → 无匹配要素
   - MapCanvas.tsx:347 filter: ['==', ['get', 'type'], 'emoji'] → 无匹配要素
   - 只有complex raster层正常显示

5. **缩放机制失效**：
   - icon-size插值（MapCanvas.tsx:310-318）无color symbols作用于
   - text-size插值（MapCanvas.tsx:350-357）无emoji symbols作用于
   - raster tiles本身不支持动态缩放

## C. 修复方案

### 1. 修复数据查询（pixelTileQuery.js）
**文件**: `backend/src/models/pixelTileQuery.js`
**位置**: getPixelsInTile函数（第37-78行）
**调整方向**:
- 移除`AND pa.render_type = 'complex'`限制
- 添加CASE语句判断像素类型
- 使用Unicode范围检测emoji
- 返回完整的type字段

### 2. 修复MVT生成逻辑（mvtTileService.js）
**文件**: `backend/src/services/mvtTileService.js`
**位置**: generateMVTTile函数（第93-193行）
**调整方向**:
- 修改像素类型分组逻辑
- color字段判断改为检查是否为emoji
- emoji字段从color中提取
- 确保三层都有数据

### 3. 配置前端MVT URL（.env）
**文件**: `frontend/.env`
**位置**: 新增配置
**调整方向**:
- 添加`VITE_MVT_TILE_URL=http://localhost:3001/api/tiles/pixels/{z}/{x}/{y}.pbf`
- 确保使用生产MVT而非mock数据

### 4. 修复数据类型判断（types.ts）
**文件**: `frontend/src/types.ts`
**位置**: pixelToFeature函数（第101-117行）
**调整方向**:
- 添加emoji检测逻辑
- 自动判断color vs emoji类型
- 确保type字段正确设置

## D. 根本原因

**像素无法随地图缩放的根本原因是：数据查询错误导致MVT瓦片中缺少color和emoji图层，使得前端的symbol层（支持动态缩放的矢量符号）无数据可渲染，最终只能显示固定分辨率的raster瓦片。**

具体来说：
1. 后端查询被限制为只获取complex类型像素
2. 这导致MVT瓦片中pixels-color和pixels-emoji两层为空
3. 前端虽然配置了正确的缩放插值表达式，但缺少应用对象
4. 只有complex像素通过raster tiles显示，而raster不支持矢量缩放
5. 用户看到的只是预合成的固定大小图像，无法响应地图缩放