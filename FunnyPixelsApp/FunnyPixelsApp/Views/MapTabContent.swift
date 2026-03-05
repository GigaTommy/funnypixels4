import SwiftUI
import CoreLocation
import AudioToolbox

/// 地图Tab内容视图
/// 包含地图、所有地图专属UI元素和交互逻辑
struct MapTabContent: View {
    @EnvironmentObject var authViewModel: AuthViewModel
    @ObservedObject private var locationManager = LocationManager.shared
    @ObservedObject var drawingState = DrawingStateManager.shared
    @ObservedObject var patternProvider = AllianceDrawingPatternProvider.shared
    @ObservedObject var eventManager = EventManager.shared
    @ObservedObject private var territoryBannerManager = TerritoryBannerManager.shared
    @ObservedObject private var driftBottleManager = DriftBottleManager.shared
    @ObservedObject private var gpsDrawingService = GPSDrawingService.shared
    @ObservedObject private var fontManager = FontSizeManager.shared

    // Map interaction states
    @State private var isRoaming = false
    @State private var isCentering = false
    @State private var isMapDetached = false
    @State private var roamingDestination: String? = nil
    @State private var showHotspotExplore = false
    @State private var roamingHotspots: [HotspotService.Hotspot] = []
    @State private var roamingIndex = 0

    // GPS Test states
    @State private var isRandomTesting = false
    @State private var randomTestProgress = 0
    @State private var showLocationPicker = false

    // Tooltip states
    @State private var showFABTooltip = false
    @State private var showFlagSwitchTooltip = false
    @AppStorage("com.funnypixels.hasShownFlagSwitchTooltip") private var hasShownFlagSwitchTooltip = false

    // First pixel celebration
    @State private var showFirstPixelCelebration = false
    @AppStorage("hasDrawnFirstPixel") private var hasDrawnFirstPixel = false

    // Drift Bottle Map Markers
    @State private var lastMarkersRefreshLocation: CLLocation?

    // Leaderboard
    @State private var showLeaderboard = false

    private let mapController = MapController.shared

    // 检查是否为调试模式
    private var isDebugMode: Bool {
        #if DEBUG
        return true
        #else
        return false
        #endif
    }

    /// 用户是否有多种旗帜选项（头像或联盟）
    private var userHasMultipleFlagOptions: Bool {
        let hasAvatar = AuthManager.shared.currentUser?.avatarUrl != nil &&
                       !(AuthManager.shared.currentUser?.avatarUrl?.isEmpty ?? true)
        let hasAlliance = AuthManager.shared.currentUser?.alliance != nil
        return hasAvatar || hasAlliance
    }

