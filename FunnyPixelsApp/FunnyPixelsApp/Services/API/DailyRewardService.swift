import Foundation

class DailyRewardService {
    static let shared = DailyRewardService()
    private let apiManager = APIManager.shared

    // MARK: - Models

    struct RewardSummaryResponse: Codable {
        let success: Bool
        let data: RewardSummaryData?
    }

    struct RewardSummaryData: Codable {
        let has_pending: Bool
        let summary: RewardSummary?
    }

    struct RewardSummary: Codable, Identifiable {
        var id: String { reward_date }
        let reward_date: String
        let personal_rank: Int?
        let alliance_rank: Int?
        let friends_rank: Int?
        let personal_points: Int
        let alliance_points: Int
        let friends_points: Int
        let total_points: Int
    }

    // MARK: - API Methods

    func getPendingSummary() async throws -> RewardSummaryData {
        let response: RewardSummaryResponse = try await apiManager.get("/daily-reward/summary")
        guard let data = response.data else { throw NetworkError.noData }
        return data
    }

    func acknowledge(date: String) async throws {
        struct Resp: Codable { let success: Bool }
        let _: Resp = try await apiManager.post("/daily-reward/acknowledge", parameters: ["date": date])
    }
}
