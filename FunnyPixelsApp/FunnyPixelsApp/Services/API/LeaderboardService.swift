import Foundation
import Alamofire

/// 排行榜服务
/// 负责从后端API获取排行榜数据
class LeaderboardService {
    static let shared = LeaderboardService()
    private let apiManager = APIManager.shared

    private init() {}

    /// 排行榜时间段
    enum Period: String, CaseIterable {
        case daily = "daily"
        case weekly = "weekly"
        case monthly = "monthly"
        case allTime = "allTime"

        var displayName: String {
            switch self {
            case .daily: return NSLocalizedString("leaderboard.period.day", comment: "Day")
            case .weekly: return NSLocalizedString("leaderboard.period.week", comment: "Week")
            case .monthly: return NSLocalizedString("leaderboard.period.month", comment: "Month")
            case .allTime: return NSLocalizedString("leaderboard.period.alltime", comment: "All Time")
            }
        }
    }

    /// 排行榜响应
    struct LeaderboardResponse: Codable {
        let success: Bool
        let data: LeaderboardData?
        let cached: Bool?
        let message: String?

        struct LeaderboardData: Codable {
            let period: String
            let data: [LeaderboardEntry]
            let myRank: MyRank?
            let pagination: Pagination?
            let totalFriends: Int?

            struct Pagination: Codable {
                let limit: Int
                let offset: Int
                let total: Int
            }
        }
    }

    /// 城市榜响应
    struct CityLeaderboardResponse: Codable {
        let success: Bool
        let data: CityLeaderboardData?
        let cached: Bool?
        let message: String?

        struct CityLeaderboardData: Codable {
            let period: String
            let data: [CityLeaderboardEntry]
            let pagination: Pagination?

            struct Pagination: Codable {
                let limit: Int
                let offset: Int
                let total: Int
            }
        }
    }

    /// 个人排名信息
    struct MyRank: Codable {
        let rank: Int
        let totalPixels: Int
        let gapToNext: Int
        let percentile: Double
        let rankTier: RankTier?
    }

    /// 排行榜条目（个人榜/联盟榜）
    struct LeaderboardEntry: Codable, Identifiable {
        let userId: String  // user_id 或 alliance_id - 使用user_id作为备选
        let rank: Int
        let username: String?
        let display_name: String?
        let avatar_url: String?
        let avatar: String?
        let total_pixels: Int
        let alliance_id: String?
        let alliance_name: String?
        let flag_color: String?
        let flag_pattern: String?
        let points: Int?
        let is_current_user: Bool?
        let flag_pattern_id: String?
        let pattern_type: String?  // render_type from pattern_assets: "color"/"emoji"/"complex"
        let unicode_char: String?  // emoji character for emoji-type patterns
        let rankTier: RankTier?    // 段位信息
        let previousRank: Int?     // 上次排名
        let rankChange: Int?       // 排名变化 (正数=上升, 负数=下降)
        let isMutual: Bool?        // 是否互相关注（好友榜用）

        // 用于Identifiable - 确保唯一性
        var id: String {
            "\(rank)_\(userId)"  // 组合rank和userId确保唯一
        }

        // 显示名称
        var displayName: String {
            display_name ?? username ?? alliance_name ?? "未知"
        }

        // 头像颜色
        var avatarColor: String {
            flag_color ?? "#4ECDC4"
        }

        enum CodingKeys: String, CodingKey {
            case id, rank, username, display_name, avatar_url, avatar, total_pixels, alliance_id, alliance_name, flag_color, flag_pattern, points, is_current_user
            case user_id
            case flag_pattern_id
            case pattern_id
            case alliance_flag
            case color
            case avatarUrl
            case pattern_type
            case unicode_char
            case rankTier
            case previousRank = "previous_rank"
            case rankChange = "rank_change"
            case isMutual = "is_mutual"
        }

