import Foundation
import Alamofire

/// 赛事活动服务
/// 负责从后端API获取活动数据、战况信息
class EventService {
    static let shared = EventService()
    private let apiManager = APIManager.shared
    
    private init() {}
    
    // MARK: - Models
    
    /// 赛事活动模型
    struct Event: Codable, Identifiable {
        let id: String
        let title: String
        let type: String // "flash_war", "rally", etc.
        let status: String
        let startTime: String
        let endTime: String
        let bannerUrl: String?
        let boundary: GeoJSONBoundary? // GeoJSON Polygon
        let config: EventConfig?
        let gameplay: EventGameplay? // P0-2: Gameplay template
        let isParticipant: Bool // Whether current user is registered for this event
        let signupStats: EventSignupStats? // P1-1: Signup statistics for upcoming events

        enum CodingKeys: String, CodingKey {
            case id, title, type, status, config, gameplay, isParticipant, signupStats
            case startTime = "startTime"
            case endTime = "endTime"
            case bannerUrl = "bannerUrl"
            case boundary = "boundary"
        }

        init(from decoder: Decoder) throws {
            let container = try decoder.container(keyedBy: CodingKeys.self)
            id = try container.decode(String.self, forKey: .id)
            title = try container.decode(String.self, forKey: .title)
            type = try container.decode(String.self, forKey: .type)
            status = try container.decode(String.self, forKey: .status)
            startTime = try container.decode(String.self, forKey: .startTime)
            endTime = try container.decode(String.self, forKey: .endTime)
            bannerUrl = try container.decodeIfPresent(String.self, forKey: .bannerUrl)
            boundary = try container.decodeIfPresent(GeoJSONBoundary.self, forKey: .boundary)
            config = try container.decodeIfPresent(EventConfig.self, forKey: .config)
            gameplay = try container.decodeIfPresent(EventGameplay.self, forKey: .gameplay)
            isParticipant = try container.decodeIfPresent(Bool.self, forKey: .isParticipant) ?? false
            signupStats = try container.decodeIfPresent(EventSignupStats.self, forKey: .signupStats)
        }

        /// Memberwise init for previews and tests
        init(id: String, title: String, type: String, status: String, startTime: String, endTime: String, bannerUrl: String? = nil, boundary: GeoJSONBoundary? = nil, config: EventConfig? = nil, gameplay: EventGameplay? = nil, isParticipant: Bool = false, signupStats: EventSignupStats? = nil) {
            self.id = id
            self.title = title
            self.type = type
            self.status = status
            self.startTime = startTime
            self.endTime = endTime
            self.bannerUrl = bannerUrl
            self.boundary = boundary
            self.config = config
            self.gameplay = gameplay
            self.isParticipant = isParticipant
            self.signupStats = signupStats
        }
    }

    /// Preview helper
    static func previewEvent() -> Event {
        Event(
            id: "1",
            title: "Territory War Season 2",
            type: "territory_control",
            status: "published",
            startTime: ISO8601DateFormatter().string(from: Date().addingTimeInterval(3600 * 2)),
            endTime: ISO8601DateFormatter().string(from: Date().addingTimeInterval(86400 * 7))
        )
    }
    
    /// GeoJSON 边界数据
    struct GeoJSONBoundary: Codable {
        let type: String
        let coordinates: [[[Double]]] // Polygon: array of rings, each ring is array of [lng, lat]
    }
    
    /// 活动配置
    struct EventConfig: Codable {
        let area: EventArea?
        let areaSize: Double?
        let requirements: EventRequirements?
        let rules: EventRules?
        let rewards: [EventReward]?          // 简单奖励格式（新）
        let rewardsConfig: EventRewards?     // 详细奖励格式（用于展示）
    }

    struct EventArea: Codable {
        let type: String
        let center: EventCenter?
        let radius: Int?
        let name: String?
    }

    struct EventCenter: Codable {
        let lat: Double
        let lng: Double
    }

