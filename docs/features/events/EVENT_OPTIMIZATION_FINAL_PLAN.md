# FunnyPixels 活动模块优化 - 最终实施方案 v2.0

**版本**: v2.0 (兼容性调整版)
**日期**: 2026-02-23
**状态**: ✅ 已确认,可开始实施

---

## 📋 版本变更说明

本方案基于对现有代码的详细审查,进行了重大优化调整:

### 主要变更

| 变更 | 原方案 | 调整后 | 收益 |
|------|--------|--------|------|
| 代码复用率 | 35% | 65% | +30% |
| 总工作量 | 41天 | 36.5天 | -4.5天 (-11%) |
| 新增Swift文件 | 23个 | 15个 | -8个 (-35%) |
| 新增音效文件 | 3个 | 0个 | -3个 (-100%) |
| Tab数量 | 6个 | 5个 | 保持稳定 |

### 核心调整点

1. ✅ **不添加新的Events Tab** - 改进现有EventCenterView
2. ✅ **复用MapSnapshotGenerator** - 只扩展boundary绘制方法
3. ✅ **复用音效系统** - 使用现有音效,不添加新文件
4. ✅ **扩展EventManager** - 添加属性而非创建新类
5. ✅ **保持5个Tab** - 用户习惯不受影响

---

## 🎯 优化目标 (不变)

### 核心KPI提升目标

| 指标 | 当前值(估算) | 目标值 | 提升幅度 |
|------|------------|--------|---------|
| 活动参与率 | 15-20% | 25-35% | +40-60% |
| 单次活动平均参与时长 | 20分钟 | 35分钟 | +75% |
| 活动完成率 | 40% | 65% | +62% |
| 活动分享率 | <5% | 20% | +300% |
| 新手首次参与转化率 | 30% | 55% | +83% |
| 7日留存率 | 45% | 65% | +44% |

---

## 📅 实施计划概览

### 时间线

**总周期**: 5.5周 (原6周)
**节省**: 0.5周

```
Week 1-2: P0核心功能      (8.5天, 原10天)
Week 3-4: P1重要改进      (14天, 原16天)
Week 5:   P2优化功能      (14天, 不变)
Week 6:   测试和发布      (5天, 不变)
```

### 阶段划分

| 阶段 | 周期 | 任务数 | 工作量 | 关键里程碑 |
|------|------|--------|--------|----------|
| P0 | Week 1-2 | 7 | 8.5天 | 核心功能可用 |
| P1 | Week 3-4 | 6 | 14天 | 体验显著提升 |
| P2 | Week 5 | 5 | 14天 | 锦上添花 |
| 测试发布 | Week 6 | 3 | 5天 | 生产就绪 |

---

## 🔧 P0任务详细方案 (Week 1-2)

### Task #1: P0-1 报名数据透明化 - 后端 (1.5天)

**状态**: 可立即开始
**调整**: 无变化

#### 实施清单

**后端任务:**
```javascript
// backend/src/controllers/eventController.js
async function getEventSignupStats(req, res) {
  const { id: eventId } = req.params;

  // 1. 统计报名数
  const participantStats = await knex('event_participants')
    .where({ event_id: eventId })
    .select('participant_type')
    .count('* as count')
    .groupBy('participant_type');

  // 2. 获取Top 10联盟
  const topAlliances = await knex('event_participants as ep')
    .where({ 'ep.event_id': eventId, 'ep.participant_type': 'alliance' })
    .join('alliances as a', 'ep.participant_id', 'a.id')
    .leftJoin('alliance_members as am', 'a.id', 'am.alliance_id')
    .select(
      'a.id', 'a.name', 'a.color', 'a.level',
      knex.raw('COUNT(DISTINCT am.user_id) as member_count'),
      knex.raw('COALESCE(SUM(u.total_pixels), 0) as total_power')
    )
    .leftJoin('users as u', 'am.user_id', 'u.id')
    .groupBy('a.id')
    .orderBy('total_power', 'desc')
    .limit(10);

  // 3. 估算参与人数
  const avgAllianceSize = calculateAvgSize(topAlliances);
  const estimatedParticipants = (allianceCount * avgAllianceSize) + userCount;

  // 4. 检查最小人数要求
  const minParticipants = event.config?.rules?.minParticipants || 0;
  const meetsMinimum = estimatedParticipants >= minParticipants;

  return res.json({
    allianceCount,
    userCount,
    estimatedParticipants,
    avgAlliancePower,
    avgAllianceSize,
    topAlliances,
    requirements: { minParticipants, meetsMinimum, shortfall }
  });
}
```

