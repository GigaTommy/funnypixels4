import SwiftUI

/// P0-1: 活动报名统计视图
struct EventSignupStatsView: View {
    let stats: EventSignupStats
    @ObservedObject private var fontManager = FontSizeManager.shared

    var body: some View {
        VStack(spacing: AppSpacing.m) {
            // 标题
            HStack {
                Label(NSLocalizedString("signup_stats", comment: ""), systemImage: "person.3.fill")
                    .font(fontManager.scaledFont(.headline))
                    .foregroundColor(AppColors.textPrimary)
                Spacer()
            }

            // 统计卡片
            HStack(spacing: AppSpacing.m) {
                StatCard(
                    title: NSLocalizedString("alliances", comment: ""),
                    value: "\(stats.allianceCount)",
                    icon: "shield.fill",
                    color: .blue
                )

                StatCard(
                    title: NSLocalizedString("solo_players", comment: ""),
                    value: "\(stats.userCount)",
                    icon: "person.fill",
                    color: .green
                )

                StatCard(
                    title: NSLocalizedString("estimated_total", comment: ""),
                    value: "\(stats.estimatedParticipants)",
                    icon: "chart.bar.fill",
                    color: .orange
                )
            }

            // 状态指示器
            HStack {
                Image(systemName: stats.requirementsMet ? "checkmark.circle.fill" : "exclamationmark.circle.fill")
                    .foregroundColor(stats.requirementsMet ? .green : .orange)

                Text(stats.requirementsMet ? NSLocalizedString("requirements_met", comment: "") : NSLocalizedString("requirements_not_met", comment: ""))
                    .font(fontManager.scaledFont(.caption))
                    .foregroundColor(AppColors.textSecondary)

                Spacer()
            }
            .padding(.horizontal, AppSpacing.s)
            .padding(.vertical, AppSpacing.xs)
            .background(
                RoundedRectangle(cornerRadius: AppRadius.s)
                    .fill(stats.requirementsMet ? Color.green.opacity(0.1) : Color.orange.opacity(0.1))
            )

            // 顶级联盟
            if !stats.topAlliances.isEmpty {
                VStack(alignment: .leading, spacing: AppSpacing.s) {
                    Text(NSLocalizedString("top_alliances", comment: ""))
                        .font(fontManager.scaledFont(.subheadline))
                        .foregroundColor(AppColors.textPrimary)

                    ForEach(stats.topAlliances.prefix(3)) { alliance in
                        AllianceRow(alliance: alliance)
                    }
                }
            }
        }
        .padding(AppSpacing.m)
        .background(AppColors.surfaceSecondary)
        .clipShape(RoundedRectangle(cornerRadius: AppRadius.m))
    }
}

/// 统计卡片组件
private struct StatCard: View {
    let title: String
    let value: String
    let icon: String
    let color: Color
    @ObservedObject private var fontManager = FontSizeManager.shared

    var body: some View {
        VStack(spacing: AppSpacing.xs) {
            Image(systemName: icon)
                .font(fontManager.scaledFont(.title3))
                .foregroundColor(color)

            Text(value)
                .font(fontManager.scaledFont(.title2).bold())
                .foregroundColor(AppColors.textPrimary)

            Text(title)
                .font(fontManager.scaledFont(.caption2))
                .foregroundColor(AppColors.textSecondary)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
        }
        .frame(maxWidth: .infinity)
        .padding(AppSpacing.s)
        .background(AppColors.surface)
        .clipShape(RoundedRectangle(cornerRadius: AppRadius.s))
    }
}

/// 联盟行组件
private struct AllianceRow: View {
    let alliance: AllianceSignupInfo
    @ObservedObject private var fontManager = FontSizeManager.shared

    var body: some View {
        HStack(spacing: AppSpacing.s) {
            Image(systemName: "shield.fill")
                .foregroundColor(.blue)
                .font(fontManager.scaledFont(.caption))

            Text(alliance.name)
                .font(fontManager.scaledFont(.subheadline))
                .foregroundColor(AppColors.textPrimary)

            Spacer()

            HStack(spacing: AppSpacing.xs) {
                Image(systemName: "person.2.fill")
                    .font(fontManager.scaledFont(.caption2))
                Text("\(alliance.memberCount)")
                    .font(fontManager.scaledFont(.caption))
            }
            .foregroundColor(AppColors.textSecondary)

            HStack(spacing: AppSpacing.xs) {
                Image(systemName: "bolt.fill")
                    .font(fontManager.scaledFont(.caption2))
                Text("\(alliance.power)")
                    .font(fontManager.scaledFont(.caption))
            }
            .foregroundColor(.orange)
        }
        .padding(AppSpacing.xs)
        .background(AppColors.surface)
        .clipShape(RoundedRectangle(cornerRadius: AppRadius.s))
    }
}
