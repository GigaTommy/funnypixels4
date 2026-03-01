import ActivityKit
import WidgetKit
import SwiftUI

/// 赛事 Live Activity 视图
/// 支持灵动岛（紧凑/展开）和锁屏小部件
@available(iOS 16.1, *)
struct EventLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: EventActivityAttributes.self) { context in
            // 锁屏/通知中心视图
            LockScreenView(context: context)
        } dynamicIsland: { context in
            DynamicIsland {
                // 展开区域 - 长按灵动岛时显示
                DynamicIslandExpandedRegion(.leading) {
                    ExpandedLeadingView(context: context)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    ExpandedTrailingView(context: context)
                }
                DynamicIslandExpandedRegion(.center) {
                    ExpandedCenterView(context: context)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    ExpandedBottomView(context: context)
                }
            } compactLeading: {
                // 紧凑态左侧 - 显示联盟颜色指示器
                CompactLeadingView(context: context)
            } compactTrailing: {
                // 紧凑态右侧 - 显示排名
                CompactTrailingView(context: context)
            } minimal: {
                // 最小态 - 与其他 Activity 共存时显示
                MinimalView(context: context)
            }
        }
    }
}

// MARK: - 紧凑态视图 (Compact Views)

@available(iOS 16.1, *)
struct CompactLeadingView: View {
    let context: ActivityViewContext<EventActivityAttributes>

    var body: some View {
        HStack(spacing: 4) {
            // 联盟颜色点
            Circle()
                .fill(Color(hex: context.attributes.userAllianceColor) ?? .red)
                .frame(width: 10, height: 10)

            // 赛事图标
            Image(systemName: "flame.fill")
                .font(.system(size: 12, weight: .bold))
                .foregroundColor(.orange)
        }
    }
}

@available(iOS 16.1, *)
struct CompactTrailingView: View {
    let context: ActivityViewContext<EventActivityAttributes>

    var body: some View {
        HStack(spacing: 2) {
            // 排名
            Text("#\(context.state.userRank)")
                .font(.system(size: 14, weight: .bold, design: .rounded))
                .foregroundColor(rankColor(context.state.userRank))

            // 倒计时
            if context.state.secondsRemaining > 0 {
                Text(formatTime(context.state.secondsRemaining))
                    .font(.system(size: 10, weight: .medium, design: .monospaced))
                    .foregroundColor(.secondary)
            }
        }
    }

    private func rankColor(_ rank: Int) -> Color {
        switch rank {
        case 1: return .yellow
        case 2: return .gray
        case 3: return .orange
        default: return .white
        }
    }

    private func formatTime(_ seconds: Int) -> String {
        let minutes = seconds / 60
        let secs = seconds % 60
        return String(format: "%d:%02d", minutes, secs)
    }
}

// MARK: - 最小态视图 (Minimal View)

@available(iOS 16.1, *)
struct MinimalView: View {
    let context: ActivityViewContext<EventActivityAttributes>

    var body: some View {
        ZStack {
            // 背景色显示联盟颜色
            Circle()
                .fill(Color(hex: context.attributes.userAllianceColor)?.opacity(0.3) ?? .clear)

            // 排名数字
            Text("\(context.state.userRank)")
                .font(.system(size: 14, weight: .bold, design: .rounded))
                .foregroundColor(.white)
        }
    }
}

// MARK: - 展开态视图 (Expanded Views)

@available(iOS 16.1, *)
struct ExpandedLeadingView: View {
    let context: ActivityViewContext<EventActivityAttributes>

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Image(systemName: "flame.fill")
                .font(.title2)
                .foregroundColor(.orange)

            Text("你的排名")
                .font(.caption2)
                .foregroundColor(.secondary)
        }
    }
}

@available(iOS 16.1, *)
struct ExpandedTrailingView: View {
    let context: ActivityViewContext<EventActivityAttributes>

