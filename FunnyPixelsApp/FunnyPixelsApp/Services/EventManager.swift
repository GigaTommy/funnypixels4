import Foundation
import Combine
import CoreLocation
import SwiftUI

/// 赛事活动管理器 (单例)
/// 负责轮询最新活动、维护当前活动状态、管理Socket房间
class EventManager: ObservableObject {
    static let shared = EventManager()
    
    @Published var activeEvents: [EventService.Event] = []
    @Published var currentWarEvent: EventService.Event? // The event user is currently IN (geofence)
    @Published var followedEventId: String? // The event user is remotely "watching"
    @Published var nearbyEvent: (event: EventService.Event, distance: Double)? // Nearby event within detection range

    /// 获取用户所在城市的活动（50公里内）
    /// 用于地图顶部跑马灯通知
    var localCityEvents: [EventService.Event] {
        guard let userLocation = LocationManager.shared.currentLocation else {
            return activeEvents
        }

        let cityRadius = 50_000.0 // 50公里内视为同城

        return activeEvents.filter { event in
            guard let center = event.config?.area?.center else { return false }
            let eventLocation = CLLocation(latitude: center.lat, longitude: center.lng)
            let userLoc = CLLocation(latitude: userLocation.coordinate.latitude,
                                    longitude: userLocation.coordinate.longitude)
            let distance = userLoc.distance(from: eventLocation)
            return distance <= cityRadius
        }
    }

    enum HUDState {
        case full      // Expanded (default when in zone)
        case compact   // Bubble (default when following remotely)
        case minimized // Hidden until user taps to restore
    }
    @Published var hudState: HUDState = .full
    
    // Real-time battle data
    @Published var allianceScores: [TerritoryWarHUD.AllianceScore] = []
    @Published var totalPixels: Int = 0
    @Published var lastUpdateTime: Date = Date()

    // Zone notifications
    @Published var zoneNotification: ZoneNotification?

    enum ZoneNotification: Equatable {
        case entered(eventTitle: String)
        case exited(eventTitle: String)
        case ending(eventTitle: String, minutesLeft: Int)
        case ended(eventTitle: String)
    }
    
    private var isFirstFetch = true

    private var activeSocketEventId: String?
    private var endingCheckTimer: Timer?
    
    private var cancellables = Set<AnyCancellable>()
    private var timer: Timer?
    private let pollInterval: TimeInterval = 60.0 // Poll every minute
    
    // Performance Cache
    struct BBox {
        let minLat: Double
        let maxLat: Double
        let minLng: Double
        let maxLng: Double
        
        func contains(_ location: CLLocationCoordinate2D) -> Bool {
            return location.latitude >= minLat && location.latitude <= maxLat &&
                   location.longitude >= minLng && location.longitude <= maxLng
        }
    }
    private var eventBBoxCache: [String: BBox] = [:]
    
    private init() {
        startPolling()
        setupSocketSubscription()
        setupLocationObservation()
        startEndingCheck()
    }

    private func startEndingCheck() {
        // Check every minute for events ending soon
        endingCheckTimer = Timer.scheduledTimer(withTimeInterval: 60.0, repeats: true) { [weak self] _ in
            self?.checkForEndingEvents()
        }
    }

    /// Check if current event is ending soon and notify user
    private func checkForEndingEvents() {
        guard let event = currentWarEvent else { return }

        let isoFormatter = ISO8601DateFormatter()
        isoFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]

        guard let endDate = isoFormatter.date(from: event.endTime) else { return }

        let minutesRemaining = Int(endDate.timeIntervalSinceNow / 60)

        // Notify at 30, 10, 5, 1 minute marks
        let notifyAt = [30, 10, 5, 1]

        if notifyAt.contains(minutesRemaining) {
            Task { @MainActor in
                self.zoneNotification = .ending(eventTitle: event.title, minutesLeft: minutesRemaining)
            }
        }

