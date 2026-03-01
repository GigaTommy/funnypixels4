import SwiftUI

/// 前三名领奖台展示
struct Top3PodiumView: View {
    let entries: [LeaderboardService.LeaderboardEntry]

    private var first: LeaderboardService.LeaderboardEntry? { entries.first(where: { $0.rank == 1 }) }
    private var second: LeaderboardService.LeaderboardEntry? { entries.first(where: { $0.rank == 2 }) }
    private var third: LeaderboardService.LeaderboardEntry? { entries.first(where: { $0.rank == 3 }) }

    var body: some View {
        HStack(alignment: .bottom, spacing: AppSpacing.l) {
            // 第二名 (银)
            if let entry = second {
                podiumItem(entry: entry, height: 100, color: Color(hex: "#C0C0C0") ?? .gray)
            }

            // 第一名 (金)
            if let entry = first {
                VStack(spacing: 4) {
                    Image(systemName: "crown.fill")
                        .font(.system(size: 18))
                        .foregroundColor(Color(hex: "#FFD700") ?? .yellow)

                    podiumItem(entry: entry, height: 130, color: Color(hex: "#FFD700") ?? .yellow)
                }
            }

            // 第三名 (铜)
            if let entry = third {
                podiumItem(entry: entry, height: 80, color: Color(hex: "#CD7F32") ?? .brown)
            }
        }
        .padding(.vertical, AppSpacing.m)
    }

    private func podiumItem(entry: LeaderboardService.LeaderboardEntry, height: CGFloat, color: Color) -> some View {
        VStack(spacing: 4) {
            // 头像
            AvatarView(
                avatarUrl: entry.avatar_url,
                avatar: entry.avatar,
                avatarColor: entry.avatarColor,
                displayName: entry.displayName,
                flagPatternId: entry.flag_pattern_id ?? entry.flag_pattern,
                patternType: entry.pattern_type,
                unicodeChar: entry.unicode_char,
                size: entry.rank == 1 ? 56 : (entry.rank == 2 ? 48 : 44)
            )
            .overlay(
                Circle()
                    .stroke(color, lineWidth: 2)
            )

            // 昵称
            Text(entry.displayName)
                .font(entry.rank == 1 ? AppTypography.subheadline() : AppTypography.caption())
                .fontWeight(entry.rank == 1 ? .bold : .medium)
                .foregroundColor(AppColors.textPrimary)
                .lineLimit(1)
                .frame(maxWidth: 80)

            // 像素数
            Text("\(entry.total_pixels)")
                .font(entry.rank == 1 ? AppTypography.headline() : AppTypography.subheadline())
                .fontWeight(.bold)
                .foregroundColor(color)

            // 柱子
            RoundedRectangle(cornerRadius: AppRadius.m)
                .fill(
                    LinearGradient(
                        colors: [color.opacity(0.6), color],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                )
                .frame(width: 60, height: height)
                .overlay(
                    Text("#\(entry.rank)")
                        .font(.system(size: 16, weight: .bold, design: .rounded))
                        .foregroundColor(.white)
                        .padding(.top, 8),
                    alignment: .top
                )
        }
    }
}
