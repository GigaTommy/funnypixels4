import Foundation

/// 漂流瓶 v2 API 服务
class DriftBottleAPIService {
    static let shared = DriftBottleAPIService()
    private let apiManager = APIManager.shared

    private init() {}

    // MARK: - 地图瓶子（新增）

    /// 获取地图上的漂流瓶（用于地图显示）
    /// - Parameters:
    ///   - lat: 纬度
    ///   - lng: 经度
    ///   - radius: 半径（米）
    /// - Returns: 地图标记信息列表
    func getMapBottles(lat: Double, lng: Double, radius: Double = 2000) async throws -> [MapBottleInfo] {
        let response: MapBottlesResponse = try await apiManager.get(
            "/drift-bottles/map-markers",
            parameters: [
                "lat": lat,
                "lng": lng,
                "radius": radius / 1000  // 转换为公里
            ]
        )
        guard response.success else {
            throw NetworkError.serverError(response.message ?? "获取地图瓶子失败")
        }
        return response.data?.bottles ?? []
    }

    /// 获取漂流瓶详情（点击地图标记时使用）
    /// - Parameter bottleId: 瓶子ID
    /// - Returns: 完整的漂流瓶信息
    func getBottleDetails(bottleId: String) async throws -> DriftBottle {
        let response: DriftBottleResponse = try await apiManager.get("/drift-bottles/\(bottleId)")
        guard response.success, let bottle = response.data?.bottle else {
            throw NetworkError.serverError(response.message ?? "获取漂流瓶详情失败")
        }
        return bottle
    }

    // MARK: - 锁定瓶子（新增）

    /// 锁定漂流瓶（60秒有效期）
    /// - Parameters:
    ///   - bottleId: 瓶子ID
    ///   - lat: 当前纬度
    ///   - lng: 当前经度
    ///   - accuracy: GPS精度（米）
    /// - Returns: 锁定响应
    func lockBottle(bottleId: String, lat: Double, lng: Double, accuracy: Double?) async throws -> LockBottleResponse {
        var params: [String: Any] = [
            "lat": lat,
            "lng": lng
        ]
        if let acc = accuracy {
            params["accuracy"] = acc
        }

        let response: LockBottleResponse = try await apiManager.post(
            "/drift-bottles/\(bottleId)/lock",
            parameters: params
        )
        guard response.success else {
            throw NetworkError.serverError(response.message ?? "锁定失败")
        }
        return response
    }

    // MARK: - 放弃瓶子（新增）

    /// 放弃已锁定的瓶子（不消耗配额）
    /// - Parameter bottleId: 瓶子ID
    func abandonBottle(bottleId: String) async throws {
        let response: SimpleSuccessResponse = try await apiManager.post(
            "/drift-bottles/\(bottleId)/abandon",
            parameters: [:]
        )
        guard response.success else {
            throw NetworkError.serverError(response.message ?? "放弃失败")
        }
    }

    // MARK: - 扔出漂流瓶

    func throwBottle(lat: Double, lng: Double, message: String, pixelSnapshot: PixelSnapshot?) async throws -> DriftBottle {
        var params: [String: Any] = [
            "lat": lat,
            "lng": lng,
            "message": message
        ]
        if let snapshot = pixelSnapshot {
            params["pixel_snapshot"] = ["grid": snapshot.grid.map { row in row.map { $0 as Any } }]
        }

        let response: DriftBottleResponse = try await apiManager.post("/drift-bottles/throw", parameters: params)
        guard response.success, let bottle = response.data?.bottle else {
            let errorMsg = LocalizationHelper.localize(
                messageKey: response.messageKey,
                fallbackMessage: response.message ?? "创建漂流瓶失败"
            )
            throw NetworkError.serverError(errorMsg)
        }
        return bottle
    }

    // MARK: - 打开漂流瓶

    func openBottle(bottleId: String, lat: Double, lng: Double, message: String?) async throws -> OpenBottleResult {
        var params: [String: Any] = ["lat": lat, "lng": lng]
        if let msg = message {
            params["message"] = msg
        }

        let response: DriftBottleResponse = try await apiManager.post("/drift-bottles/\(bottleId)/open", parameters: params)
        guard response.success, let data = response.data, let bottle = data.bottle else {
            throw NetworkError.serverError(response.message ?? "打开漂流瓶失败")
        }
        return OpenBottleResult(
            bottle: bottle,
            didSink: data.didSink ?? false,
            journeyCard: data.journeyCard
        )
    }