    var body: some View {
        ZStack {
            // 🔧 地图视图（基础层）
            // 漂流瓶标记现在直接在MapLibreMapView内部使用GeoJSON图层渲染，不再使用overlay
            MapLibreMapView()
                .id("persistentMapView") // 稳定ID确保视图持久化
                .edgesIgnoringSafeArea(.all)

            // 🔧 地图专属UI层
            mapOverlayUI

            // 🔧 地图交互元素
            mapInteractiveElements

            // 🎯 专注模式覆盖层（最高优先级 - 防误触）
            if GPSDrawingService.shared.isFocusMode {
                FocusModeOverlay()
                    .transition(.opacity)
                    .zIndex(1000)
            }
        }
        .sheet(isPresented: $showHotspotExplore) {
            HotspotExploreSheet { hotspot in
                Task {
                    isRoaming = true
                    await mapController.flyToCoordinate(hotspot.coordinate, name: hotspot.name)
                    try? await Task.sleep(nanoseconds: 1_000_000_000)
                    isRoaming = false
                }
            }
            .presentationDetents([.medium, .large])
            .presentationDragIndicator(.visible)
        }
        .sheet(isPresented: $showLeaderboard) {
            NavigationView {
                LeaderboardTabView()
            }
            .presentationDetents([.large])
            .presentationDragIndicator(.visible)
        }
        .sheet(isPresented: $drawingState.showSessionSummary) {
            if let stats = drawingState.lastSessionStats {
                SessionSummaryView(stats: stats, mapImage: drawingState.lastSessionImage)
            }
        }
        .sheet(isPresented: $drawingState.showAllianceSelection) {
            AllianceSelectionSheet(alliances: drawingState.userAlliances) { selectedAlliance in
                 Task {
                     await drawingState.confirmStartGPSDrawing(alliance: selectedAlliance)
                 }
            }
            .presentationDetents([.medium, .large])
            .presentationDragIndicator(.visible)
        }
        .sheet(isPresented: $drawingState.showFlagSelection) {
            FlagSelectionSheet(
                personalColor: PersonalColorPalette.colorForUser(AuthManager.shared.currentUser?.id ?? ""),
                hasPixelAvatar: {
                    guard let avatarUrl = AuthManager.shared.currentUser?.avatarUrl,
                          !avatarUrl.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
                        return false
                    }
                    return true
                }(),
                avatarData: AuthManager.shared.currentUser?.avatarUrl ?? "",  // ✅ 传递avatar_url用于预览
                alliances: drawingState.userAlliances,
                currentChoice: drawingState.currentFlagChoice
            ) { choice in
                Task { await drawingState.confirmFlagSelection(choice: choice) }
            }
            .presentationDetents([.medium, .large])
            .presentationDragIndicator(.visible)
        }
        .sheet(isPresented: $territoryBannerManager.showBattleFeed) {
            BattleFeedView()
                .presentationDetents([.medium, .large])
                .presentationDragIndicator(.visible)
        }
        .sheet(isPresented: $showLocationPicker) {
            TestLocationPickerView { coordinate in
                Task {
                    Logger.info("🎯 [Callback] Received coordinate from picker: \(coordinate.latitude), \(coordinate.longitude)")
                    try? await Task.sleep(nanoseconds: 500_000_000)
                    let alliance = UserDefaults.standard.integer(forKey: "LastSelectedTestAlliance")
                    let allianceId = alliance != 0 ? alliance : nil
                    await runRandomGPSTest(center: coordinate, allianceId: allianceId)
                }
            }
        }
        .sheet(isPresented: $driftBottleManager.showBottleSheet) {
            DriftBottleBottomSheet()
                .presentationDetents([.medium, .large])
                .presentationDragIndicator(.visible)
        }
        .sheet(isPresented: $driftBottleManager.showOpenView) {
            if let bottle = driftBottleManager.currentEncounter {
                DriftBottleOpenView(bottle: bottle)
            }
        }
        .sheet(isPresented: $driftBottleManager.showReunionView) {
            if let bottle = driftBottleManager.reunionEncounter {
                DriftBottleReunionView(bottle: bottle)
            }
        }
        .toast(isPresented: $driftBottleManager.showBottleEarnedToast, message: NSLocalizedString("drift_bottle.indicator.earned", comment: ""), style: .success)
        .onReceive(NotificationCenter.default.publisher(for: .mapTrackingStateChanged)) { notification in
            if let isDetached = notification.object as? Bool {
                withAnimation(.spring()) {
                    isMapDetached = isDetached
                }
            }
        }
        .onReceive(NotificationCenter.default.publisher(for: Notification.Name("roamingStarted"))) { notification in
            if let name = notification.object as? String {
                withAnimation(.spring()) {
                    roamingDestination = name
                }
                DispatchQueue.main.asyncAfter(deadline: .now() + 3.0) {
                    withAnimation {
                        if roamingDestination == name {
                            roamingDestination = nil
                        }
                    }
                }
            }
        }
        .onReceive(NotificationCenter.default.publisher(for: NSNotification.Name("ShowTestLocationPicker"))) { notification in
            if let userInfo = notification.userInfo, let allianceId = userInfo["allianceId"] as? Int {
                UserDefaults.standard.set(allianceId, forKey: "LastSelectedTestAlliance")
            } else {
                UserDefaults.standard.removeObject(forKey: "LastSelectedTestAlliance")
            }
            showLocationPicker = true
        }
        .onReceive(NotificationCenter.default.publisher(for: .requestStartDrawing)) { _ in
            Task {
                try? await Task.sleep(nanoseconds: 300_000_000)
                await drawingState.requestStartGPSDrawing(forcePicker: false)
            }
        }
        .onChange(of: GPSDrawingService.shared.drawnPixelsCount) {
            let newCount = GPSDrawingService.shared.drawnPixelsCount
            if newCount == 1 && !hasDrawnFirstPixel {
                hasDrawnFirstPixel = true
                SoundManager.shared.playSuccess()
                withAnimation(.spring(response: 0.5)) {
                    showFirstPixelCelebration = true
                }
            }
        }
        .onAppear {
            Task {
                await patternProvider.loadDrawingPattern()
            }

            // 启动漂流瓶地图标记刷新
            startBottleMarkersRefresh()

            // 旗帜切换 Tooltip（仅首次、仅当有多种选项时）
            if userHasMultipleFlagOptions && !hasShownFlagSwitchTooltip && !showFABTooltip {
                DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
                    withAnimation(.spring(response: 0.4)) {
                        showFlagSwitchTooltip = true
                        hasShownFlagSwitchTooltip = true
                    }
                }
            }
        }
        .onDisappear {
            // 停止漂流瓶地图标记刷新
            driftBottleManager.stopMapMarkersAutoRefresh()
        }
        .onChange(of: locationManager.currentLocation) { oldLocation, newLocation in
            // 位置变化时刷新地图标记
            handleLocationChange(newLocation)
        }
        .toolbar(gpsDrawingService.isGPSDrawingMode ? .hidden : .visible, for: .tabBar)
    }

    // MARK: - Map Overlay UI

    private var mapOverlayUI: some View {
        Group {
            // 0. Map Mode Indicator (左上角) - 仅在 war 模式下展示
            if case .war = currentMapMode {
                VStack {
                    HStack {
                        MapModeIndicator(mode: currentMapMode)
                            .padding(.top, 60)
                            .padding(.leading, 16)
                        Spacer()
                    }
                    Spacer()
                }
                .zIndex(101)
                .transition(.opacity.combined(with: .scale(scale: 0.8)))
                .animation(.spring(response: 0.3), value: GPSDrawingService.shared.isGPSDrawingMode)
            }

            // 1. 赛事活动跑马灯通知 (左上角置顶) - 统一显示附近活动或同城活动
            // 优先级：附近活动 > 同城活动
            let eventsToShow: [EventService.Event] = {
                if let nearbyEvent = eventManager.nearbyEvent {
                    // 优先显示附近活动
                    return [nearbyEvent.event]
                } else {
                    // 否则显示同城活动（50km内）
                    return eventManager.localCityEvents.filter {
                        $0.status == "published" || $0.status == "active"
                    }
                }
            }()

            if !eventsToShow.isEmpty {
                VStack {
                    HStack {
                        EventMarqueeNotification(events: eventsToShow)
                            .padding(.top, 8)
                            .padding(.leading, 16)
                        Spacer()
                    }
                    Spacer()
                }
                .transition(.move(edge: .leading).combined(with: .opacity))
                .zIndex(150)
            }

            // 1.5 Quick Stats Popover (左下角)
            VStack {
                Spacer()
                HStack {
                    QuickStatsPopover()
                        .padding(.leading, 16)
                        .padding(.bottom, 120)
                    Spacer()
                }
            }
            .zIndex(97)

            // 2. 地图工具栏 (右侧垂直居中)
            HStack {
                Spacer()
                VStack(spacing: 12) {
                    MapToolbarView(
                        isRoaming: $isRoaming,
                        isCentering: $isCentering,
                        isMapDetached: $isMapDetached,
                        isLeaderboardShowing: $showLeaderboard,
                        isDebugMode: isDebugMode,
                        isRandomTesting: isRandomTesting,
                        testBadgePattern: patternProvider.currentDrawingPattern,
                        isDrawingMode: GPSDrawingService.shared.isGPSDrawingMode,
                        onLeaderboard: {
                            showLeaderboard = true
                        },
                        onRoam: {
                            Task {
                                if roamingHotspots.isEmpty {
                                    roamingHotspots = await HotspotService.shared.getAllHotspots(period: "monthly", limit: 20)
                                    roamingIndex = 0
                                }
                                guard !roamingHotspots.isEmpty else { return }
                                let hotspot = roamingHotspots[roamingIndex]
                                roamingIndex = (roamingIndex + 1) % roamingHotspots.count
                                isRoaming = true
                                await mapController.flyToCoordinate(hotspot.coordinate, name: hotspot.name)
                                try? await Task.sleep(nanoseconds: 1_000_000_000)
                                isRoaming = false
                            }
                        },
                        onLongPressRoam: {
                            showHotspotExplore = true
                        },
                        onCenter: {
                            isCentering = true
                            locationManager.centerToCurrentLocation()
                            isMapDetached = false
                            mapController.resumeGPSFollowing()
                            Task {
                                try? await Task.sleep(nanoseconds: 500_000_000)
                                isCentering = false
                            }
                        },
                        onTest: {
                            if !isRandomTesting {
                                Task {
                                    await drawingState.requestStartTestGPSDrawing(forcePicker: false)
                                }
                            }
                        },
                        onLongPressTest: {
                            if !isRandomTesting {
                                Task {
                                    await drawingState.requestStartTestGPSDrawing(forcePicker: true)
                                }
                            }
                        }
                    )
                }
                .padding(.trailing, 16)
            }

            // Roaming Destination HUD (Center Top)
            if let destination = roamingDestination {
                VStack {
                    Text(String(format: NSLocalizedString("map.roaming_to", comment: ""), destination))
                        .font(.headline)
                        .foregroundColor(.white)
                        .padding(.horizontal, 20)
                        .padding(.vertical, 10)
                        .background(Capsule().fill(Color.black.opacity(0.6)))
                        .padding(.top, 100)
                    Spacer()
                }
                .transition(.move(edge: .top).combined(with: .opacity))
                .zIndex(110)
            }

            // 3. 赛事活动排行 HUD (右上角)
            if let eventToShow = eventManager.currentWarEvent ??
                eventManager.activeEvents.first(where: { $0.id == eventManager.followedEventId }) {
                VStack {
                    HStack {
                        Spacer()
                        TerritoryWarHUD(event: eventToShow)
                            .padding(.top, 8)
                            .padding(.trailing, 16)
                    }
                    Spacer()
                }
                .transition(.move(edge: .top).combined(with: .opacity))
                .zIndex(100)
            }
        }
    }

    // MARK: - Map Interactive Elements

    private var mapInteractiveElements: some View {
        Group {
            // FAB (浮动操作按钮) - GPS绘制快速启动
            if !GPSDrawingService.shared.isGPSDrawingMode && authViewModel.isAuthenticated {
                VStack {
                    Spacer()
                    HStack {
                        Spacer()
                        Button(action: {
                            #if !targetEnvironment(simulator)
                            let generator = UIImpactFeedbackGenerator(style: .medium)
                            generator.impactOccurred()
                            #endif
                            Task {
                                await drawingState.requestStartGPSDrawing(forcePicker: false)
                            }
                        }) {
                            ZStack {
                                Circle()
                                    .fill(Color.blue.opacity(0.2))
                                    .frame(width: 70, height: 70)
                                    .blur(radius: 8)

                                Circle()
                                    .fill(
                                        LinearGradient(
                                            colors: [Color.blue, Color.blue.opacity(0.8)],
                                            startPoint: .topLeading,
                                            endPoint: .bottomTrailing
                                        )
                                    )
                                    .frame(width: 60, height: 60)
                                    .shadow(color: .blue.opacity(0.4), radius: 8, x: 0, y: 4)

                                Image(systemName: "figure.run")
                                    .font(.system(size: 24, weight: .semibold))
                                    .foregroundColor(.white)

                                if let pattern = patternProvider.currentDrawingPattern {
                                    SmallAllianceFlagBadge(
                                        pattern: pattern, size: 20, borderSize: 1.5,
                                        showSwitchIndicator: userHasMultipleFlagOptions
                                    )
                                        .offset(x: 18, y: 18)
                                }
                            }
                        }
                        .buttonStyle(ScaleButtonStyle())
                        .simultaneousGesture(
                            LongPressGesture(minimumDuration: 0.5)
                                .onEnded { _ in
                                    #if !targetEnvironment(simulator)
                                    let generator = UIImpactFeedbackGenerator(style: .heavy)
                                    generator.impactOccurred()
                                    #endif
                                    Task {
                                        await drawingState.requestStartGPSDrawing(forcePicker: true)
                                    }
                                }
                        )
                        .overlay(alignment: .top) {
                            if showFABTooltip {
                                FABTooltip(isVisible: $showFABTooltip)
                                    .offset(y: -60)
                            } else if showFlagSwitchTooltip {
                                FABFlagSwitchTooltip(isVisible: $showFlagSwitchTooltip)
                                    .offset(y: -60)
                            }
                        }
                        .padding(.trailing, 20)
                        .padding(.bottom, 100)
                    }
                }
            }

            // First pixel celebration
            if showFirstPixelCelebration {
                FirstPixelCelebration(isPresented: $showFirstPixelCelebration)
                    .zIndex(200)
            }

            // 🍾 漂流瓶遭遇横幅 (地图底部)
            if driftBottleManager.showEncounterBanner,
               let bottle = driftBottleManager.currentEncounter,
               !GPSDrawingService.shared.isGPSDrawingMode {
                VStack {
                    Spacer()
                    DriftBottleEncounterBanner(
                        bottle: bottle,
                        onOpen: { driftBottleManager.openEncounteredBottle() },
                        onDismiss: { driftBottleManager.dismissEncounter() }
                    )
                    .padding(.bottom, 70)
                }
                .zIndex(95)
                .transition(.move(edge: .bottom).combined(with: .opacity))
            }

            // 🍾 左侧漂流瓶浮动按钮（始终显示，只要配额已加载）
            if driftBottleManager.quota != nil,
               !GPSDrawingService.shared.isGPSDrawingMode {
                HStack {
                    DriftBottleFloatingButton()
                        .padding(.leading, 0)
                    Spacer()
                }
                .zIndex(96)
            }

            // GPS绘制控制面板
            if GPSDrawingService.shared.isGPSDrawingMode && authViewModel.isAuthenticated {
                VStack {
                    Spacer()
                    FogMapGPSDrawingControl()
                }
                .edgesIgnoringSafeArea(.bottom)
            }
        }
    }

    // MARK: - Bottle Markers Overlay

    /// 漂流瓶地图标记覆盖层
    @ViewBuilder
    private var bottleMarkersOverlay: some View {
        ForEach(driftBottleManager.mapMarkers) { marker in
            BottleMapMarkerView(marker: marker)
                .position(coordinateToScreen(marker.coordinate))
                .onTapGesture {
                    Task {
                        await driftBottleManager.handleMarkerTap(bottleId: marker.id)
                        SoundManager.shared.play(.buttonClick)

                        #if !targetEnvironment(simulator)
                        let generator = UIImpactFeedbackGenerator(style: .light)
                        generator.impactOccurred()
                        #endif
                    }
                }
        }
    }

    // MARK: - Helpers

    private var currentMapMode: MapModeIndicator.MapMode {
        if GPSDrawingService.shared.isGPSDrawingMode {
            return .drawing(pixelCount: GPSDrawingService.shared.drawnPixelsCount)
        } else if let warEvent = eventManager.currentWarEvent {
            return .war(eventTitle: warEvent.title)
        } else {
            return .peace
        }
    }

    /// 将地理坐标转换为屏幕坐标
    /// - Parameter coordinate: 地理坐标
    /// - Returns: 屏幕坐标
    private func coordinateToScreen(_ coordinate: CLLocationCoordinate2D) -> CGPoint {
        // 使用MapController的坐标转换方法
        return mapController.coordinateToScreen(coordinate)
    }

    /// 启动漂流瓶标记刷新
    private func startBottleMarkersRefresh() {
        guard let location = locationManager.currentLocation else {
            Logger.warning("Cannot start bottle markers refresh: location unavailable")
            return
        }

        driftBottleManager.startMapMarkersAutoRefresh(
            lat: location.coordinate.latitude,
            lng: location.coordinate.longitude,
            interval: 30  // 每30秒刷新一次
        )

        Logger.info("🗺️ Bottle markers refresh started")
    }

    /// 处理位置变化
    private func handleLocationChange(_ newLocation: CLLocation?) {
        guard let location = newLocation else { return }

        // 始终更新最新坐标，确保定时器使用最新位置
        driftBottleManager.updateRefreshCoordinates(
            lat: location.coordinate.latitude,
            lng: location.coordinate.longitude
        )

        // 如果自动刷新定时器未启动（onAppear时location为nil），启动它
        if driftBottleManager.markersRefreshTimer == nil {
            driftBottleManager.startMapMarkersAutoRefresh(
                lat: location.coordinate.latitude,
                lng: location.coordinate.longitude,
                interval: 30
            )
            return
        }

        // 位置变化超过100米时，立即触发一次额外刷新
        if shouldRefreshMarkers(for: location) {
            Task {
                await driftBottleManager.refreshMapMarkers(
                    lat: location.coordinate.latitude,
                    lng: location.coordinate.longitude
                )
            }
        }
    }

    /// 判断是否需要刷新标记
    /// - Parameter newLocation: 新位置
    /// - Returns: 是否需要刷新
    private func shouldRefreshMarkers(for newLocation: CLLocation) -> Bool {
        // 如果没有上次刷新位置，需要刷新
        guard let lastLocation = lastMarkersRefreshLocation else {
            lastMarkersRefreshLocation = newLocation
            return true
        }

        // 计算距离
        let distance = newLocation.distance(from: lastLocation)

        // 距离超过100米时刷新
        if distance > 100 {
            lastMarkersRefreshLocation = newLocation
            return true
        }

        return false
    }

    // MARK: - Random GPS Test

    private func runRandomGPSTest(center: CLLocationCoordinate2D? = nil, allianceId: Int? = nil) async {
        guard !isRandomTesting else { return }
        isRandomTesting = true

        let gpsService = GPSDrawingService.shared
        let testCenter = center ?? mapController.getCenterCoordinate() ?? CLLocationCoordinate2D(latitude: 24.4439, longitude: 118.0655)
        Logger.info("🎯 [MapTabContent] Using testCenter: \(testCenter.latitude), \(testCenter.longitude)")

        do {
            try await drawingState.startDrawing(mode: .gps, allianceId: allianceId)

            let baseCoord = testCenter
            gpsService.isRunningRandomTest = true
            Logger.info("🎯 [GPS Test] Starting GPS test with baseCoord: \(baseCoord.latitude), \(baseCoord.longitude)")

            for i in 1...10 {
                randomTestProgress = i

                let distanceMeters = Double.random(in: 5...15)
                let direction = Double.random(in: 0...(2 * .pi))

                let deltaLat = (distanceMeters / 111000.0) * cos(direction)
                let deltaLng = (distanceMeters / 111000.0) * sin(direction) / cos(baseCoord.latitude * .pi / 180)

                let currentCoord = CLLocationCoordinate2D(
                    latitude: baseCoord.latitude + deltaLat,
                    longitude: baseCoord.longitude + deltaLng
                )

                if i <= 3 {
                    Logger.info("🎯 [GPS Test] Point \(i): \(currentCoord.latitude), \(currentCoord.longitude) (offset: \(String(format: "%.1f", distanceMeters))m)")
                }

                let location = CLLocation(latitude: currentCoord.latitude, longitude: currentCoord.longitude)
                gpsService.simulateLocation(location)
                try? await Task.sleep(nanoseconds: 500_000_000)
            }

            gpsService.isRunningRandomTest = false

            if let snapshot = await gpsService.generateSessionSnapshot() {
                await MainActor.run {
                    drawingState.lastSessionImage = snapshot
                }
                Logger.info("✅ Test GPS snapshot captured")
            }

            await gpsService.stopGPSDrawing()

            isRandomTesting = false
            randomTestProgress = 0
        } catch {
            Logger.error("Failed to start random GPS test: \(error.localizedDescription)")
            gpsService.isRunningRandomTest = false
            await gpsService.stopGPSDrawing()
            isRandomTesting = false
        }
    }
}