    struct EventRequirements: Codable {
        let minLevel: Int?
        let minAlliances: Int?
        let minParticipants: Int?
    }

    struct EventReward: Codable {
        let rank: Int
        let type: String
        let amount: Int
        let description: String
    }
    
    struct EventRules: Codable {
        let pixelScore: Int?
        let maxAlliances: Int?
        let minParticipants: Int?
    }
    
    struct EventRewards: Codable {
        let rankingRewards: [RankingRewardTier]?
        let participationReward: RewardDetail?
    }
    
    struct RankingRewardTier: Codable {
        let rankMin: Int
        let rankMax: Int
        let target: String // "alliance_members", "user"
        let rewards: RewardDetail
        
        enum CodingKeys: String, CodingKey {
            case target, rewards
            case rankMin = "rank_min"
            case rankMax = "rank_max"
        }
        
        init(rankMin: Int, rankMax: Int, target: String, rewards: RewardDetail) {
            self.rankMin = rankMin
            self.rankMax = rankMax
            self.target = target
            self.rewards = rewards
        }
    }
    
    struct RewardDetail: Codable {
        let title: String?
        let points: Int?
        let chest: String?
        let pixels: Int?
        let exclusiveFlag: String?
        
        enum CodingKeys: String, CodingKey {
            case title, points, chest, pixels, exclusiveFlag
        }
        
        init(title: String? = nil, points: Int? = nil, chest: String? = nil, pixels: Int? = nil, exclusiveFlag: String? = nil) {
            self.title = title
            self.points = points
            self.chest = chest
            self.pixels = pixels
            self.exclusiveFlag = exclusiveFlag
        }
    }
    
    struct MVPReward: Codable {
        let topN: Int?
        let reward: RewardDetail?
        
        init(from decoder: Decoder) throws {
            let container = try? decoder.container(keyedBy: CodingKeys.self)
            self.topN = try? container?.decodeIfPresent(Int.self, forKey: .topN)
            self.reward = try? container?.decodeIfPresent(RewardDetail.self, forKey: .reward)
        }
    }
    
    /// 活动实时排行榜信息
    struct RankingInfo: Codable {
        let eventId: String
        let totalPixels: Int
        let alliances: [TerritoryWarHUD.AllianceScore]
        
        enum CodingKeys: String, CodingKey {
            case eventId, totalPixels, alliances
        }
    }
    
    /// 排行榜响应
    struct RankingsResponse: Codable {
        let success: Bool
        let data: RankingInfo
    }
    
    /// 活动列表响应
    struct ActiveEventsResponse: Codable {
        let success: Bool
        let data: [Event]
        let message: String?
    }
    
    /// 用户在活动中的状态
    struct UserEventStatus: Codable {
        let signedUp: Bool
        let type: String? // "user" or "alliance"
        let allianceId: String?
        let joinedAt: String?
    }
    
    struct StatusResponse: Codable {
        let success: Bool
        let data: UserEventStatus
    }
    
    struct SignupResponse: Codable {
        let success: Bool
        let message: String?
    }
    
    // MARK: - API Calls
    
    /// 获取当前生效的活动 (含预热期)
    /// GET /api/events/active
    func getActiveEvents() async throws -> [Event] {
        let path = "/events/active"
        guard let url = URL(string: "\(APIEndpoint.baseURL)\(path)") else { throw NetworkError.invalidURL }
        
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        if let token = AuthManager.shared.getAccessToken() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        
        let response: ActiveEventsResponse = try await apiManager.performRequest(request)
        return response.data
    }
    
    /// 获取特定活动的初始实时排行榜
    /// GET /api/events/:id/rankings
    func getEventRankings(eventId: String) async throws -> RankingInfo {
        let path = "/events/\(eventId)/rankings"
        guard let url = URL(string: "\(APIEndpoint.baseURL)\(path)") else { throw NetworkError.invalidURL }
        
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        if let token = AuthManager.shared.getAccessToken() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        
        let response: RankingsResponse = try await apiManager.performRequest(request)
        return response.data
    }
    
