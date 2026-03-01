import Foundation
import Combine
import CoreLocation

/// 漂流瓶 v2 核心管理器
/// 管理遭遇检测、频率控制、配额追踪、锁定流程
@MainActor
class DriftBottleManager: ObservableObject {
    static let shared = DriftBottleManager()

    // MARK: - Published State

    @Published var currentEncounter: DriftBottle?
    @Published var reunionEncounter: DriftBottle?
    @Published var quota: BottleQuota?
    @Published var showBottleEarnedToast = false
    @Published var showSidePanel = false
    @Published var showBottleSheet = false  // 底部Sheet替代侧边栏
    @Published var showEncounterBanner = false
    @Published var showOpenView = false
    @Published var showReunionView = false
    @Published var unreadJourneyCards: Int = 0

    // MARK: - Map Markers State

    @Published var mapMarkers: [BottleMapMarker] = []
    @Published var isLoadingMarkers = false
    var latestRefreshLat: Double = 0
    var latestRefreshLng: Double = 0

    // MARK: - Lock State (新增)

    @Published var lockedBottle: DriftBottle?
    @Published var lockExpireAt: Date?
    @Published var lockTimeRemaining: Int = 0
    @Published var isLocking = false

    // MARK: - Guidance State (新增)

    @Published var currentGuidance: GuidanceMessage?
    @Published var showGuidanceToast = false

    // MARK: - Frequency Control

    private var encountersToday: Int = 0
    private var encountersDismissedThisSession: Int = 0
    private let maxPerDay = 3
    private let maxPerSession = 2
    private var encounterTimer: Timer?
    var bannerDismissTimer: Timer?  // Internal for extension access
    private var lockTimer: Timer?  // 新增：锁定倒计时
    var markersRefreshTimer: Timer?  // Internal for extension access
    private var lastEncounteredBottleId: String?
    private var cancellables = Set<AnyCancellable>()

    // MARK: - Services

    let api = DriftBottleAPIService.shared  // Internal for extension access
    private let locationManager = LocationManager.shared

    private init() {
        setupSocketListeners()
    }

    // MARK: - Lock & Open Flow (新增)

    /// 锁定并打开瓶子（新流程）
    /// 1. 锁定瓶子（60秒倒计时）
    /// 2. 用户有60秒时间决定是否打开
    /// 3. 如果打开，消耗配额；如果放弃，不消耗配额
    func lockAndOpenBottle(_ bottle: DriftBottle) async throws {
        guard !isLocking else {
            Logger.warning("Already locking a bottle")
            return
        }

        isLocking = true
        defer { isLocking = false }

        guard let location = locationManager.currentLocation else {
            throw NSError(domain: "DriftBottle", code: -1, userInfo: [
                NSLocalizedDescriptionKey: LocalizationHelper.localize("drift_bottle.error.missing_location")
            ])
        }

        do {
            // 1. 锁定瓶子
            let lockResponse = try await api.lockBottle(
                bottleId: bottle.bottleId,
                lat: location.coordinate.latitude,
                lng: location.coordinate.longitude,
                accuracy: location.horizontalAccuracy
            )

            guard let lockData = lockResponse.data else {
                throw NSError(domain: "DriftBottle", code: -1, userInfo: [
                    NSLocalizedDescriptionKey: LocalizationHelper.localize(
                        messageKey: lockResponse.messageKey,
                        fallbackMessage: lockResponse.message
                    )
                ])
            }

            // 2. 保存锁定状态
            lockedBottle = lockData.bottle
            lockExpireAt = parseISO8601Date(lockData.lockExpireAt)
            lockTimeRemaining = lockData.lockDuration

            // 3. 启动倒计时
            startLockCountdown()

            // 4. 显示打开界面（用户可以选择打开或放弃）
            currentEncounter = lockData.bottle
            showOpenView = true

            // 5. 隐藏encounter banner
            showEncounterBanner = false
            bannerDismissTimer?.invalidate()

            // 6. 播放音效
            SoundManager.shared.play(.success)

            Logger.info("🔒 Bottle locked: \(bottle.bottleId), expires in \(lockData.lockDuration)s")

        } catch {
            Logger.error("Lock bottle failed: \(error)")

            // 显示友好的错误提示
            let errorMessage = LocalizationHelper.formatError(error)
            // 这里可以显示Toast或Alert
            Logger.warning("Lock error: \(errorMessage)")

            // 检查是否需要显示引导
            await checkAndShowGuidance()

            throw error
        }
    }

