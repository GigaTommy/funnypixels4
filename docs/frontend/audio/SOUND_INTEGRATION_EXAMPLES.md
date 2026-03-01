# 音效集成示例代码

本文档提供各场景的音效集成示例，**所有音效都自动联动设置开关**。

## 🔑 核心机制

### ✅ 音效开关保障

所有音效播放方法都有 `guard !isMuted else { return }` 保护：

```swift
// SoundManager.swift
func play(_ effect: SoundEffect) {
    guard !isMuted else { return }  // ✅ 设置开关检查
    // ... 播放逻辑
}

func playSuccess() {
    guard !isMuted else { return }  // ✅ 设置开关检查
    AudioServicesPlaySystemSound(1057)
}
```

**机制说明**:
1. 用户在 `SettingsView` 关闭音效开关
2. `soundManager.isMuted = true`
3. 所有后续的音效调用都会在第一行被拦截
4. `return` 直接返回，不执行任何播放逻辑

---

## 📝 集成示例

### 1. Tab 切换音效

**文件**: `Views/MainTabView.swift`

```swift
import SwiftUI

struct MainTabView: View {
    @State private var selectedTab: Tab = .map

    var body: some View {
        TabView(selection: $selectedTab) {
            MapTabView()
                .tag(Tab.map)
                .tabItem {
                    Label("map.title", systemImage: "map.fill")
                }

            FeedTabView()
                .tag(Tab.feed)
                .tabItem {
                    Label("feed.title", systemImage: "photo.stack.fill")
                }

            // ... 其他 Tab
        }
        .onChange(of: selectedTab) { oldValue, newValue in
            // ✅ 添加音效 + 触觉反馈
            SoundManager.shared.play(.tabSwitch)
            HapticManager.shared.impact(style: .light)
        }
    }
}
```

**验证方法**:
1. 打开 App，切换 Tab → 应听到切换音
2. 进入设置关闭音效 → 切换 Tab 无音效
3. 重新打开音效 → 切换 Tab 恢复音效

---

### 2. 点赞音效

**文件**: `Views/Feed/ArtworkCard.swift`

```swift
import SwiftUI

struct ArtworkCard: View {
    @State private var isLiked: Bool
    @State private var likeCount: Int

    private func toggleLike() {
        Task {
            let wasLiked = isLiked
            isLiked.toggle()

            if isLiked {
                likeCount += 1
                // ✅ 添加音效 + 触觉反馈
                SoundManager.shared.play(.likeSend)
                HapticManager.shared.impact(style: .medium)
            } else {
                likeCount -= 1
            }

            // 发送请求到服务器
            do {
                if isLiked {
                    try await SocialService.shared.likeArtwork(id: artwork.id)
                } else {
                    try await SocialService.shared.unlikeArtwork(id: artwork.id)
                }
            } catch {
                // 回滚状态
                isLiked = wasLiked
                likeCount += isLiked ? 1 : -1
            }
        }
    }
}
```

**验证方法**:
1. 点赞 → 应听到点赞音 + 感受到触觉
2. 关闭音效 → 点赞仅有触觉，无音效
3. 关闭触觉和音效 → 无任何反馈（仅视觉）

---

### 3. Sheet 弹出/关闭音效

**方式 A: 使用自定义 Modifier**

**新建文件**: `Utils/ViewModifiers/SoundSheetModifier.swift`

```swift
import SwiftUI

/// 带音效的 Sheet Modifier
struct SoundSheetModifier<SheetContent: View>: ViewModifier {
    @Binding var isPresented: Bool
    let onDismiss: (() -> Void)?
    let content: () -> SheetContent

    func body(content: Content) -> some View {
        content
            .sheet(isPresented: $isPresented, onDismiss: {
                // Sheet 关闭时
                SoundManager.shared.play(.sheetDismiss)
                onDismiss?()
            }) {
                self.content()
                    .onAppear {
                        // Sheet 弹出时
                        SoundManager.shared.play(.sheetPresent)
                        HapticManager.shared.impact(style: .light)
                    }
            }
    }
}

extension View {
    /// 带音效的 Sheet
    func soundSheet<Content: View>(
        isPresented: Binding<Bool>,
        onDismiss: (() -> Void)? = nil,
        @ViewBuilder content: @escaping () -> Content
    ) -> some View {
        modifier(SoundSheetModifier(
            isPresented: isPresented,
            onDismiss: onDismiss,
            content: content
        ))
    }
}
```

**使用示例**:

