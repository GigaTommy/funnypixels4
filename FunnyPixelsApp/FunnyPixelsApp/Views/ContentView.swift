import SwiftUI
import CoreLocation
import AudioToolbox  // 用于播放音效

/// 主内容视图
public struct ContentView: View {
    @StateObject private var authViewModel = AuthViewModel()
    @State private var showAuthSheet = false

    public init() {}

    public var body: some View {
        ZStack {
            // 背景层（保持视觉连续性）
            Color(hex: "F8F9FA")
                .ignoresSafeArea()

            // 内容层（带动画过渡）
            Group {
                if authViewModel.isValidatingSession {
                    // ✅ 验证中 - 品牌化加载界面（最多显示2秒）
                    LaunchLoadingView()
                        .transition(.opacity)
                        .zIndex(3)
                } else if authViewModel.isAuthenticated {
                    // ✅ 已认证 - 主界面（验证成功后进入）
                    MainMapView()
                        .environmentObject(authViewModel)
                        .transition(.opacity.combined(with: .scale(scale: 0.95)))
                        .zIndex(2)
                } else {
                    // ✅ 未认证 - 登录界面（无 token 或验证失败）
                    AuthView()
                        .environmentObject(authViewModel)
                        .transition(.opacity)
                        .zIndex(1)
                }
            }
            .animation(.easeInOut(duration: 0.3), value: authViewModel.isValidatingSession)
            .animation(.easeInOut(duration: 0.3), value: authViewModel.isAuthenticated)
        }
    }
}

/// 主视图（使用原生TabView架构）
struct MainMapView: View {
    @EnvironmentObject var authViewModel: AuthViewModel
    @ObservedObject private var locationManager = LocationManager.shared
    @ObservedObject private var deepLinkHandler = DeepLinkHandler.shared
    @ObservedObject var eventManager = EventManager.shared
    @ObservedObject private var badgeVM = BadgeViewModel.shared
    @StateObject private var appState = AppState.shared

    // 成就解锁Toast（支持队列，避免同时解锁多个成就时丢失通知）
    @State private var achievementQueue: [AchievementService.Achievement] = []
    @State private var newAchievement: AchievementService.Achievement?
    @State private var showAchievementToast = false

    // Onboarding State
    @AppStorage("hasSeenOnboarding_v1") private var hasSeenOnboarding = false
    @State private var showOnboarding = false
    @State private var showLocationPreEducation = false

    // Deep link navigation state
    @State private var deepLinkEvent: EventService.Event?
    @State private var deepLinkAllianceCode: String?
    @State private var showDailyTasksFromMap = false

    // Daily reward summary
    @AppStorage("com.funnypixels.lastRewardSummaryDate") private var lastRewardSummaryDate: String = ""
    @State private var showRewardSummary = false
    @State private var pendingRewardSummary: DailyRewardService.RewardSummary?

