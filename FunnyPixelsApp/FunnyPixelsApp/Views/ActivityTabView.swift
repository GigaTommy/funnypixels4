import SwiftUI

/// 活动Tab视图 - 整合赛事和任务
struct ActivityTabView: View {
    @EnvironmentObject var authViewModel: AuthViewModel
    @EnvironmentObject var appState: AppState
    @State private var selectedTab: ActivityTab = .events
    @ObservedObject private var fontManager = FontSizeManager.shared
    @State private var hasAppeared = false  // ⚡ 懒加载标志

    enum ActivityTab: String, CaseIterable {
        case events
        case tasks

        var title: String {
            switch self {
            case .events: return NSLocalizedString("activity.tab.events", comment: "Events")
            case .tasks: return NSLocalizedString("activity.tab.tasks", comment: "Tasks")
            }
        }

        var icon: String {
            switch self {
            case .events: return "flag.2.crossed.fill"
            case .tasks: return "checklist"
            }
        }
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Tab切换器
                tabSelector
                    .padding(.horizontal, AppSpacing.l)
                    .padding(.vertical, AppSpacing.m)
                    .background(Color(uiColor: .systemBackground))

                // 内容区域
                contentView
            }
            .navigationTitle(NSLocalizedString("tab.activity", comment: "Activity"))
            .navigationBarTitleDisplayMode(.inline)
            .background(Color(uiColor: .systemGroupedBackground))
            .onAppear {
                // ⚡ 懒加载：只在第一次显示时加载
                guard !hasAppeared else { return }
                hasAppeared = true
            }
        }
    }

    // MARK: - Tab Selector

    private var tabSelector: some View {
        HStack(spacing: 0) {
            ForEach(ActivityTab.allCases, id: \.self) { tab in
                Button(action: {
                    withAnimation(.easeInOut(duration: 0.2)) {
                        selectedTab = tab
                        HapticManager.shared.impact(style: .light)
                    }
                }) {
                    VStack(spacing: 4) {
                        HStack(spacing: 4) {
                            Image(systemName: tab.icon)
                                .font(fontManager.scaledFont(.caption))
                            Text(tab.title)
                                .font(fontManager.scaledFont(.subheadline).weight(.medium))
                        }
                        .foregroundColor(selectedTab == tab ? AppColors.primary : AppColors.textSecondary)
                        .padding(.vertical, 8)

                        Rectangle()
                            .fill(selectedTab == tab ? AppColors.primary : Color.clear)
                            .frame(height: 2)
                    }
                }
                .frame(maxWidth: .infinity)
            }
        }
        .background(Color(uiColor: .secondarySystemGroupedBackground))
        .cornerRadius(AppRadius.m)
    }

    // MARK: - Content View

    @ViewBuilder
    private var contentView: some View {
        switch selectedTab {
        case .events:
            eventsContent
        case .tasks:
            tasksContent
        }
    }

    // MARK: - Events Content

    private var eventsContent: some View {
        // 直接嵌入EventCenterView的内容，但不包含NavigationStack
        EventCenterContentWrapper()
    }

    // MARK: - Tasks Content

    private var tasksContent: some View {
        // 直接嵌入DailyTaskListView的内容
        DailyTaskListContentWrapper()
    }
}

// MARK: - Content Wrappers

/// EventCenterView内容包装器（不包含NavigationStack）
private struct EventCenterContentWrapper: View {
    @ObservedObject private var fontManager = FontSizeManager.shared
    @AppStorage("hasSeenEventTutorial") private var hasSeenEventTutorial = false
    @State private var showTutorial = false
    @State private var selectedTab: EventCenterTab = .active
    @State private var activeEvents: [EventService.Event] = []
    @State private var upcomingEvents: [EventService.Event] = []
    @State private var myEvents: [EventService.UserEvent] = []
    @State private var endedEvents: [EventService.UserEvent] = []
    @State private var isLoading = false
    @State private var errorMessage: String?

    enum EventCenterTab: String, CaseIterable {
        case active
        case myEvents
        case ended

        var title: String {
            switch self {
            case .active: return NSLocalizedString("event.center.tab.active", comment: "Active")
            case .myEvents: return NSLocalizedString("event.center.tab.my", comment: "My Events")
            case .ended: return NSLocalizedString("event.center.tab.ended", comment: "Ended")
            }
        }

        var icon: String {
            switch self {
            case .active: return "flame.fill"
            case .myEvents: return "person.crop.circle.fill"
            case .ended: return "checkmark.circle.fill"
            }
        }
    }

