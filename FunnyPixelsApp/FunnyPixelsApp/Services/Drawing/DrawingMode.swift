import Foundation
import SwiftUI
import Combine

/// 绘制模式枚举
public enum DrawingMode: String, CaseIterable {
    case none = "none"           // 普通浏览模式
    case color = "color"         // 颜色像素绘制
    case emoji = "emoji"         // Emoji像素绘制
    case complex = "complex"     // 复杂图案绘制
    case gps = "gps"             // GPS自动绘制模式

    var displayName: String {
        switch self {
        case .none: return NSLocalizedString("drawing.mode.none", comment: "Browse")
        case .color: return NSLocalizedString("drawing.mode.color", comment: "Color")
        case .emoji: return NSLocalizedString("drawing.mode.emoji", comment: "Emoji")
        case .complex: return NSLocalizedString("drawing.mode.complex", comment: "Pattern")
        case .gps: return NSLocalizedString("drawing.mode.gps", comment: "GPS")
        }
    }

    var icon: String {
        switch self {
        case .none: return "hand.draw"
        case .color: return "paintpalette"
        case .emoji: return "face.smiling"
        case .complex: return "square.grid.3x3.fill"
        case .gps: return "location.fill"
        }
    }
}

/// 绘制状态
@MainActor
class DrawingStateManager: ObservableObject {
    static let shared = DrawingStateManager()

    // MARK: - Published Properties

    @Published var isDrawingMode = false
    @Published var currentMode: DrawingMode = .none
    @Published var selectedColor: String = "#4ECDC4"
    @Published var selectedEmoji: String = "😀"
    @Published var selectedPatternId: String = ""
    @Published var showColorPicker = false
    @Published var showEmojiPicker = false
    @Published var showPatternPicker = false
    @Published var isGridVisible = false
    @Published var currentSessionId: String?  // 本地会话ID
    @Published var backendSessionId: String?  // 后端会话ID
    @Published var isGPSDrawingActive = false  // GPS绘制模式是否激活
    @Published var gpsDrawingPixelCount = 0   // GPS绘制像素计数

    // MARK: - Focus Mode (专注模式 - 防误触+优化)
    @Published var isFocusMode = false  // 专注模式是否激活
    @Published var focusModeActivationTime: Date?  // 进入专注模式的时间
    @Published var focusModeDistance: Double = 0  // 专注模式下的累计绘制距离（米）
    @Published var focusModeStartTime: Date?  // 专注模式会话开始时间

    // MARK: - Session Summary (Share Card)
    @Published var showSessionSummary = false
    @Published var lastSessionStats: SessionStats?
    @Published var lastSessionImage: UIImage?

    // MARK: - Alliance Selection
    @Published var showAllianceSelection = false
    @Published var userAlliances: [AllianceService.Alliance] = []
    @Published var isTestMode = false // 新增：是否处于测试模式

    // MARK: - Flag Selection (扩展旗帜选择器)
    @Published var showFlagSelection = false
    @Published var currentFlagChoice: FlagChoice? = nil
    
    // MARK: - Sync Status Popup

    // MARK: - Map Layer Visibility

    // MARK: - Drawing Session

    private var sessionStartTime: Date?
    private var pixelsDrawnInSession = 0

    // MARK: - Computed Properties

    var canDraw: Bool {
        isDrawingMode && currentMode != .none
    }

    var isGPSDrawing: Bool {
        isDrawingMode && currentMode == .gps
    }

    // MARK: - Persistence Keys
    private let kBackendSessionId = "com.funnypixels.backendSessionId"
    private let kCurrentMode = "com.funnypixels.currentDrawingMode"
    private let kSessionStartTime = "com.funnypixels.sessionStartTime"
    private let kLastAllianceId = "com.funnypixels.lastAllianceId"
    private let kLastFlagChoice = "com.funnypixels.lastFlagChoice"

    // MARK: - Methods

    private init() {
        // 尝试从持久化恢复
        restoreSession()
        setupLifecycleObservers()
    }
    
