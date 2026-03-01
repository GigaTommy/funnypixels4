# MapLibre iOS 动态 Emoji 加载性能分析

**分析日期**: 2026-01-09  
**分析范围**: 当前 `mglJSONObject` + 回调方案在大规模动态加载场景下的表现

---

## 当前实现机制

### 三层加载策略

1. **预注册阶段**（启动时）
   - 从 API 获取联盟旗帜 emoji
   - 注册常见 emoji（约 30+ 个）
   - 一次性注册，减少运行时回调

2. **运行时动态创建**（按需）
   - `imageForStyleLayerNamed` 回调方法
   - 在主线程执行
   - 实时创建 emoji 图像

3. **表达式获取**
   - `NSExpression(mglJSONObject: ["get", "emoji"])`
   - 从 MVT feature 属性动态获取 emoji 值

---

## 性能分析

### 1. 内存占用

#### 预注册阶段
- **每个 emoji 图像**: 64x64px × 4 bytes (RGBA) = 16 KB
- **预注册数量**: ~30-100 个（取决于 API 返回）
- **预注册总内存**: ~480 KB - 1.6 MB

#### 运行时动态创建
- **每次回调创建**: 16 KB
- **未缓存**: 每次都需要重新创建
- **潜在问题**: 大量不同 emoji 时，内存占用线性增长

#### 优化建议
```swift
// 建议添加图像缓存
private var emojiImageCache: [String: UIImage] = [:]
private let maxCacheSize = 500  // 最多缓存 500 个 emoji

func mapView(_ mapView: MLNMapView, imageForStyleLayerNamed name: String) -> UIImage? {
    // 检查缓存
    if let cached = emojiImageCache[name] {
        return cached
    }
    
    // 创建新图像
    guard let image = createEmojiImage(name) else { return nil }
    
    // 缓存管理
    if emojiImageCache.count >= maxCacheSize {
        // LRU 淘汰
        let firstKey = emojiImageCache.keys.first!
        emojiImageCache.removeValue(forKey: firstKey)
    }
    
    emojiImageCache[name] = image
    return image
}
```

### 2. CPU 性能

#### 图像创建开销
- **`createEmojiImage` 方法**:
  - UIGraphicsImageRenderer 创建: ~1-2 ms
  - 字体渲染: ~0.5-1 ms
  - 总计: ~1.5-3 ms per emoji

#### 回调频率
- **取决于可见像素数量**
- **每个未注册的 emoji**: 触发一次回调
- **潜在问题**: 大量不同 emoji 时，回调频繁

#### 性能瓶颈
1. **主线程阻塞**: 回调在主线程执行
2. **同步创建**: 图像创建是同步的
3. **无批处理**: 每个 emoji 独立处理

### 3. 渲染性能

#### 图层渲染
- MapLibre 使用 GPU 渲染
- 图像创建后，渲染性能良好
- 主要瓶颈在图像创建阶段

#### 缩放性能
- 使用 `forMLNInterpolating` 插值
- GPU 加速缩放
- 性能优秀

---

## 大规模场景测试

### 测试场景

1. **场景1: 1000 个不同 emoji**
   - 预注册: 100 个
   - 动态创建: 900 个
   - 预期: 回调 900 次，创建 900 个图像

2. **场景2: 10000 个像素，50 种 emoji**
   - 预注册: 50 个
   - 动态创建: 0 个（全部预注册）
   - 预期: 无回调，性能最优

3. **场景3: 10000 个像素，500 种不同 emoji**
   - 预注册: 100 个
   - 动态创建: 400 个
   - 预期: 回调 400 次，创建 400 个图像

### 性能指标

| 场景 | 预注册数 | 动态创建数 | 内存占用 | CPU 时间 | 渲染延迟 |
|------|---------|-----------|---------|---------|---------|
| 场景1 | 100 | 900 | ~14.4 MB | ~1.35-2.7 s | 中等 |
| 场景2 | 50 | 0 | ~800 KB | ~0 ms | 无 |
| 场景3 | 100 | 400 | ~6.4 MB | ~0.6-1.2 s | 低 |

---

## 与后端预渲染方案对比

