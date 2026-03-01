import Foundation

/// Service for invite/referral system API calls
class ReferralService {
    static let shared = ReferralService()
    private init() {}

    // MARK: - Response Models

    struct CodeResponse: Codable {
        let success: Bool
        let code: String?
    }

    struct RedeemResponse: Codable {
        let success: Bool
        let error: String?
        let inviterReward: Int?
        let inviteeReward: Int?
        let inviterName: String?
    }

    struct StatsResponse: Codable {
        let success: Bool
        let referralCode: String?
        let totalInvites: Int
        let totalRewardsEarned: Int
        let maxRewards: Int
        let rewardPerInvite: Int
        let inviteeReward: Int
    }

    // MARK: - API Methods

    /// Get or generate the user's referral code
    func getMyCode() async throws -> String {
        let response: CodeResponse = try await APIManager.shared.get("/referral/code")
        return response.code ?? ""
    }

    /// Redeem a referral code (for new users)
    func redeemCode(_ code: String) async throws -> RedeemResponse {
        let response: RedeemResponse = try await APIManager.shared.post(
            "/referral/redeem",
            parameters: ["code": code]
        )
        return response
    }

    /// Get referral stats (invite count, rewards earned)
    func getStats() async throws -> StatsResponse {
        let response: StatsResponse = try await APIManager.shared.get("/referral/stats")
        return response
    }
}
