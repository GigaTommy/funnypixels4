import SwiftUI

/// Event Center - Main entry point for event management
/// Located in Profile Tab as per design requirements
struct EventCenterView: View {
    @ObservedObject private var fontManager = FontSizeManager.shared
    @AppStorage("hasSeenEventTutorial") private var hasSeenEventTutorial = false  // P1-2
    @State private var showTutorial = false  // P1-2
    @State private var selectedTab: EventTab = .active
    @State private var activeEvents: [EventService.Event] = []
    @State private var upcomingEvents: [EventService.Event] = []  // ✅ P1-1: Upcoming events
    @State private var myEvents: [EventService.UserEvent] = []
    @State private var endedEvents: [EventService.UserEvent] = []
    @State private var isLoading = false
    @State private var errorMessage: String?

    enum EventTab: String, CaseIterable {
        case active = "active"
        case myEvents = "my"
        case ended = "ended"

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

            // Upcoming Events Section (P1-1)
            if !upcomingEvents.isEmpty {
                upcomingEventsSection
                    .padding(.horizontal)
                    .padding(.bottom, 12)
            }

            // Tab Selector
            tabSelector
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
        .navigationTitle(NSLocalizedString("event.center.title", comment: "Event Center"))
        .navigationBarTitleDisplayMode(.large)
        .hideTabBar()
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
        // P1-2: Show tutorial on first launch
        .sheet(isPresented: $showTutorial) {
            EventTutorialView()
                .onDisappear {
                    hasSeenEventTutorial = true
                }
        }
        .onAppear {
            if !hasSeenEventTutorial {
                // Delay slightly to let the view settle
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                    showTutorial = true
                }
            }
        }
    }

    // MARK: - Subviews

    private var statsHeader: some View {
        HStack(spacing: AppSpacing.m) {
            StatCard(
                icon: "clock.badge.exclamationmark.fill",
                value: "\(upcomingEvents.count)",
                label: NSLocalizedString("event.stats.upcoming", comment: "Upcoming"),
                fontManager: fontManager
            )

            StatCard(
                icon: "flag.2.crossed.fill",
                value: "\(myEvents.count)",
                label: NSLocalizedString("event.stats.participated", comment: "Participated"),
                fontManager: fontManager
            )

            StatCard(
                icon: "flame.fill",
                value: "\(activeEvents.count)",
                label: NSLocalizedString("event.stats.active", comment: "Active"),
                fontManager: fontManager
            )

            StatCard(
                icon: "trophy.fill",
                value: "\(endedEvents.count)",
                label: NSLocalizedString("event.stats.completed", comment: "Completed"),
                fontManager: fontManager
            )
        }
    }

    private var tabSelector: some View {
        HStack(spacing: 0) {
            ForEach(EventTab.allCases, id: \.self) { tab in
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

    // MARK: - P1-1: Upcoming Events Section

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

            // Horizontal scroll of upcoming event cards
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

    // MARK: - Helpers

    @ViewBuilder
    private func eventDetailDestination(for event: EventService.UserEvent) -> some View {
        // Convert UserEvent to Event for detail view
        // In a real app, you might want to fetch the full event details
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

    // MARK: - Data Loading

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

                // ✅ P1-1: Filter upcoming events (status="published")
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

// MARK: - Stat Card Component

private struct StatCard: View {
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
        EventCenterView()
    }
}
