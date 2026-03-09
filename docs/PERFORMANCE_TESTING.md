# 3D Pixel Rendering - Performance Testing Guide

**Task #22: 性能测试和优化**

本文档提供 3D 像素渲染系统的完整性能测试指南。

---

## 📋 目录

1. [测试准备](#测试准备)
2. [后端性能测试](#后端性能测试)
3. [iOS 性能测试](#ios-性能测试)
4. [性能基准](#性能基准)
5. [优化建议](#优化建议)
6. [监控指标](#监控指标)

---

## 测试准备

### 1. 后端环境准备

```bash
# 1. 运行数据库迁移
cd backend
npm run migrate

# 2. 初始化物化视图
psql -d funnypixels <<EOF
SELECT refresh_all_pixel_layer_stats();
EOF

# 3. 确认 Redis 运行
redis-cli ping  # 应返回 PONG

# 4. 启动后端服务（开发模式）
npm run dev
```

### 2. iOS 环境准备

```bash
# 1. 清理 DerivedData
rm -rf ~/Library/Developer/Xcode/DerivedData/FunnyPixelsApp-*

# 2. 编译应用
xcodebuild clean build \
  -project FunnyPixelsApp/FunnyPixelsApp.xcodeproj \
  -scheme FunnyPixelsApp \
  -destination 'platform=iOS Simulator,name=iPhone 16e'

# 3. 启动模拟器
open -a Simulator
```

---

## 后端性能测试

### 自动化测试脚本

使用提供的性能测试脚本：

```bash
# 基本测试（默认 10 次迭代）
cd backend
node scripts/test-3d-performance.js

# 自定义测试
node scripts/test-3d-performance.js \
  --host http://localhost:3001 \
  --iterations 50 \
  --zoom 15
```

**预期输出示例**：

```
📊 Testing: Block Level (L3 - Zoom 15)
============================================================
URL: http://localhost:3001/api/pixels-3d/viewport?...
Iterations: 10

First response:
  - LOD Level: L3
  - Pixel Count: 234
  - Response Time: 45ms

  Request 10/10: 12ms ✓

📈 Results:
  Average: 23.40ms
  Min: 12.00ms
  Max: 45.00ms
  P50: 20.00ms
  P95: 42.00ms
  P99: 45.00ms
  Errors: 0/10
  Success Rate: 100.0%
```

### 手动测试 API 端点

#### 1. 测试 Viewport API

```bash
# L2 City Level (低缩放)
curl -s "http://localhost:3001/api/pixels-3d/viewport?minLat=39.85&maxLat=39.95&minLng=116.35&maxLng=116.45&zoom=10&limit=10000" \
  | jq '.data | {lodLevel, count, duration}'

# L3 Block Level (中缩放)
curl -s "http://localhost:3001/api/pixels-3d/viewport?minLat=39.90&maxLat=39.91&minLng=116.40&maxLng=116.41&zoom=15&limit=10000" \
  | jq '.data | {lodLevel, count, duration}'

# L1 Pixel Level (高缩放)
curl -s "http://localhost:3001/api/pixels-3d/viewport?minLat=39.905&maxLat=39.906&minLng=116.405&maxLng=116.406&zoom=18&limit=10000" \
  | jq '.data | {lodLevel, count, duration}'
```

#### 2. 测试 Column Layers API

```bash
# 获取特定 grid_id 的层级历史
curl -s "http://localhost:3001/api/pixels-3d/column/grid-xyz/layers?page=1&limit=100" \
  | jq '.data | {gridId, layerCount: (.layers | length)}'
```

### Redis 缓存性能测试

```bash
# 测试缓存命中率
for i in {1..20}; do
  echo "Request $i"
  curl -s "http://localhost:3001/api/pixels-3d/viewport?minLat=39.90&maxLat=39.91&minLng=116.40&maxLng=116.41&zoom=15" \
    | jq -r '.data.count'
done

# 查看后端日志，应该看到：
# [Performance] 3D viewport cache HIT in 3ms
```

---

## iOS 性能测试

### 1. 内存管理测试

#### 使用 Xcode Instruments

```bash
# 1. 启动 Instruments
instruments -t "Leaks" \
  -D /tmp/3d-leaks.trace \
  -l 60000 \
  -w "iPhone 16e" \
  com.funnypixels.app

# 2. 在 app 中执行：
#    - 进入地图 Tab
#    - 点击 3D 按钮
#    - 缩放/平移地图 20 次
#    - 观察内存使用

# 3. 检查结果
open /tmp/3d-leaks.trace
```

#### 观察 Console 日志

启动应用后，在 Xcode Console 中观察：

```
🎮 [3D Mode] Loaded initial data for center: 39.9042, 116.4074
📦 [Performance] Loading 4 new tiles (total loaded: 0)
✅ [Performance] Tile (10,20): 156 columns in 0.234s (fetch: 0.045s, render: 0.189s)
✅ [Performance] Batch tile load completed in 0.567s (0.142s/tile)
```

**检查项目**：

- [ ] 内存使用 < 800MB
- [ ] 无内存泄漏
- [ ] 内存警告触发时自动降级

### 2. LOD 切换性能

```
测试步骤：
1. 启动应用，进入 3D 模式
2. 缩放级别 10 → 观察日志中的 LOD Level: L2
3. 缩放级别 15 → 观察日志中的 LOD Level: L3
4. 缩放级别 18 → 观察日志中的 LOD Level: L1
5. 记录每次切换的响应时间

预期日志：
📦 [Performance] Loading 6 new tiles (total loaded: 4)
✅ [Performance] Tile (15,30): 89 columns in 0.156s (fetch: 0.034s, render: 0.122s)
```

**检查项目**：

- [ ] LOD 自动切换正确
- [ ] 切换响应时间 < 500ms
- [ ] 无明显卡顿

### 3. 瓦片加载性能

```
测试步骤：
1. 进入 3D 模式
2. 快速平移地图到不同区域 10 次
3. 观察瓦片加载时间
4. 检查是否有延迟加载

预期日志：
📦 [Performance] Loading 3 new tiles (total loaded: 8)
✅ [Performance] Batch tile load completed in 0.423s (0.141s/tile)
```

**检查项目**：

- [ ] 瓦片总数 < 15000 columns
- [ ] 平均加载时间 < 200ms/tile
- [ ] GPU instancing 正常工作

### 4. 内存警告模拟

```swift
// 在 Xcode Debug 菜单中选择：
// Debug > Simulate Memory Warning

// 观察 Console 输出：
🔥 [Performance] Memory warning - Before: 756.3MB (75.6%)
🔽 Reduced LOD: medium → low
✅ [Performance] Memory cleanup completed in 0.234s - Freed 123.4MB, Removed 3 tiles + 156 cached geometries
```

**检查项目**：

- [ ] 内存警告响应时间 < 500ms
- [ ] 成功释放内存 > 100MB
- [ ] 应用不崩溃

---

## 性能基准

### 后端 API 基准

| 指标 | L2 (Zoom 10) | L3 (Zoom 15) | L1 (Zoom 18) |
|------|--------------|--------------|--------------|
| **平均响应时间** | < 50ms | < 30ms | < 100ms |
| **P95 响应时间** | < 80ms | < 50ms | < 150ms |
| **缓存命中响应时间** | < 10ms | < 10ms | < 10ms |
| **平均返回数据量** | 500-2000 | 100-500 | 50-200 |
| **成功率** | > 99.5% | > 99.5% | > 99.5% |

### iOS 性能基准

| 指标 | 目标值 | 优秀值 |
|------|--------|--------|
| **峰值内存使用** | < 800MB | < 600MB |
| **平均内存使用** | < 500MB | < 400MB |
| **瓦片加载时间** | < 200ms/tile | < 150ms/tile |
| **LOD 切换时间** | < 500ms | < 300ms |
| **渲染帧率** | > 30 FPS | > 60 FPS |
| **内存警告恢复时间** | < 1s | < 500ms |

---

## 优化建议

### 已实施的优化

✅ **后端优化**：
- Redis 缓存（5 分钟 TTL）
- LOD 分级查询（L1/L2/L3）
- 物化视图预聚合
- 空间索引（GIST）
- 性能日志和监控

✅ **iOS 优化**：
- GPU instancing（按颜色分组）
- 瓦片式加载（tile-based）
- 几何缓存
- 内存监控（2 秒轮询）
- 3-tier 内存降级策略
- 动态 LOD 调整

### 进一步优化方向

#### 后端

1. **数据库优化**：
   ```sql
   -- 添加部分索引（只索引活跃数据）
   CREATE INDEX idx_pls_active ON pixel_layer_stats (grid_id)
   WHERE last_draw_time > NOW() - INTERVAL '7 days';
   ```

2. **Redis 优化**：
   ```javascript
   // 使用 Redis Pipeline 批量操作
   const pipeline = redis.pipeline();
   keys.forEach(key => pipeline.get(key));
   await pipeline.exec();
   ```

3. **压缩响应**：
   ```javascript
   // 启用 gzip 压缩
   app.use(compression());
   ```

#### iOS

1. **异步渲染**：
   ```swift
   // 使用后台队列渲染复杂几何
   DispatchQueue.global(qos: .userInitiated).async {
       let geometry = createComplexGeometry()
       DispatchQueue.main.async {
           node.geometry = geometry
       }
   }
   ```

2. **LOD 预加载**：
   ```swift
   // 预加载下一级 LOD 数据
   func preloadNextLOD(for viewport: ViewportBounds) {
       Task {
           let nextLODData = await fetchLODData(viewport, level: currentLOD + 1)
           cache[viewport] = nextLODData
       }
   }
   ```

3. **Metal 优化**：
   ```swift
   // 使用 Metal 着色器加速渲染
   let shader = SCNProgram()
   shader.vertexShader = "vertex_shader.metal"
   shader.fragmentShader = "fragment_shader.metal"
   ```

---

## 监控指标

### 生产环境监控

#### 后端指标

监控以下 Prometheus/Grafana 指标：

```
# API 响应时间
http_request_duration_seconds{endpoint="/api/pixels-3d/viewport"}

# 缓存命中率
redis_cache_hit_rate{service="pixel3d"}

# 数据库查询时间
postgres_query_duration_seconds{table="pixel_layer_stats_*"}

# 错误率
http_errors_total{endpoint="/api/pixels-3d/*"}
```

#### iOS 指标

使用 Firebase Performance Monitoring：

```swift
let trace = Performance.startTrace(name: "3d_tile_load")
trace.setValue(tileCount, forMetric: "tile_count")
// ... 执行操作
trace.stop()
```

---

## 故障排查

### 常见问题

#### 1. API 响应慢 (> 500ms)

**诊断**：
```bash
# 检查数据库查询
psql -d funnypixels -c "
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
WHERE query LIKE '%pixel_layer_stats%'
ORDER BY mean_exec_time DESC
LIMIT 5;
"

# 检查 Redis 缓存
redis-cli --latency
```

**解决**：
- 确认物化视图已刷新
- 检查 GIST 索引是否有效
- 增加 Redis 缓存 TTL

#### 2. iOS 内存溢出

**诊断**：
```
观察日志：
🔥 [Performance] Memory warning - Before: 1024.5MB (102.5%)
```

**解决**：
- 降低 `maxColumnCount` (当前 15000)
- 减小 `tileSize` (当前 0.01)
- 启用更激进的内存清理

#### 3. 渲染卡顿

**诊断**：
```swift
// 使用 Instruments Time Profiler
// 查找热点函数
```

**解决**：
- 减少 LOD 几何复杂度
- 优化 GPU instancing 分组
- 使用 Metal 替代 SceneKit

---

## 测试检查清单

### 部署前必测

- [ ] 后端自动化测试通过（所有 LOD 级别）
- [ ] Redis 缓存命中率 > 80%
- [ ] iOS 内存使用 < 800MB
- [ ] 无内存泄漏
- [ ] LOD 切换正常
- [ ] 内存警告恢复正常
- [ ] 所有性能日志正常输出

### 性能回归测试

每次重大更新后执行：

```bash
# 1. 后端性能测试
node scripts/test-3d-performance.js --iterations 100

# 2. 对比基准值
# 3. 记录性能数据
# 4. 更新性能基准
```

---

## 总结

本指南提供了完整的性能测试流程。关键指标：

- **后端**: P95 < 100ms, 缓存命中率 > 80%
- **iOS**: 内存 < 800MB, 加载时间 < 200ms/tile
- **用户体验**: 流畅无卡顿，快速响应

定期执行性能测试，持续优化系统性能。

---

**文档版本**: 1.0
**最后更新**: 2026-03-09
**维护者**: 3D Pixel Team
