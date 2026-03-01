import SwiftUI

/// 个人排名卡片 - 排行榜顶部固定显示
struct MyRankCard: View {
    let myRank: LeaderboardService.MyRank

    var body: some View {
        StandardCard(padding: AppSpacing.l) {
            HStack(spacing: AppSpacing.m) {
                // 排名数字
                VStack(spacing: 2) {
                    Text("#\(myRank.rank)")
                        .font(.system(size: 28, weight: .bold, design: .rounded))
                        .foregroundColor(AppColors.primary)
                    Text(NSLocalizedString("leaderboard.myrank.label", comment: "My Rank"))
                        .font(AppTypography.caption())
                        .foregroundColor(AppColors.textTertiary)
                }
                .frame(width: 80)

                // 分隔线
                Rectangle()
                    .fill(AppColors.border)
                    .frame(width: 1, height: 50)

                // 详情
                VStack(alignment: .leading, spacing: 6) {
                    // 像素数 + 段位
                    HStack(spacing: 6) {
                        Text(String(format: NSLocalizedString("leaderboard.myrank.pixels", comment: "%d Pixels"), myRank.totalPixels))
                            .font(AppTypography.headline())
                            .foregroundColor(AppColors.textPrimary)

                        if let tier = myRank.rankTier {
                            RankTierBadge(tier: tier, fontSize: 11)
                        }
                    }

                    // 差距
                    if myRank.gapToNext > 0 {
                        Text(String(format: NSLocalizedString("leaderboard.myrank.gap", comment: "%d pixels to next rank"), myRank.gapToNext))
                            .font(AppTypography.caption())
                            .foregroundColor(AppColors.textTertiary)
                    } else if myRank.rank == 1 {
                        Text(NSLocalizedString("leaderboard.myrank.first", comment: "You are #1!"))
                            .font(AppTypography.caption())
                            .foregroundColor(AppColors.secondary)
                    }

                    // 百分位
                    Text(String(format: NSLocalizedString("leaderboard.myrank.percentile", comment: "Top %.1f%%"), myRank.percentile))
                        .font(AppTypography.caption())
                        .foregroundColor(AppColors.textSecondary)
                }

                Spacer()
            }
        }
    }
}
