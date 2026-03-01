import Foundation

/// 每日任务服务
class DailyTaskService {
    static let shared = DailyTaskService()

    private init() {}

    // MARK: - Models

    struct DailyTask: Codable, Identifiable {
        let id: Int
        let type: String
        let title: String
        let description: String
        let target: Int
        let current: Int
        let isCompleted: Bool
        let isClaimed: Bool
        let rewardPoints: Int
        let progress: Double

        private enum CodingKeys: String, CodingKey {
            case id, type, title, description, target, current, progress
            case isCompleted = "is_completed"
            case isClaimed = "is_claimed"
            case rewardPoints = "reward_points"
        }

        var taskIcon: String {
            switch type {
            case "draw_pixels": return "square.grid.3x3.fill"
            case "draw_sessions": return "paintbrush.fill"
            case "checkin": return "checkmark.circle.fill"
            case "social_interact": return "heart.fill"
            case "explore_map": return "map.fill"
            default: return "star.fill"
            }
        }

        var taskColor: String {
            switch type {
            case "draw_pixels": return "blue"
            case "draw_sessions": return "purple"
            case "checkin": return "green"
            case "social_interact": return "pink"
            case "explore_map": return "cyan"
            default: return "orange"
            }
        }
    }

    struct DailyTaskData: Codable {
        let tasks: [DailyTask]
        let completedCount: Int
        let totalCount: Int
        let allCompleted: Bool
        let bonusAvailable: Bool
        let bonusClaimed: Bool
        let bonusPoints: Int

        private enum CodingKeys: String, CodingKey {
            case tasks
            case completedCount = "completed_count"
            case totalCount = "total_count"
            case allCompleted = "all_completed"
            case bonusAvailable = "bonus_available"
            case bonusClaimed = "bonus_claimed"
            case bonusPoints = "bonus_points"
        }
    }

    struct DailyTaskResponse: Codable {
        let success: Bool
        let data: DailyTaskData?
    }

    struct ClaimResponse: Codable {
        let success: Bool
        let message: String?
        let data: ClaimData?
    }

    struct ClaimData: Codable {
        let pointsEarned: Int

        private enum CodingKeys: String, CodingKey {
            case pointsEarned = "points_earned"
        }
    }

    // MARK: - API Methods

    func getTasks() async throws -> DailyTaskData {
        let response: DailyTaskResponse = try await APIManager.shared.get("/daily-tasks")
        guard response.success, let data = response.data else {
            throw NetworkError.serverError("Failed to fetch daily tasks")
        }
        return data
    }

    func claimReward(taskId: Int) async throws -> Int {
        let response: ClaimResponse = try await APIManager.shared.post("/daily-tasks/\(taskId)/claim")
        guard response.success, let data = response.data else {
            throw NetworkError.serverError(response.message ?? "Failed to claim reward")
        }
        return data.pointsEarned
    }

    func claimBonus() async throws -> Int {
        let response: ClaimResponse = try await APIManager.shared.post("/daily-tasks/bonus/claim")
        guard response.success, let data = response.data else {
            throw NetworkError.serverError(response.message ?? "Failed to claim bonus")
        }
        return data.pointsEarned
    }
}
