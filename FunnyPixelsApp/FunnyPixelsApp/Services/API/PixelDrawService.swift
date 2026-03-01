import Foundation
import Combine

/// 像素绘制服务
/// 负责用户像素状态管理、验证和同步
@MainActor
class PixelDrawService: ObservableObject {
    static let shared = PixelDrawService()

    // MARK: - Published Properties

    @Published var itemPoints: Int = 0
    @Published var naturalPoints: Int = 64
    @Published var maxNaturalPoints: Int = 64
    @Published var freezeUntil: Int = 0
    @Published var isFrozen: Bool = false
    @Published var canDraw: Bool = true
    @Published var lastUpdateTime: Date?

    // MARK: - Computed Properties

    /// 总像素点数 = 道具点数 + 自然点数
    var totalPoints: Int {
        itemPoints + naturalPoints
    }

    /// 剩余冻结时间（秒）
    var freezeTimeLeft: Int {
        guard freezeUntil > 0 else { return 0 }
        let now = Int(Date().timeIntervalSince1970)
        return max(0, freezeUntil - now)
    }

    /// 是否在自然累计阶段
    var isInAccumulation: Bool {
        freezeTimeLeft == 0 && totalPoints < maxNaturalPoints
    }

    // MARK: - Constants

    private let maxNaturalPixelPoints = 64
    private let syncInterval: TimeInterval = 30 // 30秒同步一次

    // MARK: - Private Properties

    private var syncTimer: Timer?
    private let apiManager = APIManager.shared

    private init() {
        // 启动定期同步
        startPeriodicSync()
    }

    deinit {
        syncTimer?.invalidate()
    }

    // MARK: - API Methods

    /// 验证用户绘制状态
    /// 调用 GET /api/pixel-draw/validate
    func validateUserState() async throws -> UserPixelState {
        Logger.debug("🔍 Validating user pixel state")

        do {
            let response: ValidateUserStateResponse = try await apiManager.request(endpoint: .validatePixelState)

            if response.success, let state = response.data {
                // 更新本地状态
                await updateState(from: state)
                Logger.info("✅ User pixel state updated: \(state.totalPoints) total points")
                return state
            } else {
                Logger.error("Failed to validate user state: \(response.message ?? "Unknown error")")
                throw NetworkError.serverError(response.message ?? "Validation failed")
            }
        } catch NetworkError.unauthorized {
            Logger.info("🔒 Session expired during validation - waiting for auto-logout")
            throw NetworkError.unauthorized
        } catch {
            let nsError = error as NSError
            Logger.error("❌ Unexpected error: \(error.localizedDescription)")
            if nsError.domain == "NSCocoaErrorDomain" && nsError.code == 484 {
                Logger.error("❌ Decoding error - key/value mismatch")
            }
            throw NetworkError.unknown(error)
        }
    }

    // MARK: - Local Simulation
    
    private var localTimer: Timer?
    private var lastAccumulationCheckTime: Date = Date()
    
    // MARK: - State Management
    
    /// 从API响应更新本地状态
    private func updateState(from state: UserPixelState) async {
        itemPoints = state.itemPoints
        naturalPoints = state.naturalPoints
        maxNaturalPoints = state.maxNaturalPoints
        freezeUntil = state.freezeUntil
        canDraw = state.canDraw
        isFrozen = freezeUntil > 0

        // 🔍 详细日志：打印canDraw状态
        Logger.info("🔍 [PixelState] canDraw=\(canDraw), isFrozen=\(isFrozen), freezeTimeLeft=\(state.freezeTimeLeft), totalPoints=\(state.totalPoints)")

        // 🔧 Workaround: 如果有点数且不在冻结期，强制允许绘制
        // 这解决了后端 validateUserState 中冷却时间检查过于严格的问题
        if !canDraw && state.totalPoints > 0 && state.freezeTimeLeft == 0 {
            Logger.warning("⚠️ [PixelState] Backend returned canDraw=false but totalPoints=\(state.totalPoints) and freezeTimeLeft=0, forcing canDraw=true")
            canDraw = true
            isFrozen = false
        }
        
        // 更新最近积累时间，用于本地计时
        // 逻辑：优先使用 lastAccumTime，如果还没累积过则使用 lastActivityTime
        let baselineTimeStr = (state.lastAccumTime != nil && state.lastAccumTime != "0") ? state.lastAccumTime : state.lastActivityTime
        
        if let timeStr = baselineTimeStr, let timeInterval = Double(timeStr) {
             lastAccumulationCheckTime = Date(timeIntervalSince1970: timeInterval)
        } else {
             lastAccumulationCheckTime = Date()
        }
        
        lastUpdateTime = Date()
    }

    
    /// 启动本地预测计时器 (1秒 tick)
    private func startLocalTimer() {
        localTimer?.invalidate()
        localTimer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { _ in
            Task { @MainActor [weak self] in
                self?.processLocalUpdates()
            }
        }
    }
    
