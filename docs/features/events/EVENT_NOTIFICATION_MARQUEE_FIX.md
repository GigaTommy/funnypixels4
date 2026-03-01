# 赛事活动跑马灯通知修复方案

## 📊 问题分析

### 当前实现问题

1. **位置不在屏幕顶部**
   - 文件：`MapTabContent.swift` (第263行)
   - 当前：`.padding(.top, 60)` - 距离顶部60px
   - 问题：SafeArea顶部应该更靠近状态栏下方

2. **无城市过滤逻辑**
   - 文件：`EventManager.swift` (第199-215行)
   - 当前：`getActiveEvents()` 返回所有活跃赛事
   - 问题：应该只显示用户所在城市的活动

3. **无跑马灯轮播**
   - 文件：`MapTabContent.swift` (第259-271行)
   - 当前：只显示第一个活动 `activeEvents.first(where: ...)`
   - 问题：多个活动时应该滚动轮播

### 数据结构分析

```swift
// Event.config.area
struct EventArea: Codable {
    let type: String
    let center: EventCenter?  // 活动中心坐标
    let radius: Int?          // 活动范围半径（米）
    let name: String?         // 活动区域名称（如"广东工大"）
}

struct EventCenter: Codable {
    let lat: Double
    let lng: Double
}
```

## ✅ 解决方案

### 1. 调整通知位置（更靠近顶部）

**修改文件**：`MapTabContent.swift`

```swift
// 当前（第263行）
.padding(.top, 60)

// 修改为
.padding(.top, 8)  // SafeArea顶部8px，紧贴状态栏下方
```

### 2. 添加城市过滤逻辑

**在EventManager中添加**：

```swift
/// 获取用户所在城市的活动（基于距离）
var localCityEvents: [EventService.Event] {
    guard let userLocation = LocationManager.shared.currentLocation else {
        return activeEvents
    }

    let cityRadius = 50_000.0 // 50公里内视为同城

    return activeEvents.filter { event in
        guard let center = event.config?.area?.center else { return false }
        let eventLocation = CLLocation(latitude: center.lat, longitude: center.lng)
        let userLoc = CLLocation(latitude: userLocation.coordinate.latitude,
                                longitude: userLocation.coordinate.longitude)
        let distance = userLoc.distance(from: eventLocation)
        return distance <= cityRadius
    }
}
```

### 3. 创建跑马灯轮播组件

**新文件**：`EventMarqueeNotification.swift`

功能特性：
- 自动轮播多个活动（3秒切换）
- 水平滚动文字动画
- 点击查看详情
- 可展开/收起
- 显示活动状态和倒计时

### 4. 修改MapTabContent

**替换原有的EventPreannounceHUD**：

```swift
// 旧代码（第258-271行）
if eventManager.nearbyEvent == nil, let upcomingEvent = ... {
    EventPreannounceHUD(event: upcomingEvent)
}

// 新代码
let localEvents = eventManager.localCityEvents.filter { $0.status == "published" || $0.status == "active" }
if !localEvents.isEmpty {
    EventMarqueeNotification(events: localEvents)
        .padding(.top, 8)
        .padding(.leading, 16)
}
```

## 📁 需要修改的文件

1. ✅ `EventManager.swift` - 添加 `localCityEvents` 计算属性
2. ✅ `EventMarqueeNotification.swift` - 新建跑马灯组件
3. ✅ `MapTabContent.swift` - 替换EventPreannounceHUD为跑马灯
4. ✅ 本地化文件 - 添加跑马灯相关字符串

## 🎯 效果预期

1. **位置**：通知条紧贴屏幕左上角（SafeArea下方8px）
2. **过滤**：只显示用户当前位置50公里内的活动
3. **轮播**：多个活动时每3秒自动切换，文字滚动显示
4. **交互**：点击展开详情，可收起为小图标
5. **状态**：显示活动状态（预告/进行中）和倒计时

## 🔄 与"赛事中心"的联动

- **个人中心** → **赛事中心** (`EventCenterView`)
  - 显示所有活跃赛事（不限城市）
  - 我的赛事（已报名）
  - 已结束赛事

- **地图跑马灯** → 只显示同城活动（50km内）
  - 点击可跳转到赛事详情
  - 赛事详情中可报名参加

## 📝 实现优先级

1. **P0 - 核心功能**
   - ✅ 调整通知位置（top: 8）
   - ✅ 添加城市过滤逻辑
   - ✅ 创建基础跑马灯组件

2. **P1 - 增强功能**
   - ⏳ 文字滚动动画
   - ⏳ 自动轮播切换
   - ⏳ 展开/收起交互

3. **P2 - 优化体验**
   - ⏳ 跑马灯点击音效
   - ⏳ 切换动画优化
   - ⏳ 智能显示逻辑（避免遮挡重要信息）