    private func restoreSession() {
        if let savedId = UserDefaults.standard.string(forKey: kBackendSessionId),
           let savedModeStr = UserDefaults.standard.string(forKey: kCurrentMode),
           let savedMode = DrawingMode(rawValue: savedModeStr) {
            
            self.backendSessionId = savedId
            self.currentMode = savedMode
            self.isDrawingMode = true
            
            // Restore Session Start Time
            if let savedStartTime = UserDefaults.standard.object(forKey: kSessionStartTime) as? Date {
                self.sessionStartTime = savedStartTime
            }
            
            // If GPS mode, ensure GPS service knows it (to hide FAB and show controls)
            if savedMode == .gps {
                Task { @MainActor in
                    GPSDrawingService.shared.isGPSDrawingMode = true
                }
            }
            
            Logger.info("🔄 Restored session from persistence: \(savedId) in mode \(savedMode.rawValue), start: \(String(describing: sessionStartTime))")
            
            // 启动心跳
            SessionHeartbeatManager.shared.start(sessionId: savedId)
        }
    }
    
    private func setupLifecycleObservers() {
        NotificationCenter.default.addObserver(
            forName: UIApplication.willResignActiveNotification,
            object: nil,
            queue: .main
        ) { _ in
            // App进入后台，考虑是否需要特殊处理
            Logger.info("📱 App will resign active")
        }
        
        NotificationCenter.default.addObserver(
            forName: UIApplication.didBecomeActiveNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            Logger.info("📱 App did become active")
            // 可以在此处检查会话有效性
            Task { @MainActor [weak self] in
                self?.validateRestoredSession()
            }
        }
    }
    
    private func validateRestoredSession() {
        guard let sessionId = backendSessionId else { return }
        
        // 验证心跳是否需要重启
        SessionHeartbeatManager.shared.start(sessionId: sessionId)
    }

    /// 打开绘制面板（不开始绘制）
    func openDrawingPanel() {
        // 只打开面板，不修改currentMode
        isDrawingMode = true
        Logger.info("📱 Drawing panel opened")
    }

    /// 开始绘制模式
    func startDrawing(mode: DrawingMode, allianceId: Int? = nil) async throws {
        // 如果已经在相同模式下，不做任何操作
        if currentMode == mode && isDrawingMode {
            Logger.info("⚠️ Already in \(mode.displayName) mode, ignoring startDrawing call")
            return
        }

        // 保存之前状态以便失败时回滚
        let prevMode = currentMode
        let prevIsDrawingMode = isDrawingMode
        let prevIsGPSActive = isGPSDrawingActive

        // 如果切换模式，先停止当前模式
        if currentMode != .none && currentMode != mode {
            Logger.info("🔄 Switching from \(currentMode.displayName) to \(mode.displayName)")
            await stopDrawing()
        }

        // 尝试切换到新模式
        currentMode = mode
        isDrawingMode = true

        do {
            if mode == .gps {
                // GPS绘制模式
                isGPSDrawingActive = true
                Logger.info("📍 Starting GPS drawing mode")
                
                // 1. 开始会话计时并创建后端会话
                try await startNewSession(allianceId: allianceId)
                
                // 2. 启动 GPS 绘制服务（负责实际的位置监听和绘制）
                // 使用 try!/try? 的风险是服务没启动但状态已改，这里使用 try 确保失败能回滚
                try await GPSDrawingService.shared.startGPSDrawing(allianceId: allianceId)
            } else {
                // 手动绘制模式：确保GPS状态被重置
                isGPSDrawingActive = false
                Logger.info("✏️ Started drawing mode: \(mode.displayName)")

                // 开始新的绘制会话
                if currentSessionId == nil {
                    try await startNewSession(allianceId: allianceId)
                }
            }
            
            // 持久化成功后的状态
            persistState()
            
        } catch {
            Logger.error("❌ Failed to start drawing mode \(mode.displayName): \(error.localizedDescription)")
            
            // 失败回滚
            currentMode = prevMode
            isDrawingMode = prevIsDrawingMode
            isGPSDrawingActive = prevIsGPSActive
            
            throw error
        }
    }

    private func persistState() {
        if let bid = backendSessionId {
            UserDefaults.standard.set(bid, forKey: kBackendSessionId)
            UserDefaults.standard.set(currentMode.rawValue, forKey: kCurrentMode)
            if let startTime = sessionStartTime {
                UserDefaults.standard.set(startTime, forKey: kSessionStartTime)
            }
        }
    }