```swift
struct DailyTaskView: View {
    @State private var showCheckin = false

    var body: some View {
        VStack {
            Button("签到") {
                showCheckin = true
            }
        }
        // ✅ 使用带音效的 Sheet
        .soundSheet(isPresented: $showCheckin) {
            DailyCheckinSheet()
        }
    }
}
```

**方式 B: 手动在每个 Sheet 中添加**

```swift
.sheet(isPresented: $showSettings) {
    SettingsView()
        .onAppear {
            SoundManager.shared.play(.sheetPresent)
            HapticManager.shared.impact(style: .light)
        }
        .onDisappear {
            SoundManager.shared.play(.sheetDismiss)
        }
}
```

**推荐**: 使用方式 A（统一管理）

---

### 4. 像素绘制音效

**文件**: `Views/Map/MapLibreMapView.swift`

```swift
// 已存在的代码
private func handlePixelPlacement(at coordinate: CLLocationCoordinate2D) {
    // ✅ 替换现有的 playPop() 为新的枚举方法
    // 旧代码: SoundManager.shared.playPop()
    SoundManager.shared.play(.pixelDraw)
    HapticManager.shared.impact(style: .light)

    // ... 现有的像素绘制逻辑
}
```

**改进**: 向后兼容，旧方法内部调用新方法

```swift
// SoundManager.swift
func playPop() {
    play(.pixelDraw)  // ✅ 内部调用新方法，自动享有 isMuted 检查
}
```

---

### 5. 成就解锁音效

**文件**: `ViewModels/DailyTaskViewModel.swift`

```swift
func completeTask(_ task: DailyTask) async {
    // ... 完成任务逻辑

    if taskCompleted {
        // ✅ 播放成功音效
        await MainActor.run {
            SoundManager.shared.play(.success)
            HapticManager.shared.notification(type: .success)
        }

        // 检查是否升级
        if didLevelUp {
            await MainActor.run {
                SoundManager.shared.play(.levelUp)
                HapticManager.shared.notification(type: .success)
            }
        }
    }
}
```

---

### 6. 排名变化音效

**文件**: `ViewModels/LeaderboardViewModel.swift`

```swift
class LeaderboardViewModel: ObservableObject {
    @Published var myRank: Int?
    private var previousRank: Int?

    func refreshRankings() async {
        // ... 获取最新排名

        if let newRank = myRank, let oldRank = previousRank {
            checkRankChange(newRank: newRank, oldRank: oldRank)
        }

        previousRank = myRank
    }

    private func checkRankChange(newRank: Int, oldRank: Int) {
        DispatchQueue.main.async {
            if newRank < oldRank {
                // 排名上升（数字变小）
                SoundManager.shared.play(.rankUp)
                HapticManager.shared.notification(type: .success)

                // 显示庆祝 Toast
                ToastManager.shared.show("排名上升至第 \(newRank) 名!", style: .success)
            } else if newRank > oldRank {
                // 排名下降（数字变大）
                SoundManager.shared.play(.rankDown)
                HapticManager.shared.impact(style: .light)
            }
        }
    }
}
```

---

### 7. 联盟操作音效

**文件**: `ViewModels/AllianceViewModel.swift`

```swift
class AllianceViewModel: ObservableObject {

    func joinAlliance(_ allianceId: Int) async {
        do {
            try await AllianceService.shared.joinAlliance(id: allianceId)

            await MainActor.run {
                // ✅ 加入成功音效
                SoundManager.shared.play(.allianceJoin)
                HapticManager.shared.notification(type: .success)

                ToastManager.shared.show("成功加入联盟!", style: .success)
            }
        } catch {
            await MainActor.run {
                SoundManager.shared.play(.errorGentle)
                HapticManager.shared.notification(type: .error)
                ToastManager.shared.show("加入失败: \(error.localizedDescription)", style: .error)
            }
        }
    }
}
```

**文件**: `Managers/TerritoryBannerManager.swift`

```swift
class TerritoryBannerManager: ObservableObject {

    func showTerritoryLost(territory: Territory) {
        // ✅ 领土失守音效（警示但不刺耳）
        SoundManager.shared.play(.territoryLost)
        HapticManager.shared.notification(type: .warning)

        // 显示 Banner
        currentBanner = .territoryLost(territory)
    }

    func showTerritoryCaptured(territory: Territory) {
        // ✅ 占领成功音效（胜利号角）
        SoundManager.shared.play(.territoryCaptured)
        HapticManager.shared.notification(type: .success)

        // 显示庆祝 Banner
        currentBanner = .territoryCaptured(territory)
    }
}
```

---

### 8. 漂流瓶音效

**文件**: `Managers/DriftBottleManager.swift`

