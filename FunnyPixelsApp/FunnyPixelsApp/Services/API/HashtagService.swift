import Foundation

/// 话题标签服务
class HashtagService {
    static let shared = HashtagService()
    private let apiManager = APIManager.shared

    private init() {}

    // MARK: - Models

    struct HashtagSuggestion: Codable, Identifiable {
        let canonical: String
        let localized: String
        let count: Int

        var id: String { canonical }
        var displayText: String { "#\(localized)" }
    }

    struct HashtagDetail: Codable {
        let tag: HashtagInfo
        let items: [FeedService.FeedItem]
        let hasMore: Bool
    }

    struct HashtagInfo: Codable {
        let canonical: String
        let localized: String
        let count: Int
    }

    struct SuggestionsResponse: Codable {
        let success: Bool
        let data: SuggestionsData?
    }

    struct SuggestionsData: Codable {
        let suggestions: [HashtagSuggestion]
    }

    struct DetailResponse: Codable {
        let success: Bool
        let data: HashtagDetail?
    }

    struct TrendingResponse: Codable {
        let success: Bool
        let data: TrendingData?
    }

    struct TrendingData: Codable {
        let trending: [HashtagSuggestion]
    }

    // MARK: - API Methods

    /// 获取话题建议（自动补全）
    func getSuggestions(query: String, limit: Int = 10) async throws -> [HashtagSuggestion] {
        let urlString = "\(APIEndpoint.baseURL)/hashtags/suggestions"
        guard var components = URLComponents(string: urlString) else {
            throw NetworkError.invalidURL
        }

        components.queryItems = [
            URLQueryItem(name: "q", value: query),
            URLQueryItem(name: "limit", value: String(limit))
        ]

        guard let url = components.url else {
            throw NetworkError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        if let token = AuthManager.shared.getAccessToken() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        let response: SuggestionsResponse = try await apiManager.performRequest(request)
        return response.data?.suggestions ?? []
    }

    /// 获取话题详情
    func getHashtagDetail(tag: String, offset: Int = 0, limit: Int = 20) async throws -> HashtagDetail? {
        let urlString = "\(APIEndpoint.baseURL)/hashtags/\(tag)"
        guard var components = URLComponents(string: urlString) else {
            throw NetworkError.invalidURL
        }

        components.queryItems = [
            URLQueryItem(name: "offset", value: String(offset)),
            URLQueryItem(name: "limit", value: String(limit))
        ]

        guard let url = components.url else {
            throw NetworkError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        if let token = AuthManager.shared.getAccessToken() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        let response: DetailResponse = try await apiManager.performRequest(request)
        return response.data
    }

    /// 获取热门话题
    func getTrending(limit: Int = 20) async throws -> [HashtagSuggestion] {
        let urlString = "\(APIEndpoint.baseURL)/hashtags/trending"
        guard var components = URLComponents(string: urlString) else {
            throw NetworkError.invalidURL
        }

        components.queryItems = [
            URLQueryItem(name: "limit", value: String(limit))
        ]

        guard let url = components.url else {
            throw NetworkError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = "GET"

        let response: TrendingResponse = try await apiManager.performRequest(request)
        return response.data?.trending ?? []
    }
}
