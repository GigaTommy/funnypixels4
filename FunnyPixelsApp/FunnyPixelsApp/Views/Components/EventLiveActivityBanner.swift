import Combine
import SwiftUI

/// 赛事实时状态 Banner
/// 用于不支持灵动岛的设备，显示在屏幕顶部
struct EventLiveActivityBanner: View {
    @ObservedObject var liveActivityManager = LiveActivityManager.shared
    @State private var isExpanded = false
    @State private var dragOffset: CGFloat = 0

    var body: some View {
        if liveActivityManager.showFallbackBanner, let data = liveActivityManager.fallbackBannerData {
            VStack(spacing: 0) {
                // 主 Banner
                bannerContent(data: data)
                    .background(
                        RoundedRectangle(cornerRadius: isExpanded ? 20 : 28)
                            .fill(.ultraThinMaterial)
                            .shadow(color: .black.opacity(0.2), radius: 10, y: 5)
                    )
                    .clipShape(RoundedRectangle(cornerRadius: isExpanded ? 20 : 28))
                    .padding(.horizontal, isExpanded ? 16 : 60)
                    .offset(y: dragOffset)
                    .gesture(
                        DragGesture()
                            .onChanged { value in
                                if value.translation.height < 0 {
                                    dragOffset = value.translation.height
                                }
                            }
                            .onEnded { value in
                                if value.translation.height < -50 {
                                    // 向上滑动关闭
                                    withAnimation(.spring(response: 0.3)) {
                                        liveActivityManager.endActivity()
                                    }
                                } else {
                                    withAnimation(.spring(response: 0.3)) {
                                        dragOffset = 0
                                    }
                                }
                            }
                    )
                    .onTapGesture {
                        withAnimation(.spring(response: 0.3, dampingFraction: 0.7)) {
                            isExpanded.toggle()
                        }
                    }

                Spacer()
            }
            .transition(.move(edge: .top).combined(with: .opacity))
            .animation(.spring(response: 0.4, dampingFraction: 0.8), value: liveActivityManager.showFallbackBanner)
        }
    }

    @ViewBuilder
    private func bannerContent(data: FallbackBannerData) -> some View {
        if isExpanded {
            expandedBanner(data: data)
        } else {
            compactBanner(data: data)
        }
    }

    // MARK: - Compact Banner (类似灵动岛紧凑态)