    /// 请求开始GPS绘制（处理联盟选择逻辑）
    func requestStartGPSDrawing(forcePicker: Bool = false) async {
        await requestFlagSelection(testMode: false, forcePicker: forcePicker)
    }

    /// 请求测试GPS绘制（处理联盟选择逻辑）
    func requestStartTestGPSDrawing(forcePicker: Bool = false) async {
        await requestFlagSelection(testMode: true, forcePicker: forcePicker)
    }

    private func requestFlagSelection(testMode: Bool, forcePicker: Bool) async {
        // 如果已经在GPS模式，不要重复触发（非测试模式）
        if !testMode && currentMode == .gps && isDrawingMode {
            Logger.info("⚠️ Already in GPS mode, ignoring request")
            return
        }

        do {
            let alliances = try await AllianceService.shared.fetchUserAlliances()
            
            await MainActor.run {
                self.userAlliances = alliances
                self.isTestMode = testMode
                
                // PM Optimization: Smart Default — 支持 FlagChoice 记忆
                if !forcePicker, let lastChoice = loadLastFlagChoice(), isChoiceStillValid(lastChoice, alliances: alliances) {
                    Logger.info("⚡️ Smart Default: Using last flag choice for \(testMode ? "Test" : "Production")")
                    self.currentFlagChoice = lastChoice
                    handleSelectionStepDone(alliance: alliances.first(where: { $0.id == lastChoice.allianceId }))
                    return
                }
                
                // 兼容迁移：从旧的 kLastAllianceId
                let lastId = UserDefaults.standard.integer(forKey: kLastAllianceId)
                if !forcePicker, lastId > 0, let lastAlliance = alliances.first(where: { $0.id == lastId }) {
                    Logger.info("⚡️ Smart Default (migration): Using last used alliance (\(lastId))")
                    let migratedChoice = FlagChoice.alliance(allianceId: lastAlliance.id, allianceName: lastAlliance.name)
                    self.currentFlagChoice = migratedChoice
                    saveLastFlagChoice(migratedChoice)
                    handleSelectionStepDone(alliance: lastAlliance)
                    return
                }

                // 检查是否有多种旗帜选项
                let hasAvatar = AuthManager.shared.currentUser?.avatar?.contains(",") == true
                let hasMultipleOptions = !alliances.isEmpty || hasAvatar
                
                if forcePicker || (hasMultipleOptions && alliances.count > 1) {
                    // 强制选择 或 多个联盟，显示旗帜选择器
                    self.showFlagSelection = true
                } else if alliances.count == 1 && !forcePicker {
                    // 只有一个联盟且非强制选择，直接使用
                    let alliance = alliances.first!
                    let choice = FlagChoice.alliance(allianceId: alliance.id, allianceName: alliance.name)
                    self.currentFlagChoice = choice
                    saveLastFlagChoice(choice)
                    handleSelectionStepDone(alliance: alliance)
                } else {
                    // 没有联盟，使用个人颜色
                    let userId = AuthManager.shared.currentUser?.id ?? ""
                    let color = PersonalColorPalette.colorForUser(userId)
                    let choice = FlagChoice.personalColor(colorHex: color)
                    self.currentFlagChoice = choice
                    saveLastFlagChoice(choice)
                    handleSelectionStepDone(alliance: nil)
                }
            }
        } catch {
            Logger.error("Failed to fetch user alliances: \(error)")
            // 失败时降级方案
            await MainActor.run {
                self.isTestMode = testMode
                handleSelectionStepDone(alliance: nil)
            }
        }
    }

    /// 确认旗帜选择（从 FlagSelectionSheet 调用）
    func confirmFlagSelection(choice: FlagChoice) async {
        showFlagSelection = false
        currentFlagChoice = choice
        saveLastFlagChoice(choice)

        if isTestMode {
            // 测试模式
            var userInfo: [AnyHashable: Any] = [:]
            if let allianceId = choice.allianceId {
                userInfo["allianceId"] = allianceId
            }
            NotificationCenter.default.post(name: NSNotification.Name("ShowTestLocationPicker"), object: nil, userInfo: userInfo)
        } else {
            Task {
                try? await startDrawing(mode: .gps, allianceId: choice.allianceId)
            }
        }
    }

