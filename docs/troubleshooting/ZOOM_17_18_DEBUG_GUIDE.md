# Web端 Zoom 17-18 像素消失问题诊断指南

## 问题描述
Web端浏览器中，地图缩放层级12-16时像素正常显示，但缩放到17-18时所有像素突然消失。

## 已实施的修复

### 1. 添加图层缩放范围限制
为所有像素图层添加了显式的 `minzoom` 和 `maxzoom` 属性：
- `minzoom: 12` - 确保图层在zoom 12及以上显示
- `maxzoom: 24` - 显式设置最大缩放级别（MapLibre默认值）

**修改的图层：**
- pixels-color
- pixels-emoji
- pixels-complex
- pixels-ad
- pixels-color-hotpatch
- pixels-emoji-hotpatch
- pixels-complex-hotpatch
- pixels-ad-hotpatch

**位置：** `frontend/src/components/map/MapCanvas.tsx`

### 2. 添加详细的诊断日志

**在缩放结束时 (zoomend)：**
- 检测是否在问题缩放级别（17-18）
- 输出图层可见性状态
- 输出MVT瓦片加载状态
- 查询并输出每个source-layer的feature数量

**在瓦片加载时 (tileload)：**
- 特别监控zoom 17-18时的MVT瓦片加载
- 输出瓦片ID、坐标、URL、加载状态等信息

## 测试步骤

### 1. 启动开发服务器
```bash
cd frontend
npm run dev
```

### 2. 打开浏览器开发者工具
- Chrome/Edge: F12
- Safari: Option+Cmd+I
- 切换到 Console 标签页

### 3. 测试缩放级别
1. 地图初始加载后，缩放到 zoom 15-16
   - **预期**：像素正常显示
   - **检查**：Console中无错误信息

2. 缓慢缩放到 zoom 17
   - **预期**：像素仍然显示
   - **检查**：Console中的日志

3. 缩放到 zoom 18
   - **预期**：像素仍然显示
   - **检查**：Console中的日志

### 4. 关键日志标识

**正常日志：**
```
🔍 ========== 缩放结束 ==========
  zoom: 17.00
  layerVisibility: { pixels-color: { visibility: undefined } }
```

**问题诊断日志（zoom 17-18）：**
```
🚨 ========== 问题缩放级别检测: 17.00 ==========
🚨 [ZOOM 17.00] MVT瓦片加载: { sourceId: 'pixels-mvt', ... }
🚨 [ZOOM 17.00] MVT 瓦片详细状态: { total: X, loaded: Y }
🚨 [ZOOM 17.00] pixels-color features: { count: XXX }
```

### 5. 检查项

#### A. 瓦片是否加载？
查看日志中的 `MVT 瓦片详细状态`：
- `total`: 瓦片总数
- `loaded`: 已加载的瓦片数
- 如果 `loaded = 0`，说明瓦片没有加载

#### B. Features是否存在？
查看日志中的 `pixels-color features`:
- `count`: feature数量
- 如果 `count = 0`，说明瓦片是空的或数据有问题

#### C. 网络请求
打开 Network 标签页：
1. 过滤 `pbf` 文件
2. 缩放到 zoom 17-18
3. 检查是否有 `/api/tiles/pixels/17/` 或 `/18/` 的请求
4. 检查响应状态码（应该是 200 或 204）
5. 检查响应大小（如果是0，说明瓦片为空）

#### D. 图层可见性
查看日志中的 `layerVisibility`:
```json
{
  "pixels-color": {
    "visibility": undefined,  // undefined表示visible
    "source": "pixels-mvt [MVT: minZoom=12, maxZoom=18]"
  }
}
```

## 可能的问题原因

### 1. 后端瓦片生成问题
**症状**：Network中可以看到瓦片请求，但响应为空或204

**检查**：
```bash
# 直接测试后端瓦片生成
curl "http://localhost:3001/api/tiles/pixels/17/106542/54411.pbf" -v
```

**预期**：应该返回数据（Content-Length > 0）

### 2. 前端图层渲染问题
**症状**：瓦片有数据，但features.count = 0

**可能原因**：
- 图层filter问题
- icon-image缺失
- icon-size太小

### 3. MapLibre GL配置问题
**症状**：瓦片加载但不渲染

**检查点**：
- `icon-allow-overlap: true`
- `icon-ignore-placement: true`
- source的`tileSize: 512`

## 下一步调试

### 如果瓦片为空
检查后端：
```bash
cd backend
# 检查数据库中是否有zoom 17-18的数据
node -e "
const { db } = require('./src/config/database');
(async () => {
  const result = await db.raw(\`
    SELECT COUNT(*) as count
    FROM pixels
    WHERE ST_Within(
      ST_SetSRID(ST_MakePoint(lng_quantized, lat_quantized), 4326),
      ST_Transform(ST_TileEnvelope(17, 106542, 54411), 4326)
    )
  \`);
  console.log('Pixels in tile 17/106542/54411:', result.rows[0].count);
  process.exit(0);
})();
"
```

### 如果瓦片有数据但不显示
1. 检查图层是否被其他元素遮挡
2. 检查icon-size是否计算正确
3. 检查sprite图标是否加载

## 临时解决方案

如果问题仍然存在，可以尝试：

### 方案1：强制刷新图层
在缩放到17-18时，手动触发图层重新渲染：
```javascript
map.on('zoomend', () => {
  const zoom = map.getZoom();
  if (zoom >= 17 && zoom <= 18) {
    // 强制重新渲染
    map.triggerRepaint();
  }
});
```

### 方案2：降低maxZoom
临时将地图maxZoom限制在16.99：
```javascript
// mapLibreConfig.ts
maxZoom: 16.99
```

## 联系支持

如果以上步骤都无法解决问题，请提供：
1. Console完整日志（包含🚨标记的日志）
2. Network标签页中瓦片请求的截图
3. 具体的地图中心坐标和缩放级别
4. 浏览器版本信息
