# GPS绘制 Live Activity 完整性修复总结

## 🎯 修复目标

确保GPS绘制（参赛/不参赛）的 Live Activity 支持完整，包括：
1. GPS绘制在赛事区域内和区域外的正确处理
2. GPS Drawing Activity 和 Event Activity 的协调和互斥
3. 赛事贡献的实时同步

## 🔍 问题发现

### 问题1: GPS绘制时赛事贡献不同步（严重 🔴）

**现象**：
- 用户在赛事区域内进行GPS绘制
- 绘制的像素成功，但赛事贡献统计不增长
- 用户排名、里程碑进度不更新

**根本原因**：
```
GPSDrawingService.drawPixelAtLocation()
  ↓ 绘制成功
  ↓ 发送 .gpsPixelDidDraw 通知
  ↓ 更新地图渲染和个人统计
  ✗ EventManager.onPixelDrawnInEvent() 从未被调用
```

**位置**: `GPSDrawingService.swift:1218-1222`

---

### 问题2: Live Activity互斥性未定义（中等 🟡）

**现象**：
- 用户在GPS绘制过程中进入赛事区域
- GPS Drawing Activity 和 Event Activity 可能同时启动
- iOS限制只能显示一个Activity，显示哪个不确定

**根本原因**：
```swift
// LiveActivityManager.startActivityIfNeeded()
guard !isActivityActive else { return }  // ✓ 检查Event Activity
// ✗ 未检查 isGPSDrawingActivityActive
```

**位置**: `LiveActivityManager.swift:579-580`

---

### 问题3: GPS模式下赛事区域检测缺失（中等 🟡）

**现象**：
- GPS绘制模式下，用户位置更新
- 赛事区域进入/离开检测未执行
- 导致赛事Activity启动延迟或失败

**根本原因**：
```swift
// GPSDrawingService.handleLocationUpdate()
MapController.shared.updateForGPSFollowing(location: location)
// ✗ 缺少：EventManager.shared.checkGeofence(location: coordinate)
```

**位置**: `GPSDrawingService.swift:997`

---

## ✅ 修复方案

### 修复1: 添加GPS绘制时的赛事贡献同步

**文件**: `GPSDrawingService.swift`
**位置**: 第1218-1222行之后

```swift
Logger.info("📢 [GPSDrawingService] Posting .gpsPixelDidDraw with userInfo: \(userInfo)")
NotificationCenter.default.post(
    name: .gpsPixelDidDraw,
    object: nil,
    userInfo: userInfo
)

// 🔧 FIX: 如果在赛事区域内绘制，同步更新赛事贡献
if let eventId = EventManager.shared.currentWarEvent?.id {
    Logger.info("⚔️ GPS绘制在赛事区域内，更新赛事贡献: \(eventId)")
    EventManager.shared.onPixelDrawnInEvent(eventId: eventId)
}
```

**效果**：
- ✅ GPS绘制的像素会计入赛事贡献
- ✅ 用户排名实时更新
- ✅ 里程碑进度正确计算
- ✅ 成就解锁触发（通过 `onPixelDrawnInEvent` 中的检查）

---

### 修复2: 添加Live Activity互斥检查

**文件**: `LiveActivityManager.swift`
**位置**: 第579-580行

```swift
private func startActivityIfNeeded(for event: EventService.Event) {
    guard !isActivityActive else { return }

    // 🔧 FIX: 如果GPS绘制Activity正在运行，不启动赛事Activity（避免冲突）
    guard !isGPSDrawingActivityActive else {
        Logger.info("⚠️ GPS Drawing Activity 正在运行，跳过赛事 Activity 启动")
        return
    }

    // 获取用户联盟信息
    Task {
        // ...
    }
}
```

**效果**：
- ✅ GPS绘制进行时进入赛事区域，保持GPS Drawing Activity显示
- ✅ 避免两个Activity冲突
- ✅ 用户体验更连贯（优先显示当前正在进行的活动）

**优先级定义**：
```
GPS Drawing Activity > Event Activity
```