    var body: some View {
        VStack(alignment: .trailing, spacing: 4) {
            Text("#\(context.state.userRank)")
                .font(.system(size: 28, weight: .bold, design: .rounded))
                .foregroundColor(rankColor(context.state.userRank))

            Text(context.attributes.userAllianceName)
                .font(.caption)
                .foregroundColor(Color(hex: context.attributes.userAllianceColor) ?? .white)
                .lineLimit(1)
        }
    }

    private func rankColor(_ rank: Int) -> Color {
        switch rank {
        case 1: return .yellow
        case 2: return Color(white: 0.75)
        case 3: return .orange
        default: return .white
        }
    }
}

@available(iOS 16.1, *)
struct ExpandedCenterView: View {
    let context: ActivityViewContext<EventActivityAttributes>

    var body: some View {
        VStack(spacing: 2) {
            Text(context.attributes.eventTitle)
                .font(.headline)
                .foregroundColor(.white)
                .lineLimit(1)

            if context.state.secondsRemaining > 0 {
                HStack(spacing: 4) {
                    Image(systemName: "clock")
                        .font(.caption2)
                    Text(formatTimeDetailed(context.state.secondsRemaining))
                        .font(.system(size: 12, weight: .medium, design: .monospaced))
                }
                .foregroundColor(.secondary)
            } else {
                Text("已结束")
                    .font(.caption)
                    .foregroundColor(.red)
            }
        }
    }

    private func formatTimeDetailed(_ seconds: Int) -> String {
        let hours = seconds / 3600
        let minutes = (seconds % 3600) / 60
        let secs = seconds % 60
        if hours > 0 {
            return String(format: "%d:%02d:%02d", hours, minutes, secs)
        }
        return String(format: "%02d:%02d", minutes, secs)
    }
}

@available(iOS 16.1, *)
struct ExpandedBottomView: View {
    let context: ActivityViewContext<EventActivityAttributes>

    var body: some View {
        VStack(spacing: 8) {
            // 战况进度条
            BattleProgressBar(rankings: context.state.rankings)
                .frame(height: 8)

            // 前三名显示
            HStack(spacing: 0) {
                ForEach(Array(context.state.rankings.prefix(3).enumerated()), id: \.element.id) { index, ranking in
                    RankingItem(rank: index + 1, ranking: ranking)
                    if index < min(2, context.state.rankings.count - 1) {
                        Spacer()
                    }
                }
            }

            // 总像素数
            Text("\(context.state.totalPixels) 像素")
                .font(.caption2)
                .foregroundColor(.secondary)
        }
    }
}

@available(iOS 16.1, *)
struct BattleProgressBar: View {
    let rankings: [EventActivityAttributes.AllianceRanking]

    var body: some View {
        GeometryReader { geometry in
            HStack(spacing: 1) {
                ForEach(rankings) { ranking in
                    if ranking.score > 0 {
                        RoundedRectangle(cornerRadius: 2)
                            .fill(ranking.color)
                            .frame(width: max(4, geometry.size.width * ranking.score))
                    }
                }
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: 4))
    }
}

@available(iOS 16.1, *)
struct RankingItem: View {
    let rank: Int
    let ranking: EventActivityAttributes.AllianceRanking

    var body: some View {
        HStack(spacing: 4) {
            // 排名徽章
            Text(rankEmoji)
                .font(.caption)

            // 联盟名
            Text(ranking.name)
                .font(.caption2)
                .foregroundColor(ranking.color)
                .lineLimit(1)

            // 百分比
            Text(String(format: "%.0f%%", ranking.score * 100))
                .font(.system(size: 10, weight: .semibold, design: .rounded))
                .foregroundColor(.white)
        }
    }

    var rankEmoji: String {
        switch rank {
        case 1: return "🥇"
        case 2: return "🥈"
        case 3: return "🥉"
        default: return "\(rank)"
        }
    }
}

