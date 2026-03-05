import Foundation

/// 社交动态 Feed 服务
class FeedService {
    static let shared = FeedService()
    private let apiManager = APIManager.shared

    private init() {}

    // MARK: - Models

    struct FeedResponse: Codable {
        let success: Bool
        let data: FeedData?
        let message: String?

        struct FeedData: Codable {
            let items: [FeedItem]
            let hasMore: Bool
        }
    }

    struct FeedItem: Codable, Identifiable {
        let id: String
        let type: String  // drawing_complete, achievement, checkin, alliance_join, moment, showcase, poll
        let content: FeedContent
        let drawing_session_id: String?
        var like_count: Int
        let comment_count: Int
        var is_liked: Bool
        var is_bookmarked: Bool
        var poll_data: PollData?
        var my_vote_option_index: Int?
        let created_at: String
        let user: FeedUser

        struct PollData: Codable {
            let question: String
            let options: [String]
            var votes: [Int]
            let end_time: String?
        }

        struct FeedContent: Codable {
            let text: String?              // moment内容
            let story: String?             // showcase故事
            let pixel_count: Int?
            let city: String?
            let duration_seconds: Int?
            let map_snapshot_url: String?
            let achievement_name: String?
            let alliance_name: String?
        }

        struct FeedUser: Codable {
            let id: String
            let username: String?
            let display_name: String?
            let avatar_url: String?
            let avatar: String?

            var displayName: String {
                display_name ?? username ?? "Unknown"
            }
        }

        var timeAgo: String {
            guard let date = ISO8601DateFormatter().date(from: created_at) ??
                  DateFormatter.feedDateFormatter.date(from: created_at) else {
                return created_at
            }
            let interval = Date().timeIntervalSince(date)
            if interval < 60 { return NSLocalizedString("feed.time.just_now", comment: "Just now") }
            if interval < 3600 { return String(format: NSLocalizedString("feed.time.minutes_ago", comment: ""), Int(interval / 60)) }
            if interval < 86400 { return String(format: NSLocalizedString("feed.time.hours_ago", comment: ""), Int(interval / 3600)) }
            if interval < 604800 { return String(format: NSLocalizedString("feed.time.days_ago", comment: ""), Int(interval / 86400)) }
            let formatter = DateFormatter()
            formatter.dateStyle = .medium
            return formatter.string(from: date)
        }
    }

    struct CommentResponse: Codable {
        let success: Bool
        let data: CommentData?

        struct CommentData: Codable {
            let comments: [FeedComment]
        }
    }

    struct FeedComment: Codable, Identifiable {
        let id: String
        let content: String
        let created_at: String
        let user: FeedItem.FeedUser
    }

    struct SimpleResponse: Codable {
        let success: Bool
        let message: String?
    }

    struct AddCommentResponse: Codable {
        let success: Bool
        let data: AddedComment?

        struct AddedComment: Codable {
            let id: String
            let content: String
            let created_at: String
        }
    }

    // MARK: - API Methods

    /// 获取动态流
    func getFeed(filter: String = "following", limit: Int = 20, offset: Int = 0, lat: Double? = nil, lng: Double? = nil) async throws -> FeedResponse {
        let baseURLString = "\(APIEndpoint.baseURL)/feed"
        guard let url = URL(string: baseURLString) else { throw NetworkError.invalidURL }

        var components = URLComponents(url: url, resolvingAgainstBaseURL: false)!
        var queryItems = [
            URLQueryItem(name: "filter", value: filter),
            URLQueryItem(name: "limit", value: String(limit)),
            URLQueryItem(name: "offset", value: String(offset))
        ]

        // ✨ 添加位置参数（用于nearby筛选）
        if let lat = lat, let lng = lng {
            queryItems.append(URLQueryItem(name: "lat", value: String(lat)))
            queryItems.append(URLQueryItem(name: "lng", value: String(lng)))
        }

        components.queryItems = queryItems

        guard let finalURL = components.url else { throw NetworkError.invalidURL }

        var request = URLRequest(url: finalURL)
        request.httpMethod = "GET"
        if let token = AuthManager.shared.getAccessToken() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        return try await apiManager.performRequest(request)
    }