    var body: some View {
        TabView(selection: Binding(
            get: { appState.selectedTab.index },
            set: { index in
                if let tab = Tab.allCases.first(where: { $0.index == index }) {
                    appState.selectedTab = tab
                }
            }
        )) {
            // ⚡ 地图Tab (默认显示，不需要懒加载)
            MapTabContent()
                .environmentObject(authViewModel)
                .tabItem {
                    Image("TabIconMap")
                    Text(Tab.map.title)
                }
                .badge(badgeVM.mapHasActivity ? " " : nil)
                .tag(Tab.map.index)

            // ⚡ 动态Tab (懒加载 - 首次点击时创建)
            LazyView(
                FeedTabView()
                    .environmentObject(authViewModel)
                    .environmentObject(appState)
            )
            .tabItem {
                Image("TabIconFeed")
                Text(Tab.feed.title)
            }
            .tag(Tab.feed.index)

            // ⚡ 联盟Tab (懒加载 - 首次点击时创建)
            LazyView(
                AllianceTabView()
                    .environmentObject(authViewModel)
                    .environmentObject(appState)
            )
            .tabItem {
                Image("TabIconAlliance")
                Text(Tab.alliance.title)
            }
            .badge(badgeVM.allianceCount > 0 ? "\(badgeVM.allianceCount)" : nil)
            .tag(Tab.alliance.index)

            // ⚡ 个人Tab (懒加载 - 首次点击时创建，集成排行榜)
            LazyView(
                ProfileTabView()
                    .environmentObject(authViewModel)
                    .environmentObject(appState)
            )
            .tabItem {
                Image("TabIconProfile")
                Text(Tab.profile.title)
            }
            .badge(badgeVM.profileCount > 0 ? "\(badgeVM.profileCount)" : nil)
            .tag(Tab.profile.index)
        }
        .tint(AppColors.primary) // 选中状态使用主题色
        .onChange(of: appState.selectedTab) { oldValue, newValue in
            // Tab 切换音效 + 触觉反馈
            SoundManager.shared.play(.tabSwitch)
            HapticManager.shared.impact(style: .light)
        }
        .overlay(alignment: .top) {
            // 全局Toast层
            VStack {
                // Achievement Toast
                if let achievement = newAchievement, showAchievementToast {
                    AchievementUnlockToast(achievement: achievement, isPresented: $showAchievementToast)
                        .padding(.top, 50)
                        .transition(.move(edge: .top).combined(with: .opacity))
                }

                // Event Zone Toast
                if let notification = eventManager.zoneNotification {
                    EventZoneToast(
                        type: mapZoneNotification(notification),
                        isPresented: Binding(
                            get: { eventManager.zoneNotification != nil },
                            set: { if !$0 { eventManager.zoneNotification = nil } }
                        )
                    )
                    .padding(.top, showAchievementToast ? 120 : 50)
                    .transition(.move(edge: .top).combined(with: .opacity))
                }

                // Territory Battle Banner
                TerritoryBattleBanner()
                    .padding(.top, 8)

                Spacer()
            }
            .animation(.spring(response: 0.5, dampingFraction: 0.7), value: eventManager.zoneNotification != nil)
        }
        .fullScreenCover(isPresented: $showOnboarding, onDismiss: {
            hasSeenOnboarding = true
            if locationManager.authorizationStatus == .notDetermined {
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                    showLocationPreEducation = true
                }
            }
        }) {
            OnboardingView(isPresented: $showOnboarding)
        }
        .fullScreenCover(isPresented: $showLocationPreEducation) {
            LocationPermissionView(isPresented: $showLocationPreEducation)
        }
        .onAppear {
            if !hasSeenOnboarding {
                showOnboarding = true
            }

            // Only auto-request if already granted (for returning users)
            if locationManager.authorizationStatus != .notDetermined {
                locationManager.requestAuthorization()
            }

            // ⚡ 延迟启动非关键服务，避免阻塞UI渲染
            Task {
                // 延迟500ms启动后台服务
                try? await Task.sleep(nanoseconds: 500_000_000)

                // 启动 Tab Bar Badge 轮询
                BadgeViewModel.shared.startPolling()

                // 🍾 启动漂流瓶遭遇检测和配额刷新
                DriftBottleManager.shared.startEncounterDetection()
                await DriftBottleManager.shared.refreshQuota()
                await DriftBottleManager.shared.refreshUnreadCount()

                // Check for pending daily reward summary
                try? await Task.sleep(nanoseconds: 1_500_000_000)  // 总计2秒延迟
                await checkDailyRewardSummary()
            }
        }
        .onReceive(NotificationCenter.default.publisher(for: .achievementUnlocked)) { notification in
            if let achievement = notification.object as? AchievementService.Achievement {
                // 队列去重：同一成就不重复入队
                guard !achievementQueue.contains(where: { $0.id == achievement.id }),
                      newAchievement?.id != achievement.id else { return }

                if showAchievementToast {
                    // 当前有 Toast 显示中，排队等待
                    achievementQueue.append(achievement)
                } else {
                    showNextAchievementToast(achievement)
                }
            }
        }
        .onChange(of: showAchievementToast) {
            // Toast 消失后，显示队列中的下一个
            if !showAchievementToast, !achievementQueue.isEmpty {
                let next = achievementQueue.removeFirst()
                // 延迟 0.3s 避免动画重叠
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                    showNextAchievementToast(next)
                }
            }
        }
        .onChange(of: deepLinkHandler.pendingDestination) {
            guard let destination = deepLinkHandler.pendingDestination else { return }
            handleDeepLink(destination)
            deepLinkHandler.clearDestination()
        }
        .onReceive(NotificationCenter.default.publisher(for: .switchToMapTab)) { _ in
            appState.navigate(to: .map)
        }
        .onReceive(NotificationCenter.default.publisher(for: .navigateToTab)) { notification in
            if let tabIndex = notification.object as? Int {
                // Convert old tab indices to new Tab enum (4 tabs: map, feed, alliance, profile)
                switch tabIndex {
                case 0: appState.navigate(to: .map)
                case 1: appState.navigate(to: .feed)
                case 2: appState.navigate(to: .alliance)
                case 3: appState.navigate(to: .profile)
                case 4: appState.navigate(to: .profile)  // ✅ 兼容旧版本：索引4原为排行榜
                default: break
                }
            }
        }
        .onReceive(NotificationCenter.default.publisher(for: .navigateToDailyTasks)) { _ in
            appState.navigate(to: .profile)
            showDailyTasksFromMap = true
        }
        .onReceive(NotificationCenter.default.publisher(for: .openEventDetail)) { notification in
            if let eventId = notification.object as? String {
                Task {
                    if let event = try? await EventService.shared.getEventDetail(eventId: eventId) {
                        await MainActor.run { deepLinkEvent = event }
                    }
                }
            }
        }
        .sheet(item: $deepLinkEvent) { event in
            NavigationView {
                EventDetailView(event: event)
            }
        }
        .sheet(isPresented: $showRewardSummary) {
            if let summary = pendingRewardSummary {
                DailyRewardSummarySheet(summary: summary)
                    .presentationDetents([.medium])
                    .presentationDragIndicator(.visible)
            }
        }
        // P1-3: Enable milestone toast notifications
        .milestoneToast()
        // P1-5: Enable rank change toast notifications
        .rankChangeToast()
    }

    // MARK: - Deep Link Handling
    private func showNextAchievementToast(_ achievement: AchievementService.Achievement) {
        newAchievement = achievement
        withAnimation(.spring(response: 0.6, dampingFraction: 0.7)) {
            showAchievementToast = true
        }
        AudioServicesPlaySystemSound(1057)
        let generator = UINotificationFeedbackGenerator()
        generator.notificationOccurred(.success)
        Logger.info("🏆 Achievement unlocked: \(achievement.name) (+\(achievement.rewardPoints) points)")
    }

    private func handleDeepLink(_ destination: DeepLinkHandler.DeepLinkDestination) {
        switch destination {
        case .allianceInvite(let code):
            appState.navigate(to: .alliance)
            deepLinkAllianceCode = code
            NotificationCenter.default.post(name: .deepLinkAllianceInvite, object: code)

        case .eventDetail(let eventId):
            appState.navigate(to: .map)
            Task {
                if let event = try? await EventService.shared.getEventDetail(eventId: eventId) {
                    await MainActor.run { deepLinkEvent = event }
                }
            }

        case .userProfile(let userId):
            appState.navigate(to: .profile)
            NotificationCenter.default.post(name: .deepLinkUserProfile, object: userId)

        case .mapLocation(let lat, let lng):
            appState.navigate(to: .map)
            Task {
                let coordinate = CLLocationCoordinate2D(latitude: lat, longitude: lng)
                await MapController.shared.flyToCoordinate(coordinate, name: "")
            }

        case .checkin:
            // 签到功能已弃用，忽略此deep link
            break

        case .leaderboard:
            // TODO: 排行榜已从Profile Tab移除，暂时重定向到Profile Tab
            // 未来可能需要独立的排行榜页面或提升到主Tab
            appState.navigate(to: .profile)

        case .tab(let index):
            // Convert old tab indices to new Tab enum (4 tabs: map, feed, alliance, profile)
            switch index {
            case 0: appState.navigate(to: .map)
            case 1: appState.navigate(to: .feed)
            case 2: appState.navigate(to: .alliance)
            case 3: appState.navigate(to: .profile)
            case 4: appState.navigate(to: .profile)  // ✅ 兼容旧版本：索引4原为排行榜，现重定向到Profile Tab
            default: break
            }
        }
    }

    // MARK: - Zone Notification Helper
    private func mapZoneNotification(_ notification: EventManager.ZoneNotification) -> EventZoneToast.ToastType {
        switch notification {
        case .entered(let title):
            return .entered(eventTitle: title)
        case .exited(let title):
            return .exited(eventTitle: title)
        case .ending(let title, let minutes):
            return .ending(eventTitle: title, minutesLeft: minutes)
        case .ended(let title):
            return .ended(eventTitle: title)
        }
    }

    // MARK: - Daily Reward Summary
    private func checkDailyRewardSummary() async {
        let formatter = DateFormatter.with(format: "yyyy-MM-dd")
        let today = formatter.string(from: Date())
        guard lastRewardSummaryDate != today else { return }
        do {
            let data = try await DailyRewardService.shared.getPendingSummary()
            if data.has_pending, let summary = data.summary {
                pendingRewardSummary = summary
                showRewardSummary = true
                lastRewardSummaryDate = today
            } else {
                lastRewardSummaryDate = today // no pending, skip today
            }
        } catch {
            Logger.error("Failed to check daily reward summary: \(error)")
        }
    }
}

