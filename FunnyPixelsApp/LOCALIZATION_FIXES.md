# iOS App 多语言本地化修复清单

## 📋 问题概览

- **高优先级硬编码**：52 处（影响用户体验）
- **缺失翻译键**：78-312 个（各语言）
- **工作量估算**：7-12 工作日

---

## 🔥 阶段一：修复核心用户界面（优先级：最高）

### 1.1 InteractivePixelBottomSheet.swift（像素详情弹窗）

**需要添加的本地化键**（所有 6 种语言）：

```swift
/* Pixel Bottom Sheet - 像素详情弹窗 */
"pixel.share.message" = "快来看看这个有趣的像素！坐标：%@";
"pixel.report.success" = "举报成功";
"pixel.report.title" = "举报像素";
"pixel.report.inappropriate" = "不当内容";
"pixel.report.spam" = "垃圾广告";
"pixel.report.other" = "其他";
"pixel.info.coordinates" = "坐标";
"pixel.info.country" = "国家/地区";
"pixel.info.created_at" = "创建时间";
"common.anonymous_user" = "匿名用户";
"common.confirm" = "确定";
"common.report" = "举报";
"social.following" = "已关注";
"social.follow" = "关注";
"social.liked" = "已喜欢";
"social.like" = "喜欢";
```

**代码修改示例**：

```swift
// 修改前（第 61 行）
let text = "快来看看这个有趣的像素！坐标：\(pixel.latitude), \(pixel.longitude)"

// 修改后
let text = String(format: NSLocalizedString("pixel.share.message", comment: ""),
                 "\(pixel.latitude), \(pixel.longitude)")

// 修改前（第 64-79 行）
.alert("举报成功", isPresented: $showReportAlert) {
    Button("确定", role: .cancel) { }
}
.confirmationDialog("举报像素", isPresented: $showReportSheet, titleVisibility: .visible) {
    Button("不当内容") { reportPixel(reason: "inappropriate") }
    Button("垃圾广告") { reportPixel(reason: "spam") }
    Button("其他") { reportPixel(reason: "other") }
    Button("取消", role: .cancel) { }
}

// 修改后
.alert(NSLocalizedString("pixel.report.success", comment: ""), isPresented: $showReportAlert) {
    Button(NSLocalizedString("common.confirm", comment: ""), role: .cancel) { }
}
.confirmationDialog(NSLocalizedString("pixel.report.title", comment: ""),
                   isPresented: $showReportSheet, titleVisibility: .visible) {
    Button(NSLocalizedString("pixel.report.inappropriate", comment: "")) {
        reportPixel(reason: "inappropriate")
    }
    Button(NSLocalizedString("pixel.report.spam", comment: "")) {
        reportPixel(reason: "spam")
    }
    Button(NSLocalizedString("pixel.report.other", comment: "")) {
        reportPixel(reason: "other")
    }
    Button(NSLocalizedString("common.cancel", comment: ""), role: .cancel) { }
}
```

---

### 1.2 TaskPinAnnotation.swift（任务标记）

**需要添加的本地化键**：

```swift
/* Task System - 任务系统 */
"task.state.locked" = "锁定";
"task.state.available" = "可用";
"task.state.in_progress" = "进行中";
"task.state.completed" = "已完成";
"task.state.claimed" = "已领取";
"task.location.radius_meters" = "· 半径 %d米";
"task.progress.label" = "进度";
"task.reward.points" = "奖励: %d 积分";
"task.action.navigate" = "导航";
"task.action.claim_reward" = "领取奖励";
"task.difficulty.easy" = "简单";
"task.difficulty.normal" = "中等";
"task.difficulty.hard" = "困难";
```

**代码修改示例**：

```swift
// 修改前（第 119-125 行）
var displayName: String {
    switch self {
    case .locked: return "锁定"
    case .available: return "可用"
    case .inProgress: return "进行中"
    case .completed: return "已完成"
    case .claimed: return "已领取"
    }
}

// 修改后
var displayName: String {
    switch self {
    case .locked: return NSLocalizedString("task.state.locked", comment: "")
    case .available: return NSLocalizedString("task.state.available", comment: "")
    case .inProgress: return NSLocalizedString("task.state.in_progress", comment: "")
    case .completed: return NSLocalizedString("task.state.completed", comment: "")
    case .claimed: return NSLocalizedString("task.state.claimed", comment: "")
    }
}

// 修改前（第 302-308 行）
private func difficultyText(_ difficulty: String) -> String {
    switch difficulty {
    case "easy": return "简单"
    case "normal": return "中等"
    case "hard": return "困难"
    default: return difficulty
    }
}

// 修改后
private func difficultyText(_ difficulty: String) -> String {
    switch difficulty {
    case "easy": return NSLocalizedString("task.difficulty.easy", comment: "")
    case "normal": return NSLocalizedString("task.difficulty.normal", comment: "")
    case "hard": return NSLocalizedString("task.difficulty.hard", comment: "")
    default: return difficulty
    }
}
```

---

### 1.3 MapLayerControl.swift（地图图层控制）

**需要添加的本地化键**：

