import Foundation

/// Badge 聚合 API 服务
class BadgeService {
    static let shared = BadgeService()

    private init() {}

    /// 获取所有 Tab 的 badge 计数
    func fetchBadgeCounts() async throws -> BadgeCounts {
        let response: DataResponse<BadgeCounts> = try await APIManager.shared.get("/badges")
        return response.data
    }
}

// MARK: - Response Models

struct BadgeCounts: Codable {
    let map: MapBadge
    let feed: FeedBadge
    let alliance: AllianceBadge
    let leaderboard: LeaderboardBadge
    let profile: ProfileBadge

    struct MapBadge: Codable {
        let hasActivity: Bool
    }

    struct FeedBadge: Codable {
        let count: Int
    }

    struct AllianceBadge: Codable {
        let count: Int
    }

    struct LeaderboardBadge: Codable {
        let rankChanged: Bool
    }

    struct ProfileBadge: Codable {
        let count: Int
    }
}
