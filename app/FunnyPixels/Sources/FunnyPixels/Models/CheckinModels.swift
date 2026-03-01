import Foundation

// MARK: - 签到响应

struct CheckinResponse: Codable {
    let success: Bool
    let message: String?
    let checkin: CheckinResult?
}

struct CheckinResult: Codable {
    let id: Int
    let userId: String
    let checkinDate: String
    let consecutiveDays: Int
    let rewardPoints: Int
    let rewardItems: [Int]

    enum CodingKeys: String, CodingKey {
        case id
        case userId = "user_id"
        case checkinDate = "checkin_date"
        case consecutiveDays = "consecutive_days"
        case rewardPoints = "reward_points"
        case rewardItems = "reward_items"
    }
}

// MARK: - 可否签到响应

struct CanCheckinResponse: Codable {
    let success: Bool
    let canCheckin: Bool
}

// MARK: - 签到统计响应

struct CheckinStatsResponse: Codable {
    let success: Bool
    let stats: CheckinStats?
}

struct CheckinStats: Codable {
    let totalCheckins: Int
    let maxConsecutiveDays: Int
    let currentConsecutiveDays: Int
    let totalRewardPoints: Int

    enum CodingKeys: String, CodingKey {
        case totalCheckins = "total_checkins"
        case maxConsecutiveDays = "max_consecutive_days"
        case currentConsecutiveDays = "current_consecutive_days"
        case totalRewardPoints = "total_reward_points"
    }
}