### 后端预渲染方案

#### 实现方式
- 后端将 emoji 渲染为 PNG 瓦片
- iOS 端使用 `MLNRasterTileSource` 显示
- 完全绕过动态创建

#### 性能对比

| 指标 | 当前方案 | 后端预渲染 |
|------|---------|-----------|
| 启动时间 | 快（预注册） | 快（加载瓦片） |
| 运行时性能 | 中等（回调创建） | 优秀（预渲染） |
| 内存占用 | 中等（图像缓存） | 低（瓦片缓存） |
| 网络流量 | 低（MVT 数据） | 高（PNG 瓦片） |
| 实现复杂度 | 中等 | 高（两套系统） |
| 灵活性 | 高（动态创建） | 低（需预渲染） |

### 适用场景

#### 当前方案适合
- ✅ 用户个性化 emoji 较多
- ✅ 需要实时动态创建
- ✅ 网络带宽有限
- ✅ 实现简单

#### 后端预渲染适合
- ✅ 大规模固定 emoji
- ✅ 性能要求极高
- ✅ 网络带宽充足
- ✅ 可以接受实现复杂度

---

## 优化建议

### 短期优化（立即实施）

1. **添加图像缓存**
   ```swift
   private var emojiImageCache: [String: UIImage] = [:]
   private let maxCacheSize = 500
   ```

2. **增加预注册范围**
   - 根据使用频率预注册更多 emoji
   - 从 30 个增加到 100-200 个

3. **异步预加载**
   - 在后台线程预创建常用 emoji
   - 减少运行时创建

### 中期优化（性能不足时）

1. **实施 LRU 缓存**
   - 限制缓存大小
   - 自动淘汰最少使用的 emoji

2. **批处理创建**
   - 收集需要创建的 emoji
   - 批量创建，减少回调次数

3. **智能预注册**
   - 根据用户行为数据
   - 动态调整预注册列表

### 长期优化（如果性能仍不足）

1. **考虑后端预渲染**
   - 评估实施成本
   - 逐步迁移

2. **混合方案**
   - 常用 emoji: 预注册
   - 罕见 emoji: 后端预渲染
   - 个性化 emoji: 动态创建

---

## 性能监控

### 关键指标

1. **回调频率**
   - 监控 `imageForStyleLayerNamed` 调用次数
   - 目标: < 1000 次/秒

2. **内存占用**
   - 监控 emoji 图像缓存大小
   - 目标: < 10 MB

3. **创建时间**
   - 监控 `createEmojiImage` 执行时间
   - 目标: < 3 ms per emoji

4. **渲染延迟**
   - 监控从请求到显示的时间
   - 目标: < 100 ms

### 监控实现

```swift
private var performanceMetrics = (
    callbackCount: 0,
    cacheHits: 0,
    cacheMisses: 0,
    totalCreateTime: TimeInterval(0),
    maxMemoryUsage: 0
)

func mapView(_ mapView: MLNMapView, imageForStyleLayerNamed name: String) -> UIImage? {
    performanceMetrics.callbackCount += 1
    
    let startTime = Date()
    defer {
        let duration = Date().timeIntervalSince(startTime)
        performanceMetrics.totalCreateTime += duration
    }
    
    // ... 实现代码
}
```

---

## 结论

### 当前方案评估

**优点**:
- ✅ 实现简单
- ✅ 灵活性高
- ✅ 网络流量低
- ✅ 支持动态创建

**缺点**:
- ⚠️ 大规模场景下性能中等
- ⚠️ 内存占用可能较高
- ⚠️ 回调可能阻塞主线程

### 建议

1. **短期**: 实施图像缓存和增加预注册
2. **中期**: 如果性能不足，考虑优化策略
3. **长期**: 如果仍不足，考虑后端预渲染

### 性能目标

- **小规模** (< 1000 像素): 当前方案足够
- **中规模** (1000-10000 像素): 需要优化
- **大规模** (> 10000 像素): 考虑后端预渲染

---

**分析完成时间**：2026-01-09  
**分析结论**：当前方案适合中小规模场景，大规模场景需要优化或考虑后端预渲染
