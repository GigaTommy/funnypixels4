# 赛事活动区域可视化方案

## 📊 当前状态分析

### ✅ 已有实现

**文件**：`MapLibreMapView.swift` (第530-617行)

**现有功能**：
```swift
// 1. 图层已创建
setupEventLayers(style:) {
    - event-war-source (数据源)
    - event-war-fill (填充层，红色30%透明度)
    - event-war-outline (边框线，红色2px)
}

// 2. 数据已加载
updateEventSource(with events:) {
    - 读取 event.boundary (GeoJSON多边形)
    - 创建 MLNPolygonFeature
    - 更新到地图
}
```

---

### ❌ 核心问题

#### 问题1：只显示参与的活动
```swift
// 当前代码（第579行）
let participatingEvents = events.filter { $0.isParticipant }
```

**影响**：
- ❌ 用户未报名 → 看不到活动区域
- ❌ 无法发现附近的新活动
- ❌ 用户体验差，参与度低

#### 问题2：缺少区分度
- ❌ 所有活动用同样的红色
- ❌ 无法区分：参与的 vs 未参与的
- ❌ 无法区分：进行中 vs 即将开始 vs 即将结束

#### 问题3：缺少信息展示
- ❌ 没有活动名称标注
- ❌ 没有用户贡献数据
- ❌ 没有活动进度信息
- ❌ 没有距离提示

---

## 🎯 解决方案

### 方案A：优化现有图层（推荐）⭐

**优势**：
- ✅ 利用MapLibre原生能力，性能最优
- ✅ 支持数据驱动样式（data-driven styling）
- ✅ GPU加速渲染
- ✅ 改动最小

**实现步骤**：

#### 1. 显示所有活动区域

```swift
// 修改前
let participatingEvents = events.filter { $0.isParticipant }

// 修改后
let allEvents = events  // 显示所有活动
```

#### 2. 数据驱动的样式区分

```swift
// 设置多种属性用于样式区分
polygon.attributes = [
    "id": event.id,
    "title": event.title,
    "type": event.type,
    "status": event.status,
    "isParticipant": event.isParticipant,  // ✅ 新增
    "isEndingSoon": minutesRemaining <= 10,
    "isNearby": distance < 1000  // ✅ 新增：1km内
]
```

#### 3. 分层样式设计

```swift
// Fill Layer - 使用条件表达式
fillLayer.fillColor = NSExpression(format:
    "TERNARY(isParticipant == YES, %@, " +
    "TERNARY(isNearby == YES, %@, %@))",
    UIColor(red: 0.2, green: 0.6, blue: 1.0, alpha: 0.3),  // 参与：蓝色
    UIColor(red: 1.0, green: 0.6, blue: 0.0, alpha: 0.25), // 附近：橙色
    UIColor(red: 0.5, green: 0.5, blue: 0.5, alpha: 0.15)  // 其他：灰色
)

// Line Layer - 边框样式
lineLayer.lineColor = NSExpression(format:
    "TERNARY(isParticipant == YES, %@, " +
    "TERNARY(isEndingSoon == YES, %@, %@))",
    UIColor.systemBlue,   // 参与：蓝色边框
    UIColor.systemRed,    // 即将结束：红色边框（闪烁警告）
    UIColor.systemGray    // 其他：灰色边框
)

lineLayer.lineWidth = NSExpression(format:
    "TERNARY(isParticipant == YES, 3.0, 2.0)"
)
```

#### 4. 添加活动名称标注

```swift
// Symbol Layer - 显示活动名称
let symbolLayer = MLNSymbolStyleLayer(identifier: "event-labels", source: source)

symbolLayer.text = NSExpression(forKeyPath: "title")
symbolLayer.textColor = NSExpression(forConstantValue: UIColor.white)
symbolLayer.textFontSize = NSExpression(forConstantValue: 14)
symbolLayer.textHaloColor = NSExpression(forConstantValue: UIColor.black)
symbolLayer.textHaloWidth = NSExpression(forConstantValue: 1.5)
symbolLayer.textAllowsOverlap = NSExpression(forConstantValue: false)

style.addLayer(symbolLayer)
```

#### 5. 添加用户贡献数据覆盖层（可选）

```swift
// 为参与的活动显示用户统计
if event.isParticipant, let stats = event.userStats {
    // 在区域中心显示统计卡片
    let annotation = MLNPointAnnotation()
    annotation.coordinate = event.centerCoordinate
    annotation.title = "\(stats.pixels)px"
    annotation.subtitle = "Rank #\(stats.rank)"
}
```

---

### 方案B：叠加SwiftUI信息层

**用途**：在地图上叠加丰富的UI元素

```swift
// EventRegionOverlay.swift
struct EventRegionOverlay: View {
    let event: EventService.Event
    let userStats: UserEventStats?

    var body: some View {
        VStack(spacing: 4) {
            // 活动图标
            Image(systemName: eventIcon)

            // 用户贡献
            if let stats = userStats {
                Text("\(stats.pixels)px")
                    .font(.caption.bold())
                Text("Rank #\(stats.rank)")
                    .font(.caption2)
            }

            // 距离
            Text(distanceText)
                .font(.caption2)
        }
        .padding(8)
        .background(.ultraThinMaterial)
        .cornerRadius(8)
    }
}
```

---

## 🎨 视觉设计方案

### 颜色方案

#### 填充色（Fill Color）

| 状态 | 颜色 | 透明度 | 说明 |
|------|------|---------|------|
| **参与中** | 蓝色 `#3399FF` | 30% | 用户已报名的活动 |
| **附近活动** | 橙色 `#FF9900` | 25% | 1km内未参与的活动 |
| **同城活动** | 灰色 `#888888` | 15% | 50km内的其他活动 |
| **即将结束** | 红色 `#FF3333` | 35% | 剩余<10分钟（闪烁） |

