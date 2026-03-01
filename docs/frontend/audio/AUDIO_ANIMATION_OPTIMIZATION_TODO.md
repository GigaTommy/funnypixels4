# iOS应用音效和动画优化 TODO List

**创建时间**: 2026-02-23
**原则**: 性能优先 - 延迟<1ms, CPU<0.5%, 不阻塞主线程
**当前覆盖率**: 11% (33/293个交互点)
**目标覆盖率**: 45% (质量优先，不追求数量)

---

## ✅ 已完成 (Phase 0 - 验证通过)

### 核心功能反馈

- [x] **像素绘制音效** - `MapLibreMapView.swift`, `GPSDrawingService.swift`
  - 实现: SystemSound + 50ms节流
  - 性能: <0.5ms延迟, <0.2% CPU ✅

- [x] **登录/注册反馈** - `AuthViewModel.swift:102-104, 136-138, 186-188`
  - 实现: 成功/失败音效 + 触觉
  - 性能: <0.5ms延迟, <0.3% CPU ✅

- [x] **点赞音效** - `FeedItemCard.swift:45-46`
  - 实现: likeSend音效 + light触觉
  - 性能: <0.5ms延迟, <0.2% CPU ✅

- [x] **Tab切换反馈** - `ContentView.swift:139-143`
  - 实现: tabSwitch音效 + light触觉
  - 性能: <0.5ms延迟, <0.3% CPU ✅

- [x] **成就解锁** - `ContentView.swift:296-299`
  - 实现: 系统音效1057 + success触觉
  - 性能: <1ms延迟 ✅

- [x] **签到反馈** - `DailyCheckinSheet.swift:523, 540`
  - 实现: success音效 + success触觉
  - 性能: <1ms延迟 ✅

**当前状态**: 6个核心场景 ✅ 性能优秀 ⚡

---

## 🎯 Phase 1 - 高优先级（立即实施）

### 1.1 购买/支付流程反馈 💰

**优先级**: ⭐⭐⭐⭐⭐ (最高)
**预计工时**: 30分钟
**性能影响**: 低 (<1ms, <0.5% CPU)

#### 待实施场景：

- [ ] **购买成功反馈** - `ShopTabView.swift:111-118`
  ```swift
  // 在purchase成功后（alert展示前）添加
  SoundManager.shared.playSuccess()
  HapticManager.shared.notification(type: .success)

  // 可选：金币动画
  withAnimation(.spring(duration: 0.3)) {
      showCoinsAnimation = true
  }
  ```
  - **文件**: `FunnyPixelsApp/FunnyPixelsApp/Views/ShopTabView.swift`
  - **位置**: 第111-118行（alert展示处）
  - **测试**: 购买任意商品验证

- [ ] **充值成功反馈** - `ShopTabView.swift:579-583`
  ```swift
  // 在充值成功回调中添加
  SoundManager.shared.playSuccess()
  HapticManager.shared.notification(type: .success)
  ```
  - **文件**: `FunnyPixelsApp/FunnyPixelsApp/Views/ShopTabView.swift`
  - **位置**: 第579-583行
  - **测试**: 完成充值流程验证

- [ ] **购买失败反馈** - 错误处理处
  ```swift
  // 在购买失败时
  SoundManager.shared.playFailure()
  HapticManager.shared.notification(type: .error)
  ```
  - **文件**: `FunnyPixelsApp/FunnyPixelsApp/Views/ShopTabView.swift`
  - **位置**: catch块中
  - **测试**: 模拟网络错误验证

**验收标准**:
- ✅ 购买成功有愉悦反馈
- ✅ 充值成功有明确提示
- ✅ 失败时有警示反馈
- ✅ 延迟<1ms，无卡顿

---

### 1.2 GPS绘制控制反馈 🎨

**优先级**: ⭐⭐⭐⭐⭐
**预计工时**: 15分钟
**性能影响**: 低 (<1ms)

#### 待实施场景：

- [ ] **GPS绘制开始音效** - `FogMapGPSDrawingControl.swift:136-141`
  ```swift
  // 在startDrawing()方法中
  SoundManager.shared.play(.drawingStart)  // 需新增音效
  HapticManager.shared.impact(style: .medium)  // 已有
  ```
  - **文件**: `FunnyPixelsApp/FunnyPixelsApp/Views/Drawing/FogMapGPSDrawingControl.swift`
  - **位置**: 第136-141行（已有medium触觉）
  - **测试**: 点击"开始绘制"验证

