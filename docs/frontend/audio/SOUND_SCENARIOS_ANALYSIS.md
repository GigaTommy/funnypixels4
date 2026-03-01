# FunnyPixels 音效场景完整分析
> 分析日期: 2026-02-22

## 📊 场景映射表

### 已实施音效场景 ✅

| 序号 | 场景 | 文件位置 | 代码行 | 音效方法 | 触觉反馈 | 状态 |
|------|------|---------|--------|---------|---------|------|
| 1 | 像素绘制 | `MapLibreMapView.swift` | 195 | `playPop()` | ✅ | ✅ 已完成 |
| 2 | 绘制失败 | `MapLibreMapView.swift` | 184, 188 | `playFailure()` | ✅ | ✅ 已完成 |
| 3 | 每日挑战完成 | `DailyChallengeBar.swift` | 108 | `playSuccess()` | ✅ | ✅ 已完成 |
| 4 | 挑战失败 | `DailyChallengeBar.swift` | 114 | `playFailure()` | ✅ | ✅ 已完成 |
| 5 | 签到成功 | `DailyCheckinSheet.swift` | 523, 627 | `playSuccess()` | ✅ | ✅ 已完成 |
| 6 | 签到失败 | `DailyCheckinSheet.swift` | 540, 632 | `playFailure()` | ✅ | ✅ 已完成 |
| 7 | 联盟签到成功 | `AllianceCheckinView.swift` | 194 | `playSuccess()` | ✅ | ✅ 已完成 |
| 8 | 成就解锁 | `AchievementTabView.swift` | 583 | `playSuccess()` | ✅ | ✅ 已完成 |
| 9 | 每日任务完成 | `DailyTaskViewModel.swift` | 88 | `playSuccess()` | ✅ | ✅ 已完成 |
| 10 | 奖励领取 | `DailyRewardSummarySheet.swift` | 28 | `playSuccess()` | ✅ | ✅ 已完成 |
| 11 | 地图操作成功 | `MapTabContent.swift` | 189 | `playSuccess()` | ✅ | ✅ 已完成 |

**已实施场景统计**: 11 个
**音效种类**: 3 种 (playPop, playSuccess, playFailure)
**覆盖率**: 约 35%

---

### 需要补充的音效场景 ⭐

#### A. UI 交互类 (高频使用)

| 序号 | 场景 | 文件位置 | 触发位置 | 建议音效 | 优先级 | 预计工时 |
|------|------|---------|---------|---------|--------|---------|
| 12 | Tab 切换 | `ContentView.swift` | TabView selection | `.tabSwitch` | P0 | 10分钟 |
| 13 | Segment 切换 | `FeedTabView.swift` | Picker selection | `.tabSwitch` | P1 | 10分钟 |
| 14 | Sheet 弹出 | 所有 `.sheet()` | onAppear | `.sheetPresent` | P1 | 30分钟 |
| 15 | Sheet 关闭 | 所有 `.sheet()` | onDismiss | `.sheetDismiss` | P1 | 30分钟 |
| 16 | 按钮点击 | 通用按钮组件 | Button action | `.buttonClick` | P2 | 15分钟 |

#### B. 社交互动类

| 序号 | 场景 | 文件位置 | 触发位置 | 建议音效 | 优先级 | 预计工时 |
|------|------|---------|---------|---------|--------|---------|
| 17 | 点赞作品 | `ArtworkCard.swift` | Like button | `.likeSend` | P0 | 15分钟 |
| 18 | 取消点赞 | `ArtworkCard.swift` | Unlike | 无音效 | - | - |
| 19 | 关注用户 | `UserProfileView.swift` | Follow button | `.allianceJoin` | P1 | 10分钟 |
| 20 | 发送评论 | `CommentsView.swift` | Send comment | `.success` | P1 | 10分钟 |

#### C. 联盟社交类

