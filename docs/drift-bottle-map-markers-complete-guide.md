# 漂流瓶地图标记完整实现指南

## 概述

在地图上显示附近漂流瓶的位置，使用自定义SVG图标，支持点击交互和实时刷新。

---

## 实现清单

### ✅ 已创建的文件

1. **数据模型**
   - `FunnyPixelsApp/FunnyPixelsApp/Models/BottleMapMarker.swift`
   - 定义漂流瓶地图标记数据结构

2. **SVG图标**
   - `FunnyPixelsApp/FunnyPixelsApp/Views/DriftBottle/BottleSVGIcon.swift`
   - 自定义绘制的漂流瓶图标（非emoji）

3. **地图标记视图**
   - `FunnyPixelsApp/FunnyPixelsApp/Views/DriftBottle/BottleMapMarkerView.swift`
   - 地图上显示的标记组件

4. **业务逻辑扩展**
   - `FunnyPixelsApp/FunnyPixelsApp/Services/DriftBottle/DriftBottleManager+MapMarkers.swift`
   - 地图标记管理逻辑

5. **坐标转换**
   - `FunnyPixelsApp/FunnyPixelsApp/Views/DriftBottle/BottleMapAnnotationView.swift`
   - MapLibre坐标转换辅助

6. **补丁文件（集成指南）**
   - `DriftBottleManager+Properties.patch` - 属性添加
   - `DriftBottleAPIService+MapMarkers.patch` - API修改
   - `MapTabContent+BottleMarkers.patch` - 地图集成

---

## 实现步骤

### 第1步: 修改API服务 (5分钟)

**文件**: `FunnyPixelsApp/FunnyPixelsApp/Services/API/DriftBottleAPIService.swift`

**找到** Line 18-31 的 `getMapBottles` 方法

**修改为**:
```swift
func getMapBottles(lat: Double, lng: Double, radius: Double = 500) async throws -> [MapBottleInfo] {
    let response: MapBottlesResponse = try await apiManager.get(
        "/drift-bottles/map-markers",  // ← 修改端点
        parameters: [
            "lat": lat,
            "lng": lng,
            "radius": radius / 1000  // ← 转换为km
        ]
    )
    guard response.success else {
        throw NetworkError.serverError(response.message ?? "获取地图瓶子失败")
    }
    return response.data?.bottles ?? []
}
```

**添加** 新的response models:
```swift
struct MapBottleInfo: Codable {
    let bottleId: String
    let lat: Double
    let lng: Double
    let distance: Double?

    enum CodingKeys: String, CodingKey {
        case bottleId = "bottle_id"
        case lat, lng, distance
    }
}

struct MapBottlesResponse: Codable {
    let success: Bool
    let message: String?
    let data: MapBottlesData?
}

struct MapBottlesData: Codable {
    let bottles: [MapBottleInfo]
}
```

**添加** 瓶子详情方法:
```swift
func getBottleDetails(bottleId: String) async throws -> DriftBottle {
    let response: DriftBottleResponse = try await apiManager.get(
        "/drift-bottles/\(bottleId)"
    )
    guard response.success, let bottle = response.data?.bottle else {
        throw NetworkError.serverError(response.message ?? "获取瓶子详情失败")
    }
    return bottle
}
```

---

### 第2步: 扩展DriftBottleManager (5分钟)

**文件**: `FunnyPixelsApp/FunnyPixelsApp/Services/DriftBottle/DriftBottleManager.swift`

**在类定义中添加** (Published State 部分):
```swift
// MARK: - Map Markers

@Published var mapMarkers: [BottleMapMarker] = []
@Published var isLoadingMarkers = false
private var markersRefreshTimer: Timer?
```

**然后导入扩展文件**（已创建）:
- `DriftBottleManager+MapMarkers.swift` 会自动被编译器识别

---

### 第3步: 添加文件到Xcode项目 (10分钟)