        // Event has ended
        if minutesRemaining <= 0 {
            Task { @MainActor in
                self.zoneNotification = .ended(eventTitle: event.title)

                // 🔧 FIX: Explicitly end Live Activity when event ends
                LiveActivityManager.shared.endActivity(showResult: true)

                // Refresh events to remove ended event
                self.fetchEvents()
            }
        }
    }
    
    private func setupLocationObservation() {
        LocationManager.shared.$currentLocation
            .compactMap { $0 }
            .receive(on: DispatchQueue.main)
            .sink { [weak self] location in
                self?.checkGeofence(location: location.coordinate)
                self?.checkNearbyEvents(location: location.coordinate)
            }
            .store(in: &cancellables)
    }
    
    private func setupSocketSubscription() {
        Task {
            await SocketIOManager.shared.battleUpdatePublisher
                .receive(on: DispatchQueue.main)
                .sink { [weak self] dict in
                    self?.handleBattleUpdate(dict)
                }
                .store(in: &cancellables)
            
            // 🆕 监听活动列表变更通知
            await SocketIOManager.shared.eventsUpdatedPublisher
                .receive(on: DispatchQueue.main)
                .sink { [weak self] _ in
                    Logger.info("🔄 EventManager: 收到活动更新通知，立即刷新列表")
                    self?.fetchEvents()
                }
                .store(in: &cancellables)
        }
    }
    
    private func handleBattleUpdate(_ dict: [String: Any]) {
        // Parse battle update from backend
        guard let alliancesData = dict["alliances"] as? [[String: Any]] else {
            Logger.warning("⚠️ No alliances data found in battle update")
            return
        }
        
        let newScores = alliancesData.compactMap { data -> TerritoryWarHUD.AllianceScore? in
            // Use String(describing:) to robustly handle both Int and String IDs
            guard let idRaw = data["id"],
                  let name = data["name"] as? String else { return nil }
            
            let id = String(describing: idRaw)
            
            // Handle score robustly (can be Int or Double in JSON)
            let score: Double
            if let s = data["score"] as? Double {
                score = s
            } else if let s = data["score"] as? Int {
                score = Double(s)
            } else {
                return nil
            }
            
            let colorHex = data["color"] as? String ?? "#888888"
            
            return TerritoryWarHUD.AllianceScore(
                id: id,
                name: name,
                score: score,
                colorHex: colorHex
            )
        }
        
        DispatchQueue.main.async {
            // Only update if it matches our current active or followed event
            let currentId = self.currentWarEvent?.id ?? self.followedEventId
            let updateId = dict["eventId"] as? String
            
            if let updateId = updateId, let currentId = currentId, updateId != currentId {
                Logger.debug("ℹ️ Ignoring battle update for event \(updateId) (Current: \(currentId))")
                return
            }
            
            self.allianceScores = newScores
            self.totalPixels = dict["totalPixels"] as? Int ?? 0
            self.lastUpdateTime = Date()
            Logger.info("⚔️ Received Battle Update for \(updateId ?? "unknown"): \(newScores.count) alliances, total: \(self.totalPixels)")
        }
    }
    
    func startPolling() {
        fetchEvents()
        timer = Timer.scheduledTimer(withTimeInterval: pollInterval, repeats: true) { [weak self] _ in
            self?.fetchEvents()
        }
    }
    
    func stopPolling() {
        timer?.invalidate()
        timer = nil
    }
    
    func fetchEvents() {
        Task {
            do {
                let events = try await EventService.shared.getActiveEvents()
                await MainActor.run {
                    if self.isFirstFetch || events.count != self.activeEvents.count {
                        Logger.info("🛰️ EventManager: 已获取 \(events.count) 个活跃赛事")
                        self.isFirstFetch = false
                    }
                    self.activeEvents = events
                    self.updateBBoxCache(with: events)
                }
            } catch {
                Logger.error("Failed to fetch active events: \(error)")
            }
        }
    }
    
    private func updateBBoxCache(with events: [EventService.Event]) {
        var newCache: [String: BBox] = [:]
        for event in events {
            guard let ring = event.boundary?.coordinates.first else { continue }
            var minLat = 90.0, maxLat = -90.0
            var minLng = 180.0, maxLng = -180.0
            
            for coord in ring {
                let lng = coord[0]
                let lat = coord[1]
                minLat = min(minLat, lat)
                maxLat = max(maxLat, lat)
                minLng = min(minLng, lng)
                maxLng = max(maxLng, lng)
            }
            newCache[event.id] = BBox(minLat: minLat, maxLat: maxLat, minLng: minLng, maxLng: maxLng)
        }
        self.eventBBoxCache = newCache
    }
    
    /// Check if user location is inside any event boundary
    /// This is a simplified Point-in-Polygon check for client-side quick feedback
    private var geofenceExitWorkItem: DispatchWorkItem?
    
    /// Check if user location is inside any event boundary
    /// This is a simplified Point-in-Polygon check for client-side quick feedback
    /// Only checks events where user is a registered participant
    func checkGeofence(location: CLLocationCoordinate2D) {
        var isInsideAnyEvent = false

        // Only check events user is participating in
        let participatingEvents = activeEvents.filter { $0.isParticipant }

        for event in participatingEvents {
            // Layer 2: BBox Check (Medium Filter)
            if let bbox = eventBBoxCache[event.id], !bbox.contains(location) {
                // Logger.debug("❌ BBox Check Failed: \(location) not in \(bbox)")
                continue
            }

            // Layer 3: PIP Check (Fine Filter)
            if let boundary = event.boundary {
                let inside = isPoint(location, inside: boundary)
                if inside {
                    isInsideAnyEvent = true

                    // Cancel any pending exit
                    geofenceExitWorkItem?.cancel()
                    geofenceExitWorkItem = nil

                    // User entered event zone (or is still inside)
                    if currentWarEvent?.id != event.id {
                        Logger.info("⚔️ EventManager: 📍 [\(location.latitude), \(location.longitude)] 进入赛事区域 [\(event.title)] (\(event.id))")
                        enterWarZone(event)
                    }
                    return
                } else {
                     // Debug log for troubleshooting (can be removed later or made debug-only)
                     // Logger.debug("🔍 EventManager: 📍 [\(location.latitude), \(location.longitude)] 不在赛事 [\(event.title)] 范围内")
                }
            }
        }

        // User is not in any zone
        if currentWarEvent != nil && !isInsideAnyEvent {
            // Debounce exit to prevent flickering
            if geofenceExitWorkItem == nil {
                let workItem = DispatchWorkItem { [weak self] in
                    self?.performExitWarZone()
                    self?.geofenceExitWorkItem = nil
                }
                geofenceExitWorkItem = workItem
                // Wait 3 seconds before exiting
                DispatchQueue.main.asyncAfter(deadline: .now() + 3.0, execute: workItem)
            }
        }
    }

    /// Check for nearby events (within 2km range) - for all active events, not just participating ones
    func checkNearbyEvents(location: CLLocationCoordinate2D) {
        let DETECTION_RANGE = 2000.0 // 2km detection range

        var closestEvent: (event: EventService.Event, distance: Double)?

        for event in activeEvents {
            // Skip if event is not published or active
            guard event.status == "published" || event.status == "active" else {
                continue
            }

            // Get event center coordinate
            guard let config = event.config,
                  let area = config.area,
                  let center = area.center else {
                continue
            }

            let eventLocation = CLLocation(latitude: center.lat, longitude: center.lng)
            let userLocation = CLLocation(latitude: location.latitude, longitude: location.longitude)
            let distance = userLocation.distance(from: eventLocation)

            // Check if within detection range
            if distance <= DETECTION_RANGE {
                // Keep track of the closest event
                if closestEvent == nil || distance < closestEvent!.distance {
                    closestEvent = (event: event, distance: distance)
                }
            }
        }

        // Update published nearby event
        DispatchQueue.main.async {
            self.nearbyEvent = closestEvent
        }
    }

    /// Toggle follow state for an event
    func toggleFollow(eventId: String) {
        if followedEventId == eventId {
            followedEventId = nil
            Logger.info("🛑 Unfollowed Event: \(eventId)")
        } else {
            followedEventId = eventId
            Logger.info("⭐️ Followed Event: \(eventId)")
            // If we are not currently in a war zone, immediately switch HUD to this event
            if currentWarEvent == nil {
                self.hudState = .compact
            }
        }
        updateSocketSubscription()
    }

    private func enterWarZone(_ event: EventService.Event) {
        Task { @MainActor in
            self.currentWarEvent = event
            self.hudState = .full // Auto-expand when entering
            updateSocketSubscription()

            // Show zone entry notification
            self.zoneNotification = .entered(eventTitle: event.title)

            Logger.info("Entered War Zone: \(event.title)")
        }
    }
    
    private func performExitWarZone() {
        if let exitingEvent = currentWarEvent {
            Logger.info("🏳️ EventManager: 离开赛事区域 [\(exitingEvent.title)]")
            exitWarZone()
        }
    }
    
    private func exitWarZone() {
        Task { @MainActor in
            let exitingEventTitle = currentWarEvent?.title ?? ""
            Logger.info("Exited War Zone: \(exitingEventTitle)")

            // 🔧 FIX: Check if event has ended before exiting
            if let event = currentWarEvent {
                let isoFormatter = ISO8601DateFormatter()
                isoFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
                if let endDate = isoFormatter.date(from: event.endTime), endDate < Date() {
                    // Event has ended, immediately end Live Activity
                    Logger.info("⏱️ 活动已结束，立即关闭 Live Activity")
                    LiveActivityManager.shared.endActivity(showResult: true)
                }
            }

            // Show zone exit notification
            if !exitingEventTitle.isEmpty {
                self.zoneNotification = .exited(eventTitle: exitingEventTitle)
            }

            self.currentWarEvent = nil

            // If follow is active, drop back to compact, else reset scores
            if followedEventId != nil {
                self.hudState = .compact
            } else {
                self.allianceScores = []
            }

            updateSocketSubscription()
        }
    }
    
    private func updateSocketSubscription() {
        // Priority: Current Zone > Followed Event
        let targetEventId = currentWarEvent?.id ?? followedEventId
        
        guard targetEventId != activeSocketEventId else { return }
        
        Task {
            // Leave old room
            if let oldId = activeSocketEventId {
                await SocketIOManager.shared.leaveEventRoom(oldId)
            }
            
            // Join new room
            if let newId = targetEventId {
                // First, fetch initial rankings to avoid "empty" HUD before first socket update
                do {
                    let initialData = try await EventService.shared.getEventRankings(eventId: newId)
                    await MainActor.run {
                        self.allianceScores = initialData.alliances
                        self.totalPixels = initialData.totalPixels
                    }
                } catch {
                    Logger.warning("⚠️ Failed to fetch initial event rankings: \(error.localizedDescription)")
                }
                
                await SocketIOManager.shared.joinEventRoom(newId)
                self.activeSocketEventId = newId
            } else {
                self.activeSocketEventId = nil
            }
        }
    }
    
    // Simple Ray-Casting algorithm for point in polygon
    private func isPoint(_ point: CLLocationCoordinate2D, inside boundary: EventService.GeoJSONBoundary) -> Bool {
        guard let ring = boundary.coordinates.first else { return false }
        // ring is [[lng, lat]]
        
        var isInside = false
        var j = ring.count - 1
        
        for i in 0..<ring.count {
            let pi = ring[i]
            let pj = ring[j]
            
            // pi[1] is lat, pi[0] is lng
            let lat_i = pi[1]
            let lng_i = pi[0]
            let lat_j = pj[1]
            let lng_j = pj[0]
            
            if ((lat_i > point.latitude) != (lat_j > point.latitude)) &&
                (point.longitude < (lng_j - lng_i) * (point.latitude - lat_i) / (lat_j - lat_i) + lng_i) {
                isInside = !isInside
            }
            j = i
        }
        
        return isInside
    }

    // MARK: - P0-3: Contribution Tracking

    @Published var userContribution: EventContribution?
    @Published var contributionLoadingState: LoadingState = .idle

    enum LoadingState {
        case idle
        case loading
        case loaded
        case error(String)
    }

    // MARK: - P1-5: Rank Change Tracking

    /// Cache of previous ranks by event ID
    private var previousRankCache: [String: Int] = [:]

    /// Last rank change notification time (for debouncing)
    private var lastRankNotificationTime: Date?

    /// User setting to enable/disable rank change notifications
    @AppStorage("enableRankChangeNotification") private var enableRankNotifications = true

    /// 获取用户在活动中的贡献统计
    func fetchContribution(eventId: String) {
        contributionLoadingState = .loading

        Task {
            do {
                let contribution = try await EventService.shared.getMyContribution(eventId: eventId)

                await MainActor.run {
                    // P1-5: Check for rank change
                    self.checkRankChange(eventId: eventId, newRank: contribution.rankInAlliance)

                    self.userContribution = contribution
                    self.contributionLoadingState = .loaded
                    Logger.info("✅ Fetched contribution for event \(eventId): \(contribution.pixelCount) pixels, rank: \(contribution.rankInAlliance ?? -1)")
                }
            } catch {
                await MainActor.run {
                    self.contributionLoadingState = .error(error.localizedDescription)
                    Logger.error("❌ Failed to fetch contribution: \(error.localizedDescription)")
                }
            }
        }
    }

    /// P1-5: Check for rank changes and trigger notification
    private func checkRankChange(eventId: String, newRank: Int?) {
        guard enableRankNotifications, let newRank = newRank else { return }

        // Check if we have a previous rank for this event
        guard let oldRank = previousRankCache[eventId] else {
            // First time fetching rank for this event, just cache it
            previousRankCache[eventId] = newRank
            return
        }

        // Calculate rank change (positive = rank up, negative = rank down)
        let rankChange = oldRank - newRank

        // Only notify if:
        // 1. Rank actually changed by at least 2 positions
        // 2. At least 1 minute has passed since last notification (debounce)
        guard abs(rankChange) >= 2 else {
            // Small change, just update cache
            previousRankCache[eventId] = newRank
            return
        }

        // Check debounce
        if let lastTime = lastRankNotificationTime {
            let timeSinceLastNotification = Date().timeIntervalSince(lastTime)
            guard timeSinceLastNotification >= 60 else {
                // Too soon, skip notification but update cache
                previousRankCache[eventId] = newRank
                Logger.debug("⏭️ Rank change detected but debounced (last notification \(Int(timeSinceLastNotification))s ago)")
                return
            }
        }

        // Trigger notification
        showRankChangeToast(oldRank: oldRank, newRank: newRank)

        // Play sound and haptic
        if rankChange > 0 {
            // Rank up
            SoundManager.shared.play(.rankUp)
            #if !targetEnvironment(simulator)
            let generator = UINotificationFeedbackGenerator()
            generator.notificationOccurred(.success)
            #endif
            Logger.info("📈 Rank UP: #\(oldRank) → #\(newRank) (+\(rankChange))")
        } else {
            // Rank down
            SoundManager.shared.play(.rankDown)
            #if !targetEnvironment(simulator)
            let generator = UINotificationFeedbackGenerator()
            generator.notificationOccurred(.warning)
            #endif
            Logger.info("📉 Rank DOWN: #\(oldRank) → #\(newRank) (\(rankChange))")
        }

        // Update cache and timestamp
        previousRankCache[eventId] = newRank
        lastRankNotificationTime = Date()
    }

    /// 当用户在活动区域绘制像素时调用（实时反馈）
    func onPixelDrawnInEvent(eventId: String) {
        guard let currentContribution = userContribution else {
            // 首次绘制，直接获取
            fetchContribution(eventId: eventId)
            return
        }

        // 本地乐观更新
        let newPixelCount = currentContribution.pixelCount + 1
        let newMilestones = checkMilestone(pixelCount: newPixelCount, previous: currentContribution.milestones)

        // 创建更新后的贡献数据
        let updatedAlliance: ContributionAlliance?
        if let alliance = currentContribution.alliance {
            // Create new alliance instance with updated totalPixels
            updatedAlliance = ContributionAlliance(
                id: alliance.id,
                name: alliance.name,
                totalPixels: alliance.totalPixels + 1
            )
        } else {
            updatedAlliance = nil
        }

        let updatedContribution = EventContribution(
            pixelCount: newPixelCount,
            alliance: updatedAlliance,
            contributionRate: currentContribution.contributionRate,
            rankInAlliance: currentContribution.rankInAlliance,
            topContributors: currentContribution.topContributors,
            milestones: newMilestones
        )

        DispatchQueue.main.async {
            self.userContribution = updatedContribution

            // P1-3: Haptic feedback for every pixel draw
            #if !targetEnvironment(simulator)
            let generator = UIImpactFeedbackGenerator(style: .light)
            generator.impactOccurred()
            #endif

            // P1-3: Sound effect for pixel draw
            SoundManager.shared.play(.pixelDraw)

            // P1-3: 检查里程碑达成
            if newMilestones.achieved.count > currentContribution.milestones.achieved.count {
                let newMilestone = newMilestones.achieved.last ?? 0

                // Trigger milestone toast notification
                showMilestoneToast(milestone: newMilestone)

                // Play appropriate sound based on milestone tier
                if newMilestone >= 1000 {
                    // Major milestone (1000+): special sound
                    SoundManager.shared.play(.levelUp)
                    #if !targetEnvironment(simulator)
                    let notificationGenerator = UINotificationFeedbackGenerator()
                    notificationGenerator.notificationOccurred(.success)
                    #endif
                } else {
                    // Normal milestone (10/50/100/500): success sound
                    SoundManager.shared.play(.success)
                    #if !targetEnvironment(simulator)
                    let notificationGenerator = UINotificationFeedbackGenerator()
                    notificationGenerator.notificationOccurred(.success)
                    #endif
                }
            }
        }

        // 每10个像素或达成里程碑时，从服务器刷新真实数据
        if newPixelCount % 10 == 0 || newMilestones.achieved.count > currentContribution.milestones.achieved.count {
            fetchContribution(eventId: eventId)
        }
    }

    /// 检查里程碑进度
    private func checkMilestone(pixelCount: Int, previous: MilestoneProgress) -> MilestoneProgress {
        let milestones = [10, 50, 100, 500, 1000, 5000]
        let achieved = milestones.filter { pixelCount >= $0 }
        let next = milestones.first { pixelCount < $0 } ?? 10000
        let progress = Double(pixelCount) / Double(next)

        return MilestoneProgress(
            current: pixelCount,
            next: next,
            achieved: achieved,
            progress: min(progress, 1.0)
        )
    }
}