- [ ] **GPS绘制停止音效** - `FogMapGPSDrawingControl.swift:146-151`
  ```swift
  // 在stopDrawing()方法中
  SoundManager.shared.play(.drawingStop)  // 需新增音效
  HapticManager.shared.impact(style: .medium)
  ```
  - **文件**: 同上
  - **位置**: 第146-151行
  - **测试**: 点击"停止绘制"验证

**所需新增音效**:
- `drawingStart.m4a` - 轻快启动音 (0.2秒)
- `drawingStop.m4a` - 柔和停止音 (0.2秒)

**验收标准**:
- ✅ 开始绘制有清晰反馈
- ✅ 停止绘制有明确提示
- ✅ 与像素绘制音效协调
- ✅ 延迟<1ms

---

### 1.3 任务奖励领取反馈 🎁

**优先级**: ⭐⭐⭐⭐
**预计工时**: 20分钟
**性能影响**: 低 (<1ms)

#### 待实施场景：

- [ ] **单个任务奖励领取** - `DailyTasksView.swift`（需定位具体位置）
  ```swift
  // 在领取奖励成功后
  SoundManager.shared.playSuccess()
  HapticManager.shared.notification(type: .success)

  // 可选：奖励数字弹出动画
  withAnimation(.spring(response: 0.5)) {
      showRewardAnimation = true
  }
  ```
  - **文件**: 需搜索Daily Task相关View
  - **测试**: 完成任务并领取奖励

- [ ] **全部完成额外奖励** - 特殊奖励场景
  ```swift
  // 在领取全部完成奖励时（更重要）
  SoundManager.shared.play(.levelUp)  // 使用特殊音效
  HapticManager.shared.notification(type: .success)
  ```
  - **文件**: 同上
  - **测试**: 完成所有任务并领取

**所需新增音效**:
- `levelUp.m4a` - 升级/特殊奖励音效 (0.5秒)

**验收标准**:
- ✅ 领取奖励有满足感
- ✅ 全部完成有特殊庆祝
- ✅ 延迟<1ms

---

## 🎯 Phase 2 - 中优先级（本周完成）

### 2.1 表单和设置反馈 ⚙️

**优先级**: ⭐⭐⭐
**预计工时**: 25分钟
**性能影响**: 低 (<1ms)

#### 待实施场景：

- [ ] **个人资料保存成功** - `ProfileEditView.swift:62-68`
  ```swift
  // 在保存成功后
  SoundManager.shared.playSuccess()
  HapticManager.shared.notification(type: .success)
  ```
  - **文件**: `FunnyPixelsApp/FunnyPixelsApp/Views/ProfileEditView.swift`
  - **位置**: 第62-68行
  - **工时**: 5分钟

- [ ] **Toggle切换反馈** - `SettingsView.swift:92-94` 及其他Toggle
  ```swift
  // 在Toggle的onChange中
  HapticManager.shared.selection()
  ```
  - **文件**: `FunnyPixelsApp/FunnyPixelsApp/Views/SettingsView.swift`
  - **位置**: 所有Toggle组件
  - **工时**: 10分钟（多处）

- [ ] **密码显示/隐藏** - `AuthView.swift:426-432`
  ```swift
  // 在点击眼睛图标时
  HapticManager.shared.selection()
  ```
  - **文件**: `FunnyPixelsApp/FunnyPixelsApp/Views/AuthView.swift`
  - **位置**: 第426-432行
  - **工时**: 3分钟

- [ ] **Google/Apple登录按钮** - `AuthView.swift:83-110`
  ```swift
  // 在FluidButtonStyle的基础上添加
  .simultaneousGesture(TapGesture().onEnded {
      SoundManager.shared.play(.buttonClick)
  })
  ```
  - **文件**: `FunnyPixelsApp/FunnyPixelsApp/Views/AuthView.swift`
  - **位置**: 第83-110行
  - **工时**: 7分钟

**验收标准**:
- ✅ 所有Toggle有selection反馈
- ✅ 表单保存成功有确认
- ✅ 第三方登录有点击反馈

---

### 2.2 社交互动反馈 👥

**优先级**: ⭐⭐⭐
**预计工时**: 15分钟
**性能影响**: 低 (<1ms)

#### 待实施场景：

- [ ] **关注/取关音效** - `FollowListView.swift`（已有触觉）
  ```swift
  // 在关注操作中（已有触觉，只需添加音效）
  SoundManager.shared.play(.buttonClick)  // 关注
  HapticManager.shared.impact(style: .light)  // 已有

  SoundManager.shared.play(.buttonClick)  // 取关
  HapticManager.shared.impact(style: .light)  // 已有
  ```
  - **文件**: `FunnyPixelsApp/FunnyPixelsApp/Views/FollowListView.swift`
  - **位置**: 关注/取关按钮处
  - **工时**: 5分钟

