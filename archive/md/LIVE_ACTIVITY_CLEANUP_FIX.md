# Live Activity 清理问题修复总结

## 🔴 问题描述

活动结束后，锁屏 Live Activity 消息没有被正确关闭，导致用户看到已过期的活动信息持续显示。

## 🔍 根本原因分析

### 1. 缺少明确的清理逻辑
- `EventManager.checkForEndingEvents()` 检测到活动结束时，只发送通知和刷新列表
- **没有调用** `LiveActivityManager.shared.endActivity()` 来关闭 Live Activity

### 2. 完全依赖不可靠的本地 Timer
- `LiveActivityManager.updateCountdown()` 每秒递减倒计时，到 0 时自动调用 `endActivity()`
- **问题**：Timer 可能因以下原因停止工作：
  - 应用进入后台
  - 系统资源限制
  - 应用被杀死后重新启动
- 如果 Timer 失败，Live Activity 永远不会自动关闭

### 3. 观察者逻辑不完整
- `LiveActivityManager` 观察 `currentWarEvent` 的变化
- 当用户离开赛事区域（`currentWarEvent = nil`）时，注释说"保持 Activity 活跃"
- **没有任何清理机制**，即使用户长时间不回来

### 4. 缺少启动时清理
- 应用重启时不会检查是否有过期的 Live Activity
- 用户可能看到已结束但仍在显示的活动消息

## ✅ 修复方案

### 修复 1: 活动结束时明确关闭 Live Activity
**文件**: `EventManager.swift:114-122`

```swift
// Event has ended
if minutesRemaining <= 0 {
    Task { @MainActor in
        self.zoneNotification = .ended(eventTitle: event.title)

        // 🔧 FIX: Explicitly end Live Activity when event ends
        LiveActivityManager.shared.endActivity(showResult: true)

        // Refresh events to remove ended event
        self.fetchEvents()
    }
}
```

**效果**: 当活动自然到期时，立即关闭 Live Activity，显示最终结果 5 分钟。

---

### 修复 2: 离开区域时设置延迟清理
**文件**: `LiveActivityManager.swift:103-127`

```swift
EventManager.shared.$currentWarEvent
    .receive(on: DispatchQueue.main)
    .sink { [weak self] event in
        guard let self = self else { return }
        if let event = event {
            // 进入赛事区域，启动 Live Activity
            self.startActivityIfNeeded(for: event)
        } else if self.isActivityActive {
            // 🔧 FIX: 离开赛事区域时，延迟5分钟后自动结束 Live Activity
            // 给用户一些时间重新进入区域，但不会无限期保持
            DispatchQueue.main.asyncAfter(deadline: .now() + 300) { [weak self] in
                guard let self = self else { return }
                // 只在用户确实没有重新进入时才结束
                if EventManager.shared.currentWarEvent == nil && self.isActivityActive {
                    Logger.info("⏱️ 用户离开赛事区域超过5分钟，自动结束 Live Activity")
                    self.endActivity(showResult: false)
                }
            }
        }
    }
    .store(in: &cancellables)
```

**效果**:
- 用户离开赛事区域后，给予 5 分钟缓冲时间
- 如果 5 分钟内没有重新进入，自动关闭 Live Activity
- 防止用户短暂离开（如进入建筑物、GPS 漂移）时误关闭

---

### 修复 3: 应用启动时清理过期 Activity
**文件**: `LiveActivityManager.swift:99-101, 485-524`

```swift
private init() {
    setupObservers()
    cleanupStaleActivities()  // 🔧 NEW: 启动时清理
}

/// 清理所有过期或无效的 Live Activity（应用启动时调用）
private func cleanupStaleActivities() {
    if #available(iOS 16.1, *) {
        Task {
            // 清理 Event Live Activities
            let eventActivities = Activity<EventActivityAttributes>.activities
            for activity in eventActivities {
                let state = activity.content.state

                // 检查是否已结束或倒计时已过期
                if state.isEnded || state.secondsRemaining <= 0 {
                    Logger.info("🧹 Cleaning up stale Event Live Activity: \(activity.id)")
                    await activity.end(nil, dismissalPolicy: .immediate)
                }
            }

            // 清理 GPS Drawing Live Activities
            let gpsActivities = Activity<GPSDrawingActivityAttributes>.activities
            for activity in gpsActivities {
                let state = activity.content.state

                // 检查是否已结束
                if !state.isActive {
                    Logger.info("🧹 Cleaning up stale GPS Drawing Live Activity: \(activity.id)")
                    await activity.end(nil, dismissalPolicy: .immediate)
                }
            }

            await MainActor.run {
                // 重置本地状态
                if eventActivities.isEmpty {
                    self.isActivityActive = false
                    self.currentActivityId = nil
                }
                if gpsActivities.isEmpty {
                    self.isGPSDrawingActivityActive = false
                    self.gpsDrawingActivityId = nil
                }
            }
        }
    }
}
```