    /// 点赞
    func likeFeedItem(id: String) async throws -> SimpleResponse {
        let urlString = "\(APIEndpoint.baseURL)/feed/\(id)/like"
        guard let url = URL(string: urlString) else { throw NetworkError.invalidURL }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let token = AuthManager.shared.getAccessToken() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        return try await apiManager.performRequest(request)
    }

    /// 取消点赞
    func unlikeFeedItem(id: String) async throws -> SimpleResponse {
        let urlString = "\(APIEndpoint.baseURL)/feed/\(id)/unlike"
        guard let url = URL(string: urlString) else { throw NetworkError.invalidURL }

        var request = URLRequest(url: url)
        request.httpMethod = "DELETE"
        if let token = AuthManager.shared.getAccessToken() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        return try await apiManager.performRequest(request)
    }

    /// 获取评论
    func getComments(feedItemId: String, limit: Int = 20, offset: Int = 0) async throws -> CommentResponse {
        let urlString = "\(APIEndpoint.baseURL)/feed/\(feedItemId)/comments"
        guard let url = URL(string: urlString) else { throw NetworkError.invalidURL }

        var components = URLComponents(url: url, resolvingAgainstBaseURL: false)!
        components.queryItems = [
            URLQueryItem(name: "limit", value: String(limit)),
            URLQueryItem(name: "offset", value: String(offset))
        ]

        guard let finalURL = components.url else { throw NetworkError.invalidURL }

        var request = URLRequest(url: finalURL)
        request.httpMethod = "GET"
        if let token = AuthManager.shared.getAccessToken() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        return try await apiManager.performRequest(request)
    }

    /// 发表评论
    func addComment(feedItemId: String, content: String) async throws -> AddCommentResponse {
        let urlString = "\(APIEndpoint.baseURL)/feed/\(feedItemId)/comments"
        guard let url = URL(string: urlString) else { throw NetworkError.invalidURL }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let token = AuthManager.shared.getAccessToken() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        let body = ["content": content]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        return try await apiManager.performRequest(request)
    }

    /// 删除评论
    func deleteComment(commentId: String) async throws -> SimpleResponse {
        let urlString = "\(APIEndpoint.baseURL)/feed/comments/\(commentId)"
        guard let url = URL(string: urlString) else { throw NetworkError.invalidURL }

        var request = URLRequest(url: url)
        request.httpMethod = "DELETE"
        if let token = AuthManager.shared.getAccessToken() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        return try await apiManager.performRequest(request)
    }

    /// 收藏动态
    func bookmarkFeedItem(id: String) async throws -> SimpleResponse {
        let urlString = "\(APIEndpoint.baseURL)/feed/\(id)/bookmark"
        guard let url = URL(string: urlString) else { throw NetworkError.invalidURL }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let token = AuthManager.shared.getAccessToken() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        return try await apiManager.performRequest(request)
    }

    /// 取消收藏
    func unbookmarkFeedItem(id: String) async throws -> SimpleResponse {
        let urlString = "\(APIEndpoint.baseURL)/feed/\(id)/bookmark"
        guard let url = URL(string: urlString) else { throw NetworkError.invalidURL }

        var request = URLRequest(url: url)
        request.httpMethod = "DELETE"
        if let token = AuthManager.shared.getAccessToken() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        return try await apiManager.performRequest(request)
    }

    /// 对投票进行投票
    func votePoll(id: String, optionIndex: Int) async throws -> VoteResponse {
        let urlString = "\(APIEndpoint.baseURL)/feed/\(id)/vote"
        guard let url = URL(string: urlString) else { throw NetworkError.invalidURL }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let token = AuthManager.shared.getAccessToken() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        let body = ["option_index": optionIndex]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        return try await apiManager.performRequest(request)
    }

    struct VoteResponse: Codable {
        let success: Bool
        let message: String?
        let data: VoteData?

        struct VoteData: Codable {
            let votes: [Int]
        }
    }