- [ ] **评论发送反馈** - `FeedCommentSheet.swift`
  ```swift
  // 在发送评论成功后
  SoundManager.shared.playSuccess()
  HapticManager.shared.notification(type: .success)
  ```
  - **文件**: `FunnyPixelsApp/FunnyPixelsApp/Views/Feed/FeedCommentSheet.swift`
  - **位置**: 发送成功回调
  - **工时**: 10分钟
  - **注意**: 中频操作，需监控性能

**验收标准**:
- ✅ 关注操作有音效反馈
- ✅ 评论发送有成功提示
- ✅ 频繁使用无卡顿

---

### 2.3 模态窗口反馈 📱

**优先级**: ⭐⭐⭐
**预计工时**: 20分钟
**性能影响**: 低 (<1ms)

#### 待实施场景：

- [ ] **Sheet弹出音效** - 统一处理
  ```swift
  // 创建SheetModifier统一处理
  struct SheetWithSound<Content: View>: ViewModifier {
      @Binding var isPresented: Bool
      let content: () -> Content

      func body(content: Content) -> some View {
          content.sheet(isPresented: $isPresented) {
              SoundManager.shared.play(.sheetPresent)  // 需新增
          } content: {
              self.content()
          }
      }
  }
  ```
  - **文件**: 创建新文件 `ViewModifiers/SheetModifier.swift`
  - **工时**: 15分钟

- [ ] **FullScreenCover音效** - `ProfileEditView.swift:102-112`
  ```swift
  // 在.fullScreenCover的onAppear中
  .onAppear {
      SoundManager.shared.play(.sheetPresent)
  }
  ```
  - **文件**: `FunnyPixelsApp/FunnyPixelsApp/Views/ProfileEditView.swift`
  - **工时**: 5分钟

**所需新增音效**:
- `sheetPresent.m4a` - 轻柔弹出音 (0.15秒)
- `sheetDismiss.m4a` - 柔和关闭音 (0.15秒) [可选]

**验收标准**:
- ✅ Sheet弹出有音效提示
- ✅ 音效轻柔不刺耳
- ✅ 延迟<1ms

---

### 2.4 特殊场景反馈 🌟

**优先级**: ⭐⭐⭐
**预计工时**: 30分钟
**性能影响**: 低 (<1ms)

#### 待实施场景：

- [ ] **漂流瓶遭遇** - `DriftBottleManager.swift`
  ```swift
  // 在检测到漂流瓶时
  SoundManager.shared.play(.bottleEncounter)  // 需新增
  HapticManager.shared.notification(type: .success)
  ```
  - **文件**: `FunnyPixelsApp/FunnyPixelsApp/Services/DriftBottleManager.swift`
  - **位置**: 遭遇检测成功处
  - **工时**: 10分钟

- [ ] **联盟加入成功** - AllianceService相关
  ```swift
  // 在加入联盟成功后
  SoundManager.shared.play(.allianceJoin)  // 需新增
  HapticManager.shared.notification(type: .success)
  ```
  - **文件**: 需定位AllianceService或AllianceTabView
  - **工时**: 10分钟

- [ ] **赛事倒计时/开始** - EventManager相关
  ```swift
  // 在赛事即将开始时（倒计时）
  SoundManager.shared.play(.eventCountdown)  // 需新增

  // 在赛事开始时
  SoundManager.shared.play(.eventStart)  // 需新增
  HapticManager.shared.notification(type: .warning)
  ```
  - **文件**: `FunnyPixelsApp/FunnyPixelsApp/Services/EventManager.swift`
  - **工时**: 10分钟

**所需新增音效**:
- `bottleEncounter.m4a` - 神秘遭遇音 (0.5秒)
- `allianceJoin.m4a` - 加入联盟欢迎音 (0.5秒)
- `eventCountdown.m4a` - 倒计时滴答音 (0.2秒)
- `eventStart.m4a` - 赛事开始号角 (0.5秒)

**验收标准**:
- ✅ 特殊事件有独特音效
- ✅ 音效与场景氛围匹配
- ✅ 延迟<1ms

---

## 🎯 Phase 3 - 低优先级（按需实施）

### 3.1 细节打磨 ✨

**优先级**: ⭐⭐
**预计工时**: 20分钟
**性能影响**: 低 (<1ms)

#### 待实施场景：

