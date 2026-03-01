# Production MVT Architecture - Deployment Guide

## 概述

本文档描述如何将FunnyPixels从旧的Raster Tile架构迁移到生产级的**纯Vector Tile (MVT)**架构。

### 关键改进

| 特性 | 旧架构（Raster） | 新架构（MVT） |
|------|----------------|--------------|
| 渲染方式 | PNG预合成 | 矢量渲染（ST_AsMVT） |
| 缩放质量 | 模糊、锯齿 | 完美像素锁定，无抖动 |
| 性能 | P95 > 500ms | P95 < 200ms |
| 缓存策略 | 单层Redis | LRU + Redis双层 |
| Sprite管理 | 无 | 动态加载 + LRU淘汰 |
| 数据传输 | 未压缩 | Brotli/Gzip压缩 |

---

## 部署步骤

### Phase 1: 数据库迁移（零停机）

#### 1.1 运行数据库迁移

```bash
cd backend
npm run migrate
```

迁移将执行：
- 添加`lng_quantized`、`lat_quantized`列（网格对齐坐标）
- 创建`geom_quantized` geometry列
- 添加SP-GIST空间索引
- 添加render_type B-tree索引
- 创建自动量化触发器

#### 1.2 验证索引

```bash
# PostgreSQL
psql -d funnypixels -c "\d+ pixels"
```

应该看到：
```
Indexes:
    "idx_pixels_geom_spgist" spgist (geom_quantized)
    "idx_pixels_render_type" btree (render_type)
    "idx_pixels_mvt_composite" btree (render_type, created_at) INCLUDE (id, color, ...)
```

#### 1.3 回填已有数据（可选，建议在低峰时段）

```sql
-- 仅在有大量历史数据时需要
UPDATE pixels
SET
  lng_quantized = ROUND(longitude::numeric / 0.0001) * 0.0001,
  lat_quantized = ROUND(latitude::numeric / 0.0001) * 0.0001
WHERE lng_quantized IS NULL;

UPDATE pixels
SET geom_quantized = ST_SetSRID(ST_MakePoint(lng_quantized, lat_quantized), 4326)
WHERE geom_quantized IS NULL;
```

---

### Phase 2: 后端部署

#### 2.1 安装依赖

```bash
cd backend
npm install
```

新增依赖已在`package.json`中，包括：
- `sharp` - 图像处理（Sprite生成）
- `lru-cache` - 内存缓存
- 其他依赖已存在

#### 2.2 环境变量配置

在`.env`文件中添加（可选）：

```env
# Redis配置（已有则跳过）
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Sprite CDN（可选，默认使用Twemoji CDN）
# TWEMOJI_CDN=https://cdn.jsdelivr.net/gh/twitter/twemoji@latest/assets/72x72
```

#### 2.3 启动后端服务

```bash
# 开发模式
npm run dev

# 生产模式
npm start
```

#### 2.4 验证后端

```bash
# 测试MVT端点
curl -I http://localhost:3001/api/tiles/pixels/14/13536/6654.pbf

# 预期响应：
# Content-Type: application/x-protobuf
# ETag: "..."
# Content-Encoding: br 或 gzip
```

---

### Phase 3: 前端部署

#### 3.1 环境变量配置

在`frontend/.env`中添加：

```env
# MVT Tile URL（生产环境）
VITE_MVT_TILE_URL=https://your-api-domain.com/api/tiles/pixels/{z}/{x}/{y}.pbf

# API Base URL（用于Sprite加载）
VITE_API_BASE_URL=https://your-api-domain.com
```

本地开发（默认）：
```env
VITE_MVT_TILE_URL=http://localhost:3001/api/tiles/pixels/{z}/{x}/{y}.pbf
VITE_API_BASE_URL=http://localhost:3001
```

#### 3.2 构建前端

```bash
cd frontend
npm run build
```

#### 3.3 部署到CDN/托管服务

```bash
# 示例：Cloudflare Pages
npm run deploy

# 或手动上传 dist/ 目录
```

---

### Phase 4: Nginx配置（可选，推荐）

#### 4.1 应用Nginx配置

```bash
sudo cp infrastructure/nginx/mvt-config.conf /etc/nginx/conf.d/
sudo nginx -t
sudo systemctl reload nginx
```

#### 4.2 配置说明

`mvt-config.conf`提供：
- **Brotli/Gzip压缩**（减少70%+ 数据传输）
- **Nginx缓存层**（减轻后端压力）
- **ETag支持**（304 Not Modified）
- **CORS头**（跨域访问）

---

### Phase 5: 验证部署

#### 5.1 运行验证脚本

```bash
cd scripts
node verify-mvt-production.js
```

