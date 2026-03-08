import Foundation
import Alamofire

/// 用户Profile服务
/// 负责从后端API获取用户详细信息和统计数据
class ProfileService {
    static let shared = ProfileService()
    private let apiManager = APIManager.shared

    private init() {}

    // MARK: - 用户资料响应

    /// 用户资料响应
    struct UserProfileResponse: Codable {
        let success: Bool
        let user: UserProfile
        let alliance: UserAlliance?
        let is_following: Bool?
        let is_liked: Bool?
        let followers_count: Int?
        let following_count: Int?
        let likes_count: Int?
        let message: String?

        struct UserProfile: Codable {
            let id: String
            let username: String
            let email: String?
            let phone: String?
            let avatar_url: String?
            let avatar: String?
            let motto: String?
            let points: Int?
            let total_pixels: Int?
            let created_at: String?
            let updated_at: String?
            let display_name: String?
            let alliance: UserAlliance?
            let rankTier: RankTier?
            let equipped_cosmetics: EquippedCosmetics?

            var displayName: String {
                display_name ?? username
            }
        }

        struct UserAlliance: Codable {
            let id: String
            let name: String
            let description: String?
            let flag: String?
            let flag_pattern_id: String?
            let color: String?
            let role: String?
            let joined_at: String?

            init(from decoder: Decoder) throws {
                let container = try decoder.container(keyedBy: CodingKeys.self)
                // id can be Int or String from backend
                if let intId = try? container.decode(Int.self, forKey: .id) {
                    id = String(intId)
                } else {
                    id = try container.decode(String.self, forKey: .id)
                }
                name = try container.decode(String.self, forKey: .name)
                description = try container.decodeIfPresent(String.self, forKey: .description)
                flag = try container.decodeIfPresent(String.self, forKey: .flag)
                flag_pattern_id = try container.decodeIfPresent(String.self, forKey: .flag_pattern_id)
                color = try container.decodeIfPresent(String.self, forKey: .color)
                role = try container.decodeIfPresent(String.self, forKey: .role)
                joined_at = try container.decodeIfPresent(String.self, forKey: .joined_at)
            }
        }
    }

    /// 用户统计响应
    struct UserStatsResponse: Codable {
        let success: Bool
        let stats: UserStats
        let message: String?

        struct UserStats: Codable {
            let total_pixels: Int
            let drawing_time_minutes: Int?
            let sessions_count: Int?
            let rank: Int?
            let pixels_this_week: Int?
            let pixels_this_month: Int?
            let current_pixels: Int?
            let points: Int?
            let account_age: Int?
        }
    }

    // MARK: - 获取用户资料

    /// 获取用户详细资料
    func getUserProfile(userId: String) async throws -> UserProfileResponse {
        // 使用 /api/profile/:userId 端点
        let baseURLString = "\(APIEndpoint.baseURL)/profile/\(userId)"
        guard let url = URL(string: baseURLString) else {
            throw NetworkError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = "GET"

        if let token = AuthManager.shared.getAccessToken() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        return try await apiManager.performRequest(request)
    }

    // MARK: - 获取用户统计

    /// 获取用户统计信息
    func getUserStats() async throws -> UserStatsResponse {
        // 使用 /api/profile/stats/me 端点
        let baseURLString = "\(APIEndpoint.baseURL)/profile/stats/me"
        guard let url = URL(string: baseURLString) else {
            throw NetworkError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = "GET"

        if let token = AuthManager.shared.getAccessToken() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        return try await apiManager.performRequest(request)
    }

    // MARK: - 更新用户资料

    /// 更新用户资料
    func updateProfile(parameters: [String: Any]) async throws -> UserProfileResponse {
        // 使用 /api/profile/update 端点
        let baseURLString = "\(APIEndpoint.baseURL)/profile/update"
        guard let url = URL(string: baseURLString) else {
            throw NetworkError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = "PUT"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        if let token = AuthManager.shared.getAccessToken() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        request.httpBody = try? JSONSerialization.data(withJSONObject: parameters)

        return try await apiManager.performRequest(request)
    }

    // MARK: - 关注/取消关注

    /// 关注用户
    func followUser(userId: String) async throws -> Bool {
        let baseURLString = "\(APIEndpoint.baseURL)/profile/follow/\(userId)"
        guard let url = URL(string: baseURLString) else {
            throw NetworkError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"

        if let token = AuthManager.shared.getAccessToken() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        struct FollowResponse: Codable {
            let success: Bool
            let message: String?
        }

        let response: FollowResponse = try await apiManager.performRequest(request)
        if response.success {
            Task { await AchievementService.shared.checkAndNotify() }
        }
        return response.success
    }

    /// 取消关注用户
    func unfollowUser(userId: String) async throws -> Bool {
        let baseURLString = "\(APIEndpoint.baseURL)/profile/unfollow/\(userId)"
        guard let url = URL(string: baseURLString) else {
            throw NetworkError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = "DELETE"

        if let token = AuthManager.shared.getAccessToken() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        struct FollowResponse: Codable {
            let success: Bool
            let message: String?
        }

        let response: FollowResponse = try await apiManager.performRequest(request)
        return response.success
    }

    // MARK: - 点赞用户

    /// 点赞用户
    func likeUser(userId: String) async throws -> Bool {
        let baseURLString = "\(APIEndpoint.baseURL)/profile/like/\(userId)"
        guard let url = URL(string: baseURLString) else {
            throw NetworkError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"

        if let token = AuthManager.shared.getAccessToken() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        struct LikeResponse: Codable {
            let success: Bool
            let message: String?
        }

        let response: LikeResponse = try await apiManager.performRequest(request)
        if response.success {
            Task { await AchievementService.shared.checkAndNotify() }
        }
        return response.success
    }

    /// 取消点赞用户
    func unlikeUser(userId: String) async throws -> Bool {
        let baseURLString = "\(APIEndpoint.baseURL)/profile/unlike/\(userId)"
        guard let url = URL(string: baseURLString) else {
            throw NetworkError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = "DELETE"

        if let token = AuthManager.shared.getAccessToken() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        struct LikeResponse: Codable {
            let success: Bool
            let message: String?
        }

        let response: LikeResponse = try await apiManager.performRequest(request)
        return response.success
    }

    // MARK: - 删除账号

    /// 删除用户账号
    func deleteAccount() async throws -> Bool {
        let baseURLString = "\(APIEndpoint.baseURL)/profile/account"
        guard let url = URL(string: baseURLString) else {
            throw NetworkError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = "DELETE"

        if let token = AuthManager.shared.getAccessToken() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        struct DeleteResponse: Codable {
            let success: Bool
            let message: String?
        }

        let response: DeleteResponse = try await apiManager.performRequest(request)
        return response.success
    }
}
