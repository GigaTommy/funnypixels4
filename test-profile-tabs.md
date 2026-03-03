# ProfileTab Sub-Tabs Missing Issue - Diagnosis

## User Report
"我的tab 原来有三个选项卡，现在只剩下一个（排行榜、设置菜单都不见了）"

## Code Verification

### ✅ ProfileSubTab Enum (AppState.swift:148-160)
```swift
enum ProfileSubTab: String, CaseIterable, CustomStringConvertible {
    case personal      // "个人"
    case leaderboard   // "排行"
    case more          // "更多"
}
```
- All 3 cases defined
- Localization strings exist
- CustomStringConvertible implemented

### ✅ CapsuleTabPicker Component (Components/CapsuleTabPicker.swift)
- Generic implementation
- Uses `ForEach(items, id: \.self)`
- Should render all items in ProfileSubTab.allCases

### ✅ ProfileTabView Implementation (Views/ProfileTabView.swift:15-29)
```swift
VStack(spacing: 0) {
    CapsuleTabPicker(items: ProfileSubTab.allCases, selection: $appState.profileSubTab)

    Group {
        switch appState.profileSubTab {
        case .personal:      personalTabContent
        case .leaderboard:   LeaderboardTabView()
        case .more:          moreTabContent
        }
    }
}
```

## Possible Causes

### 1. **ScrollView Hidden Tabs** (Most Likely)
CapsuleTabPicker uses `ScrollView(.horizontal, showsIndicators: false)`. If:
- The first tab button is too wide
- Container width is constrained
- Other tabs might be scrollable but hidden off-screen

**Solution**: Check if tabs are scrollable horizontally

### 2. **App State Not Initialized**
If `appState` is not properly injected via `.environmentObject`, the view might fail to render properly.

### 3. **Build Cache Issue**
User might be running an old build that doesn't have the latest ProfileSubTab changes.

### 4. **Font/Padding Issue**
With fontManager.scale applied, button padding might cause layout overflow.

## Recommended Actions

1. **Immediate**: Ask user to try horizontally scrolling the tab bar
2. **Check**: Verify app is running latest build (not cached old version)
3. **Debug**: Add `.frame(minWidth: ...)` to CapsuleTabPicker buttons to ensure visibility
4. **Test**: Run on actual device/simulator to verify tab picker rendering

## Test Command
```bash
cd FunnyPixelsApp && xcodebuild -scheme FunnyPixelsApp -destination 'platform=iOS Simulator,name=iPhone 17' build
```
