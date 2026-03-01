import SwiftUI

/// 数据仪表盘主页
struct DataDashboardView: View {
    @StateObject private var viewModel = DashboardViewModel()

    var body: some View {
        ScrollView {
            if viewModel.isLoading {
                LoadingView()
                    .padding(.top, 60)
            } else if let error = viewModel.errorMessage {
                errorStateView(message: error)
            } else if viewModel.overview == nil && viewModel.heatmap.isEmpty {
                emptyStateView
            } else {
                LazyVStack(spacing: AppSpacing.l) {
                    // 总览卡片
                    if let overview = viewModel.overview {
                        OverviewCards(overview: overview)
                    }

                    // 热力日历
                    if !viewModel.heatmap.isEmpty {
                        DashboardSection(title: NSLocalizedString("dashboard.heatmap.title", comment: "Activity Calendar")) {
                            HeatmapCalendarView(data: viewModel.heatmap)
                        }
                    }

                    // 周趋势
                    if !viewModel.weeklyTrend.isEmpty {
                        DashboardSection(title: NSLocalizedString("dashboard.weekly.title", comment: "Weekly Trend")) {
                            TrendBarChart(data: viewModel.weeklyTrend)
                        }
                    }

                    // 城市足迹
                    if !viewModel.cityFootprint.isEmpty {
                        DashboardSection(title: NSLocalizedString("dashboard.cities.title", comment: "City Footprint")) {
                            CityFootprintList(cities: viewModel.cityFootprint)
                        }
                    }
                }
                .padding(AppSpacing.l)
            }
        }
        .task {
            await viewModel.loadDashboard()
        }
        .refreshable {
            await viewModel.loadDashboard()
        }
    }

    // MARK: - Error State

    private func errorStateView(message: String) -> some View {
        VStack(spacing: AppSpacing.l) {
            Spacer()
            Image(systemName: "exclamationmark.triangle")
                .font(.system(size: 48))
                .foregroundColor(.orange)
            Text(NSLocalizedString("dashboard.error.title", comment: "Failed to load"))
                .font(AppTypography.headline())
                .foregroundColor(AppColors.textPrimary)
            Text(message)
                .font(AppTypography.caption())
                .foregroundColor(AppColors.textSecondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal)
            Button {
                Task { await viewModel.loadDashboard() }
            } label: {
                Text(NSLocalizedString("common.retry", comment: "Retry"))
                    .font(AppTypography.body())
                    .fontWeight(.semibold)
                    .foregroundColor(.white)
                    .padding(.horizontal, 24)
                    .padding(.vertical, 10)
                    .background(AppColors.primary)
                    .clipShape(RoundedRectangle(cornerRadius: AppRadius.m))
            }
            Spacer()
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 60)
    }

    // MARK: - Empty State

    private var emptyStateView: some View {
        VStack(spacing: AppSpacing.l) {
            Spacer()
            Image(systemName: "paintbrush.pointed")
                .font(.system(size: 48))
                .foregroundColor(AppColors.textTertiary)
            Text(NSLocalizedString("dashboard.empty.title", comment: "No Data Yet"))
                .font(AppTypography.headline())
                .foregroundColor(AppColors.textPrimary)
            Text(NSLocalizedString("dashboard.empty.message", comment: "Start drawing to see your stats"))
                .font(AppTypography.caption())
                .foregroundColor(AppColors.textSecondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal)
            Spacer()
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 60)
    }
}

// MARK: - Overview Cards

struct OverviewCards: View {
    let overview: DashboardStatsService.Overview

    var body: some View {
        LazyVGrid(columns: [
            GridItem(.flexible(), spacing: AppSpacing.m),
            GridItem(.flexible(), spacing: AppSpacing.m)
        ], spacing: AppSpacing.m) {
            DashboardStatCard(
                icon: "square.grid.3x3.fill",
                value: formatNumber(overview.total_pixels),
                label: NSLocalizedString("dashboard.stat.pixels", comment: "Pixels"),
                color: AppColors.primary
            )
            DashboardStatCard(
                icon: "figure.run",
                value: "\(overview.total_sessions)",
                label: NSLocalizedString("dashboard.stat.sessions", comment: "Sessions"),
                color: AppColors.secondary
            )
            DashboardStatCard(
                icon: "mappin.circle.fill",
                value: "\(overview.total_cities)",
                label: NSLocalizedString("dashboard.stat.cities", comment: "Cities"),
                color: .orange
            )
            DashboardStatCard(
                icon: "flame.fill",
                value: "\(overview.current_streak)",
                label: NSLocalizedString("dashboard.stat.streak", comment: "Day Streak"),
                color: .red
            )
        }
    }

    private func formatNumber(_ n: Int) -> String {
        if n >= 10000 { return String(format: "%.1fK", Double(n) / 1000.0) }
        return "\(n)"
    }
}

struct DashboardStatCard: View {
    let icon: String
    let value: String
    let label: String
    let color: Color

    var body: some View {
        VStack(spacing: AppSpacing.s) {
            Image(systemName: icon)
                .font(.system(size: 22))
                .foregroundColor(color)
            Text(value)
                .font(AppTypography.headline())
                .foregroundColor(AppColors.textPrimary)
            Text(label)
                .font(AppTypography.caption())
                .foregroundColor(AppColors.textTertiary)
        }
        .frame(maxWidth: .infinity)
        .padding(AppSpacing.l)
        .background(AppColors.surface)
        .clipShape(RoundedRectangle(cornerRadius: AppRadius.l))
        .modifier(AppShadows.small())
    }
}