        // 自定义init以处理后端返回user_id的情况
        init(from decoder: Decoder) throws {
            let container = try decoder.container(keyedBy: CodingKeys.self)
            rank = try container.decode(Int.self, forKey: .rank)
            username = try? container.decodeIfPresent(String.self, forKey: .username)
            display_name = try? container.decodeIfPresent(String.self, forKey: .display_name)
            
            // Try different avatar URL keys
            if let url = try? container.decodeIfPresent(String.self, forKey: .avatar_url) {
                avatar_url = url
            } else {
                avatar_url = try? container.decodeIfPresent(String.self, forKey: .avatarUrl)
            }
            
            avatar = try? container.decodeIfPresent(String.self, forKey: .avatar)

            total_pixels = try container.decode(Int.self, forKey: .total_pixels)
            alliance_id = try? container.decodeIfPresent(String.self, forKey: .alliance_id)
            alliance_name = try? container.decodeIfPresent(String.self, forKey: .alliance_name)
            
            // Try decoding flag color from multiple keys
            if let color = try? container.decodeIfPresent(String.self, forKey: .flag_color) {
                flag_color = color
            } else {
                flag_color = try? container.decodeIfPresent(String.self, forKey: .color)
            }
            
            // Try decoding flag pattern from multiple keys
            if let pattern = try? container.decodeIfPresent(String.self, forKey: .flag_pattern) {
                flag_pattern = pattern
            } else if let patternId = try? container.decodeIfPresent(String.self, forKey: .flag_pattern_id) {
                flag_pattern = patternId
            } else if let patternId = try? container.decodeIfPresent(String.self, forKey: .pattern_id) {
                flag_pattern = patternId
            } else {
                flag_pattern = try? container.decodeIfPresent(String.self, forKey: .alliance_flag)
            }
            
            points = try? container.decodeIfPresent(Int.self, forKey: .points)
            is_current_user = try? container.decodeIfPresent(Bool.self, forKey: .is_current_user)
            flag_pattern_id = try? container.decodeIfPresent(String.self, forKey: .flag_pattern_id)
            pattern_type = try? container.decodeIfPresent(String.self, forKey: .pattern_type)
            unicode_char = try? container.decodeIfPresent(String.self, forKey: .unicode_char)
            rankTier = try? container.decodeIfPresent(RankTier.self, forKey: .rankTier)
            previousRank = try? container.decodeIfPresent(Int.self, forKey: .previousRank)
            rankChange = try? container.decodeIfPresent(Int.self, forKey: .rankChange)
            isMutual = try? container.decodeIfPresent(Bool.self, forKey: .isMutual)

            // 处理id字段，可能是id或user_id
            if let idValue = try? container.decodeIfPresent(String.self, forKey: .id), !idValue.isEmpty {
                userId = idValue
            } else if let userIdValue = try? container.decodeIfPresent(String.self, forKey: .user_id), !userIdValue.isEmpty {
                userId = userIdValue
            } else {
                userId = UUID().uuidString
            }
            
            // Diagnostic logging for avatars
            if let avatarData = avatar, !avatarData.isEmpty {
                Logger.debug("📦 LeaderboardEntry [\(displayName)]: Avatar data length = \(avatarData.count)")
            }
            if let avatarUrl = avatar_url, !avatarUrl.isEmpty {
                Logger.debug("📦 LeaderboardEntry [\(displayName)]: Avatar URL = \(avatarUrl)")
            }
        }

        func encode(to encoder: Encoder) throws {
            var container = encoder.container(keyedBy: CodingKeys.self)
            try container.encode(userId, forKey: .id)
            try container.encode(rank, forKey: .rank)
            try container.encodeIfPresent(username, forKey: .username)
            try container.encodeIfPresent(display_name, forKey: .display_name)
            try container.encodeIfPresent(avatar_url, forKey: .avatar_url)
            try container.encodeIfPresent(avatar, forKey: .avatar)
            try container.encode(total_pixels, forKey: .total_pixels)
            try container.encodeIfPresent(alliance_id, forKey: .alliance_id)
            try container.encodeIfPresent(alliance_name, forKey: .alliance_name)
            try container.encodeIfPresent(flag_color, forKey: .flag_color)
            try container.encodeIfPresent(flag_pattern, forKey: .flag_pattern)
            try container.encodeIfPresent(points, forKey: .points)
            try container.encodeIfPresent(is_current_user, forKey: .is_current_user)
            try container.encodeIfPresent(flag_pattern_id, forKey: .flag_pattern_id)
            try container.encodeIfPresent(pattern_type, forKey: .pattern_type)
            try container.encodeIfPresent(unicode_char, forKey: .unicode_char)
            try container.encodeIfPresent(rankTier, forKey: .rankTier)
            try container.encodeIfPresent(previousRank, forKey: .previousRank)
            try container.encodeIfPresent(rankChange, forKey: .rankChange)
            try container.encodeIfPresent(isMutual, forKey: .isMutual)
        }
    }

    /// 城市榜条目
    struct CityLeaderboardEntry: Codable, Identifiable {
        let cityId: String  // city_name
        let rank: Int
        let city_name: String
        let country_code: String?
        let total_pixels: Int
        let total_users: Int
        let center_lat: Double?
        let center_lng: Double?

        // 用于Identifiable - 确保唯一性
        var id: String {
            "\(rank)_\(cityId)"  // 组合rank和cityId确保唯一
        }

        enum CodingKeys: String, CodingKey {
            case cityId = "id"
            case rank, city_name, country_code, total_pixels, total_users, center_lat, center_lng
            // 添加额外的字段名映射（用于支持不同的JSON字段名）
            case region_code
            case user_count
        }

