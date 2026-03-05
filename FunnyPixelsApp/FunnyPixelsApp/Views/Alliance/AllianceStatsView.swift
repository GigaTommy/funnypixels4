import SwiftUI

struct AllianceStatsView: View {
    @ObservedObject var viewModel: AllianceViewModel
    @ObservedObject private var fontManager = FontSizeManager.shared
    let allianceId: Int
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        Group {
            if viewModel.isLoadingStats && viewModel.allianceStats == nil {
                ProgressView()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if let error = viewModel.statsError, viewModel.allianceStats == nil {
                VStack(spacing: 16) {
                    Image(systemName: "exclamationmark.triangle")
                        .font(.system(size: 40))
                        .foregroundColor(.secondary)
                    Text(error)
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                        .multilineTextAlignment(.center)
                    Button(NSLocalizedString("policy.retry", comment: "Retry")) {
                        Task { await viewModel.loadStats(for: allianceId) }
                    }
                    .buttonStyle(.bordered)
                }
                .padding()
            } else if let stats = viewModel.allianceStats {
                ScrollView {
                    VStack(spacing: 20) {
                        overviewCard(stats)
                        comparisonSection(stats)
                        rankSection(stats)
                    }
                    .padding()
                }
            } else {
                VStack(spacing: 12) {
                    Image(systemName: "chart.bar")
                        .font(.system(size: 40))
                        .foregroundColor(.secondary)
                    Text(NSLocalizedString("alliance.stats.empty.title", comment: "No Stats"))
                        .font(.headline)
                        .foregroundColor(.secondary)
                    Text(NSLocalizedString("alliance.stats.empty.message", comment: "Statistics are not available yet."))
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                        .multilineTextAlignment(.center)
                }
                .padding()
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
        .navigationTitle(NSLocalizedString("alliance.stats.title", comment: "Statistics"))
        .navigationBarTitleDisplayMode(.inline)
        .hideTabBar()
        .background(AppColors.background)
        .task {
            await viewModel.loadStats(for: allianceId)
        }
        .refreshable {
            await viewModel.loadStats(for: allianceId)
        }
    }

    // Overview card
    private func overviewCard(_ stats: AllianceService.AllianceStats) -> some View {
        VStack(spacing: 16) {
            HStack {
                Text(NSLocalizedString("alliance.stats.core", comment: "Core Metrics"))
                    .font(.headline)
                Spacer()
                Text(stats.dataSource == "db" ? NSLocalizedString("alliance.stats.realtime", comment: "Real-time") : NSLocalizedString("alliance.stats.cached", comment: "Cached"))
                    .font(.caption)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 2)
                    .background(Color.blue.opacity(0.1))
                    .foregroundColor(.blue)
                    .cornerRadius(4)
            }

            Divider()

            HStack {
                StatItem(title: NSLocalizedString("alliance.stats.total_pixels", comment: "Total Pixels"), value: "\(stats.totalPixels)", icon: "pencil.tip", color: .blue)
                Spacer()
                StatItem(title: NSLocalizedString("alliance.stats.members", comment: "Members"), value: "\(stats.memberCount)", icon: "person.2.fill", color: .orange)
            }

            HStack {
                StatItem(title: NSLocalizedString("alliance.stats.ownership", comment: "Ownership"), value: "\(stats.currentPixels)", icon: "square.grid.2x2.fill", color: .green)
                Spacer()
                StatItem(title: NSLocalizedString("alliance.stats.rank", comment: "Rank"), value: "#\(stats.rank ?? 0)", icon: "star.fill", color: .purple)
            }
        }
        .padding()
        .background(AppColors.surface)
        .cornerRadius(16)
        .shadow(color: .black.opacity(0.04), radius: 8, x: 0, y: 4)
    }

    // Comparison section
    private func comparisonSection(_ stats: AllianceService.AllianceStats) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            Text(NSLocalizedString("alliance.stats.comparison", comment: "Data Comparison"))
                .font(.headline)
                .padding(.horizontal)

            if let comparison = stats.comparison {
                VStack(spacing: 12) {
                    comparisonRow(
                        title: NSLocalizedString("alliance.stats.total_draw_pixels", comment: "Total Draw Pixels"),
                        real: comparison.originalTotalPixels - comparison.proposedPixelsDelta,
                        original: comparison.originalTotalPixels,
                        delta: comparison.proposedPixelsDelta
                    )

                    Divider()

                    comparisonRow(
                        title: NSLocalizedString("alliance.stats.current_ownership", comment: "Current Ownership"),
                        real: comparison.originalCurrentPixels - comparison.proposedOwnershipDelta,
                        original: comparison.originalCurrentPixels,
                        delta: comparison.proposedOwnershipDelta
                    )
                }
                .padding()
                .background(AppColors.surface)
                .cornerRadius(16)
                .shadow(color: .black.opacity(0.04), radius: 8, x: 0, y: 4)

                Text(NSLocalizedString("alliance.stats.comparison_note", comment: "Comparison Note"))
                    .font(.caption2)
                    .foregroundColor(.secondary)
                    .padding(.horizontal)
            } else {
                Text(NSLocalizedString("alliance.stats.no_comparison", comment: "No Comparison"))
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    .padding()
                    .frame(maxWidth: .infinity)
                    .background(AppColors.surface)
                    .cornerRadius(16)
            }
        }
    }

    private func comparisonRow(title: String, real: Int, original: Int, delta: Int) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.subheadline)
                .foregroundColor(.secondary)

            HStack(alignment: .bottom) {
                VStack(alignment: .leading) {
                    Text("\(real)")
                        .responsiveFont(.title2, weight: .bold)
                        .foregroundColor(.primary)
                    Text(NSLocalizedString("alliance.stats.real", comment: "Real"))
                        .font(.caption2)
                        .foregroundColor(.blue)
                }

                Spacer()

                VStack(alignment: .trailing) {
                    Text("\(delta)")
                        .responsiveFont(.headline, weight: .medium)
                        .foregroundColor(.red)
                    Text(NSLocalizedString("alliance.stats.prop_contribution", comment: "From Items"))
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }
            }

            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    RoundedRectangle(cornerRadius: 2)
                        .fill(Color(.systemGray6))
                        .frame(height: 4)

                    let ratio = original > 0 ? CGFloat(real) / CGFloat(original) : 0
                    RoundedRectangle(cornerRadius: 2)
                        .fill(Color.blue)
                        .frame(width: geo.size.width * ratio, height: 4)
                }
            }
            .frame(height: 4)
        }
    }

    // Rank section
    private func rankSection(_ stats: AllianceService.AllianceStats) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(NSLocalizedString("alliance.stats.influence", comment: "Influence"))
                .font(.headline)

            HStack(spacing: 12) {
                InfluenceItem(title: NSLocalizedString("alliance.stats.world_rank", comment: "World Rank"), value: stats.rank != nil ? "\(stats.rank!)" : "--", icon: "globe", color: .purple)
                InfluenceItem(title: NSLocalizedString("alliance.stats.territory", comment: "Territory"), value: "\(stats.territory)", icon: "map.fill", color: .orange)
            }
        }
    }
}

private struct StatItem: View {
    let title: String
    let value: String
    let icon: String
    let color: Color

    var body: some View {
        HStack(spacing: 12) {
            ZStack {
                Circle()
                    .fill(color.opacity(0.1))
                    .frame(width: 36, height: 36)
                Image(systemName: icon)
                    .responsiveFont(.headline)
                    .foregroundColor(color)
            }

            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .responsiveFont(.caption2)
                    .foregroundColor(.secondary)
                Text(value)
                    .responsiveFont(.title3, weight: .bold)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

private struct InfluenceItem: View {
    let title: String
    let value: String
    let icon: String
    let color: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: icon)
                    .foregroundColor(color)
                Text(title)
                    .responsiveFont(.caption)
                    .foregroundColor(.secondary)
                Spacer()
            }

            Text(value)
                .responsiveFont(.title2, weight: .bold)
        }
        .padding()
        .frame(maxWidth: .infinity)
        .background(AppColors.surface)
        .cornerRadius(16)
        .shadow(color: .black.opacity(0.04), radius: 8, x: 0, y: 4)
    }
}
