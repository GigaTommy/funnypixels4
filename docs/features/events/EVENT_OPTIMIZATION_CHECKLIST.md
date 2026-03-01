# 活动模块优化执行清单

**开始日期**: 2026-02-23
**预计完成**: 2026-04-05 (6周)
**负责人**: [待分配]

---

## 第1周: P0核心功能 (2026-02-23 ~ 2026-02-29)

### Day 1-2: 报名数据透明化 (P0-1)

#### 后端任务
- [ ] 创建 `getEventSignupStats` API端点
  - [ ] 统计报名联盟数和用户数
  - [ ] 查询Top 10联盟详情
  - [ ] 计算估算参与人数和平均战力
  - [ ] 检查最小人数要求
- [ ] 添加路由: `GET /api/events/:id/signup-stats`
- [ ] 编写单元测试
- [ ] API文档更新

**负责人**: [后端开发]
**预计**: 1.5天

#### iOS任务
- [ ] 创建 `EventSignupStats.swift` 数据模型
- [ ] 在 `EventService` 中添加 `getSignupStats()` 方法
- [ ] 创建 `EventSignupStatsView.swift` UI组件
  - [ ] StatCard组件
  - [ ] AllianceSignupRow组件
  - [ ] PowerLevelBadge组件
- [ ] 集成到 `EventDetailView`
- [ ] 添加本地化字符串(en, zh, ja)
- [ ] UI测试

**负责人**: [iOS开发]
**预计**: 1.5天

---

### Day 3-4: 活动玩法说明 (P0-2)

#### 后端任务
- [ ] 数据库迁移: 添加 `gameplay` JSONB字段到 `events` 表
- [ ] 创建 `eventGameplayTemplates.js` 玩法模板库
  - [ ] territory_control 模板
  - [ ] leaderboard 模板
  - [ ] war 模板
  - [ ] cooperation 模板
- [ ] 更新 `createEvent` 自动填充gameplay
- [ ] 数据迁移脚本(为现有活动补充gameplay)
- [ ] 测试验证

**负责人**: [后端开发]
**预计**: 1天

#### iOS任务
- [ ] 创建 `EventGameplay.swift` 数据模型
  - [ ] LocalizedString 结构体
  - [ ] LocalizedStringArray 结构体
- [ ] 创建 `EventGameplayView.swift` UI组件
  - [ ] ExpandableSection 组件
  - [ ] DifficultyBadge 组件
  - [ ] TimeCommitmentBadge 组件
- [ ] 集成到 `EventDetailView`
- [ ] 添加本地化字符串
- [ ] UI测试

**负责人**: [iOS开发]
**预计**: 1.5天

---

### Day 5: 代码Review和测试

- [ ] P0-1 代码Review
- [ ] P0-2 代码Review
- [ ] 集成测试
- [ ] Bug修复
- [ ] 文档更新

**负责人**: [全体]

---

## 第2周: P0高级功能 (2026-03-02 ~ 2026-03-08)

### Day 6-8: 个人贡献统计 (P0-3)

#### 后端任务
- [ ] 创建 `getMyContribution` API端点
  - [ ] 查询用户像素数 (DISTINCT pixel_id)
  - [ ] 查询用户联盟
  - [ ] 查询联盟总像素数
  - [ ] 计算贡献率
  - [ ] 查询联盟内排名
  - [ ] 获取Top贡献者
  - [ ] 计算里程碑进度
- [ ] 添加路由: `GET /api/events/:id/my-contribution`
- [ ] 性能优化(添加索引)
  ```sql
  CREATE INDEX idx_event_pixel_logs_event_user ON event_pixel_logs(event_id, user_id);
  ```
- [ ] 编写单元测试
- [ ] API文档更新

**负责人**: [后端开发]
**预计**: 2天

#### iOS任务
- [ ] 创建 `EventContribution.swift` 数据模型
- [ ] 在 `EventService` 中添加 `getMyContribution()` 方法
- [ ] 创建 `EventContributionCard.swift` UI组件
  - [ ] 圆形进度条
  - [ ] 联盟内排名显示
  - [ ] 里程碑进度条
  - [ ] ContributorRow 组件
- [ ] 在 `EventManager` 中添加实时更新逻辑
  - [ ] `updateContributionAfterPixelDraw()`
  - [ ] 里程碑检测 `checkMilestoneReached()`
  - [ ] Toast通知
