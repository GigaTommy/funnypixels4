# 赛事活动模块完善方案

**日期**: 2026-02-23
**状态**: 📋 规划中

---

## 🔍 当前问题分析

### 1. 信息冗余

**问题**: 奖励信息重复显示
- ❌ **位置1**: 底部 `rewardsTeaser` 卡片（Line 268-296）
- ❌ **位置2**: 右上角 toolbar 奖励按钮（Line 74-78）
- 🔄 两者都打开同一个 `EventRewardsView`

**影响**:
- 用户困惑：不知道点击哪个
- UI 拥挤：toolbar 图标过多
- 信息重复：违反简洁原则

### 2. 缺失的关键信息

#### 活动区域信息
- ❌ 没有地图显示活动区域边界
- ❌ 没有活动中心位置
- ❌ 没有活动半径/范围
- ❌ 没有活动地点名称

#### 参赛用户信息
- ❌ 没有参与用户列表
- ❌ 没有实时排名
- ❌ 没有联盟参与情况
- ❌ 没有热门参与者

#### 活动详细信息
- ❌ 没有活动描述
- ❌ 没有活动要求（最低等级、最少人数等）
- ❌ 没有倒计时显示
- ❌ 没有活动进度指示

### 3. 信息层次不够清晰

**当前结构**:
```
1. Header (Banner)
2. Status & Action (报名按钮)
3. Info Grid (时间、规则)
4. Rewards Teaser (奖励预告)
5. Signup Stats (报名统计)
6. Gameplay (玩法说明)
7. User Contribution (个人贡献)
```

**问题**:
- 信息流不够流畅
- 缺少优先级区分
- 重要信息不够突出

---

## ✅ 改进方案

### 阶段1: 移除冗余 ⚡️

**目标**: 消除重复信息，优化UI

**变更**:
1. ❌ **移除**: Toolbar 右上角奖励按钮
2. ✅ **保留**: 底部 rewardsTeaser 卡片
3. ✅ **原因**: 卡片提供更好的上下文，符合浏览流程

**代码改动**:
```swift
// EventDetailView.swift
// 删除 Line 73-79 的 toolbar 配置
.toolbar {
    // ❌ 移除奖励按钮
}
```

### 阶段2: 添加活动区域信息 🗺️

**新增组件**: `EventLocationCard`

**显示内容**:
- ✅ 地图预览（显示活动区域圈）
- ✅ 活动地点名称
- ✅ 活动中心坐标
- ✅ 活动半径
- ✅ 用户距离活动中心的距离
- ✅ "在地图中查看"按钮

**UI 设计**:
```
┌─────────────────────────────────────┐
│  📍 活动区域                         │
│  ┌─────────────────────────────────┐│
│  │                                 ││
│  │      [地图缩略图]               ││
│  │    显示圆形活动区域              ││
│  │                                 ││
│  └─────────────────────────────────┘│
│  广东工业大学东风路校区              │
│  📍 中心: 23.1489, 113.3376         │
│  📏 半径: 800米                     │
│  📌 距离你: 1.2公里                 │
│  [在地图中查看 >]                    │
└─────────────────────────────────────┘
```

**技术实现**:
- 使用 MapKit 显示地图
- 绘制 Circle Overlay 显示活动区域
- 计算用户当前位置到活动中心的距离

### 阶段3: 添加参赛信息 👥

**新增组件**: `EventParticipantsCard`

**显示内容**:
- ✅ 参与人数统计
- ✅ 联盟参与列表（前5名）
- ✅ 热门参与者（可选）
- ✅ 查看全部参与者按钮

**UI 设计**:
```
┌─────────────────────────────────────┐
│  👥 参赛情况                         │
│  ┌─────────────────────────────────┐│
│  │ 👤 个人报名: 125人              ││
│  │ 🏴 联盟报名: 8个                ││
│  │ 📊 总参与人数: 342人            ││
│  └─────────────────────────────────┘│
│                                      │
│  参赛联盟:                           │
│  🏴 联盟A (45人)                     │
│  🏴 联盟B (38人)                     │
│  🏴 联盟C (32人)                     │
│  ...                                 │
│  [查看全部参与者 >]                  │
└─────────────────────────────────────┘
```

### 阶段4: 添加实时排名 🏆

**新增组件**: `EventLiveRankingsCard`

**显示内容**:
- ✅ 实时排名（前3名）
- ✅ 分数/像素数
- ✅ 进度条显示
- ✅ 查看完整排行榜按钮