    /// 确认开始GPS绘制（从旧弹窗选择后调用，保留兼容）
    func confirmStartGPSDrawing(alliance: AllianceService.Alliance?) async {
        self.showAllianceSelection = false
        handleSelectionStepDone(alliance: alliance)
    }

    // MARK: - FlagChoice Persistence

    private func saveLastFlagChoice(_ choice: FlagChoice) {
        if let data = try? JSONEncoder().encode(choice) {
            UserDefaults.standard.set(data, forKey: kLastFlagChoice)
        }
    }

    private func loadLastFlagChoice() -> FlagChoice? {
        guard let data = UserDefaults.standard.data(forKey: kLastFlagChoice) else { return nil }
        return try? JSONDecoder().decode(FlagChoice.self, from: data)
    }

    private func isChoiceStillValid(_ choice: FlagChoice, alliances: [AllianceService.Alliance]) -> Bool {
        switch choice {
        case .personalColor:
            return true
        case .personalAvatar:
            return AuthManager.shared.currentUser?.avatar?.contains(",") == true
        case .alliance(let allianceId, _):
            return alliances.contains(where: { $0.id == allianceId })
        }
    }

    private func handleSelectionStepDone(alliance: AllianceService.Alliance?) {
        if isTestMode {
            // 测试模式：发送通知显示坐标选择器
            // 传递 ID 而不是整个 struct，以避免在 NotificationCenter 桥接时崩溃
            var userInfo: [AnyHashable: Any] = [:]
            if let alliance = alliance {
                userInfo["allianceId"] = alliance.id
            }
            NotificationCenter.default.post(name: NSNotification.Name("ShowTestLocationPicker"), object: nil, userInfo: userInfo)
        } else {
            // 正常模式：直接开始会话
            Task {
                try? await self.startDrawing(mode: .gps, allianceId: alliance?.id)
            }
        }
    }

    /// 停止绘制模式
    func stopDrawing() async {
        let wasGPSDrawing = currentMode == .gps
        // 捕获会话数据用于生成分享卡片
        if let startTime = sessionStartTime {
            let duration = Date().timeIntervalSince(startTime)
            let pixelCount = wasGPSDrawing ? gpsDrawingPixelCount : pixelsDrawnInSession
            
            // 只有当有绘制数据时才显示总结
            if pixelCount > 0 {
                lastSessionStats = SessionStats(
                    pixelCount: pixelCount,
                    duration: duration,
                    date: Date(),
                    sessionId: backendSessionId
                )
                showSessionSummary = true
                Logger.info("📊 Session stats captured: \(pixelCount) pixels, \(Int(duration))s")
            }
        }

        isDrawingMode = false
        currentMode = .none
        isGPSDrawingActive = false

        if wasGPSDrawing {
            Logger.info("🛑 GPS drawing mode stopped")
            Logger.info("[TRACKER] 6. Stopping Session. GPS Pixel Count: \(gpsDrawingPixelCount)")
            // GPS模式通常也是会话，结束它
            await endSession()
            gpsDrawingPixelCount = 0
        } else {
            Logger.info("✏️ Stopped drawing mode")
            // 结束绘制会话
            await endSession()
        }
    }

    /// 切换网格显示
    func toggleGrid() {
        isGridVisible.toggle()
        Logger.info("Grid visibility: \(isGridVisible)")
    }

    /// 开始新的绘制会话
    private func startNewSession(allianceId: Int? = nil) async throws {
        sessionStartTime = Date()
        pixelsDrawnInSession = 0
        gpsDrawingPixelCount = 0

        // 生成本地会话ID
        currentSessionId = UUID().uuidString

        // 如果是GPS模式，创建后端会话
        if currentMode == .gps {
            do {
                try await performStartSession(allianceId: allianceId)
            } catch let error as APIError {
                // 如果后端报告已有活跃会话 (HTTP 400)
                if case .serverError(let code, _) = error, code == 400 {
                    Logger.warning("⚠️ Already has an active session. Attempting to end it and retry...")
                    if let existing = try? await DrawingSessionService.shared.getActiveSession() {
                        Logger.info("🛑 Closing existing session: \(existing.sessionId)")
                        _ = try? await DrawingSessionService.shared.endSession(sessionId: existing.sessionId, endLocation: nil)
                        // 准备清理本地状态并重试一次
                        try await performStartSession(allianceId: allianceId)
                        return
                    }
                }
                Logger.error("Failed to create backend session: \(error.localizedDescription)")
                currentSessionId = nil
                throw error
            } catch {
                Logger.error("Failed to create backend session: \(error.localizedDescription)")
                currentSessionId = nil
                throw error
            }
        }

        Logger.info("🎨 Started new drawing session: \(currentSessionId ?? "")")
    }

