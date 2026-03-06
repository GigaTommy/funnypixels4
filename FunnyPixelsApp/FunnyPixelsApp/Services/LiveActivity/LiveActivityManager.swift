import Foundation
import SwiftUI
import ActivityKit
import UserNotifications
import Combine

/// Live Activity 管理器
/// 负责管理赛事灵动岛显示，并为不支持的设备提供降级方案
@MainActor
class LiveActivityManager: ObservableObject {
    static let shared = LiveActivityManager()

    // MARK: - Published Properties

    /// 当前是否有活跃的 Live Activity
    @Published private(set) var isActivityActive = false

    /// 当前活动的 Activity ID
    @Published private(set) var currentActivityId: String?

    /// 降级模式：当设备不支持 Dynamic Island 时使用应用内 Banner
    @Published var showFallbackBanner = false
    @Published var fallbackBannerData: FallbackBannerData?

    // MARK: - GPS Drawing Activity Properties

    /// GPS Drawing Live Activity 是否活跃
    @Published private(set) var isGPSDrawingActivityActive = false

    /// GPS Drawing Activity ID
    private var gpsDrawingActivityId: String?

    /// GPS Drawing 开始时间
    private var gpsDrawingStartTime: Date?

    /// GPS Drawing 计时器
    private var gpsDrawingTimer: Timer?

    // MARK: - Private Properties

    @available(iOS 16.1, *)
    private var currentActivity: Activity<EventActivityAttributes>? {
        Activity<EventActivityAttributes>.activities.first { $0.id == currentActivityId }
    }

    @available(iOS 16.1, *)
    private var currentGPSDrawingActivity: Activity<GPSDrawingActivityAttributes>? {
        Activity<GPSDrawingActivityAttributes>.activities.first { $0.id == gpsDrawingActivityId }
    }

    private var updateTimer: Timer?
    private var cancellables = Set<AnyCancellable>()

    // MARK: - Device Capability