    /// 举报动态
    func reportFeedItem(id: String, reason: String, description: String?) async throws -> SimpleResponse {
        let urlString = "\(APIEndpoint.baseURL)/feed/\(id)/report"
        guard let url = URL(string: urlString) else { throw NetworkError.invalidURL }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let token = AuthManager.shared.getAccessToken() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        var body: [String: Any] = ["reason": reason]
        if let description = description {
            body["description"] = description
        }
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        return try await apiManager.performRequest(request)
    }

    /// 创建心情动态
    func createMoment(content: String, hashtags: [String]?, location: LocationInfo?, media: [MediaInfo]?) async throws -> CreateMomentResponse {
        let urlString = "\(APIEndpoint.baseURL)/feed/create"
        guard let url = URL(string: urlString) else { throw NetworkError.invalidURL }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let token = AuthManager.shared.getAccessToken() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        let body: [String: Any] = [
            "content": content,
            "hashtags": hashtags ?? [],
            "location": location?.toDictionary() as Any,
            "media": media?.map { $0.toDictionary() } ?? []
        ]

        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        return try await apiManager.performRequest(request)
    }

    struct LocationInfo {
        let name: String?
        let lat: Double
        let lng: Double

        func toDictionary() -> [String: Any] {
            return [
                "name": name ?? "",
                "lat": lat,
                "lng": lng
            ]
        }
    }

    struct MediaInfo {
        let type: String  // "image" or "video"
        let url: String
        let thumbnail: String?

        func toDictionary() -> [String: Any] {
            var dict: [String: Any] = [
                "type": type,
                "url": url
            ]
            if let thumbnail = thumbnail {
                dict["thumbnail"] = thumbnail
            }
            return dict
        }
    }

    struct CreateMomentResponse: Codable {
        let success: Bool
        let data: CreatedMoment?
        let message: String?

        struct CreatedMoment: Codable {
            let id: String
            let created_at: String
        }
    }

    /// 创建作品展示（分享到动态）
    func createShowcase(sessionId: String, story: String?) async throws -> CreateShowcaseResponse {
        let urlString = "\(APIEndpoint.baseURL)/feed/create-showcase"
        guard let url = URL(string: urlString) else {
            throw NetworkError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        if let token = AuthManager.shared.getAccessToken() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        var body: [String: Any] = ["session_id": sessionId]
        if let story = story, !story.isEmpty {
            body["story"] = story
        }

        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        return try await apiManager.performRequest(request)
    }

    struct CreateShowcaseResponse: Codable {
        let success: Bool
        let message: String?
        let data: ShowcaseData?

        struct ShowcaseData: Codable {
            let id: String
            let created_at: String
        }
    }

    struct ErrorResponse: Codable {
        let message: String?
    }

    // MARK: - World State Feed

    struct WorldStateFeedResponse: Codable {
        let success: Bool
        let data: WorldStateFeedData?
        let message: String?

        struct WorldStateFeedData: Codable {
            let events: [WorldStateEvent]
            let hasMore: Bool
        }
    }

    /// 获取世界状态流（系统生成的事件）
    func getWorldStateFeed(filter: String = "all", limit: Int = 20, offset: Int = 0) async throws -> WorldStateFeedResponse {
        let baseURLString = "\(APIEndpoint.baseURL)/feed/world-state"
        guard let url = URL(string: baseURLString) else { throw NetworkError.invalidURL }

        var components = URLComponents(url: url, resolvingAgainstBaseURL: false)!
        components.queryItems = [
            URLQueryItem(name: "filter", value: filter),
            URLQueryItem(name: "limit", value: String(limit)),
            URLQueryItem(name: "offset", value: String(offset))
        ]

        guard let finalURL = components.url else { throw NetworkError.invalidURL }

        var request = URLRequest(url: finalURL)
        request.httpMethod = "GET"
        if let token = AuthManager.shared.getAccessToken() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        return try await apiManager.performRequest(request)
    }
}

extension DateFormatter {
    static let feedDateFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd'T'HH:mm:ss.SSSZ"
        return f
    }()
}
