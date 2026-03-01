import SwiftUI

/// P2-2: Event Difficulty Rating Display Component
struct DifficultyRatingView: View {
    let difficulty: EventDifficulty
    let compact: Bool

    @ObservedObject private var fontManager = FontSizeManager.shared

    init(difficulty: EventDifficulty, compact: Bool = false) {
        self.difficulty = difficulty
        self.compact = compact
    }

    var body: some View {
        if compact {
            compactView
        } else {
            fullView
        }
    }

    // MARK: - Compact View (for EventCard)

    private var compactView: some View {
        HStack(spacing: AppSpacing.xs) {
            // Difficulty stars
            starsView

            // Time estimate
            if difficulty.estimatedTimePerDay > 0 {
                Text("•")
                    .foregroundColor(AppColors.textSecondary)
                    .font(fontManager.scaledFont(.caption2))

                HStack(spacing: 4) {
                    Image(systemName: "clock.fill")
                        .font(fontManager.scaledFont(.caption2))
                    Text(timeText)
                        .font(fontManager.scaledFont(.caption2))
                }
                .foregroundColor(AppColors.textSecondary)
            }
        }
    }

    // MARK: - Full View (for EventDetailView)

    private var fullView: some View {
        VStack(alignment: .leading, spacing: AppSpacing.m) {
            // Header
            HStack(spacing: AppSpacing.s) {
                Text(NSLocalizedString("event.difficulty.title", comment: "Difficulty"))
                    .font(fontManager.scaledFont(.headline).weight(.semibold))
                    .foregroundColor(AppColors.textPrimary)

                Spacer()

                starsView
            }

            // Time commitment
            HStack(spacing: AppSpacing.s) {
                Image(systemName: "clock.fill")
                    .font(fontManager.scaledFont(.subheadline))
                    .foregroundColor(difficultyColor)

                VStack(alignment: .leading, spacing: 2) {
                    Text(NSLocalizedString("event.difficulty.time_commitment", comment: "Time Commitment"))
                        .font(fontManager.scaledFont(.caption).weight(.medium))
                        .foregroundColor(AppColors.textSecondary)
                    Text(timeText)
                        .font(fontManager.scaledFont(.subheadline).weight(.medium))
                        .foregroundColor(AppColors.textPrimary)
                }

                Spacer()
            }
            .padding(.vertical, AppSpacing.xs)

            // Difficulty factors (optional detailed view)
            if !compact {
                VStack(spacing: AppSpacing.xs) {
                    factorRow(
                        label: NSLocalizedString("event.difficulty.competition", comment: "Competition"),
                        value: difficulty.factors.competition
                    )
                    factorRow(
                        label: NSLocalizedString("event.difficulty.time_required", comment: "Time Required"),
                        value: difficulty.factors.timeCommitment
                    )
                    factorRow(
                        label: NSLocalizedString("event.difficulty.skill_level", comment: "Skill Level"),
                        value: difficulty.factors.skillRequired
                    )
                }
            }

            // Recommended for tags
            if !difficulty.recommendedFor.isEmpty {
                VStack(alignment: .leading, spacing: AppSpacing.xs) {
                    Text(NSLocalizedString("event.difficulty.recommended_for", comment: "Recommended For"))
                        .font(fontManager.scaledFont(.caption).weight(.medium))
                        .foregroundColor(AppColors.textSecondary)

                    FlowLayout(spacing: AppSpacing.xs) {
                        ForEach(difficulty.recommendedFor, id: \.self) { tag in
                            recommendedTag(tag)
                        }
                    }
                }
            }
        }
        .padding()
        .background(Color(uiColor: .secondarySystemGroupedBackground))
        .cornerRadius(AppRadius.m)
    }

    // MARK: - Subviews

    private var starsView: some View {
        HStack(spacing: 2) {
            ForEach(1...5, id: \.self) { index in
                Image(systemName: index <= difficulty.level ? "star.fill" : "star")
                    .font(fontManager.scaledFont(compact ? .caption : .subheadline))
                    .foregroundColor(index <= difficulty.level ? difficultyColor : Color.gray.opacity(0.3))
            }
        }
    }

