import SwiftUI
import Charts

/// P1-4: Event Ranking Trend Chart
/// Displays ranking history as a line chart with inverted Y-axis (rank 1 at top)
struct EventTrendChart: View {
    let eventId: String
    @State private var snapshots: [RankingSnapshot] = []
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var selectedTimeRange: TimeRange = .hours24
    @State private var selectedUserId: String?
    @ObservedObject private var fontManager = FontSizeManager.shared

    enum TimeRange: Int, CaseIterable {
        case hours6 = 6
        case hours12 = 12
        case hours24 = 24

        var title: String {
            switch self {
            case .hours6: return NSLocalizedString("event.trend.6h", comment: "6h")
            case .hours12: return NSLocalizedString("event.trend.12h", comment: "12h")
            case .hours24: return NSLocalizedString("event.trend.24h", comment: "24h")
            }
        }
    }

    var body: some View {
        VStack(spacing: AppSpacing.m) {
            // Header with time range selector
            HStack {
                Text(NSLocalizedString("event.rank_trend", comment: "Rank Trend"))
                    .font(fontManager.scaledFont(.headline).weight(.semibold))
                    .foregroundColor(AppColors.textPrimary)

                Spacer()

                // Time range picker
                Picker("Range", selection: $selectedTimeRange) {
                    ForEach(TimeRange.allCases, id: \.self) { range in
                        Text(range.title).tag(range)
                    }
                }
                .pickerStyle(.segmented)
                .frame(width: 180)
            }
            .padding(.horizontal)

            // Chart or loading/error state
            if isLoading {
                ProgressView()
                    .frame(height: 200)
            } else if let error = errorMessage {
                VStack(spacing: AppSpacing.s) {
                    Image(systemName: "chart.line.uptrend.xyaxis.circle")
                        .font(.system(size: 48))
                        .foregroundColor(AppColors.textTertiary)
                    Text(error)
                        .font(fontManager.scaledFont(.subheadline))
                        .foregroundColor(AppColors.textSecondary)
                        .multilineTextAlignment(.center)
                }
                .frame(height: 200)
                .padding()
            } else if snapshots.isEmpty {
                VStack(spacing: AppSpacing.s) {
                    Image(systemName: "chart.line.downtrend.xyaxis")
                        .font(.system(size: 48))
                        .foregroundColor(AppColors.textTertiary)
                    Text(NSLocalizedString("event.trend.no_data", comment: "No trend data available yet"))
                        .font(fontManager.scaledFont(.subheadline))
                        .foregroundColor(AppColors.textSecondary)
                }
                .frame(height: 200)
            } else {
                chartView
                    .frame(height: 250)
                    .padding(.horizontal)
            }
        }
        .padding(.vertical)
        .background(Color(uiColor: .secondarySystemGroupedBackground))
        .cornerRadius(AppRadius.l)
        .task {
            await loadHistory()
        }
        .onChange(of: selectedTimeRange) { oldValue, newValue in
            Task {
                await loadHistory()
            }
        }
    }

    // MARK: - Chart View

    @ViewBuilder
    private var chartView: some View {
        if let trendData = extractTrendData() {
            Chart {
                ForEach(trendData.userTrends, id: \.userId) { userTrend in
                    ForEach(userTrend.dataPoints) { point in
                        LineMark(
                            x: .value("Time", point.timestamp),
                            y: .value("Rank", point.rank)
                        )
                        .foregroundStyle(by: .value("User", userTrend.username))
                        .lineStyle(StrokeStyle(lineWidth: userTrend.isCurrentUser ? 3 : 1.5))
                    }
                    .symbol(Circle())
                }
            }
            .chartYScale(domain: .automatic(includesZero: false, reversed: true))  // Invert Y-axis
            .chartYAxis {
                AxisMarks(position: .leading) { value in
                    AxisGridLine()
                    AxisValueLabel {
                        if let rank = value.as(Int.self) {
                            Text("#\(rank)")
                                .font(fontManager.scaledFont(.caption))
                        }
                    }
                }
            }
            .chartXAxis {
                AxisMarks(values: .automatic(desiredCount: 5)) { value in
                    AxisGridLine()
                    AxisValueLabel {
                        if let date = value.as(Date.self) {
                            Text(formatTime(date))
                                .font(fontManager.scaledFont(.caption2))
                        }
                    }
                }
            }
            .chartLegend(position: .bottom, spacing: 8) {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 12) {
                        ForEach(trendData.userTrends.prefix(5), id: \.userId) { userTrend in
                            HStack(spacing: 4) {
                                Circle()
                                    .fill(userTrend.isCurrentUser ? Color.blue : Color.gray)
                                    .frame(width: 8, height: 8)
                                Text(userTrend.username)
                                    .font(fontManager.scaledFont(.caption2))
                                    .foregroundColor(AppColors.textSecondary)
                            }
                        }
                    }
                }
            }
        }
    }

    // MARK: - Data Loading

    private func loadHistory() async {
        isLoading = true
        errorMessage = nil

        do {
            let history = try await EventService.shared.getRankingHistory(
                eventId: eventId,
                hours: selectedTimeRange.rawValue
            )
            await MainActor.run {
                self.snapshots = history
                self.isLoading = false
            }
        } catch {
            await MainActor.run {
                self.errorMessage = NSLocalizedString("event.trend.load_failed", comment: "Failed to load trend data")
                self.isLoading = false
            }
            Logger.error("Failed to load ranking history: \(error)")
        }
    }

    // MARK: - Helpers

    private func extractTrendData() -> TrendData? {
        guard !snapshots.isEmpty else { return nil }

        // Track top 5 users across all snapshots
        var userDataMap: [String: UserTrendData] = [:]

        for snapshot in snapshots {
            for ranking in snapshot.rankings.prefix(10) {  // Track top 10
                if userDataMap[ranking.userId] == nil {
                    userDataMap[ranking.userId] = UserTrendData(
                        userId: ranking.userId,
                        username: ranking.username,
                        dataPoints: [],
                        isCurrentUser: false  // TODO: Check if current user
                    )
                }

                userDataMap[ranking.userId]?.dataPoints.append(
                    RankDataPoint(
                        timestamp: snapshot.timestamp,
                        rank: ranking.rank,
                        pixels: ranking.pixels
                    )
                )
            }
        }

        // Sort by average rank and take top 5
        let topUsers = userDataMap.values
            .sorted { user1, user2 in
                let avg1 = user1.dataPoints.map(\.rank).reduce(0, +) / user1.dataPoints.count
                let avg2 = user2.dataPoints.map(\.rank).reduce(0, +) / user2.dataPoints.count
                return avg1 < avg2
            }
            .prefix(5)
            .map { $0 }

        return TrendData(userTrends: Array(topUsers))
    }

    private func formatTime(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.timeStyle = .short
        formatter.dateStyle = .none
        return formatter.string(from: date)
    }
}

// MARK: - Supporting Types

struct TrendData {
    let userTrends: [UserTrendData]
}

struct UserTrendData {
    let userId: String
    let username: String
    var dataPoints: [RankDataPoint]
    let isCurrentUser: Bool
}

struct RankDataPoint: Identifiable {
    let id = UUID()
    let timestamp: Date
    let rank: Int
    let pixels: Int
}

// MARK: - Preview

#Preview {
    ScrollView {
        EventTrendChart(eventId: "test-event-id")
            .padding()
    }
}