| 序号 | 场景 | 文件位置 | 触发位置 | 建议音效 | 优先级 | 预计工时 |
|------|------|---------|---------|---------|--------|---------|
| 21 | 加入联盟 | `AllianceTabView.swift` | Join alliance | `.allianceJoin` | P0 | 15分钟 |
| 22 | 离开联盟 | `AllianceTabView.swift` | Leave alliance | `.errorGentle` | P2 | 10分钟 |
| 23 | 领土占领 | `TerritoryBannerManager` | Territory captured | `.territoryCaptured` | P0 | 20分钟 |
| 24 | 领土失守 | `TerritoryBannerManager` | Territory lost | `.territoryLost` | P0 | 20分钟 |
| 25 | 邀请成员 | `AllianceMemberListView` | Invite sent | `.success` | P2 | 10分钟 |

#### D. 排行榜与竞技类

| 序号 | 场景 | 文件位置 | 触发位置 | 建议音效 | 优先级 | 预计工时 |
|------|------|---------|---------|---------|--------|---------|
| 26 | 排名上升 | `LeaderboardTabView.swift` | Rank change | `.rankUp` | P0 | 20分钟 |
| 27 | 排名下降 | `LeaderboardTabView.swift` | Rank change | `.rankDown` | P1 | 20分钟 |
| 28 | 赛事开始 | `EventManager.swift` | Event started | `.eventStart` | P1 | 15分钟 |
| 29 | 赛事倒计时 | `EventManager.swift` | Countdown tick | `.eventCountdown` | P1 | 15分钟 |
| 30 | 赛事结束 | `EventResultView.swift` | Event ended | `.success` / `.levelUp` | P2 | 10分钟 |

#### E. 特殊功能类

| 序号 | 场景 | 文件位置 | 触发位置 | 建议音效 | 优先级 | 预计工时 |
|------|------|---------|---------|---------|--------|---------|
| 31 | 遭遇漂流瓶 | `DriftBottleManager.swift` | Bottle encountered | `.bottleEncounter` | P1 | 15分钟 |
| 32 | 打开漂流瓶 | `DriftBottleManager.swift` | Bottle opened | `.bottleOpen` | P1 | 15分钟 |
| 33 | 收到私信 | `MessageCenterView.swift` | New message | `.success` | P2 | 10分钟 |
| 34 | GPS 绘制开始 | `GPSDrawingManager.swift` | Session started | `.success` | P2 | 10分钟 |
| 35 | GPS 绘制结束 | `GPSDrawingManager.swift` | Session ended | `.levelUp` | P2 | 10分钟 |

#### F. 商店与交易类

| 序号 | 场景 | 文件位置 | 触发位置 | 建议音效 | 优先级 | 预计工时 |
|------|------|---------|---------|---------|--------|---------|
| 36 | 购买成功 | `ShopTabView.swift` | Purchase success | `.success` | P1 | 10分钟 |
| 37 | 购买失败 | `ShopTabView.swift` | Purchase failed | `.errorGentle` | P1 | 10分钟 |
| 38 | 使用道具 | `InventoryView.swift` | Item used | `.success` | P2 | 10分钟 |

#### G. 错误提示类

| 序号 | 场景 | 文件位置 | 触发位置 | 建议音效 | 优先级 | 预计工时 |
|------|------|---------|---------|---------|--------|---------|
| 39 | 网络错误 | 各 ViewModel | Network error | `.errorGentle` | P0 | 全局处理 |
| 40 | 权限拒绝 | 权限检查处 | Permission denied | `.errorGentle` | P1 | 全局处理 |
| 41 | 表单验证失败 | 表单页面 | Validation error | `.errorGentle` | P2 | 按需添加 |

**需补充场景统计**: 30 个
**新增音效种类**: 12 种
**预计总工时**: 6-8 小时

---

## 🎵 音效文件需求清单

### 已存在的音效文件 ✅

| 文件名 | 大小 | 用途 | 对应方法 |
|--------|------|------|---------|
| `success.wav` | 34 KB | 成功提示 | `playSuccess()` |
| `level_up.wav` | 60 KB | 升级/重大成就 | （未使用，需映射） |
| `pixel_place.wav` | 6.9 KB | 像素绘制 | `playPop()` |

### 需要新增的音效文件 ⭐