    private func factorRow(label: String, value: Int) -> some View {
        HStack(spacing: AppSpacing.s) {
            Text(label)
                .font(fontManager.scaledFont(.caption))
                .foregroundColor(AppColors.textSecondary)

            Spacer()

            HStack(spacing: 2) {
                ForEach(1...5, id: \.self) { index in
                    Circle()
                        .fill(index <= value ? difficultyColor : Color.gray.opacity(0.2))
                        .frame(width: 6, height: 6)
                }
            }
        }
    }

    private func recommendedTag(_ tag: String) -> some View {
        Text(localizedTag(tag))
            .font(fontManager.scaledFont(.caption2).weight(.medium))
            .foregroundColor(difficultyColor)
            .padding(.horizontal, AppSpacing.s)
            .padding(.vertical, 4)
            .background(difficultyColor.opacity(0.1))
            .cornerRadius(AppRadius.s)
    }

    // MARK: - Helpers

    private var difficultyColor: Color {
        switch difficulty.level {
        case 1:
            return .green
        case 2:
            return Color(hex: "7CB342") ?? .green // Light green
        case 3:
            return .orange
        case 4:
            return Color(hex: "FF6F00") ?? .orange // Dark orange
        case 5:
            return .red
        default:
            return .gray
        }
    }

    private var timeText: String {
        let hours = Double(difficulty.estimatedTimePerDay) / 60.0
        if hours < 1 {
            return String(format: NSLocalizedString("event.difficulty.time_minutes", comment: "%d min/day"), difficulty.estimatedTimePerDay)
        } else if hours.truncatingRemainder(dividingBy: 1) == 0 {
            return String(format: NSLocalizedString("event.difficulty.time_hours", comment: "%.0f hrs/day"), hours)
        } else {
            return String(format: NSLocalizedString("event.difficulty.time_hours_decimal", comment: "%.1f hrs/day"), hours)
        }
    }

    private func localizedTag(_ tag: String) -> String {
        return NSLocalizedString("event.difficulty.tag.\(tag)", comment: tag)
    }
}

/// Simple flow layout for tags
private struct FlowLayout: Layout {
    var spacing: CGFloat

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let result = FlowResult(in: proposal.replacingUnspecifiedDimensions().width, subviews: subviews, spacing: spacing)
        return result.size
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let result = FlowResult(in: bounds.width, subviews: subviews, spacing: spacing)
        for (index, subview) in subviews.enumerated() {
            subview.place(at: CGPoint(x: bounds.minX + result.frames[index].minX, y: bounds.minY + result.frames[index].minY), proposal: .unspecified)
        }
    }

    struct FlowResult {
        var frames: [CGRect] = []
        var size: CGSize = .zero

        init(in maxWidth: CGFloat, subviews: Subviews, spacing: CGFloat) {
            var x: CGFloat = 0
            var y: CGFloat = 0
            var lineHeight: CGFloat = 0

            for subview in subviews {
                let size = subview.sizeThatFits(.unspecified)

                if x + size.width > maxWidth && x > 0 {
                    x = 0
                    y += lineHeight + spacing
                    lineHeight = 0
                }

                frames.append(CGRect(x: x, y: y, width: size.width, height: size.height))
                lineHeight = max(lineHeight, size.height)
                x += size.width + spacing
            }

            self.size = CGSize(width: maxWidth, height: y + lineHeight)
        }
    }
}

// MARK: - Preview

#Preview("Compact - Easy") {
    DifficultyRatingView(
        difficulty: EventDifficulty(
            level: 1,
            factors: EventDifficultyFactors(competition: 1, timeCommitment: 2, skillRequired: 2),
            estimatedTimePerDay: 75,
            recommendedFor: ["beginners", "casual_players"]
        ),
        compact: true
    )
    .padding()
}

#Preview("Compact - Hard") {
    DifficultyRatingView(
        difficulty: EventDifficulty(
            level: 5,
            factors: EventDifficultyFactors(competition: 5, timeCommitment: 4, skillRequired: 4),
            estimatedTimePerDay: 210,
            recommendedFor: ["experienced_players"]
        ),
        compact: true
    )
    .padding()
}

#Preview("Full - Medium") {
    DifficultyRatingView(
        difficulty: EventDifficulty(
            level: 3,
            factors: EventDifficultyFactors(competition: 4, timeCommitment: 3, skillRequired: 3),
            estimatedTimePerDay: 150,
            recommendedFor: ["alliances", "active_players"]
        ),
        compact: false
    )
    .padding()
    .background(Color(uiColor: .systemGroupedBackground))
}
