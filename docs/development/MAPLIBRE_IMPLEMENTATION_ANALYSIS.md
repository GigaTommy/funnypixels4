# MapLibre GL + OFM 实现分析报告

## 数据流程分析

### 1. 数据库到MVT瓦片的数据流

#### 像素数据存储结构 (pixels表)
- **color字段**: 存储颜色值或emoji（如'🔥'）
- **pattern_id字段**: 指向complex图像（如'emoji_fire', 'tt02'）
- **emoji字段**: 实际未使用，emoji存储在color字段中
- **数据统计**:
  - Complex像素: 12,952个
  - Emoji像素: 176个（存储在color字段）
  - 纯色像素: 0个

#### 关键问题：pixelTileQuery.js只查询complex像素
```javascript
// 当前实现 - 只获取complex像素
const query = `
  SELECT ...
  FROM pixels p
  LEFT JOIN pattern_assets pa ON p.pattern_id = pa.key
  WHERE
    p.lat >= ? AND p.lat <= ?
    AND p.lng >= ? AND p.lng <= ?
    AND pa.render_type = 'complex'  // ❌ 这里限制了只获取complex像素
`;
```

### 2. MVT瓦片生成流程 (mvtTileService.js)

#### 三层分离策略
```javascript
// 按类型分组像素
const colorPixels = pixels.filter(p => p.color);         // ❌ 空数组
const emojiPixels = pixels.filter(p => p.emoji);         // ❌ 空数组
const complexPixels = pixels.filter(p => p.pattern_id);  // ✅ 只有complex有数据
```

#### MVT层结构
- `pixels-color`: 颜色像素层（当前为空）
- `pixels-emoji`: Emoji像素层（当前为空）
- `pixels-complex`: 复杂图像层（有数据）

### 3. 前端MapLibre渲染机制

#### 配置问题
- `VITE_MVT_TILE_URL` 未配置，使用mock数据
- Mock数据生成随机像素，不是真实数据

#### 渲染层级
1. **Complex raster层**: 预合成的PNG瓦片
2. **Color符号层**: 使用SDF方块的vector符号
3. **Emoji符号层**: 文本符号渲染
4. **Hotpatch层**: 实时更新的GeoJSON

### 4. 问题根源

1. **查询限制**: `pixelTileQuery.js`只查询complex类型像素
2. **数据误解**: emoji存储在color字段，但代码认为emoji在单独字段
3. **配置缺失**: 前端未配置MVT_TILE_URL，使用mock数据
4. **类型判断错误**: 后端MVT服务依赖pattern_assets表判断类型，但很多像素没有关联记录

## 修复方案

### 方案1: 修改后端查询（推荐）
修改`pixelTileQuery.js`，查询所有类型的像素：

```javascript
const query = `
  SELECT
    p.id,
    p.grid_id,
    p.lat,
    p.lng,
    p.latitude,
    p.longitude,
    p.color as pixel_color,
    p.pattern_id,
    p.created_at,
    CASE
      WHEN p.pattern_id IS NOT NULL AND p.pattern_id != '' THEN 'complex'
      WHEN p.color ~ '[\\u{1F600}-\\u{1F64F}]' OR
           p.color ~ '[\\u{1F300}-\\u{1F5FF}]' OR
           p.color ~ '[\\u{1F680}-\\u{1F6FF}]' OR
           p.color ~ '[\\u{1F1E0}-\\u{1F1FF}]' THEN 'emoji'
      ELSE 'color'
    END as render_type
  FROM pixels p
  WHERE
    p.lat >= ? AND p.lat <= ?
    AND p.lng >= ? AND p.lng <= ?
`;
```

### 方案2: 配置前端MVT URL
在`.env`中添加：
```
VITE_MVT_TILE_URL=http://localhost:3001/api/tiles/pixels/{z}/{x}/{y}.pbf
```

## MapLibre GL 版本信息
- **版本**: 5.13.0 (CDN)
- **渲染策略**: Point + SDF Symbol + Hybrid Raster
- **WebGL要求**: WebGL 2.0
- **关键特性**: SDF图标支持、矢量瓦片、实时热更新