    private func compactBanner(data: FallbackBannerData) -> some View {
        HStack(spacing: 12) {
            // 左侧：联盟颜色 + 图标
            HStack(spacing: 6) {
                Circle()
                    .fill(Color(hex: data.userAllianceColor) ?? .blue)
                    .frame(width: 10, height: 10)

                Image(systemName: "flame.fill")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundColor(.orange)
            }

            // 中间：赛事名称（可省略）
            Text(data.eventTitle)
                .font(.system(size: 13, weight: .semibold))
                .foregroundColor(.primary)
                .lineLimit(1)

            Spacer()

            // 右侧：排名 + 倒计时
            HStack(spacing: 6) {
                Text("#\(data.state.userRank)")
                    .font(.system(size: 16, weight: .bold, design: .rounded))
                    .foregroundColor(rankColor(data.state.userRank))

                Text(formatTime(data.state.secondsRemaining))
                    .font(.system(size: 12, weight: .medium, design: .monospaced))
                    .foregroundColor(.secondary)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
    }

    // MARK: - Expanded Banner (类似灵动岛展开态)

    private func expandedBanner(data: FallbackBannerData) -> some View {
        VStack(spacing: 12) {
            // 顶部：标题 + 倒计时
            HStack {
                HStack(spacing: 8) {
                    Image(systemName: "flame.fill")
                        .font(.title3)
                        .foregroundColor(.orange)

                    Text(data.eventTitle)
                        .font(.headline)
                        .foregroundColor(.primary)
                }

                Spacer()

                if data.state.secondsRemaining > 0 {
                    HStack(spacing: 4) {
                        Image(systemName: "clock")
                            .font(.caption)
                        Text(formatTimeDetailed(data.state.secondsRemaining))
                            .font(.system(size: 14, weight: .medium, design: .monospaced))
                    }
                    .foregroundColor(.secondary)
                } else {
                    Text(NSLocalizedString("event.ended", comment: ""))
                        .font(.caption)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(Color.red.opacity(0.2))
                        .foregroundColor(.red)
                        .cornerRadius(4)
                }
            }

            // 战况进度条
            GeometryReader { geometry in
                HStack(spacing: 2) {
                    ForEach(data.state.rankings) { ranking in
                        if ranking.score > 0 {
                            RoundedRectangle(cornerRadius: 3)
                                .fill(ranking.color)
                                .frame(width: max(4, geometry.size.width * ranking.score))
                        }
                    }
                }
            }
            .frame(height: 10)
            .clipShape(RoundedRectangle(cornerRadius: 5))

            // 排名列表
            HStack(spacing: 0) {
                // 我的排名
                VStack(alignment: .leading, spacing: 2) {
                    Text(NSLocalizedString("event.my_rank", comment: ""))
                        .font(.caption2)
                        .foregroundColor(.secondary)
                    HStack(spacing: 6) {
                        Text("#\(data.state.userRank)")
                            .font(.system(size: 24, weight: .bold, design: .rounded))
                            .foregroundColor(rankColor(data.state.userRank))
                        Circle()
                            .fill(Color(hex: data.userAllianceColor) ?? .blue)
                            .frame(width: 10, height: 10)
                        Text(data.userAllianceName)
                            .font(.caption)
                            .foregroundColor(.secondary)
                            .lineLimit(1)
                    }
                }

                Spacer()

                // 前三名
                HStack(spacing: 16) {
                    ForEach(Array(data.state.rankings.prefix(3).enumerated()), id: \.element.id) { index, ranking in
                        VStack(spacing: 4) {
                            Text(rankEmoji(index + 1))
                                .font(.system(size: 16))
                            Text(String(format: "%.0f%%", ranking.score * 100))
                                .font(.system(size: 14, weight: .bold, design: .rounded))
                                .foregroundColor(ranking.color)
                            Text(ranking.name)
                                .font(.system(size: 9))
                                .foregroundColor(.secondary)
                                .lineLimit(1)
                        }
                    }
                }
            }

            // 底部：总像素数 + 提示
            HStack {
                Text("\(data.state.totalPixels) 像素")
                    .font(.caption)
                    .foregroundColor(.secondary)

                Spacer()

                Text(NSLocalizedString("event.swipe_up_to_close", comment: ""))
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
            }
        }
        .padding(16)
    }

    // MARK: - Helpers

    private func rankColor(_ rank: Int) -> Color {
        switch rank {
        case 1: return .yellow
        case 2: return Color(white: 0.7)
        case 3: return .orange
        default: return .primary
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

    private func formatTime(_ seconds: Int) -> String {
        let minutes = seconds / 60
        let secs = seconds % 60
        return String(format: "%d:%02d", minutes, secs)
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

// MARK: - Preview

#Preview {
    ZStack {
        Color.gray.opacity(0.3)
            .ignoresSafeArea()

        VStack {
            // Simulated banner
            EventLiveActivityBanner()
        }
    }
    .onAppear {
        // Set up mock data for preview
        LiveActivityManager.shared.fallbackBannerData = FallbackBannerData(
            eventId: "test",
            eventTitle: "城市争夺战",
            userAllianceName: "蓝色风暴",
            userAllianceColor: "#4A90D9",
            state: EventActivityAttributes.ContentState(
                rankings: [
                    .init(id: "1", name: "红色军团", colorHex: "#FF4444", score: 0.45, pixelCount: 450),
                    .init(id: "2", name: "蓝色风暴", colorHex: "#4A90D9", score: 0.35, pixelCount: 350),
                    .init(id: "3", name: "绿色联盟", colorHex: "#44AA44", score: 0.20, pixelCount: 200)
                ],
                userRank: 2,
                totalPixels: 1000,
                secondsRemaining: 1845
            )
        )
        LiveActivityManager.shared.showFallbackBanner = true
    }
}