    var body: some View {
        VStack(spacing: 0) {
            // Stats Header
            statsHeader
                .padding()

            // Upcoming Events Section
            if !upcomingEvents.isEmpty {
                upcomingEventsSection
                    .padding(.horizontal)
                    .padding(.bottom, 12)
            }

            // Tab Selector
            eventTabSelector
                .padding(.horizontal)
                .padding(.bottom, 8)

            // Content
            ScrollView {
                LazyVStack(spacing: AppSpacing.m) {
                    switch selectedTab {
                    case .active:
                        activeEventsContent
                    case .myEvents:
                        myEventsContent
                    case .ended:
                        endedEventsContent
                    }
                }
                .padding(.horizontal)
                .padding(.bottom, 24)
            }
        }
        .background(Color(uiColor: .systemGroupedBackground))
        .task {
            await loadData()
        }
        .refreshable {
            await loadData()
        }
        .alert("Error", isPresented: Binding<Bool>(
            get: { errorMessage != nil },
            set: { if !$0 { errorMessage = nil } }
        )) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(errorMessage ?? "")
        }
        .sheet(isPresented: $showTutorial) {
            EventTutorialView()
                .onDisappear {
                    hasSeenEventTutorial = true
                }
        }
        .onAppear {
            if !hasSeenEventTutorial {
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                    showTutorial = true
                }
            }
        }
    }

    // MARK: - Subviews

    private var statsHeader: some View {
        HStack(spacing: AppSpacing.m) {
            EventStatCard(
                icon: "clock.badge.exclamationmark.fill",
                value: "\(upcomingEvents.count)",
                label: NSLocalizedString("event.stats.upcoming", comment: "Upcoming"),
                fontManager: fontManager
            )

            EventStatCard(
                icon: "flag.2.crossed.fill",
                value: "\(myEvents.count)",
                label: NSLocalizedString("event.stats.participated", comment: "Participated"),
                fontManager: fontManager
            )

            EventStatCard(
                icon: "flame.fill",
                value: "\(activeEvents.count)",
                label: NSLocalizedString("event.stats.active", comment: "Active"),
                fontManager: fontManager
            )

            EventStatCard(
                icon: "trophy.fill",
                value: "\(endedEvents.count)",
                label: NSLocalizedString("event.stats.completed", comment: "Completed"),
                fontManager: fontManager
            )
        }
    }

    private var eventTabSelector: some View {
        HStack(spacing: 0) {
            ForEach(EventCenterTab.allCases, id: \.self) { tab in
                Button(action: {
                    withAnimation(.easeInOut(duration: 0.2)) {
                        selectedTab = tab
                    }
                }) {
                    VStack(spacing: 4) {
                        HStack(spacing: 4) {
                            Image(systemName: tab.icon)
                                .font(fontManager.scaledFont(.caption))
                            Text(tab.title)
                                .font(fontManager.scaledFont(.subheadline).weight(.medium))
                        }
                        .foregroundColor(selectedTab == tab ? AppColors.primary : AppColors.textSecondary)
                        .padding(.vertical, 8)

                        Rectangle()
                            .fill(selectedTab == tab ? AppColors.primary : Color.clear)
                            .frame(height: 2)
                    }
                }
                .frame(maxWidth: .infinity)
            }
        }
        .background(Color(uiColor: .secondarySystemGroupedBackground))
        .cornerRadius(AppRadius.m)
    }

    @ViewBuilder
    private var activeEventsContent: some View {
        if isLoading {
            loadingView
        } else if activeEvents.isEmpty {
            emptyView(message: NSLocalizedString("event.empty.active", comment: "No active events"))
        } else {
            ForEach(activeEvents) { event in
                NavigationLink(destination: EventDetailView(event: event)) {
                    EventCardView(event: convertToUserEvent(event))
                }
                .buttonStyle(PlainButtonStyle())
            }
        }
    }

    @ViewBuilder
    private var myEventsContent: some View {
        if isLoading {
            loadingView
        } else if myEvents.isEmpty {
            emptyView(message: NSLocalizedString("event.empty.my", comment: "You haven't joined any events"))
        } else {
            ForEach(myEvents) { event in
                NavigationLink(destination: eventDetailDestination(for: event)) {
                    EventCardView(event: event, showJoinedDate: true)
                }
                .buttonStyle(PlainButtonStyle())
            }
        }
    }

    @ViewBuilder
    private var endedEventsContent: some View {
        if isLoading {
            loadingView
        } else if endedEvents.isEmpty {
            emptyView(message: NSLocalizedString("event.empty.ended", comment: "No ended events"))
        } else {
            ForEach(endedEvents) { event in
                NavigationLink(destination: EventResultView(eventId: event.id)) {
                    EventCardView(event: event, showJoinedDate: true)
                }
                .buttonStyle(PlainButtonStyle())
            }
        }
    }

    @ViewBuilder
    private var upcomingEventsSection: some View {
        VStack(alignment: .leading, spacing: AppSpacing.m) {
            HStack {
                Image(systemName: "calendar.badge.clock")
                    .font(fontManager.scaledFont(.title3).weight(.semibold))
                    .foregroundColor(AppColors.primary)

                Text(NSLocalizedString("event.upcoming.title", comment: "Upcoming Events"))
                    .font(fontManager.scaledFont(.title3).weight(.semibold))
                    .foregroundColor(AppColors.textPrimary)

                Spacer()

                Text("\(upcomingEvents.count)")
                    .font(fontManager.scaledFont(.subheadline).weight(.medium))
                    .foregroundColor(AppColors.textSecondary)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(AppColors.primary.opacity(0.1))
                    .cornerRadius(AppRadius.s)
            }

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: AppSpacing.m) {
                    ForEach(upcomingEvents) { event in
                        NavigationLink(destination: EventDetailView(event: event)) {
                            UpcomingEventCard(event: event)
                        }
                        .buttonStyle(PlainButtonStyle())
                    }
                }
            }
        }
        .padding()
        .background(Color(uiColor: .secondarySystemGroupedBackground))
        .cornerRadius(AppRadius.l)
    }

    private var loadingView: some View {
        VStack(spacing: AppSpacing.l) {
            ProgressView()
            Text(NSLocalizedString("loading", comment: "Loading..."))
                .font(fontManager.scaledFont(.subheadline))
                .foregroundColor(AppColors.textSecondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, AppSpacing.xxl)
    }

    private func emptyView(message: String) -> some View {
        VStack(spacing: AppSpacing.l) {
            Image(systemName: "calendar.badge.exclamationmark")
                .font(fontManager.scaledFont(.largeTitle))
                .foregroundColor(AppColors.textTertiary)
            Text(message)
                .font(fontManager.scaledFont(.subheadline))
                .foregroundColor(AppColors.textSecondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, AppSpacing.xxl)
    }

    @ViewBuilder
    private func eventDetailDestination(for event: EventService.UserEvent) -> some View {
        EventDetailView(event: EventService.Event(
            id: event.id,
            title: event.title,
            type: event.type,
            status: event.status,
            startTime: event.startTime,
            endTime: event.endTime,
            bannerUrl: event.bannerUrl,
            boundary: nil,
            config: nil
        ))
    }

    private func convertToUserEvent(_ event: EventService.Event) -> EventService.UserEvent {
        EventService.UserEvent(
            id: event.id,
            title: event.title,
            type: event.type,
            status: event.status,
            startTime: event.startTime,
            endTime: event.endTime,
            bannerUrl: event.bannerUrl,
            joinedAt: nil,
            participantType: nil
        )
    }

    private func loadData() async {
        isLoading = true
        errorMessage = nil

        do {
            async let activeTask = EventService.shared.getActiveEvents()
            async let myEventsTask = EventService.shared.getMyEvents()
            async let endedTask = EventService.shared.getEndedEvents()

            let (active, myEventsData, endedData) = try await (activeTask, myEventsTask, endedTask)

            await MainActor.run {
                self.activeEvents = active
                self.myEvents = myEventsData.list
                self.endedEvents = endedData.list
                self.upcomingEvents = active.filter { $0.status == "published" }
                self.isLoading = false
            }
        } catch {
            await MainActor.run {
                self.errorMessage = error.localizedDescription
                self.isLoading = false
            }
        }
    }
}

/// DailyTaskListView内容包装器
private struct DailyTaskListContentWrapper: View {
    var body: some View {
        DailyTaskListView()
    }
}

// MARK: - Event Stat Card Component

private struct EventStatCard: View {
    let icon: String
    let value: String
    let label: String
    @ObservedObject var fontManager: FontSizeManager

    var body: some View {
        VStack(spacing: AppSpacing.xs) {
            Image(systemName: icon)
                .font(fontManager.scaledFont(.title2))
                .foregroundColor(AppColors.primary)

            Text(value)
                .font(fontManager.scaledFont(.title2).weight(.bold))
                .foregroundColor(AppColors.textPrimary)

            Text(label)
                .font(fontManager.scaledFont(.caption))
                .foregroundColor(AppColors.textSecondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, AppSpacing.m)
        .background(Color(uiColor: .secondarySystemGroupedBackground))
        .cornerRadius(AppRadius.l)
    }
}

// MARK: - Preview

#Preview {
    NavigationStack {
        ActivityTabView()
            .environmentObject(AuthViewModel())
            .environmentObject(AppState.shared)
    }
}