#### 边框色（Stroke Color）

| 状态 | 颜色 | 宽度 | 样式 |
|------|------|------|------|
| **参与中** | 蓝色 | 3px | 实线 |
| **即将结束** | 红色 | 3px | 虚线（动画） |
| **其他活动** | 灰色 | 2px | 实线 |

### 图层堆叠顺序

```
顶层
  ↑ 像素点（已有）
  ↑ 活动标注（名称、统计）
  ↑ 活动边框（outline）
  ↑ 活动填充（fill）
  ↑ 地图底图
底层
```

---

## 💾 数据结构增强

### Event模型扩展

```swift
extension EventService.Event {
    /// 活动中心坐标（用于标注）
    var centerCoordinate: CLLocationCoordinate2D? {
        config?.area?.center.flatMap {
            CLLocationCoordinate2D(latitude: $0.lat, longitude: $0.lng)
        }
    }

    /// 计算用户到活动中心的距离
    func distanceFromUser() -> Double? {
        guard let center = centerCoordinate,
              let userLocation = LocationManager.shared.currentLocation else {
            return nil
        }

        let eventLocation = CLLocation(latitude: center.latitude, longitude: center.longitude)
        return userLocation.distance(from: eventLocation)
    }

    /// 是否在附近（1km内）
    var isNearby: Bool {
        guard let distance = distanceFromUser() else { return false }
        return distance < 1000
    }
}
```

### 用户统计数据

```swift
struct UserEventStats {
    let eventId: String
    let pixels: Int          // 用户绘制的像素数
    let rank: Int            // 用户排名
    let contribution: Double // 贡献百分比
    let lastUpdate: Date
}
```

---

## 🚀 性能优化策略

### 1. 按需加载
```swift
// 只显示视口内+一定范围的活动
func visibleEvents(in viewport: CGRect, buffer: Double = 10_000) -> [EventService.Event] {
    activeEvents.filter { event in
        // 检查活动中心是否在视口附近
        guard let center = event.centerCoordinate else { return false }
        let distance = userLocation.distance(from: CLLocation(latitude: center.latitude, longitude: center.longitude))
        return distance < buffer
    }
}
```

### 2. LOD（细节层次）
```swift
// 根据缩放级别调整显示细节
if mapView.zoomLevel < 12 {
    // 只显示边框
    fillLayer.isVisible = false
    lineLayer.isVisible = true
} else if mapView.zoomLevel < 15 {
    // 显示边框+填充
    fillLayer.isVisible = true
    symbolLayer.isVisible = false
} else {
    // 显示所有（边框+填充+标注）
    fillLayer.isVisible = true
    symbolLayer.isVisible = true
}
```

### 3. 图层复用
```swift
// 不重新创建图层，只更新数据
if let source = style.source(withIdentifier: "event-war-source") as? MLNShapeSource {
    source.shape = shapeCollection  // 只更新数据
}
```

---

## 📱 交互设计

### 1. 点击活动区域
```swift
func mapView(_ mapView: MLNMapView, didSelect annotation: MLNAnnotation) {
    // 显示活动详情底部抽屉
    showEventDetailSheet(for: annotation.eventId)
}
```

### 2. 长按显示统计
```swift
// 长按活动区域显示详细统计
UILongPressGestureRecognizer -> EventStatsPopover
```

### 3. 区域高亮
```swift
// 鼠标悬停/触摸时高亮边框
lineLayer.lineWidth = NSExpression(format:
    "TERNARY($id == %@, 4.0, 2.0)", selectedEventId
)
```

---

## 🎯 实现优先级

### P0 - 核心功能（必须）
- [x] 显示所有活动区域（移除isParticipant过滤）
- [x] 颜色区分参与状态
- [x] 添加边框线

### P1 - 重要增强
- [ ] 活动名称标注
- [ ] 距离计算和显示
- [ ] 即将结束闪烁效果
- [ ] LOD优化

### P2 - 锦上添花
- [ ] 用户贡献数据叠加
- [ ] 点击查看详情
- [ ] 区域高亮交互
- [ ] 动画过渡效果

---

## 📋 实施检查清单

### 代码修改
- [ ] 修改 `updateEventSource` 移除参与过滤
- [ ] 添加 `isNearby` 距离计算
- [ ] 更新 `setupEventLayers` 添加数据驱动样式
- [ ] 添加 Symbol Layer 用于标注
- [ ] 实现 LOD 缩放优化

### 测试验证
- [ ] 未参与活动可见性
- [ ] 不同状态颜色正确
- [ ] 缩放级别下的显示
- [ ] 性能测试（100+活动）
- [ ] 多语言标注

### 文档更新
- [ ] 更新README说明活动可视化
- [ ] 添加颜色方案文档
- [ ] 性能优化指南

---

## 🎉 预期效果

### 用户体验提升
- ✅ 一目了然看到所有活动区域
- ✅ 清晰区分参与/未参与/附近活动
- ✅ 即时了解活动距离和进度
- ✅ 吸引用户探索和参与新活动

### 技术指标
- ✅ 渲染性能：GPU加速，60fps
- ✅ 内存占用：<50MB（100个活动）
- ✅ 加载时间：<500ms（初次）
- ✅ 更新延迟：<100ms（实时）

---

**推荐实施顺序**：
1. P0功能（核心可视化）
2. 测试验证
3. P1功能（体验增强）
4. P2功能（锦上添花）