    private func performStartSession(allianceId: Int? = nil) async throws {
        Logger.info("[TRACKER] 2. Starting Session: AllianceID=\(allianceId?.description ?? "nil")")
        let response = try await DrawingSessionService.shared.startSession(
            sessionName: "GPS Drawing \(Date().formatted(date: .abbreviated, time: .shortened))",
            drawingType: "gps",
            startLocation: nil,
            allianceId: allianceId
        )
        
        // Persist last used alliance if successful
        if let aid = allianceId {
            UserDefaults.standard.set(aid, forKey: kLastAllianceId)
        }
        
        backendSessionId = response.sessionId
        Logger.info("🎨 Backend session created: \(response.sessionId)")
        SessionHeartbeatManager.shared.start(sessionId: response.sessionId)
        
        // Persist sessionStartTime after backend session is confirmed
        if let startTime = sessionStartTime {
             UserDefaults.standard.set(startTime, forKey: kSessionStartTime)
        }
    }

    /// 结束绘制会话
    /// 结束绘制会话
    private func endSession() async {
        guard currentSessionId != nil else { return }

        // 如果有后端会话，结束它
        if let backendId = backendSessionId {
            do {
                _ = try await DrawingSessionService.shared.endSession(
                    sessionId: backendId,
                    endLocation: nil  // Will be set by GPSDrawingService
                )
                Logger.info("✅ Backend session ended: \(backendId)")
                // 注意：成就检查已由 GPSDrawingService 在绘制像素时内联处理（API 响应直接返回 newAchievements）
                // 此处不再额外调用 checkAndNotify()，避免重复 API 请求
            } catch {
                Logger.error("Failed to end backend session: \(error.localizedDescription)")
            }
        }
        
        let sessionPixelCount = currentMode == .gps ? gpsDrawingPixelCount : pixelsDrawnInSession
        let sessionDuration = sessionStartTime.map { Date().timeIntervalSince($0) } ?? 0
        let sessionDurationString = "\(Int(sessionDuration))s"

        Logger.info("🎨 Drawing session ended:")
        Logger.info("  - Session ID: \(backendSessionId ?? "nil")")
        Logger.info("  - Duration: \(sessionDurationString)")
        Logger.info("  - Pixels drawn: \(sessionPixelCount)")
        Logger.info("[TRACKER] 6b. Session Ended. Final Stats - ID: \(backendSessionId ?? "nil"), Pixels: \(sessionPixelCount)")
        
        // Reset state清理持久化
        UserDefaults.standard.removeObject(forKey: kBackendSessionId)
        UserDefaults.standard.removeObject(forKey: kCurrentMode)
        UserDefaults.standard.removeObject(forKey: kSessionStartTime)
        
        // 停止心跳
        SessionHeartbeatManager.shared.stop()

        currentSessionId = nil
        backendSessionId = nil
        sessionStartTime = nil
        pixelsDrawnInSession = 0
    }

    /// 记录绘制的像素
    func recordDrawnPixel() {
        pixelsDrawnInSession += 1
    }

    /// 记录GPS绘制的像素
    func recordGPSDrawnPixel() {
        gpsDrawingPixelCount += 1
    }

    /// 获取当前会话统计
    func getSessionStats() -> (sessionId: String, duration: TimeInterval, pixelCount: Int)? {
        guard let sessionId = currentSessionId,
              let startTime = sessionStartTime else {
            return nil
        }

        let duration = Date().timeIntervalSince(startTime)
        return (sessionId, duration, pixelsDrawnInSession)
    }
}

/// 预设颜色
struct PresetColors {
    static let colors = [
        "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4",
        "#FFEAA7", "#DFE6E9", "#6C5CE7", "#FD79A8",
        "#FDCB6E", "#E17055", "#00B894", "#0984E3",
        "#6C5CE7", "#A29BFE", "#FD79A8", "#FAB1A0",
        "#000000", "#FFFFFF", "#808080", "#FF0000"
    ]
}
