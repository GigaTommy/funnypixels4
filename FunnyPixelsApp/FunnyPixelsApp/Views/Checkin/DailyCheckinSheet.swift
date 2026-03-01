import SwiftUI
import Combine

struct DailyCheckinSheet: View {
    @Environment(\.dismiss) private var dismiss
    @StateObject private var viewModel = DailyCheckinViewModel()

    var body: some View {
        NavigationView {
            ScrollView {
                VStack(spacing: DesignTokens.Spacing.xl) {
                    // Streak header
                    streakHeader

                    // 7-day reward cycle grid
                    weekRewardGrid

                    // Check-in button
                    checkinButton

                    // Calendar grid
                    calendarGrid

                    // Streak recovery
                    if viewModel.canRecover {
                        streakRecoveryCard
                    }

                    // Milestone progress
                    milestoneSection

                    // Stats summary
                    statsSummary
                }
                .padding(DesignTokens.Spacing.lg)
            }
            .background(DesignTokens.Colors.background)
            .navigationTitle(NSLocalizedString("checkin.title", comment: "Daily Check-in"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(NSLocalizedString("common.close", comment: "Close")) { dismiss() }
                }
            }
        }
        .task {
            await viewModel.loadData()
        }
    }

    // MARK: - Streak Header

    private var streakHeader: some View {
        VStack(spacing: DesignTokens.Spacing.sm) {
            HStack(spacing: DesignTokens.Spacing.xs) {
                Image(systemName: "flame.fill")
                    .font(.title2)
                    .foregroundColor(.orange)
                Text("\(viewModel.currentStreak)")
                    .font(DesignTokens.Typography.largeNumeric)
                    .foregroundColor(DesignTokens.Colors.textPrimary)
            }
            Text(NSLocalizedString("checkin.streak_days", comment: "Consecutive check-in days"))
                .font(DesignTokens.Typography.caption)
                .foregroundColor(DesignTokens.Colors.textSecondary)
        }
        .frame(maxWidth: .infinity)
        .padding(DesignTokens.Spacing.xl)
        .background(
            RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.xl)
                .fill(DesignTokens.Colors.backgroundSecondary)
        )
    }

    // MARK: - 7-Day Reward Cycle Grid

    private var weekRewardGrid: some View {
        VStack(spacing: DesignTokens.Spacing.md) {
            HStack {
                Image(systemName: "gift.fill")
                    .font(.system(size: 14))
                    .foregroundColor(.orange)
                Text(NSLocalizedString("checkin.week_cycle", comment: "Weekly Rewards"))
                    .font(DesignTokens.Typography.bodyEmphasized)
                    .foregroundColor(DesignTokens.Colors.textPrimary)
                Spacer()
            }

            HStack(spacing: 6) {
                ForEach(viewModel.weekRewards) { reward in
                    weekDayCell(reward)
                }
            }
        }
        .padding(DesignTokens.Spacing.lg)
        .background(
            RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.xl)
                .fill(DesignTokens.Colors.backgroundSecondary)
        )
    }

    private func weekDayCell(_ reward: CheckinService.WeekReward) -> some View {
        VStack(spacing: 4) {
            ZStack {
                if reward.isBonusDay {
                    // Day 7 special styling
                    RoundedRectangle(cornerRadius: 10)
                        .fill(
                            reward.isCollected
                                ? LinearGradient(colors: [.orange, .yellow], startPoint: .top, endPoint: .bottom)
                                : LinearGradient(colors: [.orange.opacity(0.15), .yellow.opacity(0.1)], startPoint: .top, endPoint: .bottom)
                        )
                        .frame(width: 40, height: 44)
                } else {
                    RoundedRectangle(cornerRadius: 10)
                        .fill(
                            reward.isCollected
                                ? LinearGradient(colors: [DesignTokens.Colors.accent, DesignTokens.Colors.accent.opacity(0.8)], startPoint: .top, endPoint: .bottom)
                                : LinearGradient(colors: [Color(.systemGray5), Color(.systemGray6)], startPoint: .top, endPoint: .bottom)
                        )
                        .frame(width: 40, height: 44)
                }

                if reward.isCollected {
                    Image(systemName: "checkmark")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundColor(.white)
                } else if reward.isCurrent {
                    Image(systemName: "arrow.down")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundColor(DesignTokens.Colors.accent)
                } else {
                    Image(systemName: reward.isBonusDay ? "gift.fill" : "star.fill")
                        .font(.system(size: 12))
                        .foregroundColor(reward.isBonusDay ? .orange.opacity(0.5) : DesignTokens.Colors.textTertiary)
                }
            }

            Text("+\(reward.reward)")
                .font(.system(size: 9, weight: reward.isBonusDay ? .bold : .medium))
                .foregroundColor(reward.isBonusDay ? .orange : DesignTokens.Colors.textTertiary)

            Text(String(format: NSLocalizedString("checkin.rewards.day", comment: "Day %d"), reward.day))
                .font(.system(size: 8))
                .foregroundColor(DesignTokens.Colors.textTertiary)
        }
        .frame(maxWidth: .infinity)
    }

    // MARK: - Check-in Button

    private var checkinButton: some View {
        Button(action: {
            Task { await viewModel.performCheckin() }
        }) {
            HStack(spacing: DesignTokens.Spacing.sm) {
                if viewModel.isCheckinLoading {
                    ProgressView()
                        .tint(.white)
                } else {
                    Image(systemName: viewModel.canCheckin ? "hand.tap.fill" : "checkmark.circle.fill")
                        .font(.title3)
                    Text(viewModel.canCheckin ? NSLocalizedString("checkin.btn.checkin", comment: "Check In Now") : NSLocalizedString("checkin.btn.done", comment: "Checked In Today"))
                        .font(DesignTokens.Typography.button)
                }
            }
            .frame(maxWidth: .infinity)
            .frame(height: 50)
            .background(viewModel.canCheckin ? DesignTokens.Colors.accent : Color.gray.opacity(0.3))
            .foregroundColor(viewModel.canCheckin ? .white : DesignTokens.Colors.textTertiary)
            .clipShape(Capsule())
        }
        .disabled(!viewModel.canCheckin || viewModel.isCheckinLoading)

        // Reward toast
        .overlay(alignment: .top) {
            if viewModel.showRewardToast, let record = viewModel.lastCheckinRecord {
                rewardToast(record)
                    .transition(.move(edge: .top).combined(with: .opacity))
                    .offset(y: -70)
            }
        }
        .animation(.spring(response: 0.5, dampingFraction: 0.7), value: viewModel.showRewardToast)
    }

    private func rewardToast(_ record: CheckinService.CheckinRecord) -> some View {
        HStack(spacing: DesignTokens.Spacing.sm) {
            Image(systemName: "star.fill")
                .foregroundColor(.yellow)
            Text(String(format: NSLocalizedString("checkin.reward_points", comment: "+%d Points"), record.rewardPoints ?? 10))
                .font(DesignTokens.Typography.bodyEmphasized)
                .foregroundColor(DesignTokens.Colors.textPrimary)
            if (record.consecutiveDays ?? 0) > 1 {
                Text(String(format: NSLocalizedString("checkin.streak_count", comment: "%d day streak"), record.consecutiveDays ?? 0))
                    .font(DesignTokens.Typography.caption)
                    .foregroundColor(DesignTokens.Colors.accent)
            }
        }
        .padding(.horizontal, DesignTokens.Spacing.lg)
        .padding(.vertical, DesignTokens.Spacing.sm)
        .background(
            Capsule()
                .fill(DesignTokens.Colors.backgroundSecondary)
                .shadow(color: .black.opacity(0.1), radius: 8, y: 4)
        )
    }

    // MARK: - Calendar Grid

    private var calendarGrid: some View {
        VStack(spacing: DesignTokens.Spacing.sm) {
            // Month title
            HStack {
                Button(action: { viewModel.previousMonth() }) {
                    Image(systemName: "chevron.left")
                        .foregroundColor(DesignTokens.Colors.accent)
                }
                Spacer()
                Text(viewModel.monthTitle)
                    .font(DesignTokens.Typography.bodyEmphasized)
                Spacer()
                Button(action: { viewModel.nextMonth() }) {
                    Image(systemName: "chevron.right")
                        .foregroundColor(DesignTokens.Colors.accent)
                }
            }

            // Weekday headers
            let weekdays = [
                NSLocalizedString("weekday.sun", comment: "Sun"),
                NSLocalizedString("weekday.mon", comment: "Mon"),
                NSLocalizedString("weekday.tue", comment: "Tue"),
                NSLocalizedString("weekday.wed", comment: "Wed"),
                NSLocalizedString("weekday.thu", comment: "Thu"),
                NSLocalizedString("weekday.fri", comment: "Fri"),
                NSLocalizedString("weekday.sat", comment: "Sat")
            ]
            LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 7), spacing: DesignTokens.Spacing.xs) {
                ForEach(weekdays, id: \.self) { day in
                    Text(day)
                        .font(DesignTokens.Typography.caption)
                        .foregroundColor(DesignTokens.Colors.textTertiary)
                        .frame(height: 30)
                }
            }

            // Day cells
            LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 7), spacing: DesignTokens.Spacing.xs) {
                // Leading empty cells
                ForEach(0..<viewModel.leadingEmptyCells, id: \.self) { _ in
                    Color.clear.frame(height: 40)
                }

                // Day cells
                ForEach(viewModel.calendarDays) { day in
                    dayCell(day)
                }
            }
        }
        .padding(DesignTokens.Spacing.lg)
        .background(
            RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.xl)
                .fill(DesignTokens.Colors.backgroundSecondary)
        )
    }

    private func dayCell(_ day: CheckinService.CalendarDay) -> some View {
        let isToday = day.date == viewModel.todayString
        let isChecked = day.isChecked ?? false

        return ZStack {
            if isChecked {
                Circle()
                    .fill(DesignTokens.Colors.accent.opacity(0.15))
            }
            if isToday {
                Circle()
                    .strokeBorder(DesignTokens.Colors.accent, lineWidth: 2)
            }

            VStack(spacing: 0) {
                Text("\(day.day)")
                    .font(DesignTokens.Typography.subheadline)
                    .foregroundColor(isChecked ? DesignTokens.Colors.accent : DesignTokens.Colors.textPrimary)
                if isChecked {
                    Image(systemName: "checkmark")
                        .font(.system(size: 8, weight: .bold))
                        .foregroundColor(DesignTokens.Colors.accent)
                }
            }
        }
        .frame(height: 40)
    }

    // MARK: - Stats Summary

    private var statsSummary: some View {
        HStack(spacing: 0) {
            statItem(value: "\(viewModel.totalCheckins)", label: NSLocalizedString("checkin.stat.total", comment: "Total Check-ins"))
            Divider().frame(height: 30)
            statItem(value: "\(viewModel.maxStreak)", label: NSLocalizedString("checkin.stat.max_streak", comment: "Best Streak"))
            Divider().frame(height: 30)
            statItem(value: "\(viewModel.totalPoints)", label: NSLocalizedString("checkin.stat.total_points", comment: "Total Points"))
        }
        .padding(DesignTokens.Spacing.lg)
        .background(
            RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.xl)
                .fill(DesignTokens.Colors.backgroundSecondary)
        )
    }

    // MARK: - Streak Recovery

    private var streakRecoveryCard: some View {
        VStack(spacing: DesignTokens.Spacing.sm) {
            HStack {
                Image(systemName: "arrow.counterclockwise.circle.fill")
                    .font(.title3)
                    .foregroundColor(.orange)
                VStack(alignment: .leading, spacing: 2) {
                    Text(NSLocalizedString("checkin.recovery.title", comment: "Streak Broken!"))
                        .font(DesignTokens.Typography.bodyEmphasized)
                    Text(String(format: NSLocalizedString("checkin.recovery.desc", comment: "You lost a %d day streak"), viewModel.lostStreak))
                        .font(DesignTokens.Typography.caption)
                        .foregroundColor(DesignTokens.Colors.textSecondary)
                }
                Spacer()
            }

            Button(action: {
                Task { await viewModel.performRecovery() }
            }) {
                Text(NSLocalizedString("checkin.recovery.btn", comment: "Recover Streak (1x/month)"))
                    .font(DesignTokens.Typography.button)
                    .frame(maxWidth: .infinity)
                    .frame(height: 44)
                    .background(Color.orange)
                    .foregroundColor(.white)
                    .clipShape(Capsule())
            }
            .disabled(viewModel.isRecoveryLoading)
        }
        .padding(DesignTokens.Spacing.lg)
        .background(
            RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.xl)
                .fill(Color.orange.opacity(0.1))
                .overlay(
                    RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.xl)
                        .strokeBorder(Color.orange.opacity(0.3), lineWidth: 1)
                )
        )
    }

    // MARK: - Milestone Progress

    private var milestoneSection: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.md) {
            HStack {
                Image(systemName: "flag.fill")
                    .font(.system(size: 14))
                    .foregroundColor(.purple)
                Text(NSLocalizedString("checkin.milestones.title", comment: "Milestones"))
                    .font(DesignTokens.Typography.bodyEmphasized)
                    .foregroundColor(DesignTokens.Colors.textPrimary)
                Spacer()
            }

            ForEach(viewModel.milestones) { milestone in
                milestoneRow(milestone)
            }
        }
        .padding(DesignTokens.Spacing.lg)
        .background(
            RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.xl)
                .fill(DesignTokens.Colors.backgroundSecondary)
        )
    }

    private func milestoneRow(_ milestone: CheckinService.Milestone) -> some View {
        HStack(spacing: 12) {
            // Icon
            ZStack {
                Circle()
                    .fill(milestone.isCompleted ? Color.purple.opacity(0.15) : Color(.systemGray5))
                    .frame(width: 36, height: 36)

                Image(systemName: milestone.icon)
                    .font(.system(size: 14))
                    .foregroundColor(milestone.isCompleted ? .purple : DesignTokens.Colors.textTertiary)
            }

            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(String(format: NSLocalizedString("checkin.milestone.days", comment: "%d Days"), milestone.target))
                        .font(.system(size: 13, weight: .medium))
                        .foregroundColor(DesignTokens.Colors.textPrimary)
                    Spacer()
                    if milestone.isCompleted {
                        Image(systemName: "checkmark.circle.fill")
                            .font(.system(size: 14))
                            .foregroundColor(.green)
                    } else {
                        Text("\(milestone.current)/\(milestone.target)")
                            .font(.system(size: 11))
                            .foregroundColor(DesignTokens.Colors.textTertiary)
                    }
                }

                // Progress bar
                GeometryReader { geo in
                    ZStack(alignment: .leading) {
                        RoundedRectangle(cornerRadius: 3)
                            .fill(Color(.systemGray5))
                            .frame(height: 4)

                        RoundedRectangle(cornerRadius: 3)
                            .fill(
                                milestone.isCompleted
                                    ? LinearGradient(colors: [.green, .green], startPoint: .leading, endPoint: .trailing)
                                    : LinearGradient(colors: [.purple, .purple.opacity(0.7)], startPoint: .leading, endPoint: .trailing)
                            )
                            .frame(width: geo.size.width * CGFloat(milestone.progress), height: 4)
                    }
                }
                .frame(height: 4)
            }

            // Reward
            HStack(spacing: 2) {
                Image(systemName: "star.fill")
                    .font(.system(size: 9))
                    .foregroundColor(.orange)
                Text("+\(milestone.reward)")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundColor(.orange)
            }
        }
    }

    private func statItem(value: String, label: String) -> some View {
        VStack(spacing: DesignTokens.Spacing.xs) {
            Text(value)
                .font(DesignTokens.Typography.numeric)
                .fontWeight(.bold)
                .foregroundColor(DesignTokens.Colors.textPrimary)
            Text(label)
                .font(DesignTokens.Typography.caption)
                .foregroundColor(DesignTokens.Colors.textSecondary)
        }
        .frame(maxWidth: .infinity)
    }
}