**路由配置:**
```javascript
// backend/src/routes/eventRoutes.js
router.get('/:id/signup-stats', eventController.getEventSignupStats);
```

#### 验收标准
- [ ] API响应时间 < 200ms (P95)
- [ ] 返回正确的统计数据
- [ ] 单元测试覆盖率 > 80%

---

### Task #2: P0-1 报名数据透明化 - iOS (1.5天)

**依赖**: Task #1
**调整**: 无变化

#### 实施清单

```swift
// 1. 数据模型
// FunnyPixelsApp/Models/EventSignupStats.swift
struct EventSignupStats: Codable {
    let allianceCount: Int
    let userCount: Int
    let estimatedParticipants: Int
    let avgAlliancePower: Int
    let topAlliances: [TopAlliance]
    let requirements: Requirements
}

// 2. Service层
// FunnyPixelsApp/Services/API/EventService.swift
extension EventService {
    func getSignupStats(_ eventId: String) async throws -> EventSignupStats {
        let endpoint = "/api/events/\(eventId)/signup-stats"
        return try await apiManager.request(endpoint: endpoint, method: "GET")
    }
}

// 3. UI组件
// FunnyPixelsApp/Views/Events/Components/EventSignupStatsView.swift
struct EventSignupStatsView: View {
    let stats: EventSignupStats

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            // 标题
            Text("activity_heat".localized())
                .font(.headline)

            // 统计卡片
            HStack(spacing: 12) {
                StatCard(icon: "flag.2.crossed.fill", value: "\(stats.allianceCount)",
                        label: "event.stats.alliances", color: .blue)
                StatCard(icon: "person.3.fill", value: "~\(stats.estimatedParticipants)",
                        label: "event.stats.participants", color: .green)
                StatCard(icon: "chart.bar.fill", value: "\(stats.avgAlliancePower)",
                        label: "event.stats.avg_power", color: .orange)
            }

            // 已报名联盟列表
            if !stats.topAlliances.isEmpty {
                AllianceListSection(alliances: stats.topAlliances)
            }
        }
    }
}

// 4. 集成到EventDetailView
// FunnyPixelsApp/Views/Events/EventDetailView.swift
@State private var signupStats: EventSignupStats?

if let stats = signupStats {
    EventSignupStatsView(stats: stats)
        .padding(.horizontal)
}

.task {
    signupStats = try? await EventService.shared.getSignupStats(event.id)
}
```

#### 验收标准
- [ ] UI展示正确且美观
- [ ] 实时加载数据无卡顿
- [ ] 支持3种语言(en/zh/ja)

---

### Task #3: P0-2 活动玩法说明 - 后端 (1天)

**状态**: 可立即开始
**调整**: 无变化

#### 实施清单

**1. 数据库迁移:**
```sql
-- backend/src/database/migrations/20260223000000_add_event_gameplay.js
exports.up = function(knex) {
  return knex.schema.table('events', table => {
    table.jsonb('gameplay').comment('Gameplay instructions');
  });
};
```

**2. 玩法模板:**
```javascript
// backend/src/constants/eventGameplayTemplates.js
const GAMEPLAY_TEMPLATES = {
  territory_control: {
    objective: {
      en: "Capture and hold the most territory",
      zh: "占领并保持最多的领地",
      ja: "最も多くの領土を獲得し保持する"
    },
    scoringRules: {
      en: [
        "Each pixel contributes points based on duration",
        "Continuous pixels form territories",
        "Larger territories score faster"
      ],
      zh: ["每个像素根据持有时长累计积分", "连续像素形成领地", "领地越大积分越快"],
      ja: ["各ピクセルは保持時間に基づいてポイント獲得", ...]
    },
    tips: {
      en: ["Focus on central areas", "Coordinate with teammates", ...],
      zh: ["优先占领中心区域", "与队友协调", ...],
      ja: ["中心エリアに集中", ...]
    },
    difficulty: "medium",
    timeCommitment: "2-3 hours/day",
    recommendedFor: ["alliances", "active_players"]
  },
  // ... leaderboard, war, cooperation
};
```

