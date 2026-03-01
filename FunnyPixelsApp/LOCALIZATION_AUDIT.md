# FunnyPixels iOS App - 多语言支持审查报告

**审查日期**: 2026-02-24
**审查范围**: 所有用户界面显示文字和提示信息
**支持语言**: 中文、英文、日文

---

## 📊 审查统计

| 语言 | 字符串数量 | 状态 |
|------|-----------|------|
| 英文 (en) | 1,356 | ✅ 基准 |
| 中文 (zh-Hans) | 1,354 | ⚠️ 需补充 |
| 日文 (ja) | 1,351 | ⚠️ 需补充 |
| 西班牙语 (es) | 1,158 | ⚠️ 不完整 |
| 韩语 (ko) | 1,117 | ⚠️ 不完整 |
| 葡萄牙语 (pt-BR) | 1,201 | ⚠️ 不完整 |

---

## ❌ 发现的硬编码字符串

### 1. 地图相关界面

#### MapTabContent.swift:335
```swift
Text("正在漫游至：\(destination)")
```
**建议修复**:
```swift
Text(String(format: NSLocalizedString("map.roaming_to", comment: ""), destination))
```

#### MapLibreMapView.swift:65
```swift
Text("地图视图在此平台不可用")
```
**建议修复**:
```swift
Text(NSLocalizedString("map.unavailable_platform", comment: ""))
```

---

### 2. 绘制功能界面

#### AllianceDrawingControlPanel.swift:146
```swift
Text("复杂图案")
```
**建议修复**:
```swift
Text(NSLocalizedString("drawing.complex_pattern", comment: ""))
```

#### AllianceDrawingControlPanel.swift:227
```swift
Text("加载联盟旗帜...")
```
**建议修复**:
```swift
Text(NSLocalizedString("drawing.loading_alliance_flag", comment: ""))
```

#### LowPowerGPSDrawingOverlay.swift:69
```swift
Text("轻触屏幕退出省电模式")
```
**建议修复**:
```swift
Text(NSLocalizedString("drawing.tap_to_exit_power_saving", comment: ""))
```

#### LowPowerGPSDrawingOverlay.swift:146
```swift
Text("已进入专注绘制模式")
```
**建议修复**:
```swift
Text(NSLocalizedString("drawing.focus_mode_enabled", comment: ""))
```

#### LowPowerGPSDrawingOverlay.swift:150
```swift
Text("保持GPS精度，降低屏幕功耗\n轻触屏幕随时退出")
```
**建议修复**:
```swift
Text(NSLocalizedString("drawing.focus_mode_description", comment: ""))
```

#### SessionReplayView.swift:67
```swift
Text("进度: \(Int(Double(currentIndex)/Double(max(1, pixels.count))*100))%")
```
**建议修复**:
```swift
Text(String(format: NSLocalizedString("session.replay_progress", comment: ""), progress))
```

---

### 3. 事件/活动界面

#### EventLiveActivityBanner.swift:130
```swift
Text("已结束")
```
**建议修复**:
```swift
Text(NSLocalizedString("event.ended", comment: ""))
```

#### EventLiveActivityBanner.swift:159
```swift
Text("我的排名")
```
**建议修复**:
```swift
Text(NSLocalizedString("event.my_rank", comment: ""))
```

#### EventLiveActivityBanner.swift:204
```swift
Text("向上滑动关闭")
```
**建议修复**:
```swift
Text(NSLocalizedString("event.swipe_up_to_close", comment: ""))
```

---

### 4. 个人资料/消息中心

#### MessageCenterView.swift:24
```swift
Text("暂无消息")
```
**建议修复**:
```swift
Text(NSLocalizedString("message.no_messages", comment: ""))
```

#### MessageCenterView.swift:172
```swift
Text("前往查看")
```
**建议修复**:
```swift
Text(NSLocalizedString("message.go_to_view", comment: ""))
```

#### MessageCenterView.swift:185
```swift
Text("附件奖励")
```
**建议修复**:
```swift
Text(NSLocalizedString("message.attachment_reward", comment: ""))
```

#### MessageCenterView.swift:196
```swift
Text("领取奖励")
```
**建议修复**:
```swift
Text(NSLocalizedString("message.claim_reward", comment: ""))
```

---

### 5. 领地战斗相关

#### TerritoryBattleBanner.swift:54
```swift
Text("有人踩了你的地盘！")
```
**建议修复**:
```swift
Text(NSLocalizedString("territory.someone_invaded", comment: ""))
```

#### BattleFeedView.swift:24
```swift
Text("还没人动你的地盘")
```
**建议修复**:
```swift
Text(NSLocalizedString("battle.no_attacks_yet", comment: ""))
```

