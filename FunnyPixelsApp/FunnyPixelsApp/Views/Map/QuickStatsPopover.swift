import SwiftUI
import Combine

// MARK: - Quick Stats Popover (map floating widget)

struct QuickStatsPopover: View {
    @StateObject private var viewModel = QuickStatsViewModel()
    @State private var isExpanded = false

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            if isExpanded {
                expandedView
            } else {
                compactView
            }
        }
        .onTapGesture {
            withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) {
                isExpanded.toggle()
            }
        }
        .task {
            await viewModel.loadStats()
        }
        .onReceive(NotificationCenter.default.publisher(for: .gpsPixelDidDraw)) { _ in
            Task { await viewModel.loadStats() }
        }
    }

    // MARK: - Compact View (pill)

    private var compactView: some View {
        HStack(spacing: 8) {
            // Today's pixels
            HStack(spacing: 4) {
                Image(systemName: "square.grid.3x3.fill")
                    .font(.system(size: 10))
                    .foregroundColor(AppColors.primary)
                Text("\(viewModel.todayPixels)")
                    .font(.system(size: 12, weight: .bold).monospacedDigit())
                    .foregroundColor(AppColors.textPrimary)
            }

            // Divider
            Rectangle()
                .fill(AppColors.border)
                .frame(width: 1, height: 14)

            // Daily task progress
            HStack(spacing: 4) {
                Image(systemName: "checklist")
                    .font(.system(size: 10))
                    .foregroundColor(.teal)
                Text("\(viewModel.taskCompleted)/\(viewModel.taskTotal)")
                    .font(.system(size: 12, weight: .medium).monospacedDigit())
                    .foregroundColor(AppColors.textSecondary)
            }

            // Expand chevron
            Image(systemName: "chevron.down")
                .font(.system(size: 8, weight: .bold))
                .foregroundColor(AppColors.textTertiary)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(.ultraThinMaterial)
        .clipShape(Capsule())
        .shadow(color: .black.opacity(0.08), radius: 6, y: 2)
    }

    // MARK: - Expanded View (card)

    private var expandedView: some View {
        VStack(alignment: .leading, spacing: 10) {
            // Header
            HStack {
                Text(NSLocalizedString("quick_stats.today", comment: "Today"))
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundColor(AppColors.textPrimary)
                Spacer()
                Image(systemName: "chevron.up")
                    .font(.system(size: 8, weight: .bold))
                    .foregroundColor(AppColors.textTertiary)
            }

            // Stats grid
            HStack(spacing: 16) {
                statItem(
                    icon: "square.grid.3x3.fill",
                    color: AppColors.primary,
                    value: "\(viewModel.todayPixels)",
                    label: NSLocalizedString("quick_stats.pixels", comment: "Pixels")
                )
                statItem(
                    icon: "figure.run",
                    color: AppColors.secondary,
                    value: "\(viewModel.todaySessions)",
                    label: NSLocalizedString("quick_stats.sessions", comment: "Sessions")
                )
                statItem(
                    icon: "clock.fill",
                    color: .orange,
                    value: formatDuration(viewModel.todayDuration),
                    label: NSLocalizedString("quick_stats.duration", comment: "Duration")
                )
            }

            // Daily task mini progress
            if viewModel.taskTotal > 0 {
                Divider()

                HStack(spacing: 8) {
                    Image(systemName: "checklist")
                        .font(.system(size: 11))
                        .foregroundColor(.teal)

                    Text(NSLocalizedString("quick_stats.tasks", comment: "Tasks"))
                        .font(.system(size: 11, weight: .medium))
                        .foregroundColor(AppColors.textSecondary)

                    Spacer()

                    Text("\(viewModel.taskCompleted)/\(viewModel.taskTotal)")
                        .font(.system(size: 11, weight: .bold).monospacedDigit())
                        .foregroundColor(viewModel.allTasksComplete ? .green : AppColors.textPrimary)

                    // Mini progress bar
                    GeometryReader { geo in
                        ZStack(alignment: .leading) {
                            Capsule()
                                .fill(Color(.systemGray5))
                                .frame(height: 4)
                            Capsule()
                                .fill(viewModel.allTasksComplete ? Color.green : Color.teal)
                                .frame(width: geo.size.width * viewModel.taskProgress, height: 4)
                        }
                    }
                    .frame(width: 50, height: 4)
                }

                // Navigate to daily tasks
                Button {
                    NotificationCenter.default.post(name: .navigateToDailyTasks, object: nil)
                } label: {
                    Text(NSLocalizedString("quick_stats.view_tasks", comment: "View Tasks"))
                        .font(.system(size: 11, weight: .medium))
                        .foregroundColor(AppColors.primary)
                }
            }

            // Streak
            if viewModel.loginStreak > 0 {
                HStack(spacing: 4) {
                    Image(systemName: "flame.fill")
                        .font(.system(size: 10))
                        .foregroundColor(.orange)
                    Text(String(format: NSLocalizedString("profile.streak_days", comment: ""), viewModel.loginStreak))
                        .font(.system(size: 11))
                        .foregroundColor(AppColors.textSecondary)
                }
            }
        }
        .padding(12)
        .frame(width: 200)
        .background(.ultraThinMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 14))
        .shadow(color: .black.opacity(0.1), radius: 8, y: 4)
    }

    // MARK: - Helpers

    private func statItem(icon: String, color: Color, value: String, label: String) -> some View {
        VStack(spacing: 4) {
            Image(systemName: icon)
                .font(.system(size: 12))
                .foregroundColor(color)
            Text(value)
                .font(.system(size: 14, weight: .bold).monospacedDigit())
                .foregroundColor(AppColors.textPrimary)
            Text(label)
                .font(.system(size: 9))
                .foregroundColor(AppColors.textTertiary)
        }
        .frame(maxWidth: .infinity)
    }

    private func formatDuration(_ seconds: Int) -> String {
        if seconds < 60 {
            return "\(seconds)s"
        }
        let minutes = seconds / 60
        if minutes < 60 {
            return "\(minutes)m"
        }
        let hours = minutes / 60
        let remainingMinutes = minutes % 60
        return "\(hours)h\(remainingMinutes)m"
    }
}