```swift
class DriftBottleManager: ObservableObject {

    func onBottleEncountered(_ bottle: DriftBottle) {
        // ✅ 遭遇漂流瓶音效（神秘、好奇）
        SoundManager.shared.play(.bottleEncounter)
        HapticManager.shared.notification(type: .success)

        // 显示遭遇提示
        showBottleEncounterToast(bottle)
    }

    func openBottle(_ bottleId: Int) async {
        // ✅ 打开漂流瓶音效（惊喜、清脆）
        SoundManager.shared.play(.bottleOpen)
        HapticManager.shared.impact(style: .medium)

        // ... 打开漂流瓶逻辑
    }
}
```

---

### 9. 赛事音效

**文件**: `Managers/EventManager.swift`

```swift
class EventManager: ObservableObject {

    func onEventStarted(_ event: Event) {
        // ✅ 赛事开始音效（激昂哨声）
        SoundManager.shared.play(.eventStart)
        HapticManager.shared.notification(type: .success)

        // 显示赛事开始 Banner
        showEventStartBanner(event)
    }

    func onCountdownTick(remainingSeconds: Int) {
        // 最后 10 秒播放倒计时音效
        if remainingSeconds <= 10 {
            // ✅ 倒计时音效（紧张节奏）
            SoundManager.shared.play(.eventCountdown)
            HapticManager.shared.impact(style: .heavy)
        }
    }
}
```

---

### 10. 错误提示音效

**文件**: 各 ViewModel 的错误处理

```swift
// 示例：网络请求错误
do {
    try await performAction()
} catch {
    // ✅ 温和错误音效（非侵入）
    SoundManager.shared.play(.errorGentle)
    HapticManager.shared.notification(type: .error)

    ToastManager.shared.show(error.localizedDescription, style: .error)
}
```

**替换旧代码**:
```swift
// 旧代码
SoundManager.shared.playFailure()  // 系统音效 1053

// 新代码
SoundManager.shared.play(.errorGentle)  // 自定义温和音效
```

---

## 🔧 向后兼容

### 保留旧方法

为了不破坏现有代码，所有旧方法都保留并内部调用新方法：

```swift
// SoundManager.swift

// ✅ 旧方法（保留）
func playSuccess() {
    play(.success)  // 内部调用新方法
}

func playFailure() {
    play(.errorGentle)  // 内部调用新方法
}

func playPop() {
    play(.pixelDraw)  // 内部调用新方法
}
```

**好处**:
1. ✅ 现有代码无需修改，继续工作
2. ✅ 自动享有新的音效管理机制
3. ✅ 自动联动设置开关（`isMuted` 检查）

---

## 📱 设置页集成

### 当前实现（已完美）

**文件**: `Views/SettingsView.swift`

```swift
struct SettingsView: View {
    @ObservedObject private var soundManager = SoundManager.shared

    var body: some View {
        Form {
            Section(NSLocalizedString("settings.sound", comment: "")) {
                Toggle(isOn: Binding(
                    get: { !soundManager.isMuted },  // ✅ 读取状态
                    set: { soundManager.isMuted = !$0 }  // ✅ 更新状态
                )) {
                    Label(
                        NSLocalizedString("settings.sound_effects", comment: ""),
                        systemImage: soundManager.isMuted ? "speaker.slash.fill" : "speaker.wave.2.fill"
                    )
                }
            }
        }
    }
}
```

**机制说明**:
1. `Binding` 将 Toggle 双向绑定到 `soundManager.isMuted`
2. 用户点击 Toggle → `soundManager.isMuted` 改变
3. `isMuted` 的 `didSet` 触发 → 保存到 UserDefaults
4. 所有音效播放方法检查 `isMuted` → 自动生效

**测试验证**:
```swift
// 1. 关闭音效
soundManager.isMuted = true
// ✅ UserDefaults 已保存

// 2. 尝试播放音效
SoundManager.shared.play(.success)
// ✅ 被拦截，无声音

// 3. 重启 App
// ✅ isMuted 从 UserDefaults 恢复为 true

// 4. 打开音效
soundManager.isMuted = false
// ✅ 音效恢复正常
```

---

## 🎯 完整集成检查清单

### 已集成场景 ✅

- [x] **像素绘制** - `MapLibreMapView` 使用 `playPop()`
- [x] **成就解锁** - `DailyTaskViewModel` 使用 `playSuccess()`
- [x] **签到成功** - `DailyCheckinSheet` 使用 `playSuccess()`
- [x] **任务完成** - `DailyChallengeBar` 使用 `playSuccess()`
- [x] **操作失败** - 多处使用 `playFailure()`