#### BattleFeedView.swift:138
```swift
Text("夺回")
```
**建议修复**:
```swift
Text(NSLocalizedString("battle.reclaim", comment: ""))
```

---

### 6. 像素交互界面

#### InteractivePixelBottomSheet.swift:67
```swift
Text("感谢您的反馈，我们会尽快处理。")
```
**建议修复**:
```swift
Text(NSLocalizedString("pixel.feedback_thanks", comment: ""))
```

#### InteractivePixelBottomSheet.swift:210
```swift
Text("历史记录")
```
**建议修复**:
```swift
Text(NSLocalizedString("pixel.history", comment: ""))
```

#### InteractivePixelBottomSheet.swift:214
```swift
Text("暂无更多历史记录...")
```
**建议修复**:
```swift
Text(NSLocalizedString("pixel.no_more_history", comment: ""))
```

---

### 7. 等级/段位系统

#### RankTierProgressBar.swift:51
```swift
Text("已达最高段位")
```
**建议修复**:
```swift
Text(NSLocalizedString("rank.max_tier_reached", comment: ""))
```

#### RankTierProgressBar.swift:55
```swift
Text("还差 \(tier.gapToNext) 像素升级")
```
**建议修复**:
```swift
Text(String(format: NSLocalizedString("rank.pixels_to_upgrade", comment: ""), tier.gapToNext))
```

---

### 8. 支付相关

#### PaymentIcons.swift:11
```swift
Text("支")
```
**说明**: 这是支付宝图标的简写，可以保持，但建议添加无障碍标签
**建议修复**:
```swift
Text("支")
    .accessibilityLabel(NSLocalizedString("payment.alipay", comment: ""))
```

---

## ✅ 需要添加的本地化字符串

### 中文 (zh-Hans.lproj/Localizable.strings)

```strings
/* 地图相关 */
"map.roaming_to" = "正在漫游至：%@";
"map.unavailable_platform" = "地图视图在此平台不可用";

/* 绘制功能 */
"drawing.complex_pattern" = "复杂图案";
"drawing.loading_alliance_flag" = "加载联盟旗帜...";
"drawing.tap_to_exit_power_saving" = "轻触屏幕退出省电模式";
"drawing.focus_mode_enabled" = "已进入专注绘制模式";
"drawing.focus_mode_description" = "保持GPS精度，降低屏幕功耗\n轻触屏幕随时退出";

/* 会话回放 */
"session.replay_progress" = "进度: %d%%";

/* 事件/活动 */
"event.ended" = "已结束";
"event.my_rank" = "我的排名";
"event.swipe_up_to_close" = "向上滑动关闭";

/* 消息中心 */
"message.no_messages" = "暂无消息";
"message.go_to_view" = "前往查看";
"message.attachment_reward" = "附件奖励";
"message.claim_reward" = "领取奖励";

/* 领地战斗 */
"territory.someone_invaded" = "有人踩了你的地盘！";
"battle.no_attacks_yet" = "还没人动你的地盘";
"battle.reclaim" = "夺回";

/* 像素交互 */
"pixel.feedback_thanks" = "感谢您的反馈，我们会尽快处理。";
"pixel.history" = "历史记录";
"pixel.no_more_history" = "暂无更多历史记录...";

/* 等级段位 */
"rank.max_tier_reached" = "已达最高段位";
"rank.pixels_to_upgrade" = "还差 %d 像素升级";

/* 支付 */
"payment.alipay" = "支付宝";
```

---

### 英文 (en.lproj/Localizable.strings)

```strings
/* Map */
"map.roaming_to" = "Roaming to: %@";
"map.unavailable_platform" = "Map view unavailable on this platform";

/* Drawing */
"drawing.complex_pattern" = "Complex Pattern";
"drawing.loading_alliance_flag" = "Loading alliance flag...";
"drawing.tap_to_exit_power_saving" = "Tap screen to exit power saving mode";
"drawing.focus_mode_enabled" = "Focus drawing mode enabled";
"drawing.focus_mode_description" = "Maintains GPS accuracy, reduces screen power\nTap screen to exit anytime";

/* Session replay */
"session.replay_progress" = "Progress: %d%%";

/* Events */
"event.ended" = "Ended";
"event.my_rank" = "My Rank";
"event.swipe_up_to_close" = "Swipe up to close";

/* Messages */
"message.no_messages" = "No messages";
"message.go_to_view" = "Go to view";
"message.attachment_reward" = "Attachment Reward";
"message.claim_reward" = "Claim Reward";

/* Territory battle */
"territory.someone_invaded" = "Someone invaded your territory!";
"battle.no_attacks_yet" = "No one has attacked your territory yet";
"battle.reclaim" = "Reclaim";

/* Pixel interaction */
"pixel.feedback_thanks" = "Thank you for your feedback, we will process it soon.";
"pixel.history" = "History";
"pixel.no_more_history" = "No more history...";

/* Rank tier */
"rank.max_tier_reached" = "Max tier reached";
"rank.pixels_to_upgrade" = "%d pixels to upgrade";

/* Payment */
"payment.alipay" = "Alipay";
```

