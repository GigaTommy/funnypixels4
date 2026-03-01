import Foundation

/// 个人数据仪表盘服务
class DashboardStatsService {
    static let shared = DashboardStatsService()
    private let apiManager = APIManager.shared

    private init() {}

    // MARK: - Models

    struct DashboardResponse: Codable {
        let success: Bool
        let data: DashboardData?
        let message: String?
    }

    struct DashboardData: Codable {
        let overview: Overview
        let heatmap: [HeatmapDay]
        let weeklyTrend: [TrendPoint]
        let monthlyTrend: [TrendPoint]
        let cityFootprint: [CityFootprintItem]
    }

    struct Overview: Codable {
        let total_pixels: Int
        let total_sessions: Int
        let total_cities: Int
        let current_streak: Int
    }

    struct HeatmapDay: Codable, Identifiable {
        let date: String
        let count: Int
        var id: String { date }
    }

    struct TrendPoint: Codable, Identifiable {
        let week_start: String?
        let month_start: String?
        let count: Int

        var id: String { week_start ?? month_start ?? UUID().uuidString }
        var label: String {
            // 兼容 "2026-02-16" 和 "2026-02-16T00:00:00.000Z" 两种格式
            if let ws = week_start {
                let dateOnly = String(ws.prefix(10)) // "YYYY-MM-DD"
                return String(dateOnly.suffix(5))     // "MM-DD"
            }
            if let ms = month_start {
                let dateOnly = String(ms.prefix(10))
                return String(dateOnly.prefix(7).suffix(2)) + "月"
            }
            return ""
        }
    }

    struct CityFootprintItem: Codable, Identifiable {
        let city: String
        let country: String?
        let session_count: Int
        let total_pixels: Int

        var id: String { "\(city)_\(country ?? "")" }
    }

    // MARK: - API

    func getDashboard() async throws -> DashboardResponse {
        let urlString = "\(APIEndpoint.baseURL)/stats/dashboard"
        guard let url = URL(string: urlString) else { throw NetworkError.invalidURL }

        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        if let token = AuthManager.shared.getAccessToken() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        return try await apiManager.performRequest(request)
    }
}