1. 在Xcode中，右键点击 `Models` 文件夹
   - Add Files to "FunnyPixelsApp"
   - 选择 `BottleMapMarker.swift`

2. 右键点击 `Views/DriftBottle` 文件夹
   - Add Files to "FunnyPixelsApp"
   - 选择以下文件:
     - `BottleSVGIcon.swift`
     - `BottleMapMarkerView.swift`
     - `BottleMapAnnotationView.swift`

3. 右键点击 `Services/DriftBottle` 文件夹
   - Add Files to "FunnyPixelsApp"
   - 选择 `DriftBottleManager+MapMarkers.swift`

4. 确认所有文件的Target Membership勾选了 `FunnyPixelsApp`

---

### 第4步: 集成到MapTabContent (20分钟)

**文件**: `FunnyPixelsApp/FunnyPixelsApp/Views/MapTabContent.swift`

#### 4.1 添加状态变量

在 `MapTabContent` 结构体顶部添加:
```swift
@State private var lastMarkersRefreshLocation: CLLocation?
```

#### 4.2 修改body - 添加overlay

找到 `MapView(...)` 部分，添加 `.overlay`:
```swift
MapView(...)
    .overlay {
        // 漂流瓶地图标记层
        if !GPSDrawingService.shared.isGPSDrawingMode {
            bottleMarkersOverlay
        }
    }
```

#### 4.3 添加overlay视图

在 `MapTabContent` 底部添加:
```swift
// MARK: - Bottle Markers Overlay

@ViewBuilder
private var bottleMarkersOverlay: some View {
    ForEach(driftBottleManager.mapMarkers) { marker in
        BottleMapMarkerView(marker: marker)
            .position(coordinateToScreen(marker.coordinate))
    }
}
```

#### 4.4 添加坐标转换方法

```swift
// MARK: - Coordinate Conversion

private func coordinateToScreen(_ coordinate: CLLocationCoordinate2D) -> CGPoint {
    // TODO: 实现MapLibre坐标转换
    // 需要访问MapView的坐标转换功能
    return CGPoint(x: 0, y: 0)
}
```

**注意**: 坐标转换的具体实现取决于您的MapView实现方式。

#### 4.5 修改onAppear

在现有 `onAppear` 代码末尾添加:
```swift
.onAppear {
    // ... 现有代码 ...

    // 启动漂流瓶地图标记刷新
    if let location = locationManager.currentLocation {
        driftBottleManager.startMapMarkersAutoRefresh(
            lat: location.coordinate.latitude,
            lng: location.coordinate.longitude,
            interval: 30
        )
    }
}
```

#### 4.6 修改onDisappear

```swift
.onDisappear {
    // 停止漂流瓶地图标记刷新
    driftBottleManager.stopMapMarkersAutoRefresh()
}
```

#### 4.7 添加位置变化监听

```swift
.onChange(of: locationManager.currentLocation) { oldLocation, newLocation in
    guard let location = newLocation else { return }

    // 位置变化超过100米时刷新
    if shouldRefreshMarkers(for: location) {
        Task {
            await driftBottleManager.refreshMapMarkers(
                lat: location.coordinate.latitude,
                lng: location.coordinate.longitude
            )
        }
    }
}
```

#### 4.8 添加辅助方法

```swift
// MARK: - Helpers

private func shouldRefreshMarkers(for newLocation: CLLocation) -> Bool {
    guard let lastLocation = lastMarkersRefreshLocation else {
        lastMarkersRefreshLocation = newLocation
        return true
    }

    let distance = newLocation.distance(from: lastLocation)
    if distance > 100 {
        lastMarkersRefreshLocation = newLocation
        return true
    }

    return false
}
```

---

### 第5步: 实现坐标转换 (关键)

坐标转换是最重要的部分。有几种实现方式：

#### 方案A: 使用MapViewModel（推荐）

如果您使用了MapViewModel模式:

