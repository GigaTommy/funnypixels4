# FunnyPixels 活动模块优化 - 完整TODO清单

**开始日期**: 2026-02-23
**预计完成**: 2026-04-05 (6周)
**总任务数**: 21个
**当前进度**: 0/21 (0%)

---

## 快速导航

- [第1-2周: P0核心功能](#第1-2周-p0核心功能) - 必须完成
- [第3-4周: P1重要改进](#第3-4周-p1重要改进) - 显著提升体验
- [第5周: P2优化功能](#第5周-p2优化功能) - 锦上添花
- [第6周: 测试和发布](#第6周-测试和发布) - 质量保证

---

## 第1-2周: P0核心功能

### Task #1: P0-1 报名数据透明化 - 后端实现 ⭐⭐⭐⭐⭐
**状态**: ⬜ Pending
**工作量**: 1.5天
**负责人**: [后端开发]
**依赖**: 无

<details>
<summary>查看详细任务清单</summary>

#### 后端任务
- [ ] 创建 `getEventSignupStats` API端点
  - [ ] 统计报名联盟数和用户数
  - [ ] 查询Top 10联盟详情(包含成员数、总战力)
  - [ ] 计算估算参与人数(联盟数 × 平均成员数 + 个人用户数)
  - [ ] 计算平均联盟战力
  - [ ] 检查是否满足最小人数要求
- [ ] 添加路由: `GET /api/events/:id/signup-stats`
- [ ] 优化查询性能(使用JOIN和聚合)
- [ ] 编写单元测试
- [ ] 更新API文档

#### 验收标准
- [ ] API响应时间 < 200ms
- [ ] 返回正确的统计数据
- [ ] 单元测试覆盖率 > 80%

#### 文件位置
- `backend/src/controllers/eventController.js`
- `backend/src/routes/eventRoutes.js`

</details>

---

### Task #2: P0-1 报名数据透明化 - iOS实现 ⭐⭐⭐⭐⭐
**状态**: ⬜ Pending (依赖: Task #1)
**工作量**: 1.5天
**负责人**: [iOS开发]

<details>
<summary>查看详细任务清单</summary>

#### iOS任务
- [ ] 创建 `EventSignupStats.swift` 数据模型
- [ ] 在 `EventService` 中添加 `getSignupStats()` 方法
- [ ] 创建 `EventSignupStatsView.swift` UI组件
  - [ ] StatCard组件(显示联盟数/参与人数/平均战力)
  - [ ] AllianceSignupRow组件(显示已报名联盟)
  - [ ] PowerLevelBadge组件(S/A/B/C/D等级徽章)
- [ ] 集成到 `EventDetailView`
- [ ] 添加本地化字符串(en, zh-Hans, ja)
  - [ ] activity_heat
  - [ ] event.stats.alliances
  - [ ] event.stats.participants
  - [ ] event.warning.min_participants
  - [ ] 等10+字符串
- [ ] UI测试

#### 验收标准
- [ ] UI展示正确且美观
- [ ] 实时加载数据无卡顿
- [ ] 支持3种语言
- [ ] 通过UI测试

#### 文件位置
- `FunnyPixelsApp/Models/EventSignupStats.swift`
- `FunnyPixelsApp/Services/API/EventService.swift`
- `FunnyPixelsApp/Views/Events/Components/EventSignupStatsView.swift`
- `FunnyPixelsApp/Resources/*/Localizable.strings`

</details>

---

### Task #3: P0-2 活动玩法说明 - 后端实现 ⭐⭐⭐⭐⭐
**状态**: ⬜ Pending
**工作量**: 1天
**负责人**: [后端开发]

<details>
<summary>查看详细任务清单</summary>

#### 后端任务
- [ ] 数据库迁移: 添加 `gameplay` JSONB字段到 `events` 表
  ```sql
  ALTER TABLE events ADD COLUMN gameplay JSONB;
  ```
- [ ] 创建 `eventGameplayTemplates.js` 玩法模板库
  - [ ] territory_control 模板(领地争夺)
  - [ ] leaderboard 模板(排行榜)
  - [ ] war 模板(战争)
  - [ ] cooperation 模板(合作)
  - [ ] 每个模板包含: objective, scoringRules, tips, difficulty, timeCommitment
  - [ ] 支持多语言(en, zh, ja)
- [ ] 更新 `createEvent()` 自动填充gameplay字段
- [ ] 创建数据迁移脚本,为现有活动补充gameplay
- [ ] 测试验证

#### 验收标准
- [ ] 数据库迁移成功
- [ ] 新创建的活动自动包含gameplay
- [ ] 现有活动已补充gameplay

#### 文件位置
- `backend/src/database/migrations/20260223000000_add_event_gameplay.js`
- `backend/src/constants/eventGameplayTemplates.js`
- `backend/src/controllers/eventController.js`

</details>

---

### Task #4: P0-2 活动玩法说明 - iOS实现 ⭐⭐⭐⭐⭐
**状态**: ⬜ Pending (依赖: Task #3)
**工作量**: 1.5天
**负责人**: [iOS开发]

<details>
<summary>查看详细任务清单</summary>

#### iOS任务
- [ ] 创建 `EventGameplay.swift` 数据模型
  - [ ] LocalizedString 结构体(支持en/zh/ja)
  - [ ] LocalizedStringArray 结构体
- [ ] 创建 `EventGameplayView.swift` UI组件
  - [ ] ExpandableSection 可折叠区块组件
  - [ ] DifficultyBadge 难度星级组件(1-5星)
  - [ ] TimeCommitmentBadge 时间投入标签
  - [ ] 显示活动目标(objective)
  - [ ] 显示计分规则(scoringRules)列表
  - [ ] 显示获胜技巧(tips)列表
  - [ ] 显示推荐对象标签
- [ ] 集成到 `EventDetailView`
- [ ] 添加本地化字符串
- [ ] UI测试

#### 验收标准
- [ ] 玩法说明清晰易懂
- [ ] 可折叠设计节省空间
- [ ] 难度星级正确显示
- [ ] 支持3种语言

</details>

---

### Task #5: P0-3 个人贡献统计 - 后端实现 ⭐⭐⭐⭐⭐
**状态**: ⬜ Pending
**工作量**: 2天
**负责人**: [后端开发]

<details>
<summary>查看详细任务清单</summary>

#### 后端任务
- [ ] 创建 `getMyContribution` API端点
  - [ ] 查询用户在活动中的像素数(COUNT DISTINCT pixel_id)
  - [ ] 查询用户所在联盟
  - [ ] 查询联盟总像素数
  - [ ] 计算贡献率 = 我的像素 / 联盟总像素 × 100%
  - [ ] 查询联盟内排名(按像素数排序)
  - [ ] 获取Top 10贡献者列表
  - [ ] 计算里程碑进度(10/50/100/500/1000/5000)
- [ ] 添加路由: `GET /api/events/:id/my-contribution`
- [ ] 性能优化: 添加索引
  ```sql
  CREATE INDEX idx_event_pixel_logs_event_user ON event_pixel_logs(event_id, user_id);
  ```
- [ ] 编写单元测试
- [ ] 更新API文档

#### 验收标准
- [ ] API响应时间 < 300ms
- [ ] 贡献率计算准确
- [ ] 排名计算正确
- [ ] 单元测试覆盖率 > 80%

</details>

---

### Task #6: P0-3 个人贡献统计 - iOS实现 ⭐⭐⭐⭐⭐
**状态**: ⬜ Pending (依赖: Task #5)
**工作量**: 2.5天
**负责人**: [iOS开发]

<details>
<summary>查看详细任务清单</summary>

#### iOS任务
- [ ] 创建 `EventContribution.swift` 数据模型
- [ ] 在 `EventService` 中添加 `getMyContribution()` 方法
- [ ] 创建 `EventContributionCard.swift` UI组件
  - [ ] 圆形进度条显示贡献率
  - [ ] 联盟内排名徽章(金银铜)
  - [ ] 里程碑进度条
  - [ ] ContributorRow 组件显示Top贡献者
- [ ] 在 `EventManager` 中添加实时更新逻辑
  - [ ] updateContributionAfterPixelDraw() 每10个像素更新一次
  - [ ] checkMilestoneReached() 检测里程碑达成
  - [ ] showMilestoneToast() 显示里程碑通知
- [ ] 集成音效和震动反馈
  - [ ] 里程碑达成: SoundManager.play(.milestoneReached)
  - [ ] 震动: HapticManager.notification(.success)
- [ ] 添加本地化字符串(15+)
- [ ] UI测试

#### 验收标准
- [ ] 贡献数据实时更新
- [ ] 里程碑通知及时显示
- [ ] UI美观且易理解
- [ ] 支持3种语言

</details>

---

### Task #7: P0-4 活动区域地图预览 - iOS实现 ⭐⭐⭐⭐
**状态**: ⬜ Pending
**工作量**: 2天
**负责人**: [iOS开发]

<details>
<summary>查看详细任务清单</summary>

#### iOS任务
- [ ] 创建 `EventMapPreview.swift` 组件
- [ ] 创建 `EventMapPreviewViewModel.swift`
  - [ ] loadMapSnapshot() 异步加载地图快照
  - [ ] calculateDistance() 计算用户到活动区域的距离
  - [ ] formatDistance() 格式化距离显示(米/公里)
- [ ] 扩展 `MapSnapshotGenerator`
  - [ ] generateSnapshot(boundary:width:height:) 方法
  - [ ] 计算边界框(min/max lat/lng)
  - [ ] 使用MKMapSnapshotter生成快照
  - [ ] 在快照上绘制多边形边界(蓝色填充+边框)
- [ ] 实现"在地图中打开"功能
  - [ ] 打开Apple Maps并导航到活动位置
- [ ] 集成到 `EventDetailView`
- [ ] 添加本地化字符串
- [ ] 测试不同边界情况(大/小/不规则多边形)

#### 验收标准
- [ ] 地图快照生成成功(< 2秒)
- [ ] 距离计算准确
- [ ] 导航功能正常
- [ ] 支持各种多边形形状

</details>

---

## 第3-4周: P1重要改进

### Task #8: P1-1 优化活动信息架构 - iOS实现 ⭐⭐⭐⭐
**状态**: ⬜ Pending (依赖: Tasks #2, #4, #6, #7)
**工作量**: 2.5天
**负责人**: [iOS开发]

<details>
<summary>查看详细任务清单</summary>

#### iOS任务
- [ ] 创建 `EventTabView.swift` 主视图
- [ ] 创建 `EventTabViewModel.swift`
  - [ ] loadData() 异步加载所有数据
  - [ ] 活动分类逻辑(upcoming/active/my/ended)
  - [ ] refresh() 下拉刷新
- [ ] 创建各个Section组件
  - [ ] CurrentEventSection.swift (当前正在参与的)
  - [ ] UpcomingEventsSection.swift (即将开始的)
  - [ ] ActiveEventsSection.swift (进行中的)
  - [ ] MyEventsSection.swift (我参与的)
  - [ ] RecentResultsSection.swift (最近结束的)
  - [ ] SectionHeader.swift (区块标题)
- [ ] 创建 `UpcomingEventCard.swift`
  - [ ] 倒计时显示
  - [ ] 报名人数预览
  - [ ] 突出"立即报名"按钮
- [ ] 创建 `EmptyEventState.swift` 空状态页面
- [ ] 更新 `ContentView.swift` 添加Events Tab
  - [ ] Tab图标: flag.2.crossed
  - [ ] Badge显示即将开始的活动数
- [ ] 添加下拉刷新功能
- [ ] 添加本地化字符串
- [ ] UI/UX测试

#### 验收标准
- [ ] 信息层次清晰
- [ ] 加载性能良好
- [ ] 下拉刷新流畅
- [ ] UI美观

</details>

---

### Task #9: P1-2 新手引导流程 - iOS实现 ⭐⭐⭐⭐
**状态**: ⬜ Pending
**工作量**: 2天
**负责人**: [iOS开发]

<details>
<summary>查看详细任务清单</summary>

#### iOS任务
- [ ] 创建 `EventTutorialView.swift` 引导视图
- [ ] 创建 `TutorialPage.swift` 单页组件
- [ ] 设计4页引导内容
  - [ ] 页面1: 活动系统介绍
  - [ ] 页面2: 如何报名参与
  - [ ] 页面3: 如何进行游戏
  - [ ] 页面4: 奖励机制说明
- [ ] 实现页面切换逻辑(TabView + page风格)
- [ ] 添加"跳过"按钮(右上角)
- [ ] 添加"开始使用"按钮(最后一页)
- [ ] 添加 `@AppStorage("hasSeenEventTutorial")` 持久化
- [ ] 在 `EventCenterView` 首次打开时触发
- [ ] 在设置页面添加"重新查看引导"选项
- [ ] 添加本地化字符串(24+条)
- [ ] 用户测试

#### 验收标准
- [ ] 引导内容清晰易懂
- [ ] 动画流畅
- [ ] 只在首次显示
- [ ] 可以跳过
- [ ] 支持3种语言

</details>

---

### Task #10: P1-3 实时贡献反馈 - iOS实现 ⭐⭐⭐⭐
**状态**: ⬜ Pending
**工作量**: 2天
**负责人**: [iOS开发]

<details>
<summary>查看详细任务清单</summary>

#### iOS任务
- [ ] 创建 `PixelDrawFeedback.swift` 飘字动画组件
- [ ] 在 `EventManager` 中添加 `onPixelDrawnInEvent()` 方法
  - [ ] 显示"+1"飘字
  - [ ] 震动反馈: HapticManager.impact(.light)
  - [ ] 播放音效: SoundManager.play(.pixelDraw)
  - [ ] 本地计数更新
  - [ ] 每10个像素调用API更新服务器
- [ ] 创建里程碑检测逻辑 `checkMilestone()`
- [ ] 创建 `MilestoneToast.swift` 通知组件
- [ ] 添加里程碑音效资源
  - [ ] milestone_reached.m4a
- [ ] 集成到绘制像素的流程
- [ ] 测试各种场景

#### 验收标准
- [ ] 飘字动画流畅
- [ ] 音效和震动及时
- [ ] 里程碑通知准确
- [ ] 不影响绘制性能

</details>

---

### Task #11: P1-4 历史趋势分析 - 后端实现 ⭐⭐⭐
**状态**: ⬜ Pending
**工作量**: 1.5天
**负责人**: [后端开发]

<details>
<summary>查看详细任务清单</summary>

#### 后端任务
- [ ] 数据库迁移: 创建 `event_ranking_snapshots` 表
- [ ] 实现 `saveRankingSnapshot()` 方法
- [ ] 实现定时任务(每5分钟保存快照)
- [ ] 创建 `getEventRankingHistory` API端点
- [ ] 添加路由: `GET /api/events/:id/ranking-history?hours=24`
- [ ] 实现清理旧快照逻辑(保留7天)
- [ ] 编写单元测试
- [ ] 更新API文档

#### 验收标准
- [ ] 定时任务正常运行
- [ ] 快照数据完整准确
- [ ] API响应时间 < 500ms
- [ ] 旧数据自动清理

</details>

---

### Task #12: P1-4 历史趋势分析 - iOS实现 ⭐⭐⭐
**状态**: ⬜ Pending (依赖: Task #11)
**工作量**: 1.5天
**负责人**: [iOS开发]

<details>
<summary>查看详细任务清单</summary>

#### iOS任务
- [ ] 创建 `RankingSnapshot.swift` 数据模型
- [ ] 在 `EventService` 中添加 `getRankingHistory()` 方法
- [ ] 创建 `EventTrendChart.swift` 使用SwiftUI Charts
  - [ ] 排名趋势折线图
  - [ ] Y轴反转(排名越小越好)
  - [ ] X轴时间刻度
- [ ] 集成到EventDetailView
- [ ] 添加本地化字符串
- [ ] UI测试

#### 验收标准
- [ ] 趋势图清晰易读
- [ ] 数据加载流畅
- [ ] Y轴正确反转

</details>

---

### Task #13: P1-5 排名变化通知 - iOS实现 ⭐⭐⭐
**状态**: ⬜ Pending
**工作量**: 1天
**负责人**: [iOS开发]

<details>
<summary>查看详细任务清单</summary>

#### iOS任务
- [ ] 在 `EventManager.handleBattleUpdate()` 中添加排名变化检测
- [ ] 维护 `previousRankCache` 缓存
- [ ] 创建 `RankChangeToast.swift` 通知组件
- [ ] 实现 `showRankChangeNotification()` 方法
- [ ] 添加排名上升/下降音效
  - [ ] rank_up.m4a
  - [ ] rank_down.m4a
- [ ] 添加震动反馈
- [ ] 添加防抖逻辑(避免频繁通知)
- [ ] 添加通知开关(设置页面)
- [ ] 测试验证

#### 验收标准
- [ ] 排名变化检测准确
- [ ] 通知及时显示
- [ ] 音效和震动正确
- [ ] 不过度打扰

</details>

---

## 第5周: P2优化功能

### Task #14: P2-1 社交分享增强 ⭐⭐⭐
**状态**: ⬜ Pending
**工作量**: 5天
**负责人**: [后端+iOS开发]

<details>
<summary>查看详细任务清单</summary>

#### 后端任务
- [ ] 实现分享激励配置
- [ ] 实现邀请链接生成API
- [ ] 实现邀请奖励分配逻辑
- [ ] 统计分享数据

#### iOS任务
- [ ] 创建 `EventShareGenerator` 生成精美分享图
- [ ] 实现分享功能
- [ ] 实现邀请链接生成
- [ ] Deep Link处理
- [ ] UI测试

</details>

---

### Task #15: P2-2 活动难度评级 ⭐⭐⭐
**状态**: ⬜ Pending
**工作量**: 2天

<details>
<summary>查看详细任务清单</summary>

#### 后端任务
- [ ] 在gameplay中添加difficulty配置
- [ ] 实现难度自动计算逻辑

#### iOS任务
- [ ] 显示难度星级
- [ ] 显示时间投入估算
- [ ] 显示推荐对象

</details>

---

### Task #16: P2-3 离线缓存支持 ⭐⭐
**状态**: ⬜ Pending
**工作量**: 3天
**负责人**: [iOS开发]

<details>
<summary>查看详细任务清单</summary>

#### iOS任务
- [ ] 创建 `EventCache` 管理类
- [ ] 实现降级逻辑
- [ ] 显示离线提示Banner
- [ ] 实现重试机制
- [ ] 测试弱网和离线场景

</details>

---

### Task #17: P2-4 省电模式 ⭐⭐⭐
**状态**: ⬜ Pending
**工作量**: 2天
**负责人**: [iOS开发]

<details>
<summary>查看详细任务清单</summary>

#### iOS任务
- [ ] 添加省电模式开关
- [ ] 实现省电逻辑(降低轮询频率)
- [ ] 电量监控和自动启用
- [ ] 显示省电模式状态
- [ ] 测试电量消耗

</details>

---

### Task #18: P2-5 准入条件明确化 ⭐⭐⭐
**状态**: ⬜ Pending
**工作量**: 2天
**负责人**: [后端+iOS开发]

<details>
<summary>查看详细任务清单</summary>

#### 后端任务
- [ ] 扩展config.rules.requirements
- [ ] 在signup API中验证准入条件

#### iOS任务
- [ ] 显示准入条件列表
- [ ] 检查用户是否满足
- [ ] 优化报名按钮状态

</details>

---

## 第6周: 测试和发布

### Task #19: Week 6 全面测试 ⭐⭐⭐⭐⭐
**状态**: ⬜ Pending (依赖: Tasks #1-13)
**工作量**: 3天
**负责人**: [QA团队 + 全体开发]

<details>
<summary>查看详细任务清单</summary>

#### 单元测试
- [ ] 后端API测试覆盖率 > 80%
- [ ] iOS模型测试
- [ ] iOS ViewModel测试

#### 集成测试
- [ ] 端到端测试主要流程
- [ ] Socket通信测试
- [ ] 实时更新测试

#### UI测试
- [ ] 关键路径自动化测试
- [ ] 不同屏幕尺寸测试
- [ ] 暗黑模式测试
- [ ] 多语言测试

#### 性能测试
- [ ] API响应时间基准测试
- [ ] 地图快照生成性能
- [ ] 内存占用监控
- [ ] 电量消耗测试

#### 兼容性测试
- [ ] iOS版本: 16.0 - 17.x
- [ ] 设备: iPhone SE - iPhone 15 Pro Max
- [ ] 网络环境测试
- [ ] 边界情况测试

</details>

---

### Task #20: Week 6 Bug修复和优化 ⭐⭐⭐⭐⭐
**状态**: ⬜ Pending (依赖: Task #19)
**工作量**: 1天
**负责人**: [全体开发]

<details>
<summary>查看详细任务清单</summary>

- [ ] 修复测试发现的所有P0 Bug
- [ ] 修复测试发现的P1 Bug
- [ ] 性能优化
- [ ] UI/UX微调
- [ ] 代码审查
- [ ] 安全审查

</details>

---

### Task #21: Week 6 文档和发布准备 ⭐⭐⭐⭐⭐
**状态**: ⬜ Pending (依赖: Task #20)
**工作量**: 1天
**负责人**: [项目负责人]

<details>
<summary>查看详细任务清单</summary>

#### 文档更新
- [ ] API文档
- [ ] 用户帮助文档
- [ ] 运营手册
- [ ] 技术文档

#### 发布准备
- [ ] 准备Release Notes
- [ ] 准备App Store素材
- [ ] 制定灰度发布计划
- [ ] 配置监控Dashboard
- [ ] 准备应急回滚方案

#### 培训
- [ ] 运营团队培训
- [ ] 客服团队培训

</details>

---

## 任务依赖关系图

```
Week 1-2 (P0):
Task 1 (后端) → Task 2 (iOS)  [P0-1 报名数据]
Task 3 (后端) → Task 4 (iOS)  [P0-2 玩法说明]
Task 5 (后端) → Task 6 (iOS)  [P0-3 贡献统计]
Task 7 (iOS独立)               [P0-4 地图预览]

Week 3-4 (P1):
Tasks 2,4,6,7 → Task 8         [P1-1 信息架构]
Task 9 (独立)                  [P1-2 新手引导]
Task 10 (独立)                 [P1-3 实时反馈]
Task 11 (后端) → Task 12 (iOS) [P1-4 趋势分析]
Task 13 (独立)                 [P1-5 排名通知]

Week 5 (P2):
Tasks 14-18 (独立,可并行)

Week 6 (测试):
Tasks 1-13 → Task 19 → Task 20 → Task 21
```

---

## 验收标准总览

### 功能验收
- [ ] P0功能100%完成并通过测试
- [ ] P1功能100%完成并通过测试
- [ ] P2功能至少80%完成
- [ ] 所有关键路径UI测试通过
- [ ] 性能指标达标

### 质量验收
- [ ] 代码覆盖率 > 75%
- [ ] 无P0/P1级别Bug
- [ ] P2级别Bug < 5个
- [ ] API响应时间 < 200ms (P95)
- [ ] 崩溃率 < 0.1%

### 用户验收
- [ ] 内部Alpha测试通过
- [ ] Beta测试通过(10-20核心用户)
- [ ] 用户满意度 > 4.0/5.0

---

## 预期效果指标

| 指标 | 当前值 | 目标值 | 提升幅度 |
|------|--------|--------|---------|
| 活动参与率 | 15-20% | 25-35% | **+40-60%** |
| 平均参与时长 | 20分钟 | 35分钟 | **+75%** |
| 活动完成率 | 40% | 65% | **+62%** |
| 分享率 | <5% | 20% | **+300%** |
| 新手转化率 | 30% | 55% | **+83%** |
| 7日留存率 | 45% | 65% | **+44%** |

---

## 如何使用此清单

### 每日工作流程
1. 查看当前可以开始的任务(无依赖或依赖已完成)
2. 更新任务状态(Pending → In Progress → Completed)
3. 完成后在清单中打勾
4. 提交代码并通知团队

### 每周Review
1. 检查本周任务完成情况
2. 识别阻塞问题
3. 调整下周计划
4. 更新文档

### 使用Claude Code跟踪进度
```bash
# 查看所有任务
/tasks

# 更新任务状态
# 开始工作时: 将任务标记为in_progress
# 完成时: 将任务标记为completed
```

---

**最后更新**: 2026-02-22
**下次Review**: 每周五下午5:00

---

## 快速命令

```bash
# 查看详细优化方案
cat EVENT_MODULE_OPTIMIZATION_PLAN.md

# 查看执行清单
cat EVENT_OPTIMIZATION_CHECKLIST.md

# 查看本TODO
cat EVENT_MODULE_TODO.md
```

**祝开发顺利! 🚀**
