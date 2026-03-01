import SwiftUI

/// P0-3: 个人贡献统计卡片
struct EventContributionCard: View {
    let contribution: EventContribution
    @ObservedObject private var fontManager = FontSizeManager.shared

    var body: some View {
        VStack(spacing: AppSpacing.m) {
            // 标题
            HStack {
                Label(NSLocalizedString("my_contribution", comment: ""), systemImage: "person.crop.circle.fill")
                    .font(fontManager.scaledFont(.headline))
                    .foregroundColor(AppColors.textPrimary)
                Spacer()
            }

            // 主要统计
            HStack(spacing: AppSpacing.m) {
                // 我的像素数
                VStack(spacing: AppSpacing.xs) {
                    Text("\(contribution.pixelCount)")
                        .font(fontManager.scaledFont(.largeTitle).bold())
                        .foregroundColor(.blue)

                    Text(NSLocalizedString("my_pixels", comment: ""))
                        .font(fontManager.scaledFont(.caption))
                        .foregroundColor(AppColors.textSecondary)
                }
                .frame(maxWidth: .infinity)
                .padding(AppSpacing.m)
                .background(
                    LinearGradient(
                        colors: [Color.blue.opacity(0.2), Color.blue.opacity(0.05)],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                .clipShape(RoundedRectangle(cornerRadius: AppRadius.m))

                // 联盟信息（如果有）
                if let alliance = contribution.alliance {
                    VStack(spacing: AppSpacing.xs) {
                        Image(systemName: "shield.fill")
                            .font(fontManager.scaledFont(.title2))
                            .foregroundColor(.purple)

                        Text(alliance.name)
                            .font(fontManager.scaledFont(.caption).bold())
                            .foregroundColor(AppColors.textPrimary)
                            .lineLimit(1)

                        Text("\(alliance.totalPixels) pixels")
                            .font(fontManager.scaledFont(.caption2))
                            .foregroundColor(AppColors.textSecondary)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(AppSpacing.m)
                    .background(AppColors.surface)
                    .clipShape(RoundedRectangle(cornerRadius: AppRadius.m))
                }
            }

            // 贡献率和排名
            HStack(spacing: AppSpacing.m) {
                // 贡献率
                HStack(spacing: AppSpacing.s) {
                    Image(systemName: "chart.pie.fill")
                        .foregroundColor(.green)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(NSLocalizedString("contribution_rate", comment: ""))
                            .font(fontManager.scaledFont(.caption2))
                            .foregroundColor(AppColors.textSecondary)
                        Text(String(format: "%.1f%%", contribution.contributionRate * 100))
                            .font(fontManager.scaledFont(.subheadline).bold())
                            .foregroundColor(AppColors.textPrimary)
                    }
                }

                Spacer()

                // 联盟排名
                if let rank = contribution.rankInAlliance {
                    HStack(spacing: AppSpacing.s) {
                        Image(systemName: "medal.fill")
                            .foregroundColor(.orange)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(NSLocalizedString("rank_in_alliance", comment: ""))
                                .font(fontManager.scaledFont(.caption2))
                                .foregroundColor(AppColors.textSecondary)
                            Text("#\(rank)")
                                .font(fontManager.scaledFont(.subheadline).bold())
                                .foregroundColor(AppColors.textPrimary)
                        }
                    }
                }
            }
            .padding(AppSpacing.s)
            .background(AppColors.surface)
            .clipShape(RoundedRectangle(cornerRadius: AppRadius.s))

            // 里程碑进度
            MilestoneProgressView(milestones: contribution.milestones)

            // 顶级贡献者（如果有）
            if !contribution.topContributors.isEmpty {
                VStack(alignment: .leading, spacing: AppSpacing.s) {
                    Text(NSLocalizedString("top_contributors", comment: ""))
                        .font(fontManager.scaledFont(.subheadline).bold())
                        .foregroundColor(AppColors.textPrimary)

                    ForEach(contribution.topContributors.prefix(3)) { contributor in
                        ContributorRow(contributor: contributor)
                    }
                }
            }
        }
        .padding(AppSpacing.m)
        .background(AppColors.surfaceSecondary)
        .clipShape(RoundedRectangle(cornerRadius: AppRadius.m))
    }
}

/// 里程碑进度视图
private struct MilestoneProgressView: View {
    let milestones: MilestoneProgress
    @ObservedObject private var fontManager = FontSizeManager.shared

    var body: some View {
        VStack(alignment: .leading, spacing: AppSpacing.s) {
            HStack {
                Image(systemName: "flag.fill")
                    .foregroundColor(.yellow)
                Text(NSLocalizedString("milestones", comment: ""))
                    .font(fontManager.scaledFont(.subheadline).bold())
                    .foregroundColor(AppColors.textPrimary)

                Spacer()

                Text("\(milestones.current) / \(milestones.next)")
                    .font(fontManager.scaledFont(.caption))
                    .foregroundColor(AppColors.textSecondary)
            }

            // 进度条
            GeometryReader { geometry in
                ZStack(alignment: .leading) {
                    RoundedRectangle(cornerRadius: AppRadius.s)
                        .fill(AppColors.surface)
                        .frame(height: 8)

                    RoundedRectangle(cornerRadius: AppRadius.s)
                        .fill(
                            LinearGradient(
                                colors: [.green, .blue],
                                startPoint: .leading,
                                endPoint: .trailing
                            )
                        )
                        .frame(width: geometry.size.width * milestones.progress, height: 8)
                }
            }
            .frame(height: 8)

            // 已达成的里程碑
            if !milestones.achieved.isEmpty {
                HStack(spacing: AppSpacing.xs) {
                    ForEach(milestones.achieved, id: \.self) { milestone in
                        Text("\(milestone)")
                            .font(fontManager.scaledFont(.caption2).bold())
                            .foregroundColor(.white)
                            .padding(.horizontal, AppSpacing.xs)
                            .padding(.vertical, 2)
                            .background(Color.green)
                            .clipShape(Capsule())
                    }
                }
            }
        }
        .padding(AppSpacing.s)
        .background(AppColors.surface)
        .clipShape(RoundedRectangle(cornerRadius: AppRadius.s))
    }
}

/// 贡献者行
private struct ContributorRow: View {
    let contributor: ContributorInfo
    @ObservedObject private var fontManager = FontSizeManager.shared

    var body: some View {
        HStack(spacing: AppSpacing.s) {
            Image(systemName: "person.circle.fill")
                .foregroundColor(.blue)
                .font(fontManager.scaledFont(.body))

            Text(contributor.username)
                .font(fontManager.scaledFont(.subheadline))
                .foregroundColor(AppColors.textPrimary)

            Spacer()

            HStack(spacing: AppSpacing.xs) {
                Text("\(contributor.pixelCount)")
                    .font(fontManager.scaledFont(.subheadline).bold())
                    .foregroundColor(AppColors.textPrimary)

                Text(String(format: "(%.1f%%)", contributor.contributionRate * 100))
                    .font(fontManager.scaledFont(.caption))
                    .foregroundColor(AppColors.textSecondary)
            }
        }
        .padding(.horizontal, AppSpacing.s)
        .padding(.vertical, AppSpacing.xs)
        .background(AppColors.surface)
        .clipShape(RoundedRectangle(cornerRadius: AppRadius.s))
    }
}
