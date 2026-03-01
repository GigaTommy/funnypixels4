import SwiftUI

/// P0-2: 活动玩法说明视图
struct EventGameplayView: View {
    let gameplay: EventGameplay
    @ObservedObject private var fontManager = FontSizeManager.shared

    var body: some View {
        VStack(alignment: .leading, spacing: AppSpacing.m) {
            // 标题和难度标签
            HStack {
                Label(NSLocalizedString("gameplay_guide", comment: ""), systemImage: "book.fill")
                    .font(fontManager.scaledFont(.headline))
                    .foregroundColor(AppColors.textPrimary)

                Spacer()

                DifficultyRatingView(difficulty: gameplay.difficulty, compact: true)
            }

            // 活动目标
            SectionView(
                title: NSLocalizedString("objective", comment: ""),
                icon: "target",
                content: gameplay.objective.localized()
            )

            // 计分规则
            VStack(alignment: .leading, spacing: AppSpacing.s) {
                HStack {
                    Image(systemName: "chart.bar.fill")
                        .foregroundColor(.blue)
                    Text(NSLocalizedString("scoring_rules", comment: ""))
                        .font(fontManager.scaledFont(.subheadline).bold())
                        .foregroundColor(AppColors.textPrimary)
                }

                VStack(alignment: .leading, spacing: AppSpacing.xs) {
                    ForEach(Array(gameplay.scoringRules.localized().enumerated()), id: \.offset) { index, rule in
                        HStack(alignment: .top, spacing: AppSpacing.xs) {
                            Text("\(index + 1).")
                                .font(fontManager.scaledFont(.caption))
                                .foregroundColor(AppColors.textSecondary)
                            Text(rule)
                                .font(fontManager.scaledFont(.caption))
                                .foregroundColor(AppColors.textSecondary)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }
                }
                .padding(AppSpacing.s)
                .background(AppColors.surface)
                .clipShape(RoundedRectangle(cornerRadius: AppRadius.s))
            }

            // 技巧提示
            VStack(alignment: .leading, spacing: AppSpacing.s) {
                HStack {
                    Image(systemName: "lightbulb.fill")
                        .foregroundColor(.yellow)
                    Text(NSLocalizedString("tips", comment: ""))
                        .font(fontManager.scaledFont(.subheadline).bold())
                        .foregroundColor(AppColors.textPrimary)
                }

                VStack(alignment: .leading, spacing: AppSpacing.xs) {
                    ForEach(Array(gameplay.tips.localized().enumerated()), id: \.offset) { index, tip in
                        HStack(alignment: .top, spacing: AppSpacing.xs) {
                            Image(systemName: "checkmark.circle.fill")
                                .font(fontManager.scaledFont(.caption2))
                                .foregroundColor(.green)
                            Text(tip)
                                .font(fontManager.scaledFont(.caption))
                                .foregroundColor(AppColors.textSecondary)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }
                }
                .padding(AppSpacing.s)
                .background(AppColors.surface)
                .clipShape(RoundedRectangle(cornerRadius: AppRadius.s))
            }

            // 底部元信息
            HStack(spacing: AppSpacing.m) {
                // P2-2: Use difficulty's estimatedTimePerDay
                let timeText = "\(gameplay.difficulty.estimatedTimePerDay)min/day"
                MetaTag(icon: "clock.fill", text: timeText)

                // P2-2: Use difficulty's recommendedFor
                ForEach(gameplay.difficulty.recommendedFor, id: \.self) { tag in
                    MetaTag(icon: "person.fill", text: tag)
                }
            }
        }
        .padding(AppSpacing.m)
        .background(AppColors.surfaceSecondary)
        .clipShape(RoundedRectangle(cornerRadius: AppRadius.m))
    }
}

/// 章节视图
private struct SectionView: View {
    let title: String
    let icon: String
    let content: String
    @ObservedObject private var fontManager = FontSizeManager.shared

    var body: some View {
        VStack(alignment: .leading, spacing: AppSpacing.s) {
            HStack {
                Image(systemName: icon)
                    .foregroundColor(.purple)
                Text(title)
                    .font(fontManager.scaledFont(.subheadline).bold())
                    .foregroundColor(AppColors.textPrimary)
            }

            Text(content)
                .font(fontManager.scaledFont(.body))
                .foregroundColor(AppColors.textSecondary)
                .padding(AppSpacing.s)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(AppColors.surface)
                .clipShape(RoundedRectangle(cornerRadius: AppRadius.s))
        }
    }
}

/// 难度徽章
private struct DifficultyBadge: View {
    let difficulty: String
    @ObservedObject private var fontManager = FontSizeManager.shared

    private var color: Color {
        switch difficulty.lowercased() {
        case "easy": return .green
        case "medium": return .orange
        case "hard": return .red
        default: return .gray
        }
    }

    var body: some View {
        Text(difficulty.uppercased())
            .font(fontManager.scaledFont(.caption2).bold())
            .foregroundColor(.white)
            .padding(.horizontal, AppSpacing.s)
            .padding(.vertical, AppSpacing.xs)
            .background(color)
            .clipShape(Capsule())
    }
}

/// 元标签
private struct MetaTag: View {
    let icon: String
    let text: String
    @ObservedObject private var fontManager = FontSizeManager.shared

    var body: some View {
        HStack(spacing: AppSpacing.xs) {
            Image(systemName: icon)
                .font(fontManager.scaledFont(.caption2))
            Text(text)
                .font(fontManager.scaledFont(.caption2))
        }
        .foregroundColor(AppColors.textSecondary)
        .padding(.horizontal, AppSpacing.s)
        .padding(.vertical, AppSpacing.xs)
        .background(AppColors.surface)
        .clipShape(Capsule())
    }
}