预期输出：
```
🧪 Testing MVT Production Endpoint...

📡 Fetching: http://localhost:3001/api/tiles/pixels/14/13536/6654.pbf
✅ Status: 200
📦 Content-Length: 12345 bytes
🗜️  Encoding: br
🏷️  ETag: "abc123def456"
💾 Cache-Control: public, max-age=3600, must-revalidate

📊 Vector Tile Layers:
   Layers found: 3
   ✅ pixels-color: 150 features
   ✅ pixels-emoji: 25 features
   ✅ pixels-complex: 10 features

📈 Total features: 185

🔍 Production Checks:
   ✅ Has ETag header
   ✅ Has Cache-Control
   ✅ Uses compression
   ✅ At least 1 layer
   ✅ At least 1 feature

🎉 All checks passed! MVT production endpoint is ready.
```

#### 5.2 前端验证

打开浏览器，访问前端应用：

1. **打开开发者工具** → Network标签
2. **筛选 `.pbf`** 文件
3. **检查响应头**：
   - `Content-Type: application/x-protobuf`
   - `Content-Encoding: br` 或 `gzip`
   - `ETag: "..."`
4. **缩放地图**：
   - 像素应平滑缩放，无抖动
   - 缩放时像素大小应精确加倍（物理锁定）

5. **检查Console**：
   ```
   🗺️ Map loaded, initializing PRODUCTION MVT layers...
   ✅ SpriteLoader initialized: http://localhost:3001
   ✅ SDF square registered: 64 px with 8 px padding
   📡 Production MVT source added: http://localhost:3001/api/tiles/pixels/{z}/{x}/{y}.pbf
   ✅ Color layer added (SDF, base-2 scaling)
   ✅ Emoji layer added (dynamic sprites)
   ✅ Complex layer added (dynamic sprites)
   ✅ Dynamic sprite loading enabled
   ```

#### 5.3 性能验证

使用Chrome DevTools → Performance标签：

- **FPS**：应稳定在60 FPS（缩放时）
- **Main Thread**：`setData`调用应 ≤1次/frame
- **Memory**：GPU内存应在200MB以下（2000 sprites）

---

## 监控和维护

### 缓存统计

```bash
# 查看缓存状态
curl http://localhost:3001/api/tiles/pixels/cache/stats

# 响应：
{
  "mvt": {
    "raw": { "size": 450, "calculatedSize": 45234567, "maxSize": 52428800 },
    "compressed": { "size": 1800, ... }
  },
  "sprites": {
    "size": 1234,
    "calculatedSize": 95123456,
    "maxSize": 104857600
  }
}
```

### 清除缓存

```bash
# 清除单个瓦片
curl -X POST http://localhost:3001/api/tiles/pixels/cache/invalidate \
  -H "Content-Type: application/json" \
  -d '{"lat": 30.2741, "lng": 120.1551}'

# 清除所有缓存（慎用！）
curl -X DELETE http://localhost:3001/api/tiles/pixels/cache/all
```

### 性能指标（Prometheus）

如果使用Prometheus监控，添加以下查询：

```promql
# MVT P95延迟
histogram_quantile(0.95, rate(mvt_tile_duration_seconds_bucket[5m]))

# 缓存命中率
rate(mvt_cache_hits_total[5m]) / rate(mvt_cache_requests_total[5m])

# Sprite加载队列长度
sprite_loader_queue_length
```

---

## 故障排查

### 问题1: 空瓦片（204 No Content）

**症状**: 地图显示空白区域

**原因**:
- Zoom level < 12（zoom-based thinning策略）
- 该区域确实没有像素

**解决**:
- 调整采样率（`productionPixelTileQuery.js`第20-30行）
- 或确认数据库有该区域的像素

### 问题2: Sprite加载失败

**症状**: Console显示 `⚠️ Sprite load failed`

**排查**:
```bash
# 测试Sprite端点
curl http://localhost:3001/api/sprites/icon/1/emoji/🔥.png -I

# 检查Twemoji CDN连接
curl https://cdn.jsdelivr.net/gh/twitter/twemoji@latest/assets/72x72/1f525.png -I
```

**解决**:
- 检查网络连接
- 如果Twemoji CDN被墙，配置本地Sprite镜像

### 问题3: 像素抖动/模糊

**症状**: 缩放时像素位置不稳定

**原因**: 坐标未正确量化

**排查**:
```sql
SELECT id, longitude, lng_quantized, latitude, lat_quantized
FROM pixels
WHERE lng_quantized IS NULL OR lat_quantized IS NULL
LIMIT 10;
```