// MARK: - ViewModel

@MainActor
class QuickStatsViewModel: ObservableObject {
    @Published var todayPixels = 0
    @Published var todaySessions = 0
    @Published var todayDuration = 0
    @Published var loginStreak = 0
    @Published var taskCompleted = 0
    @Published var taskTotal = 0
    @Published var allTasksComplete = false

    var taskProgress: Double {
        guard taskTotal > 0 else { return 0 }
        return Double(taskCompleted) / Double(taskTotal)
    }

    private var lastLoadTime: Date?

    func loadStats() async {
        // Throttle: at most once every 30 seconds
        if let last = lastLoadTime, Date().timeIntervalSince(last) < 30 { return }
        lastLoadTime = Date()

        // Load today stats and daily tasks in parallel
        async let todayResult: Void = loadTodayStats()
        async let taskResult: Void = loadDailyTasks()
        _ = await (todayResult, taskResult)
    }

    private func loadTodayStats() async {
        do {
            let response: TodayResponse = try await APIManager.shared.get("/stats/today")
            if response.success, let data = response.data {
                todayPixels = data.todayPixels
                todaySessions = data.todaySessions
                todayDuration = data.todayDuration
                loginStreak = data.loginStreak
            }
        } catch {
            Logger.error("QuickStats: failed to load today stats: \(error)")
        }
    }

    private func loadDailyTasks() async {
        do {
            let response: DailyTaskService.DailyTaskResponse = try await APIManager.shared.get("/daily-tasks")
            if response.success, let data = response.data {
                taskCompleted = data.completedCount
                taskTotal = data.totalCount
                allTasksComplete = data.allCompleted
            }
        } catch {
            Logger.error("QuickStats: failed to load daily tasks: \(error)")
        }
    }

    // MARK: - Response Models

    private struct TodayResponse: Codable {
        let success: Bool
        let data: TodayData?
    }

    private struct TodayData: Codable {
        let todayPixels: Int
        let todaySessions: Int
        let todayDuration: Int
        let loginStreak: Int

        enum CodingKeys: String, CodingKey {
            case todayPixels = "today_pixels"
            case todaySessions = "today_sessions"
            case todayDuration = "today_duration"
            case loginStreak = "login_streak"
        }
    }
}