**UI 设计**:
```
┌─────────────────────────────────────┐
│  🏆 实时排名                         │
│  1. 🥇 联盟A     ████████░  1,234   │
│  2. 🥈 联盟B     ██████░░░    856   │
│  3. 🥉 联盟C     ████░░░░░    623   │
│                                      │
│  更新于: 2分钟前                     │
│  [查看完整排行榜 >]                  │
└─────────────────────────────────────┘
```

### 阶段5: 添加活动要求 📋

**新增组件**: `EventRequirementsCard`

**显示内容**:
- ✅ 最低等级要求
- ✅ 最少联盟数
- ✅ 最少参与人数
- ✅ 用户是否满足条件

**UI 设计**:
```
┌─────────────────────────────────────┐
│  📋 参与要求                         │
│  ✅ 等级要求: Lv.1+                  │
│  ✅ 联盟要求: 至少2个联盟参与        │
│  ✅ 人数要求: 至少5人参与            │
│                                      │
│  ✅ 你已满足所有要求                 │
└─────────────────────────────────────┘
```

### 阶段6: 添加倒计时 ⏱️

**新增组件**: `EventCountdownCard`

**显示内容**:
- ✅ 距离开始/结束的倒计时
- ✅ 活动进度条
- ✅ 阶段提示（预热/进行中/即将结束）

**UI 设计**:
```
┌─────────────────────────────────────┐
│  ⏱️ 距离开始                         │
│  02天 14时 32分 18秒                 │
│  ▓▓▓▓▓░░░░░░░░░░░░░░░  25%          │
│  🔔 预热期 - 可以报名                │
└─────────────────────────────────────┘
```

---

## 🎨 优化后的信息结构

### 新的展示顺序

```
1. 📸 Header (Banner + Title)
   └─ 活动标题、状态标签

2. ⏱️ Countdown Card (倒计时)
   └─ 距离开始/结束的倒计时
   └─ 活动进度条

3. 📝 Description (活动描述)
   └─ 活动介绍文字
   └─ 活动类型

4. 🗺️ Location Card (活动区域)
   └─ 地图预览
   └─ 地点名称、半径、距离

5. 📋 Requirements (活动要求)
   └─ 等级、联盟、人数要求
   └─ 用户满足情况

6. ✅ Status & Action (状态与操作)
   └─ 报名按钮 / 已报名提示

7. 👥 Participants (参赛情况)
   └─ 报名统计
   └─ 参与联盟列表

8. 🏆 Live Rankings (实时排名)
   └─ 前3名排名
   └─ 查看完整榜单

9. 📖 Gameplay (玩法说明)
   └─ 活动规则
   └─ 玩法提示

10. 🎁 Rewards (奖励说明)
    └─ 奖励预览
    └─ 查看详细奖励

11. 📊 User Contribution (个人贡献)
    └─ 仅已报名用户可见
    └─ 个人统计数据
```

### 信息优先级

**P0 - 核心信息** (所有用户必看):
- 活动标题、状态
- 倒计时
- 活动区域
- 报名按钮

**P1 - 重要信息** (决策相关):
- 活动要求
- 参赛情况
- 奖励说明
- 玩法规则

**P2 - 增强信息** (已参与用户):
- 实时排名
- 个人贡献
- 详细统计

---

## 📂 新增文件

### 1. EventLocationCard.swift
```swift
struct EventLocationCard: View {
    let event: EventService.Event
    @State private var userLocation: CLLocationCoordinate2D?

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            // 标题
            HStack {
                Image(systemName: "map.fill")
                Text("活动区域")
                    .font(.headline)
            }

            // 地图预览
            if let area = event.config?.area {
                EventMapPreview(area: area)
                    .frame(height: 150)
                    .cornerRadius(8)

                // 详细信息
                VStack(alignment: .leading, spacing: 6) {
                    if let name = area.name {
                        HStack {
                            Image(systemName: "mappin.circle.fill")
                            Text(name)
                                .font(.subheadline)
                        }
                    }

                    if let center = area.center {
                        HStack {
                            Image(systemName: "location.fill")
                            Text("中心: \(center.lat), \(center.lng)")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                    }

                    if let radius = area.radius {
                        HStack {
                            Image(systemName: "ruler.fill")
                            Text("半径: \(radius)米")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                    }

                    // 用户距离
                    if let userLoc = userLocation,
                       let center = area.center {
                        let distance = calculateDistance(
                            from: userLoc,
                            to: CLLocationCoordinate2D(
                                latitude: center.lat,
                                longitude: center.lng
                            )
                        )
                        HStack {
                            Image(systemName: "figure.walk")
                            Text("距离你: \(formatDistance(distance))")
                                .font(.caption)
                                .foregroundColor(.blue)
                        }
                    }
                }

                // 在地图中查看按钮
                Button(action: {
                    // 打开完整地图视图
                }) {
                    HStack {
                        Text("在地图中查看")
                        Image(systemName: "arrow.right")
                    }
                    .font(.caption)
                    .foregroundColor(.blue)
                }
            }
        }
        .padding()
        .background(Color(uiColor: .secondarySystemGroupedBackground))
        .cornerRadius(12)
    }
}
```

