# 代码集成检查清单

## 📝 文件添加清单

### 1. 添加新文件到 Xcode 项目

**位置**: `Services/Audio/`

- [ ] 添加 `SoundEffect.swift`
- [ ] 添加 `SoundManager+Enhanced.swift`

**步骤**:
1. 在 Xcode 中右键 `Services/Audio` 文件夹
2. 选择 "Add Files to FunnyPixelsApp..."
3. 选择上述两个文件
4. 确保勾选:
   - ✅ Copy items if needed
   - ✅ Add to targets: FunnyPixelsApp

### 2. 添加音效文件到 Bundle Resources

**位置**: `Resources/Sounds/`

- [ ] 确认所有 18 个音效文件已添加
- [ ] 在 Xcode Build Phases > Copy Bundle Resources 中验证

## 🔧 代码修改清单

### P0 - 高频场景（必须完成）

#### ContentView.swift - Tab 切换
- [ ] 找到 `TabView(selection: $selectedTab)`
- [ ] 添加 `.onChange(of: selectedTab)` 音效

```swift
.onChange(of: selectedTab) { oldValue, newValue in
    SoundManager.shared.play(.tabSwitch)
    HapticManager.shared.impact(style: .light)
}
```

#### FeedTabView.swift - Segment 切换
- [ ] 找到 `Picker("FeedType", selection: $selectedSubTab)`
- [ ] 添加 `.onChange(of: selectedSubTab)` 音效

#### ArtworkCard.swift - 点赞
- [ ] 找到点赞方法 `toggleLike()`
- [ ] 添加音效代码

```swift
if isLiked {
    SoundManager.shared.play(.likeSend)
    HapticManager.shared.impact(style: .medium)
}
```

#### LeaderboardTabView.swift - 排名变化
- [ ] 创建排名变化检测逻辑
- [ ] 添加音效

```swift
if newRank < oldRank {
    SoundManager.shared.play(.rankUp)
    HapticManager.shared.notification(type: .success)
} else if newRank > oldRank {
    SoundManager.shared.play(.rankDown)
    HapticManager.shared.impact(style: .light)
}
```

#### AllianceViewModel.swift - 加入联盟
- [ ] 找到 `joinAlliance()` 方法
- [ ] 成功时添加音效

```swift
SoundManager.shared.play(.allianceJoin)
HapticManager.shared.notification(type: .success)
```

#### TerritoryBannerManager.swift - 领土战
- [ ] 找到领土占领方法
- [ ] 添加音效

```swift
// 占领
SoundManager.shared.play(.territoryCaptured)
HapticManager.shared.notification(type: .success)

// 失守
SoundManager.shared.play(.territoryLost)
HapticManager.shared.notification(type: .warning)
```

### P1 - UI 交互（建议完成）

#### 所有 .sheet() - Sheet 音效
- [ ] 创建 `SoundSheetModifier.swift`
- [ ] 替换关键 Sheet 为 `.soundSheet()`

### P2 - 特殊功能（可选）

#### DriftBottleManager.swift - 漂流瓶
#### EventManager.swift - 赛事
#### ShopTabView.swift - 商店

## ✅ 验证清单

- [ ] 编译通过
- [ ] 运行 App 无崩溃
- [ ] 关闭音效开关 → 所有音效静音
- [ ] 打开音效开关 → 所有音效正常
- [ ] 重启 App → 设置保持
- [ ] Tab 切换有音效
- [ ] 点赞有音效
- [ ] 至少 5 个场景有音效