- [ ] **排名变化音效** - `LeaderboardTabView.swift:354-367`
  ```swift
  // 在排名上升时
  if change > 0 {
      SoundManager.shared.play(.rankUp)  // 需新增
  }
  ```
  - **工时**: 10分钟

- [ ] **NavigationLink触觉** - Profile菜单项等
  ```swift
  // 统一添加触觉反馈
  .simultaneousGesture(TapGesture().onEnded {
      HapticManager.shared.selection()
  })
  ```
  - **工时**: 10分钟

**所需新增音效**:
- `rankUp.m4a` - 排名上升音 (0.3秒)

**验收标准**:
- ✅ 排名上升有激励反馈
- ✅ 导航跳转有触觉提示

---

### 3.2 动画增强 🎬

**优先级**: ⭐
**预计工时**: 30分钟
**性能影响**: 中等 (需测试)

#### 可选实施：

- [ ] **购买成功金币动画** - `ShopTabView.swift`
  ```swift
  // 购买成功后显示金币飘落动画
  withAnimation(.spring(response: 0.5, dampingFraction: 0.6)) {
      showCoinsAnimation = true
  }
  ```
  - **工时**: 15分钟
  - **性能**: 需验证60fps

- [ ] **任务完成勾选动画** - `DailyTasksView.swift`
  ```swift
  // 完成任务时的勾选动画
  withAnimation(.spring(response: 0.3)) {
      task.isCompleted = true
  }
  ```
  - **工时**: 15分钟
  - **性能**: 需验证60fps

**验收标准**:
- ✅ 动画流畅60fps
- ✅ CPU增加<2%
- ✅ 不影响响应速度

---

## ❌ 不推荐实施（性能风险或价值低）

### 已评估并拒绝的场景：

- ❌ **下拉刷新完成反馈** - 高频操作，视觉反馈已足够
- ❌ **加载更多音效** - 干扰用户，无必要
- ❌ **Alert音效** - 系统默认已足够
- ❌ **所有列表滚动反馈** - 性能风险高
- ❌ **Slider滑动反馈** - 极高频，性能风险
- ❌ **设置页面切换音效** - 价值极低
- ❌ **背包按钮音效** - 低频低价值

---

## 📊 工时和进度预估

### Phase 1 - 高优先级（必须完成）
| 任务 | 工时 | 优先级 | 状态 |
|-----|------|--------|------|
| 购买/支付反馈 | 30分钟 | ⭐⭐⭐⭐⭐ | ⬜ 待开始 |
| GPS绘制控制 | 15分钟 | ⭐⭐⭐⭐⭐ | ⬜ 待开始 |
| 任务奖励领取 | 20分钟 | ⭐⭐⭐⭐ | ⬜ 待开始 |
| **小计** | **65分钟** | | |

### Phase 2 - 中优先级（本周完成）
| 任务 | 工时 | 优先级 | 状态 |
|-----|------|--------|------|
| 表单和设置 | 25分钟 | ⭐⭐⭐ | ⬜ 待开始 |
| 社交互动 | 15分钟 | ⭐⭐⭐ | ⬜ 待开始 |
| 模态窗口 | 20分钟 | ⭐⭐⭐ | ⬜ 待开始 |
| 特殊场景 | 30分钟 | ⭐⭐⭐ | ⬜ 待开始 |
| **小计** | **90分钟** | | |

### Phase 3 - 低优先级（按需）
| 任务 | 工时 | 优先级 | 状态 |
|-----|------|--------|------|
| 细节打磨 | 20分钟 | ⭐⭐ | ⬜ 待开始 |
| 动画增强 | 30分钟 | ⭐ | ⬜ 待开始 |
| **小计** | **50分钟** | | |

**总工时预估**: **205分钟 (3.4小时)**

---

## 🎵 所需新增音效清单

### 必需音效（Phase 1-2）

| 音效文件 | 用途 | 时长 | 优先级 |
|---------|------|------|--------|
| `drawingStart.m4a` | GPS绘制开始 | 0.2秒 | 高 |
| `drawingStop.m4a` | GPS绘制停止 | 0.2秒 | 高 |
| `levelUp.m4a` | 特殊奖励/升级 | 0.5秒 | 高 |
| `buttonClick.m4a` | 通用按钮点击 | 0.1秒 | 中 |
| `sheetPresent.m4a` | Sheet弹出 | 0.15秒 | 中 |
| `bottleEncounter.m4a` | 漂流瓶遭遇 | 0.5秒 | 中 |
| `allianceJoin.m4a` | 加入联盟 | 0.5秒 | 中 |
| `eventStart.m4a` | 赛事开始 | 0.5秒 | 中 |

