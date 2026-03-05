import Combine
import SwiftUI

/// 段位进度条组件
/// 显示当前段位图标 → 进度条 → 下一段位图标
struct RankTierProgressBar: View {
    @ObservedObject private var fontManager = FontSizeManager.shared
    let tier: RankTier

    var body: some View {
        VStack(spacing: AppSpacing.s) {
            HStack(spacing: AppSpacing.s) {
                // 当前段位
                HStack(spacing: 4) {
                    Image(systemName: tier.icon)
                        .responsiveFont(.subheadline, weight: .semibold)
                        .foregroundColor(tier.swiftUIColor)
                    Text(tier.name)
                        .font(AppTypography.caption())
                        .foregroundColor(tier.swiftUIColor)
                }

                // 进度条
                GeometryReader { geometry in
                    ZStack(alignment: .leading) {
                        RoundedRectangle(cornerRadius: 4)
                            .fill(AppColors.surfaceSecondary)
                            .frame(height: 8)

                        RoundedRectangle(cornerRadius: 4)
                            .fill(
                                LinearGradient(
                                    colors: [tier.swiftUIColor.opacity(0.7), tier.swiftUIColor],
                                    startPoint: .leading,
                                    endPoint: .trailing
                                )
                            )
                            .frame(width: geometry.size.width * tier.progress, height: 8)
                    }
                }
                .frame(height: 8)

                // 下一段位图标（如果不是最高）
                if !tier.isMaxTier {
                    Image(systemName: tier.icon)
                        .responsiveFont(.subheadline, weight: .semibold)
                        .foregroundColor(AppColors.textTertiary)
                }
            }

            // 进度文字
            if tier.isMaxTier {
                Text(NSLocalizedString("rank.max_tier_reached", comment: ""))
                    .font(AppTypography.caption())
                    .foregroundColor(tier.swiftUIColor)
            } else {
                Text(String(format: NSLocalizedString("rank.pixels_to_upgrade", comment: ""), tier.gapToNext))
                    .font(AppTypography.caption())
                    .foregroundColor(AppColors.textTertiary)
            }
        }
    }
}