```swift
/* Map Layers - 地图图层 */
"map.layer.title" = "地图图层";
"map.layer.reset" = "重置";
"map.layer.pixels" = "像素层";
"map.layer.pixels_desc" = "显示所有绘制的像素";
"map.layer.territory" = "领地控制层";
"map.layer.territory_desc" = "显示联盟领地边界";
"map.layer.nearby_players" = "附近玩家";
"map.layer.nearby_players_desc" = "显示5km内活跃玩家";
"map.layer.tasks" = "任务标记";
"map.layer.tasks_desc" = "显示每日任务位置";
"map.layer.heatmap" = "区域热力图";
"map.layer.heatmap_desc" = "显示像素密度分布";
"map.layer.war_zones" = "战争区域";
"map.layer.war_zones_desc" = "显示领地争夺战区";
"map.layer.treasures" = "宝箱资源点";
"map.layer.treasures_desc" = "显示宝箱刷新位置";
"map.layer.friends" = "好友位置";
"map.layer.friends_desc" = "显示关注的好友";
```

**代码修改**：在第 41-122 行，将所有 `Text("地图图层")` 替换为 `Text(NSLocalizedString("map.layer.title", comment: ""))`，其他同理。

---

## 📝 阶段二：修复次要界面

### 2.1 EventLiveActivityBanner.swift
- 第 199 行：`"像素"` → `NSLocalizedString("event.unit.pixels", comment: "")`

### 2.2 DriftBottleBottomSheet.swift
- 添加漂流瓶相关的 10+ 个本地化键

### 2.3 MessageCenterView.swift
- 添加消息中心相关的 8 个本地化键

### 2.4 AllianceDrawingControlPanel.swift
- 添加联盟绘制相关的 5 个本地化键

---

## 🌐 阶段三：补全翻译文件

### 3.1 优先级排序

1. **简体中文（zh-Hans）** - 缺失 2 键 ✅ 最容易完成
2. **日语（ja）** - 缺失 78 键 ⚠️ 需要专业翻译
3. **葡萄牙语（pt-BR）** - 缺失 228 键 ⚠️
4. **西班牙语（es）** - 缺失 271 键 ⚠️
5. **韩语（ko）** - 缺失 312 键 ⚠️ 最多缺失

### 3.2 缺失键示例

中文文件缺失的 2 个键：
```
event.zone.ended.subtitle
event.zone.ending.subtitle
```

---

## 🔧 辅助工具

### 查找所有硬编码中文的脚本

```bash
# 在 FunnyPixelsApp 目录下运行
find . -name "*.swift" -type f -exec grep -Hn 'Text(".*[\u4e00-\u9fff]' {} \; | grep -v "NSLocalizedString\|comment:"
```

### 检查缺失翻译键的脚本

```bash
# 比较英文和中文文件的键差异
comm -23 \
  <(grep -o '"[^"]*"' Resources/en.lproj/Localizable.strings | sort -u) \
  <(grep -o '"[^"]*"' Resources/zh-Hans.lproj/Localizable.strings | sort -u)
```

---

## ✅ 验证清单

### 代码修改验证
- [ ] 所有 `Text("中文")` 替换为 `NSLocalizedString(...)`
- [ ] 所有 `Button("中文")` 替换为本地化字符串
- [ ] 所有 `alert("中文")` 替换为本地化字符串
- [ ] 格式化字符串使用正确占位符（%@, %d）

### 翻译文件验证
- [ ] 所有 6 种语言文件包含新添加的键
- [ ] 英文翻译准确且语法正确
- [ ] 其他语言翻译已由专业人员审核
- [ ] 无重复键名
- [ ] 文件格式正确（UTF-8 编码）

### UI 测试验证
- [ ] 在所有 6 种语言下测试关键流程
- [ ] 检查文本是否截断或溢出
- [ ] 验证 RTL 语言布局（如未来支持）
- [ ] 确认复数形式正确（如 "1 pixel" vs "2 pixels"）

---

## 📅 时间估算

| 阶段 | 任务 | 预计时间 |
|------|------|----------|
| 1 | 修复 TOP 3 高频界面 | 1-2 天 |
| 2 | 修复次要界面（5 个文件） | 2-3 天 |
| 3 | 补全中文+日语翻译 | 1-2 天 |
| 4 | 补全西/韩/葡语翻译 | 2-3 天 |
| 5 | UI 测试和验证 | 1-2 天 |
| **总计** | | **7-12 天** |

---

## 🚀 快速开始

### 第一步：修复 InteractivePixelBottomSheet.swift

1. 在 `zh-Hans.lproj/Localizable.strings` 添加上述 15 个键
2. 在 `en.lproj/Localizable.strings` 添加英文翻译
3. 修改 Swift 代码，替换硬编码字符串
4. 编译运行，验证显示正确

### 第二步：逐个修复其他文件

重复上述步骤，按优先级处理：
1. TaskPinAnnotation.swift
2. MapLayerControl.swift
3. EventLiveActivityBanner.swift
4. 其他文件...

### 第三步：补全翻译

使用翻译工具（GPT-4 / DeepL）或专业翻译人员补全非英语语言文件。

---

## 📞 需要帮助？

如果需要具体文件的修复示例或自动化脚本，请告知！
