# 地图屏幕 UX 设计规范文档

> 从用户体验专家角度，提供可直接用于编码的详细设计规范
>
> **文档版本**: v1.0
> **创建日期**: 2026-02-28
> **设计系统**: 基于 FunnyPixels Design System
> **目标**: 确保开发团队能够无障碍地将设计转化为代码

---

## 目录

- [设计系统基础](#设计系统基础)
- [布局与间距规范](#布局与间距规范)
- [交互状态设计](#交互状态设计)
- [动画与过渡效果](#动画与过渡效果)
- [微交互设计](#微交互设计)
- [错误与空状态](#错误与空状态)
- [无障碍设计规范](#无障碍设计规范)
- [性能优化指南](#性能优化指南)
- [用户流程详细设计](#用户流程详细设计)
- [组件库规范](#组件库规范)
- [边界情况处理](#边界情况处理)

---

## 设计系统基础

### 颜色系统

基于现有 `DesignSystem.swift` 扩展地图专用颜色：

```swift
// MARK: - Map Colors Extension
extension AppColors {
    // 区域状态条
    static let regionBarBackground = Color.black.opacity(0.15) // ultraThinMaterial
    static let regionBarText = Color.primary
    static let regionBarAccent = Color.blue

    // 任务系统
    static let taskPinNormal = Color.blue
    static let taskPinActive = Color.green
    static let taskPinCompleted = Color.gray.opacity(0.5)
    static let taskProgressFill = Color.blue
    static let taskProgressBackground = Color.gray.opacity(0.2)

    // 玩家雷达
    static let nearbyPlayerPulse = Color.green.opacity(0.6)
    static let friendPlayerPulse = Color.yellow.opacity(0.8)
    static let alliancePlayerPulse = Color.blue.opacity(0.7)

    // 宝箱系统
    static let treasureNormal = Color.orange
    static let treasureRare = Color.purple
    static let treasureEpic = Color.yellow
    static let treasureEvent = Color.red

    // 警报系统
    static let alertDanger = Color.red
    static let alertWarning = Color.orange
    static let alertInfo = Color.blue
    static let alertSuccess = Color.green

    // 领地系统
    static let territoryOwned = Color.green.opacity(0.3)
    static let territoryContested = Color.orange.opacity(0.3)
    static let territoryEnemy = Color.red.opacity(0.3)
    static let territoryBorder = Color.white.opacity(0.8)
}
```

### 字体系统

```swift
// MARK: - Map Typography Extension
extension AppTypography {
    // 状态条文本
    static let regionBarTitle = Font.system(size: 14, weight: .semibold)
    static let regionBarStat = Font.system(size: 12, weight: .medium)
    static let regionBarDetail = Font.system(size: 11, weight: .regular)

    // 任务文本
    static let taskTitle = Font.system(size: 15, weight: .semibold)
    static let taskDescription = Font.system(size: 13, weight: .regular)
    static let taskProgress = Font.system(size: 12, weight: .medium)

    // 通知横幅
    static let bannerTitle = Font.system(size: 14, weight: .bold)
    static let bannerSubtitle = Font.system(size: 12, weight: .regular)

    // 玩家卡片
    static let playerName = Font.system(size: 15, weight: .semibold)
    static let playerInfo = Font.system(size: 12, weight: .regular)

    // 宝箱提示
    static let treasureTitle = Font.system(size: 16, weight: .bold)
    static let treasureReward = Font.system(size: 14, weight: .medium)
}
```

### 间距系统

```swift
// MARK: - Map Spacing Extension
extension AppSpacing {
    // 已有: xs(4), s(8), m(12), l(16), xl(20), xxl(24)

    // 地图专用间距
    static let mapToolbarSpacing: CGFloat = 12
    static let mapPadding: CGFloat = 16
    static let cardPadding: CGFloat = 16
    static let cardSpacing: CGFloat = 12
    static let sectionSpacing: CGFloat = 20
}
```

### 圆角系统

```swift
// MARK: - Map Radius Extension
extension AppRadius {
    // 已有: s(4), m(8), l(12), xl(16), xxl(20)

    // 地图专用圆角
    static let regionBar: CGFloat = 0 // 顶部状态条无圆角
    static let floatingCard: CGFloat = 16
    static let popover: CGFloat = 12
    static let pill: CGFloat = 20 // 胶囊形状
}
```

### 阴影系统

```swift
// MARK: - Shadow System
struct MapShadow {
    static let light = (color: Color.black.opacity(0.1), radius: CGFloat(4), x: CGFloat(0), y: CGFloat(2))
    static let medium = (color: Color.black.opacity(0.15), radius: CGFloat(8), x: CGFloat(0), y: CGFloat(4))
    static let heavy = (color: Color.black.opacity(0.25), radius: CGFloat(16), x: CGFloat(0), y: CGFloat(8))
    static let glow = (color: Color.blue.opacity(0.3), radius: CGFloat(12), x: CGFloat(0), y: CGFloat(0))
}

// 使用示例
.shadow(
    color: MapShadow.medium.color,
    radius: MapShadow.medium.radius,
    x: MapShadow.medium.x,
    y: MapShadow.medium.y
)
```

---

## 布局与间距规范

### 1. 区域信息状态条

```
┌─────────────────────────────────────────────────────────┐
│                                                         │ ← Safe Area Top Inset
├─────────────────────────────────────────────────────────┤
│ 📍北京市朝阳区    ■ 12,580    👥 23    ▼              │ ← 44pt 高度
│ [16pt][icon][8pt][text][auto spacer][icon+text][16pt] │
└─────────────────────────────────────────────────────────┘
```

**详细规范**：
```swift
struct RegionInfoBar: View {
    var body: some View {
        VStack(spacing: 0) {
            // 主状态条
            HStack(spacing: 8) {
                Image(systemName: "mappin.circle.fill")
                    .font(.system(size: 16))
                    .foregroundColor(.blue)

                Text(regionName)
                    .font(AppTypography.regionBarTitle)
                    .foregroundColor(AppColors.regionBarText)
                    .lineLimit(1)

                Spacer()

                // 统计信息组
                HStack(spacing: 12) {
                    statItem(icon: "square.grid.3x3.fill", value: formatNumber(totalPixels))
                    statItem(icon: "person.2.fill", value: "\(activePlayers)")
                }

                Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundColor(.secondary)
                    .rotationEffect(.degrees(isExpanded ? 180 : 0))
            }
            .padding(.horizontal, AppSpacing.mapPadding)
            .frame(height: 44)
            .background(.ultraThinMaterial)

            // 展开内容
            if isExpanded {
                expandedContent
                    .transition(.move(edge: .top).combined(with: .opacity))
            }
        }
        .onTapGesture {
            withAnimation(.spring(response: 0.3, dampingFraction: 0.7)) {
                isExpanded.toggle()
            }
        }
    }

    private func statItem(icon: String, value: String) -> some View {
        HStack(spacing: 4) {
            Image(systemName: icon)
                .font(.system(size: 12))
            Text(value)
                .font(AppTypography.regionBarStat)
        }
        .foregroundColor(.secondary)
    }
}
```

**展开内容布局**：
```swift
var expandedContent: some View {
    VStack(alignment: .leading, spacing: AppSpacing.m) {
        // 占领联盟信息
        if let alliance = dominantAlliance {
            HStack(spacing: 8) {
                Circle()
                    .fill(Color(hex: alliance.color))
                    .frame(width: 20, height: 20)

                Text(alliance.name)
                    .font(AppTypography.regionBarDetail)

                Spacer()

                Text("\(Int(alliance.percentage))% 控制")
                    .font(AppTypography.regionBarDetail)
                    .foregroundColor(.secondary)
            }
        }

        // Top 3 玩家
        VStack(alignment: .leading, spacing: 6) {
            Text("区域TOP玩家")
                .font(AppTypography.regionBarDetail)
                .foregroundColor(.secondary)

            ForEach(topPlayers.prefix(3)) { player in
                HStack {
                    Text("#\(player.rank)")
                        .font(.system(size: 12, weight: .bold, design: .rounded))
                        .foregroundColor(.orange)
                        .frame(width: 24)

                    Text(player.displayName)
                        .font(AppTypography.regionBarDetail)

                    Spacer()

                    Text("\(player.pixelCount)")
                        .font(AppTypography.regionBarDetail)
                        .foregroundColor(.secondary)
                }
            }
        }
    }
    .padding(.horizontal, AppSpacing.mapPadding)
    .padding(.vertical, AppSpacing.m)
    .background(.ultraThinMaterial)
}
```

### 2. 活动通知横幅

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
├─────────────────────────────────────────────────────────┤
│ 🎊 限时活动「春节争霸」进行中      剩余 02:35    ×     │ ← 40pt 高度
│ [12pt][icon][8pt][title][spacer][countdown][12pt][×]  │
└─────────────────────────────────────────────────────────┘
```

**详细规范**：
```swift
struct ActivityBanner: View {
    let notification: MapNotification
    @Binding var isVisible: Bool

    var body: some View {
        HStack(spacing: 8) {
            // 图标
            Text(notification.icon)
                .font(.system(size: 20))

            // 标题
            Text(notification.title)
                .font(AppTypography.bannerTitle)
                .foregroundColor(.white)
                .lineLimit(1)

            Spacer()

            // 倒计时（如果有）
            if let countdown = notification.countdown {
                CountdownView(endTime: countdown)
                    .font(AppTypography.bannerSubtitle)
                    .foregroundColor(.white.opacity(0.9))
            }

            // 关闭按钮
            Button(action: {
                withAnimation {
                    isVisible = false
                }
            }) {
                Image(systemName: "xmark")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundColor(.white.opacity(0.8))
                    .frame(width: 24, height: 24)
            }
        }
        .padding(.horizontal, 12)
        .frame(height: 40)
        .background(
            LinearGradient(
                colors: notification.gradientColors,
                startPoint: .leading,
                endPoint: .trailing
            )
        )
        .cornerRadius(8)
        .shadow(
            color: MapShadow.medium.color,
            radius: MapShadow.medium.radius,
            x: MapShadow.medium.x,
            y: MapShadow.medium.y
        )
        .padding(.horizontal, AppSpacing.mapPadding)
        .transition(.move(edge: .top).combined(with: .opacity))
    }
}

// 通知类型配置
extension MapNotification {
    var gradientColors: [Color] {
        switch type {
        case .limitedChallenge:
            return [Color.orange, Color.red]
        case .allianceWar:
            return [Color.red, Color.purple]
        case .treasureRefresh:
            return [Color.blue, Color.cyan]
        case .seasonReminder:
            return [Color.purple, Color.pink]
        case .systemAnnouncement:
            return [Color.gray.opacity(0.8), Color.gray.opacity(0.6)]
        }
    }
}
```

### 3. 快速统计浮窗

```
地图右侧工具栏位置：
                              ┌────────────────────┐
                              │  📊 今日数据        │
                              │ ━━━━━━━━━━━━━━━━ │
                              │ ■ 今日像素  120    │
                              │ 🔥 连续登录  7天   │
[定位按钮]                     │ 🏆 当前排名  #42   │
[图层按钮]  ← 16pt spacing →  │ ⭐ 积分余额  1,280 │
[统计按钮] ← 点击弹出          │ 💧 资源值    80/100│
[漂流瓶入口]                   │                    │
                              │  [查看详情]  [×]   │
                              └────────────────────┘
                              ↑ 200pt 宽度
```

**详细规范**：
```swift
struct QuickStatsPopover: View {
    @Binding var isPresented: Bool
    @ObservedObject var viewModel: QuickStatsViewModel

    var body: some View {
        VStack(alignment: .leading, spacing: AppSpacing.m) {
            // Header
            HStack {
                Image(systemName: "chart.bar.fill")
                    .foregroundColor(.blue)
                Text("今日数据")
                    .font(.system(size: 16, weight: .semibold))
                Spacer()
                Button(action: { isPresented = false }) {
                    Image(systemName: "xmark")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundColor(.secondary)
                }
            }

            Divider()

            // 数据列表
            VStack(alignment: .leading, spacing: 10) {
                statRow(
                    icon: "square.grid.3x3.fill",
                    color: .blue,
                    label: "今日像素",
                    value: "\(viewModel.todayPixels)"
                )

                statRow(
                    icon: "flame.fill",
                    color: .orange,
                    label: "连续登录",
                    value: "\(viewModel.streakDays)天"
                )

                statRow(
                    icon: "trophy.fill",
                    color: .yellow,
                    label: "当前排名",
                    value: "#\(viewModel.currentRank)"
                )

                statRow(
                    icon: "star.circle.fill",
                    color: .purple,
                    label: "积分余额",
                    value: formatNumber(viewModel.points)
                )

                // 资源值进度条
                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Image(systemName: "drop.fill")
                            .foregroundColor(.cyan)
                        Text("资源值")
                            .font(.system(size: 13))
                        Spacer()
                        Text("\(viewModel.pixelPoints)/\(viewModel.maxPoints)")
                            .font(.system(size: 13, weight: .medium))
                            .foregroundColor(.secondary)
                    }

                    ProgressView(value: Double(viewModel.pixelPoints), total: Double(viewModel.maxPoints))
                        .tint(.cyan)
                }
            }

            // Footer
            Button(action: {
                // 跳转到我的Tab
                NotificationCenter.default.post(name: .switchToProfileTab, object: nil)
                isPresented = false
            }) {
                Text("查看详情")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundColor(.blue)
                    .frame(maxWidth: .infinity)
                    .frame(height: 36)
                    .background(Color.blue.opacity(0.1))
                    .cornerRadius(8)
            }
        }
        .padding(AppSpacing.cardPadding)
        .frame(width: 200)
        .background(.ultraThinMaterial)
        .cornerRadius(AppRadius.floatingCard)
        .shadow(
            color: MapShadow.medium.color,
            radius: MapShadow.medium.radius,
            x: MapShadow.medium.x,
            y: MapShadow.medium.y
        )
    }

    private func statRow(icon: String, color: Color, label: String, value: String) -> some View {
        HStack(spacing: 8) {
            Image(systemName: icon)
                .foregroundColor(color)
                .frame(width: 20)
            Text(label)
                .font(.system(size: 13))
            Spacer()
            Text(value)
                .font(.system(size: 13, weight: .medium))
                .foregroundColor(.secondary)
        }
    }
}
```

---

## 交互状态设计

### 1. 按钮状态

所有交互元素必须有清晰的状态反馈：

```swift
enum InteractionState {
    case normal      // 默认状态
    case highlighted // 按下状态
    case disabled    // 禁用状态
    case loading     // 加载状态
}

// 按钮样式修饰器
struct MapButtonStyle: ButtonStyle {
    let state: InteractionState

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .opacity(opacity(for: configuration))
            .scaleEffect(scale(for: configuration))
            .animation(.easeInOut(duration: 0.15), value: configuration.isPressed)
    }

    private func opacity(for configuration: Configuration) -> Double {
        switch state {
        case .normal:
            return configuration.isPressed ? 0.7 : 1.0
        case .highlighted:
            return 0.7
        case .disabled:
            return 0.4
        case .loading:
            return 0.6
        }
    }

    private func scale(for configuration: Configuration) -> CGFloat {
        configuration.isPressed ? 0.95 : 1.0
    }
}
```

### 2. 任务Pin状态

```swift
enum TaskPinState {
    case locked      // 未解锁（灰色，不可点击）
    case available   // 可接受（蓝色，脉冲动画）
    case inProgress  // 进行中（绿色，进度环）
    case completed   // 已完成（灰色半透明，无动画）
    case claimed     // 已领取（隐藏）
}

struct TaskPinAnnotation: View {
    let task: DailyTask
    @State private var isPulsing = false

    var body: some View {
        ZStack {
            // 背景脉冲圈（仅available状态）
            if task.state == .available {
                Circle()
                    .fill(AppColors.taskPinNormal.opacity(0.3))
                    .frame(width: pulseSize, height: pulseSize)
                    .scaleEffect(isPulsing ? 1.5 : 1.0)
                    .opacity(isPulsing ? 0 : 0.5)
                    .animation(
                        .easeInOut(duration: 1.5).repeatForever(autoreverses: false),
                        value: isPulsing
                    )
                    .onAppear { isPulsing = true }
            }

            // 主图标
            Circle()
                .fill(pinColor)
                .frame(width: 40, height: 40)
                .overlay(
                    Image(systemName: task.iconName)
                        .font(.system(size: 20, weight: .semibold))
                        .foregroundColor(.white)
                )

            // 进度环（inProgress状态）
            if task.state == .inProgress {
                Circle()
                    .trim(from: 0, to: task.progressPercentage)
                    .stroke(Color.white, lineWidth: 3)
                    .frame(width: 44, height: 44)
                    .rotationEffect(.degrees(-90))
            }

            // 完成标记（completed状态）
            if task.state == .completed {
                Image(systemName: "checkmark.circle.fill")
                    .font(.system(size: 16))
                    .foregroundColor(.white)
                    .offset(x: 12, y: -12)
            }
        }
    }

    var pinColor: Color {
        switch task.state {
        case .locked: return AppColors.taskPinCompleted
        case .available: return AppColors.taskPinNormal
        case .inProgress: return AppColors.taskPinActive
        case .completed, .claimed: return AppColors.taskPinCompleted
        }
    }
}
```

### 3. 宝箱距离状态

```swift
enum TreasureProximityState {
    case farAway    // >200m: 小图标，半透明
    case medium     // 50-200m: 正常大小，发光
    case close      // <50m: 放大，弹跳动画
}

struct TreasureAnnotation: View {
    let treasure: Treasure
    let userDistance: Double // 米
    @State private var isBouncing = false

    var proximityState: TreasureProximityState {
        if userDistance > 200 { return .farAway }
        if userDistance > 50 { return .medium }
        return .close
    }

    var body: some View {
        Image(systemName: treasure.iconName)
            .font(.system(size: iconSize))
            .foregroundColor(treasure.color)
            .opacity(opacity)
            .scaleEffect(isBouncing && proximityState == .close ? 1.2 : 1.0)
            .shadow(
                color: proximityState == .medium ? MapShadow.glow.color : .clear,
                radius: MapShadow.glow.radius
            )
            .animation(
                proximityState == .close
                    ? .easeInOut(duration: 0.6).repeatForever(autoreverses: true)
                    : .default,
                value: isBouncing
            )
            .onAppear {
                if proximityState == .close {
                    isBouncing = true
                }
            }
            .onChange(of: proximityState) { newState in
                isBouncing = newState == .close
            }
    }

    var iconSize: CGFloat {
        switch proximityState {
        case .farAway: return 20
        case .medium: return 28
        case .close: return 36
        }
    }

    var opacity: Double {
        switch proximityState {
        case .farAway: return 0.5
        case .medium: return 0.85
        case .close: return 1.0
        }
    }
}
```

---

## 动画与过渡效果

### 1. 标准动画时长

```swift
enum AnimationDuration {
    static let instant: Double = 0.1      // 即时反馈
    static let fast: Double = 0.2         // 快速交互
    static let normal: Double = 0.3       // 标准动画
    static let slow: Double = 0.5         // 慢速强调
    static let verylow: Double = 0.8     // 非常慢的动画
}

enum AnimationCurve {
    static let easeOut = Animation.easeOut(duration: AnimationDuration.normal)
    static let easeInOut = Animation.easeInOut(duration: AnimationDuration.normal)
    static let spring = Animation.spring(response: 0.3, dampingFraction: 0.7)
    static let bounce = Animation.interpolatingSpring(stiffness: 170, damping: 15)
}
```

### 2. 视图出现/消失动画

```swift
// 区域信息栏展开/收起
.transition(.move(edge: .top).combined(with: .opacity))
.animation(AnimationCurve.spring, value: isExpanded)

// 通知横幅滑入/滑出
.transition(
    .asymmetric(
        insertion: .move(edge: .top).combined(with: .opacity),
        removal: .move(edge: .top).combined(with: .opacity)
    )
)

// 浮窗淡入淡出
.transition(.scale(scale: 0.8).combined(with: .opacity))
.animation(AnimationCurve.spring, value: isPresented)

// 任务完成庆祝动画
.transition(
    .scale(scale: 0.1)
    .combined(with: .opacity)
    .combined(with: .move(edge: .bottom))
)
```

### 3. 脉冲动画（附近玩家、任务标记）

```swift
struct PulseModifier: ViewModifier {
    @State private var isPulsing = false
    let color: Color
    let initialScale: CGFloat
    let finalScale: CGFloat
    let duration: Double

    func body(content: Content) -> some View {
        content
            .overlay(
                Circle()
                    .fill(color)
                    .scaleEffect(isPulsing ? finalScale : initialScale)
                    .opacity(isPulsing ? 0 : 0.7)
            )
            .onAppear {
                withAnimation(
                    .easeOut(duration: duration)
                    .repeatForever(autoreverses: false)
                ) {
                    isPulsing = true
                }
            }
    }
}

extension View {
    func pulseEffect(
        color: Color = .blue,
        initialScale: CGFloat = 1.0,
        finalScale: CGFloat = 1.5,
        duration: Double = 1.5
    ) -> some View {
        modifier(PulseModifier(
            color: color,
            initialScale: initialScale,
            finalScale: finalScale,
            duration: duration
        ))
    }
}

// 使用示例
Circle()
    .fill(.blue)
    .frame(width: 40, height: 40)
    .pulseEffect(color: .blue.opacity(0.3))
```

### 4. 进度动画

```swift
struct AnimatedProgressBar: View {
    let progress: Double // 0.0 - 1.0
    let color: Color
    let height: CGFloat

    @State private var animatedProgress: Double = 0

    var body: some View {
        GeometryReader { geometry in
            ZStack(alignment: .leading) {
                // 背景
                Capsule()
                    .fill(Color.gray.opacity(0.2))

                // 进度条
                Capsule()
                    .fill(
                        LinearGradient(
                            colors: [color, color.opacity(0.7)],
                            startPoint: .leading,
                            endPoint: .trailing
                        )
                    )
                    .frame(width: geometry.size.width * animatedProgress)
                    .animation(.easeInOut(duration: 0.5), value: animatedProgress)

                // 光泽效果
                Capsule()
                    .fill(
                        LinearGradient(
                            colors: [.white.opacity(0.3), .clear],
                            startPoint: .top,
                            endPoint: .bottom
                        )
                    )
                    .frame(width: geometry.size.width * animatedProgress)
            }
        }
        .frame(height: height)
        .onAppear {
            animatedProgress = progress
        }
        .onChange(of: progress) { newValue in
            withAnimation(.easeInOut(duration: 0.5)) {
                animatedProgress = newValue
            }
        }
    }
}
```

### 5. 奖励动画

```swift
struct RewardAnimation: View {
    let reward: Reward
    @Binding var isPresented: Bool

    @State private var scale: CGFloat = 0.1
    @State private var rotation: Double = 0
    @State private var opacity: Double = 0
    @State private var coinOffsets: [CGSize] = Array(repeating: .zero, count: 10)

    var body: some View {
        ZStack {
            // 背景遮罩
            Color.black.opacity(0.4)
                .ignoresSafeArea()
                .opacity(opacity)

            VStack(spacing: 20) {
                // 宝箱/奖励图标
                Image(systemName: reward.iconName)
                    .font(.system(size: 80))
                    .foregroundColor(.yellow)
                    .scaleEffect(scale)
                    .rotationEffect(.degrees(rotation))

                // 奖励文本
                VStack(spacing: 8) {
                    Text(reward.title)
                        .font(.system(size: 24, weight: .bold))
                        .foregroundColor(.white)

                    Text("+\(reward.points) 积分")
                        .font(.system(size: 18, weight: .semibold))
                        .foregroundColor(.yellow)
                }
                .opacity(opacity)

                // 金币雨效果
                ZStack {
                    ForEach(0..<10) { index in
                        Image(systemName: "star.fill")
                            .foregroundColor(.yellow)
                            .offset(coinOffsets[index])
                            .opacity(opacity)
                    }
                }
            }
        }
        .onAppear {
            playAnimation()
        }
    }

    private func playAnimation() {
        // 1. 宝箱放大 + 旋转
        withAnimation(.spring(response: 0.6, dampingFraction: 0.6)) {
            scale = 1.0
            rotation = 360
        }

        // 2. 淡入文字
        withAnimation(.easeIn(duration: 0.3).delay(0.3)) {
            opacity = 1.0
        }

        // 3. 金币散开
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            for index in 0..<10 {
                let angle = Double(index) * 36.0 // 360/10
                let radius: CGFloat = 100
                let x = cos(angle * .pi / 180) * radius
                let y = sin(angle * .pi / 180) * radius

                withAnimation(.easeOut(duration: 0.8).delay(Double(index) * 0.05)) {
                    coinOffsets[index] = CGSize(width: x, height: y)
                }
            }
        }

        // 4. 自动消失
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.5) {
            withAnimation(.easeOut(duration: 0.3)) {
                opacity = 0
            }
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                isPresented = false
            }
        }
    }
}
```

---

## 微交互设计

### 1. 触觉反馈

```swift
enum HapticFeedback {
    static func light() {
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
    }

    static func medium() {
        UIImpactFeedbackGenerator(style: .medium).impactOccurred()
    }

    static func heavy() {
        UIImpactFeedbackGenerator(style: .heavy).impactOccurred()
    }

    static func success() {
        UINotificationFeedbackGenerator().notificationOccurred(.success)
    }

    static func warning() {
        UINotificationFeedbackGenerator().notificationOccurred(.warning)
    }

    static func error() {
        UINotificationFeedbackGenerator().notificationOccurred(.error)
    }

    static func selection() {
        UISelectionFeedbackGenerator().selectionChanged()
    }
}

// 使用场景
// 点击按钮: light()
// 任务完成: success()
// 发现宝箱: medium()
// 领地警报: warning()
// 操作失败: error()
// 切换标签: selection()
```

### 2. 音效管理

```swift
enum MapSoundEffect: String {
    case taskComplete = "task_complete"
    case treasureFound = "treasure_found"
    case treasureOpen = "treasure_open"
    case playerNearby = "player_nearby"
    case territoryAlert = "territory_alert"
    case levelUp = "level_up"
    case buttonTap = "button_tap"
    case notification = "notification"

    func play() {
        SoundManager.shared.play(self.rawValue)
    }

    func playWithHaptic(_ haptic: () -> Void) {
        play()
        haptic()
    }
}

// 使用示例
MapSoundEffect.taskComplete.playWithHaptic(HapticFeedback.success)
```

### 3. 加载状态

```swift
struct LoadingIndicator: View {
    let style: LoadingStyle

    enum LoadingStyle {
        case spinner        // 旋转菊花
        case dots          // 跳动的点
        case pulse         // 脉冲圆
        case skeleton      // 骨架屏
    }

    var body: some View {
        Group {
            switch style {
            case .spinner:
                ProgressView()
                    .progressViewStyle(CircularProgressViewStyle())

            case .dots:
                HStack(spacing: 4) {
                    ForEach(0..<3) { index in
                        Circle()
                            .fill(Color.blue)
                            .frame(width: 8, height: 8)
                            .scaleEffect(scales[index])
                            .animation(
                                .easeInOut(duration: 0.6)
                                .repeatForever()
                                .delay(Double(index) * 0.2),
                                value: scales[index]
                            )
                    }
                }
                .onAppear { startDotAnimation() }

            case .pulse:
                Circle()
                    .fill(Color.blue.opacity(0.3))
                    .frame(width: 40, height: 40)
                    .scaleEffect(scale)
                    .animation(
                        .easeInOut(duration: 1.0).repeatForever(),
                        value: scale
                    )
                    .onAppear { scale = 1.5 }

            case .skeleton:
                SkeletonView()
            }
        }
    }

    @State private var scales: [CGFloat] = [1, 1, 1]
    @State private var scale: CGFloat = 1.0

    private func startDotAnimation() {
        for i in 0..<3 {
            DispatchQueue.main.asyncAfter(deadline: .now() + Double(i) * 0.2) {
                scales[i] = 1.5
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                    scales[i] = 1.0
                }
            }
        }
    }
}

struct SkeletonView: View {
    @State private var isAnimating = false

    var body: some View {
        Rectangle()
            .fill(
                LinearGradient(
                    colors: [
                        Color.gray.opacity(0.3),
                        Color.gray.opacity(0.1),
                        Color.gray.opacity(0.3)
                    ],
                    startPoint: isAnimating ? .leading : .trailing,
                    endPoint: isAnimating ? .trailing : .leading
                )
            )
            .onAppear {
                withAnimation(.linear(duration: 1.5).repeatForever(autoreverses: false)) {
                    isAnimating = true
                }
            }
    }
}
```

---

## 错误与空状态

### 1. 错误状态设计

```swift
struct ErrorView: View {
    let error: MapError
    let retryAction: () -> Void

    var body: some View {
        VStack(spacing: 16) {
            // 错误图标
            Image(systemName: error.iconName)
                .font(.system(size: 48))
                .foregroundColor(.red.opacity(0.7))

            // 错误信息
            VStack(spacing: 8) {
                Text(error.title)
                    .font(.system(size: 18, weight: .semibold))

                Text(error.message)
                    .font(.system(size: 14))
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 32)
            }

            // 重试按钮
            Button(action: retryAction) {
                HStack {
                    Image(systemName: "arrow.clockwise")
                    Text("重试")
                }
                .font(.system(size: 15, weight: .semibold))
                .foregroundColor(.white)
                .padding(.horizontal, 24)
                .padding(.vertical, 12)
                .background(Color.blue)
                .cornerRadius(AppRadius.m)
            }
        }
        .padding(AppSpacing.cardPadding)
    }
}

enum MapError {
    case networkError
    case locationPermissionDenied
    case gpsUnavailable
    case taskLoadFailed
    case treasureClaimFailed

    var iconName: String {
        switch self {
        case .networkError: return "wifi.slash"
        case .locationPermissionDenied: return "location.slash"
        case .gpsUnavailable: return "location.slash.fill"
        case .taskLoadFailed: return "exclamationmark.triangle"
        case .treasureClaimFailed: return "xmark.circle"
        }
    }

    var title: String {
        switch self {
        case .networkError: return "网络连接失败"
        case .locationPermissionDenied: return "需要位置权限"
        case .gpsUnavailable: return "GPS信号弱"
        case .taskLoadFailed: return "任务加载失败"
        case .treasureClaimFailed: return "领取失败"
        }
    }

    var message: String {
        switch self {
        case .networkError:
            return "请检查网络连接后重试"
        case .locationPermissionDenied:
            return "请在设置中允许FunnyPixels访问您的位置"
        case .gpsUnavailable:
            return "GPS信号弱，请移至开阔地带"
        case .taskLoadFailed:
            return "无法加载每日任务，请稍后重试"
        case .treasureClaimFailed:
            return "无法领取宝箱，请稍后重试"
        }
    }
}
```

### 2. 空状态设计

```swift
struct EmptyStateView: View {
    let state: EmptyState
    let action: (() -> Void)?

    var body: some View {
        VStack(spacing: 20) {
            // 插图
            Image(state.imageName)
                .resizable()
                .scaledToFit()
                .frame(width: 160, height: 160)
                .foregroundColor(.gray.opacity(0.5))

            // 文案
            VStack(spacing: 8) {
                Text(state.title)
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundColor(.primary)

                Text(state.message)
                    .font(.system(size: 14))
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 32)
            }

            // 行动按钮（如果有）
            if let action = action, let actionTitle = state.actionTitle {
                Button(action: action) {
                    Text(actionTitle)
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundColor(.white)
                        .padding(.horizontal, 24)
                        .padding(.vertical, 12)
                        .background(Color.blue)
                        .cornerRadius(AppRadius.m)
                }
            }
        }
        .padding(AppSpacing.cardPadding)
    }
}

enum EmptyState {
    case noTasks
    case noTreasures
    case noNearbyPlayers
    case noNotifications

    var imageName: String {
        switch self {
        case .noTasks: return "checklist"
        case .noTreasures: return "shippingbox"
        case .noNearbyPlayers: return "person.2.slash"
        case .noNotifications: return "bell.slash"
        }
    }

    var title: String {
        switch self {
        case .noTasks: return "暂无任务"
        case .noTreasures: return "附近没有宝箱"
        case .noNearbyPlayers: return "附近暂无玩家"
        case .noNotifications: return "暂无通知"
        }
    }

    var message: String {
        switch self {
        case .noTasks:
            return "明天00:00将刷新新的每日任务"
        case .noTreasures:
            return "探索更多区域寻找宝箱吧！"
        case .noNearbyPlayers:
            return "附近5km内暂无活跃玩家"
        case .noNotifications:
            return "当前没有新的活动或消息"
        }
    }

    var actionTitle: String? {
        switch self {
        case .noTasks: return nil
        case .noTreasures: return "探索地图"
        case .noNearbyPlayers: return "刷新"
        case .noNotifications: return nil
        }
    }
}
```

---

## 无障碍设计规范

### 1. VoiceOver 支持

```swift
// 为所有地图标注添加语音标签
extension TaskPinAnnotation {
    var accessibilityLabel: String {
        switch task.state {
        case .locked:
            return "已锁定任务: \(task.title)"
        case .available:
            return "可接受任务: \(task.title)，点击查看详情"
        case .inProgress:
            return "进行中任务: \(task.title)，进度\(Int(task.progressPercentage * 100))%"
        case .completed:
            return "已完成任务: \(task.title)，点击领取奖励"
        case .claimed:
            return "已领取任务: \(task.title)"
        }
    }

    var accessibilityHint: String? {
        switch task.state {
        case .available:
            return "双击以查看任务详情并开始"
        case .inProgress:
            return "双击查看进度详情"
        case .completed:
            return "双击领取奖励"
        default:
            return nil
        }
    }
}

// 使用
.accessibilityLabel(accessibilityLabel)
.accessibilityHint(accessibilityHint)
.accessibilityAddTraits(.isButton)
```

### 2. 动态字体支持

```swift
// 使用动态类型
extension AppTypography {
    static func dynamic(size: CGFloat, weight: Font.Weight = .regular) -> Font {
        .system(size: size, weight: weight, design: .default)
    }

    // 支持系统设置的字体大小
    static let regionBarTitleDynamic = Font.system(.subheadline, design: .default, weight: .semibold)
    static let taskTitleDynamic = Font.system(.body, design: .default, weight: .semibold)
}

// 确保文本不截断
Text(regionName)
    .font(AppTypography.regionBarTitleDynamic)
    .minimumScaleFactor(0.8)
    .lineLimit(2)
```

### 3. 对比度与色盲模式

```swift
struct AccessibleColors {
    // 高对比度颜色方案
    static func highContrast(_ color: Color) -> Color {
        // 检测系统是否启用高对比度
        if UIAccessibility.isDarkerSystemColorsEnabled {
            return color.opacity(1.0)
        }
        return color
    }

    // 色盲友好配色
    static let colorBlindSafe = [
        "red": Color(red: 0.9, green: 0.2, blue: 0.2),      // 红色
        "blue": Color(red: 0.2, green: 0.4, blue: 0.9),     // 蓝色
        "green": Color(red: 0.2, green: 0.7, blue: 0.4),    // 绿色
        "orange": Color(red: 1.0, green: 0.6, blue: 0.2),   // 橙色
        "purple": Color(red: 0.6, green: 0.3, blue: 0.9)    // 紫色
    ]
}

// 为联盟颜色添加图案区分
struct AllianceIdentifier: View {
    let alliance: Alliance

    var body: some View {
        ZStack {
            Circle()
                .fill(Color(hex: alliance.color))

            // 为色盲用户添加图案
            if UserDefaults.standard.bool(forKey: "colorBlindMode") {
                alliancePattern
            }
        }
    }

    var alliancePattern: some View {
        // 根据联盟ID生成唯一图案
        let patterns = ["circle.fill", "square.fill", "triangle.fill", "diamond.fill"]
        let index = abs(alliance.id.hashValue) % patterns.count
        return Image(systemName: patterns[index])
            .foregroundColor(.white.opacity(0.5))
    }
}
```

### 4. 最小触摸区域

```swift
// 所有交互元素最小44x44pt
extension View {
    func minimumTouchTarget(width: CGFloat = 44, height: CGFloat = 44) -> some View {
        frame(minWidth: width, minHeight: height)
    }
}

// 使用示例
Button(action: {}) {
    Image(systemName: "xmark")
        .font(.system(size: 12))
}
.minimumTouchTarget() // 确保至少44x44
```

---

## 性能优化指南

### 1. 地图标注懒加载

```swift
class MapAnnotationManager: ObservableObject {
    @Published var visibleAnnotations: [MapAnnotation] = []

    private var allAnnotations: [MapAnnotation] = []
    private let throttler = Throttler(delay: 0.5)

    func updateVisibleRegion(bounds: MapBounds, zoom: Int) {
        throttler.throttle {
            self.loadAnnotationsForRegion(bounds: bounds, zoom: zoom)
        }
    }

    private func loadAnnotationsForRegion(bounds: MapBounds, zoom: Int) {
        // 仅加载可视区域 + 1屏缓冲区的标注
        let expandedBounds = bounds.expanded(by: 1.5)

        visibleAnnotations = allAnnotations.filter { annotation in
            expandedBounds.contains(annotation.coordinate)
        }

        // 根据缩放级别过滤
        visibleAnnotations = visibleAnnotations.filter { annotation in
            annotation.minZoom <= zoom && annotation.maxZoom >= zoom
        }

        // 限制最大数量
        if visibleAnnotations.count > 200 {
            visibleAnnotations = Array(visibleAnnotations.prefix(200))
        }
    }
}

// 节流器实现
class Throttler {
    private let delay: TimeInterval
    private var workItem: DispatchWorkItem?

    init(delay: TimeInterval) {
        self.delay = delay
    }

    func throttle(action: @escaping () -> Void) {
        workItem?.cancel()
        workItem = DispatchWorkItem(block: action)
        DispatchQueue.main.asyncAfter(deadline: .now() + delay, execute: workItem!)
    }
}
```

### 2. 图片缓存策略

```swift
class ImageCache {
    static let shared = ImageCache()
    private let cache = NSCache<NSString, UIImage>()
    private let fileManager = FileManager.default
    private let cacheDirectory: URL

    init() {
        cache.countLimit = 100
        cache.totalCostLimit = 50 * 1024 * 1024 // 50MB

        cacheDirectory = fileManager.urls(for: .cachesDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("MapImages")

        try? fileManager.createDirectory(at: cacheDirectory, withIntermediateDirectories: true)
    }

    func loadImage(url: URL, completion: @escaping (UIImage?) -> Void) {
        let key = url.absoluteString as NSString

        // L1: 内存缓存
        if let cachedImage = cache.object(forKey: key) {
            completion(cachedImage)
            return
        }

        // L2: 磁盘缓存
        let fileURL = cacheDirectory.appendingPathComponent(url.lastPathComponent)
        if let diskImage = UIImage(contentsOfFile: fileURL.path) {
            cache.setObject(diskImage, forKey: key)
            completion(diskImage)
            return
        }

        // L3: 网络请求
        URLSession.shared.dataTask(with: url) { data, _, _ in
            guard let data = data, let image = UIImage(data: data) else {
                DispatchQueue.main.async { completion(nil) }
                return
            }

            // 保存到缓存
            self.cache.setObject(image, forKey: key)
            try? data.write(to: fileURL)

            DispatchQueue.main.async { completion(image) }
        }.resume()
    }
}
```

### 3. Socket事件节流

```swift
class SocketThrottler {
    private var lastEmitTime: [String: Date] = [:]
    private let minInterval: TimeInterval = 0.5

    func shouldEmit(event: String) -> Bool {
        let now = Date()
        if let lastTime = lastEmitTime[event] {
            let elapsed = now.timeIntervalSince(lastTime)
            if elapsed < minInterval {
                return false
            }
        }
        lastEmitTime[event] = now
        return true
    }
}

// 在SocketIOManager中使用
class SocketIOManager {
    private let throttler = SocketThrottler()

    func emitLocationUpdate(lat: Double, lng: Double) {
        guard throttler.shouldEmit(event: "location_update") else { return }
        socket.emit("location_update", ["lat": lat, "lng": lng])
    }
}
```

### 4. 内存管理

```swift
// 大数据列表使用LazyVStack
struct TaskListView: View {
    let tasks: [DailyTask]

    var body: some View {
        ScrollView {
            LazyVStack(spacing: 12) {
                ForEach(tasks) { task in
                    TaskCard(task: task)
                        .onAppear {
                            // 延迟加载任务图标
                            task.loadIconIfNeeded()
                        }
                        .onDisappear {
                            // 释放不可见的资源
                            task.releaseResources()
                        }
                }
            }
        }
    }
}

// 弱引用避免循环引用
class MapViewModel: ObservableObject {
    weak var delegate: MapViewDelegate?

    private var cancellables = Set<AnyCancellable>()

    deinit {
        cancellables.forEach { $0.cancel() }
    }
}
```

---

## 用户流程详细设计

### 1. 每日任务完整流程

```
用户打开地图 → 查看任务 → 前往任务点 → 完成任务 → 领取奖励

详细步骤：

1. 【发现任务】
   - 用户打开地图Tab
   - 地图加载完成后显示任务Pin（蓝色脉冲）
   - 底部显示任务进度条 "今日任务 0/5"

   触觉反馈: 无
   音效: 无

2. 【查看任务详情】
   - 用户点击任务Pin
   - Pin放大并停止脉冲
   - 弹出任务详情卡片（从底部滑入）

   卡片内容：
   ┌─────────────────────────────┐
   │ 📍 定点绘画任务              │
   │ ━━━━━━━━━━━━━━━━━━━━━━━ │
   │ 在三里屯绘画50个像素          │
   │                             │
   │ 进度: 0/50 (0%)             │
   │ ━━━━━━━━━━━━━━━━ 0%      │
   │                             │
   │ 奖励: 50积分                │
   │ 距离: 800m                  │
   │                             │
   │ [开始导航]  [关闭]          │
   └─────────────────────────────┘

   触觉反馈: light()
   音效: buttonTap

3. 【前往任务点】
   - 用户点击「开始导航」
   - 地图自动飞往任务点（动画0.5s）
   - 任务Pin变为绿色并显示方向箭头
   - 底部显示距离倒计时 "距离任务点 800m"

   触觉反馈: medium()
   音效: 无

4. 【进入任务区域】
   - 用户靠近任务点（<500m）
   - 任务Pin开始弹跳动画
   - 距离文字变为黄色 "距离任务点 450m"

   - 用户进入任务区域（<50m）
   - 任务Pin放大并高亮
   - 底部提示 "已到达任务区域，开始绘画吧！"

   触觉反馈: medium()
   音效: notification

5. 【执行任务】
   - 用户开始GPS绘画
   - 每绘画1个像素，任务进度+1
   - 进度条实时更新
   - Pin上的进度环同步更新

   实时反馈：
   - 每10像素播放一次轻微触觉
   - 进度25%、50%、75%播放进度音效

6. 【任务完成】
   - 进度达到50/50
   - Pin变为灰色并显示✓
   - 弹出完成动画（金币雨+光效）

   ┌─────────────────────────────┐
   │        ✨ 任务完成！ ✨      │
   │                             │
   │     [宝箱图标放大旋转]       │
   │                             │
   │     + 50 积分               │
   │                             │
   │   [金币散开动画]             │
   │                             │
   │    [领取奖励]               │
   └─────────────────────────────┘

   触觉反馈: success()
   音效: taskComplete

7. 【领取奖励】
   - 用户点击「领取奖励」
   - 积分数字跳动增加
   - 任务从列表移除
   - 底部进度更新 "今日任务 1/5"

   触觉反馈: light()
   音效: rewardClaim

8. 【全部完成奖励】
   - 完成第5个任务后
   - 额外弹出大宝箱动画

   ┌─────────────────────────────┐
   │   🎉 全部任务完成！ 🎉      │
   │                             │
   │   [超大宝箱爆炸动画]         │
   │                             │
   │   额外奖励：                │
   │   + 200 积分                │
   │   + 稀有道具 x1             │
   │                             │
   │   [领取]                    │
   └─────────────────────────────┘

   触觉反馈: heavy() x3 (间隔0.2s)
   音效: epicReward
```

### 2. 宝箱发现与拾取流程

```
发现宝箱 → 靠近宝箱 → 打开宝箱 → 领取奖励

详细步骤：

1. 【远距离发现】(>200m)
   - 地图上显示小宝箱图标（半透明）
   - 无特殊效果

2. 【中距离接近】(50-200m)
   - 宝箱图标变大并发光
   - 开始轻微脉冲动画

   触觉反馈: 无
   音效: 无

3. 【近距离】(<50m)
   - 宝箱图标进一步放大
   - 弹跳动画（上下跳动）
   - 显示距离提示 "宝箱距离 32m ↗️"
   - 方向箭头指向宝箱

   触觉反馈: medium()
   音效: treasureFound

4. 【点击宝箱】
   - 用户点击宝箱图标
   - 弹出宝箱预览

   ┌─────────────────────────────┐
   │      📦 普通宝箱            │
   │                             │
   │  [宝箱3D图标旋转]           │
   │                             │
   │  可能包含：                  │
   │  • 20-50积分                │
   │  • 随机道具                 │
   │                             │
   │  距离: 32m                  │
   │                             │
   │  [开启宝箱]  [取消]         │
   └─────────────────────────────┘

   触觉反馈: light()
   音效: buttonTap

5. 【开启宝箱】
   - 用户点击「开启宝箱」
   - 检查距离（必须<50m）

   成功情况：
   - 宝箱打开动画（盖子弹起）
   - 光芒四射效果
   - 奖励物品飞出

   ┌─────────────────────────────┐
   │        恭喜获得！           │
   │                             │
   │   [开箱动画]                │
   │                             │
   │   + 35 积分                 │
   │   + 高级画笔 x1             │
   │                             │
   │  [奖励物品图标弹出]          │
   │                             │
   │   [确定]                    │
   └─────────────────────────────┘

   触觉反馈: success()
   音效: treasureOpen

   失败情况（距离过远）：
   ┌─────────────────────────────┐
   │   ⚠️ 距离过远               │
   │                             │
   │  请靠近宝箱至50米内再开启    │
   │                             │
   │  当前距离: 75m              │
   │                             │
   │   [确定]                    │
   └─────────────────────────────┘

   触觉反馈: error()
   音效: errorSound

   失败情况（冷却中）：
   ┌─────────────────────────────┐
   │   ⏰ 冷却中                 │
   │                             │
   │  该宝箱30分钟前已被您开启    │
   │                             │
   │  剩余冷却时间: 15:23        │
   │                             │
   │   [确定]                    │
   └─────────────────────────────┘

   触觉反馈: warning()
   音效: errorSound
```

### 3. 附近玩家交互流程

```
1. 【发现玩家】
   - Zoom ≥ 12时自动显示
   - 玩家位置显示脉冲光点（联盟颜色）
   - 每30秒自动刷新一次

2. 【点击玩家】
   - 光点放大
   - 弹出玩家卡片

   ┌────────────────────────────┐
   │  [头像]  玩家昵称           │
   │  🏴 XX联盟 - 中士          │
   │  📍 距离你 800m            │
   │  ⏱️ 2分钟前活跃            │
   │                            │
   │  今日像素: 156             │
   │  总像素: 12,580            │
   │                            │
   │  [+ 关注]  [查看主页]     │
   └────────────────────────────┘

   触觉反馈: light()
   音效: buttonTap

3. 【关注玩家】
   - 点击「+ 关注」
   - 按钮变为「✓ 已关注」
   - Toast提示 "已关注 XXX"

   触觉反馈: success()
   音效: 无

4. 【查看主页】
   - 跳转到玩家主页
   - 可查看详细信息、绘画历史等
```

---

## 组件库规范

### 1. 通用卡片组件

```swift
struct MapCard<Content: View>: View {
    let content: Content
    var backgroundColor: Color = .white
    var cornerRadius: CGFloat = AppRadius.floatingCard
    var shadow: Bool = true

    init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }

    var body: some View {
        content
            .background(backgroundColor)
            .cornerRadius(cornerRadius)
            .shadow(
                color: shadow ? MapShadow.medium.color : .clear,
                radius: shadow ? MapShadow.medium.radius : 0,
                x: shadow ? MapShadow.medium.x : 0,
                y: shadow ? MapShadow.medium.y : 0
            )
    }
}

// 使用
MapCard {
    VStack {
        Text("内容")
    }
    .padding()
}
```

### 2. 底部弹出面板

```swift
struct BottomSheet<Content: View>: View {
    @Binding var isPresented: Bool
    let height: CGFloat
    let content: Content

    @GestureState private var dragOffset: CGFloat = 0

    init(
        isPresented: Binding<Bool>,
        height: CGFloat = 400,
        @ViewBuilder content: () -> Content
    ) {
        self._isPresented = isPresented
        self.height = height
        self.content = content()
    }

    var body: some View {
        ZStack(alignment: .bottom) {
            if isPresented {
                // 背景遮罩
                Color.black.opacity(0.3)
                    .ignoresSafeArea()
                    .onTapGesture {
                        withAnimation {
                            isPresented = false
                        }
                    }

                // 面板内容
                VStack(spacing: 0) {
                    // 拖拽指示器
                    Capsule()
                        .fill(Color.gray.opacity(0.3))
                        .frame(width: 36, height: 5)
                        .padding(.top, 8)

                    content
                        .padding(.top, 12)
                }
                .frame(height: height)
                .background(.ultraThinMaterial)
                .cornerRadius(20, corners: [.topLeft, .topRight])
                .offset(y: dragOffset)
                .gesture(
                    DragGesture()
                        .updating($dragOffset) { value, state, _ in
                            state = max(0, value.translation.height)
                        }
                        .onEnded { value in
                            if value.translation.height > 100 {
                                withAnimation {
                                    isPresented = false
                                }
                            }
                        }
                )
                .transition(.move(edge: .bottom))
            }
        }
        .animation(.spring(response: 0.3, dampingFraction: 0.8), value: isPresented)
    }
}

// 圆角扩展
extension View {
    func cornerRadius(_ radius: CGFloat, corners: UIRectCorner) -> some View {
        clipShape(RoundedCorner(radius: radius, corners: corners))
    }
}

struct RoundedCorner: Shape {
    var radius: CGFloat = .infinity
    var corners: UIRectCorner = .allCorners

    func path(in rect: CGRect) -> Path {
        let path = UIBezierPath(
            roundedRect: rect,
            byRoundingCorners: corners,
            cornerRadii: CGSize(width: radius, height: radius)
        )
        return Path(path.cgPath)
    }
}
```

### 3. Toast通知组件

```swift
struct ToastView: View {
    let message: String
    let icon: String?
    let type: ToastType
    @Binding var isShowing: Bool

    enum ToastType {
        case success, error, warning, info

        var color: Color {
            switch self {
            case .success: return .green
            case .error: return .red
            case .warning: return .orange
            case .info: return .blue
            }
        }

        var defaultIcon: String {
            switch self {
            case .success: return "checkmark.circle.fill"
            case .error: return "xmark.circle.fill"
            case .warning: return "exclamationmark.triangle.fill"
            case .info: return "info.circle.fill"
            }
        }
    }

    var body: some View {
        if isShowing {
            HStack(spacing: 12) {
                Image(systemName: icon ?? type.defaultIcon)
                    .foregroundColor(type.color)

                Text(message)
                    .font(.system(size: 14, weight: .medium))
                    .foregroundColor(.primary)

                Spacer()
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
            .background(.ultraThinMaterial)
            .cornerRadius(12)
            .shadow(
                color: MapShadow.medium.color,
                radius: MapShadow.medium.radius,
                x: MapShadow.medium.x,
                y: MapShadow.medium.y
            )
            .padding(.horizontal, 16)
            .transition(.move(edge: .top).combined(with: .opacity))
            .onAppear {
                DispatchQueue.main.asyncAfter(deadline: .now() + 3) {
                    withAnimation {
                        isShowing = false
                    }
                }
            }
        }
    }
}

// 使用
@State private var showToast = false
ToastView(
    message: "任务完成！",
    icon: nil,
    type: .success,
    isShowing: $showToast
)
```

---

## 边界情况处理

### 1. 网络异常处理

```swift
class NetworkManager {
    func handleError(_ error: Error) -> MapError {
        if let urlError = error as? URLError {
            switch urlError.code {
            case .notConnectedToInternet, .networkConnectionLost:
                return .networkError
            case .timedOut:
                return .requestTimeout
            default:
                return .serverError
            }
        }
        return .unknownError
    }

    func retryRequest<T>(
        maxAttempts: Int = 3,
        request: @escaping () async throws -> T
    ) async throws -> T {
        var lastError: Error?

        for attempt in 1...maxAttempts {
            do {
                return try await request()
            } catch {
                lastError = error
                if attempt < maxAttempts {
                    // 指数退避
                    try await Task.sleep(nanoseconds: UInt64(pow(2.0, Double(attempt)) * 1_000_000_000))
                }
            }
        }

        throw lastError ?? MapError.unknownError
    }
}
```

### 2. GPS精度处理

```swift
class LocationAccuracyHandler {
    func validateLocation(_ location: CLLocation) -> LocationQuality {
        let horizontalAccuracy = location.horizontalAccuracy

        if horizontalAccuracy < 0 {
            return .invalid
        } else if horizontalAccuracy <= 10 {
            return .excellent
        } else if horizontalAccuracy <= 50 {
            return .good
        } else if horizontalAccuracy <= 100 {
            return .fair
        } else {
            return .poor
        }
    }

    enum LocationQuality {
        case invalid, poor, fair, good, excellent

        var userMessage: String {
            switch self {
            case .invalid:
                return "GPS信号无效"
            case .poor:
                return "GPS信号弱（精度>100m）"
            case .fair:
                return "GPS信号一般（精度50-100m）"
            case .good:
                return "GPS信号良好（精度10-50m）"
            case .excellent:
                return "GPS信号优秀（精度<10m）"
            }
        }

        var canDraw: Bool {
            switch self {
            case .invalid, .poor:
                return false
            default:
                return true
            }
        }
    }
}
```

### 3. 离线模式

```swift
class OfflineManager {
    func cacheMapData(bounds: MapBounds, zoom: Int) {
        // 缓存可视区域的地图数据
        let tasks = loadTasksFromCache(bounds: bounds)
        let treasures = loadTreasuresFromCache(bounds: bounds)
        let players = [] // 实时数据不缓存

        // 显示离线提示
        showOfflineBanner()
    }

    func showOfflineBanner() {
        // 顶部显示离线横幅
        /*
        ┌────────────────────────────────┐
        │ ⚠️ 离线模式 - 功能受限         │
        │ 点击重新连接                   │
        └────────────────────────────────┘
        */
    }

    func syncWhenOnline() async {
        // 网络恢复后同步本地操作
        await syncPendingActions()
        await refreshAllData()
        hideOfflineBanner()
    }
}
```

### 4. 权限处理

```swift
class PermissionHandler {
    func requestLocationPermission(completion: @escaping (Bool) -> Void) {
        let manager = CLLocationManager()

        switch manager.authorizationStatus {
        case .authorizedAlways, .authorizedWhenInUse:
            completion(true)

        case .notDetermined:
            // 首次请求权限
            showPermissionEducation {
                manager.requestWhenInUseAuthorization()
            }

        case .denied, .restricted:
            // 被拒绝，引导去设置
            showSettingsAlert()
            completion(false)

        @unknown default:
            completion(false)
        }
    }

    func showPermissionEducation(onContinue: @escaping () -> Void) {
        // 显示权限说明弹窗
        /*
        ┌────────────────────────────────┐
        │  📍 位置权限                   │
        │                                │
        │  FunnyPixels需要访问您的位置  │
        │  以提供以下功能：               │
        │                                │
        │  • GPS绘画                     │
        │  • 附近玩家发现                │
        │  • 任务导航                    │
        │  • 宝箱拾取                    │
        │                                │
        │  [允许]  [暂不]                │
        └────────────────────────────────┘
        */
    }

    func showSettingsAlert() {
        // 引导用户去设置开启权限
        /*
        ┌────────────────────────────────┐
        │  ⚠️ 需要位置权限               │
        │                                │
        │  请在设置中允许FunnyPixels     │
        │  访问您的位置                  │
        │                                │
        │  [去设置]  [取消]              │
        └────────────────────────────────┘
        */
    }
}
```

---

## 总结

本UX设计规范文档提供了：

✅ **设计系统基础** - 颜色、字体、间距、圆角、阴影完整规范
✅ **布局规范** - 每个组件的精确尺寸和间距
✅ **交互状态** - 所有交互元素的状态设计
✅ **动画效果** - 标准动画时长、曲线、过渡效果
✅ **微交互** - 触觉反馈、音效、加载状态
✅ **错误处理** - 错误状态、空状态设计
✅ **无障碍** - VoiceOver、动态字体、色盲模式
✅ **性能优化** - 懒加载、缓存、节流策略
✅ **用户流程** - 详细的交互流程设计
✅ **组件库** - 可复用的UI组件
✅ **边界情况** - 网络、GPS、离线、权限处理

开发团队可以直接参考本文档开始编码，所有设计细节都已明确，确保最终实现的产品符合UX标准。

---

**文档维护者**: UX Design Team
**最后更新**: 2026-02-28
**下一次审阅**: 开发完成后进行可用性测试