    /// 处理本地状态更新 (每秒调用)
    private func processLocalUpdates() {
        let now = Date()
        let nowInt = Int(now.timeIntervalSince1970)
        
        // 1. 更新冻结状态
        if freezeUntil > 0 {
            if nowInt >= freezeUntil {
                // 冻结结束
                freezeUntil = 0
                isFrozen = false
                canDraw = true
                // 立即触发一次同步以确认服务端状态
                Task { try? await self.refresh() }
            } else {
                // 只有冻结时，才通知UI刷新倒计时 (通过改变Published属性)
                objectWillChange.send()
            }
        }
        
        // 2. 模拟自然恢复 (Accumulation)
        // 条件: 不在冻结期 && 自然点数未满
        if freezeUntil == 0 && naturalPoints < maxNaturalPoints {
            // 后端逻辑: 空闲10秒后开始积累，之后每10秒+1
            // 这里简化: 只要距离上次积累超过10秒，就+1
            if now.timeIntervalSince(lastAccumulationCheckTime) >= 10 {
                naturalPoints += 1
                lastAccumulationCheckTime = now
                Logger.debug("🌱 本地模拟: 自然恢复 +1 (当前: \(naturalPoints))")
                
                // 如果满了，标记完成
                if naturalPoints >= maxNaturalPoints {
                    Logger.debug("✨ 本地模拟: 自然点数已满")
                }
            }
        }
    }

    /// 启动定期同步
    private func startPeriodicSync() {
        // 同时也启动本地计时器
        startLocalTimer()
        
        syncTimer?.invalidate()
        syncTimer = Timer.scheduledTimer(withTimeInterval: syncInterval, repeats: true) { [weak self] _ in
            Task { @MainActor in
                await self?.syncState()
            }
        }

        Logger.debug("⏰ Started periodic pixel state sync (every \(Int(syncInterval))s) & local simulation")
    }

    /// 同步状态
    private func syncState() async {
        do {
            _ = try await validateUserState()
        } catch {
            Logger.warning("Failed to sync pixel state: \(error.localizedDescription)")
        }
    }

    /// 手动刷新状态
    func refresh() async throws {
        _ = try await validateUserState()
    }

    // MARK: - Computed Helpers

    /// 格式化剩余冻结时间
    func formatFreezeTimeLeft() -> String? {
        let remaining = freezeTimeLeft
        guard remaining > 0 else { return nil }

        if remaining < 60 {
            return "\(remaining)s"
        } else if remaining < 3600 {
            return "\(remaining / 60)m"
        } else {
            let hours = remaining / 3600
            let minutes = (remaining % 3600) / 60
            return "\(hours)h\(minutes)m"
        }
    }
}

// MARK: - Data Models

/// 用户像素状态
struct UserPixelState: Codable {
    let canDraw: Bool
    let itemPoints: Int
    let naturalPoints: Int
    let totalPoints: Int
    let freezeTimeLeft: Int
    let maxNaturalPoints: Int
    let lastActivityTime: String?
    let lastAccumTime: String?
    let isInNaturalAccumulation: Bool?

    // 计算属性：从 freezeTimeLeft 推导 freezeUntil
    var freezeUntil: Int {
        let now = Int(Date().timeIntervalSince1970)
        return freezeTimeLeft > 0 ? now + freezeTimeLeft : 0
    }

    enum CodingKeys: String, CodingKey {
        case canDraw = "canDraw"
        case itemPoints = "itemPoints"
        case naturalPoints = "naturalPoints"
        case totalPoints = "totalPoints"
        case freezeTimeLeft = "freezeTimeLeft"
        case maxNaturalPoints = "maxNaturalPoints"
        case lastActivityTime = "lastActivityTime"
        case lastAccumTime = "lastAccumTime"
        case isInNaturalAccumulation = "isInNaturalAccumulation"
    }
}

/// 验证用户状态响应
struct ValidateUserStateResponse: Codable {
    let success: Bool
    let data: UserPixelState?
    let message: String?
}

/// 绘制像素响应（与后端保持一致）
struct DrawPixelAPIResponse: Codable {
    let success: Bool
    let data: DrawPixelData?
    let error: String?

    struct DrawPixelData: Codable {
        let pixel: PixelInfo?
        let consumptionResult: ConsumptionResult?

        enum CodingKeys: String, CodingKey {
            case pixel
            case consumptionResult = "consumptionResult"
        }
    }

    struct PixelInfo: Codable {
        let id: String
        let gridId: String?
        let latitude: Double
        let longitude: Double
        let color: String?
        let patternId: String?
        let payload: String?
        let userId: String

        enum CodingKeys: String, CodingKey {
            case id
            case gridId = "grid_id"
            case latitude
            case longitude
            case color
            case patternId = "pattern_id"
            case payload
            case userId = "user_id"
        }
    }

    struct ConsumptionResult: Codable {
        let consumed: Int
        let remainingPoints: Int
        let itemPoints: Int
        let naturalPoints: Int
        let freezeUntil: Int

        var isFrozen: Bool {
            return freezeUntil > 0
        }

        enum CodingKeys: String, CodingKey {
            case consumed
            case remainingPoints = "remainingPoints"
            case itemPoints = "itemPoints"
            case naturalPoints = "naturalPoints"
            case freezeUntil = "freezeUntil"
        }
    }
}