- [ ] 集成音效和震动反馈
- [ ] 添加本地化字符串
- [ ] UI测试

**负责人**: [iOS开发]
**预计**: 2.5天

---

### Day 9-10: 活动区域地图预览 (P0-4)

#### iOS任务
- [ ] 创建 `EventMapPreview.swift` 组件
- [ ] 创建 `EventMapPreviewViewModel.swift`
  - [ ] `loadMapSnapshot()` 方法
  - [ ] 距离计算 `calculateDistance()`
  - [ ] 距离格式化 `formatDistance()`
- [ ] 扩展 `MapSnapshotGenerator`
  - [ ] `generateSnapshot(boundary:width:height:)` 方法
  - [ ] 边界框计算
  - [ ] 多边形绘制
- [ ] 实现"在地图中打开"功能
- [ ] 集成到 `EventDetailView`
- [ ] 添加本地化字符串
- [ ] 测试不同边界情况

**负责人**: [iOS开发]
**预计**: 2天

---

## 第3周: P1信息架构和引导 (2026-03-09 ~ 2026-03-15)

### Day 11-12: 信息架构优化 (P1-1)

#### iOS任务
- [ ] 创建 `EventTabView.swift` 主视图
- [ ] 创建 `EventTabViewModel.swift`
  - [ ] `loadData()` 异步加载
  - [ ] 活动分类逻辑
- [ ] 创建各个Section组件:
  - [ ] `CurrentEventSection.swift`
  - [ ] `UpcomingEventsSection.swift`
  - [ ] `ActiveEventsSection.swift`
  - [ ] `MyEventsSection.swift`
  - [ ] `RecentResultsSection.swift`
  - [ ] `SectionHeader.swift`
- [ ] 创建 `UpcomingEventCard.swift` 组件
  - [ ] 倒计时显示
  - [ ] 报名人数预览
  - [ ] 突出"立即报名"按钮
- [ ] 创建 `EmptyEventState.swift`
- [ ] 更新 `ContentView.swift` 添加Events Tab
- [ ] 添加Tab badge显示即将开始的活动数
- [ ] 添加下拉刷新
- [ ] 添加本地化字符串
- [ ] UI/UX测试

**负责人**: [iOS开发]
**预计**: 2.5天

---

### Day 13-15: 新手引导流程 (P1-2)

#### 设计任务
- [ ] 设计4页引导内容
  - [ ] 页面1: 活动系统介绍
  - [ ] 页面2: 如何报名参与
  - [ ] 页面3: 如何进行游戏
  - [ ] 页面4: 奖励机制
- [ ] 设计引导页面插图(或使用SF Symbols)

**负责人**: [UI设计]
**预计**: 1天

#### iOS任务
- [ ] 创建 `EventTutorialView.swift`
- [ ] 创建 `TutorialPage.swift` 组件
- [ ] 实现页面切换逻辑
- [ ] 添加"跳过"按钮
- [ ] 添加"开始使用"按钮
- [ ] 添加 `@AppStorage("hasSeenEventTutorial")` 持久化
- [ ] 在 `EventCenterView` 首次打开时触发
- [ ] 在设置页面添加"重新查看引导"选项
- [ ] 添加本地化字符串(3语言 × 4页 = 12条)
- [ ] 用户测试

**负责人**: [iOS开发]
**预计**: 2天

---

## 第4周: P1反馈和趋势 (2026-03-16 ~ 2026-03-22)

### Day 16-17: 实时贡献反馈 (P1-3)

#### iOS任务
- [ ] 创建 `PixelDrawFeedback.swift` 飘字动画组件
- [ ] 在 `EventManager` 中添加 `onPixelDrawnInEvent()` 方法
  - [ ] 显示"+1"飘字
  - [ ] 震动反馈 (HapticManager)
  - [ ] 播放音效 (SoundManager)
  - [ ] 本地计数更新
  - [ ] 每10个像素更新服务器
- [ ] 创建里程碑检测逻辑 `checkMilestone()`
- [ ] 创建 `MilestoneToast.swift` 通知组件
- [ ] 添加里程碑音效资源
- [ ] 集成到绘制像素的流程
- [ ] 测试各种场景

**负责人**: [iOS开发]
**预计**: 2天