**3. 自动填充:**
```javascript
// backend/src/controllers/eventController.js
async function createEvent(req, res) {
  const { type, ...eventData } = req.body;

  const gameplay = GAMEPLAY_TEMPLATES[type] || {};

  const event = await knex('events').insert({
    ...eventData,
    type,
    gameplay: JSON.stringify(gameplay)
  });
}
```

#### 验收标准
- [ ] 数据库迁移成功
- [ ] 新活动自动包含gameplay
- [ ] 现有活动已补充

---

### Task #4: P0-2 活动玩法说明 - iOS (1.5天)

**依赖**: Task #3
**调整**: 无变化

#### 实施清单

```swift
// 1. 数据模型
// FunnyPixelsApp/Models/EventGameplay.swift
struct EventGameplay: Codable {
    let objective: LocalizedString
    let scoringRules: LocalizedStringArray
    let tips: LocalizedStringArray
    let difficulty: String
    let timeCommitment: String
    let recommendedFor: [String]
}

struct LocalizedString: Codable {
    let en: String
    let zh: String?
    let ja: String?

    var localized: String {
        let lang = Locale.current.language.languageCode?.identifier ?? "en"
        return (lang == "zh" ? zh : (lang == "ja" ? ja : nil)) ?? en
    }
}

// 2. UI组件
// FunnyPixelsApp/Views/Events/Components/EventGameplayView.swift
struct EventGameplayView: View {
    let gameplay: EventGameplay
    @State private var expandedSections: Set<String> = ["objective"]

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            // 难度和时间
            HStack {
                DifficultyBadge(difficulty: gameplay.difficulty)
                TimeCommitmentBadge(time: gameplay.timeCommitment)
            }

            // 可折叠Section
            ExpandableSection(title: "活动目标", icon: "target",
                            isExpanded: expandedSections.contains("objective")) {
                Text(gameplay.objective.localized)
            }

            ExpandableSection(title: "计分规则", icon: "chart.bar.fill",
                            isExpanded: expandedSections.contains("scoring")) {
                ForEach(gameplay.scoringRules.localized, id: \.self) { rule in
                    HStack { Text("•"); Text(rule) }
                }
            }

            ExpandableSection(title: "获胜技巧", icon: "lightbulb.fill",
                            isExpanded: expandedSections.contains("tips")) {
                ForEach(gameplay.tips.localized.enumerated(), id: \.offset) { index, tip in
                    HStack {
                        Image(systemName: "\(index + 1).circle.fill")
                        Text(tip)
                    }
                }
            }
        }
    }
}
```

#### 验收标准
- [ ] 玩法说明清晰易懂
- [ ] 可折叠设计节省空间
- [ ] 支持3种语言

---

### Task #5: P0-3 个人贡献统计 - 后端 (2天)

**状态**: 可立即开始
**调整**: 无变化

#### 实施清单

