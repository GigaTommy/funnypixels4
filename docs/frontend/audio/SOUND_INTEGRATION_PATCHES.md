# 音效集成代码补丁
> 生成日期: 2026-02-22

本文档包含所有需要修改的文件和具体代码变更。

## 🎯 P0 高频场景集成

### 1. Tab 切换音效

**文件**: `Views/ContentView.swift`

**位置**: 第 129 行之后（`.tint(AppColors.primary)` 之后）

**添加代码**:
```swift
.onChange(of: selectedTab) { oldValue, newValue in
    // Tab 切换音效 + 触觉反馈
    SoundManager.shared.play(.tabSwitch)
    HapticManager.shared.impact(style: .light)
}
```

**完整上下文**:
```swift
}
.tint(AppColors.primary) // 选中状态使用主题色
.onChange(of: selectedTab) { oldValue, newValue in
    // Tab 切换音效 + 触觉反馈
    SoundManager.shared.play(.tabSwitch)
    HapticManager.shared.impact(style: .light)
}
.overlay(alignment: .top) {
```

---

### 2. FeedTabView Segment 切换音效

**文件**: `Views/Feed/FeedTabView.swift`

**位置**: 第 44 行之后（`.onChange(of: selectedSubTab)` 内部）

**修改代码**:
```swift
.onChange(of: selectedSubTab) { oldValue, newValue in
    if !subTabVisited.contains(selectedSubTab) {
        subTabVisited.insert(selectedSubTab)
    }

    // 添加音效 + 触觉反馈
    SoundManager.shared.play(.tabSwitch)
    HapticManager.shared.impact(style: .light)
}
```

---

### 3. 点赞音效

**文件**: 需要查找所有包含点赞功能的文件

让我搜索点赞相关代码...

---

### 4. 排行榜排名变化音效

**文件**: `Views/LeaderboardTabView.swift`

需要在 ViewModel 中添加排名变化检测逻辑。

**新建方法**:
```swift
// 在 ViewModel 或 View 中添加
@State private var previousRank: Int?

func checkRankChange(newRank: Int?) {
    guard let newRank = newRank, let oldRank = previousRank else {
        previousRank = newRank
        return
    }

    if newRank < oldRank {
        // 排名上升（数字变小）
        SoundManager.shared.play(.rankUp)
        HapticManager.shared.notification(type: .success)
    } else if newRank > oldRank {
        // 排名下降（数字变大）
        SoundManager.shared.play(.rankDown)
        HapticManager.shared.impact(style: .light)
    }

    previousRank = newRank
}
```

---

## 🎯 创建通用组件

### 5. Sheet 音效 Modifier

**新建文件**: `Utils/ViewModifiers/SoundSheetModifier.swift`

```swift
import SwiftUI

/// 带音效的 Sheet Modifier
struct SoundSheetModifier<SheetContent: View>: ViewModifier {
    @Binding var isPresented: Bool
    let onDismiss: (() -> Void)?
    let content: () -> SheetContent

    init(
        isPresented: Binding<Bool>,
        onDismiss: (() -> Void)? = nil,
        @ViewBuilder content: @escaping () -> SheetContent
    ) {
        self._isPresented = isPresented
        self.onDismiss = onDismiss
        self.content = content
    }

    func body(content: Content) -> some View {
        content
            .sheet(isPresented: $isPresented) {
                // Sheet 关闭时
                SoundManager.shared.play(.sheetDismiss)
                onDismiss?()
            } content: {
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
    /// - Parameters:
    ///   - isPresented: 是否显示
    ///   - onDismiss: 关闭回调
    ///   - content: Sheet 内容
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

---

### 6. 优化现有音效使用

**文件**: `Services/Audio/SoundManager.swift`

由于 `SoundManager+Enhanced.swift` 已经创建，现有的 `playSuccess()`, `playFailure()`, `playPop()` 方法应该已经内部调用新的 `play()` 方法。

确保这些方法都已更新为:

```swift
/// Play success sound (compatible with old code)
func playSuccess() {
    play(.success)
}

/// Play failure sound (compatible with old code)
func playFailure() {
    play(.errorGentle)
}

/// Play pop sound (compatible with old code)
func playPop() {
    play(.pixelDraw)
}
```

这样所有现有的 11 个场景会自动使用新的音效文件。

---

## 📝 批量修改建议

### 替换所有 .sheet() 为 .soundSheet()

**优先修改的文件**:
1. `DailyCheckinSheet.swift`
2. `AllianceTabView.swift`
3. `ProfileTabView.swift`
4. `LeaderboardTabView.swift`
5. `FeedTabView.swift`

**修改示例**:
```swift
// 旧代码
.sheet(isPresented: $showCheckin) {
    DailyCheckinSheet()
}

// 新代码
.soundSheet(isPresented: $showCheckin) {
    DailyCheckinSheet()
}
```

---

## 🔍 需要查找的文件

以下场景需要先查找具体文件位置：

1. **点赞功能** - 搜索 `isLiked` 或 `likeArtwork`
2. **联盟加入** - 搜索 `joinAlliance`
3. **领土战** - 搜索 `TerritoryBannerManager` 或 `territoryCaptured`
4. **漂流瓶** - 搜索 `DriftBottle` 或 `bottleEncounter`
5. **赛事** - 搜索 `EventManager` 或 `eventStart`

---

## ✅ 实施检查清单

### Phase 1: 基础集成
- [ ] 添加 `SoundSheetModifier.swift`
- [ ] 修改 `ContentView.swift` - Tab 切换
- [ ] 修改 `FeedTabView.swift` - Segment 切换
- [ ] 更新 `SoundManager.swift` 的旧方法

### Phase 2: 场景查找
- [ ] 查找点赞相关文件
- [ ] 查找联盟相关文件
- [ ] 查找领土战相关文件
- [ ] 查找排行榜相关文件

### Phase 3: 音效添加
- [ ] 添加点赞音效
- [ ] 添加联盟加入音效
- [ ] 添加领土战音效
- [ ] 添加排名变化音效

### Phase 4: Sheet 替换
- [ ] 替换 5+ 个关键 Sheet
- [ ] 测试 Sheet 音效

### Phase 5: 测试验证
- [ ] Tab 切换测试
- [ ] Segment 切换测试
- [ ] Sheet 弹出/关闭测试
- [ ] 音效开关测试
- [ ] 重启 App 测试

---

**下一步**: 让我查找具体的点赞、联盟、领土战等功能的代码位置
