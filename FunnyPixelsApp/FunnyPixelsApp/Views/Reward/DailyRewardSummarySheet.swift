import SwiftUI

struct DailyRewardSummarySheet: View {
    let summary: DailyRewardService.RewardSummary
    @Environment(\.dismiss) private var dismiss
    @State private var appeared = false

    var body: some View {
        VStack(spacing: DesignTokens.Spacing.xl) {
            // Title section
            titleSection

            // Ranking rows
            rankingList

            // Total earned card
            totalCard

            // Dismiss button
            dismissButton
        }
        .padding(DesignTokens.Spacing.lg)
        .padding(.top, DesignTokens.Spacing.sm)
        .onAppear {
            guard !appeared else { return }
            appeared = true
            HapticManager.shared.notification(type: .success)
            SoundManager.shared.playSuccess()
        }
    }

    // MARK: - Title

    private var titleSection: some View {
        VStack(spacing: DesignTokens.Spacing.xs) {
            HStack(spacing: DesignTokens.Spacing.sm) {
                Image(systemName: "star.fill")
                    .font(.title2)
                    .foregroundColor(DesignTokens.Colors.accent)
                Text(NSLocalizedString("reward.summary.title", comment: ""))
                    .font(DesignTokens.Typography.title2)
                    .foregroundColor(DesignTokens.Colors.textPrimary)
            }

            Text(formattedSubtitle)
                .font(DesignTokens.Typography.caption)
                .foregroundColor(DesignTokens.Colors.textSecondary)
        }
    }

    private var formattedSubtitle: String {
        NSLocalizedString("reward.summary.subtitle", comment: "")
    }

    // MARK: - Ranking List

    private var rankingList: some View {
        VStack(spacing: 0) {
            rankingRow(
                icon: "trophy",
                label: NSLocalizedString("reward.summary.personal", comment: ""),
                rank: summary.personal_rank,
                points: summary.personal_points
            )

            Divider().padding(.horizontal, DesignTokens.Spacing.md)

            rankingRow(
                icon: "shield.fill",
                label: NSLocalizedString("reward.summary.alliance", comment: ""),
                rank: summary.alliance_rank,
                points: summary.alliance_points
            )

            Divider().padding(.horizontal, DesignTokens.Spacing.md)

            rankingRow(
                icon: "person.2.fill",
                label: NSLocalizedString("reward.summary.friends", comment: ""),
                rank: summary.friends_rank,
                points: summary.friends_points
            )
        }
        .background(
            RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.xl)
                .fill(DesignTokens.Colors.backgroundSecondary)
        )
    }

    private func rankingRow(icon: String, label: String, rank: Int?, points: Int) -> some View {
        HStack(spacing: DesignTokens.Spacing.md) {
            Image(systemName: icon)
                .font(.body)
                .foregroundColor(DesignTokens.Colors.accent)
                .frame(width: 24)

            if let rank = rank {
                Text(String(format: NSLocalizedString("reward.summary.rank", comment: ""), rank))
                    .font(DesignTokens.Typography.numeric)
                    .foregroundColor(DesignTokens.Colors.textPrimary)
            } else {
                Text(NSLocalizedString("reward.summary.no_rank", comment: ""))
                    .font(DesignTokens.Typography.body)
                    .foregroundColor(DesignTokens.Colors.textSecondary.opacity(0.6))
            }

            Text(label)
                .font(DesignTokens.Typography.body)
                .foregroundColor(DesignTokens.Colors.textPrimary)

            Spacer()

            if points > 0 {
                Text(String(format: NSLocalizedString("reward.summary.points", comment: ""), points))
                    .font(DesignTokens.Typography.numeric)
                    .foregroundColor(DesignTokens.Colors.accent)
            }
        }
        .padding(.horizontal, DesignTokens.Spacing.lg)
        .padding(.vertical, DesignTokens.Spacing.md)
    }

    // MARK: - Total Card

    private var totalCard: some View {
        VStack(spacing: DesignTokens.Spacing.xs) {
            Text(NSLocalizedString("reward.summary.total", comment: ""))
                .font(DesignTokens.Typography.caption)
                .foregroundColor(DesignTokens.Colors.accent)

            Text(String(format: NSLocalizedString("reward.summary.points", comment: ""), summary.total_points))
                .font(DesignTokens.Typography.largeNumeric)
                .foregroundColor(DesignTokens.Colors.accent)
        }
        .frame(maxWidth: .infinity)
        .padding(DesignTokens.Spacing.lg)
        .background(
            RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.xl)
                .fill(DesignTokens.Colors.accent.opacity(0.1))
        )
    }

    // MARK: - Dismiss Button

    private var dismissButton: some View {
        Button {
            Task {
                try? await DailyRewardService.shared.acknowledge(date: summary.reward_date)
            }
            dismiss()
        } label: {
            Text(NSLocalizedString("reward.summary.dismiss", comment: ""))
                .font(DesignTokens.Typography.body.weight(.semibold))
                .foregroundColor(.white)
                .frame(maxWidth: .infinity)
                .padding(.vertical, DesignTokens.Spacing.md)
                .background(
                    Capsule().fill(DesignTokens.Colors.accent)
                )
        }
    }
}