```javascript
// backend/src/controllers/eventController.js
async function getMyContribution(req, res) {
  const { id: eventId } = req.params;
  const userId = req.user.id;

  // 1. 用户像素数
  const myPixels = await knex('event_pixel_logs')
    .where({ event_id: eventId, user_id: userId })
    .countDistinct('pixel_id as count')
    .first();

  // 2. 用户联盟
  const userAlliance = await knex('alliance_members')
    .where({ user_id: userId })
    .join('alliances', 'alliance_members.alliance_id', 'alliances.id')
    .select('alliances.id', 'alliances.name')
    .first();

  if (!userAlliance) {
    return res.json({ myPixels, allianceId: null, ... });
  }

  // 3. 联盟总像素
  const allianceTotalPixels = await knex('event_pixel_logs')
    .where({ event_id: eventId })
    .join('alliance_members', 'event_pixel_logs.user_id', 'alliance_members.user_id')
    .where({ 'alliance_members.alliance_id': userAlliance.id })
    .countDistinct('event_pixel_logs.pixel_id')
    .first();

  // 4. 贡献率
  const contributionRate = (myPixels / allianceTotalPixels * 100).toFixed(2);

  // 5. 联盟内排名
  const allianceMembers = await knex('alliance_members')
    .where({ alliance_id: userAlliance.id })
    .leftJoin('event_pixel_logs', ...)
    .select(...)
    .groupBy('user_id')
    .orderBy('pixel_count', 'desc');

  const rankInAlliance = allianceMembers.findIndex(m => m.id === userId) + 1;
  const topContributors = allianceMembers.slice(0, 10);

  // 6. 里程碑
  const milestones = [10, 50, 100, 500, 1000, 5000];
  const nextMilestone = milestones.find(m => m > myPixels) || milestones[milestones.length - 1];

  return res.json({
    myPixels,
    allianceId: userAlliance.id,
    allianceName: userAlliance.name,
    allianceTotalPixels,
    contributionRate,
    rankInAlliance,
    topContributors,
    milestones: { current, next, progress }
  });
}

// 路由
router.get('/:id/my-contribution', auth, eventController.getMyContribution);

// 性能优化: 添加索引
CREATE INDEX idx_event_pixel_logs_event_user ON event_pixel_logs(event_id, user_id);
```

#### 验收标准
- [ ] API响应时间 < 300ms
- [ ] 贡献率计算准确
- [ ] 排名计算正确

---

### Task #6: P0-3 个人贡献统计 - iOS (2天,已调整)

**依赖**: Task #5
**调整**: ✅ 扩展EventManager,复用音效

#### 实施清单

```swift
// 1. 数据模型 (新建)
// FunnyPixelsApp/Models/EventContribution.swift
struct EventContribution: Codable {
    let myPixels: Int
    let allianceId: String?
    let allianceName: String?
    let allianceTotalPixels: Int
    let contributionRate: Double
    let rankInAlliance: Int?
    let topContributors: [Contributor]
    let milestones: Milestone
}

// 2. EventManager扩展 (关键调整)
// FunnyPixelsApp/Services/EventManager.swift
class EventManager: ObservableObject {
    // 新增属性
    @Published var userContribution: EventContribution?
    @Published var contributionLoadingState: LoadingState = .idle
    private var lastMilestone: Int = 0
    private var pixelCountCache: [String: Int] = [:]

    // 新增方法: 更新贡献
    func updateContribution(for eventId: String) async {
        contributionLoadingState = .loading
        do {
            let contribution = try await EventService.shared.getMyContribution(eventId)
            await MainActor.run {
                self.userContribution = contribution
                self.contributionLoadingState = .success
                checkMilestone(contribution)
            }
        } catch {
            await MainActor.run {
                self.contributionLoadingState = .error(error.localizedDescription)
            }
        }
    }

    // 新增方法: 像素绘制回调
    func onPixelDrawnInEvent(_ eventId: String) {
        // 本地计数
        pixelCountCache[eventId, default: 0] += 1

        // 每10个像素更新服务器
        if pixelCountCache[eventId]! % 10 == 0 {
            Task { await updateContribution(for: eventId) }
        }

        // 立即反馈
        SoundManager.shared.playSystemSoundFast() // pixelDraw音效
        HapticManager.shared.impact(style: .light)
    }

    // 新增方法: 里程碑检测
    private func checkMilestone(_ contribution: EventContribution) {
        let milestones = [10, 50, 100, 500, 1000, 5000]
        let current = contribution.myPixels

        for milestone in milestones {
            if current >= milestone && lastMilestone < milestone {
                lastMilestone = milestone

                // 复用现有音效
                let sound: SoundEffect = milestone >= 1000 ? .levelUp : .success
                SoundManager.shared.play(sound)
                HapticManager.shared.notification(type: .success)

                // Toast通知
                NotificationCenter.default.post(
                    name: .showMilestoneToast,
                    object: MilestoneData(milestone: milestone, total: current)
                )
                break
            }
        }
    }
}

// 3. UI组件 (新建)
// FunnyPixelsApp/Views/Events/Components/EventContributionCard.swift
struct EventContributionCard: View {
    let contribution: EventContribution

    var body: some View {
        VStack(spacing: 16) {
            // 圆形进度条
            ZStack {
                Circle().stroke(Color.blue.opacity(0.2), lineWidth: 8)
                Circle().trim(from: 0, to: contribution.contributionRate / 100)
                    .stroke(LinearGradient(...), style: StrokeStyle(lineWidth: 8))
                    .rotationEffect(.degrees(-90))
                VStack {
                    Text("\(contribution.myPixels)").font(.title).bold()
                    Text("像素").font(.caption2)
                }
            }
            .frame(width: 100, height: 100)

            // 联盟内排名
            if let rank = contribution.rankInAlliance {
                HStack {
                    Image(systemName: "medal.fill")
                    Text("联盟内排名 #\(rank)")
                }
            }

            // 里程碑进度
            ProgressView(value: contribution.milestones.progress / 100)
            Text("下一里程碑: \(contribution.milestones.next)")
        }
    }
}

// 4. 集成到像素绘制流程
// 在绘制像素后调用
if let currentEvent = eventManager.currentWarEvent {
    eventManager.onPixelDrawnInEvent(currentEvent.id)
}
```