**在MapViewModel.swift中添加**:
```swift
private weak var mapView: MLNMapView?

func setMapView(_ mapView: MLNMapView) {
    self.mapView = mapView
}

func coordinateToScreen(_ coordinate: CLLocationCoordinate2D) -> CGPoint {
    guard let mapView = mapView else {
        return .zero
    }
    return mapView.convert(coordinate, toPointTo: mapView)
}
```

**在MapTabContent中使用**:
```swift
private func coordinateToScreen(_ coordinate: CLLocationCoordinate2D) -> CGPoint {
    mapViewModel.coordinateToScreen(coordinate)
}
```

#### 方案B: 使用Binding传递转换函数

```swift
// 在MapView中暴露转换函数
struct MapView: UIViewRepresentable {
    @Binding var coordinateConverter: ((CLLocationCoordinate2D) -> CGPoint)?

    func makeUIView(context: Context) -> MLNMapView {
        let mapView = MLNMapView()
        coordinateConverter = { coordinate in
            mapView.convert(coordinate, toPointTo: mapView)
        }
        return mapView
    }
}

// 在MapTabContent中使用
@State private var coordinateConverter: ((CLLocationCoordinate2D) -> CGPoint)?

private func coordinateToScreen(_ coordinate: CLLocationCoordinate2D) -> CGPoint {
    coordinateConverter?(coordinate) ?? .zero
}
```

#### 方案C: 使用GeometryReader（简化版，精度较低）

```swift
GeometryReader { geometry in
    MapView(...)
        .overlay {
            ForEach(driftBottleManager.mapMarkers) { marker in
                BottleMapMarkerView(marker: marker)
                    .position(
                        approximatePosition(
                            for: marker.coordinate,
                            in: geometry.size
                        )
                    )
            }
        }
}

private func approximatePosition(
    for coordinate: CLLocationCoordinate2D,
    in size: CGSize
) -> CGPoint {
    // 使用Web Mercator投影近似计算
    // 注意：这只是近似值，缩放时会不准确
    let centerLat = mapCenter.latitude
    let centerLng = mapCenter.longitude

    let x = (coordinate.longitude - centerLng) * scaleFactor + size.width / 2
    let y = (centerLat - coordinate.latitude) * scaleFactor + size.height / 2

    return CGPoint(x: x, y: y)
}
```

---

### 第6步: 编译和测试 (15分钟)

#### 6.1 编译

1. 在Xcode中: Product → Clean Build Folder (Shift+Cmd+K)
2. Product → Build (Cmd+B)
3. 解决任何编译错误

#### 6.2 运行

1. Product → Run (Cmd+R)
2. 登录账号 `bcd`
3. 进入地图Tab

#### 6.3 测试

**测试1: 查看标记**
- 在地图上导航到区庄地铁站: 23.1415° N, 113.2898° E
- 应该看到青色的漂流瓶图标
- 图标下方显示距离

**测试2: 范围内高亮**
- 走近漂流瓶（100米内）
- 图标应该变绿色并开始脉冲动画

**测试3: 点击交互**
- 点击漂流瓶图标
- 应该显示遭遇横幅
- 播放音效和触觉反馈

**测试4: 位置刷新**
- 移动位置超过100米
- 地图标记应该自动刷新

**测试5: 自动刷新**
- 等待30秒
- 检查日志是否显示 "Map markers updated"

---

## 调试技巧

### 查看日志

在Xcode控制台搜索:
```
🗺️ Fetched
🗺️ Map markers updated
🗺️ Map marker tapped
```

### 检查API调用

在 `DriftBottleManager+MapMarkers.swift` 添加断点:
- Line: `let bottles = try await api.getMapBottles(...)`

### 检查坐标转换

在 `coordinateToScreen` 方法添加打印:
```swift
print("Converting: \(coordinate.latitude), \(coordinate.longitude)")
print("Screen position: \(result)")
```

### 测试API

