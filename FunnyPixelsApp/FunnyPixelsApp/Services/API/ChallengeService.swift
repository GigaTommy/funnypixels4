import Foundation

class ChallengeService {
    static let shared = ChallengeService()
    private let apiManager = APIManager.shared

    // MARK: - Response Models

    struct ChallengeResponse: Codable {
        let success: Bool
        let data: Challenge?
        let message: String?
    }

    struct ClaimResponse: Codable {
        let success: Bool
        let message: String?
        let data: ClaimData?
    }

    struct ClaimData: Codable {
        let success: Bool?
        let reward: Int?
    }

    struct Challenge: Codable, Identifiable {
        let id: String
        let date: String?
        let type: String?
        let targetValue: Int?
        let currentValue: Int?
        let title: String?
        let description: String?
        let isCompleted: Bool?
        let isClaimed: Bool?
        let rewardPoints: Int?

        enum CodingKeys: String, CodingKey {
            case id, date, type, title, description
            case targetValue = "target_value"
            case currentValue = "current_value"
            case isCompleted = "is_completed"
            case isClaimed = "is_claimed"
            case rewardPoints = "reward_points"
        }

        var progress: Double {
            guard let target = targetValue, target > 0 else { return 0 }
            let current = currentValue ?? 0
            return min(Double(current) / Double(target), 1.0)
        }

        var progressText: String {
            "\(currentValue ?? 0)/\(targetValue ?? 0)"
        }
    }

    // MARK: - API Methods

    func getTodayChallenge() async throws -> Challenge {
        let response: ChallengeResponse = try await apiManager.get("/challenges/today")
        guard response.success, let challenge = response.data else {
            throw NetworkError.serverError(response.message ?? NSLocalizedString("challenge.error.fetch_failed", comment: "Failed to get daily challenge"))
        }
        return challenge
    }

    func claimReward(challengeId: String) async throws -> Int {
        let response: ClaimResponse = try await apiManager.post("/challenges/\(challengeId)/claim")
        guard response.success, let data = response.data else {
            throw NetworkError.serverError(response.message ?? NSLocalizedString("challenge.error.claim_failed", comment: "Failed to claim reward"))
        }
        return data.reward ?? 0
    }
}
