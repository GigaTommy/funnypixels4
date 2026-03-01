# FunnyPixels 活动模块完整优化方案

**文档版本**: v1.0
**创建日期**: 2026-02-22
**预计实施周期**: 4-6周
**预期效果**: 活动参与率提升40-60%,用户留存率提升30-50%

---

## 目录

1. [优化目标](#优化目标)
2. [问题清单与优先级](#问题清单与优先级)
3. [P0优化方案详细设计](#p0优化方案详细设计)
4. [P1优化方案详细设计](#p1优化方案详细设计)
5. [数据库变更方案](#数据库变更方案)
6. [API设计方案](#api设计方案)
7. [前端实现方案](#前端实现方案)
8. [实施路线图](#实施路线图)
9. [测试计划](#测试计划)
10. [风险评估](#风险评估)

---

## 优化目标

### 核心KPI提升目标

| 指标 | 当前值(估算) | 目标值 | 提升幅度 |
|------|------------|--------|---------|
| 活动参与率 | 15-20% | 25-35% | +40-60% |
| 单次活动平均参与时长 | 20分钟 | 35分钟 | +75% |
| 活动完成率(参与到结束) | 40% | 65% | +62% |
| 活动分享率 | <5% | 20% | +300% |
| 新手首次参与转化率 | 30% | 55% | +83% |
| 7日留存率(活动后) | 45% | 65% | +44% |

### 用户体验提升目标

- **信息透明度**: 从2星提升到4星
- **决策支持**: 从无到完善
- **过程反馈**: 从3星提升到5星
- **新手友好度**: 从2星提升到4星
- **社交传播**: 从1星提升到4星

---

## 问题清单与优先级

### P0 - 严重影响,必须修复 (第1-2周)

| ID | 问题 | 影响 | 工作量 | 负责模块 |
|----|------|------|--------|---------|
| P0-1 | 报名数据完全不透明 | ⭐⭐⭐⭐⭐ | 3天 | 后端+前端 |
| P0-2 | 活动玩法说明缺失 | ⭐⭐⭐⭐⭐ | 2天 | 后端+前端 |
| P0-3 | 个人贡献统计缺失 | ⭐⭐⭐⭐⭐ | 3天 | 后端+前端 |
| P0-4 | 活动区域地图预览缺失 | ⭐⭐⭐⭐☆ | 2天 | 前端 |

**P0总工作量**: 10天

### P1 - 重要改进,显著提升体验 (第3-4周)

| ID | 问题 | 影响 | 工作量 | 负责模块 |
|----|------|------|--------|---------|
| P1-1 | 活动信息架构混乱 | ⭐⭐⭐⭐☆ | 2天 | 前端 |
| P1-2 | 新手引导流程缺失 | ⭐⭐⭐⭐☆ | 4天 | 前端 |
| P1-3 | 实时贡献反馈缺失 | ⭐⭐⭐⭐☆ | 3天 | 前端 |
| P1-4 | 历史趋势分析缺失 | ⭐⭐⭐☆☆ | 5天 | 后端+前端 |
| P1-5 | 排名变化通知缺失 | ⭐⭐⭐☆☆ | 2天 | 前端 |

**P1总工作量**: 16天

### P2 - 优化体验 (第5-6周)

| ID | 问题 | 影响 | 工作量 | 负责模块 |
|----|------|------|--------|---------|
| P2-1 | 社交分享功能薄弱 | ⭐⭐⭐☆☆ | 5天 | 后端+前端 |
| P2-2 | 活动难度评级缺失 | ⭐⭐⭐☆☆ | 3天 | 后端+前端 |
| P2-3 | 离线缓存支持缺失 | ⭐⭐☆☆☆ | 3天 | 前端 |
| P2-4 | 省电模式缺失 | ⭐⭐⭐☆☆ | 2天 | 前端 |
| P2-5 | 准入条件不明确 | ⭐⭐⭐☆☆ | 2天 | 后端+前端 |

**P2总工作量**: 15天

**总计**: 41天 (约2个月,2-3人并行开发可在1.5个月内完成)

---

## P0优化方案详细设计

### P0-1: 报名数据透明化

#### 问题描述
当前玩家在报名活动前看不到任何关于活动热度的信息,无法判断:
- 有多少人/联盟已经报名
- 各联盟的实力对比
- 自己的获胜概率
- 活动是否会因人数不足而取消

#### 解决方案

**1. 后端实现**

新增API端点:
```javascript
// backend/src/controllers/eventController.js

/**
 * GET /api/events/:id/signup-stats
 * 获取活动报名统计信息
 */
async function getEventSignupStats(req, res) {
  const { id: eventId } = req.params;

  try {
    const event = await knex('events').where({ id: eventId }).first();
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // 1. 统计总报名数
    const participantStats = await knex('event_participants')
      .where({ event_id: eventId })
      .select('participant_type')
      .count('* as count')
      .groupBy('participant_type');

    const allianceCount = participantStats.find(s => s.participant_type === 'alliance')?.count || 0;
    const userCount = participantStats.find(s => s.participant_type === 'user')?.count || 0;

    // 2. 获取已报名的联盟详情(Top 10)
    const topAlliances = await knex('event_participants as ep')
      .where({
        'ep.event_id': eventId,
        'ep.participant_type': 'alliance'
      })
      .join('alliances as a', 'ep.participant_id', 'a.id')
      .leftJoin('alliance_members as am', 'a.id', 'am.alliance_id')
      .select(
        'a.id',
        'a.name',
        'a.color',
        'a.level',
        knex.raw('COUNT(DISTINCT am.user_id) as member_count'),
        knex.raw('COALESCE(SUM(u.total_pixels), 0) as total_power')
      )
      .leftJoin('users as u', 'am.user_id', 'u.id')
      .groupBy('a.id', 'a.name', 'a.color', 'a.level')
      .orderBy('total_power', 'desc')
      .limit(10);

    // 3. 估算参与人数
    const avgAllianceSize = topAlliances.length > 0
      ? Math.round(topAlliances.reduce((sum, a) => sum + parseInt(a.member_count), 0) / topAlliances.length)
      : 15;

    const estimatedParticipants = (allianceCount * avgAllianceSize) + parseInt(userCount);

    // 4. 计算平均联盟战力
    const avgAlliancePower = topAlliances.length > 0
      ? Math.round(topAlliances.reduce((sum, a) => sum + parseInt(a.total_power), 0) / topAlliances.length)
      : 0;

    // 5. 检查是否满足最小参与人数
    const minParticipants = event.config?.rules?.minParticipants || 0;
    const meetsMinimum = estimatedParticipants >= minParticipants;

    return res.json({
      allianceCount: parseInt(allianceCount),
      userCount: parseInt(userCount),
      estimatedParticipants,
      avgAlliancePower,
      avgAllianceSize,
      topAlliances: topAlliances.map(a => ({
        id: a.id,
        name: a.name,
        color: a.color,
        level: a.level,
        memberCount: parseInt(a.member_count),
        totalPower: parseInt(a.total_power)
      })),
      requirements: {
        minParticipants,
        meetsMinimum,
        shortfall: meetsMinimum ? 0 : minParticipants - estimatedParticipants
      }
    });
  } catch (error) {
    logger.error('Error fetching signup stats:', error);
    return res.status(500).json({ error: 'Failed to fetch signup stats' });
  }
}

module.exports = {
  // ... existing exports
  getEventSignupStats
};
```

路由配置:
```javascript
// backend/src/routes/eventRoutes.js
router.get('/:id/signup-stats', eventController.getEventSignupStats);
```

**2. iOS前端实现**

数据模型:
```swift
// FunnyPixelsApp/FunnyPixelsApp/Models/EventSignupStats.swift

struct EventSignupStats: Codable {
    let allianceCount: Int
    let userCount: Int
    let estimatedParticipants: Int
    let avgAlliancePower: Int
    let avgAllianceSize: Int
    let topAlliances: [TopAlliance]
    let requirements: Requirements

    struct TopAlliance: Codable, Identifiable {
        let id: String
        let name: String
        let color: String
        let level: Int
        let memberCount: Int
        let totalPower: Int
    }

    struct Requirements: Codable {
        let minParticipants: Int
        let meetsMinimum: Bool
        let shortfall: Int
    }
}
```

Service层:
```swift
// FunnyPixelsApp/FunnyPixelsApp/Services/API/EventService.swift

extension EventService {
    func getSignupStats(_ eventId: String) async throws -> EventSignupStats {
        let endpoint = "/api/events/\(eventId)/signup-stats"
        return try await apiManager.request(endpoint: endpoint, method: "GET")
    }
}
```

UI组件:
```swift
// FunnyPixelsApp/FunnyPixelsApp/Views/Events/Components/EventSignupStatsView.swift

import SwiftUI

struct EventSignupStatsView: View {
    let stats: EventSignupStats
    let event: EventService.Event

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            // 标题
            Text("activity_heat".localized())
                .font(.headline)

            // 统计卡片
            HStack(spacing: 12) {
                StatCard(
                    icon: "flag.2.crossed.fill",
                    value: "\(stats.allianceCount)",
                    label: "event.stats.alliances".localized(),
                    color: .blue
                )

                StatCard(
                    icon: "person.3.fill",
                    value: "~\(stats.estimatedParticipants)",
                    label: "event.stats.participants".localized(),
                    color: .green
                )

                StatCard(
                    icon: "chart.bar.fill",
                    value: "\(stats.avgAlliancePower)",
                    label: "event.stats.avg_power".localized(),
                    color: .orange
                )
            }

            // 最小人数要求提示
            if !stats.requirements.meetsMinimum {
                HStack(spacing: 8) {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .foregroundColor(.orange)
                    VStack(alignment: .leading, spacing: 2) {
                        Text("event.warning.min_participants".localized())
                            .font(.subheadline)
                            .bold()
                        Text("event.warning.need_more".localized(stats.requirements.shortfall))
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }
                .padding(12)
                .background(Color.orange.opacity(0.1))
                .cornerRadius(8)
            }

            // 已报名联盟列表
            if !stats.topAlliances.isEmpty {
                VStack(alignment: .leading, spacing: 12) {
                    HStack {
                        Text("event.registered_alliances".localized())
                            .font(.subheadline)
                            .bold()
                        Spacer()
                        Text("event.top_n".localized(min(stats.topAlliances.count, 10)))
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }

                    ForEach(stats.topAlliances.prefix(5)) { alliance in
                        AllianceSignupRow(alliance: alliance)
                    }

                    if stats.topAlliances.count > 5 {
                        Button(action: { showAllAlliances = true }) {
                            HStack {
                                Text("event.show_all_alliances".localized())
                                Spacer()
                                Image(systemName: "chevron.right")
                            }
                            .font(.subheadline)
                            .foregroundColor(.blue)
                        }
                    }
                }
            }
        }
        .padding(16)
        .background(Color(.systemBackground))
        .cornerRadius(12)
        .shadow(radius: 2)
    }

    @State private var showAllAlliances = false
}

struct StatCard: View {
    let icon: String
    let value: String
    let label: String
    let color: Color

    var body: some View {
        VStack(spacing: 8) {
            Image(systemName: icon)
                .font(.title2)
                .foregroundColor(color)

            Text(value)
                .font(.title3)
                .bold()

            Text(label)
                .font(.caption2)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 12)
        .background(color.opacity(0.1))
        .cornerRadius(8)
    }
}

struct AllianceSignupRow: View {
    let alliance: EventSignupStats.TopAlliance

    var body: some View {
        HStack(spacing: 12) {
            // 联盟颜色标识
            Circle()
                .fill(Color(hex: alliance.color) ?? .gray)
                .frame(width: 32, height: 32)
                .overlay(
                    Text("Lv\(alliance.level)")
                        .font(.system(size: 8, weight: .bold))
                        .foregroundColor(.white)
                )

            // 联盟信息
            VStack(alignment: .leading, spacing: 2) {
                Text(alliance.name)
                    .font(.subheadline)
                    .bold()

                HStack(spacing: 12) {
                    Label("\(alliance.memberCount)", systemImage: "person.fill")
                    Label("\(alliance.totalPower)", systemImage: "bolt.fill")
                }
                .font(.caption)
                .foregroundColor(.secondary)
            }

            Spacer()

            // 战力等级指示器
            PowerLevelBadge(power: alliance.totalPower)
        }
        .padding(8)
        .background(Color(.systemGray6))
        .cornerRadius(8)
    }
}

struct PowerLevelBadge: View {
    let power: Int

    var level: String {
        if power > 100000 { return "S" }
        if power > 50000 { return "A" }
        if power > 20000 { return "B" }
        if power > 5000 { return "C" }
        return "D"
    }

    var color: Color {
        switch level {
        case "S": return .red
        case "A": return .orange
        case "B": return .yellow
        case "C": return .green
        default: return .gray
        }
    }

    var body: some View {
        Text(level)
            .font(.caption)
            .bold()
            .foregroundColor(.white)
            .frame(width: 24, height: 24)
            .background(color)
            .clipShape(Circle())
    }
}
```

**3. 本地化字符串**

```json
// FunnyPixelsApp/FunnyPixelsApp/Resources/en.lproj/Localizable.strings
"activity_heat" = "Activity Heat";
"event.stats.alliances" = "Alliances";
"event.stats.participants" = "Expected\nParticipants";
"event.stats.avg_power" = "Avg\nPower";
"event.warning.min_participants" = "Minimum participants not met";
"event.warning.need_more" = "Need %d more participants";
"event.registered_alliances" = "Registered Alliances";
"event.top_n" = "Top %d";
"event.show_all_alliances" = "Show All";

// FunnyPixelsApp/FunnyPixelsApp/Resources/zh-Hans.lproj/Localizable.strings
"activity_heat" = "活动热度";
"event.stats.alliances" = "参赛联盟";
"event.stats.participants" = "预计\n参与人数";
"event.stats.avg_power" = "平均\n战力";
"event.warning.min_participants" = "未达到最低参与人数";
"event.warning.need_more" = "还需要 %d 人";
"event.registered_alliances" = "已报名联盟";
"event.top_n" = "前 %d 名";
"event.show_all_alliances" = "查看全部";
```

**4. 集成到EventDetailView**

```swift
// FunnyPixelsApp/FunnyPixelsApp/Views/Events/EventDetailView.swift

struct EventDetailView: View {
    let event: EventService.Event

    @State private var signupStats: EventSignupStats?
    @State private var isLoadingStats = false

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                // ... existing header

                // 新增: 报名统计区块 (在报名按钮之前)
                if let stats = signupStats {
                    EventSignupStatsView(stats: stats, event: event)
                        .padding(.horizontal)
                } else if isLoadingStats {
                    ProgressView()
                        .padding()
                }

                // ... existing content
            }
        }
        .task {
            await loadSignupStats()
        }
    }

    private func loadSignupStats() async {
        isLoadingStats = true
        defer { isLoadingStats = false }

        do {
            signupStats = try await EventService.shared.getSignupStats(event.id)
        } catch {
            logger.error("Failed to load signup stats: \(error)")
        }
    }
}
```

#### 预期效果
- 玩家可以看到活动的真实热度
- 可以评估自己联盟的竞争力
- 减少盲目报名,提高参与质量
- **预计报名转化率提升25-35%**

---

### P0-2: 活动玩法说明

#### 问题描述
新手不知道不同类型活动的玩法规则、计分方式、获胜技巧,导致:
- 不敢报名参与
- 报名后不知道如何参与
- 参与后策略错误

#### 解决方案

**1. 数据库变更**

```sql
-- backend/src/database/migrations/20260223000000_add_event_gameplay.js

exports.up = function(knex) {
  return knex.schema.table('events', table => {
    table.jsonb('gameplay').comment('Gameplay instructions and tips');
  });
};

exports.down = function(knex) {
  return knex.schema.table('events', table => {
    table.dropColumn('gameplay');
  });
};
```

**2. 后端更新**

创建玩法配置模板:
```javascript
// backend/src/constants/eventGameplayTemplates.js

const GAMEPLAY_TEMPLATES = {
  territory_control: {
    objective: {
      en: "Capture and hold the most territory by drawing continuous pixels",
      zh: "通过绘制连续的像素占领并保持最多的领地",
      ja: "連続したピクセルを描くことで最も多くの領土を獲得し保持する"
    },
    scoringRules: {
      en: [
        "Each pixel contributes points based on how long it's held",
        "Continuous same-color pixels form territories",
        "Larger territories accumulate points faster",
        "Pixels can be overwritten by other alliances"
      ],
      zh: [
        "每个像素根据持有时长累计积分",
        "连续的同色像素形成领地",
        "领地越大,积分增长越快",
        "像素可能被其他联盟覆盖"
      ],
      ja: [
        "各ピクセルは保持時間に基づいてポイントを獲得",
        "連続した同色ピクセルが領土を形成",
        "領土が大きいほどポイントが速く蓄積",
        "ピクセルは他の同盟に上書きされる可能性がある"
      ]
    },
    tips: {
      en: [
        "Focus on central areas for better defense",
        "Coordinate with teammates to draw continuous areas",
        "Regularly patrol to defend against overwrites",
        "Build buffer zones around key territories"
      ],
      zh: [
        "优先占领中心区域便于防守",
        "与队友协调绘制连续区域",
        "定期巡查防止被覆盖",
        "在关键领地周围建立缓冲区"
      ],
      ja: [
        "防御しやすい中心エリアに集中",
        "チームメイトと協力して連続エリアを描く",
        "定期的にパトロールして上書きを防ぐ",
        "重要な領土の周りにバッファゾーンを構築"
      ]
    },
    difficulty: "medium",
    timeCommitment: "2-3 hours/day",
    recommendedFor: ["alliances", "active_players"]
  },

  leaderboard: {
    objective: {
      en: "Draw the most pixels within the event area to top the leaderboard",
      zh: "在活动区域内绘制最多像素以登顶排行榜",
      ja: "イベントエリア内で最も多くのピクセルを描いてリーダーボードのトップに"
    },
    scoringRules: {
      en: [
        "Each pixel drawn counts as 1 point",
        "Only pixels within event boundaries count",
        "Overwriting your own pixels doesn't add points",
        "Alliance scores = sum of all member pixels"
      ],
      zh: [
        "每个绘制的像素计1分",
        "只有活动边界内的像素计分",
        "覆盖自己的像素不增加分数",
        "联盟积分 = 所有成员像素之和"
      ],
      ja: [
        "描いたピクセルごとに1ポイント",
        "イベント境界内のピクセルのみカウント",
        "自分のピクセルを上書きしてもポイントは追加されない",
        "同盟スコア = 全メンバーのピクセルの合計"
      ]
    },
    tips: {
      en: [
        "Focus on quantity over quality",
        "Fill large areas efficiently",
        "Avoid redrawing same pixels",
        "Mobilize all alliance members"
      ],
      zh: [
        "注重数量而非质量",
        "高效填充大片区域",
        "避免重复绘制相同像素",
        "动员所有联盟成员"
      ],
      ja: [
        "質より量に集中",
        "大きなエリアを効率的に塗りつぶす",
        "同じピクセルの再描画を避ける",
        "すべての同盟メンバーを動員"
      ]
    },
    difficulty: "easy",
    timeCommitment: "1-2 hours/day",
    recommendedFor: ["beginners", "casual_players", "alliances"]
  },

  war: {
    objective: {
      en: "Eliminate enemy pixels and defend your alliance's territory",
      zh: "消灭敌方像素并防守己方联盟领地",
      ja: "敵のピクセルを排除し、同盟の領土を守る"
    },
    scoringRules: {
      en: [
        "Overwriting enemy pixels: +2 points",
        "Defending pixels (not overwritten): +1 point/hour",
        "Losing pixels to enemies: -1 point",
        "Strategic locations give bonus points"
      ],
      zh: [
        "覆盖敌方像素: +2分",
        "防守像素(未被覆盖): +1分/小时",
        "像素被敌方覆盖: -1分",
        "战略要地给予额外加分"
      ],
      ja: [
        "敵ピクセルの上書き: +2ポイント",
        "ピクセルの防御(上書きされない): +1ポイント/時",
        "敵にピクセルを奪われる: -1ポイント",
        "戦略的な場所はボーナスポイント"
      ]
    },
    tips: {
      en: [
        "Identify weak points in enemy defenses",
        "Launch coordinated attacks at key times",
        "Maintain defensive rotations",
        "Use guerrilla tactics in enemy territory"
      ],
      zh: [
        "识别敌方防守薄弱点",
        "在关键时刻发起协同攻击",
        "保持防守轮换",
        "在敌方领地使用游击战术"
      ],
      ja: [
        "敵の防御の弱点を特定",
        "重要な時に協調攻撃を開始",
        "防御ローテーションを維持",
        "敵領土でゲリラ戦術を使用"
      ]
    },
    difficulty: "hard",
    timeCommitment: "3-4 hours/day",
    recommendedFor: ["experienced_players", "competitive_alliances"]
  },

  cooperation: {
    objective: {
      en: "Work together with all participants to complete a collaborative artwork",
      zh: "与所有参与者合作完成协作画作",
      ja: "すべての参加者と協力して共同アートワークを完成させる"
    },
    scoringRules: {
      en: [
        "Individual contribution score based on pixels placed",
        "Bonus for placing pixels in designated areas",
        "Team completion bonus when artwork reaches milestones",
        "Perfect placement bonus (matching template)"
      ],
      zh: [
        "个人贡献分基于放置的像素",
        "在指定区域放置像素获得奖励",
        "画作达到里程碑时团队完成奖励",
        "完美放置奖励(匹配模板)"
      ],
      ja: [
        "配置されたピクセルに基づく個人貢献スコア",
        "指定エリアにピクセルを配置するとボーナス",
        "アートワークがマイルストーンに達するとチーム完成ボーナス",
        "完璧な配置ボーナス(テンプレートに一致)"
      ]
    },
    tips: {
      en: [
        "Follow the template guide",
        "Fill uncompleted areas first",
        "Coordinate to avoid duplication",
        "Help correct mistakes"
      ],
      zh: [
        "遵循模板指南",
        "优先填充未完成区域",
        "协调避免重复劳动",
        "帮助纠正错误"
      ],
      ja: [
        "テンプレートガイドに従う",
        "未完成エリアを最初に埋める",
        "重複を避けるために調整",
        "間違いを修正するのを手伝う"
      ]
    },
    difficulty: "easy",
    timeCommitment: "1-2 hours/day",
    recommendedFor: ["beginners", "casual_players", "artists"]
  }
};

module.exports = GAMEPLAY_TEMPLATES;
```

后端创建活动时自动填充:
```javascript
// backend/src/controllers/eventController.js

const GAMEPLAY_TEMPLATES = require('../constants/eventGameplayTemplates');

async function createEvent(req, res) {
  const { type, ...eventData } = req.body;

  // 自动添加玩法说明模板
  const gameplay = GAMEPLAY_TEMPLATES[type] || {};

  const event = await knex('events').insert({
    ...eventData,
    type,
    gameplay: JSON.stringify(gameplay),
    created_at: knex.fn.now(),
    updated_at: knex.fn.now()
  }).returning('*');

  return res.status(201).json(event[0]);
}
```

**3. iOS前端实现**

数据模型:
```swift
// FunnyPixelsApp/FunnyPixelsApp/Models/EventGameplay.swift

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
        switch lang {
        case "zh":
            return zh ?? en
        case "ja":
            return ja ?? en
        default:
            return en
        }
    }
}

struct LocalizedStringArray: Codable {
    let en: [String]
    let zh: [String]?
    let ja: [String]?

    var localized: [String] {
        let lang = Locale.current.language.languageCode?.identifier ?? "en"
        switch lang {
        case "zh":
            return zh ?? en
        case "ja":
            return ja ?? en
        default:
            return en
        }
    }
}
```

UI组件:
```swift
// FunnyPixelsApp/FunnyPixelsApp/Views/Events/Components/EventGameplayView.swift

import SwiftUI

struct EventGameplayView: View {
    let gameplay: EventGameplay
    @State private var expandedSections: Set<String> = ["objective"]

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            // 标题
            HStack {
                Image(systemName: "gamecontroller.fill")
                    .foregroundColor(.blue)
                Text("event.gameplay.title".localized())
                    .font(.headline)
            }

            // 难度和时间投入
            HStack(spacing: 16) {
                DifficultyBadge(difficulty: gameplay.difficulty)
                TimeCommitmentBadge(time: gameplay.timeCommitment)
            }

            Divider()

            // 活动目标
            ExpandableSection(
                title: "event.gameplay.objective".localized(),
                icon: "target",
                isExpanded: expandedSections.contains("objective")
            ) {
                Text(gameplay.objective.localized)
                    .font(.body)
                    .foregroundColor(.primary)
            } onToggle: {
                toggleSection("objective")
            }

            // 计分规则
            ExpandableSection(
                title: "event.gameplay.scoring".localized(),
                icon: "chart.bar.fill",
                isExpanded: expandedSections.contains("scoring")
            ) {
                VStack(alignment: .leading, spacing: 8) {
                    ForEach(gameplay.scoringRules.localized, id: \.self) { rule in
                        HStack(alignment: .top, spacing: 8) {
                            Text("•")
                                .font(.headline)
                            Text(rule)
                                .font(.body)
                        }
                    }
                }
            } onToggle: {
                toggleSection("scoring")
            }

            // 获胜技巧
            ExpandableSection(
                title: "event.gameplay.tips".localized(),
                icon: "lightbulb.fill",
                isExpanded: expandedSections.contains("tips")
            ) {
                VStack(alignment: .leading, spacing: 12) {
                    ForEach(Array(gameplay.tips.localized.enumerated()), id: \.offset) { index, tip in
                        HStack(alignment: .top, spacing: 8) {
                            Image(systemName: "\(index + 1).circle.fill")
                                .foregroundColor(.orange)
                            Text(tip)
                                .font(.body)
                        }
                    }
                }
            } onToggle: {
                toggleSection("tips")
            }

            // 推荐对象
            if !gameplay.recommendedFor.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    Text("event.gameplay.recommended_for".localized())
                        .font(.subheadline)
                        .foregroundColor(.secondary)

                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 8) {
                            ForEach(gameplay.recommendedFor, id: \.self) { tag in
                                Text(tag.localized())
                                    .font(.caption)
                                    .padding(.horizontal, 12)
                                    .padding(.vertical, 6)
                                    .background(Color.blue.opacity(0.2))
                                    .foregroundColor(.blue)
                                    .cornerRadius(12)
                            }
                        }
                    }
                }
            }
        }
        .padding(16)
        .background(Color(.systemBackground))
        .cornerRadius(12)
        .shadow(radius: 2)
    }

    private func toggleSection(_ section: String) {
        if expandedSections.contains(section) {
            expandedSections.remove(section)
        } else {
            expandedSections.insert(section)
        }
    }
}

struct ExpandableSection<Content: View>: View {
    let title: String
    let icon: String
    let isExpanded: Bool
    @ViewBuilder let content: () -> Content
    let onToggle: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Button(action: onToggle) {
                HStack {
                    Label(title, systemImage: icon)
                        .font(.subheadline)
                        .bold()
                    Spacer()
                    Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                        .font(.caption)
                }
                .foregroundColor(.primary)
            }

            if isExpanded {
                content()
                    .transition(.opacity.combined(with: .move(edge: .top)))
            }
        }
        .animation(.easeInOut(duration: 0.2), value: isExpanded)
    }
}

struct DifficultyBadge: View {
    let difficulty: String

    var stars: Int {
        switch difficulty {
        case "easy": return 1
        case "medium": return 3
        case "hard": return 5
        default: return 1
        }
    }

    var color: Color {
        switch difficulty {
        case "easy": return .green
        case "medium": return .orange
        case "hard": return .red
        default: return .gray
        }
    }

    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: "star.fill")
                .foregroundColor(color)

            HStack(spacing: 2) {
                ForEach(0..<5) { index in
                    Image(systemName: index < stars ? "star.fill" : "star")
                        .font(.caption2)
                        .foregroundColor(color)
                }
            }

            Text(difficulty.capitalized)
                .font(.caption)
                .foregroundColor(color)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 6)
        .background(color.opacity(0.1))
        .cornerRadius(8)
    }
}

struct TimeCommitmentBadge: View {
    let time: String

    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: "clock.fill")
                .foregroundColor(.blue)
            Text(time)
                .font(.caption)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 6)
        .background(Color.blue.opacity(0.1))
        .cornerRadius(8)
    }
}
```

**4. 集成到EventDetailView**

```swift
// 在EventDetailView中添加
if let gameplay = event.gameplay {
    EventGameplayView(gameplay: gameplay)
        .padding(.horizontal)
}
```

#### 预期效果
- 新手可以快速理解活动玩法
- 减少参与门槛,提高报名率
- 提供策略指导,提升参与质量
- **预计新手转化率提升40-50%**

---

### P0-3: 个人贡献统计

#### 问题描述
用户在活动中看不到自己的贡献数据,导致:
- 缺少成就感
- 不知道自己做得好不好
- 无法激励持续参与

#### 解决方案

**1. 后端实现**

新增API:
```javascript
// backend/src/controllers/eventController.js

/**
 * GET /api/events/:id/my-contribution
 * 获取用户在活动中的贡献统计
 */
async function getMyContribution(req, res) {
  const { id: eventId } = req.params;
  const userId = req.user.id;

  try {
    // 1. 获取用户在此活动中画的像素数
    const myPixelsResult = await knex('event_pixel_logs')
      .where({
        event_id: eventId,
        user_id: userId
      })
      .countDistinct('pixel_id as count')
      .first();

    const myPixels = parseInt(myPixelsResult?.count || 0);

    // 2. 获取用户所在联盟
    const userAlliance = await knex('alliance_members as am')
      .where({ 'am.user_id': userId })
      .join('alliances as a', 'am.alliance_id', 'a.id')
      .select('a.id', 'a.name')
      .first();

    if (!userAlliance) {
      return res.json({
        myPixels: myPixels,
        allianceId: null,
        allianceName: null,
        allianceTotalPixels: 0,
        contributionRate: 0,
        rankInAlliance: null,
        topContributors: []
      });
    }

    // 3. 获取联盟总像素数
    const alliancePixelsResult = await knex('event_pixel_logs as epl')
      .where({ 'epl.event_id': eventId })
      .join('alliance_members as am', 'epl.user_id', 'am.user_id')
      .where({ 'am.alliance_id': userAlliance.id })
      .countDistinct('epl.pixel_id as count')
      .first();

    const allianceTotalPixels = parseInt(alliancePixelsResult?.count || 0);

    // 4. 计算贡献率
    const contributionRate = allianceTotalPixels > 0
      ? (myPixels / allianceTotalPixels * 100).toFixed(2)
      : 0;

    // 5. 获取联盟内排名和Top贡献者
    const allianceMembers = await knex('alliance_members as am')
      .where({ 'am.alliance_id': userAlliance.id })
      .leftJoin('event_pixel_logs as epl', function() {
        this.on('epl.user_id', '=', 'am.user_id')
            .andOn('epl.event_id', '=', knex.raw('?', [eventId]));
      })
      .leftJoin('users as u', 'am.user_id', 'u.id')
      .select(
        'u.id',
        'u.username',
        'u.avatar_url',
        knex.raw('COUNT(DISTINCT epl.pixel_id) as pixel_count')
      )
      .groupBy('u.id', 'u.username', 'u.avatar_url')
      .orderBy('pixel_count', 'desc');

    const rankInAlliance = allianceMembers.findIndex(m => m.id === userId) + 1;
    const topContributors = allianceMembers.slice(0, 10).map(m => ({
      userId: m.id,
      username: m.username,
      avatarUrl: m.avatar_url,
      pixelCount: parseInt(m.pixel_count)
    }));

    // 6. 获取里程碑进度
    const milestones = [10, 50, 100, 500, 1000, 5000];
    const nextMilestone = milestones.find(m => m > myPixels) || milestones[milestones.length - 1];
    const lastMilestone = milestones.filter(m => m <= myPixels).pop() || 0;

    return res.json({
      myPixels,
      allianceId: userAlliance.id,
      allianceName: userAlliance.name,
      allianceTotalPixels,
      contributionRate: parseFloat(contributionRate),
      rankInAlliance,
      topContributors,
      milestones: {
        current: lastMilestone,
        next: nextMilestone,
        progress: ((myPixels - lastMilestone) / (nextMilestone - lastMilestone) * 100).toFixed(2)
      }
    });
  } catch (error) {
    logger.error('Error fetching contribution stats:', error);
    return res.status(500).json({ error: 'Failed to fetch contribution stats' });
  }
}

module.exports = {
  // ... existing exports
  getMyContribution
};
```

路由配置:
```javascript
// backend/src/routes/eventRoutes.js
router.get('/:id/my-contribution', auth, eventController.getMyContribution);
```

**2. iOS前端实现**

数据模型:
```swift
// FunnyPixelsApp/FunnyPixelsApp/Models/EventContribution.swift

struct EventContribution: Codable {
    let myPixels: Int
    let allianceId: String?
    let allianceName: String?
    let allianceTotalPixels: Int
    let contributionRate: Double
    let rankInAlliance: Int?
    let topContributors: [Contributor]
    let milestones: Milestone

    struct Contributor: Codable, Identifiable {
        let userId: String
        let username: String
        let avatarUrl: String?
        let pixelCount: Int

        var id: String { userId }
    }

    struct Milestone: Codable {
        let current: Int
        let next: Int
        let progress: Double
    }
}
```

Service:
```swift
// EventService.swift
extension EventService {
    func getMyContribution(_ eventId: String) async throws -> EventContribution {
        let endpoint = "/api/events/\(eventId)/my-contribution"
        return try await apiManager.request(endpoint: endpoint, method: "GET")
    }
}
```

UI组件:
```swift
// FunnyPixelsApp/FunnyPixelsApp/Views/Events/Components/EventContributionCard.swift

import SwiftUI

struct EventContributionCard: View {
    let contribution: EventContribution
    let event: EventService.Event

    var body: some View {
        VStack(spacing: 16) {
            // 标题
            HStack {
                Image(systemName: "chart.pie.fill")
                    .foregroundColor(.blue)
                Text("event.my_contribution".localized())
                    .font(.headline)
                Spacer()
            }

            // 主要统计
            HStack(spacing: 16) {
                // 我的像素数
                VStack(spacing: 8) {
                    ZStack {
                        Circle()
                            .stroke(Color.blue.opacity(0.2), lineWidth: 8)
                            .frame(width: 100, height: 100)

                        Circle()
                            .trim(from: 0, to: min(contribution.contributionRate / 100, 1.0))
                            .stroke(
                                LinearGradient(
                                    colors: [.blue, .purple],
                                    startPoint: .topLeading,
                                    endPoint: .bottomTrailing
                                ),
                                style: StrokeStyle(lineWidth: 8, lineCap: .round)
                            )
                            .frame(width: 100, height: 100)
                            .rotationEffect(.degrees(-90))
                            .animation(.easeInOut(duration: 1.0), value: contribution.contributionRate)

                        VStack(spacing: 2) {
                            Text("\(contribution.myPixels)")
                                .font(.title)
                                .bold()
                            Text("像素")
                                .font(.caption2)
                                .foregroundColor(.secondary)
                        }
                    }

                    Text("\(contribution.contributionRate, specifier: "%.1f")% 贡献")
                        .font(.caption)
                        .foregroundColor(.blue)
                }

                Spacer()

                // 联盟内排名和Top贡献者
                VStack(alignment: .leading, spacing: 12) {
                    if let rank = contribution.rankInAlliance {
                        HStack(spacing: 8) {
                            Image(systemName: "medal.fill")
                                .foregroundColor(rankColor(rank))
                            VStack(alignment: .leading, spacing: 2) {
                                Text("event.rank_in_alliance".localized())
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                                Text("#\(rank)")
                                    .font(.title2)
                                    .bold()
                            }
                        }
                    }

                    if let allianceName = contribution.allianceName {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("event.alliance_total".localized())
                                .font(.caption)
                                .foregroundColor(.secondary)
                            Text("\(contribution.allianceTotalPixels) 像素")
                                .font(.subheadline)
                                .bold()
                        }
                    }
                }
            }

            Divider()

            // 里程碑进度
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Text("event.milestone_progress".localized())
                        .font(.subheadline)
                        .bold()
                    Spacer()
                    Text("\(contribution.myPixels) / \(contribution.milestones.next)")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }

                ProgressView(value: contribution.milestones.progress / 100)
                    .tint(.orange)

                Text("event.next_milestone".localized(contribution.milestones.next))
                    .font(.caption)
                    .foregroundColor(.secondary)
            }

            // Top贡献者列表
            if !contribution.topContributors.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    Text("event.top_contributors".localized())
                        .font(.subheadline)
                        .bold()

                    ForEach(contribution.topContributors.prefix(3)) { contributor in
                        ContributorRow(
                            contributor: contributor,
                            rank: contribution.topContributors.firstIndex(where: { $0.id == contributor.id })! + 1
                        )
                    }

                    if contribution.topContributors.count > 3 {
                        Button(action: { showAllContributors = true }) {
                            Text("event.show_all".localized())
                                .font(.caption)
                                .foregroundColor(.blue)
                        }
                    }
                }
            }
        }
        .padding(16)
        .background(Color(.systemBackground))
        .cornerRadius(12)
        .shadow(radius: 2)
    }

    @State private var showAllContributors = false

    private func rankColor(_ rank: Int) -> Color {
        switch rank {
        case 1: return .yellow
        case 2: return .gray
        case 3: return .orange
        default: return .blue
        }
    }
}

struct ContributorRow: View {
    let contributor: EventContribution.Contributor
    let rank: Int

    var body: some View {
        HStack(spacing: 12) {
            // 排名
            Text("#\(rank)")
                .font(.caption)
                .bold()
                .foregroundColor(.white)
                .frame(width: 24, height: 24)
                .background(rankColor)
                .clipShape(Circle())

            // 头像
            AsyncImage(url: URL(string: contributor.avatarUrl ?? "")) { image in
                image
                    .resizable()
                    .scaledToFill()
            } placeholder: {
                Image(systemName: "person.circle.fill")
                    .foregroundColor(.gray)
            }
            .frame(width: 32, height: 32)
            .clipShape(Circle())

            // 用户名
            Text(contributor.username)
                .font(.subheadline)

            Spacer()

            // 像素数
            HStack(spacing: 4) {
                Image(systemName: "drop.fill")
                    .font(.caption2)
                    .foregroundColor(.blue)
                Text("\(contributor.pixelCount)")
                    .font(.caption)
                    .bold()
            }
        }
        .padding(8)
        .background(Color(.systemGray6))
        .cornerRadius(8)
    }

    var rankColor: Color {
        switch rank {
        case 1: return .yellow
        case 2: return .gray
        case 3: return .orange
        default: return .blue
        }
    }
}
```

**3. 实时更新机制**

```swift
// EventManager.swift
class EventManager: ObservableObject {
    @Published var currentContribution: EventContribution?

    func updateContributionAfterPixelDraw(eventId: String) async {
        do {
            currentContribution = try await EventService.shared.getMyContribution(eventId)

            // 检查里程碑
            if let contribution = currentContribution {
                checkMilestoneReached(contribution)
            }
        } catch {
            logger.error("Failed to update contribution: \(error)")
        }
    }

    private func checkMilestoneReached(_ contribution: EventContribution) {
        let milestones = [10, 50, 100, 500, 1000, 5000]
        let lastMilestone = milestones.filter { $0 <= contribution.myPixels }.last ?? 0

        // 检查是否刚达到里程碑(误差范围内)
        if abs(contribution.myPixels - lastMilestone) <= 2 && lastMilestone > 0 {
            showMilestoneToast(milestone: lastMilestone)
            SoundManager.shared.play(.milestoneReached)
            HapticManager.shared.notification(type: .success)
        }
    }

    private func showMilestoneToast(milestone: Int) {
        let toast = MilestoneToast(
            title: "event.milestone.title".localized(),
            message: "event.milestone.reached".localized(milestone),
            milestone: milestone
        )
        // 显示Toast通知
    }
}
```

#### 预期效果
- 实时了解自己的贡献
- 获得成就感和激励
- 促进联盟内竞争
- **预计活动参与时长提升50-70%**

---

### P0-4: 活动区域地图预览

#### 问题描述
用户不知道活动在哪里举办,距离自己多远,无法规划参与计划。

#### 解决方案

**iOS前端实现**

```swift
// FunnyPixelsApp/FunnyPixelsApp/Views/Events/Components/EventMapPreview.swift

import SwiftUI
import MapKit

struct EventMapPreview: View {
    let event: EventService.Event
    @StateObject private var viewModel = EventMapPreviewViewModel()

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            // 标题
            HStack {
                Image(systemName: "map.fill")
                    .foregroundColor(.blue)
                Text("event.area_location".localized())
                    .font(.headline)
                Spacer()
            }

            if let snapshot = viewModel.snapshot {
                // 地图快照
                Image(uiImage: snapshot)
                    .resizable()
                    .scaledToFill()
                    .frame(height: 200)
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .stroke(Color.blue, lineWidth: 2)
                    )

                // 距离和导航
                HStack(spacing: 16) {
                    if let distance = viewModel.distanceToArea {
                        HStack(spacing: 4) {
                            Image(systemName: "location.fill")
                                .foregroundColor(.blue)
                            Text("event.distance".localized(distance))
                                .font(.subheadline)
                        }
                    }

                    Spacer()

                    Button(action: openInMaps) {
                        HStack(spacing: 4) {
                            Image(systemName: "map")
                            Text("event.open_in_maps".localized())
                        }
                        .font(.subheadline)
                        .foregroundColor(.white)
                        .padding(.horizontal, 16)
                        .padding(.vertical, 8)
                        .background(Color.blue)
                        .cornerRadius(8)
                    }
                }
            } else if viewModel.isLoading {
                ProgressView()
                    .frame(height: 200)
                    .frame(maxWidth: .infinity)
            } else {
                Text("event.map_unavailable".localized())
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .frame(height: 200)
                    .frame(maxWidth: .infinity)
                    .background(Color(.systemGray6))
                    .cornerRadius(12)
            }
        }
        .padding(16)
        .background(Color(.systemBackground))
        .cornerRadius(12)
        .shadow(radius: 2)
        .task {
            await viewModel.loadMapSnapshot(for: event)
        }
    }

    private func openInMaps() {
        guard let boundary = event.boundary,
              let coordinates = boundary.coordinates.first?.first,
              coordinates.count >= 2 else { return }

        // 使用第一个坐标点作为目标
        let lat = coordinates[1]
        let lng = coordinates[0]

        let url = URL(string: "maps://?q=\(lat),\(lng)&ll=\(lat),\(lng)")!
        if UIApplication.shared.canOpenURL(url) {
            UIApplication.shared.open(url)
        }
    }
}

@MainActor
class EventMapPreviewViewModel: ObservableObject {
    @Published var snapshot: UIImage?
    @Published var isLoading = false
    @Published var distanceToArea: String?

    func loadMapSnapshot(for event: EventService.Event) async {
        guard let boundary = event.boundary else { return }

        isLoading = true
        defer { isLoading = false }

        // 生成地图快照
        snapshot = await MapSnapshotGenerator.shared.generateSnapshot(
            boundary: boundary,
            width: 800,
            height: 400
        )

        // 计算距离
        if let userLocation = LocationManager.shared.lastLocation {
            let distance = calculateDistance(from: userLocation, to: boundary)
            distanceToArea = formatDistance(distance)
        }
    }

    private func calculateDistance(from location: CLLocation, to boundary: EventService.GeoJSONBoundary) -> Double {
        guard let coordinates = boundary.coordinates.first?.first,
              coordinates.count >= 2 else { return 0 }

        // 使用边界的第一个点计算距离
        let boundaryLocation = CLLocation(
            latitude: coordinates[1],
            longitude: coordinates[0]
        )

        return location.distance(from: boundaryLocation)
    }

    private func formatDistance(_ meters: Double) -> String {
        if meters < 1000 {
            return String(format: "%.0f m", meters)
        } else {
            return String(format: "%.1f km", meters / 1000)
        }
    }
}
```

使用MapSnapshotGenerator(复用现有代码):
```swift
// FunnyPixelsApp/FunnyPixelsApp/Utilities/MapSnapshotGenerator.swift

extension MapSnapshotGenerator {
    func generateSnapshot(boundary: EventService.GeoJSONBoundary, width: CGFloat, height: CGFloat) async -> UIImage? {
        guard let coordinates = boundary.coordinates.first,
              !coordinates.isEmpty else { return nil }

        // 计算边界框
        var minLat = Double.infinity
        var maxLat = -Double.infinity
        var minLng = Double.infinity
        var maxLng = -Double.infinity

        for point in coordinates {
            guard point.count >= 2 else { continue }
            let lng = point[0]
            let lat = point[1]

            minLat = min(minLat, lat)
            maxLat = max(maxLat, lat)
            minLng = min(minLng, lng)
            maxLng = max(maxLng, lng)
        }

        let center = CLLocationCoordinate2D(
            latitude: (minLat + maxLat) / 2,
            longitude: (minLng + maxLng) / 2
        )

        // 计算适当的span
        let latDelta = (maxLat - minLat) * 1.2 // 增加20%边距
        let lngDelta = (maxLng - minLng) * 1.2
        let span = MKCoordinateSpan(latitudeDelta: latDelta, longitudeDelta: lngDelta)

        let region = MKCoordinateRegion(center: center, span: span)

        // 创建快照配置
        let options = MKMapSnapshotter.Options()
        options.region = region
        options.size = CGSize(width: width, height: height)
        options.scale = UIScreen.main.scale

        let snapshotter = MKMapSnapshotter(options: options)

        do {
            let snapshot = try await snapshotter.start()

            // 在快照上绘制边界
            let image = UIGraphicsImageRenderer(size: options.size).image { context in
                snapshot.image.draw(at: .zero)

                // 绘制多边形
                let path = UIBezierPath()
                var isFirstPoint = true

                for point in coordinates {
                    guard point.count >= 2 else { continue }
                    let coordinate = CLLocationCoordinate2D(latitude: point[1], longitude: point[0])
                    let mapPoint = snapshot.point(for: coordinate)

                    if isFirstPoint {
                        path.move(to: mapPoint)
                        isFirstPoint = false
                    } else {
                        path.addLine(to: mapPoint)
                    }
                }
                path.close()

                // 填充
                UIColor.blue.withAlphaComponent(0.2).setFill()
                path.fill()

                // 边框
                UIColor.blue.withAlphaComponent(0.8).setStroke()
                path.lineWidth = 3
                path.stroke()
            }

            return image
        } catch {
            logger.error("Failed to generate map snapshot: \(error)")
            return nil
        }
    }
}
```

#### 预期效果
- 清晰看到活动位置
- 了解距离,便于规划
- 提升报名意愿
- **预计报名转化率提升15-20%**

---

## P1优化方案详细设计

### P1-1: 优化活动信息架构

#### 解决方案

**新增专门的EventTabView**

```swift
// FunnyPixelsApp/FunnyPixelsApp/Views/Events/EventTabView.swift

import SwiftUI

struct EventTabView: View {
    @EnvironmentObject var eventManager: EventManager
    @StateObject private var viewModel = EventTabViewModel()

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 20) {
                    // 1. 当前正在参与的活动(如果有)
                    if let current = eventManager.currentWarEvent {
                        CurrentEventSection(event: current)
                            .padding(.horizontal)
                    }

                    // 2. 即将开始的活动
                    if !viewModel.upcomingEvents.isEmpty {
                        UpcomingEventsSection(events: viewModel.upcomingEvents)
                    }

                    // 3. 进行中的活动(可报名)
                    if !viewModel.activeEvents.isEmpty {
                        ActiveEventsSection(events: viewModel.activeEvents)
                    }

                    // 4. 我参与的活动
                    if !viewModel.myEvents.isEmpty {
                        MyEventsSection(events: viewModel.myEvents)
                    }

                    // 5. 最近结束的活动
                    if !viewModel.recentEndedEvents.isEmpty {
                        RecentResultsSection(events: viewModel.recentEndedEvents)
                    }

                    // 空状态
                    if viewModel.isEmpty {
                        EmptyEventState()
                            .padding(.top, 100)
                    }
                }
                .padding(.vertical)
            }
            .navigationTitle("event.tab.title".localized())
            .refreshable {
                await viewModel.refresh()
            }
        }
        .task {
            await viewModel.loadData()
        }
    }
}

@MainActor
class EventTabViewModel: ObservableObject {
    @Published var upcomingEvents: [EventService.Event] = []
    @Published var activeEvents: [EventService.Event] = []
    @Published var myEvents: [EventService.UserEvent] = []
    @Published var recentEndedEvents: [EventService.Event] = []
    @Published var isLoading = false

    var isEmpty: Bool {
        upcomingEvents.isEmpty && activeEvents.isEmpty && myEvents.isEmpty && recentEndedEvents.isEmpty
    }

    func loadData() async {
        guard !isLoading else { return }
        isLoading = true
        defer { isLoading = false }

        async let active = EventService.shared.getActiveEvents()
        async let my = EventService.shared.getMyEvents(page: 1, pageSize: 10)
        async let ended = EventService.shared.getEndedEvents(page: 1, pageSize: 5)

        do {
            let (activeResult, myResult, endedResult) = try await (active, my, ended)

            // 分类活动
            upcomingEvents = activeResult.filter { $0.status == "published" }
            self.activeEvents = activeResult.filter { $0.status == "active" }
            myEvents = myResult.events
            recentEndedEvents = endedResult.events
        } catch {
            logger.error("Failed to load event data: \(error)")
        }
    }

    func refresh() async {
        await loadData()
    }
}

// 各个Section组件
struct CurrentEventSection: View {
    let event: EventService.Event

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: "location.fill.viewfinder")
                    .foregroundColor(.green)
                Text("event.current_participating".localized())
                    .font(.headline)
                Spacer()
                Text("event.status.in_progress".localized())
                    .font(.caption)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(Color.green.opacity(0.2))
                    .foregroundColor(.green)
                    .cornerRadius(4)
            }

            NavigationLink(destination: EventDetailView(event: event)) {
                EventCardView(event: event, showJoinedAt: false)
            }
        }
    }
}

struct UpcomingEventsSection: View {
    let events: [EventService.Event]

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionHeader(
                title: "event.upcoming.title".localized(),
                icon: "clock.badge.exclamationmark",
                count: events.count
            )

            ForEach(events) { event in
                NavigationLink(destination: EventDetailView(event: event)) {
                    UpcomingEventCard(event: event)
                }
            }
            .padding(.horizontal)
        }
    }
}

struct ActiveEventsSection: View {
    let events: [EventService.Event]

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionHeader(
                title: "event.active.title".localized(),
                icon: "flame.fill",
                count: events.count
            )

            ForEach(events) { event in
                NavigationLink(destination: EventDetailView(event: event)) {
                    EventCardView(event: event, showJoinedAt: false)
                }
            }
            .padding(.horizontal)
        }
    }
}

struct SectionHeader: View {
    let title: String
    let icon: String
    let count: Int

    var body: some View {
        HStack {
            Label(title, systemImage: icon)
                .font(.headline)
            Text("(\(count))")
                .font(.subheadline)
                .foregroundColor(.secondary)
            Spacer()
        }
        .padding(.horizontal)
    }
}
```

**更新ContentView以包含新Tab**

```swift
// ContentView.swift
TabView(selection: $selectedTab) {
    MapView()
        .tabItem {
            Label("Map", systemImage: "map")
        }
        .tag(0)

    FeedTabView()
        .tabItem {
            Label("Feed", systemImage: "photo.on.rectangle")
        }
        .tag(1)

    EventTabView()  // 新增
        .tabItem {
            Label("Events", systemImage: "flag.2.crossed")
        }
        .tag(2)
        .badge(eventManager.activeEvents.filter { $0.status == "published" }.count)

    LeaderboardTabView()
        .tabItem {
            Label("Leaderboard", systemImage: "chart.bar")
        }
        .tag(3)

    ProfileView()
        .tabItem {
            Label("Profile", systemImage: "person.crop.circle")
        }
        .tag(4)
}
```

---

### P1-2: 新手引导流程

```swift
// FunnyPixelsApp/FunnyPixelsApp/Views/Events/EventTutorialView.swift

import SwiftUI

struct EventTutorialView: View {
    @Binding var isPresented: Bool
    @AppStorage("hasSeenEventTutorial") private var hasSeenEventTutorial = false
    @State private var currentPage = 0

    var body: some View {
        ZStack {
            TabView(selection: $currentPage) {
                TutorialPage(
                    icon: "flag.2.crossed.fill",
                    iconColor: .blue,
                    title: "tutorial.events.intro.title".localized(),
                    description: "tutorial.events.intro.description".localized(),
                    illustration: "tutorial_events_intro"
                )
                .tag(0)

                TutorialPage(
                    icon: "person.badge.plus.fill",
                    iconColor: .green,
                    title: "tutorial.events.signup.title".localized(),
                    description: "tutorial.events.signup.description".localized(),
                    illustration: "tutorial_signup"
                )
                .tag(1)

                TutorialPage(
                    icon: "map.fill",
                    iconColor: .orange,
                    title: "tutorial.events.participate.title".localized(),
                    description: "tutorial.events.participate.description".localized(),
                    illustration: "tutorial_participate"
                )
                .tag(2)

                TutorialPage(
                    icon: "trophy.fill",
                    iconColor: .yellow,
                    title: "tutorial.events.rewards.title".localized(),
                    description: "tutorial.events.rewards.description".localized(),
                    illustration: "tutorial_rewards"
                )
                .tag(3)
            }
            .tabViewStyle(.page)
            .indexViewStyle(.page(backgroundDisplayMode: .always))

            VStack {
                HStack {
                    Spacer()
                    Button(action: skip) {
                        Text("tutorial.skip".localized())
                            .font(.subheadline)
                            .foregroundColor(.blue)
                            .padding()
                    }
                }

                Spacer()

                if currentPage == 3 {
                    Button(action: finish) {
                        Text("tutorial.get_started".localized())
                            .font(.headline)
                            .foregroundColor(.white)
                            .frame(maxWidth: .infinity)
                            .padding()
                            .background(Color.blue)
                            .cornerRadius(12)
                    }
                    .padding(.horizontal, 40)
                    .padding(.bottom, 40)
                }
            }
        }
    }

    private func skip() {
        hasSeenEventTutorial = true
        isPresented = false
    }

    private func finish() {
        hasSeenEventTutorial = true
        isPresented = false
    }
}

struct TutorialPage: View {
    let icon: String
    let iconColor: Color
    let title: String
    let description: String
    let illustration: String

    var body: some View {
        VStack(spacing: 30) {
            Spacer()

            // 图标
            Image(systemName: icon)
                .font(.system(size: 80))
                .foregroundColor(iconColor)

            // 标题
            Text(title)
                .font(.title)
                .bold()
                .multilineTextAlignment(.center)

            // 描述
            Text(description)
                .font(.body)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 40)

            Spacer()
        }
    }
}
```

---

### P1-3: 实时贡献反馈

```swift
// FunnyPixelsApp/FunnyPixelsApp/Views/Components/PixelDrawFeedback.swift

import SwiftUI

struct PixelDrawFeedback: View {
    let pixelLocation: CGPoint
    @State private var offset: CGFloat = 0
    @State private var opacity: Double = 1

    var body: some View {
        Text("+1")
            .font(.headline)
            .bold()
            .foregroundColor(.green)
            .offset(y: offset)
            .opacity(opacity)
            .onAppear {
                withAnimation(.easeOut(duration: 1.0)) {
                    offset = -50
                    opacity = 0
                }
            }
    }
}

// 在EventManager中触发
func onPixelDrawnInEvent(_ eventId: String, at location: CGPoint) {
    // 显示飘字
    showFloatingText("+1", at: location, color: .green)

    // 震动反馈
    HapticManager.shared.impact(style: .light)

    // 播放音效
    SoundManager.shared.play(.pixelDraw)

    // 更新本地计数
    eventPixelCount[eventId, default: 0] += 1

    // 检查里程碑
    checkMilestone(eventId)

    // 每10个像素更新一次服务器数据
    if eventPixelCount[eventId]! % 10 == 0 {
        Task {
            await updateContribution(eventId)
        }
    }
}
```

---

### P1-4: 历史趋势分析

**后端实现排名快照**

```javascript
// backend/src/services/eventService.js

async function saveRankingSnapshot(eventId) {
  const rankings = await processEventScores(eventId);

  await knex('event_ranking_snapshots').insert({
    event_id: eventId,
    rankings: JSON.stringify(rankings),
    total_pixels: rankings.reduce((sum, r) => sum + r.pixelCount, 0),
    created_at: knex.fn.now()
  });
}

// 定时任务(每5分钟)
setInterval(async () => {
  const activeEvents = await knex('events').where({ status: 'active' });

  for (const event of activeEvents) {
    await saveRankingSnapshot(event.id);
  }
}, 5 * 60 * 1000);
```

**数据库迁移**

```sql
-- backend/src/database/migrations/20260223000001_create_ranking_snapshots.js

exports.up = function(knex) {
  return knex.schema.createTable('event_ranking_snapshots', table => {
    table.increments('id').primary();
    table.uuid('event_id').references('id').inTable('events').onDelete('CASCADE');
    table.jsonb('rankings').notNullable();
    table.integer('total_pixels').defaultTo(0);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.index(['event_id', 'created_at']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('event_ranking_snapshots');
};
```

**API端点**

```javascript
// GET /api/events/:id/ranking-history
async function getEventRankingHistory(req, res) {
  const { id: eventId } = req.params;
  const { hours = 24 } = req.query;

  const snapshots = await knex('event_ranking_snapshots')
    .where({ event_id: eventId })
    .where('created_at', '>=', knex.raw(`NOW() - INTERVAL '${hours} hours'`))
    .orderBy('created_at', 'asc');

  return res.json({
    snapshots: snapshots.map(s => ({
      timestamp: s.created_at,
      rankings: JSON.parse(s.rankings),
      totalPixels: s.total_pixels
    }))
  });
}
```

**iOS趋势图**

```swift
import Charts

struct EventTrendChart: View {
    let snapshots: [RankingSnapshot]
    let myAllianceId: String

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("event.rank_trend".localized())
                .font(.headline)

            Chart {
                ForEach(snapshots) { snapshot in
                    if let myRank = snapshot.rankOf(myAllianceId) {
                        LineMark(
                            x: .value("Time", snapshot.timestamp),
                            y: .value("Rank", myRank)
                        )
                        .foregroundStyle(.blue)
                    }
                }
            }
            .chartYScale(domain: .automatic(includesZero: false, reversed: true))
            .chartYAxis {
                AxisMarks(position: .leading) { value in
                    AxisValueLabel {
                        if let rank = value.as(Int.self) {
                            Text("#\(rank)")
                        }
                    }
                }
            }
            .frame(height: 200)
        }
        .padding()
        .background(Color(.systemBackground))
        .cornerRadius(12)
    }
}
```

---

### P1-5: 排名变化通知

```swift
// EventManager.swift

class EventManager: ObservableObject {
    private var previousRankCache: [String: Int] = [:]

    func handleBattleUpdate(_ data: [String: Any]) {
        guard let eventId = data["eventId"] as? String,
              let alliancesData = data["alliances"] as? [[String: Any]] else { return }

        let newScores = parseAllianceScores(alliancesData)

        // 检查排名变化
        if let myAllianceId = getCurrentUserAllianceId(),
           let newRank = newScores.firstIndex(where: { $0.allianceId == myAllianceId }),
           let previousRank = previousRankCache[eventId] {

            let rankChange = previousRank - (newRank + 1)

            if rankChange != 0 {
                showRankChangeNotification(
                    eventId: eventId,
                    previousRank: previousRank,
                    currentRank: newRank + 1,
                    change: rankChange
                )
            }

            previousRankCache[eventId] = newRank + 1
        }

        allianceScores = newScores
    }

    private func showRankChangeNotification(eventId: String, previousRank: Int, currentRank: Int, change: Int) {
        let toast = RankChangeToast(
            previousRank: previousRank,
            currentRank: currentRank,
            change: change
        )

        // 显示Toast
        NotificationCenter.default.post(
            name: .showToast,
            object: toast
        )

        // 音效和震动
        if change > 0 {
            SoundManager.shared.play(.rankUp)
            HapticManager.shared.notification(type: .success)
        } else {
            SoundManager.shared.play(.rankDown)
            HapticManager.shared.notification(type: .warning)
        }
    }
}

struct RankChangeToast: View {
    let previousRank: Int
    let currentRank: Int
    let change: Int

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: change > 0 ? "arrow.up.circle.fill" : "arrow.down.circle.fill")
                .font(.title2)
                .foregroundColor(change > 0 ? .green : .red)

            VStack(alignment: .leading, spacing: 2) {
                Text(change > 0 ? "排名上升!" : "排名下降")
                    .font(.headline)
                    .bold()

                Text("从第\(previousRank)名到第\(currentRank)名")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }

            Spacer()

            Text("\(change > 0 ? "+" : "")\(change)")
                .font(.title3)
                .bold()
                .foregroundColor(change > 0 ? .green : .red)
        }
        .padding(16)
        .background(Color(.systemBackground))
        .cornerRadius(12)
        .shadow(radius: 4)
    }
}
```

---

## 数据库变更方案

### 新增表

```sql
-- 1. 排名快照表
CREATE TABLE event_ranking_snapshots (
  id SERIAL PRIMARY KEY,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  rankings JSONB NOT NULL,
  total_pixels INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_ranking_snapshots_event_time ON event_ranking_snapshots(event_id, created_at);

-- 2. 用户活动里程碑表
CREATE TABLE event_user_milestones (
  id SERIAL PRIMARY KEY,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL,
  milestone_type VARCHAR(50) NOT NULL,
  milestone_value INTEGER NOT NULL,
  achieved_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(event_id, user_id, milestone_type, milestone_value)
);

CREATE INDEX idx_user_milestones_event_user ON event_user_milestones(event_id, user_id);
```

### 修改现有表

```sql
-- 添加gameplay字段到events表
ALTER TABLE events ADD COLUMN gameplay JSONB;

-- 添加索引优化查询
CREATE INDEX idx_event_participants_event_type ON event_participants(event_id, participant_type);
CREATE INDEX idx_event_pixel_logs_event_user ON event_pixel_logs(event_id, user_id);
```

---

## API设计方案

### 新增API端点

| 方法 | 端点 | 功能 | 请求参数 | 响应 |
|------|------|------|---------|------|
| GET | /api/events/:id/signup-stats | 获取报名统计 | - | SignupStats |
| GET | /api/events/:id/my-contribution | 获取个人贡献 | - | Contribution |
| GET | /api/events/:id/ranking-history | 获取排名历史 | hours (default: 24) | RankingHistory |
| POST | /api/events/:id/milestones/:type | 记录里程碑达成 | milestone_value | Success |
| GET | /api/events/:id/leaderboard | 获取联盟内排行 | - | Leaderboard |

### API响应格式示例

```typescript
// SignupStats
{
  allianceCount: number;
  userCount: number;
  estimatedParticipants: number;
  avgAlliancePower: number;
  topAlliances: Array<{
    id: string;
    name: string;
    color: string;
    level: number;
    memberCount: number;
    totalPower: number;
  }>;
  requirements: {
    minParticipants: number;
    meetsMinimum: boolean;
    shortfall: number;
  };
}

// Contribution
{
  myPixels: number;
  allianceId: string | null;
  allianceName: string | null;
  allianceTotalPixels: number;
  contributionRate: number;
  rankInAlliance: number | null;
  topContributors: Array<{
    userId: string;
    username: string;
    avatarUrl: string;
    pixelCount: number;
  }>;
  milestones: {
    current: number;
    next: number;
    progress: number;
  };
}
```

---

## 实施路线图

### 第1周: P0-1 & P0-2

**Day 1-2: 报名数据透明化(P0-1)**
- [ ] 后端: 实现getSignupStats API
- [ ] iOS: 创建EventSignupStats模型
- [ ] iOS: 实现EventSignupStatsView组件
- [ ] 集成到EventDetailView
- [ ] 测试验证

**Day 3-4: 活动玩法说明(P0-2)**
- [ ] 后端: 添加gameplay字段迁移
- [ ] 后端: 创建玩法模板库
- [ ] iOS: 创建EventGameplay模型
- [ ] iOS: 实现EventGameplayView组件
- [ ] 本地化翻译
- [ ] 集成测试

**Day 5: 代码Review和测试**

### 第2周: P0-3 & P0-4

**Day 6-8: 个人贡献统计(P0-3)**
- [ ] 后端: 实现getMyContribution API
- [ ] iOS: 创建EventContribution模型
- [ ] iOS: 实现EventContributionCard组件
- [ ] 实现实时更新机制
- [ ] 里程碑检测和通知
- [ ] 测试验证

**Day 9-10: 活动区域地图预览(P0-4)**
- [ ] iOS: 实现EventMapPreview组件
- [ ] 集成MapSnapshotGenerator
- [ ] 距离计算功能
- [ ] 导航跳转功能
- [ ] 测试验证

### 第3周: P1-1 & P1-2

**Day 11-12: 信息架构优化(P1-1)**
- [ ] iOS: 创建EventTabView
- [ ] iOS: 实现各Section组件
- [ ] 更新ContentView添加新Tab
- [ ] UI/UX调优
- [ ] 测试

**Day 13-15: 新手引导(P1-2)**
- [ ] iOS: 实现EventTutorialView
- [ ] 设计引导页面内容
- [ ] 本地化翻译
- [ ] 集成触发逻辑
- [ ] 用户测试

### 第4周: P1-3, P1-4, P1-5

**Day 16-17: 实时贡献反馈(P1-3)**
- [ ] iOS: 实现飘字动画
- [ ] 集成音效和震动
- [ ] 里程碑Toast通知
- [ ] 测试

**Day 18-19: 历史趋势分析(P1-4)**
- [ ] 数据库: 创建ranking_snapshots表
- [ ] 后端: 实现快照定时任务
- [ ] 后端: getRankingHistory API
- [ ] iOS: 实现趋势图组件
- [ ] 测试

**Day 20: 排名变化通知(P1-5)**
- [ ] iOS: 实现排名变化检测
- [ ] iOS: RankChangeToast组件
- [ ] 测试验证

### 第5-6周: P2优化 & 测试

**Week 5**
- P2-1: 社交分享增强
- P2-2: 活动难度评级
- P2-3: 离线缓存支持

**Week 6**
- P2-4: 省电模式
- P2-5: 准入条件明确
- 全面测试和Bug修复
- 性能优化
- 文档更新

---

## 测试计划

### 单元测试

```swift
// EventSignupStatsTests.swift
class EventSignupStatsTests: XCTestCase {
    func testSignupStatsDecoding() {
        let json = """
        {
          "allianceCount": 15,
          "userCount": 8,
          "estimatedParticipants": 450,
          "avgAlliancePower": 25000,
          "topAlliances": [],
          "requirements": {
            "minParticipants": 100,
            "meetsMinimum": true,
            "shortfall": 0
          }
        }
        """

        let data = json.data(using: .utf8)!
        let stats = try? JSONDecoder().decode(EventSignupStats.self, from: data)

        XCTAssertNotNil(stats)
        XCTAssertEqual(stats?.allianceCount, 15)
        XCTAssertEqual(stats?.estimatedParticipants, 450)
    }
}

// EventContributionTests.swift
class EventContributionTests: XCTestCase {
    func testContributionRateCalculation() {
        let contribution = EventContribution(
            myPixels: 150,
            allianceId: "test",
            allianceName: "Test Alliance",
            allianceTotalPixels: 2000,
            contributionRate: 7.5,
            rankInAlliance: 3,
            topContributors: [],
            milestones: EventContribution.Milestone(current: 100, next: 500, progress: 12.5)
        )

        XCTAssertEqual(contribution.contributionRate, 7.5, accuracy: 0.1)
    }
}
```

### 集成测试

```javascript
// backend/tests/integration/eventSignupStats.test.js
describe('Event Signup Stats', () => {
  it('should return correct signup statistics', async () => {
    const eventId = await createTestEvent();
    await signupTestAlliances(eventId, 5);

    const res = await request(app)
      .get(`/api/events/${eventId}/signup-stats`)
      .set('Authorization', `Bearer ${testToken}`);

    expect(res.status).toBe(200);
    expect(res.body.allianceCount).toBe(5);
    expect(res.body.topAlliances).toHaveLength(5);
  });
});
```

### UI测试

```swift
// EventDetailUITests.swift
class EventDetailUITests: XCTestCase {
    func testSignupStatsDisplayed() {
        let app = XCUIApplication()
        app.launch()

        // 导航到活动详情
        app.tabBars.buttons["Events"].tap()
        app.collectionViews.cells.firstMatch.tap()

        // 验证报名统计显示
        XCTAssertTrue(app.staticTexts["活动热度"].exists)
        XCTAssertTrue(app.staticTexts["参赛联盟"].exists)
    }
}
```

### 性能测试

```javascript
// backend/tests/performance/eventQueries.test.js
describe('Event Query Performance', () => {
  it('should fetch signup stats within 200ms', async () => {
    const start = Date.now();
    await eventController.getEventSignupStats(req, res);
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(200);
  });
});
```

---

## 风险评估

### 技术风险

| 风险 | 影响 | 概率 | 缓解措施 |
|------|------|------|---------|
| 数据库性能下降 | 高 | 中 | 添加索引,实施查询优化,使用缓存 |
| Socket消息过多 | 中 | 中 | 批量更新,防抖处理 |
| 地图快照生成慢 | 低 | 低 | 异步生成,缓存结果 |
| 内存占用增加 | 中 | 低 | 定期清理,限制缓存大小 |

### 产品风险

| 风险 | 影响 | 概率 | 缓解措施 |
|------|------|------|---------|
| 用户不适应新UI | 中 | 低 | A/B测试,收集反馈,逐步迁移 |
| 信息过载 | 中 | 中 | 可折叠设计,分级展示 |
| 通知过多打扰 | 中 | 中 | 可配置通知,静默模式 |

### 时间风险

| 风险 | 影响 | 概率 | 缓解措施 |
|------|------|------|---------|
| 开发延期 | 高 | 中 | 预留缓冲时间,优先P0功能 |
| 测试不充分 | 高 | 中 | 提前编写测试,持续集成 |
| 兼容性问题 | 中 | 低 | 多设备测试,版本检测 |

---

## 成功指标

### 关键指标

1. **参与率**
   - 基准: 15-20%
   - 目标: 25-35%
   - 测量: 报名用户数 / 活跃用户数

2. **参与时长**
   - 基准: 20分钟/次
   - 目标: 35分钟/次
   - 测量: 活动期间平均在线时长

3. **完成率**
   - 基准: 40%
   - 目标: 65%
   - 测量: 参与到结束用户数 / 报名用户数

4. **分享率**
   - 基准: <5%
   - 目标: 20%
   - 测量: 分享次数 / 参与用户数

5. **新手转化率**
   - 基准: 30%
   - 目标: 55%
   - 测量: 首次参与用户数 / 首次查看活动用户数

### 监控Dashboard

```javascript
// 实时监控指标
{
  "activeEvents": 3,
  "totalParticipants": 1250,
  "avgSessionDuration": "32分钟",
  "signupConversionRate": "31%",
  "shareRate": "18%",
  "retentionDay7": "62%"
}
```

---

## 附录

### 本地化字符串清单

需要新增的本地化字符串(约100+ keys):

```
// 报名统计
activity_heat
event.stats.alliances
event.stats.participants
event.stats.avg_power
event.warning.min_participants
event.warning.need_more
event.registered_alliances
event.top_n
event.show_all_alliances

// 玩法说明
event.gameplay.title
event.gameplay.objective
event.gameplay.scoring
event.gameplay.tips
event.gameplay.recommended_for

// 个人贡献
event.my_contribution
event.rank_in_alliance
event.alliance_total
event.milestone_progress
event.next_milestone
event.top_contributors

// 地图预览
event.area_location
event.distance
event.open_in_maps
event.map_unavailable

// 教程
tutorial.events.intro.title
tutorial.events.intro.description
tutorial.events.signup.title
tutorial.events.signup.description
tutorial.skip
tutorial.get_started

// ... 更多
```

### 设计资源需求

- 活动类型图标 (4种)
- 引导页插图 (4张)
- 里程碑徽章 (6种)
- 排名奖杯图标 (3种)
- 空状态插图 (3张)

### 第三方依赖

无新增依赖,使用现有:
- SwiftUI Charts (iOS 16+)
- MapKit
- Combine

---

**文档结束**

下一步行动:
1. ✅ Review本文档
2. ⏭️ 团队会议讨论优先级
3. ⏭️ 分配任务和时间表
4. ⏭️ 开始第1周开发

预计完成时间: 2026-04-05 (6周后)