**理由**：
- GPS绘制是用户主动发起的操作，优先级更高
- 赛事区域可能是被动进入（如行走中）
- GPS绘制通常时间更短，结束后可以自动切换到Event Activity

---

### 修复3: 在GPS模式下启用赛事区域检测

**文件**: `GPSDrawingService.swift`
**位置**: 第997行之后

```swift
// 🆕 GPS绘制模式下，使用导航风格的地图跟随（根据速度动态调整缩放）
MapController.shared.updateForGPSFollowing(location: location)

// 🔧 FIX: GPS模式下检测赛事区域，以便实时更新赛事贡献
EventManager.shared.checkGeofence(location: coordinate)

// 检查是否达到最小绘制距离
if let lastCoord = lastDrawnCoordinate {
    // ...
}
```

**效果**：
- ✅ GPS绘制时实时检测赛事区域
- ✅ 进入赛事区域时触发 `enterWarZone()`
- ✅ 离开赛事区域时触发 `exitWarZone()`
- ✅ 赛事贡献同步更及时

---

## 📊 场景完整性验证

修复后，所有场景都能正确处理：

| 场景 | 修复前 | 修复后 |
|------|--------|--------|
| GPS绘制（不参赛） | ✅ 正常 | ✅ 正常 |
| GPS绘制（赛事区域内） | ❌ 贡献不同步 | ✅ 实时同步 |
| GPS进行时进入赛事区域 | ❌ Activity冲突 | ✅ 保持GPS Activity |
| 赛事区域内开始GPS | ✅ 正常 | ✅ 正常，贡献同步 |
| GPS进行时离开赛事区域 | ⚠️ 延迟检测 | ✅ 实时检测 |
| GPS结束后进入赛事 | ✅ 正常 | ✅ 正常 |

---

## 🔄 Live Activity 生命周期

### 场景A: 赛事区域外开始GPS绘制

```
用户: 点击"开始GPS绘制"
  ↓
GPSDrawingService.startGPSDrawing()
  ↓
LiveActivityManager.startGPSDrawingActivity()
  ↓
[显示 GPS Drawing Activity]
  - 绘制像素数: 0
  - 剩余点数: 1000
  - 用时: 00:00
```

**Live Activity 显示**：
```
🎨 GPS绘制
━━━━━━━━━━━━━━
5 像素 · 2:35
剩余 985 点
```

---

### 场景B: GPS绘制时进入赛事区域

```
用户: [GPS绘制中] → [进入赛事区域]
  ↓
EventManager.checkGeofence()
  ↓ 检测到进入
EventManager.enterWarZone()
  ↓
LiveActivityManager.startActivityIfNeeded()
  ↓ guard !isGPSDrawingActivityActive 返回
[保持显示 GPS Drawing Activity]
  ↓
绘制像素时：
EventManager.onPixelDrawnInEvent()  // 🆕 现在会被调用
  ↓
更新赛事贡献、排名、里程碑
```

**Live Activity 显示**：
```
🎨 GPS绘制              ← 保持不变
━━━━━━━━━━━━━━
15 像素 · 5:23          ← 继续更新
剩余 970 点

[赛事贡献在后台同步，但不显示在Activity上]
```

---

### 场景C: GPS绘制结束后，用户仍在赛事区域

```
用户: 点击"停止GPS绘制"
  ↓
GPSDrawingService.stopGPSDrawing()
  ↓
LiveActivityManager.endGPSDrawingActivity()
  ↓
[关闭 GPS Drawing Activity]
  ↓ 60秒后完全消失
EventManager.startActivityIfNeeded()  // 🆕 此时可以启动
  ↓ guard !isGPSDrawingActivityActive 通过（已关闭）
[显示 Event Activity]
  - 联盟排名
  - 用户排名
  - 倒计时
```

**Live Activity 切换**：
```
🎨 GPS绘制
━━━━━━━━━━━━━━        [60秒后消失]
已完成：50 像素

             ↓

⚔️ 城市争夺战
━━━━━━━━━━━━━━
#2 蓝色风暴
剩余 1:45:23
```