#### 验收标准
- [ ] 贡献数据实时更新
- [ ] 里程碑通知及时
- [ ] 使用现有音效
- [ ] EventManager单一数据源

---

### Task #7: P0-4 地图预览 - iOS (1天,已调整)

**状态**: 可立即开始
**调整**: ✅ 只扩展MapSnapshotGenerator

#### 实施清单

```swift
// 1. 扩展MapSnapshotGenerator (关键调整)
// FunnyPixelsApp/Utilities/MapSnapshotGenerator.swift
extension MapSnapshotGenerator {
    /// 生成活动区域地图快照
    static func generateEventSnapshot(
        boundary: EventService.GeoJSONBoundary,
        width: CGFloat,
        height: CGFloat
    ) async -> UIImage? {
        // 1. 计算region
        let region = calculateRegion(from: boundary)

        // 2. 创建快照配置
        let options = MKMapSnapshotter.Options()
        options.region = region
        options.size = CGSize(width: width, height: height)
        options.scale = getScreenScale() // 复用现有方法

        let snapshotter = MKMapSnapshotter(options: options)

        do {
            let snapshot = try await snapshotter.start()
            return drawBoundaryOnSnapshot(snapshot: snapshot, boundary: boundary)
        } catch {
            logger.error("Failed to generate event snapshot: \(error)")
            return nil
        }
    }

    /// 绘制边界 (新增私有方法)
    private static func drawBoundaryOnSnapshot(
        snapshot: MKMapSnapshotter.Snapshot,
        boundary: EventService.GeoJSONBoundary
    ) -> UIImage {
        // 使用现有CoreGraphics模式(避免Metal崩溃)
        let renderer = UIGraphicsImageRenderer(size: snapshot.image.size)

        return renderer.image { context in
            snapshot.image.draw(at: .zero)

            guard let coordinates = boundary.coordinates.first else { return }

            let path = UIBezierPath()
            var isFirstPoint = true

            for point in coordinates {
                guard point.count >= 2 else { continue }
                let coord = CLLocationCoordinate2D(latitude: point[1], longitude: point[0])
                let mapPoint = snapshot.point(for: coord)

                if isFirstPoint {
                    path.move(to: mapPoint)
                    isFirstPoint = false
                } else {
                    path.addLine(to: mapPoint)
                }
            }
            path.close()

            // 填充和边框
            let ctx = context.cgContext
            ctx.setFillColor(UIColor.systemBlue.withAlphaComponent(0.2).cgColor)
            path.fill()
            ctx.setStrokeColor(UIColor.systemBlue.withAlphaComponent(0.8).cgColor)
            ctx.setLineWidth(3)
            path.stroke()
        }
    }

    /// 计算边界区域 (新增私有方法)
    private static func calculateRegion(
        from boundary: EventService.GeoJSONBoundary
    ) -> MKCoordinateRegion {
        guard let coordinates = boundary.coordinates.first else {
            return MKCoordinateRegion()
        }

        var minLat = Double.infinity, maxLat = -Double.infinity
        var minLng = Double.infinity, maxLng = -Double.infinity

        for point in coordinates where point.count >= 2 {
            minLat = min(minLat, point[1])
            maxLat = max(maxLat, point[1])
            minLng = min(minLng, point[0])
            maxLng = max(maxLng, point[0])
        }

        let center = CLLocationCoordinate2D(
            latitude: (minLat + maxLat) / 2,
            longitude: (minLng + maxLng) / 2
        )
        let span = MKCoordinateSpan(
            latitudeDelta: (maxLat - minLat) * 1.2,
            longitudeDelta: (maxLng - minLng) * 1.2
        )

        return MKCoordinateRegion(center: center, span: span)
    }
}

// 2. EventMapPreview (极简实现)
// FunnyPixelsApp/Views/Events/Components/EventMapPreview.swift
struct EventMapPreview: View {
    let event: EventService.Event
    @StateObject private var viewModel = EventMapPreviewViewModel()

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: "map.fill")
                Text("活动区域")
            }

            if let snapshot = viewModel.snapshot {
                Image(uiImage: snapshot)
                    .resizable()
                    .scaledToFill()
                    .frame(height: 200)
                    .clipShape(RoundedRectangle(cornerRadius: 12))

                HStack {
                    if let distance = viewModel.distance {
                        Label(distance, systemImage: "location.fill")
                    }
                    Spacer()
                    Button(action: openInMaps) {
                        Label("在地图中查看", systemImage: "map")
                    }
                }
            } else if viewModel.isLoading {
                ProgressView().frame(height: 200)
            }
        }
        .task {
            await viewModel.loadSnapshot(event: event)
        }
    }
}

@MainActor
class EventMapPreviewViewModel: ObservableObject {
    @Published var snapshot: UIImage?
    @Published var distance: String?
    @Published var isLoading = false

    func loadSnapshot(event: EventService.Event) async {
        guard let boundary = event.boundary else { return }

        isLoading = true
        defer { isLoading = false }

        // 直接调用MapSnapshotGenerator
        snapshot = await MapSnapshotGenerator.generateEventSnapshot(
            boundary: boundary,
            width: 800,
            height: 400
        )

        // 计算距离
        if let userLocation = LocationManager.shared.lastLocation,
           let coordinates = boundary.coordinates.first?.first,
           coordinates.count >= 2 {
            let boundaryLocation = CLLocation(
                latitude: coordinates[1],
                longitude: coordinates[0]
            )
            distance = formatDistance(userLocation.distance(from: boundaryLocation))
        }
    }

    private func formatDistance(_ meters: Double) -> String {
        meters < 1000 ? String(format: "%.0f m", meters) : String(format: "%.1f km", meters / 1000)
    }
}
```