### 可选音效（Phase 3）

| 音效文件 | 用途 | 时长 | 优先级 |
|---------|------|------|--------|
| `rankUp.m4a` | 排名上升 | 0.3秒 | 低 |
| `sheetDismiss.m4a` | Sheet关闭 | 0.15秒 | 低 |
| `eventCountdown.m4a` | 赛事倒计时 | 0.2秒 | 低 |

**音效设计要求**:
- ✅ 格式: M4A (AAC编码)
- ✅ 采样率: 44.1kHz
- ✅ 比特率: 128kbps
- ✅ 音量: -6dB ~ -3dB (避免过响)
- ✅ 风格: 轻快、现代、不刺耳

---

## 🔍 性能验证计划

### 每个Phase完成后必须验证

#### 1. Instruments性能测试
```bash
# 使用Xcode Instruments
1. Time Profiler - CPU占用分析
2. Allocations - 内存分配检查
3. Energy Log - 电池消耗测试
4. System Trace - 主线程阻塞检查
```

#### 2. 验收标准
```
✅ CPU增加 < 1% (平均)
✅ 内存增加 < 200KB
✅ 主线程阻塞 0ms
✅ 音效延迟 < 1ms
✅ 触觉延迟 < 0.5ms
✅ 60fps动画无掉帧
```

#### 3. 真机测试场景
```
测试1: 快速连续操作（10次/秒）
测试2: 长时间使用（30分钟）
测试3: 低电量测试（<20%电池）
测试4: 后台返回测试
测试5: 弱网环境测试
```

---

## 📋 实施检查清单

### 开始实施前
- [ ] 确认SoundManager.swift支持所有新音效
- [ ] 准备好所有音效文件（m4a格式）
- [ ] 配置Instruments性能监控
- [ ] 创建测试分支（feature/audio-animation-optimization）

### 实施Phase 1时
- [ ] 逐个场景添加，立即测试
- [ ] 每个场景验证延迟<1ms
- [ ] 检查是否有主线程阻塞
- [ ] 记录性能数据

### 实施Phase 2时
- [ ] 累计性能影响评估
- [ ] 用户体验主观测试
- [ ] 调整音效音量平衡
- [ ] 确认无过度反馈

### 完成后
- [ ] 运行完整性能测试套件
- [ ] 真机测试所有场景
- [ ] 记录性能基准数据
- [ ] 更新文档和注释

---

## 🎯 成功指标

### 覆盖率目标
- ✅ 核心交互: 100% (购买、绘制、社交)
- ✅ 重要交互: 80% (表单、设置、特殊场景)
- ✅ 辅助交互: 40% (导航、模态窗口)
- ✅ **总体覆盖率: 45%** (从11%提升)

### 性能保证
- ✅ 零性能劣化（相比优化前）
- ✅ 所有反馈延迟<1ms
- ✅ CPU增加<0.5%（平均）
- ✅ 无主线程阻塞

### 用户体验
- ✅ 核心操作有明确反馈
- ✅ 音效协调不刺耳
- ✅ 无过度反馈干扰
- ✅ 整体体验流畅愉悦

---

## 📅 实施时间表

### Week 1（本周）
- **Day 1-2**: Phase 1（高优先级） - 65分钟
- **Day 3-4**: Phase 2（中优先级） - 90分钟
- **Day 5**: 性能测试和调优 - 60分钟

### Week 2（下周）
- **Day 1-2**: Phase 3（低优先级，可选） - 50分钟
- **Day 3**: 综合测试和文档 - 30分钟
- **Day 4-5**: 监控和微调

**总耗时**: 约4-5小时（分散在2周）

---

## 🚀 开始实施

### 立即行动：Phase 1 - 购买/支付反馈

```bash
# 1. 切换到功能分支
git checkout -b feature/audio-feedback-phase1

# 2. 开始编辑文件
code FunnyPixelsApp/FunnyPixelsApp/Views/ShopTabView.swift

# 3. 添加购买成功反馈（第111行）
# 4. 添加充值成功反馈（第579行）
# 5. 运行真机测试
# 6. 性能验证

# 7. 提交
git add .
git commit -m "feat: Add purchase/recharge success audio feedback

- Add success sound and haptic for purchase completion
- Add success sound and haptic for recharge completion
- Add failure sound and haptic for error handling
- Performance: <1ms latency, <0.5% CPU
"
```

---

**准备好了吗？让我们开始优化！** 🎉
