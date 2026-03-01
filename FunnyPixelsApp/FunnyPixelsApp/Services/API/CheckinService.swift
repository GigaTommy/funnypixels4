import Foundation

class CheckinService {
    static let shared = CheckinService()
    private let apiManager = APIManager.shared

    // MARK: - Response Models

    struct CheckinResponse: Codable {
        let success: Bool
        let message: String?
        let checkin: CheckinRecord?
        let error: String?
    }

    struct CanCheckinResponse: Codable {
        let success: Bool
        let canCheckin: Bool?
    }

    struct StatsResponse: Codable {
        let success: Bool
        let stats: CheckinStats?
        let weekRewards: [WeekReward]?
        let milestones: [Milestone]?
        let cycleDay: Int?

        enum CodingKeys: String, CodingKey {
            case success, stats, milestones
            case weekRewards = "week_rewards"
            case cycleDay = "cycle_day"
        }
    }

    struct CalendarResponse: Codable {
        let success: Bool
        let calendar: [CalendarDay]?
    }

    struct CheckinRecord: Codable {
        let id: String?
        let checkinDate: String?
        let consecutiveDays: Int?
        let rewardPoints: Int?
        let rewardItems: [Int]?
        let isClaimed: Bool?

        enum CodingKeys: String, CodingKey {
            case id
            case checkinDate = "checkin_date"
            case consecutiveDays = "consecutive_days"
            case rewardPoints = "reward_points"
            case rewardItems = "reward_items"
            case isClaimed = "is_claimed"
        }
    }

    struct CheckinStats: Codable {
        let totalCheckins: Int?
        let maxConsecutiveDays: Int?
        let currentConsecutiveDays: Int?
        let totalRewardPoints: Int?

        enum CodingKeys: String, CodingKey {
            case totalCheckins = "total_checkins"
            case maxConsecutiveDays = "max_consecutive_days"
            case currentConsecutiveDays = "current_consecutive_days"
            case totalRewardPoints = "total_reward_points"
        }
    }

    struct CalendarDay: Codable, Identifiable {
        var id: String { date }
        let date: String
        let day: Int
        let isChecked: Bool?
        let consecutiveDays: Int?
        let rewardPoints: Int?

        enum CodingKeys: String, CodingKey {
            case date, day
            case isChecked = "is_checked"
            case consecutiveDays = "consecutive_days"
            case rewardPoints = "reward_points"
        }
    }

    struct WeekReward: Codable, Identifiable {
        var id: Int { day }
        let day: Int
        let reward: Int
        let isCollected: Bool
        let isCurrent: Bool
        let isBonusDay: Bool

        enum CodingKeys: String, CodingKey {
            case day, reward
            case isCollected = "is_collected"
            case isCurrent = "is_current"
            case isBonusDay = "is_bonus_day"
        }
    }

    struct Milestone: Codable, Identifiable {
        var id: Int { target }
        let target: Int
        let current: Int
        let reward: Int
        let icon: String
        let isCompleted: Bool
        let progress: Double

        enum CodingKeys: String, CodingKey {
            case target, current, reward, icon, progress
            case isCompleted = "is_completed"
        }
    }

    // MARK: - API Methods

    func performCheckin() async throws -> CheckinRecord {
        let response: CheckinResponse = try await apiManager.post("/currency/checkin")
        guard response.success, let checkin = response.checkin else {
            throw NetworkError.serverError(response.error ?? response.message ?? NSLocalizedString("checkin.error.failed", comment: "Check-in failed"))
        }
        return checkin
    }

    func canCheckinToday() async throws -> Bool {
        let response: CanCheckinResponse = try await apiManager.get("/currency/checkin/can-checkin")
        return response.canCheckin ?? false
    }

    func getStats() async throws -> CheckinStats {
        let response: StatsResponse = try await apiManager.get("/currency/checkin/stats")
        guard response.success, let stats = response.stats else {
            throw NetworkError.serverError(NSLocalizedString("checkin.error.stats_failed", comment: "Failed to get check-in stats"))
        }
        return stats
    }

    func getFullStats() async throws -> StatsResponse {
        let response: StatsResponse = try await apiManager.get("/currency/checkin/stats")
        guard response.success else {
            throw NetworkError.serverError(NSLocalizedString("checkin.error.stats_failed", comment: "Failed to get check-in stats"))
        }
        return response
    }

    func getCalendar(year: Int, month: Int) async throws -> [CalendarDay] {
        let response: CalendarResponse = try await apiManager.get(
            "/currency/checkin/calendar",
            parameters: ["year": year, "month": month]
        )
        guard response.success else {
            throw NetworkError.serverError(NSLocalizedString("checkin.error.calendar_failed", comment: "Failed to get check-in calendar"))
        }
        return response.calendar ?? []
    }

    // MARK: - Streak Recovery

    struct RecoveryStatusResponse: Codable {
        let success: Bool
        let canRecover: Bool?
        let lostStreak: Int?
        let missedDate: String?
        let reason: String?
    }

    struct RecoverResponse: Codable {
        let success: Bool
        let message: String?
        let recovery: CheckinRecord?
    }

    func canRecoverStreak() async throws -> RecoveryStatusResponse {
        let response: RecoveryStatusResponse = try await apiManager.get("/currency/checkin/can-recover")
        return response
    }

    func recoverStreak() async throws {
        let response: RecoverResponse = try await apiManager.post("/currency/checkin/recover")
        guard response.success else {
            throw NetworkError.serverError(response.message ?? "RECOVERY_FAILED")
        }
    }
}