    /// 检查设备是否支持 Live Activity
    var supportsLiveActivity: Bool {
        if #available(iOS 16.1, *) {
            return ActivityAuthorizationInfo().areActivitiesEnabled
        }
        return false
    }

    /// 检查是否是支持灵动岛的设备 (iPhone 14 Pro 及以上)
    var supportsDynamicIsland: Bool {
        guard supportsLiveActivity else { return false }

        // 检查设备型号
        var systemInfo = utsname()
        uname(&systemInfo)
        let machineMirror = Mirror(reflecting: systemInfo.machine)
        let identifier = machineMirror.children.reduce("") { identifier, element in
            guard let value = element.value as? Int8, value != 0 else { return identifier }
            return identifier + String(UnicodeScalar(UInt8(value)))
        }

        // iPhone 14 Pro 及以上支持灵动岛
        // iPhone15,2 = iPhone 14 Pro
        // iPhone15,3 = iPhone 14 Pro Max
        // iPhone16,1 = iPhone 15 Pro
        // iPhone16,2 = iPhone 15 Pro Max
        // iPhone17,x = iPhone 16 系列
        let dynamicIslandModels = [
            "iPhone15,2", "iPhone15,3",  // 14 Pro/Pro Max
            "iPhone16,1", "iPhone16,2",  // 15 Pro/Pro Max
            "iPhone17,1", "iPhone17,2", "iPhone17,3", "iPhone17,4"  // 16 系列
        ]

        // 模拟器也支持（用于开发测试）
        if identifier.contains("arm64") || identifier.contains("x86_64") {
            return true
        }

        return dynamicIslandModels.contains(identifier)
    }

    // MARK: - Initialization

    private init() {
        setupObservers()
        cleanupStaleActivities()
    }

    private func setupObservers() {
        // 监听 EventManager 的变化
        EventManager.shared.$currentWarEvent
            .receive(on: DispatchQueue.main)
            .sink { [weak self] event in
                guard let self = self else { return }
                if let event = event {
                    // 进入赛事区域，启动 Live Activity
                    self.startActivityIfNeeded(for: event)
                } else if self.isActivityActive {
                    // 🔧 FIX: 离开赛事区域时，延迟5分钟后自动结束 Live Activity
                    // 给用户一些时间重新进入区域，但不会无限期保持
                    DispatchQueue.main.asyncAfter(deadline: .now() + 300) { [weak self] in
                        guard let self = self else { return }
                        // 只在用户确实没有重新进入时才结束
                        if EventManager.shared.currentWarEvent == nil && self.isActivityActive {
                            Logger.info("⏱️ 用户离开赛事区域超过5分钟，自动结束 Live Activity")
                            self.endActivity(showResult: false)
                        }
                    }
                }
            }
            .store(in: &cancellables)

        // 监听赛事分数更新
        EventManager.shared.$allianceScores
            .receive(on: DispatchQueue.main)
            .sink { [weak self] scores in
                guard let self = self, !scores.isEmpty else { return }
                self.updateActivityWithScores(scores)
            }
            .store(in: &cancellables)
    }

    // MARK: - GPS Drawing Activity Methods

    /// 启动 GPS Drawing Live Activity
    func startGPSDrawingActivity(allianceName: String, allianceColorHex: String, initialPoints: Int) {
        guard !isGPSDrawingActivityActive else {
            Logger.info("🎨 GPS Drawing Activity already active, skipping start")
            return
        }

        gpsDrawingStartTime = Date()

        if #available(iOS 16.1, *), supportsLiveActivity {
            // 清理上一次残留的 GPS Drawing Activity（结束后仍在 60 秒展示期内的）
            let staleActivities = Activity<GPSDrawingActivityAttributes>.activities
            if !staleActivities.isEmpty {
                Logger.info("🧹 清理 \(staleActivities.count) 个残留 GPS Drawing Activities")
                Task {
                    for activity in staleActivities {
                        await activity.end(nil, dismissalPolicy: .immediate)
                    }
                }
            }

            let attributes = GPSDrawingActivityAttributes(
                allianceName: allianceName,
                allianceColorHex: allianceColorHex
            )

            let initialState = GPSDrawingActivityAttributes.ContentState(
                pixelsDrawn: 0,
                remainingPoints: initialPoints,
                elapsedSeconds: 0,
                isFrozen: false,
                freezeSecondsLeft: 0,
                isActive: true
            )

            do {
                let activity = try Activity.request(
                    attributes: attributes,
                    content: .init(state: initialState, staleDate: nil),
                    pushType: nil
                )

                gpsDrawingActivityId = activity.id
                isGPSDrawingActivityActive = true

                // 启动计时器更新用时
                startGPSDrawingTimer()

                Logger.info("🎨 GPS Drawing Live Activity started: \(activity.id)")
            } catch let error as NSError {
                // 🔧 FIX: GPS Drawing Activity 错误处理
                let errorCode = error.code

                switch errorCode {
                case -1:
                    Logger.warning("⚠️ GPS Drawing Activity 权限被拒绝")
                case -2:
                    Logger.warning("⚠️ 设备不支持 Live Activity")
                case -3:
                    Logger.warning("⚠️ 已达到 Activity 数量上限")
                default:
                    Logger.error("❌ GPS Drawing Activity 启动失败: \(error.localizedDescription)")
                }

                // GPS Drawing Activity 失败时，不影响功能继续运行
                // 只是用户看不到灵动岛/锁屏显示
            } catch {
                Logger.error("❌ Failed to start GPS Drawing Live Activity (unknown): \(error)")
            }
        } else {
            // 不支持 Live Activity 的设备，静默跳过
            Logger.info("📱 Device does not support Live Activity, GPS Drawing activity skipped")
        }
    }

    /// 更新 GPS Drawing Live Activity 状态（每次绘制成功后调用）
    func updateGPSDrawingActivity(pixelsDrawn: Int, remainingPoints: Int, isFrozen: Bool, freezeSecondsLeft: Int, currentSpeed: Double = 0.0) {
        guard isGPSDrawingActivityActive else { return }

        if #available(iOS 16.1, *), let activity = currentGPSDrawingActivity {
            let elapsed = Int(Date().timeIntervalSince(gpsDrawingStartTime ?? Date()))

            let state = GPSDrawingActivityAttributes.ContentState(
                pixelsDrawn: pixelsDrawn,
                remainingPoints: remainingPoints,
                elapsedSeconds: elapsed,
                isFrozen: isFrozen,
                freezeSecondsLeft: freezeSecondsLeft,
                isActive: true,
                currentSpeed: currentSpeed
            )

            Task {
                // 🔧 FIX: 设置 staleDate（Apple 最佳实践）
                // GPS 数据更新间隔约5秒，设置6秒有效期
                let staleDate = Date().addingTimeInterval(6)
                let content = ActivityContent(state: state, staleDate: staleDate)
                await activity.update(content)
            }
        }
    }

    /// 结束 GPS Drawing Live Activity
    func endGPSDrawingActivity(finalPixelsDrawn: Int) {
        guard isGPSDrawingActivityActive else { return }

        stopGPSDrawingTimer()

        if #available(iOS 16.1, *), let activity = currentGPSDrawingActivity {
            let elapsed = Int(Date().timeIntervalSince(gpsDrawingStartTime ?? Date()))

            let finalState = GPSDrawingActivityAttributes.ContentState(
                pixelsDrawn: finalPixelsDrawn,
                remainingPoints: 0,
                elapsedSeconds: elapsed,
                isFrozen: false,
                freezeSecondsLeft: 0,
                isActive: false
            )

            Task {
                let content = ActivityContent(state: finalState, staleDate: nil)
                // 显示最终结果 60 秒后消失
                await activity.end(content, dismissalPolicy: .after(.now + 60))

                await MainActor.run {
                    self.isGPSDrawingActivityActive = false
                    self.gpsDrawingActivityId = nil
                    self.gpsDrawingStartTime = nil
                }

                Logger.info("🎨 GPS Drawing Live Activity ended (\(finalPixelsDrawn) pixels)")
            }
        } else {
            isGPSDrawingActivityActive = false
            gpsDrawingActivityId = nil
            gpsDrawingStartTime = nil
        }
    }

    // MARK: - GPS Drawing Timer

    private func startGPSDrawingTimer() {
        stopGPSDrawingTimer()

        // 每 5 秒更新一次用时（后台模式下减少更新频率以省电）
        gpsDrawingTimer = Timer.scheduledTimer(withTimeInterval: 5.0, repeats: true) { [weak self] _ in
            guard let self else { return }
            Task { @MainActor [weak self] in
                self?.updateGPSDrawingElapsedTime()
            }
        }
    }

    private func stopGPSDrawingTimer() {
        gpsDrawingTimer?.invalidate()
        gpsDrawingTimer = nil
    }

    private func updateGPSDrawingElapsedTime() {
        guard isGPSDrawingActivityActive else { return }

        if #available(iOS 16.1, *), let activity = currentGPSDrawingActivity {
            var state = activity.content.state
            state.elapsedSeconds = Int(Date().timeIntervalSince(gpsDrawingStartTime ?? Date()))

            // 更新速度（从GPSDrawingService获取最新速度）
            state.currentSpeed = GPSDrawingService.shared.currentSpeedKmH

            // 更新冻结倒计时
            if state.isFrozen && state.freezeSecondsLeft > 0 {
                state.freezeSecondsLeft = max(0, state.freezeSecondsLeft - 5)
                if state.freezeSecondsLeft == 0 {
                    state.isFrozen = false
                }
            }

            Task {
                // 🔧 FIX: GPS Drawing 计时器数据，6秒有效期（5秒更新频率）
                let staleDate = Date().addingTimeInterval(6)
                let content = ActivityContent(state: state, staleDate: staleDate)
                await activity.update(content)
            }
        }
    }

    // MARK: - Event Activity Public Methods

    /// 为赛事启动 Live Activity
    func startActivity(
        eventId: String,
        eventTitle: String,
        userAllianceName: String,
        userAllianceColor: String,
        initialState: EventActivityAttributes.ContentState
    ) {
        // 如果已有活动，先结束
        if isActivityActive {
            endActivity()
        }

        if #available(iOS 16.1, *), supportsLiveActivity {
            startLiveActivity(
                eventId: eventId,
                eventTitle: eventTitle,
                userAllianceName: userAllianceName,
                userAllianceColor: userAllianceColor,
                initialState: initialState
            )
        } else {
            // 降级方案：使用应用内 Banner
            startFallbackBanner(
                eventId: eventId,
                eventTitle: eventTitle,
                userAllianceName: userAllianceName,
                userAllianceColor: userAllianceColor,
                initialState: initialState
            )
        }
    }

    /// 更新 Live Activity 状态
    func updateActivity(with state: EventActivityAttributes.ContentState) {
        if #available(iOS 16.1, *), supportsLiveActivity {
            updateLiveActivity(with: state)
        } else {
            updateFallbackBanner(with: state)
        }
    }

    /// 结束 Live Activity
    func endActivity(showResult: Bool = false) {
        if #available(iOS 16.1, *), supportsLiveActivity {
            endLiveActivity(showResult: showResult)
        } else {
            endFallbackBanner()
        }
    }

    // MARK: - Live Activity Implementation (iOS 16.1+)

    @available(iOS 16.1, *)
    private func startLiveActivity(
        eventId: String,
        eventTitle: String,
        userAllianceName: String,
        userAllianceColor: String,
        initialState: EventActivityAttributes.ContentState
    ) {
        let attributes = EventActivityAttributes(
            eventId: eventId,
            eventTitle: eventTitle,
            userAllianceName: userAllianceName,
            userAllianceColor: userAllianceColor
        )

        do {
            let activity = try Activity.request(
                attributes: attributes,
                content: .init(state: initialState, staleDate: nil),
                pushType: nil  // 使用本地更新而非推送
            )

            currentActivityId = activity.id
            isActivityActive = true

            Logger.info("🏝️ Live Activity started: \(activity.id)")

            // 启动更新定时器
            startUpdateTimer()

        } catch let error as NSError {
            // 🔧 FIX: 区分错误类型，提供针对性处理
            let errorCode = error.code
            let errorDomain = error.domain

            switch errorCode {
            case -1: // Activity权限被拒绝
                Logger.warning("⚠️ Live Activity 权限被拒绝，使用降级方案")
                // 不显示错误提示，静默降级

            case -2: // 设备不支持 Live Activity
                Logger.warning("⚠️ 设备不支持 Live Activity，使用降级方案")

            case -3: // 已达到 Activity 数量上限
                Logger.warning("⚠️ 已达到 Activity 数量上限，使用降级方案")

            default:
                Logger.error("❌ Live Activity 启动失败: code=\(errorCode), domain=\(errorDomain), message=\(error.localizedDescription)")
            }

            // 所有错误都降级到 Banner
            startFallbackBanner(
                eventId: eventId,
                eventTitle: eventTitle,
                userAllianceName: userAllianceName,
                userAllianceColor: userAllianceColor,
                initialState: initialState
            )
        } catch {
            // 其他未知错误
            Logger.error("❌ Failed to start Live Activity (unknown): \(error)")
            startFallbackBanner(
                eventId: eventId,
                eventTitle: eventTitle,
                userAllianceName: userAllianceName,
                userAllianceColor: userAllianceColor,
                initialState: initialState
            )
        }
    }

    @available(iOS 16.1, *)
    private func updateLiveActivity(with state: EventActivityAttributes.ContentState) {
        guard let activity = currentActivity else { return }

        Task {
            // 🔧 FIX: 设置 staleDate（Apple 最佳实践）
            // 倒计时类型的数据，5秒内有效
            let staleDate = Date().addingTimeInterval(5)
            let content = ActivityContent(state: state, staleDate: staleDate)
            await activity.update(content)
        }

        // 同时更新降级 Banner（如果显示中）
        updateFallbackBanner(with: state)
    }

    @available(iOS 16.1, *)
    private func endLiveActivity(showResult: Bool) {
        guard let activity = currentActivity else {
            isActivityActive = false
            currentActivityId = nil
            return
        }

        Task {
            // 创建结束状态
            var finalState = activity.content.state
            finalState.isEnded = true
            finalState.secondsRemaining = 0

            let content = ActivityContent(state: finalState, staleDate: nil)

            if showResult {
                // 显示结果一段时间后消失
                await activity.end(content, dismissalPolicy: .after(.now + 300)) // 5分钟后消失
            } else {
                await activity.end(content, dismissalPolicy: .immediate)
            }

            await MainActor.run {
                self.isActivityActive = false
                self.currentActivityId = nil
                self.stopUpdateTimer()
            }

            Logger.info("🏝️ Live Activity ended")
        }
    }

    // MARK: - Fallback Banner Implementation

    private func startFallbackBanner(
        eventId: String,
        eventTitle: String,
        userAllianceName: String,
        userAllianceColor: String,
        initialState: EventActivityAttributes.ContentState
    ) {
        fallbackBannerData = FallbackBannerData(
            eventId: eventId,
            eventTitle: eventTitle,
            userAllianceName: userAllianceName,
            userAllianceColor: userAllianceColor,
            state: initialState
        )
        showFallbackBanner = true
        isActivityActive = true

        Logger.info("📱 Fallback banner started (no Dynamic Island support)")

        // 同时发送本地通知
        sendFallbackNotification(title: "🎯 赛事进行中", body: "\(eventTitle) - 你的排名：#\(initialState.userRank)")

        startUpdateTimer()
    }

    private func updateFallbackBanner(with state: EventActivityAttributes.ContentState) {
        guard var data = fallbackBannerData else { return }
        data.state = state
        fallbackBannerData = data
    }

    private func endFallbackBanner() {
        showFallbackBanner = false
        fallbackBannerData = nil
        isActivityActive = false
        stopUpdateTimer()

        Logger.info("📱 Fallback banner ended")
    }

    private func sendFallbackNotification(title: String, body: String) {
        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body
        content.sound = .default

        let request = UNNotificationRequest(
            identifier: UUID().uuidString,
            content: content,
            trigger: nil
        )

        UNUserNotificationCenter.current().add(request)
    }

    // MARK: - Cleanup

    /// 清理所有过期或无效的 Live Activity（应用启动时调用）
    private func cleanupStaleActivities() {
        if #available(iOS 16.1, *) {
            Task {
                Logger.info("🧹 开始清理过期 Live Activities...")

                // 🔧 FIX: 增强清理逻辑，处理应用被杀死后的孤立Activity

                // 清理 Event Live Activities
                let eventActivities = Activity<EventActivityAttributes>.activities
                Logger.info("🧹 发现 \(eventActivities.count) 个 Event Activities")

                for activity in eventActivities {
                    let state = activity.content.state
                    var shouldCleanup = false
                    var reason = ""

                    // 1. 检查是否已结束
                    if state.isEnded {
                        shouldCleanup = true
                        reason = "已标记为结束"
                    }

                    // 2. 检查倒计时是否已过期
                    else if state.secondsRemaining <= 0 {
                        shouldCleanup = true
                        reason = "倒计时已过期"
                    }

                    // 3. 🆕 检查活动是否过期超过5分钟（应用被杀死后的孤立Activity）
                    else if state.secondsRemaining < -300 {
                        shouldCleanup = true
                        reason = "活动已过期超过5分钟"
                    }

                    // 4. 🆕 检查当前是否有对应的活跃赛事
                    else if EventManager.shared.currentWarEvent == nil {
                        // 如果用户不在任何赛事区域，但有 Activity，可能是孤立的
                        shouldCleanup = true
                        reason = "用户不在赛事区域"
                    }

                    if shouldCleanup {
                        Logger.info("🧹 清理过期 Event Activity: \(activity.id) - 原因: \(reason)")
                        await activity.end(nil, dismissalPolicy: .immediate)
                    }
                }

                // 清理 GPS Drawing Live Activities
                let gpsActivities = Activity<GPSDrawingActivityAttributes>.activities
                Logger.info("🧹 发现 \(gpsActivities.count) 个 GPS Drawing Activities")

                for activity in gpsActivities {
                    let state = activity.content.state
                    var shouldCleanup = false
                    var reason = ""

                    // 1. 检查是否已标记为结束
                    if !state.isActive {
                        shouldCleanup = true
                        reason = "已标记为非活跃"
                    }

                    // 2. 🆕 检查 GPS 绘制服务是否实际在运行
                    else if !GPSDrawingService.shared.isGPSDrawingMode {
                        shouldCleanup = true
                        reason = "GPS绘制服务未运行（孤立Activity）"
                    }

                    if shouldCleanup {
                        Logger.info("🧹 清理过期 GPS Drawing Activity: \(activity.id) - 原因: \(reason)")
                        await activity.end(nil, dismissalPolicy: .immediate)
                    }
                }

                await MainActor.run {
                    // 重置本地状态
                    let remainingEventActivities = Activity<EventActivityAttributes>.activities
                    let remainingGPSActivities = Activity<GPSDrawingActivityAttributes>.activities

                    if remainingEventActivities.isEmpty {
                        self.isActivityActive = false
                        self.currentActivityId = nil
                        Logger.info("🧹 已清空所有 Event Activities")
                    }
                    if remainingGPSActivities.isEmpty {
                        self.isGPSDrawingActivityActive = false
                        self.gpsDrawingActivityId = nil
                        Logger.info("🧹 已清空所有 GPS Drawing Activities")
                    }

                    Logger.info("🧹 清理完成：Event=\(remainingEventActivities.count), GPS=\(remainingGPSActivities.count)")
                }
            }
        }
    }

    // MARK: - Timer Management

    private func startUpdateTimer() {
        stopUpdateTimer()

        // 每秒更新倒计时
        updateTimer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { [weak self] _ in
            guard let self else { return }
            Task { @MainActor [weak self] in
                self?.updateCountdown()
            }
        }
    }

    private func stopUpdateTimer() {
        updateTimer?.invalidate()
        updateTimer = nil
    }

    private func updateCountdown() {
        guard isActivityActive else { return }

        if #available(iOS 16.1, *), let activity = currentActivity {
            var state = activity.content.state
            if state.secondsRemaining > 0 {
                state.secondsRemaining -= 1
                Task {
                    // 🔧 FIX: 倒计时数据，2秒有效期（1秒更新频率）
                    let staleDate = Date().addingTimeInterval(2)
                    let content = ActivityContent(state: state, staleDate: staleDate)
                    await activity.update(content)
                }
            } else if !state.isEnded {
                // 倒计时结束
                endActivity(showResult: true)
            }
        } else if var data = fallbackBannerData {
            if data.state.secondsRemaining > 0 {
                data.state.secondsRemaining -= 1
                fallbackBannerData = data
            }
        }
    }

    // MARK: - Helper Methods

    private func startActivityIfNeeded(for event: EventService.Event) {
        guard !isActivityActive else { return }

        // 🔧 FIX: 如果GPS绘制Activity正在运行，不启动赛事Activity（避免冲突）
        guard !isGPSDrawingActivityActive else {
            Logger.info("⚠️ GPS Drawing Activity 正在运行，跳过赛事 Activity 启动")
            return
        }

        // 获取用户联盟信息
        Task {
            do {
                let alliances = try await AllianceService.shared.fetchUserAlliances()
                guard let userAlliance = alliances.first else {
                    Logger.warning("⚠️ User has no alliance, skipping Live Activity")
                    return
                }

                // 计算剩余时间
                let endTime = parseISO8601Date(event.endTime)
                let secondsRemaining = max(0, Int(endTime?.timeIntervalSinceNow ?? 0))

                // 从 EventManager 获取当前分数
                let rankings = EventManager.shared.allianceScores.map { score in
                    EventActivityAttributes.AllianceRanking(
                        id: score.id,
                        name: score.name,
                        colorHex: score.colorHex,
                        score: score.score / 100.0,
                        pixelCount: Int(score.score * Double(EventManager.shared.totalPixels) / 100.0)
                    )
                }

                // 计算用户排名
                let userRank = rankings.firstIndex { $0.id == String(userAlliance.id) }.map { $0 + 1 } ?? 99

                let initialState = EventActivityAttributes.ContentState(
                    rankings: rankings,
                    userRank: userRank,
                    totalPixels: EventManager.shared.totalPixels,
                    secondsRemaining: secondsRemaining
                )

                await MainActor.run {
                    self.startActivity(
                        eventId: event.id,
                        eventTitle: event.title,
                        userAllianceName: userAlliance.name,
                        userAllianceColor: userAlliance.color ?? "#4A90D9",
                        initialState: initialState
                    )
                }
            } catch {
                Logger.error("❌ Failed to start Live Activity: \(error)")
            }
        }
    }

    private func updateActivityWithScores(_ scores: [TerritoryWarHUD.AllianceScore]) {
        guard isActivityActive else { return }

        let rankings = scores.map { score in
            EventActivityAttributes.AllianceRanking(
                id: score.id,
                name: score.name,
                colorHex: score.colorHex,
                score: score.score / 100.0,
                pixelCount: Int(score.score * Double(EventManager.shared.totalPixels) / 100.0)
            )
        }

        // 获取当前状态并更新
        if #available(iOS 16.1, *), let activity = currentActivity {
            var state = activity.content.state
            state.rankings = rankings
            state.totalPixels = EventManager.shared.totalPixels

            // 重新计算用户排名
            if let userAllianceId = fallbackBannerData?.eventId {
                state.userRank = rankings.firstIndex { $0.id == userAllianceId }.map { $0 + 1 } ?? state.userRank
            }

            updateActivity(with: state)
        } else if var data = fallbackBannerData {
            data.state.rankings = rankings
            data.state.totalPixels = EventManager.shared.totalPixels
            fallbackBannerData = data
        }
    }

    private func parseISO8601Date(_ string: String) -> Date? {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter.date(from: string)
    }
}

// MARK: - Fallback Banner Data

struct FallbackBannerData {
    var eventId: String
    var eventTitle: String
    var userAllianceName: String
    var userAllianceColor: String
    var state: EventActivityAttributes.ContentState
}