// MARK: - 锁屏视图 (Lock Screen View)

@available(iOS 16.1, *)
struct LockScreenView: View {
    let context: ActivityViewContext<EventActivityAttributes>

    var body: some View {
        VStack(spacing: 12) {
            // 顶部：赛事标题 + 倒计时
            HStack {
                HStack(spacing: 6) {
                    Image(systemName: "flame.fill")
                        .foregroundColor(.orange)
                    Text(context.attributes.eventTitle)
                        .font(.headline)
                        .foregroundColor(.white)
                }

                Spacer()

                if context.state.secondsRemaining > 0 {
                    Text(formatTimeDetailed(context.state.secondsRemaining))
                        .font(.system(size: 14, weight: .medium, design: .monospaced))
                        .foregroundColor(.secondary)
                } else {
                    Text("已结束")
                        .font(.caption)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(Color.red.opacity(0.3))
                        .cornerRadius(4)
                }
            }

            // 战况进度条
            BattleProgressBar(rankings: context.state.rankings)
                .frame(height: 10)

            // 底部：我的排名 + 联盟 + 前三名
            HStack {
                // 我的状态
                VStack(alignment: .leading, spacing: 2) {
                    Text("我的排名")
                        .font(.caption2)
                        .foregroundColor(.secondary)
                    HStack(spacing: 4) {
                        Text("#\(context.state.userRank)")
                            .font(.system(size: 20, weight: .bold, design: .rounded))
                            .foregroundColor(rankColor(context.state.userRank))
                        Circle()
                            .fill(Color(hex: context.attributes.userAllianceColor) ?? .gray)
                            .frame(width: 8, height: 8)
                    }
                }

                Spacer()

                // 前三名
                HStack(spacing: 12) {
                    ForEach(Array(context.state.rankings.prefix(3).enumerated()), id: \.element.id) { index, ranking in
                        VStack(spacing: 2) {
                            Text(rankEmoji(index + 1))
                                .font(.caption)
                            Text(String(format: "%.0f%%", ranking.score * 100))
                                .font(.system(size: 12, weight: .bold, design: .rounded))
                                .foregroundColor(ranking.color)
                        }
                    }
                }
            }
        }
        .padding(16)
        .background(Color.black.opacity(0.8))
    }

    private func formatTimeDetailed(_ seconds: Int) -> String {
        let hours = seconds / 3600
        let minutes = (seconds % 3600) / 60
        let secs = seconds % 60
        if hours > 0 {
            return String(format: "%d:%02d:%02d", hours, minutes, secs)
        }
        return String(format: "%02d:%02d", minutes, secs)
    }

    private func rankColor(_ rank: Int) -> Color {
        switch rank {
        case 1: return .yellow
        case 2: return Color(white: 0.75)
        case 3: return .orange
        default: return .white
        }
    }

    private func rankEmoji(_ rank: Int) -> String {
        switch rank {
        case 1: return "🥇"
        case 2: return "🥈"
        case 3: return "🥉"
        default: return "\(rank)"
        }
    }
}

// MARK: - Preview

@available(iOS 16.1, *)
#Preview("Lock Screen", as: .content, using: EventActivityAttributes(
    eventId: "test-1",
    eventTitle: "城市争夺战",
    userAllianceName: "蓝色风暴",
    userAllianceColor: "#4A90D9"
)) {
    EventLiveActivity()
} contentStates: {
    EventActivityAttributes.ContentState(
        rankings: [
            .init(id: "1", name: "红色军团", colorHex: "#FF4444", score: 0.45, pixelCount: 450),
            .init(id: "2", name: "蓝色风暴", colorHex: "#4A90D9", score: 0.35, pixelCount: 350),
            .init(id: "3", name: "绿色联盟", colorHex: "#44AA44", score: 0.20, pixelCount: 200)
        ],
        userRank: 2,
        totalPixels: 1000,
        secondsRemaining: 1845
    )
}