---

### 日文 (ja.lproj/Localizable.strings)

```strings
/* マップ */
"map.roaming_to" = "%@にローミング中";
"map.unavailable_platform" = "このプラットフォームではマップビューを利用できません";

/* 描画 */
"drawing.complex_pattern" = "複雑なパターン";
"drawing.loading_alliance_flag" = "アライアンスフラグを読み込み中...";
"drawing.tap_to_exit_power_saving" = "画面をタップして省電力モードを終了";
"drawing.focus_mode_enabled" = "集中描画モードが有効になりました";
"drawing.focus_mode_description" = "GPS精度を維持し、画面電力を削減\nいつでも画面をタップして終了";

/* セッション再生 */
"session.replay_progress" = "進行状況: %d%%";

/* イベント */
"event.ended" = "終了";
"event.my_rank" = "マイランク";
"event.swipe_up_to_close" = "上にスワイプして閉じる";

/* メッセージ */
"message.no_messages" = "メッセージなし";
"message.go_to_view" = "表示に移動";
"message.attachment_reward" = "添付報酬";
"message.claim_reward" = "報酬を受け取る";

/* テリトリーバトル */
"territory.someone_invaded" = "誰かがあなたの領土に侵入しました！";
"battle.no_attacks_yet" = "まだ誰もあなたの領土を攻撃していません";
"battle.reclaim" = "奪回";

/* ピクセル操作 */
"pixel.feedback_thanks" = "フィードバックありがとうございます。すぐに処理いたします。";
"pixel.history" = "履歴";
"pixel.no_more_history" = "これ以上の履歴はありません...";

/* ランクティア */
"rank.max_tier_reached" = "最高ティアに到達";
"rank.pixels_to_upgrade" = "アップグレードまであと%dピクセル";

/* 支払い */
"payment.alipay" = "Alipay";
```

---

## 🔍 可选但不需强制本地化的内容

以下内容是数字、符号或通用格式，**不需要本地化**：

1. **数字显示**: `Text("\(count)")`、`Text("\(percentage)%")`
2. **排名编号**: `Text("#\(index + 1)")`
3. **价格显示**: `Text("¥\(price)")` (货币符号)
4. **emoji 表情**: `Text("🚩")`、`Text("❓")`
5. **倒计时**: `Text("\(hours):\(minutes):\(seconds)")`
6. **坐标格式**: `Text("Heading: 225° (Southwest)")` - 这是调试信息
7. **版本号**: `Text("1.0.0 (Build 1)")`

---

## 📋 修复优先级

### P0 - 高优先级（用户可见核心界面）

- ✅ 地图漫游提示
- ✅ 事件状态显示
- ✅ 消息中心
- ✅ 领地战斗提示
- ✅ 等级段位系统

### P1 - 中优先级（次要功能界面）

- ✅ 绘制模式提示
- ✅ 会话回放
- ✅ 像素历史记录

### P2 - 低优先级（调试/内部信息）

- 🔵 Compass 调试信息（可保持英文）
- 🔵 平台不可用提示

---

## 🛠️ 修复步骤

### 1. 添加本地化字符串
将上述字符串添加到所有语言的 `Localizable.strings` 文件中。

### 2. 更新代码使用 NSLocalizedString
替换所有硬编码字符串为 `NSLocalizedString()` 调用。

### 3. 验证测试
- 切换系统语言测试每个界面
- 确保所有文本正确显示
- 检查格式化字符串（含 %@ 或 %d）是否正确

---

## 📊 总结

**发现的问题**:
- 硬编码字符串: ~25 处
- 需要添加本地化键: 25 个
- 影响的文件: 11 个

**需要更新的文件**:
1. `FunnyPixelsApp/Resources/en.lproj/Localizable.strings`
2. `FunnyPixelsApp/Resources/zh-Hans.lproj/Localizable.strings`
3. `FunnyPixelsApp/Resources/ja.lproj/Localizable.strings`

**需要修改的代码文件**:
1. MapTabContent.swift
2. MapLibreMapView.swift
3. AllianceDrawingControlPanel.swift
4. LowPowerGPSDrawingOverlay.swift
5. SessionReplayView.swift
6. EventLiveActivityBanner.swift
7. MessageCenterView.swift
8. TerritoryBattleBanner.swift
9. BattleFeedView.swift
10. InteractivePixelBottomSheet.swift
11. RankTierProgressBar.swift

---

**审查完成日期**: 2026-02-24
**状态**: ⚠️ 需要修复
**预计修复时间**: 2-3 小时
