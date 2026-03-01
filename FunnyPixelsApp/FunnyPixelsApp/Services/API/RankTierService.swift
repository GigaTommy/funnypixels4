import Foundation
import SwiftUI

/// 段位系统服务
class RankTierService {
    static let shared = RankTierService()
    private let apiManager = APIManager.shared

    private init() {}

    /// 获取所有段位列表
    func getAllTiers() async throws -> [RankTierDetail] {
        let urlString = "\(APIEndpoint.baseURL)/rank-tiers"
        guard let url = URL(string: urlString) else { throw NetworkError.invalidURL }

        var request = URLRequest(url: url)
        request.httpMethod = "GET"

        let response: RankTiersResponse = try await apiManager.performRequest(request)
        guard response.success else {
            throw NetworkError.serverError(response.data.tiers.isEmpty ? "Failed to fetch tiers" : "")
        }

        return response.data.tiers
    }

    /// 获取当前用户段位详情
    func getMyTier() async throws -> RankTierWithBenefits {
        let urlString = "\(APIEndpoint.baseURL)/rank-tiers/me"
        guard let url = URL(string: urlString) else { throw NetworkError.invalidURL }

        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        if let token = AuthManager.shared.getAccessToken() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        let response: MyTierResponse = try await apiManager.performRequest(request)
        guard response.success else {
            throw NetworkError.serverError("Failed to fetch my tier")
        }

        return response.data
    }
}

// MARK: - Response Models

struct MyTierResponse: Codable {
    let success: Bool
    let data: RankTierWithBenefits
}

struct RankTierWithBenefits: Codable {
    let id: String
    let name: String
    let nameEn: String
    let icon: String
    let color: String
    let currentPixels: Int
    let nextTierPixels: Int
    let progress: Double
    let benefits: RankTierDetail.TierBenefits

    var swiftUIColor: Color {
        Color(hex: color) ?? .gray
    }

    var gapToNext: Int {
        max(0, nextTierPixels - currentPixels)
    }

    var isMaxTier: Bool {
        progress >= 1.0
    }
}