---

### Day 18-19: 历史趋势分析 (P1-4)

#### 后端任务
- [ ] 数据库迁移: 创建 `event_ranking_snapshots` 表
  ```sql
  CREATE TABLE event_ranking_snapshots (
    id SERIAL PRIMARY KEY,
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    rankings JSONB NOT NULL,
    total_pixels INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
  );
  CREATE INDEX idx_ranking_snapshots_event_time ON event_ranking_snapshots(event_id, created_at);
  ```
- [ ] 实现 `saveRankingSnapshot()` 方法
- [ ] 实现定时任务(每5分钟保存快照)
- [ ] 创建 `getEventRankingHistory` API端点
- [ ] 添加路由: `GET /api/events/:id/ranking-history?hours=24`
- [ ] 清理旧快照逻辑(保留7天)
- [ ] 测试验证

**负责人**: [后端开发]
**预计**: 1.5天

#### iOS任务
- [ ] 创建 `RankingSnapshot.swift` 数据模型
- [ ] 在 `EventService` 中添加 `getRankingHistory()` 方法
- [ ] 创建 `EventTrendChart.swift` 使用SwiftUI Charts
  - [ ] 排名趋势折线图
  - [ ] Y轴反转(排名越小越好)
  - [ ] X轴时间刻度
- [ ] 集成到EventDetailView或新的趋势页面
- [ ] 添加本地化字符串
- [ ] UI测试

**负责人**: [iOS开发]
**预计**: 1.5天

---

### Day 20: 排名变化通知 (P1-5)

#### iOS任务
- [ ] 在 `EventManager.handleBattleUpdate()` 中添加排名变化检测
- [ ] 维护 `previousRankCache` 缓存
- [ ] 创建 `RankChangeToast.swift` 通知组件
- [ ] 实现 `showRankChangeNotification()` 方法
- [ ] 添加排名上升/下降音效
- [ ] 添加震动反馈
- [ ] 添加防抖逻辑(避免频繁通知)
- [ ] 添加通知开关(设置页面)
- [ ] 测试验证

**负责人**: [iOS开发]
**预计**: 1天

---

## 第5周: P2优化功能 (2026-03-23 ~ 2026-03-29)

### P2-1: 社交分享增强 (3天)

#### 后端任务
- [ ] 实现分享激励配置
- [ ] 实现邀请链接生成
- [ ] 实现邀请奖励分配
- [ ] 统计分享数据

**负责人**: [后端开发]

#### iOS任务
- [ ] 创建 `EventShareGenerator` 生成分享图
- [ ] 实现分享功能
- [ ] 实现邀请链接生成
- [ ] Deep Link处理
- [ ] UI测试

**负责人**: [iOS开发]

---

### P2-2: 活动难度评级 (2天)

#### 后端任务
- [ ] 在gameplay中添加difficulty配置
- [ ] 实现难度自动计算逻辑

**负责人**: [后端开发]

#### iOS任务
- [ ] 显示难度星级
- [ ] 显示时间投入估算
- [ ] 显示推荐对象

**负责人**: [iOS开发]

---

### P2-3: 离线缓存支持 (2天)

#### iOS任务
- [ ] 创建 `EventCache` 管理类
- [ ] 实现活动列表缓存
- [ ] 实现降级逻辑
- [ ] 显示离线提示Banner
- [ ] 实现重试机制

**负责人**: [iOS开发]

---

### P2-4: 省电模式 (1天)

#### iOS任务
- [ ] 添加省电模式开关
- [ ] 调整轮询频率(60s → 120s)
- [ ] 调整地理围栏检查频率
- [ ] 电量低于20%自动启用
- [ ] 显示省电提示

**负责人**: [iOS开发]

---

### P2-5: 准入条件明确 (2天)

#### 后端任务
- [ ] 扩展config.rules.requirements
  - [ ] userLevel
  - [ ] allianceLevel
  - [ ] minPixelsDrawn
  - [ ] accountAge
- [ ] 报名时验证准入条件

**负责人**: [后端开发]

#### iOS任务
- [ ] 显示准入条件列表
- [ ] 检查用户是否满足
- [ ] 显示未满足的条件
- [ ] 优化报名按钮状态

**负责人**: [iOS开发]

---