#### 验收标准
- [ ] 地图快照生成成功(< 2秒)
- [ ] 距离计算准确
- [ ] 继承Metal崩溃修复
- [ ] 代码量减少60%

---

## 🔧 P1任务详细方案 (Week 3-4)

### Task #8: P1-1 信息架构优化 - iOS (1天,已调整)

**依赖**: Tasks #2, #4, #6, #7
**调整**: ✅ 改进EventCenterView,不创建新Tab

#### 实施清单

```swift
// 1. 改进EventCenterView (Profile Tab子页面)
// FunnyPixelsApp/Views/Events/EventCenterView.swift
struct EventCenterView: View {
    @EnvironmentObject var eventManager: EventManager
    @State private var selectedTab = 0
    @State private var activeEvents: [EventService.Event] = []
    @State private var myEvents: [EventService.UserEvent] = []
    @State private var endedEvents: [EventService.Event] = []

    // 新增: 计算即将开始的活动
    var upcomingEvents: [EventService.Event] {
        activeEvents.filter { $0.status == "published" }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 20) {
                    // 增强统计卡片 (添加upcoming计数)
                    StatsHeaderView(
                        participatedCount: myEvents.count,
                        activeCount: activeEvents.filter { $0.status == "active" }.count,
                        upcomingCount: upcomingEvents.count,  // 新增
                        completedCount: endedEvents.count
                    )

                    // 新增: Upcoming Section
                    if !upcomingEvents.isEmpty {
                        UpcomingEventsSection(events: upcomingEvents)
                    }

                    // 保留现有3个Tab
                    TabView(selection: $selectedTab) {
                        ActiveEventsTab(events: activeEvents.filter { $0.status == "active" })
                            .tag(0)
                        MyEventsTab(events: myEvents)
                            .tag(1)
                        EndedEventsTab(events: endedEvents)
                            .tag(2)
                    }
                    .frame(height: 500)
                }
            }
            .navigationTitle("活动中心")
            .refreshable {
                await loadData()
            }
        }
    }
}

// 2. 新增UpcomingEventCard (新建)
// FunnyPixelsApp/Views/Events/Components/UpcomingEventCard.swift
struct UpcomingEventCard: View {
    let event: EventService.Event
    @State private var signupStats: EventSignupStats?

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Banner
            AsyncImage(url: URL(string: event.bannerUrl ?? "")) { image in
                image.resizable()
            } placeholder: {
                Color.gray
            }
            .frame(height: 120)
            .cornerRadius(12)

            // 倒计时
            HStack {
                Image(systemName: "clock.fill")
                    .foregroundColor(.orange)
                CountdownText(endTime: event.startTime)
            }

            // 报名人数预览
            if let stats = signupStats {
                HStack {
                    Label("\(stats.allianceCount)联盟", systemImage: "flag.fill")
                    Label("~\(stats.estimatedParticipants)人", systemImage: "person.3.fill")
                }
                .font(.caption)
            }

            // 大按钮
            Button(action: { /* 跳转详情 */ }) {
                HStack {
                    Text("立即报名")
                    Image(systemName: "arrow.right")
                }
                .frame(maxWidth: .infinity)
                .padding()
                .background(Color.orange)
                .foregroundColor(.white)
                .cornerRadius(12)
            }
        }
        .task {
            signupStats = try? await EventService.shared.getSignupStats(event.id)
        }
    }
}

// 3. 可选: Profile快速入口
// FunnyPixelsApp/Views/Profile/ProfileTabView.swift
var body: some View {
    ScrollView {
        VStack(spacing: 20) {
            // 新增: 活动快速入口卡片(置顶)
            if !eventManager.activeEvents.isEmpty {
                EventQuickAccessCard(
                    activeCount: eventManager.activeEvents.filter { $0.status == "active" }.count,
                    upcomingCount: eventManager.activeEvents.filter { $0.status == "published" }.count
                )
                .onTapGesture {
                    showEventCenter = true
                }
            }

            // 原有内容...
        }
    }
}

struct EventQuickAccessCard: View {
    let activeCount: Int
    let upcomingCount: Int

    var body: some View {
        HStack {
            Image(systemName: "flag.2.crossed.fill")
                .font(.title).foregroundStyle(.orange)
            VStack(alignment: .leading) {
                Text("活动中心")
                HStack {
                    Label("\(activeCount)进行中", systemImage: "flame.fill")
                    if upcomingCount > 0 {
                        Label("\(upcomingCount)即将开始", systemImage: "clock.fill")
                            .foregroundColor(.orange)
                    }
                }
                .font(.caption)
            }
            Spacer()
            Image(systemName: "chevron.right")
        }
        .padding()
        .background(Color(.systemGray6))
        .cornerRadius(12)
    }
}
```

