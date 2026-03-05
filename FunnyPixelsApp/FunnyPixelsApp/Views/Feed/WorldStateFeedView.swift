import SwiftUI

struct WorldStateFeedView: View {
    @StateObject private var viewModel = WorldStateFeedViewModel()
    @EnvironmentObject var appState: AppState
    @State private var selectedFilter = "all"
    
    // Navigation states
    @State private var selectedUserId: String?
    @State private var selectedSessionId: String?
    @State private var selectedAllianceId: String?
    @State private var selectedEventId: String?
    @State private var selectedAnnouncementId: String?
    @State private var showToast = false
    @State private var toastMessage = ""
    @State private var toastTask: Task<Void, Never>?

    private let filters = [
        ("all", "feed.world_state.filter.all"),
        ("milestones", "feed.world_state.filter.milestones"),
        ("territories", "feed.world_state.filter.territories"),
        ("events", "feed.world_state.filter.events"),
        ("official", "feed.world_state.filter.official")
    ]
    
    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Filter picker
                filterBar
                
                // Events list
                eventsList
            }
            .navigationDestination(for: String.self) { destination in
                destinationView(for: destination)
            }
            .task {
                if viewModel.events.isEmpty {
                    await viewModel.loadFeed(refresh: true)
                }
            }
            .alert("Error", isPresented: .constant(viewModel.errorMessage != nil)) {
                Button("OK") {
                    viewModel.errorMessage = nil
                }
            } message: {
                if let error = viewModel.errorMessage {
                    Text(error)
                }
            }
        }
        // NavigationLinks for programmatic navigation
        .background(navigationLinks)
        .overlay(toastOverlay)
    }
    
    // MARK: - Components
    
    private var filterBar: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(filters, id: \.0) { filter in
                    FilterChip(
                        title: NSLocalizedString(filter.1, comment: ""),
                        isSelected: selectedFilter == filter.0,
                        action: {
                            selectedFilter = filter.0
                            Task {
                                await viewModel.changeFilter(filter.0)
                            }
                        }
                    )
                }
            }
            .padding(.horizontal)
            .padding(.vertical, 8)
        }
        .background(AppColors.background)
    }
    
    private var eventsList: some View {
        Group {
            if viewModel.isLoading && viewModel.events.isEmpty {
                loadingView
            } else if viewModel.events.isEmpty {
                emptyStateView
            } else {
                ScrollView {
                    LazyVStack(spacing: 1) {  // 1px间距，紧凑排列
                        ForEach(viewModel.events.indices, id: \.self) { index in
                            let event = viewModel.events[index]
                            WorldStateEventCard(event: event) { button in
                                handleAction(button: button, event: event)
                            }
                            .id(event.id)  // 强制使用event.id作为稳定ID
                            .task {
                                if index == viewModel.events.count - 3 {
                                    await viewModel.loadMore()
                                }
                            }
                        }

                        if viewModel.isLoadingMore {
                            ProgressView()
                                .padding()
                        }
                    }
                }
                .refreshable {
                    await viewModel.loadFeed(refresh: true)
                }
            }
        }
    }
    
    private var loadingView: some View {
        VStack {
            Spacer()
            ProgressView()
            Spacer()
        }
    }
    
    private var emptyStateView: some View {
        VStack(spacing: 16) {
            Spacer()
            
            Image(systemName: emptyStateIcon)
                .font(.system(size: 60))
                .foregroundColor(AppColors.textTertiary)
            
            Text(NSLocalizedString(emptyStateTitle, comment: ""))
                .font(.title3.weight(.semibold))
                .foregroundColor(AppColors.textPrimary)
            
            Text(NSLocalizedString(emptyStateMessage, comment: ""))
                .font(.subheadline)
                .foregroundColor(AppColors.textSecondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)
            
            Spacer()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
    
    // MARK: - Navigation Links (Hidden)
    
    private var navigationLinks: some View {
        ZStack {
            // User Profile Navigation
            NavigationLink(
                destination: selectedUserId.map { UserProfileView(userId: $0) },
                tag: "profile",
                selection: Binding(
                    get: { selectedUserId != nil ? "profile" : nil },
                    set: { if $0 == nil { selectedUserId = nil } }
                )
            ) { EmptyView() }
            .hidden()
            
            // Session Detail Navigation
            NavigationLink(
                destination: selectedSessionId.map { SessionDetailView(sessionId: $0) },
                tag: "session",
                selection: Binding(
                    get: { selectedSessionId != nil ? "session" : nil },
                    set: { if $0 == nil { selectedSessionId = nil } }
                )
            ) { EmptyView() }
            .hidden()
            
            // Alliance Navigation (如果存在AllianceDetailView)
            // NavigationLink for alliance would go here
        }
    }
    
    // MARK: - Toast Overlay
    
    private var toastOverlay: some View {
        VStack {
            if showToast {
                Text(toastMessage)
                    .font(.system(size: 14))
                    .foregroundColor(.white)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 10)
                    .background(Color.black.opacity(0.8))
                    .cornerRadius(8)
                    .transition(.move(edge: .top).combined(with: .opacity))
                    .padding(.top, 50)
            }
            Spacer()
        }
        .animation(.easeInOut, value: showToast)
    }
    
    // MARK: - Helper Methods
    
    private var emptyStateIcon: String {
        switch selectedFilter {
        case "milestones": return "star"
        case "territories": return "map"
        case "events": return "flag"
        case "official": return "megaphone"
        default: return "globe"
        }
    }
    
    private var emptyStateTitle: String {
        "feed.world_state.empty.\(selectedFilter).title"
    }
    
    private var emptyStateMessage: String {
        "feed.world_state.empty.\(selectedFilter).message"
    }
    
    @ViewBuilder
    private func destinationView(for destination: String) -> some View {
        EmptyView()
    }
    
    private func handleAction(button: EventActionButton, event: WorldStateEvent) {
        // 添加haptic feedback
        let impact = UIImpactFeedbackGenerator(style: .light)
        impact.impactOccurred()
        
        switch button.actionType {
        case .viewProfile:
            if let userId = button.targetId {
                selectedUserId = userId
                Logger.info("Navigating to profile: \(userId)")
            }
            
        case .viewSession:
            if let sessionId = button.targetId {
                selectedSessionId = sessionId
                Logger.info("Navigating to session: \(sessionId)")
            }
            
        case .navigateMap:
            if let location = event.metadata.location,
               let lat = location.lat,
               let lng = location.lng {
                // Switch to map tab and navigate
                appState.selectedTab = .map
                appState.navigateToMap(coordinate: (lat: lat, lng: lng))
                Logger.info("Navigating to map: \(lat), \(lng)")
            } else {
                showToastMessage(NSLocalizedString("world_state.toast.location_unavailable", comment: ""))
            }
            
        case .viewAlliance:
            if let allianceId = button.targetId {
                // 切换到联盟Tab（现在在Profile菜单中）
                appState.selectedTab = .profile
                selectedAllianceId = allianceId
                showToastMessage(NSLocalizedString("world_state.toast.opening_alliance", comment: ""))
                Logger.info("Navigating to alliance: \(allianceId)")
            }
            
        case .viewEvent:
            if let eventId = button.targetId {
                // 切换到活动Tab
                appState.selectedTab = .activity
                selectedEventId = eventId
                showToastMessage(NSLocalizedString("world_state.toast.opening_event", comment: ""))
                Logger.info("Navigating to event: \(eventId)")
            }
            
        case .viewAnnouncement:
            if let announcementId = button.targetId {
                selectedAnnouncementId = announcementId
                showToastMessage(NSLocalizedString("world_state.toast.announcement_coming_soon", comment: ""))
                Logger.info("Announcement selected: \(announcementId)")
            }
        }
    }
    
    private func showToastMessage(_ message: String) {
        // 性能优化：取消之前的toast任务，避免内存泄漏
        toastTask?.cancel()

        toastMessage = message
        withAnimation {
            showToast = true
        }

        toastTask = Task {
            try? await Task.sleep(nanoseconds: 2_000_000_000)
            guard !Task.isCancelled else { return }
            await MainActor.run {
                withAnimation {
                    showToast = false
                }
            }
        }
    }
}