    /// 用户报名参加活动
    /// POST /api/events/:id/signup
    func signup(eventId: String, type: String = "user", participantId: String? = nil) async throws -> Bool {
        let path = "/events/\(eventId)/signup"
        guard let url = URL(string: "\(APIEndpoint.baseURL)\(path)") else { throw NetworkError.invalidURL }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let token = AuthManager.shared.getAccessToken() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        
        let body: [String: Any] = [
            "type": type,
            "participantId": participantId as Any
        ]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        let response: SignupResponse = try await apiManager.performRequest(request)
        return response.success
    }
    
    /// 获取用户在活动中的报名状态
    /// GET /api/events/:id/my-status
    func getMyStatus(eventId: String) async throws -> UserEventStatus {
        let path = "/events/\(eventId)/my-status"
        guard let url = URL(string: "\(APIEndpoint.baseURL)\(path)") else { throw NetworkError.invalidURL }

        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        if let token = AuthManager.shared.getAccessToken() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        let response: StatusResponse = try await apiManager.performRequest(request)
        return response.data
    }

    // MARK: - P0 Event Optimization APIs

    /// P0-1: 获取活动报名统计
    /// GET /api/events/:id/signup-stats
    func getSignupStats(eventId: String) async throws -> EventSignupStats {
        let path = "/events/\(eventId)/signup-stats"
        guard let url = URL(string: "\(APIEndpoint.baseURL)\(path)") else { throw NetworkError.invalidURL }

        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        if let token = AuthManager.shared.getAccessToken() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        let response: SignupStatsResponse = try await apiManager.performRequest(request)
        return response.data
    }

    /// P0-3: 获取个人活动贡献统计
    /// GET /api/events/:id/my-contribution
    func getMyContribution(eventId: String) async throws -> EventContribution {
        let path = "/events/\(eventId)/my-contribution"
        guard let url = URL(string: "\(APIEndpoint.baseURL)\(path)") else { throw NetworkError.invalidURL }

        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        if let token = AuthManager.shared.getAccessToken() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        let response: ContributionResponse = try await apiManager.performRequest(request)
        return response.data
    }

    // MARK: - Extended Models for Event Center

    /// 用户参与的活动（带额外信息）
    struct UserEvent: Codable, Identifiable {
        let id: String
        let title: String
        let type: String
        let status: String
        let startTime: String
        let endTime: String
        let bannerUrl: String?
        let joinedAt: String?
        let participantType: String?
    }

    /// 用户活动列表响应
    struct UserEventsResponse: Codable {
        let success: Bool
        let data: UserEventsData
    }

    struct UserEventsData: Codable {
        let list: [UserEvent]
        let total: Int
        let page: Int
        let pageSize: Int
    }

    /// 活动结果
    struct EventResult: Codable {
        let event: EventBasicInfo
        let rankings: [TerritoryWarHUD.AllianceScore]
        let totalPixels: Int
        let participantCount: Int
        let pixelLogCount: Int
        let settled: Bool
        let settledAt: String?
        let rewardsConfig: [RankingRewardTier]?
    }

    struct EventBasicInfo: Codable {
        let id: String
        let title: String
        let type: String
        let status: String
        let startTime: String?
        let endTime: String?

        enum CodingKeys: String, CodingKey {
            case id, title, type, status
            case startTime = "start_time"
            case endTime = "end_time"
        }
    }

    struct EventResultResponse: Codable {
        let success: Bool
        let data: EventResult
    }

    /// 单个活动详情响应
    struct EventDetailResponse: Codable {
        let success: Bool
        let data: Event
    }

    // MARK: - Extended API Calls