#### 验收标准
- [ ] Upcoming活动突出显示
- [ ] 保持5个主Tab
- [ ] 与现有代码无冲突
- [ ] 用户习惯不受影响

---

### 其他P1任务

**Task #9: 新手引导** (2天) - 无调整
**Task #10: 实时反馈** (1.5天) - 已调整,复用音效
**Task #11-12: 趋势分析** (3天) - 无调整
**Task #13: 排名通知** (1天) - 已调整,复用音效

详细实施方案见原文档,核心调整点已在上面体现。

---

## 📊 组件复用清单

### 完全复用 (无需修改)

| 组件 | 复用场景 |
|------|---------|
| EventService | 所有API调用 |
| SoundManager | 所有音效播放 |
| HapticManager | 所有触觉反馈 |
| MapSnapshotGenerator (现有方法) | 地图基础绘制 |
| EventCardView | 活动卡片展示 |
| EventRewardsView | 奖励展示 |

### 扩展复用 (添加方法/属性)

| 组件 | 扩展内容 |
|------|---------|
| EventManager | +3个@Published属性, +3个方法 |
| MapSnapshotGenerator | +1个public方法, +2个private方法 |
| EventCenterView | +UpcomingSection, +统计卡片增强 |
| EventDetailView | +4个新Section |