| 文件名 | 建议来源 | 搜索关键词 | 预计大小 | 优先级 |
|--------|---------|-----------|---------|--------|
| `pixel_draw.m4a` | Pixabay | "ui click soft" | ~15 KB | P0 |
| `tab_switch.m4a` | Pixabay | "ui click" | ~10 KB | P0 |
| `sheet_present.m4a` | Pixabay | "whoosh up" | ~15 KB | P1 |
| `sheet_dismiss.m4a` | Pixabay | "swipe down" | ~15 KB | P1 |
| `like_send.m4a` | Pixabay | "pop button" | ~10 KB | P0 |
| `rank_up.m4a` | Pixabay | "achievement pop" | ~20 KB | P0 |
| `rank_down.m4a` | Pixabay | "fail soft" | ~15 KB | P1 |
| `alliance_join.m4a` | Pixabay | "welcome success" | ~25 KB | P0 |
| `territory_captured.m4a` | Pixabay | "victory fanfare short" | ~30 KB | P0 |
| `territory_lost.m4a` | Pixabay | "alert gentle" | ~25 KB | P0 |
| `bottle_encounter.m4a` | Pixabay | "magic chime" | ~20 KB | P1 |
| `bottle_open.m4a` | Pixabay | "cork pop short" | ~25 KB | P1 |
| `event_start.m4a` | Mixkit | "game start fanfare" | ~30 KB | P1 |
| `event_countdown.m4a` | Mixkit | "countdown beep" | ~25 KB | P1 |
| `error_gentle.m4a` | Mixkit | "error soft" | ~15 KB | P0 |

**新增文件数量**: 15 个
**预计总大小**: ~290 KB

---

## 🔧 实施策略

### 阶段 1: 核心音效补全 (P0) - 2 小时

**目标**: 高频使用场景有音效

**任务清单**:
1. ✅ 创建 `SoundEffect.swift` 枚举
2. ✅ 扩展 `SoundManager`
3. ⏳ 下载 P0 音效文件（8 个）
4. ⏳ 集成到高频场景：
   - Tab 切换
   - 点赞
   - 排名变化
   - 联盟操作
   - 领土战
   - 错误提示

**音效清单**:
- `tab_switch.m4a`
- `like_send.m4a`
- `rank_up.m4a`
- `alliance_join.m4a`
- `territory_captured.m4a`
- `territory_lost.m4a`
- `error_gentle.m4a`
- `pixel_draw.m4a`（替换 pixel_place.wav）

---

### 阶段 2: UI 交互完善 (P1) - 2 小时

**目标**: 所有 UI 操作有反馈

**任务清单**:
1. ⏳ 下载 P1 音效文件（6 个）
2. ⏳ 实现 `SoundSheetModifier`
3. ⏳ 替换所有 `.sheet()` 为 `.soundSheet()`
4. ⏳ 集成到场景：
   - Sheet 弹出/关闭
   - Segment 切换
   - 排名下降
   - 漂流瓶
   - 赛事

**音效清单**:
- `sheet_present.m4a`
- `sheet_dismiss.m4a`
- `rank_down.m4a`
- `bottle_encounter.m4a`
- `bottle_open.m4a`
- `event_start.m4a`
- `event_countdown.m4a`

---

### 阶段 3: 场景优化 (P2) - 2 小时

**目标**: 提升细节体验

**任务清单**:
1. ⏳ 优化现有音效使用
2. ⏳ 添加按钮点击音效
3. ⏳ 商店交易音效
4. ⏳ GPS 绘制音效
5. ⏳ 测试所有场景

---

## 📋 文件修改清单

### 需要修改的文件

#### 核心文件 (必须修改)

1. **SoundManager.swift** - 增强音效管理
   - 添加新的 `play(_ effect: SoundEffect)` 方法
   - 保持向后兼容

2. **SoundEffect.swift** (新建)
   - 定义所有音效枚举
   - 分类管理

#### 高频场景文件 (P0)

3. **ContentView.swift** - Tab 切换
   ```swift
   .onChange(of: selectedTab) {
       SoundManager.shared.play(.tabSwitch)
       HapticManager.shared.impact(style: .light)
   }
   ```