        // MARK: - 自定义解码器，支持多种字段名映射
        init(from decoder: Decoder) throws {
            let container = try decoder.container(keyedBy: CodingKeys.self)

            // 解析 id (可选字段 - 缓存数据可能不包含 id，降级为 city_name)
            if let id = try? container.decode(String.self, forKey: .cityId) {
                cityId = id
            } else {
                cityId = try container.decode(String.self, forKey: .city_name)
            }

            // 解析 rank (必需字段）
            rank = try container.decode(Int.self, forKey: .rank)

            // 解析 city_name (必需字段）
            city_name = try container.decode(String.self, forKey: .city_name)

            // 解析 country_code (可选字段，支持 region_code 别名)
            if let countryCode = try? container.decodeIfPresent(String.self, forKey: .country_code), !countryCode.isEmpty {
                country_code = countryCode
            } else if let regionCode = try? container.decodeIfPresent(String.self, forKey: .region_code), !regionCode.isEmpty {
                country_code = regionCode
            } else {
                country_code = nil
            }

            // 解析 total_pixels (必需字段）
            total_pixels = try container.decode(Int.self, forKey: .total_pixels)

            // 解析 total_users (必需字段，支持 user_count 别名)
            if let totalUsers = try? container.decodeIfPresent(Int.self, forKey: .total_users) {
                total_users = totalUsers
            } else if let userCount = try? container.decodeIfPresent(Int.self, forKey: .user_count) {
                total_users = userCount
            } else {
                total_users = 0
            }

            // 解析 center_lat (可选字段)
            center_lat = try? container.decodeIfPresent(Double.self, forKey: .center_lat)

            // 解析 center_lng (可选字段)
            center_lng = try? container.decodeIfPresent(Double.self, forKey: .center_lng)
        }

        // MARK: - 自定义编码器
        func encode(to encoder: Encoder) throws {
            var container = encoder.container(keyedBy: CodingKeys.self)
            try container.encode(cityId, forKey: .cityId)
            try container.encode(rank, forKey: .rank)
            try container.encode(city_name, forKey: .city_name)
            try container.encodeIfPresent(country_code, forKey: .country_code)
            try container.encode(total_pixels, forKey: .total_pixels)
            try container.encode(total_users, forKey: .total_users)
            try container.encodeIfPresent(center_lat, forKey: .center_lat)
            try container.encodeIfPresent(center_lng, forKey: .center_lng)
        }
    }

    /// 聚合排行榜响应（一次请求返回所有类型）
    struct AllLeaderboardsResponse: Codable {
        let success: Bool
        let data: AllLeaderboardsData?
        let message: String?

        struct AllLeaderboardsData: Codable {
            let personal: LeaderboardResponse.LeaderboardData?
            let friends: LeaderboardResponse.LeaderboardData?
            let alliance: LeaderboardResponse.LeaderboardData?
            let city: CityLeaderboardResponse.CityLeaderboardData?
        }
    }

    // MARK: - 聚合接口

    /// 一次请求获取所有排行榜数据（个人+好友+联盟+城市）
    /// - Parameters:
    ///   - period: 时间周期
    ///   - limit: 每页条数
    ///   - forceRefresh: true 时绕过 HTTP 缓存（用于下拉刷新）
    func getAllLeaderboards(period: Period = .daily, limit: Int = 50, forceRefresh: Bool = false) async throws -> AllLeaderboardsResponse {
        let baseURLString = "\(APIEndpoint.baseURL)/leaderboard/all"
        guard let url = URL(string: baseURLString) else {
            throw NetworkError.invalidURL
        }

        var components = URLComponents(url: url, resolvingAgainstBaseURL: false)!
        components.queryItems = [
            URLQueryItem(name: "period", value: period.rawValue),
            URLQueryItem(name: "limit", value: String(limit)),
            URLQueryItem(name: "offset", value: "0")
        ]

        guard let finalURL = components.url else {
            throw NetworkError.invalidURL
        }

        var request = URLRequest(url: finalURL)
        request.httpMethod = "GET"

        // 下拉刷新时绕过 URLSession HTTP 缓存，强制从服务器获取最新数据
        if forceRefresh {
            request.cachePolicy = .reloadIgnoringLocalCacheData
        }

        if let token = AuthManager.shared.getAccessToken() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        return try await apiManager.performRequest(request)
    }

    // MARK: - 个人榜

    /// 获取个人排行榜
    func getPersonalLeaderboard(period: Period = .daily, limit: Int = 50, offset: Int = 0) async throws -> LeaderboardResponse {
        // 使用已有的API端点
        let endpoint = APIEndpoint.getPersonalLeaderboard
        let url = endpoint.url

        // 添加查询参数
        var components = URLComponents(url: url, resolvingAgainstBaseURL: false)!
        components.queryItems = [
            URLQueryItem(name: "period", value: period.rawValue),
            URLQueryItem(name: "limit", value: String(limit)),
            URLQueryItem(name: "offset", value: String(offset))
        ]

        guard let finalURL = components.url else {
            throw NetworkError.invalidURL
        }

        var request = URLRequest(url: finalURL)
        request.httpMethod = endpoint.method.rawValue

        // 添加认证token
        if let token = AuthManager.shared.getAccessToken() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        return try await apiManager.performRequest(request)
    }