    /// 获取用户参与的活动列表
    /// GET /api/events/my-events
    func getMyEvents(page: Int = 1, pageSize: Int = 20, status: String? = nil) async throws -> UserEventsData {
        var path = "/events/my-events?page=\(page)&pageSize=\(pageSize)"
        if let status = status {
            path += "&status=\(status)"
        }
        guard let url = URL(string: "\(APIEndpoint.baseURL)\(path)") else { throw NetworkError.invalidURL }

        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        if let token = AuthManager.shared.getAccessToken() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        let response: UserEventsResponse = try await apiManager.performRequest(request)
        return response.data
    }

    /// 获取用户参与的已结束活动
    /// GET /api/events/ended
    func getEndedEvents(page: Int = 1, pageSize: Int = 20) async throws -> UserEventsData {
        let path = "/events/ended?page=\(page)&pageSize=\(pageSize)"
        guard let url = URL(string: "\(APIEndpoint.baseURL)\(path)") else { throw NetworkError.invalidURL }

        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        if let token = AuthManager.shared.getAccessToken() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        let response: UserEventsResponse = try await apiManager.performRequest(request)
        return response.data
    }

    /// 获取活动结果（最终排名和奖励）
    /// GET /api/events/:id/result
    func getEventResult(eventId: String) async throws -> EventResult {
        let path = "/events/\(eventId)/result"
        guard let url = URL(string: "\(APIEndpoint.baseURL)\(path)") else { throw NetworkError.invalidURL }

        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        if let token = AuthManager.shared.getAccessToken() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        let response: EventResultResponse = try await apiManager.performRequest(request)
        return response.data
    }

    /// 获取单个活动详情
    /// GET /api/events/:id
    func getEventDetail(eventId: String) async throws -> Event {
        let path = "/events/\(eventId)"
        guard let url = URL(string: "\(APIEndpoint.baseURL)\(path)") else { throw NetworkError.invalidURL }

        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        if let token = AuthManager.shared.getAccessToken() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        let response: EventDetailResponse = try await apiManager.performRequest(request)
        return response.data
    }

    /// P1-4: Get ranking history for trend analysis
    /// GET /api/events/:id/ranking-history?hours=24
    func getRankingHistory(eventId: String, hours: Int = 24) async throws -> [RankingSnapshot] {
        let path = "/events/\(eventId)/ranking-history?hours=\(hours)"
        guard let url = URL(string: "\(APIEndpoint.baseURL)\(path)") else { throw NetworkError.invalidURL }

        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        if let token = AuthManager.shared.getAccessToken() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        let response: RankingHistoryResponse = try await apiManager.performRequest(request)
        return response.data.history
    }

    /// P2-1: Generate invite link for event
    /// POST /api/events/:id/generate-invite
    func generateInviteLink(eventId: String) async throws -> String {
        let path = "/events/\(eventId)/generate-invite"
        guard let url = URL(string: "\(APIEndpoint.baseURL)\(path)") else { throw NetworkError.invalidURL }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        if let token = AuthManager.shared.getAccessToken() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        struct InviteLinkResponse: Codable {
            let success: Bool
            let data: InviteLinkData
        }

        struct InviteLinkData: Codable {
            let inviteLink: String
            let inviteCode: String
            let eventId: String

            enum CodingKeys: String, CodingKey {
                case inviteLink = "invite_link"
                case inviteCode = "invite_code"
                case eventId = "event_id"
            }
        }

        let response: InviteLinkResponse = try await apiManager.performRequest(request)
        return response.data.inviteLink
    }

    /// P2-1: Record share action
    /// POST /api/events/:id/record-share
    func recordShare(eventId: String, platform: String) async throws {
        let path = "/events/\(eventId)/record-share"
        guard let url = URL(string: "\(APIEndpoint.baseURL)\(path)") else { throw NetworkError.invalidURL }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let token = AuthManager.shared.getAccessToken() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        let body = ["platform": platform]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        struct ShareResponse: Codable {
            let success: Bool
            let message: String?
        }

        let _: ShareResponse = try await apiManager.performRequest(request)
    }
}