### 2. EventMapPreview.swift
```swift
import MapKit

struct EventMapPreview: View {
    let area: EventService.EventArea
    @State private var region: MKCoordinateRegion

    init(area: EventService.EventArea) {
        self.area = area

        // 设置地图中心和缩放级别
        if let center = area.center {
            _region = State(initialValue: MKCoordinateRegion(
                center: CLLocationCoordinate2D(
                    latitude: center.lat,
                    longitude: center.lng
                ),
                span: MKCoordinateSpan(
                    latitudeDelta: 0.02,
                    longitudeDelta: 0.02
                )
            ))
        } else {
            _region = State(initialValue: MKCoordinateRegion())
        }
    }

    var body: some View {
        Map(coordinateRegion: $region, annotationItems: [area]) { area in
            MapAnnotation(coordinate: CLLocationCoordinate2D(
                latitude: area.center?.lat ?? 0,
                longitude: area.center?.lng ?? 0
            )) {
                // 活动区域标记
                ZStack {
                    Circle()
                        .stroke(Color.blue, lineWidth: 2)
                        .frame(width: 100, height: 100)
                    Circle()
                        .fill(Color.blue.opacity(0.2))
                        .frame(width: 100, height: 100)
                    Image(systemName: "flag.fill")
                        .foregroundColor(.blue)
                }
            }
        }
        .disabled(true) // 预览模式，不可交互
    }
}
```

### 3. EventCountdownCard.swift
```swift
struct EventCountdownCard: View {
    let event: EventService.Event
    @State private var timeRemaining: TimeInterval = 0
    @State private var timer: Timer?

    var body: some View {
        VStack(spacing: 12) {
            HStack {
                Image(systemName: "clock.fill")
                Text(countdownTitle)
                    .font(.headline)
                Spacer()
            }

            // 倒计时显示
            Text(formatTimeRemaining(timeRemaining))
                .font(.system(size: 32, weight: .bold, design: .rounded))
                .foregroundColor(.blue)

            // 进度条
            GeometryReader { geometry in
                ZStack(alignment: .leading) {
                    Rectangle()
                        .fill(Color.gray.opacity(0.2))
                        .frame(height: 8)
                        .cornerRadius(4)

                    Rectangle()
                        .fill(Color.blue)
                        .frame(width: geometry.size.width * eventProgress, height: 8)
                        .cornerRadius(4)
                }
            }
            .frame(height: 8)

            // 阶段提示
            HStack {
                Image(systemName: phaseIcon)
                Text(phaseText)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
        .padding()
        .background(Color(uiColor: .secondarySystemGroupedBackground))
        .cornerRadius(12)
        .onAppear {
            startTimer()
        }
        .onDisappear {
            timer?.invalidate()
        }
    }

    // ... 辅助方法
}
```

### 4. EventParticipantsCard.swift
```swift
struct EventParticipantsCard: View {
    let stats: EventSignupStats

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: "person.3.fill")
                Text("参赛情况")
                    .font(.headline)
            }

            // 统计信息
            HStack(spacing: 16) {
                StatItem(
                    icon: "person.fill",
                    label: "个人报名",
                    value: "\(stats.userSignups)人"
                )
                StatItem(
                    icon: "flag.fill",
                    label: "联盟报名",
                    value: "\(stats.allianceSignups)个"
                )
                StatItem(
                    icon: "chart.bar.fill",
                    label: "总参与",
                    value: "\(stats.totalParticipants)人"
                )
            }

            // 参赛联盟列表
            if !stats.topAlliances.isEmpty {
                Divider()

                Text("参赛联盟")
                    .font(.subheadline)
                    .foregroundColor(.secondary)

                ForEach(stats.topAlliances.prefix(5)) { alliance in
                    AllianceRow(alliance: alliance)
                }

                if stats.topAlliances.count > 5 {
                    Button("查看全部参与者") {
                        // 打开参与者列表
                    }
                    .font(.caption)
                    .foregroundColor(.blue)
                }
            }
        }
        .padding()
        .background(Color(uiColor: .secondarySystemGroupedBackground))
        .cornerRadius(12)
    }
}
```