    /// 放弃锁定的瓶子（不消耗配额）
    func abandonLockedBottle() async {
        guard let bottle = lockedBottle else { return }

        do {
            try await api.abandonBottle(bottleId: bottle.bottleId)

            // 清除锁定状态
            clearLockState()

            // 关闭打开视图
            showOpenView = false

            Logger.info("🚮 Abandoned bottle: \(bottle.bottleId)")

            // 显示成功提示
            // 这里可以显示Toast
            Logger.info(LocalizationHelper.localize("drift_bottle.abandon.success"))

        } catch {
            Logger.error("Abandon bottle failed: \(error)")
        }
    }

    /// 启动锁定倒计时
    private func startLockCountdown() {
        lockTimer?.invalidate()

        lockTimer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { [weak self] _ in
            Task { @MainActor [weak self] in
                guard let self = self else { return }

                if let expireAt = self.lockExpireAt {
                    let remaining = Int(expireAt.timeIntervalSinceNow)
                    self.lockTimeRemaining = max(0, remaining)

                    if remaining <= 0 {
                        // 锁定过期
                        self.clearLockState()
                        self.showOpenView = false
                        Logger.warning("🔓 Lock expired")
                    }
                } else {
                    self.lockTimer?.invalidate()
                }
            }
        }
    }

    /// 清除锁定状态
    private func clearLockState() {
        lockedBottle = nil
        lockExpireAt = nil
        lockTimeRemaining = 0
        lockTimer?.invalidate()
        lockTimer = nil
    }

    /// 解析ISO8601日期
    private func parseISO8601Date(_ dateString: String) -> Date? {
        let formatter = ISO8601DateFormatter()
        return formatter.date(from: dateString)
    }

    // MARK: - Encounter Detection

    /// 开始遭遇检测 (60秒轮询)
    func startEncounterDetection() {
        stopEncounterDetection()
        encounterTimer = Timer.scheduledTimer(withTimeInterval: 60, repeats: true) { [weak self] _ in
            Task { @MainActor [weak self] in
                await self?.checkForNearbyBottles()
            }
        }
        // 立即检查一次
        Task { await checkForNearbyBottles() }
    }

    func stopEncounterDetection() {
        encounterTimer?.invalidate()
        encounterTimer = nil
    }

    private func checkForNearbyBottles() async {
        guard encountersToday < maxPerDay,
              encountersDismissedThisSession < maxPerSession else { return }

        guard let location = locationManager.currentLocation else { return }

        do {
            let encounter = try await api.checkEncounter(
                lat: location.coordinate.latitude,
                lng: location.coordinate.longitude
            )

            if let reunion = encounter.reunionBottle {
                Logger.info("🎉 Reunion encounter: \(reunion.bottleId)")

                reunionEncounter = reunion
                showReunionView = true

                // 🆕 播放特殊音效
                SoundManager.shared.play(.bottleEncounter)

            } else if let bottle = encounter.bottles.first {
                guard bottle.bottleId != lastEncounteredBottleId else {
                    Logger.debug("⏭️ Already encountered: \(bottle.bottleId)")
                    return
                }

                Logger.info("📍 Encounter: \(bottle.bottleId) from \(bottle.originCity ?? "unknown")")

                currentEncounter = bottle
                showEncounterBanner = true
                encountersToday += 1
                lastEncounteredBottleId = bottle.bottleId

                // 🆕 播放遭遇音效
                SoundManager.shared.play(.bottleEncounter)

                startBannerDismissTimer()
            }
        } catch {
            Logger.warning("检查遭遇失败: \(error.localizedDescription)")
        }
    }

    // MARK: - Banner Control

    private func startBannerDismissTimer() {
        bannerDismissTimer?.invalidate()
        bannerDismissTimer = Timer.scheduledTimer(withTimeInterval: 180, repeats: false) { [weak self] _ in
            Task { @MainActor [weak self] in
                self?.dismissEncounter()
            }
        }
    }

    func dismissEncounter() {
        // Don't clear encounter if user already opened it
        guard !showOpenView else {
            bannerDismissTimer?.invalidate()
            bannerDismissTimer = nil
            return
        }
        showEncounterBanner = false
        currentEncounter = nil
        bannerDismissTimer?.invalidate()
        bannerDismissTimer = nil
        encountersDismissedThisSession += 1
    }

    func openEncounteredBottle() {
        guard currentEncounter != nil else { return }
        showEncounterBanner = false
        showOpenView = true
        bannerDismissTimer?.invalidate()
        bannerDismissTimer = nil
    }

    // MARK: - Guidance System (新增)