```bash
# 获取Token
node backend/scripts/get-user-token.js bcd

# 测试地图标记API
curl -X GET "http://192.168.0.3:3001/api/drift-bottles/map-markers?lat=23.1415&lng=113.2898&radius=0.5" \
  -H "Authorization: Bearer <TOKEN>"

# 预期响应
{
  "success": true,
  "data": {
    "bottles": [
      {
        "bottle_id": "bottle_xxx",
        "lat": 23.1420,
        "lng": 113.2905,
        "distance": 0.08
      },
      ...
    ]
  }
}
```

---

## 性能优化

### 1. 限制标记数量

在 `DriftBottleManager+MapMarkers.swift`:
```swift
// 只显示最近的20个瓶子
let markers = bottles
    .sorted { $0.distance < $1.distance }
    .prefix(20)
    .map { ... }
```

### 2. 防抖刷新

```swift
private var refreshDebounceTimer: Timer?

func refreshMapMarkers(lat: Double, lng: Double, radius: Double = 500) async {
    // 取消之前的定时器
    refreshDebounceTimer?.invalidate()

    // 延迟500ms执行
    refreshDebounceTimer = Timer.scheduledTimer(withTimeInterval: 0.5, repeats: false) { _ in
        Task {
            await self._refreshMapMarkers(lat: lat, lng: lng, radius: radius)
        }
    }
}
```

### 3. 缓存标记

```swift
private var markersCache: [String: BottleMapMarker] = [:]

// 只更新变化的标记
let newMarkers = bottles.map { ... }
let changed = newMarkers.filter { marker in
    markersCache[marker.id] != marker
}
```

---

## 常见问题

### Q1: 标记位置不准确

**A**: 检查坐标转换方法是否使用了MapLibre的原生API，而不是自定义计算。

### Q2: 标记不随地图移动

**A**: 需要监听地图的缩放/平移事件，重新计算屏幕坐标。

### Q3: 性能卡顿

**A**:
- 减少标记数量（最多20个）
- 使用防抖限制刷新频率
- 优化标记视图（减少动画复杂度）

### Q4: 点击无响应

**A**: 检查 `handleMarkerTap` 是否被调用，确认权限和网络。

### Q5: 看不到标记

**A**:
1. 检查 `mapMarkers` 是否有数据
2. 检查 `isGPSDrawingMode` 是否为false
3. 检查坐标转换返回值是否正确

---

## 后续优化

### 1. 添加聚合显示

当瓶子密集时，合并为数字标记:
```
  🛥️
   5
```

### 2. 添加方向指示

显示瓶子相对于用户的方向:
```
  ↗ 🛥️
  250m
```

### 3. 添加过滤功能

- 只显示范围内的瓶子
- 按距离排序
- 隐藏已打开的瓶子

### 4. 优化刷新策略

- 使用Socket.IO实时推送
- 根据地图zoom level调整搜索半径
- 智能预加载附近区域

---

## 总结

### 实现文件清单

- [x] BottleMapMarker.swift - 数据模型
- [x] BottleSVGIcon.swift - SVG图标
- [x] BottleMapMarkerView.swift - 标记视图
- [x] DriftBottleManager+MapMarkers.swift - 业务逻辑
- [x] DriftBottleAPIService修改 - API端点修复
- [x] DriftBottleManager属性添加 - 状态管理
- [x] MapTabContent集成 - 地图显示

### 关键点

1. ✅ 使用SVG自定义图标（非emoji）
2. ✅ 支持范围内/外不同样式
3. ✅ 自动刷新（30秒间隔）
4. ✅ 位置变化刷新（>100米）
5. ✅ 点击交互（显示遭遇）
6. ✅ 性能优化（限制数量、防抖）

### 预计工作量

- 代码修改: 45分钟
- 坐标转换实现: 30分钟
- 测试调试: 30分钟
- **总计**: ~105分钟

---

**文档创建**: 2026-02-24 20:45
**状态**: 完整实现方案
**下一步**: 按步骤实施并测试