**解决**:
```sql
-- 运行量化更新
UPDATE pixels
SET
  lng_quantized = ROUND(longitude::numeric / 0.0001) * 0.0001,
  lat_quantized = ROUND(latitude::numeric / 0.0001) * 0.0001,
  geom_quantized = ST_SetSRID(ST_MakePoint(
    ROUND(longitude::numeric / 0.0001) * 0.0001,
    ROUND(latitude::numeric / 0.0001) * 0.0001
  ), 4326)
WHERE lng_quantized IS NULL;
```

### 问题4: 高内存占用

**症状**: 前端内存持续增长

**原因**: Sprite LRU淘汰未工作

**排查**:
```javascript
// 浏览器Console
spriteLoaderRef.current.getCacheStats()
// 应显示: { loaded: <2000, maxSize: 2000, ... }
```

**解决**:
- 检查`SpriteLoader.ts`的`evictLRU()`逻辑
- 或降低`maxCacheSize`从2000到1000

### 问题5: CI Lint失败

**症状**: `ci-lint-raster.sh`报错

**原因**: 代码中仍存在raster类型引用

**排查**:
```bash
grep -rn "type.*:.*'raster'" frontend/src/ backend/src/
```

**解决**:
- 移除所有raster图层引用
- 改用vector图层

---

## 性能基准

部署后，预期达到以下指标：

| 指标 | 目标 | 测量方法 |
|------|------|---------|
| MVT P50延迟 | < 100ms | 后端日志 |
| MVT P95延迟 | < 200ms | Prometheus |
| Sprite缓存命中率 | > 95% | `/cache/stats` |
| GPU内存（2000 sprites） | < 200MB | Chrome DevTools |
| 缩放FPS | 60 FPS | Performance标签 |
| 数据传输（Brotli） | -70% | Network标签 |

---

## 回滚策略

如果遇到严重问题，可以回滚到旧系统：

### 1. 回滚后端

```javascript
// backend/src/server.js
// 注释掉生产路由
// app.use('/api/tiles/pixels', require('./routes/productionMVTRoutes'));

// 恢复旧路由
app.use('/api/tiles/pixels', require('./routes/mvtTileRoutes'));
```

### 2. 回滚前端

```env
# frontend/.env
# 使用旧的GeoJSON或旧MVT端点
VITE_MVT_TILE_URL=
```

### 3. 回滚数据库（不推荐）

```bash
npm run migrate:rollback
```

**注意**: 回滚迁移会删除量化列和索引，影响性能。仅在极端情况下使用。

---

## 支持和反馈

- **问题报告**: https://github.com/anthropics/claude-code/issues
- **性能问题**: 检查Prometheus指标和日志
- **数据问题**: 运行`verify-mvt-production.js`

---

## 附录A: 文件清单

### 新增文件

```
backend/src/database/migrations/
  └── 20251211_mvt_production_indexes.js

backend/src/models/
  └── productionPixelTileQuery.js

backend/src/services/
  ├── productionMVTService.js
  └── spriteService.js

backend/src/routes/
  └── productionMVTRoutes.js

frontend/src/utils/
  └── SpriteLoader.ts

infrastructure/nginx/
  └── mvt-config.conf

scripts/
  ├── ci-lint-raster.sh
  └── verify-mvt-production.js
```

### 修改文件

```
backend/src/server.js (第325-327行)
frontend/src/components/map/MapCanvas.tsx (完全重写)
```

---

## 附录B: API端点清单

### MVT Tile端点

```
GET /api/tiles/pixels/{z}/{x}/{y}.pbf
```

**响应头**:
```
Content-Type: application/x-protobuf
Content-Encoding: br (或 gzip)
ETag: "md5-hash"
Cache-Control: public, max-age=3600, immutable (z>=16)
```

**Source-Layers**:
- `pixels-color`: 颜色像素（color属性）
- `pixels-emoji`: Emoji像素（emoji属性）
- `pixels-complex`: 复杂图案（pattern_id/material_id属性）

### Sprite端点

```
GET /api/sprites/icon/{scale}/{type}/{key}.png
```

**参数**:
- `scale`: 1, 2, 或 3
- `type`: `emoji` 或 `complex`
- `key`: emoji字符 或 UUID

**示例**:
```
/api/sprites/icon/1/emoji/🔥.png
/api/sprites/icon/2/complex/550e8400-e29b-41d4-a716-446655440000.png
```

### 缓存管理端点

```
GET  /api/tiles/pixels/cache/stats           # 缓存统计
POST /api/tiles/pixels/cache/invalidate      # 失效缓存
DELETE /api/tiles/pixels/cache/all            # 清空缓存（admin）
```

---

**部署完成！享受生产级的矢量渲染性能！** 🎉