    /// 检查并显示引导消息
    func checkAndShowGuidance() async {
        do {
            if let guidance = try await api.getGuidance() {
                currentGuidance = guidance
                showGuidanceToast = true

                Logger.info("💡 Guidance: \(guidance.messageKey)")

                // 自动隐藏Toast（5秒后）
                DispatchQueue.main.asyncAfter(deadline: .now() + 5) { [weak self] in
                    self?.showGuidanceToast = false
                }
            }
        } catch {
            Logger.warning("Get guidance failed: \(error)")
        }
    }

    /// 获取格式化的引导消息文本
    func getGuidanceText() -> String? {
        guard let guidance = currentGuidance else { return nil }
        return LocalizationHelper.formatGuidanceMessage(guidance)
    }

    // MARK: - Pixel Count Hook (已移除)
    // 新配额系统中，画像素奖励由后端自动计算
    // 不再需要前端主动触发

    // MARK: - Throw Bottle

    func throwBottle(message: String, pixelSnapshot: PixelSnapshot? = nil) async throws {
        guard let location = locationManager.currentLocation else {
            throw NSError(domain: "DriftBottle", code: -1, userInfo: [
                NSLocalizedDescriptionKey: LocalizationHelper.localize("drift_bottle.error.missing_location")
            ])
        }
        _ = try await api.throwBottle(
            lat: location.coordinate.latitude,
            lng: location.coordinate.longitude,
            message: message,
            pixelSnapshot: pixelSnapshot
        )
        await refreshQuota()
    }

    // MARK: - Quota

    func refreshQuota() async {
        do {
            let newQuota = try await api.getQuota()

            // 检测配额变化
            if let oldQuota = quota {
                // 检测每日重置
                if newQuota.dailyRemaining > oldQuota.dailyRemaining {
                    Logger.info("🔄 Daily quota reset detected")
                    // 可以在这里显示Toast提示
                }

                // 检测画像素奖励
                if newQuota.bonusFromPixels > oldQuota.bonusFromPixels {
                    Logger.info("🎨 Earned bottle from pixels!")
                    showBottleEarnedToast = true
                    SoundManager.shared.play(.success)
                }
            }

            quota = newQuota
            Logger.debug("📊 Quota updated: \(newQuota.totalAvailable) available")

            // 如果配额用完，检查引导
            if newQuota.totalAvailable == 0 {
                await checkAndShowGuidance()
            }

        } catch {
            Logger.warning("刷新配额失败: \(error.localizedDescription)")
        }
    }

    /// 获取格式化的配额消息
    func getQuotaMessage() -> String {
        guard let quota = quota else {
            return LocalizationHelper.localize("drift_bottle.quota.total_available") + ": 0"
        }
        return LocalizationHelper.formatQuotaMessage(quota)
    }

    func refreshUnreadCount() async {
        do {
            let cards = try await api.getJourneyCards(page: 1, limit: 1)
            unreadJourneyCards = cards.cards.filter { !$0.isRead }.count
        } catch {
            Logger.warning("刷新未读数失败: \(error.localizedDescription)")
        }
    }

    // MARK: - Socket Events

    private func setupSocketListeners() {
        Task {
            let socketManager = SocketIOManager.shared

            await socketManager.bottleNearbyPublisher
                .receive(on: DispatchQueue.main)
                .sink { [weak self] bottle in
                    guard let self = self else { return }
                    if self.encountersToday < self.maxPerDay && !self.showEncounterBanner {
                        guard bottle.bottleId != self.lastEncounteredBottleId else { return }
                        self.currentEncounter = bottle
                        self.showEncounterBanner = true
                        self.encountersToday += 1
                        self.lastEncounteredBottleId = bottle.bottleId
                        self.startBannerDismissTimer()
                    }
                }
                .store(in: &cancellables)

            await socketManager.bottleSunkPublisher
                .receive(on: DispatchQueue.main)
                .sink { [weak self] _ in
                    Task { @MainActor in
                        await self?.refreshUnreadCount()
                    }
                }
                .store(in: &cancellables)
        }
    }

    // MARK: - Handle Sunk Event

    func handleBottleSunk(data: [String: Any]) {
        Task {
            await refreshUnreadCount()
        }
    }

    // MARK: - Cleanup

    /// 清理所有状态（用于用户登出等场景）
    func cleanup() {
        stopEncounterDetection()
        clearLockState()
        stopMapMarkersAutoRefresh()
        currentEncounter = nil
        reunionEncounter = nil
        quota = nil
        showBottleEarnedToast = false
        showSidePanel = false
        showEncounterBanner = false
        showOpenView = false
        showReunionView = false
        unreadJourneyCards = 0
        currentGuidance = nil
        showGuidanceToast = false
        encountersToday = 0
        encountersDismissedThisSession = 0
        lastEncounteredBottleId = nil
        mapMarkers = []
        isLoadingMarkers = false
    }
}