## 第6周: 测试和发布 (2026-03-30 ~ 2026-04-05)

### Day 26-28: 全面测试

- [ ] **单元测试**
  - [ ] 后端API测试覆盖率 > 80%
  - [ ] iOS模型测试
  - [ ] iOS ViewModel测试

- [ ] **集成测试**
  - [ ] 端到端测试主要流程
  - [ ] Socket通信测试
  - [ ] 实时更新测试

- [ ] **UI测试**
  - [ ] 关键路径自动化测试
  - [ ] 不同屏幕尺寸测试
  - [ ] 暗黑模式测试
  - [ ] 多语言测试

- [ ] **性能测试**
  - [ ] API响应时间 < 200ms
  - [ ] 地图快照生成 < 2s
  - [ ] 内存占用监控
  - [ ] 电量消耗测试

- [ ] **兼容性测试**
  - [ ] iOS 16.0 - 17.x
  - [ ] iPhone SE - iPhone 15 Pro Max
  - [ ] 网络环境测试(WiFi, 4G, 弱网)

**负责人**: [QA团队 + 全体开发]

---

### Day 29: Bug修复和优化

- [ ] 修复测试发现的Bug
- [ ] 性能优化
- [ ] UI/UX微调
- [ ] 代码审查

**负责人**: [全体开发]

---

### Day 30: 文档和发布准备

- [ ] **文档更新**
  - [ ] API文档
  - [ ] 用户帮助文档
  - [ ] 运营手册
  - [ ] 技术文档

- [ ] **发布准备**
  - [ ] 准备Release Notes
  - [ ] 准备App Store截图和描述
  - [ ] 灰度发布计划
  - [ ] 监控Dashboard配置
  - [ ] 应急回滚方案

- [ ] **培训**
  - [ ] 运营团队培训
  - [ ] 客服团队培训

**负责人**: [项目负责人]

---

## 验收标准

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

- [ ] 内部Alpha测试通过(团队成员)
- [ ] Beta测试通过(10-20核心用户)
- [ ] 用户满意度 > 4.0/5.0

---

## 风险跟踪

### 当前风险

| 风险 | 状态 | 缓解措施 | 负责人 |
|------|------|---------|--------|
| 数据库性能 | ⚠️ 监控中 | 已添加索引,准备缓存方案 | [后端] |
| 开发时间紧张 | ⚠️ 监控中 | 优先P0,必要时延后P2 | [PM] |
| - | ✅ 无风险 | - | - |

---

## 进度追踪

### 整体进度: 0% (0/41天)

- Week 1: ⬜⬜⬜⬜⬜ 0/5天
- Week 2: ⬜⬜⬜⬜⬜ 0/5天
- Week 3: ⬜⬜⬜⬜⬜ 0/5天
- Week 4: ⬜⬜⬜⬜⬜ 0/5天
- Week 5: ⬜⬜⬜⬜⬜ 0/5天
- Week 6: ⬜⬜⬜⬜⬜ 0/5天

### 里程碑

- [ ] Week 1完成: P0-1, P0-2
- [ ] Week 2完成: P0-3, P0-4
- [ ] Week 3完成: P1-1, P1-2
- [ ] Week 4完成: P1-3, P1-4, P1-5
- [ ] Week 5完成: P2功能
- [ ] Week 6完成: 测试和发布

---

## 团队分工

### 后端开发 (1-2人)
- API开发和数据库设计
- 性能优化
- 后端测试

### iOS开发 (2-3人)
- UI组件开发
- 数据模型和Service层
- 前端测试

### UI/UX设计 (1人)
- 引导页面设计
- UI素材准备
- 用户体验优化

### QA测试 (1人)
- 测试用例编写
- 功能测试
- 性能测试
- Bug跟踪

### 项目管理 (1人)
- 进度跟踪
- 风险管理
- 团队协调

---

## 每日站会要点

每天9:30 AM,15分钟

1. 昨天完成了什么?
2. 今天计划做什么?
3. 遇到什么阻碍?
4. 需要什么帮助?

---

## 沟通渠道

- 日常沟通: Slack #event-optimization
- 代码Review: GitHub Pull Requests
- Bug跟踪: Jira
- 文档: Confluence
- 设计稿: Figma

---

**最后更新**: 2026-02-22
**下次Review**: 2026-02-26 (Week 1结束)
