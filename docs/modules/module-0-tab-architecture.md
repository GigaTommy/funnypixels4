# Module 0: Tab架构重构 - 完整技术方案

> **模块名称**: Tab架构重构（4 Tab + Sub-Tab导航系统）
> **优先级**: P0（最高，所有模块的基础）
> **工作量**: 1周（5个工作日）
> **依赖**: 无
> **状态**: 📝 设计中

---

## 目录

1. [产品需求细化](#1-产品需求细化)
2. [当前架构分析](#2-当前架构分析)
3. [目标架构设计](#3-目标架构设计)
4. [iOS技术实现](#4-ios技术实现)
5. [Sub-Tab组件设计](#5-sub-tab组件设计)
6. [跨Tab导航系统](#6-跨tab导航系统)
7. [Badge系统](#7-badge系统)
8. [状态管理方案](#8-状态管理方案)
9. [性能优化](#9-性能优化)
10. [实施步骤](#10-实施步骤)
11. [测试方案](#11-测试方案)
12. [验收标准](#12-验收标准)

---

## 1. 产品需求细化

### 1.1 功能需求

#### FR1: 4个主Tab

**需求描述**: 将现有5个Tab精简为4个Tab

| Tab序号 | Tab名称 | 图标 | 默认内容 | 优先级 |
|---------|--------|------|---------|--------|
| 1 | 地图 | `map.fill` | 地图视图（保持不变） | P0 |
| 2 | 动态 | `bubble.left.and.bubble.right.fill` | 默认显示"广场"子标签 | P0 |
| 3 | 联盟 | `flag.2.crossed.fill` | 默认显示"我的联盟"子标签 | P0 |
| 4 | 我的 | `person.circle.fill` | 默认显示"个人"子标签 | P0 |

**验收标准**:
- [ ] Tab Bar始终显示4个Tab，按顺序排列
- [ ] 每个Tab图标使用SF Symbol，选中/未选中状态清晰
- [ ] 点击Tab立即切换，无延迟
- [ ] 当前选中Tab有视觉高亮（图标变蓝、底部指示条）

---

#### FR2: Sub-Tab导航系统

**需求描述**: 3个Tab包含Sub-Tab子导航

**动态Tab - 3个子标签**:

| 子标签 | 英文Key | 默认选中 | 内容 |
|--------|--------|---------|------|
| 广场 | plaza | ✅ | Feed社交动态流 |
| 足迹 | tracks | ❌ | 个人Session记录（原历史Tab） |
| 数据 | data | ❌ | 数据可视化仪表盘 |

**联盟Tab - 2个子标签**:

| 子标签 | 英文Key | 默认选中 | 内容 |
|--------|--------|---------|------|
| 我的联盟 | myAlliance | ✅ | 联盟主页（已加入的联盟） |
| 发现 | discover | ❌ | 联盟搜索与推荐 |

**我的Tab - 3个子标签**:

| 子标签 | 英文Key | 默认选中 | 内容 |
|--------|--------|---------|------|
| 个人 | personal | ✅ | 个人主页与每日任务 |
| 排行 | leaderboard | ❌ | 排行榜（原排行榜Tab） |
| 更多 | more | ❌ | 设置与工具菜单 |

**验收标准**:
- [ ] Sub-Tab切换器始终显示在NavigationView顶部下方
- [ ] 切换器使用系统SegmentedControl样式
- [ ] 点击子标签立即切换内容，有平滑过渡动画
- [ ] 每次进入Tab时默认显示第1个子标签
- [ ] 切换Tab后回到该Tab，仍保持上次选中的子标签（状态保持）

---

#### FR3: 跨Tab导航（DeepLink）

**需求描述**: 支持从一个Tab跳转到另一个Tab的特定子标签

**核心场景**:

| 起点 | 操作 | 目标 | 携带参数 |
|------|------|------|---------|
| 地图 | Session结束弹窗点击"查看详情" | 动态Tab → 足迹子标签 | sessionId |
| 动态广场 | 点击Feed卡片的地图缩略图 | 地图Tab | 经纬度（飞往位置） |
| 我的排行 | 点击"去绘画"按钮 | 地图Tab | 无 |
| 联盟任务 | 点击任务"前往" | 地图Tab | 任务区域坐标 |
| 我的个人 | 点击"查看我的足迹" | 动态Tab → 足迹子标签 | 无 |

**验收标准**:
- [ ] 跨Tab导航立即生效，无需用户再次点击
- [ ] 目标Tab的Sub-Tab自动切换到指定子标签
- [ ] 携带的参数成功传递（如sessionId、经纬度）
- [ ] 导航有视觉反馈（过渡动画）

---

#### FR4: Badge动态更新

**需求描述**: Tab图标右上角显示未读Badge

**Badge规则**:

| Tab | Badge类型 | 触发条件 | 消失条件 |
|-----|----------|---------|---------|
| 地图 | 红点 | 附近有宝箱/限时活动进行中 | 用户领取宝箱/活动结束 |
| 动态 | 数字 | 新的点赞/评论/关注 | 用户查看动态Tab |
| 联盟 | 数字 | 新的联盟消息/申请待审批 | 用户查看对应消息 |
| 我的 | 红点 | 未完成每日任务/可领取奖励 | 用户完成任务/领取奖励 |

**验收标准**:
- [ ] Badge实时更新（收到通知后1秒内显示）
- [ ] 数字Badge最大显示99+
- [ ] Badge颜色为系统红色（#FF3B30）
- [ ] Badge位置在Tab图标右上角
- [ ] 用户进入对应Tab后，Badge自动消失（根据消失条件）

---

### 1.2 非功能需求

#### NFR1: 性能

- [ ] Tab切换响应时间 < 100ms
- [ ] Sub-Tab切换响应时间 < 50ms
- [ ] 内存占用：4个Tab全部初始化后 < 150MB
- [ ] 切换Tab时无卡顿（帧率保持60fps）

#### NFR2: 可访问性

- [ ] 所有Tab支持VoiceOver（朗读Tab名称）
- [ ] 图标与文字对比度符合WCAG AA标准
- [ ] 支持动态字体大小（Dynamic Type）

#### NFR3: 兼容性

- [ ] 支持iOS 16.0+
- [ ] 支持iPhone全系列（SE、标准、Plus/Max、Pro）
- [ ] 支持横屏模式（iPad未来扩展）

---

## 2. 当前架构分析

### 2.1 现有ContentView结构

**文件**: `FunnyPixelsApp/Views/ContentView.swift`

**当前实现**（推测）:

```swift
struct ContentView: View {
    @State private var selectedTab = 0

    var body: some View {
        TabView(selection: $selectedTab) {
            MapTabView()
                .tabItem {
                    Label("地图", systemImage: "map")
                }
                .tag(0)

            DrawingHistoryView()
                .tabItem {
                    Label("历史", systemImage: "clock.fill")
                }
                .tag(1)

            AllianceTabView()
                .tabItem {
                    Label("联盟", systemImage: "flag.2.crossed")
                }
                .tag(2)

            LeaderboardTabView()
                .tabItem {
                    Label("排行榜", systemImage: "chart.bar.fill")
                }
                .tag(3)

            ProfileTabView()
                .tabItem {
                    Label("我的", systemImage: "person.circle")
                }
                .tag(4)
        }
    }
}
```

### 2.2 现有问题分析

| 问题 | 描述 | 影响 |
|------|------|------|
| Tab过多 | 5个Tab接近iOS上限 | 用户认知负荷高 |
| 无Sub-Tab | 每个Tab只有单一视图 | 信息架构扁平，功能难扩展 |
| 无跨Tab导航 | 无法从一个Tab跳转到另一个Tab的特定位置 | 用户体验割裂 |
| Tag使用Int | `tag(0), tag(1)...` 不利于维护 | 代码可读性差，易出错 |
| 无状态保持 | 切换Tab后状态丢失 | 用户体验差（如滚动位置重置） |
| 无Badge系统 | 无法提醒用户未读信息 | 用户回访率低 |

---

## 3. 目标架构设计

### 3.1 整体架构

```
ContentView (Root)
├─ @StateObject var appState: AppState
├─ @State var selectedTab: Tab = .map
│
├─ TabView(selection: $selectedTab)
│   ├─ MapTabView()
│   │   └─ 无Sub-Tab（保持现有结构）
│   │
│   ├─ FeedTabView()
│   │   ├─ @State var selectedSubTab: FeedSubTab = .plaza
│   │   ├─ NavigationView
│   │   │   ├─ VStack
│   │   │   │   ├─ SubTabPicker(selection: $selectedSubTab)
│   │   │   │   └─ switch selectedSubTab
│   │   │   │       ├─ .plaza → PlazaView()
│   │   │   │       ├─ .tracks → TracksView()
│   │   │   │       └─ .data → DataDashboardView()
│   │   │
│   ├─ AllianceTabView()
│   │   ├─ @State var selectedSubTab: AllianceSubTab = .myAlliance
│   │   ├─ NavigationView
│   │   │   ├─ VStack
│   │   │   │   ├─ SubTabPicker(selection: $selectedSubTab)
│   │   │   │   └─ switch selectedSubTab
│   │   │   │       ├─ .myAlliance → MyAllianceView()
│   │   │   │       └─ .discover → DiscoverAllianceView()
│   │   │
│   └─ ProfileTabView()
│       ├─ @State var selectedSubTab: ProfileSubTab = .personal
│       ├─ NavigationView
│       │   ├─ VStack
│       │   │   ├─ SubTabPicker(selection: $selectedSubTab)
│       │   │   └─ switch selectedSubTab
│       │   │       ├─ .personal → PersonalView()
│       │   │       ├─ .leaderboard → LeaderboardView()
│       │   │       └─ .more → MoreView()
│
└─ .environmentObject(appState) ← 全局状态注入
```

### 3.2 状态管理层级

```
AppState (ObservableObject)
├─ selectedTab: Tab
├─ feedSubTab: FeedSubTab
├─ allianceSubTab: AllianceSubTab
├─ profileSubTab: ProfileSubTab
├─ badgeCounts: [Tab: Int]
├─ navigationTarget: NavigationTarget? ← 跨Tab导航
│
└─ Methods:
    ├─ navigateToFeed(subTab: FeedSubTab, sessionId: Int?)
    ├─ navigateToMap(location: CLLocationCoordinate2D?)
    ├─ updateBadge(tab: Tab, count: Int)
    └─ clearBadge(tab: Tab)
```

---

## 4. iOS技术实现

### 4.1 核心数据结构

#### Tab枚举

**文件**: `Models/Navigation/Tab.swift`

```swift
import SwiftUI

enum Tab: String, CaseIterable, Identifiable {
    case map
    case feed
    case alliance
    case profile

    var id: String { rawValue }

    var title: String {
        switch self {
        case .map: return "地图"
        case .feed: return "动态"
        case .alliance: return "联盟"
        case .profile: return "我的"
        }
    }

    var icon: String {
        switch self {
        case .map: return "map"
        case .feed: return "bubble.left.and.bubble.right"
        case .alliance: return "flag.2.crossed"
        case .profile: return "person.circle"
        }
    }

    var iconFilled: String {
        switch self {
        case .map: return "map.fill"
        case .feed: return "bubble.left.and.bubble.right.fill"
        case .alliance: return "flag.2.crossed.fill"
        case .profile: return "person.circle.fill"
        }
    }
}
```

#### Sub-Tab枚举

**文件**: `Models/Navigation/SubTabs.swift`

```swift
import SwiftUI

// 动态Tab子标签
enum FeedSubTab: String, CaseIterable, Identifiable {
    case plaza
    case tracks
    case data

    var id: String { rawValue }

    var title: String {
        switch self {
        case .plaza: return "广场"
        case .tracks: return "足迹"
        case .data: return "数据"
        }
    }
}

// 联盟Tab子标签
enum AllianceSubTab: String, CaseIterable, Identifiable {
    case myAlliance
    case discover

    var id: String { rawValue }

    var title: String {
        switch self {
        case .myAlliance: return "我的联盟"
        case .discover: return "发现"
        }
    }
}

// 我的Tab子标签
enum ProfileSubTab: String, CaseIterable, Identifiable {
    case personal
    case leaderboard
    case more

    var id: String { rawValue }

    var title: String {
        switch self {
        case .personal: return "个人"
        case .leaderboard: return "排行"
        case .more: return "更多"
        }
    }
}
```

---

### 4.2 全局状态管理

**文件**: `Models/AppState.swift`

```swift
import SwiftUI
import Combine

class AppState: ObservableObject {
    // MARK: - Tab Selection
    @Published var selectedTab: Tab = .map

    // MARK: - Sub-Tab Selection
    @Published var feedSubTab: FeedSubTab = .plaza
    @Published var allianceSubTab: AllianceSubTab = .myAlliance
    @Published var profileSubTab: ProfileSubTab = .personal

    // MARK: - Badge Counts
    @Published var badgeCounts: [Tab: Int] = [:]

    // MARK: - Navigation Target (DeepLink)
    @Published var navigationTarget: NavigationTarget?

    // MARK: - Methods

    /// 导航到动态Tab的指定子标签
    func navigateToFeed(subTab: FeedSubTab = .plaza, sessionId: Int? = nil) {
        selectedTab = .feed
        feedSubTab = subTab

        if let sessionId = sessionId {
            // 传递参数到TracksView（通过NotificationCenter或环境变量）
            NotificationCenter.default.post(
                name: .scrollToSession,
                object: nil,
                userInfo: ["sessionId": sessionId]
            )
        }
    }

    /// 导航到地图Tab
    func navigateToMap(location: CLLocationCoordinate2D? = nil) {
        selectedTab = .map

        if let location = location {
            // 传递位置给MapTabView
            NotificationCenter.default.post(
                name: .flyToLocation,
                object: nil,
                userInfo: ["coordinate": location]
            )
        }
    }

    /// 导航到我的Tab的排行子标签
    func navigateToLeaderboard() {
        selectedTab = .profile
        profileSubTab = .leaderboard
    }

    /// 更新Badge数量
    func updateBadge(tab: Tab, count: Int) {
        badgeCounts[tab] = count > 0 ? count : nil
    }

    /// 清除Badge
    func clearBadge(tab: Tab) {
        badgeCounts[tab] = nil
    }
}

// MARK: - Navigation Target

enum NavigationTarget {
    case feedSession(sessionId: Int)
    case mapLocation(CLLocationCoordinate2D)
    case leaderboard
}

// MARK: - NotificationCenter Extensions

extension Notification.Name {
    static let scrollToSession = Notification.Name("scrollToSession")
    static let flyToLocation = Notification.Name("flyToLocation")
}
```

---

### 4.3 ContentView重构

**文件**: `Views/ContentView.swift`

```swift
import SwiftUI

struct ContentView: View {
    @StateObject private var appState = AppState()
    @EnvironmentObject var authManager: AuthManager

    var body: some View {
        TabView(selection: $appState.selectedTab) {
            // Tab 1: 地图
            MapTabView()
                .tabItem {
                    Label(Tab.map.title, systemImage: appState.selectedTab == .map ? Tab.map.iconFilled : Tab.map.icon)
                }
                .badge(badgeContent(for: .map))
                .tag(Tab.map)

            // Tab 2: 动态
            FeedTabView()
                .tabItem {
                    Label(Tab.feed.title, systemImage: appState.selectedTab == .feed ? Tab.feed.iconFilled : Tab.feed.icon)
                }
                .badge(badgeContent(for: .feed))
                .tag(Tab.feed)

            // Tab 3: 联盟
            AllianceTabView()
                .tabItem {
                    Label(Tab.alliance.title, systemImage: appState.selectedTab == .alliance ? Tab.alliance.iconFilled : Tab.alliance.icon)
                }
                .badge(badgeContent(for: .alliance))
                .tag(Tab.alliance)

            // Tab 4: 我的
            ProfileTabView()
                .tabItem {
                    Label(Tab.profile.title, systemImage: appState.selectedTab == .profile ? Tab.profile.iconFilled : Tab.profile.icon)
                }
                .badge(badgeContent(for: .profile))
                .tag(Tab.profile)
        }
        .environmentObject(appState)
        .onAppear {
            configureTabBarAppearance()
        }
    }

    // MARK: - Badge Content

    @ViewBuilder
    private func badgeContent(for tab: Tab) -> some View {
        if let count = appState.badgeCounts[tab] {
            if count > 99 {
                Text("99+")
            } else {
                Text("\(count)")
            }
        }
    }

    // MARK: - Tab Bar Appearance

    private func configureTabBarAppearance() {
        let appearance = UITabBarAppearance()
        appearance.configureWithDefaultBackground()

        // 选中状态颜色
        appearance.stackedLayoutAppearance.selected.iconColor = UIColor.systemBlue
        appearance.stackedLayoutAppearance.selected.titleTextAttributes = [
            .foregroundColor: UIColor.systemBlue
        ]

        // 未选中状态颜色
        appearance.stackedLayoutAppearance.normal.iconColor = UIColor.systemGray
        appearance.stackedLayoutAppearance.normal.titleTextAttributes = [
            .foregroundColor: UIColor.systemGray
        ]

        UITabBar.appearance().standardAppearance = appearance
        if #available(iOS 15.0, *) {
            UITabBar.appearance().scrollEdgeAppearance = appearance
        }
    }
}
```

---

## 5. Sub-Tab组件设计

### 5.1 通用SubTabPicker组件

**文件**: `Views/Components/SubTabPicker.swift`

```swift
import SwiftUI

struct SubTabPicker<T: RawRepresentable & CaseIterable & Identifiable>: View where T.RawValue == String, T.AllCases == [T] {
    @Binding var selection: T
    let tabs: [T]

    init(selection: Binding<T>, tabs: [T] = T.allCases) {
        self._selection = selection
        self.tabs = tabs
    }

    var body: some View {
        Picker("", selection: $selection) {
            ForEach(tabs) { tab in
                if let tabWithTitle = tab as? any SubTabProtocol {
                    Text(tabWithTitle.title).tag(tab)
                }
            }
        }
        .pickerStyle(.segmented)
        .padding(.horizontal)
        .padding(.vertical, 8)
    }
}

// MARK: - Protocol for Sub-Tabs

protocol SubTabProtocol {
    var title: String { get }
}

extension FeedSubTab: SubTabProtocol {}
extension AllianceSubTab: SubTabProtocol {}
extension ProfileSubTab: SubTabProtocol {}
```

**使用示例**:

```swift
// 在FeedTabView中
SubTabPicker(selection: $selectedSubTab)
```

---

### 5.2 FeedTabView实现

**文件**: `Views/FeedTab/FeedTabView.swift`

```swift
import SwiftUI

struct FeedTabView: View {
    @EnvironmentObject var appState: AppState
    @State private var selectedSubTab: FeedSubTab = .plaza

    var body: some View {
        NavigationView {
            VStack(spacing: 0) {
                // Sub-Tab切换器
                SubTabPicker(selection: $selectedSubTab)

                // 内容区域
                TabView(selection: $selectedSubTab) {
                    PlazaView()
                        .tag(FeedSubTab.plaza)

                    TracksView()
                        .tag(FeedSubTab.tracks)

                    DataDashboardView()
                        .tag(FeedSubTab.data)
                }
                .tabViewStyle(.page(indexDisplayMode: .never)) // 支持滑动切换
            }
            .navigationTitle("动态")
            .navigationBarTitleDisplayMode(.inline)
        }
        .onAppear {
            // 从AppState同步Sub-Tab选择
            selectedSubTab = appState.feedSubTab

            // 清除Badge
            appState.clearBadge(tab: .feed)
        }
        .onChange(of: selectedSubTab) { newValue in
            // 同步Sub-Tab选择到AppState
            appState.feedSubTab = newValue
        }
        .onChange(of: appState.feedSubTab) { newValue in
            // 监听外部导航（DeepLink）
            selectedSubTab = newValue
        }
    }
}
```

---

### 5.3 AllianceTabView实现

**文件**: `Views/AllianceTab/AllianceTabView.swift`

```swift
import SwiftUI

struct AllianceTabView: View {
    @EnvironmentObject var appState: AppState
    @State private var selectedSubTab: AllianceSubTab = .myAlliance

    var body: some View {
        NavigationView {
            VStack(spacing: 0) {
                // Sub-Tab切换器
                SubTabPicker(selection: $selectedSubTab)

                // 内容区域
                TabView(selection: $selectedSubTab) {
                    MyAllianceView()
                        .tag(AllianceSubTab.myAlliance)

                    DiscoverAllianceView()
                        .tag(AllianceSubTab.discover)
                }
                .tabViewStyle(.page(indexDisplayMode: .never))
            }
            .navigationTitle("联盟")
            .navigationBarTitleDisplayMode(.inline)
        }
        .onAppear {
            selectedSubTab = appState.allianceSubTab
            appState.clearBadge(tab: .alliance)
        }
        .onChange(of: selectedSubTab) { newValue in
            appState.allianceSubTab = newValue
        }
        .onChange(of: appState.allianceSubTab) { newValue in
            selectedSubTab = newValue
        }
    }
}
```

---

### 5.4 ProfileTabView实现

**文件**: `Views/ProfileTab/ProfileTabView.swift`

```swift
import SwiftUI

struct ProfileTabView: View {
    @EnvironmentObject var appState: AppState
    @State private var selectedSubTab: ProfileSubTab = .personal

    var body: some View {
        NavigationView {
            VStack(spacing: 0) {
                // Sub-Tab切换器
                SubTabPicker(selection: $selectedSubTab)

                // 内容区域
                TabView(selection: $selectedSubTab) {
                    PersonalView()
                        .tag(ProfileSubTab.personal)

                    LeaderboardView() // 迁移原LeaderboardTabView
                        .tag(ProfileSubTab.leaderboard)

                    MoreView()
                        .tag(ProfileSubTab.more)
                }
                .tabViewStyle(.page(indexDisplayMode: .never))
            }
            .navigationTitle("我的")
            .navigationBarTitleDisplayMode(.inline)
        }
        .onAppear {
            selectedSubTab = appState.profileSubTab
            appState.clearBadge(tab: .profile)
        }
        .onChange(of: selectedSubTab) { newValue in
            appState.profileSubTab = newValue
        }
        .onChange(of: appState.profileSubTab) { newValue in
            selectedSubTab = newValue
        }
    }
}
```

---

## 6. 跨Tab导航系统

### 6.1 导航触发示例

#### 场景1: 地图 → 动态足迹

**文件**: `Views/MapTab/SessionSummaryView.swift`

```swift
struct SessionSummaryView: View {
    @EnvironmentObject var appState: AppState
    let session: DrawingSession

    var body: some View {
        VStack {
            // ... Session摘要UI ...

            Button("查看详情") {
                // 导航到动态Tab的足迹子标签，并滚动到该Session
                appState.navigateToFeed(subTab: .tracks, sessionId: session.id)
            }
        }
    }
}
```

#### 场景2: 动态广场 → 地图

**文件**: `Views/FeedTab/FeedItemCard.swift`

```swift
struct FeedItemCard: View {
    @EnvironmentObject var appState: AppState
    let feedItem: FeedItem

    var body: some View {
        VStack(alignment: .leading) {
            // ... Feed卡片UI ...

            // 地图缩略图
            if let coordinate = feedItem.session?.centerCoordinate {
                Button {
                    // 导航到地图并飞往该位置
                    appState.navigateToMap(location: coordinate)
                } label: {
                    MapSnapshotView(coordinate: coordinate)
                }
            }
        }
    }
}
```

#### 场景3: 我的排行 → 地图

**文件**: `Views/ProfileTab/LeaderboardView.swift`

```swift
struct LeaderboardView: View {
    @EnvironmentObject var appState: AppState

    var body: some View {
        VStack {
            // ... 排行榜UI ...

            Button("去绘画") {
                appState.navigateToMap()
            }
        }
    }
}
```

---

### 6.2 接收导航参数

#### TracksView接收sessionId

**文件**: `Views/FeedTab/TracksView.swift`

```swift
struct TracksView: View {
    @State private var sessions: [DrawingSession] = []
    @State private var scrollToSessionId: Int?

    var body: some View {
        ScrollViewReader { proxy in
            List {
                ForEach(sessions) { session in
                    SessionRow(session: session)
                        .id(session.id)
                }
            }
            .onReceive(NotificationCenter.default.publisher(for: .scrollToSession)) { notification in
                if let sessionId = notification.userInfo?["sessionId"] as? Int {
                    scrollToSessionId = sessionId

                    // 滚动到指定Session
                    withAnimation {
                        proxy.scrollTo(sessionId, anchor: .center)
                    }

                    // 高亮效果（3秒后消失）
                    DispatchQueue.main.asyncAfter(deadline: .now() + 3) {
                        scrollToSessionId = nil
                    }
                }
            }
        }
    }
}
```

#### MapTabView接收位置

**文件**: `Views/MapTab/MapTabView.swift`

```swift
struct MapTabView: View {
    @StateObject private var mapViewModel = MapViewModel()

    var body: some View {
        MapView(viewModel: mapViewModel)
            .onReceive(NotificationCenter.default.publisher(for: .flyToLocation)) { notification in
                if let coordinate = notification.userInfo?["coordinate"] as? CLLocationCoordinate2D {
                    mapViewModel.flyTo(coordinate: coordinate, zoom: 15)
                }
            }
    }
}
```

---

## 7. Badge系统

### 7.1 Badge数据源

**文件**: `Services/BadgeService.swift`

```swift
import Foundation
import Combine

class BadgeService: ObservableObject {
    @Published var feedBadgeCount: Int = 0
    @Published var allianceBadgeCount: Int = 0
    @Published var profileBadgeCount: Int = 0

    private var cancellables = Set<AnyCancellable>()

    init() {
        // 监听Socket.IO通知
        listenForNotifications()

        // 定期轮询（备用方案）
        startPolling()
    }

    // MARK: - Listen for Real-time Notifications

    private func listenForNotifications() {
        // 假设使用SocketIOManager
        NotificationCenter.default.publisher(for: .newFeedInteraction)
            .sink { [weak self] _ in
                self?.fetchFeedBadgeCount()
            }
            .store(in: &cancellables)

        NotificationCenter.default.publisher(for: .newAllianceMessage)
            .sink { [weak self] _ in
                self?.fetchAllianceBadgeCount()
            }
            .store(in: &cancellables)
    }

    // MARK: - Polling (Fallback)

    private func startPolling() {
        Timer.publish(every: 60, on: .main, in: .common)
            .autoconnect()
            .sink { [weak self] _ in
                self?.fetchAllBadgeCounts()
            }
            .store(in: &cancellables)
    }

    // MARK: - Fetch Badge Counts

    func fetchAllBadgeCounts() {
        fetchFeedBadgeCount()
        fetchAllianceBadgeCount()
        fetchProfileBadgeCount()
    }

    private func fetchFeedBadgeCount() {
        // API调用: GET /api/notifications/unread?type=feed
        APIManager.shared.request(endpoint: .unreadNotifications(type: "feed")) { [weak self] (result: Result<UnreadCount, Error>) in
            switch result {
            case .success(let data):
                self?.feedBadgeCount = data.count
            case .failure:
                break
            }
        }
    }

    private func fetchAllianceBadgeCount() {
        // API调用: GET /api/notifications/unread?type=alliance
        APIManager.shared.request(endpoint: .unreadNotifications(type: "alliance")) { [weak self] (result: Result<UnreadCount, Error>) in
            switch result {
            case .success(let data):
                self?.allianceBadgeCount = data.count
            case .failure:
                break
            }
        }
    }

    private func fetchProfileBadgeCount() {
        // 检查未完成的每日任务
        // API调用: GET /api/daily-tasks/incomplete
        APIManager.shared.request(endpoint: .incompleteDailyTasks) { [weak self] (result: Result<IncompleteTasks, Error>) in
            switch result {
            case .success(let data):
                self?.profileBadgeCount = data.hasIncompleteTasks ? 1 : 0
            case .failure:
                break
            }
        }
    }
}

// MARK: - Models

struct UnreadCount: Codable {
    let count: Int
}

struct IncompleteTasks: Codable {
    let hasIncompleteTasks: Bool
}
```

---

### 7.2 Badge集成到AppState

**修改**: `Models/AppState.swift`

```swift
class AppState: ObservableObject {
    // ... 现有属性 ...

    @Published var badgeService = BadgeService()

    init() {
        // 监听BadgeService的变化，更新badgeCounts
        badgeService.$feedBadgeCount
            .sink { [weak self] count in
                self?.updateBadge(tab: .feed, count: count)
            }
            .store(in: &cancellables)

        badgeService.$allianceBadgeCount
            .sink { [weak self] count in
                self?.updateBadge(tab: .alliance, count: count)
            }
            .store(in: &cancellables)

        badgeService.$profileBadgeCount
            .sink { [weak self] count in
                self?.updateBadge(tab: .profile, count: count)
            }
            .store(in: &cancellables)
    }

    private var cancellables = Set<AnyCancellable>()
}
```

---

## 8. 状态管理方案

### 8.1 状态层级

```
ContentView
  └─ @StateObject appState: AppState (全局)
      ├─ selectedTab: Tab (哪个主Tab被选中)
      ├─ feedSubTab: FeedSubTab (动态Tab的子标签)
      ├─ allianceSubTab: AllianceSubTab (联盟Tab的子标签)
      ├─ profileSubTab: ProfileSubTab (我的Tab的子标签)
      └─ badgeCounts: [Tab: Int] (Badge数量)

FeedTabView
  └─ @State selectedSubTab: FeedSubTab (本地状态)
      ├─ 初始化时从appState.feedSubTab读取
      ├─ 切换时同步到appState.feedSubTab
      └─ 监听appState.feedSubTab变化（DeepLink）

PlazaView, TracksView, DataDashboardView
  └─ @EnvironmentObject appState: AppState (读取全局状态)
```

### 8.2 状态同步策略

**原则**:
1. **单一数据源**: `AppState`是所有Tab选择状态的唯一真相源
2. **双向绑定**: 本地`@State`与`AppState`双向同步
3. **DeepLink优先**: 外部导航（`appState.navigateToXXX()`）覆盖本地状态

**实现**:

```swift
// 在FeedTabView中
.onAppear {
    // 从AppState读取初始状态
    selectedSubTab = appState.feedSubTab
}
.onChange(of: selectedSubTab) { newValue in
    // 本地状态变化 → 同步到AppState
    appState.feedSubTab = newValue
}
.onChange(of: appState.feedSubTab) { newValue in
    // AppState变化（DeepLink） → 同步到本地状态
    selectedSubTab = newValue
}
```

---

## 9. 性能优化

### 9.1 ViewBuilder复用

**问题**: TabView会为每个Tab创建View实例，即使Tab未被选中

**优化**: 使用`.lazy`修饰符延迟初始化

```swift
TabView(selection: $appState.selectedTab) {
    MapTabView()
        .tag(Tab.map)

    FeedTabView()
        .tag(Tab.feed)
        .lazyView() // 延迟初始化，直到Tab被选中

    // ...
}

// 自定义View Modifier
extension View {
    func lazyView() -> some View {
        self.modifier(LazyViewModifier())
    }
}

struct LazyViewModifier: ViewModifier {
    @State private var isLoaded = false

    func body(content: Content) -> some View {
        Group {
            if isLoaded {
                content
            } else {
                Color.clear
                    .onAppear {
                        isLoaded = true
                    }
            }
        }
    }
}
```

**注意**: iOS 16+可以使用`.lazy`原生支持，但需要测试兼容性。

---

### 9.2 状态保持

**问题**: 切换Tab后，滚动位置、输入内容等状态丢失

**解决方案**: 使用`.id()`确保View实例不被销毁

```swift
TabView(selection: $appState.selectedTab) {
    FeedTabView()
        .id("feed") // 固定ID，避免重建
        .tag(Tab.feed)
}
```

---

### 9.3 Badge更新防抖

**问题**: 频繁的Badge更新导致UI重绘

**优化**: 使用Combine的`debounce`

```swift
badgeService.$feedBadgeCount
    .debounce(for: 0.5, scheduler: RunLoop.main) // 0.5秒内多次更新合并为1次
    .sink { [weak self] count in
        self?.updateBadge(tab: .feed, count: count)
    }
    .store(in: &cancellables)
```

---

## 10. 实施步骤

### 10.1 任务拆解

| Task ID | 任务描述 | 工作量 | 依赖 | 负责人 | 状态 |
|---------|---------|-------|------|-------|------|
| T0.1 | 创建Tab、SubTab枚举 | 0.5h | - | iOS Dev | ⬜ |
| T0.2 | 创建AppState类 | 1h | T0.1 | iOS Dev | ⬜ |
| T0.3 | 重构ContentView（4 Tab框架） | 2h | T0.2 | iOS Dev | ⬜ |
| T0.4 | 创建SubTabPicker通用组件 | 1h | T0.1 | iOS Dev | ⬜ |
| T0.5 | 实现FeedTabView（3子标签框架） | 2h | T0.3, T0.4 | iOS Dev | ⬜ |
| T0.6 | 实现AllianceTabView（2子标签框架） | 1.5h | T0.3, T0.4 | iOS Dev | ⬜ |
| T0.7 | 实现ProfileTabView（3子标签框架） | 2h | T0.3, T0.4 | iOS Dev | ⬜ |
| T0.8 | 迁移LeaderboardView到ProfileTab | 1h | T0.7 | iOS Dev | ⬜ |
| T0.9 | 实现跨Tab导航方法（AppState） | 2h | T0.2 | iOS Dev | ⬜ |
| T0.10 | 实现Badge系统（BadgeService） | 3h | - | iOS Dev | ⬜ |
| T0.11 | 集成Badge到AppState | 1h | T0.2, T0.10 | iOS Dev | ⬜ |
| T0.12 | 配置TabBar外观 | 1h | T0.3 | iOS Dev | ⬜ |
| T0.13 | 状态持久化（UserDefaults） | 1h | T0.2 | iOS Dev | ⬜ |
| T0.14 | 性能优化（lazy加载、防抖） | 2h | T0.3, T0.11 | iOS Dev | ⬜ |
| T0.15 | 单元测试（Tab切换、状态同步） | 3h | All | iOS Dev | ⬜ |
| T0.16 | UI测试（导航流程） | 2h | All | QA | ⬜ |
| T0.17 | 性能测试（内存、响应时间） | 2h | All | QA | ⬜ |
| **总计** | **26.5小时** | **~5个工作日** |

---

### 10.2 里程碑

**Milestone 1: 基础框架（Day 1-2）**
- [ ] T0.1 - T0.4完成
- [ ] 验收: 可以看到4个Tab，Sub-Tab切换器显示正常

**Milestone 2: Sub-Tab实现（Day 2-3）**
- [ ] T0.5 - T0.8完成
- [ ] 验收: 所有Sub-Tab可以切换，内容占位符正常

**Milestone 3: 导航与Badge（Day 3-4）**
- [ ] T0.9 - T0.12完成
- [ ] 验收: 跨Tab导航生效，Badge显示正常

**Milestone 4: 优化与测试（Day 4-5）**
- [ ] T0.13 - T0.17完成
- [ ] 验收: 所有测试通过，性能达标

---

### 10.3 每日计划

**Day 1**:
- 上午: T0.1 - T0.3（枚举、AppState、ContentView）
- 下午: T0.4 - T0.5（SubTabPicker、FeedTabView）
- 输出: 可运行的4 Tab框架，动态Tab有3个子标签

**Day 2**:
- 上午: T0.6 - T0.7（AllianceTabView、ProfileTabView）
- 下午: T0.8（迁移LeaderboardView）
- 输出: 所有Tab的Sub-Tab框架完成

**Day 3**:
- 上午: T0.9（跨Tab导航）
- 下午: T0.10 - T0.11（Badge系统）
- 输出: 导航与Badge功能完整

**Day 4**:
- 上午: T0.12 - T0.13（外观配置、状态持久化）
- 下午: T0.14（性能优化）
- 输出: 功能完整，性能优化

**Day 5**:
- 上午: T0.15（单元测试）
- 下午: T0.16 - T0.17（UI测试、性能测试）
- 输出: 测试完成，准备合并到主分支

---

## 11. 测试方案

### 11.1 单元测试

**文件**: `FunnyPixelsAppTests/AppStateTests.swift`

```swift
import XCTest
@testable import FunnyPixelsApp

class AppStateTests: XCTestCase {
    var appState: AppState!

    override func setUp() {
        super.setUp()
        appState = AppState()
    }

    func testDefaultTabSelection() {
        XCTAssertEqual(appState.selectedTab, .map)
    }

    func testNavigateToFeed() {
        appState.navigateToFeed(subTab: .tracks, sessionId: 123)
        XCTAssertEqual(appState.selectedTab, .feed)
        XCTAssertEqual(appState.feedSubTab, .tracks)
    }

    func testNavigateToMap() {
        let coordinate = CLLocationCoordinate2D(latitude: 30.0, longitude: 120.0)
        appState.navigateToMap(location: coordinate)
        XCTAssertEqual(appState.selectedTab, .map)
    }

    func testBadgeUpdate() {
        appState.updateBadge(tab: .feed, count: 5)
        XCTAssertEqual(appState.badgeCounts[.feed], 5)

        appState.clearBadge(tab: .feed)
        XCTAssertNil(appState.badgeCounts[.feed])
    }
}
```

---

### 11.2 UI测试

**文件**: `FunnyPixelsAppUITests/TabNavigationTests.swift`

```swift
import XCTest

class TabNavigationTests: XCTestCase {
    var app: XCUIApplication!

    override func setUp() {
        super.setUp()
        app = XCUIApplication()
        app.launch()
    }

    func testTabSwitching() {
        // 点击动态Tab
        app.tabBars.buttons["动态"].tap()
        XCTAssertTrue(app.navigationBars["动态"].exists)

        // 点击联盟Tab
        app.tabBars.buttons["联盟"].tap()
        XCTAssertTrue(app.navigationBars["联盟"].exists)
    }

    func testSubTabSwitching() {
        // 进入动态Tab
        app.tabBars.buttons["动态"].tap()

        // 点击"足迹"子标签
        app.buttons["足迹"].tap()
        // 验证足迹内容显示
        XCTAssertTrue(app.otherElements["TracksView"].exists)
    }

    func testDeepLink() {
        // 模拟从地图跳转到动态足迹
        // 这需要在app中触发导航，具体取决于触发方式
    }
}
```

---

### 11.3 性能测试

**测试指标**:

| 指标 | 目标 | 测试方法 |
|------|------|---------|
| Tab切换响应时间 | < 100ms | Instruments - Time Profiler |
| Sub-Tab切换响应时间 | < 50ms | Instruments - Time Profiler |
| 内存占用 | < 150MB | Instruments - Allocations |
| 帧率 | 60fps | Instruments - Core Animation |

**测试步骤**:
1. 使用Instruments打开Time Profiler
2. 快速点击切换4个Tab各10次
3. 记录每次切换的时间
4. 计算平均值和P95

---

## 12. 验收标准

### 12.1 功能验收

- [ ] **F1**: 底部显示4个Tab，顺序为：地图、动态、联盟、我的
- [ ] **F2**: 每个Tab的图标、文字正确，选中状态有蓝色高亮
- [ ] **F3**: 动态Tab有3个子标签，默认显示"广场"
- [ ] **F4**: 联盟Tab有2个子标签，默认显示"我的联盟"
- [ ] **F5**: 我的Tab有3个子标签，默认显示"个人"
- [ ] **F6**: 点击Sub-Tab切换器，内容立即切换，有平滑过渡
- [ ] **F7**: 从地图跳转到动态足迹，自动切换到"足迹"子标签
- [ ] **F8**: 从动态广场点击地图缩略图，跳转到地图Tab
- [ ] **F9**: Badge正确显示在Tab图标右上角
- [ ] **F10**: 进入对应Tab后，Badge自动消失
- [ ] **F11**: 切换Tab后再回来，仍保持上次的Sub-Tab选择

### 12.2 性能验收

- [ ] **P1**: Tab切换响应时间 < 100ms（测试10次取平均）
- [ ] **P2**: Sub-Tab切换响应时间 < 50ms（测试10次取平均）
- [ ] **P3**: 4个Tab全部初始化后，内存占用 < 150MB
- [ ] **P4**: 切换Tab时帧率保持60fps（无丢帧）
- [ ] **P5**: Badge更新延迟 < 1秒

### 12.3 UI验收

- [ ] **U1**: Tab Bar高度符合iOS HIG（49pt标准尺寸）
- [ ] **U2**: Sub-Tab切换器高度44pt，颜色使用系统蓝
- [ ] **U3**: Badge颜色为系统红色（#FF3B30）
- [ ] **U4**: Badge数字最大显示"99+"
- [ ] **U5**: 所有Tab支持VoiceOver，读出Tab名称

---

## 附录A: 文件结构

```
FunnyPixelsApp/
├─ Models/
│   ├─ Navigation/
│   │   ├─ Tab.swift                      # Tab枚举
│   │   ├─ SubTabs.swift                  # Sub-Tab枚举
│   │   └─ NavigationTarget.swift         # 导航目标
│   └─ AppState.swift                     # 全局状态
│
├─ Services/
│   └─ BadgeService.swift                 # Badge服务
│
├─ Views/
│   ├─ ContentView.swift                  # 主入口（4 Tab）
│   │
│   ├─ Components/
│   │   └─ SubTabPicker.swift             # 通用Sub-Tab切换器
│   │
│   ├─ FeedTab/
│   │   ├─ FeedTabView.swift              # 动态Tab容器
│   │   ├─ PlazaView.swift                # 广场（Feed）
│   │   ├─ TracksView.swift               # 足迹（原DrawingHistoryView）
│   │   └─ DataDashboardView.swift        # 数据仪表盘
│   │
│   ├─ AllianceTab/
│   │   ├─ AllianceTabView.swift          # 联盟Tab容器
│   │   ├─ MyAllianceView.swift           # 我的联盟
│   │   └─ DiscoverAllianceView.swift     # 发现联盟
│   │
│   ├─ ProfileTab/
│   │   ├─ ProfileTabView.swift           # 我的Tab容器
│   │   ├─ PersonalView.swift             # 个人主页
│   │   ├─ LeaderboardView.swift          # 排行榜（迁移）
│   │   └─ MoreView.swift                 # 更多菜单
│   │
│   └─ MapTab/
│       └─ MapTabView.swift               # 地图（保持不变）
│
└─ FunnyPixelsAppTests/
    ├─ AppStateTests.swift                # AppState单元测试
    └─ TabNavigationTests.swift           # UI测试
```

---

## 附录B: 常见问题

### Q1: 为什么不使用NavigationStack（iOS 16+）？

**A**: NavigationStack适合多层级的页面导航，但Tab架构是扁平的。使用TabView + NavigationView更符合设计模式，且兼容性更好（支持iOS 15）。

### Q2: Sub-Tab切换为什么使用TabView而不是自定义SwiftUI切换？

**A**: TabView自带滑动手势，用户体验更好。同时可以通过`.tabViewStyle(.page)`隐藏指示器，配合SegmentedControl使用。

### Q3: Badge数量如何实时更新？

**A**:
1. **实时**: 使用Socket.IO监听服务器推送
2. **备用**: 60秒轮询一次API
3. **用户触发**: 用户切换Tab时手动刷新

### Q4: 状态持久化如何实现？

**A**: 使用UserDefaults保存上次选中的Sub-Tab：

```swift
// 在AppState中
var feedSubTab: FeedSubTab {
    didSet {
        UserDefaults.standard.set(feedSubTab.rawValue, forKey: "feedSubTab")
    }
}

init() {
    if let saved = UserDefaults.standard.string(forKey: "feedSubTab"),
       let subTab = FeedSubTab(rawValue: saved) {
        self.feedSubTab = subTab
    }
}
```

---

## 附录C: 后续模块接口约定

为了确保后续模块能够顺利集成，Tab架构需要提供以下接口：

### C1: 导航接口

```swift
// AppState必须提供的导航方法
func navigateToFeed(subTab: FeedSubTab, sessionId: Int?)
func navigateToMap(location: CLLocationCoordinate2D?)
func navigateToLeaderboard()
func navigateToAlliance(allianceId: Int?)
```

### C2: Badge接口

```swift
// AppState必须提供的Badge方法
func updateBadge(tab: Tab, count: Int)
func clearBadge(tab: Tab)
```

### C3: 通知接口

```swift
// 后续模块可以发送的通知
extension Notification.Name {
    static let scrollToSession = Notification.Name("scrollToSession")
    static let flyToLocation = Notification.Name("flyToLocation")
    static let newFeedInteraction = Notification.Name("newFeedInteraction")
    static let newAllianceMessage = Notification.Name("newAllianceMessage")
}
```

---

**文档版本**: v1.0
**最后更新**: 2026-02-28
**审批状态**: ✅ 待开发启动