### 音效复用映射

| 场景 | 音效 | 文件 |
|------|------|------|
| 像素绘制 | pixelDraw | 已存在 |
| 普通里程碑 | success | 已存在 |
| 重大里程碑 | levelUp | 已存在 |
| 排名上升 | rankUp | 已存在 |
| 排名下降 | rankDown | 已存在 |
| 活动倒计时 | eventCountdown | 已存在 |

---

## ✅ 调整后的验收标准

### 功能验收
- [ ] P0功能100%完成 (报名统计/玩法说明/贡献统计/地图预览)
- [ ] P1功能100%完成 (信息架构/引导/反馈/趋势/通知)
- [ ] P2功能至少80%完成
- [ ] 所有关键路径UI测试通过

### 代码质量验收
- [ ] **代码复用率 ≥ 65%** (新增要求)
- [ ] 单元测试覆盖率 > 75%
- [ ] 无P0/P1级别Bug
- [ ] API响应时间 < 200ms (P95)
- [ ] **无重复音效文件** (新增要求)
- [ ] **Tab数量保持5个** (新增要求)

### 性能验收
- [ ] 地图快照生成 < 2秒
- [ ] EventManager单例无内存泄漏
- [ ] 音效播放无延迟

---

## 🚀 立即开始

### 第一周任务 (可并行)

**后端团队:**
- [ ] Task #1: 报名统计API (1.5天)
- [ ] Task #3: 玩法模板 (1天)
- [ ] Task #5: 贡献统计API (2天)

**iOS团队:**
- [ ] Task #7: 地图预览 (1天) - 独立,可先开始

### 关键文件清单

**需要修改的现有文件:**
1. `EventManager.swift` - 添加贡献追踪
2. `MapSnapshotGenerator.swift` - 添加boundary绘制
3. `EventCenterView.swift` - 添加Upcoming Section
4. `EventDetailView.swift` - 集成新组件

**需要新建的文件:**
1. `EventSignupStats.swift`
2. `EventContribution.swift`
3. `EventGameplay.swift`
4. `EventSignupStatsView.swift`
5. `EventGameplayView.swift`
6. `EventContributionCard.swift`
7. `EventMapPreview.swift`
8. `UpcomingEventCard.swift`

**不需要的文件 (调整后取消):**
- ~~EventTabView.swift~~ (改用现有EventCenterView)
- ~~EventTabViewModel.swift~~
- ~~milestone_reached.m4a~~ (复用success/levelUp)
- ~~rank_up.m4a / rank_down.m4a~~ (已存在)

---

## 📈 预期收益 (不变)

| 指标 | 目标 |
|------|------|
| 活动参与率 | +40-60% |
| 参与时长 | +75% |
| 完成率 | +62% |
| 新手转化率 | +83% |
| 分享率 | +300% |

---

**文档状态**: ✅ 最终版,已确认
**下次更新**: 实施完成后
**联系人**: 项目负责人

开始实施吧! 🚀