// MARK: - Dashboard Section

struct DashboardSection<Content: View>: View {
    let title: String
    @ViewBuilder let content: () -> Content

    var body: some View {
        VStack(alignment: .leading, spacing: AppSpacing.m) {
            Text(title)
                .font(AppTypography.headline())
                .foregroundColor(AppColors.textPrimary)
            content()
        }
        .padding(AppSpacing.l)
        .background(AppColors.surface)
        .clipShape(RoundedRectangle(cornerRadius: AppRadius.l))
        .modifier(AppShadows.small())
    }
}

// MARK: - Heatmap Calendar (GitHub-style)

struct HeatmapCalendarView: View {
    let data: [DashboardStatsService.HeatmapDay]

    private let columns = 53  // 53 weeks
    private let rows = 7      // 7 days

    private var dataMap: [String: Int] {
        Dictionary(uniqueKeysWithValues: data.map { ($0.date, $0.count) })
    }

    private var maxCount: Int {
        data.map(\.count).max() ?? 1
    }

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 2) {
                ForEach(0..<columns, id: \.self) { week in
                    VStack(spacing: 2) {
                        ForEach(0..<rows, id: \.self) { day in
                            let date = dateForCell(week: week, day: day)
                            let count = dataMap[date] ?? 0
                            Rectangle()
                                .fill(heatmapColor(count: count))
                                .frame(width: 10, height: 10)
                                .clipShape(RoundedRectangle(cornerRadius: 2))
                        }
                    }
                }
            }
        }
        .frame(height: 7 * 12 + 6 * 2)

        // Legend
        HStack(spacing: 4) {
            Text(NSLocalizedString("dashboard.heatmap.less", comment: "Less"))
                .font(.system(size: 10))
                .foregroundColor(AppColors.textTertiary)
            ForEach(0..<5, id: \.self) { level in
                Rectangle()
                    .fill(heatmapColor(level: level))
                    .frame(width: 10, height: 10)
                    .clipShape(RoundedRectangle(cornerRadius: 2))
            }
            Text(NSLocalizedString("dashboard.heatmap.more", comment: "More"))
                .font(.system(size: 10))
                .foregroundColor(AppColors.textTertiary)
        }
    }

    private func dateForCell(week: Int, day: Int) -> String {
        let today = Date()
        let calendar = Calendar.current
        let todayWeekday = calendar.component(.weekday, from: today)
        let daysBack = (columns - 1 - week) * 7 + (todayWeekday - 1 - day)
        guard let date = calendar.date(byAdding: .day, value: -daysBack, to: today) else { return "" }
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: date)
    }

    private func heatmapColor(count: Int) -> Color {
        if count == 0 { return Color.gray.opacity(0.15) }
        let ratio = min(Double(count) / Double(max(maxCount, 1)), 1.0)
        if ratio < 0.25 { return Color.green.opacity(0.3) }
        if ratio < 0.5 { return Color.green.opacity(0.5) }
        if ratio < 0.75 { return Color.green.opacity(0.7) }
        return Color.green.opacity(0.9)
    }

    private func heatmapColor(level: Int) -> Color {
        switch level {
        case 0: return Color.gray.opacity(0.15)
        case 1: return Color.green.opacity(0.3)
        case 2: return Color.green.opacity(0.5)
        case 3: return Color.green.opacity(0.7)
        default: return Color.green.opacity(0.9)
        }
    }
}

// MARK: - Trend Bar Chart

struct TrendBarChart: View {
    let data: [DashboardStatsService.TrendPoint]

    private var maxValue: Int {
        data.map(\.count).max() ?? 1
    }

    var body: some View {
        HStack(alignment: .bottom, spacing: 4) {
            ForEach(data) { point in
                VStack(spacing: 4) {
                    RoundedRectangle(cornerRadius: 3)
                        .fill(AppColors.primary)
                        .frame(
                            width: max(16, (UIScreen.main.bounds.width - 80) / CGFloat(data.count) - 4),
                            height: max(4, CGFloat(point.count) / CGFloat(max(maxValue, 1)) * 80)
                        )

                    Text(point.label)
                        .font(.system(size: 8))
                        .foregroundColor(AppColors.textTertiary)
                        .lineLimit(1)
                }
            }
        }
        .frame(height: 110)
        .frame(maxWidth: .infinity)
    }
}

// MARK: - City Footprint List

struct CityFootprintList: View {
    let cities: [DashboardStatsService.CityFootprintItem]

    var body: some View {
        VStack(spacing: AppSpacing.s) {
            ForEach(cities.prefix(10)) { city in
                HStack {
                    Text(city.city)
                        .font(AppTypography.body())
                        .foregroundColor(AppColors.textPrimary)
                        .lineLimit(1)

                    if let country = city.country, !country.isEmpty {
                        Text(country)
                            .font(AppTypography.caption())
                            .foregroundColor(AppColors.textTertiary)
                    }

                    Spacer()

                    VStack(alignment: .trailing, spacing: 2) {
                        Text("\(city.total_pixels)")
                            .font(AppTypography.caption())
                            .fontWeight(.semibold)
                            .foregroundColor(AppColors.secondary)
                        Text("\(city.session_count) \(NSLocalizedString("dashboard.cities.sessions", comment: "sessions"))")
                            .font(.system(size: 10))
                            .foregroundColor(AppColors.textTertiary)
                    }
                }
                .padding(.vertical, 4)
            }
        }
    }
}