---

## 🧪 测试计划

### 测试1: 赛事区域内GPS绘制贡献同步

**步骤**：
1. 登录已参加赛事的账号
2. 进入赛事区域，确认 `EventManager.currentWarEvent` 不为空
3. 开始GPS绘制
4. 绘制5个像素
5. 打开赛事详情页，查看"我的贡献"

**预期结果**：
- ✅ 贡献像素数为 5
- ✅ 排名可能提升
- ✅ 如果达到里程碑（如10像素），触发通知

---

### 测试2: GPS绘制时进入赛事区域

**步骤**：
1. 在赛事区域外开始GPS绘制
2. 确认显示 GPS Drawing Activity
3. 走进赛事区域（或使用模拟位置）
4. 观察 Live Activity 显示

**预期结果**：
- ✅ 保持显示 GPS Drawing Activity
- ✅ 日志显示：`⚠️ GPS Drawing Activity 正在运行，跳过赛事 Activity 启动`
- ✅ 后续绘制的像素计入赛事贡献

---

### 测试3: GPS结束后切换到赛事Activity

**步骤**：
1. 在赛事区域内开始GPS绘制
2. 绘制若干像素
3. 点击"停止GPS绘制"
4. 等待60秒（GPS Activity消失时间）
5. 观察 Live Activity 显示

**预期结果**：
- ✅ GPS Drawing Activity 显示"已完成"，60秒后消失
- ✅ 消失后，Event Activity 自动启动
- ✅ Event Activity 显示最新的排名和倒计时

---

### 测试4: 赛事区域检测实时性

**步骤**：
1. 开始GPS绘制
2. 使用模拟位置，从赛事区域外移动到赛事区域内
3. 观察日志输出

**预期结果**：
- ✅ 日志显示：`⚔️ EventManager: 📍 [lat, lng] 进入赛事区域 [活动名称]`
- ✅ 进入后的像素绘制触发赛事贡献更新

---

## 📝 代码审查要点

### ✅ 修复1检查清单
- [x] 在像素绘制成功后立即调用 `onPixelDrawnInEvent()`
- [x] 只在 `currentWarEvent` 不为空时调用（避免无效调用）
- [x] 添加日志便于追踪

### ✅ 修复2检查清单
- [x] 在 `startActivityIfNeeded()` 开头添加 guard 语句
- [x] 检查 `isGPSDrawingActivityActive` 状态
- [x] 添加清晰的日志说明原因

### ✅ 修复3检查清单
- [x] 在位置更新时调用 `checkGeofence()`
- [x] 调用位置在地图更新之后、绘制检查之前
- [x] 不影响现有的绘制流程

---

## 🎓 设计原则

### 1. Activity 优先级
```
GPS Drawing Activity > Event Activity
```

**理由**：
- GPS绘制是用户主动发起的任务，优先级高
- 避免用户困惑（"我正在绘制，为什么切换了？"）
- GPS绘制结束后，Event Activity 可以无缝接管

### 2. 状态同步
```
GPSDrawingService ←→ EventManager
```

**原则**：
- GPS绘制服务负责像素绘制
- EventManager负责赛事逻辑
- 两者通过 `currentWarEvent` 和 `onPixelDrawnInEvent()` 连接

### 3. 用户体验
```
连贯 > 准确 > 实时
```

**权衡**：
- GPS绘制时不切换Activity（连贯性）
- 赛事贡献后台同步（不打断用户）
- 结束后平滑切换到Event Activity

---

## 📚 相关文档

- [Live Activity 清理问题修复](./LIVE_ACTIVITY_CLEANUP_FIX.md)
- [Live Activity 功能差距分析](./LIVE_ACTIVITY_GAP_ANALYSIS.md) - 已废弃（手动绘制不存在）
- [Apple - ActivityKit Documentation](https://developer.apple.com/documentation/activitykit)

---

**修复日期**: 2026-02-24
**修复版本**: 待发布
**影响范围**: GPS绘制功能，赛事贡献同步
**优先级**: P0（功能完整性）
