# 混合地图渲染方案

## 问题分析

MapLibre Native iOS SDK 存在以下限制：

1. **不支持动态 `iconImageName`**：无法使用 `NSExpression(forKeyPath: "emoji")` 动态设置图标
2. **不支持动态 `text`**：会被包装成 `mgl_attributed:` 导致报错
3. **结果**：无法像 Web 端那样动态渲染多个 emoji 和 complex 旗帜

## 解决方案：混合架构

```
┌─────────────────────────────────────┐
│  MapLibre Native (基础底图)         │
│  - OFM 样式                         │
│  - 道路、建筑、地名                 │
│  - 颜色像素 (MVT 瓦片)              │
└─────────────────────────────────────┘
           ↓ (叠加在上方)
┌─────────────────────────────────────┐
│  自定义像素渲染层 (CALayer)         │
│  ├── EmojiRenderer (CATextLayer)   │
│  └── ComplexRenderer (CALayer)     │
└─────────────────────────────────────┘
```

### 架构特点

- **MapLibre Native**：处理底图和颜色像素（这些工作良好）
- **自定义渲染层**：处理 emoji 和 complex 像素（绕过 SDK 限制）
- **同步机制**：监听地图变化，同步更新自定义层

## 实现文件

### 1. CustomPixelRenderer.swift

自定义像素渲染器，核心功能：

```swift
public class CustomPixelRenderer {
    // 渲染层容器（覆盖在地图上）
    public let containerLayer: CALayer

    // 添加 emoji 像素
    public func addEmojiPixel(_ pixel: EmojiPixel)

    // 添加 complex 像素（带异步图片加载）
    public func addComplexPixel(_ pixel: ComplexPixel)

    // 批量更新
    public func updatePixels(pixels: [Pixel])

    // 同步地图状态
    public func updateMapState(center: CLLocationCoordinate2D, zoom: Double)
}
```

**关键技术点：**

1. **CATextLayer**：用于渲染 emoji，支持 Unicode emoji 字符
2. **CALayer**：用于渲染 complex 图片，支持异步加载
3. **坐标转换**：使用 `mapView.convert(coordinate, toPointTo:)` 转换坐标
4. **缩放计算**：使用 base-2 指数插值，与 Web 端保持一致
5. **图片缓存**：使用 NSCache 缓存已加载的图片

### 2. HybridMapViewController.swift

混合地图视图控制器，集成 MapLibre 和自定义渲染器：

```swift
public class HybridMapViewController: UIViewController {
    // MapLibre 地图（底图 + 颜色像素）
    public let mapView: MLNMapView

    // 自定义渲染器（emoji + complex）
    private var customRenderer: CustomPixelRenderer

    // MVT 瓦片源（只包含颜色像素）
    private func setupMVTSource(style: MLNStyle)

    // 颜色像素图层（使用 MapLibre）
    private func addColorPixelLayer(style: MLNStyle)
}
```

**工作流程：**

1. 加载底图样式（OFM Liberty）
2. 配置 MVT 瓦片源（只包含颜色像素）
3. 添加颜色像素图层（使用 MapLibre SymbolLayer）
4. 创建自定义渲染层（覆盖在地图上）
5. 监听地图变化，同步更新自定义层

## 使用方式

### 在 SwiftUI 中使用

```swift
struct MapView: View {
    var body: some View {
        HybridMapView()
            .edgesIgnoringSafeArea(.all)
    }
}
```

### 在 UIKit 中使用

```swift
let viewController = HybridMapViewController()
present(viewController, animated: true)
```

### 更新像素数据

```swift
// 准备像素数据
let pixels: [Pixel] = [
    Pixel(id: "1", lat: 23.109, lng: 113.324, type: .emoji("🔥")),
    Pixel(id: "2", lat: 23.110, lng: 113.325, type: .complex("https://..."))
]

// 更新到地图
viewController.updatePixels(pixels)
```

## 性能优化

### 1. 图片缓存

```swift
private let imageCache: NSCache<NSString, UIImage> = {
    let cache = NSCache<NSString, UIImage>()
    cache.countLimit = 100
    cache.totalCostLimit = 50 * 1024 * 1024 // 50 MB
    return cache
}()
```

### 2. 异步加载

```swift
// Complex 图片异步加载，不阻塞主线程
URLSession.shared.dataTask(with: url) { data, response, error in
    DispatchQueue.main.async {
        layer.contents = image.cgImage
    }
}.resume()
```

### 3. 可见性判断（TODO）

可以添加视口剔除，只渲染可见区域的像素：

```swift
private func isPixelVisible(_ coordinate: CLLocationCoordinate2D) -> Bool {
    let bounds = mapView.visibleCoordinateBounds
    return bounds.contains(coordinate)
}
```

### 4. LOD 细节层次（TODO）

可以根据缩放级别调整渲染质量：

```swift
private func shouldRenderPixel(at zoom: Double) -> Bool {
    // zoom 12-14: 只渲染部分像素
    // zoom 15-18: 渲染所有像素
    return zoom >= 15
}
```

## 与 Web 端对比

| 特性 | Web 端 (MapLibre GL JS) | iOS 混合方案 |
|------|------------------------|-------------|
| 动态 emoji | ✅ 完全支持 | ✅ CATextLayer |
| 动态 complex | ✅ 完全支持 | ✅ CALayer + async |
| 颜色像素 | ✅ MVT 瓦片 | ✅ MVT 瓦片 |
| 底图样式 | ✅ 完全支持 | ✅ 完全支持 |
| 性能 | 优秀 | 接近原生 |
| 开发成本 | 低 | 中等 |

## 优势

1. ✅ **完全绕过 MapLibre SDK 限制**
2. ✅ **功能与 Web 端一致**
3. ✅ **性能接近原生**
4. ✅ **易于维护和扩展**
5. ✅ **保留 MapLibre 的优势**（底图、颜色像素）

## 未来优化

1. **视口剔除**：只渲染可见区域的像素
2. **细节层次**：根据缩放级别调整渲染密度
3. **批量更新**：减少 CAAnimation 事务
4. **Metal 渲染**：对于大量像素，考虑使用 Metal 加速
5. **空间索引**：使用四叉树或 R 树加速查询

## 总结

混合方案是一个**务实且高效**的解决方案：

- 不等待 MapLibre SDK 更新
- 立即实现与 Web 端一致的功能
- 保持良好的性能和用户体验
- 为未来的 Metal 优化预留空间