**效果**:
- 应用启动时自动检查所有 Live Activity
- 清除已结束或过期的 Activity
- 重置内部状态，防止状态不一致

---

### 修复 4: 退出区域时检查活动是否已结束
**文件**: `EventManager.swift:388-409`

```swift
private func exitWarZone() {
    Task { @MainActor in
        let exitingEventTitle = currentWarEvent?.title ?? ""
        Logger.info("Exited War Zone: \(exitingEventTitle)")

        // 🔧 FIX: Check if event has ended before exiting
        if let event = currentWarEvent {
            let isoFormatter = ISO8601DateFormatter()
            isoFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            if let endDate = isoFormatter.date(from: event.endTime), endDate < Date() {
                // Event has ended, immediately end Live Activity
                Logger.info("⏱️ 活动已结束，立即关闭 Live Activity")
                LiveActivityManager.shared.endActivity(showResult: true)
            }
        }

        // ... rest of exit logic
    }
}
```

**效果**:
- 用户离开区域时，检查活动是否已自然到期
- 如果已到期，立即关闭 Live Activity（不等待 5 分钟）
- 提供双重保障

---

## 📊 修复覆盖的场景

| 场景 | 修复前 | 修复后 |
|------|--------|--------|
| 活动自然到期 | ❌ Live Activity 不会关闭（依赖 Timer） | ✅ 立即关闭，显示结果 5 分钟 |
| 用户离开区域 | ❌ Activity 无限期保持 | ✅ 5 分钟后自动关闭 |
| 应用重启 | ❌ 过期 Activity 继续显示 | ✅ 启动时自动清理 |
| Timer 失败（后台） | ❌ Activity 永远不关闭 | ✅ 通过其他机制保证清理 |
| 离开已结束的活动区域 | ❌ 等待 5 分钟才关闭 | ✅ 立即关闭 |

## 🧪 测试建议

### 测试 1: 活动自然到期
1. 进入一个即将结束的赛事区域（距离结束 < 2 分钟）
2. 等待活动结束
3. **预期**: Live Activity 自动关闭，显示最终结果 5 分钟后消失

### 测试 2: 离开区域后自动清理
1. 进入赛事区域，触发 Live Activity
2. 离开赛事区域
3. 等待 5 分钟
4. **预期**: Live Activity 自动关闭

### 测试 3: 应用重启清理
1. 进入赛事区域，触发 Live Activity
2. 杀死应用
3. 等待活动结束（或手动修改结束时间）
4. 重新打开应用
5. **预期**: 过期的 Live Activity 被自动清理

### 测试 4: 后台模式下的清理
1. 进入赛事区域，触发 Live Activity
2. 将应用切换到后台
3. 等待活动结束
4. 回到应用
5. **预期**: Live Activity 已被关闭

## 📝 代码审查要点

- ✅ 所有 Live Activity 结束路径都调用 `activity.end()`
- ✅ 使用 `dismissalPolicy` 控制显示时长
- ✅ 正确处理异步操作和 MainActor
- ✅ 添加日志便于调试
- ✅ 处理边界情况（用户快速进出区域等）

## 🚀 部署建议

1. **先在开发环境测试**：验证所有修复场景
2. **逐步发布**：通过 TestFlight 先发布给部分用户
3. **监控日志**：关注 `🧹 Cleaning up` 和 `⏱️` 相关日志
4. **用户反馈**：收集用户关于 Live Activity 行为的反馈

## 📚 相关文档

- [Apple - Managing Live Activities](https://developer.apple.com/documentation/activitykit/managing-live-activities)
- [Live Activity Best Practices](https://developer.apple.com/design/human-interface-guidelines/live-activities)

---

**修复日期**: 2026-02-24
**修复版本**: 待发布
**影响范围**: iOS 16.1+ (Live Activity 功能)