// MARK: - ViewModel

@MainActor
class DailyCheckinViewModel: ObservableObject {
    @Published var calendarDays: [CheckinService.CalendarDay] = []
    @Published var canCheckin = false
    @Published var isCheckinLoading = false
    @Published var showRewardToast = false
    @Published var lastCheckinRecord: CheckinService.CheckinRecord?

    @Published var currentStreak = 0
    @Published var maxStreak = 0
    @Published var totalCheckins = 0
    @Published var totalPoints = 0
    @Published var canRecover = false
    @Published var lostStreak = 0
    @Published var isRecoveryLoading = false
    @Published var weekRewards: [CheckinService.WeekReward] = []
    @Published var milestones: [CheckinService.Milestone] = []

    @Published var displayYear: Int
    @Published var displayMonth: Int

    var leadingEmptyCells: Int {
        let components = DateComponents(year: displayYear, month: displayMonth, day: 1)
        guard let date = Calendar.current.date(from: components) else { return 0 }
        let weekday = Calendar.current.component(.weekday, from: date)
        return weekday - 1 // Sunday = 1
    }

    var monthTitle: String {
        let components = DateComponents(year: displayYear, month: displayMonth, day: 1)
        guard let date = Calendar.current.date(from: components) else { return "" }
        let formatter = DateFormatter()
        formatter.dateFormat = DateFormatter.dateFormat(fromTemplate: "yyyyMMMM", options: 0, locale: Locale.current)
        return formatter.string(from: date)
    }