    // MARK: - 检查遭遇

    func checkEncounter(lat: Double, lng: Double) async throws -> BottleEncounter {
        let response: EncounterResponse = try await apiManager.get(
            "/drift-bottles/encounter",
            parameters: ["lat": lat, "lng": lng]
        )
        guard response.success, let encounter = response.data else {
            return BottleEncounter(bottles: [], reunionBottle: nil)
        }
        return encounter
    }

    // MARK: - 获取配额

    func getQuota() async throws -> BottleQuota {
        let response: QuotaResponse = try await apiManager.get("/drift-bottles/quota")
        guard response.success, let quota = response.data else {
            throw NetworkError.serverError("获取配额失败")
        }
        return quota
    }

    // MARK: - 旅途卡片列表

    func getJourneyCards(page: Int = 1, limit: Int = 20) async throws -> JourneyCardsData {
        let response: JourneyCardsResponse = try await apiManager.get(
            "/drift-bottles/journey-cards",
            parameters: ["page": page, "limit": limit]
        )
        guard response.success, let data = response.data else {
            return JourneyCardsData(cards: [], pagination: nil)
        }
        return data
    }

    // MARK: - 旅途卡片详情

    func getJourneyCardDetail(bottleId: String) async throws -> JourneyCardDetail {
        let response: JourneyCardDetailResponse = try await apiManager.get("/drift-bottles/journey-cards/\(bottleId)")
        guard response.success, let detail = response.data else {
            throw NetworkError.serverError("获取旅途卡片详情失败")
        }
        return detail
    }

    // MARK: - 创建者重逢

    func reunionBottle(bottleId: String, lat: Double, lng: Double) async throws -> DriftBottle {
        let response: DriftBottleResponse = try await apiManager.post(
            "/drift-bottles/\(bottleId)/reunion",
            parameters: ["lat": lat, "lng": lng]
        )
        guard response.success, let bottle = response.data?.bottle else {
            throw NetworkError.serverError(response.message ?? "重逢失败")
        }
        return bottle
    }

    // MARK: - 标记已读

    func markCardRead(cardId: Int) async throws {
        let _: SimpleSuccessResponse = try await apiManager.put("/drift-bottles/journey-cards/\(cardId)/read")
    }

    // MARK: - 获取引导消息（新增）

    /// 获取用户的友好引导消息
    /// - Returns: 引导消息（如果有）
    func getGuidance() async throws -> GuidanceMessage? {
        let response: GuidanceResponse = try await apiManager.get("/drift-bottles/guidance")
        guard response.success else {
            return nil
        }
        return response.data
    }
}

// MARK: - Response Models

/// 地图瓶子响应
struct MapBottlesResponse: Codable {
    let success: Bool
    let messageKey: String?
    let message: String?
    let data: MapBottlesData?
}

struct MapBottlesData: Codable {
    let bottles: [MapBottleInfo]
}

/// 地图标记信息（轻量级，用于地图显示）
struct MapBottleInfo: Codable {
    let bottleId: String
    let lat: Double
    let lng: Double
    let distance: Double  // 距离（公里）

    enum CodingKeys: String, CodingKey {
        case bottleId = "bottle_id"
        case lat
        case lng
        case distance
    }
}

/// 锁定瓶子响应
struct LockBottleResponse: Codable {
    let success: Bool
    let messageKey: String?
    let message: String?
    let data: LockBottleData?
}

struct LockBottleData: Codable {
    let bottle: DriftBottle
    let lockExpireAt: String
    let lockDuration: Int

    enum CodingKeys: String, CodingKey {
        case bottle
        case lockExpireAt = "lock_expire_at"
        case lockDuration = "lock_duration"
    }
}

/// 引导消息响应
struct GuidanceResponse: Codable {
    let success: Bool
    let messageKey: String?
    let message: String?
    let data: GuidanceMessage?
}
