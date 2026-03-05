import SwiftUI

/// 段位徽章组件
/// 显示段位图标 + 名称，可用于排行榜、个人主页、动态卡片等
struct RankTierBadge: View {
    @ObservedObject private var fontManager = FontSizeManager.shared
    let tier: RankTier
    var showName: Bool = true
    var fontSize: CGFloat = 12

    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: tier.icon)
                .font(.system(size: fontSize, weight: .semibold))
                .foregroundColor(tier.swiftUIColor)

            if showName {
                Text(tier.name)
                    .font(.system(size: fontSize, weight: .medium))
                    .foregroundColor(tier.swiftUIColor)
            }
        }
    }
}