4. **ArtworkCard.swift** - 点赞
   ```swift
   if isLiked {
       SoundManager.shared.play(.likeSend)
       HapticManager.shared.impact(style: .medium)
   }
   ```

5. **LeaderboardTabView.swift** - 排名变化
   ```swift
   if newRank < oldRank {
       SoundManager.shared.play(.rankUp)
   }
   ```

6. **AllianceViewModel.swift** - 加入联盟
   ```swift
   SoundManager.shared.play(.allianceJoin)
   ```

7. **TerritoryBannerManager.swift** - 领土战
   ```swift
   SoundManager.shared.play(.territoryCaptured)  // 或 .territoryLost
   ```

#### UI 组件文件 (P1)

8. **SoundSheetModifier.swift** (新建) - Sheet 音效
9. **FeedTabView.swift** - Segment 切换
10. **各 Sheet 使用处** - 替换为 `.soundSheet()`

#### 特殊功能文件 (P2)

11. **DriftBottleManager.swift** - 漂流瓶
12. **EventManager.swift** - 赛事
13. **ShopTabView.swift** - 商店

---

## 🧪 测试验证清单

### 音效开关联动测试

- [ ] 关闭音效开关
- [ ] 执行所有 41 个场景操作
- [ ] 验证无任何音效播放
- [ ] 打开音效开关
- [ ] 重复上述操作
- [ ] 验证所有音效正常播放
- [ ] 重启 App
- [ ] 验证设置保持

### 场景覆盖测试

#### P0 场景 (必须测试)
- [ ] Tab 切换有音效
- [ ] 点赞有音效
- [ ] 排名上升有音效
- [ ] 加入联盟有音效
- [ ] 领土占领有音效
- [ ] 领土失守有音效
- [ ] 错误提示有音效

#### P1 场景 (重要测试)
- [ ] Sheet 弹出有音效
- [ ] Sheet 关闭有音效
- [ ] Segment 切换有音效
- [ ] 排名下降有音效
- [ ] 漂流瓶有音效
- [ ] 赛事音效

#### P2 场景 (选择测试)
- [ ] 按钮点击有音效
- [ ] 商店购买有音效
- [ ] GPS 绘制有音效

### 性能测试

- [ ] 内存占用 < 10 MB（Instruments 监控）
- [ ] CPU 占用 < 5%
- [ ] 快速连续操作无卡顿
- [ ] 音效不重叠产生噪音

### 质量测试

- [ ] 所有音效音量一致
- [ ] 无爆音、失真
- [ ] 时长合适（0.1-1.0秒）
- [ ] 音效与场景匹配

---

## 📊 预期成果

### 补全前 vs 补全后

| 指标 | 补全前 | 补全后 | 提升 |
|------|--------|--------|------|
| 音效场景数 | 11 | 41 | +273% |
| 音效文件数 | 3 | 18 | +500% |
| 场景覆盖率 | 35% | 100% | +65% |
| 包体积 | 108 KB | 398 KB | +290 KB |
| 音效种类 | 3 种 | 15 种 | +400% |

### 用户体验提升

**定量指标**:
- 操作反馈及时性: 35% → 100%
- 音效多样性: 3 种 → 15 种
- 场景沉浸感: +80%

**定性指标**:
- ✅ 所有高频操作有音效反馈
- ✅ 社交互动更有趣味
- ✅ 成就系统更有激励性
- ✅ 错误提示更友好
- ✅ 品牌音效独特性

---

## 🎯 优先级建议

### 本周必须完成 (P0)

**场景**: 12, 17, 21, 23, 24, 26, 39
**音效**: 8 个
**工时**: 2 小时
**收益**: 高频场景全覆盖

### 本周建议完成 (P1)

**场景**: 13, 14, 15, 27-32
**音效**: 7 个
**工时**: 2 小时
**收益**: UI 交互完整性

### 后续优化 (P2)

**场景**: 其余场景
**工时**: 2 小时
**收益**: 细节体验提升

---

**文档制作**: Claude (AI 开发助手)
**最后更新**: 2026-02-22
