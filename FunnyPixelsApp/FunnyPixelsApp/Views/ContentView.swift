import SwiftUI
import CoreLocation
import AudioToolbox  // 用于播放音效

/// 主内容视图
public struct ContentView: View {
    // ✅ 响应式设计：监听字体设置变化
    @ObservedObject private var fontManager = FontSizeManager.shared

    @StateObject private var authViewModel = AuthViewModel()
    @State private var showAuthSheet = false

    public init() {
        // ⚡ Performance: Mark app startup
        Task { @MainActor in
            PerformanceMonitor.shared.markAppStartup()

            // ⚡ Start MetricKit if user enabled performance monitoring
            if UserDefaults.standard.bool(forKey: "performance_monitoring_enabled") {
                MetricsManager.shared.startCollecting()
            }
        }
    }

    public var body: some View {
        ZStack {
            // 背景层（保持视觉连续性）
            Color(hex: "F8F9FA")
                .ignoresSafeArea()

            // 内容层（带动画过渡）
            // ⚡ 性能优化：乐观启动策略
            // - 不等待验证完成，立即显示登录页
            // - 验证在后台进行，成功后自动跳转到主界面
            // - 大幅减少白屏时间（从1-30秒降至0.5-1秒）
            Group {
                if authViewModel.isAuthenticated {
                    // ✅ 已认证 - 主界面
                    MainMapView()
                        .environmentObject(authViewModel)
                        .transition(.opacity.combined(with: .scale(scale: 0.95)))
                        .zIndex(2)
                } else {
                    // ✅ 未认证或验证中 - 立即显示登录界面
                    ZStack {
                        AuthView()
                            .environmentObject(authViewModel)
                            .transition(.opacity)
                            .zIndex(1)

                        // ⚡ 验证中显示顶部进度条（非侵入式，不阻塞UI）
                        if authViewModel.isValidatingSession {
                            VStack(spacing: 0) {
                                // 顶部进度条
                                ProgressView()
                                    .progressViewStyle(.linear)
                                    .tint(AppColors.primary)
                                    .padding(.horizontal)

                                // 提示文本
                                Text(NSLocalizedString("auth.validating", value: "Verifying session...", comment: ""))
                                    .responsiveFont(.caption, weight: .medium)
                                    .foregroundColor(AppColors.textSecondary)
                                    .padding(.top, 8)

                                Spacer()
                            }
                            .padding(.top, 50)
                            .transition(.move(edge: .top).combined(with: .opacity))
                        }
                    }
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

    // Onboarding State (v2: interactive overlay on top of map)
    @AppStorage("hasSeenOnboarding_v2") private var hasSeenOnboarding = false
    @State private var showOnboarding = false
    @State private var showLocationPreEducation = false

    // Deep link navigation state
    @State private var deepLinkEvent: EventService.Event?
    @State private var deepLinkAllianceCode: String?

    // Daily reward summary
    @AppStorage("com.funnypixels.lastRewardSummaryDate") private var lastRewardSummaryDate: String = ""
    @State private var showRewardSummary = false
    @State private var pendingRewardSummary: DailyRewardService.RewardSummary?

    var body: some View {
        mainTabView
    }

    // MARK: - Main Tab View

    private var mainTabView: some View {
        TabView(selection: $appState.selectedTab) {
            mapTab
            feedTab
            activityTab
            profileTab
        }
        .tint(AppColors.primary)
        .onChange(of: appState.selectedTab) { oldValue, newValue in
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
        .overlay {
            // Interactive onboarding overlay (v2) - map visible underneath
            if showOnboarding {
                OnboardingOverlayView(isPresented: $showOnboarding)
                    .transition(.opacity)
                    .zIndex(500)
            }
        }
        .onChange(of: showOnboarding) {
            if !showOnboarding {
                // Onboarding dismissed - persist and show location permission if needed
                hasSeenOnboarding = true
                if locationManager.authorizationStatus == .notDetermined {
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                        showLocationPreEducation = true
                    }
                }
            }
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
                // Convert old tab indices to new Tab enum (4 tabs: map, feed, activity, profile)
                switch tabIndex {
                case 0: appState.navigate(to: .map)
                case 1: appState.navigate(to: .feed)
                case 2: appState.navigate(to: .activity)  // ✅ 原联盟Tab现为活动Tab
                case 3: appState.navigate(to: .profile)
                case 4: appState.navigate(to: .profile)  // ✅ 兼容旧版本：索引4原为排行榜
                default: break
                }
            }
        }
        .onReceive(NotificationCenter.default.publisher(for: .navigateToDailyTasks)) { _ in
            // Navigate to Activity Tab → Tasks sub-tab
            appState.navigate(to: .activity)
            appState.activitySubTab = .tasks
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

    // MARK: - Individual Tabs

    private var mapTab: some View {
        MapTabContent()
            .environmentObject(authViewModel)
            .tabItem {
                Image("TabIconMap")
                Text(Tab.map.title)
            }
            .badge(badgeVM.mapHasActivity ? " " : nil)
            .tag(Tab.map)
    }

    private var feedTab: some View {
        LazyView(
            FeedTabView()
                .environmentObject(authViewModel)
                .environmentObject(appState)
        )
        .tabItem {
            Image("TabIconFeed")
            Text(Tab.feed.title)
        }
        .tag(Tab.feed)
    }

    private var activityTab: some View {
        LazyView(
            ActivityTabView()
                .environmentObject(authViewModel)
                .environmentObject(appState)
        )
        .tabItem {
            Image("TabIconActivity")
            Text(Tab.activity.title)
        }
        .tag(Tab.activity)
    }

    private var profileTab: some View {
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
        .tag(Tab.profile)
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
            // Alliance is now in Profile menu, so navigate to profile
            appState.navigate(to: .profile)
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
            // Convert old tab indices to new Tab enum (4 tabs: map, feed, activity, profile)
            switch index {
            case 0: appState.navigate(to: .map)
            case 1: appState.navigate(to: .feed)
            case 2: appState.navigate(to: .activity)  // ✅ 原联盟Tab现为活动Tab
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