    // MARK: - 联盟榜

    /// 获取联盟排行榜
    func getAllianceLeaderboard(period: Period = .daily, limit: Int = 50, offset: Int = 0) async throws -> LeaderboardResponse {
        let endpoint = APIEndpoint.getAllianceLeaderboard
        let url = endpoint.url

        var components = URLComponents(url: url, resolvingAgainstBaseURL: false)!
        components.queryItems = [
            URLQueryItem(name: "period", value: period.rawValue),
            URLQueryItem(name: "limit", value: String(limit)),
            URLQueryItem(name: "offset", value: String(offset))
        ]

        guard let finalURL = components.url else {
            throw NetworkError.invalidURL
        }

        var request = URLRequest(url: finalURL)
        request.httpMethod = endpoint.method.rawValue

        if let token = AuthManager.shared.getAccessToken() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        return try await apiManager.performRequest(request)
    }

    // MARK: - 城市榜

    /// 获取城市排行榜（使用region端点，指定city类型）
    func getCityLeaderboard(period: Period = .daily, limit: Int = 50, offset: Int = 0) async throws -> CityLeaderboardResponse {
        // 后端使用 /leaderboard/city 端点
        let baseURLString = "\(APIEndpoint.baseURL)/leaderboard/city"
        guard let url = URL(string: baseURLString) else {
            throw NetworkError.invalidURL
        }

        var components = URLComponents(url: url, resolvingAgainstBaseURL: false)!
        components.queryItems = [
            URLQueryItem(name: "period", value: period.rawValue),
            URLQueryItem(name: "limit", value: String(limit)),
            URLQueryItem(name: "offset", value: String(offset))
        ]

        guard let finalURL = components.url else {
            throw NetworkError.invalidURL
        }

        var request = URLRequest(url: finalURL)
        request.httpMethod = "GET"

        if let token = AuthManager.shared.getAccessToken() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        return try await apiManager.performRequest(request)
    }

    // MARK: - 好友榜

    /// 获取好友排行榜
    func getFriendsLeaderboard(period: Period = .weekly, limit: Int = 50, offset: Int = 0) async throws -> LeaderboardResponse {
        let endpoint = APIEndpoint.getFriendsLeaderboard
        let url = endpoint.url

        var components = URLComponents(url: url, resolvingAgainstBaseURL: false)!
        components.queryItems = [
            URLQueryItem(name: "period", value: period.rawValue),
            URLQueryItem(name: "limit", value: String(limit)),
            URLQueryItem(name: "offset", value: String(offset))
        ]

        guard let finalURL = components.url else {
            throw NetworkError.invalidURL
        }

        var request = URLRequest(url: finalURL)
        request.httpMethod = endpoint.method.rawValue

        if let token = AuthManager.shared.getAccessToken() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        return try await apiManager.performRequest(request)
    }

    // MARK: - 点赞功能

    /// 点赞排行榜项目
    func likeLeaderboardItem(type: String, itemId: String) async throws -> Bool {
        let endpoint = APIEndpoint.likeLeaderboard
        let url = endpoint.url

        var request = URLRequest(url: url)
        request.httpMethod = endpoint.method.rawValue
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        if let token = AuthManager.shared.getAccessToken() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        let parameters: [String: Any] = [
            "type": type,
            "item_id": itemId
        ]

        request.httpBody = try? JSONSerialization.data(withJSONObject: parameters)

        struct LikeResponse: Codable {
            let success: Bool
            let message: String?
        }

        let response: LikeResponse = try await apiManager.performRequest(request)
        return response.success
    }

    /// 取消点赞
    func unlikeLeaderboardItem(type: String, itemId: String) async throws -> Bool {
        let endpoint = APIEndpoint.unlikeLeaderboard
        let url = endpoint.url

        var components = URLComponents(url: url, resolvingAgainstBaseURL: false)!
        components.queryItems = [
            URLQueryItem(name: "type", value: type),
            URLQueryItem(name: "item_id", value: itemId)
        ]

        guard let finalURL = components.url else {
            throw NetworkError.invalidURL
        }

        var request = URLRequest(url: finalURL)
        request.httpMethod = endpoint.method.rawValue

        if let token = AuthManager.shared.getAccessToken() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        struct UnlikeResponse: Codable {
            let success: Bool
            let message: String?
        }

        let response: UnlikeResponse = try await apiManager.performRequest(request)
        return response.success
    }
}