---

## 🔄 修改现有文件

### EventDetailView.swift

**主要变更**:
1. 移除 toolbar 奖励按钮
2. 添加新的卡片组件
3. 重新组织信息顺序
4. 优化布局和间距

**新的 body 结构**:
```swift
var body: some View {
    ScrollView {
        VStack(spacing: 16) {
            // 1. Header
            headerView

            // 2. Countdown
            EventCountdownCard(event: event)
                .padding(.horizontal)

            // 3. Description (如果有)
            if let description = event.description {
                DescriptionCard(text: description)
                    .padding(.horizontal)
            }

            // 4. Location
            EventLocationCard(event: event)
                .padding(.horizontal)

            // 5. Requirements
            if let requirements = event.config?.requirements {
                EventRequirementsCard(requirements: requirements)
                    .padding(.horizontal)
            }

            // 6. Status & Action
            statusSection
                .padding(.horizontal)

            // 7. Participants
            if let stats = signupStats {
                EventParticipantsCard(stats: stats)
                    .padding(.horizontal)
            }

            // 8. Live Rankings
            if event.status == "active" {
                EventLiveRankingsCard(eventId: event.id)
                    .padding(.horizontal)
            }

            // 9. Gameplay
            if let gameplay = event.gameplay {
                EventGameplayView(gameplay: gameplay)
                    .padding(.horizontal)
            }

            // 10. Rewards
            rewardsTeaser
                .padding(.horizontal)

            // 11. User Contribution
            if let status = userStatus, status.signedUp,
               let contribution = userContribution {
                EventContributionCard(contribution: contribution)
                    .padding(.horizontal)
            }
        }
        .padding(.bottom, 32)
    }
    // 移除 .toolbar { ... }
}
```

---

## 🎯 实施优先级

### Phase 1 (高优先级) - 立即实施
1. ✅ **移除冗余** - 删除 toolbar 奖励按钮
2. ✅ **添加倒计时** - EventCountdownCard
3. ✅ **添加活动区域** - EventLocationCard
4. ✅ **添加活动要求** - EventRequirementsCard

### Phase 2 (中优先级) - 本周完成
5. ✅ **优化参赛信息** - 扩展 EventParticipantsCard
6. ✅ **添加实时排名** - EventLiveRankingsCard
7. ✅ **重组信息结构** - 优化展示顺序

### Phase 3 (低优先级) - 后续优化
8. ⏳ **完整地图视图** - 可交互的地图页面
9. ⏳ **参与者列表** - 查看所有参与者
10. ⏳ **活动历史** - 过往活动记录

---

## 📊 预期效果

### 用户体验提升

**改进前**:
- ❌ 信息冗余，不知道点击哪个
- ❌ 缺少关键信息，不知道活动在哪里
- ❌ 看不到参与情况，没有参与感

**改进后**:
- ✅ 信息清晰，一目了然
- ✅ 活动位置清楚，可以直接看到
- ✅ 参与情况透明，增强参与动机
- ✅ 倒计时营造紧迫感

### 信息完整性

| 信息类别 | 改进前 | 改进后 |
|---------|--------|--------|
| 活动区域 | ❌ | ✅ 地图+详细信息 |
| 参赛情况 | ⚠️ 基础统计 | ✅ 详细统计+列表 |
| 实时排名 | ❌ | ✅ Top 3 实时更新 |
| 活动要求 | ❌ | ✅ 完整要求+满足状态 |
| 倒计时 | ❌ | ✅ 实时倒计时+进度 |
| 奖励信息 | ✅ | ✅ 优化展示位置 |

---

## ✅ 验收标准

### 功能完整性
- ✅ 显示活动区域地图
- ✅ 显示活动要求和用户满足情况
- ✅ 显示参赛统计和参与者列表
- ✅ 显示实时倒计时
- ✅ 移除重复的奖励入口

### 用户体验
- ✅ 信息层次清晰，易于浏览
- ✅ 核心信息突出，决策便捷
- ✅ 实时更新，数据准确
- ✅ 性能流畅，加载迅速

### 代码质量
- ✅ 组件化设计，可复用
- ✅ 代码规范，易于维护
- ✅ 注释完整，易于理解

---

**状态**: 📋 方案已制定，等待实施
**预计完成时间**: Phase 1 - 今天完成，Phase 2 - 本周完成