    var todayString: String {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: Date())
    }

    init() {
        let now = Date()
        displayYear = Calendar.current.component(.year, from: now)
        displayMonth = Calendar.current.component(.month, from: now)
    }

    func loadData() async {
        async let statsTask: () = loadStats()
        async let calendarTask: () = loadCalendar()
        async let canCheckinTask: () = loadCanCheckin()
        async let recoveryTask: () = loadRecoveryStatus()
        _ = await (statsTask, calendarTask, canCheckinTask, recoveryTask)
    }

    func performCheckin() async {
        guard canCheckin, !isCheckinLoading else { return }
        isCheckinLoading = true
        defer { isCheckinLoading = false }

        do {
            let record = try await CheckinService.shared.performCheckin()
            lastCheckinRecord = record
            canCheckin = false
            currentStreak = record.consecutiveDays ?? currentStreak

            SoundManager.shared.playSuccess()

            withAnimation {
                showRewardToast = true
            }

            // Refresh calendar and stats
            await loadCalendar()
            await loadStats()

            // Auto-hide toast
            try? await Task.sleep(nanoseconds: 3_000_000_000)
            withAnimation {
                showRewardToast = false
            }
        } catch {
            Logger.error("签到失败: \(error)")
            SoundManager.shared.playFailure()
        }
    }

    func previousMonth() {
        if displayMonth == 1 {
            displayMonth = 12
            displayYear -= 1
        } else {
            displayMonth -= 1
        }
        Task { await loadCalendar() }
    }

    func nextMonth() {
        let now = Date()
        let currentYear = Calendar.current.component(.year, from: now)
        let currentMonth = Calendar.current.component(.month, from: now)
        // Don't go past current month
        if displayYear == currentYear && displayMonth >= currentMonth { return }
        if displayMonth == 12 {
            displayMonth = 1
            displayYear += 1
        } else {
            displayMonth += 1
        }
        Task { await loadCalendar() }
    }

    private func loadStats() async {
        do {
            let response = try await CheckinService.shared.getFullStats()
            if let stats = response.stats {
                totalCheckins = stats.totalCheckins ?? 0
                maxStreak = stats.maxConsecutiveDays ?? 0
                currentStreak = stats.currentConsecutiveDays ?? 0
                totalPoints = stats.totalRewardPoints ?? 0
            }
            weekRewards = response.weekRewards ?? []
            milestones = response.milestones ?? []
        } catch {
            Logger.error("获取签到统计失败: \(error)")
        }
    }

    private func loadCalendar() async {
        do {
            calendarDays = try await CheckinService.shared.getCalendar(year: displayYear, month: displayMonth)
        } catch {
            Logger.error("获取签到日历失败: \(error)")
            // Generate empty calendar as fallback
            let daysInMonth = Calendar.current.date(from: DateComponents(year: displayYear, month: displayMonth))
                .flatMap { Calendar.current.range(of: .day, in: .month, for: $0)?.count } ?? 30
            calendarDays = (1...daysInMonth).map { day in
                let dateStr = String(format: "%04d-%02d-%02d", displayYear, displayMonth, day)
                return CheckinService.CalendarDay(date: dateStr, day: day, isChecked: false, consecutiveDays: 0, rewardPoints: 0)
            }
        }
    }

    private func loadCanCheckin() async {
        do {
            canCheckin = try await CheckinService.shared.canCheckinToday()
        } catch {
            Logger.error("获取签到状态失败: \(error)")
            canCheckin = true
        }
    }

    private func loadRecoveryStatus() async {
        do {
            let status = try await CheckinService.shared.canRecoverStreak()
            canRecover = status.canRecover ?? false
            lostStreak = status.lostStreak ?? 0
        } catch {
            canRecover = false
        }
    }

    func performRecovery() async {
        guard canRecover, !isRecoveryLoading else { return }
        isRecoveryLoading = true
        defer { isRecoveryLoading = false }

        do {
            try await CheckinService.shared.recoverStreak()
            canRecover = false
            SoundManager.shared.playSuccess()
            // Refresh data
            await loadData()
        } catch {
            Logger.error("恢复连签失败: \(error)")
            SoundManager.shared.playFailure()
        }
    }
}