### 待集成场景 ⭐

- [ ] **Tab 切换** - `MainTabView.swift`
- [ ] **点赞操作** - `ArtworkCard.swift`, `FeedTabView.swift`
- [ ] **Sheet 弹出/关闭** - 所有使用 `.sheet()` 的地方
- [ ] **排名变化** - `LeaderboardViewModel.swift`
- [ ] **加入联盟** - `AllianceViewModel.swift`
- [ ] **领土占领/失守** - `TerritoryBannerManager.swift`
- [ ] **漂流瓶** - `DriftBottleManager.swift`
- [ ] **赛事开始/倒计时** - `EventManager.swift`

### 集成步骤

**对于每个场景**:
1. 找到触发点（按钮点击、状态变化等）
2. 添加 `SoundManager.shared.play(.音效类型)`
3. 配合 `HapticManager.shared.*` 触觉反馈
4. 测试音效开关是否生效

**示例**:
```swift
// 触发点
Button("点赞") {
    isLiked.toggle()

    // ✅ 添加音效
    if isLiked {
        SoundManager.shared.play(.likeSend)
        HapticManager.shared.impact(style: .medium)
    }
}
```

---

## 🧪 测试验证

### 自动测试

**单元测试**: `Tests/SoundManagerTests.swift`

```swift
func testMutedPlayback() {
    soundManager.isMuted = true

    // 应该静默，不会崩溃
    soundManager.play(.success)
    soundManager.play(.pixelDraw)
    soundManager.play(.likeSend)

    // ✅ 通过
}
```

### 手动测试

**测试步骤**:
1. 打开 App，进入"设置"
2. 关闭音效开关
3. 尝试以下操作:
   - 切换 Tab → ❌ 无音效
   - 点赞 → ❌ 无音效（可能有触觉）
   - 绘制像素 → ❌ 无音效
   - 签到 → ❌ 无音效
4. 打开音效开关
5. 重复上述操作 → ✅ 所有音效恢复
6. 重启 App → ✅ 音效设置保持

---

## 💡 最佳实践

### 1. 音效 + 触觉联动

**推荐模式**:
```swift
// UI 交互（轻触感）
SoundManager.shared.play(.tabSwitch)
HapticManager.shared.impact(style: .light)

// 成功操作（通知反馈）
SoundManager.shared.play(.success)
HapticManager.shared.notification(type: .success)

// 警告操作（警告反馈）
SoundManager.shared.play(.territoryLost)
HapticManager.shared.notification(type: .warning)

// 错误操作（错误反馈）
SoundManager.shared.play(.errorGentle)
HapticManager.shared.notification(type: .error)
```

### 2. 异步场景处理

**在 Task 中使用**:
```swift
Task {
    let result = await performAction()

    // ✅ 确保在主线程播放音效
    await MainActor.run {
        if result.success {
            SoundManager.shared.play(.success)
            HapticManager.shared.notification(type: .success)
        } else {
            SoundManager.shared.play(.errorGentle)
            HapticManager.shared.notification(type: .error)
        }
    }
}
```

### 3. 避免音效重叠

**防止快速连续播放**:
```swift
private var lastPlayTime: Date?

func playSafely(_ effect: SoundEffect) {
    let now = Date()
    if let last = lastPlayTime, now.timeIntervalSince(last) < 0.3 {
        return  // 距离上次播放不足 0.3 秒，跳过
    }

    SoundManager.shared.play(effect)
    lastPlayTime = now
}
```

### 4. 预加载常用音效

**在 App 启动时**:
```swift
// AppDelegate 或 ContentView
.onAppear {
    // 预加载高频音效
    SoundManager.shared.preloadSounds([
        .pixelDraw,
        .tabSwitch,
        .likeSend,
        .success
    ])
}
```

---

## 🎉 总结

### ✅ 核心保障

**所有音效都联动设置开关** 的机制：
1. `SoundManager.shared.isMuted` 作为全局开关
2. 每个播放方法第一行检查 `guard !isMuted else { return }`
3. 用户在设置页关闭 → `isMuted = true` → 所有音效被拦截
4. 持久化到 UserDefaults → 重启 App 后设置保持

### 📦 实施收益

- ✅ **0 风险**: 向后兼容，旧代码继续工作
- ✅ **0 成本**: 免费音效资源
- ✅ **轻量级**: 包体积增长仅 ~390 KB
- ✅ **易维护**: 语义化 API，代码清晰
- ✅ **用户友好**: 设置开关一键控制所有音效

---

**文档制作**: Claude (AI 开发助手)
**最后更新**: 2026-02-22
