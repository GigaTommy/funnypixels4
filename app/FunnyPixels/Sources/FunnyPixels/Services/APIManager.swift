import Foundation
import Alamofire
import Combine

// Note: APIError is now a typealias for NetworkError defined in NetworkError.swift
// This avoids duplicate definitions and provides consistent error handling across the app

/// 端点协议
protocol EndpointProtocol {
    var url: URL { get }
    var method: HTTPMethod { get }
}

/// 自定义端点（用于便捷方法）
struct CustomEndpoint: EndpointProtocol {
    let url: URL
    let method: HTTPMethod
}

/// API 端点
enum APIEndpoint: EndpointProtocol {
    static let baseURL: String = "http://localhost:3001/api"  // 后端服务地址

    // 认证相关
    case login
    case register
    case refreshToken
    case logout

    // 像素相关
    case getPixels
    case createPixel
    case updatePixel
    case deletePixel
    case getPixelsInArea
    case getPixelDetails
    case reportPixel

    // 用户相关
    case getUserProfile
    case updateProfile
    case getUserStats
    case deleteAccount
    case changePassword
    case sendVerificationCode
    case verifyCode

    // 商店相关
    case getStoreItems
    case getUserInventory
    case purchaseItem
    case useItem
    case getUserPoints
    case getFlagPatterns

    // 绘制历史相关
    case getUserPixelHistory
    case getUserPixelStats
    case getLocationHistory
    case getRegionStats
    case getStatsOverview
    case getUserAvailablePixels

    // 联盟相关
    case getUserAlliances
    case getPublicAlliances
    case searchAlliances
    case createAlliance
    case updateAlliance(String)
    case disbandAlliance(String)
    case joinAlliance(String)
    case leaveAlliance
    case applyToAlliance(String)
    case getPendingApplications(String)
    case processApplication
    case kickMember(String)
    case updateMemberRole(String)
    case transferLeadership(String)
    case generateInviteLink
    case joinByInviteLink
    case getInviteLinks(String)
    case deleteInviteLink(String)
    case getAllianceMembers(String)
    case getAvailableFlagPatterns

    // 签到相关
    case dailyCheckin
    case canCheckin
    case checkinStats

    // 排行榜相关
    case getPersonalLeaderboard
    case getAllianceLeaderboard
    case getRegionLeaderboard
    case likeLeaderboard
    case unlikeLeaderboard
    case getAvailableRegions
    case getUserRank

    var url: URL {
        let baseURLString = APIEndpoint.baseURL

        switch self {
        // 认证相关
        case .login:
            return URL(string: "\(baseURLString)/auth/login")!
        case .register:
            return URL(string: "\(baseURLString)/auth")!
        case .refreshToken:
            return URL(string: "\(baseURLString)/auth/refresh")!
        case .logout:
            return URL(string: "\(baseURLString)/auth/logout")!

        // 像素相关
        case .getPixels:
            return URL(string: "\(baseURLString)/pixels")!
        case .createPixel:
            return URL(string: "\(baseURLString)/pixels")!
        case .updatePixel:
            return URL(string: "\(baseURLString)/pixels")!
        case .deletePixel:
            return URL(string: "\(baseURLString)/pixels")!
        case .getPixelsInArea:
            return URL(string: "\(baseURLString)/pixels/area")!
        case .getPixelDetails:
            return URL(string: "\(baseURLString)/pixels/details")!
        case .reportPixel:
            return URL(string: "\(baseURLString)/pixels/report")!

        // 用户相关
        case .getUserProfile:
            return URL(string: "\(baseURLString)/auth/me")!
        case .updateProfile:
            return URL(string: "\(baseURLString)/auth/profile")!
        case .getUserStats:
            return URL(string: "\(baseURLString)/auth/stats")!
        case .deleteAccount:
            return URL(string: "\(baseURLString)/auth/delete")!
        case .changePassword:
            return URL(string: "\(baseURLString)/auth/change-password")!
        case .sendVerificationCode:
            return URL(string: "\(baseURLString)/auth/send-code")!
        case .verifyCode:
            return URL(string: "\(baseURLString)/auth/verify-code")!

        // 商店相关
        case .getStoreItems:
            return URL(string: "\(baseURLString)/store/items")!
        case .getUserInventory:
            return URL(string: "\(baseURLString)/store/inventory")!
        case .purchaseItem:
            return URL(string: "\(baseURLString)/store/purchase")!
        case .useItem:
            return URL(string: "\(baseURLString)/store/use")!
        case .getUserPoints:
            return URL(string: "\(baseURLString)/store/points")!
        case .getFlagPatterns:
            return URL(string: "\(baseURLString)/store/flag-patterns")!

        // 绘制历史相关
        case .getUserPixelHistory:
            return URL(string: "\(baseURLString)/pixels-history/user")!
        case .getUserPixelStats:
            return URL(string: "\(baseURLString)/pixels-history/user/stats")!
        case .getLocationHistory:
            return URL(string: "\(baseURLString)/pixels-history/location")!
        case .getRegionStats:
            return URL(string: "\(baseURLString)/pixels-history/region/stats")!
        case .getStatsOverview:
            return URL(string: "\(baseURLString)/pixels-history/stats/overview")!
        case .getUserAvailablePixels:
            return URL(string: "\(baseURLString)/user/pixels/available")!

        // 联盟相关
        case .getUserAlliances:
            return URL(string: "\(baseURLString)/alliances/user/alliances")!
        case .getPublicAlliances:
            return URL(string: "\(baseURLString)/alliances/public")!
        case .searchAlliances:
            return URL(string: "\(baseURLString)/alliances/search")!
        case .createAlliance:
            return URL(string: "\(baseURLString)/alliances")!
        case .updateAlliance(let allianceId):
            return URL(string: "\(baseURLString)/alliances/\(allianceId)")!
        case .disbandAlliance(let allianceId):
            return URL(string: "\(baseURLString)/alliances/\(allianceId)/disband")!
        case .joinAlliance(let allianceId):
            return URL(string: "\(baseURLString)/alliances/\(allianceId)/join")!
        case .leaveAlliance:
            return URL(string: "\(baseURLString)/alliances/leave")!
        case .applyToAlliance(let allianceId):
            return URL(string: "\(baseURLString)/alliances/\(allianceId)/apply")!
        case .getPendingApplications(let allianceId):
            return URL(string: "\(baseURLString)/alliances/\(allianceId)/applications")!
        case .processApplication:
            return URL(string: "\(baseURLString)/alliances/review-application")!
        case .kickMember(let allianceId):
            return URL(string: "\(baseURLString)/alliances/\(allianceId)/kick-member")!
        case .updateMemberRole(let allianceId):
            return URL(string: "\(baseURLString)/alliances/\(allianceId)/update-member-role")!
        case .transferLeadership(let allianceId):
            return URL(string: "\(baseURLString)/alliances/\(allianceId)/transfer-leadership")!
        case .generateInviteLink:
            return URL(string: "\(baseURLString)/alliances/generate-invite")!
        case .joinByInviteLink:
            return URL(string: "\(baseURLString)/alliances/join-by-invite")!
        case .getInviteLinks(let allianceId):
            return URL(string: "\(baseURLString)/alliances/\(allianceId)/invites")!
        case .deleteInviteLink(let inviteId):
            return URL(string: "\(baseURLString)/alliances/invites/\(inviteId)")!
        case .getAllianceMembers(let allianceId):
            return URL(string: "\(baseURLString)/alliances/\(allianceId)/members")!
        case .getAvailableFlagPatterns:
            return URL(string: "\(baseURLString)/alliances/flag-patterns")!

        // 签到相关
        case .dailyCheckin:
            return URL(string: "\(baseURLString)/currency/checkin")!
        case .canCheckin:
            return URL(string: "\(baseURLString)/currency/checkin/can-checkin")!
        case .checkinStats:
            return URL(string: "\(baseURLString)/currency/checkin/stats")!

        // 排行榜相关
        case .getPersonalLeaderboard:
            return URL(string: "\(baseURLString)/leaderboard/personal")!
        case .getAllianceLeaderboard:
            return URL(string: "\(baseURLString)/leaderboard/alliance")!
        case .getRegionLeaderboard:
            return URL(string: "\(baseURLString)/leaderboard/region")!
        case .likeLeaderboard:
            return URL(string: "\(baseURLString)/leaderboard/like")!
        case .unlikeLeaderboard:
            return URL(string: "\(baseURLString)/leaderboard/unlike")!
        case .getAvailableRegions:
            return URL(string: "\(baseURLString)/geographic/regions")!
        case .getUserRank:
            return URL(string: "\(baseURLString)/leaderboard/user-rank")!
        }
    }

    var method: HTTPMethod {
        switch self {
        // POST 请求
        case .login, .register, .createPixel, .purchaseItem, .useItem, .changePassword, .createAlliance, .joinAlliance, .kickMember, .updateMemberRole, .transferLeadership, .generateInviteLink, .joinByInviteLink, .likeLeaderboard, .reportPixel, .sendVerificationCode, .verifyCode, .applyToAlliance, .processApplication, .dailyCheckin:
            return .post

        // GET 请求
        case .refreshToken, .getUserProfile, .updateProfile, .getUserStats, .getPixels, .getPixelsInArea, .getPixelDetails, .deleteAccount, .getStoreItems, .getUserInventory, .getUserPoints, .getFlagPatterns, .getUserPixelHistory, .getUserPixelStats, .getLocationHistory, .getRegionStats, .getStatsOverview, .getUserAvailablePixels, .getUserAlliances, .getPublicAlliances, .searchAlliances, .getAllianceMembers, .getInviteLinks, .getPersonalLeaderboard, .getAllianceLeaderboard, .getRegionLeaderboard, .getPendingApplications, .getAvailableFlagPatterns, .getAvailableRegions, .getUserRank, .canCheckin, .checkinStats:
            return .get

        // PUT 请求
        case .updatePixel, .updateAlliance, .updateProfile:
            return .put

        // DELETE 请求
        case .logout, .deletePixel, .leaveAlliance, .deleteInviteLink, .unlikeLeaderboard, .disbandAlliance, .deleteAccount:
            return .delete
        }
    }
}

/// API 管理器
public class APIManager: ObservableObject {
    public static let shared = APIManager()

    private let session: Session
    @Published var isLoading = false
    @Published var errorMessage: String?

    private init() {
        // 配置会话
        let configuration = URLSessionConfiguration.default
        configuration.timeoutIntervalForRequest = 30
        configuration.timeoutIntervalForResource = 60

        self.session = Session(configuration: configuration)
    }

    /// 通用请求方法
    func request<T: Codable>(
        endpoint: APIEndpoint,
        parameters: [String: Any]? = nil,
        headers: HTTPHeaders? = nil
    ) async throws -> T {

        isLoading = true
        errorMessage = nil

        defer {
            isLoading = false
        }

        let startTime = Date()
        let url = endpoint.url
        var urlRequest = URLRequest(url: url)
        urlRequest.httpMethod = endpoint.method.rawValue

        // 记录请求开始
        // ResponseLogger.shared.logRequestStart(
        //     endpoint: url.absoluteString,
        //     method: endpoint.method.rawValue,
        //     parameters: parameters
        // )

        // 设置请求头
        var httpHeaders = HTTPHeaders()
        httpHeaders["Content-Type"] = "application/json"

        // 添加认证头
        if let token = AuthManager.shared.getAccessToken() {
            httpHeaders["Authorization"] = "Bearer \(token)"
        }

        // 添加自定义头部
        if let headers = headers {
            for (key, value) in headers.dictionary {
                httpHeaders[key] = value
            }
        }

        urlRequest.headers = httpHeaders

        // 添加请求体
        if let parameters = parameters, endpoint.method != .get {
            do {
                urlRequest.httpBody = try JSONSerialization.data(withJSONObject: parameters)
            } catch let serializeError {
                throw NetworkError.decodingFailed(serializeError)
            }
        }

        do {
            let afResponse = await session.request(urlRequest).serializingData().response
            guard let data = afResponse.value else {
                throw NetworkError.noData
            }
            guard let httpResponse = afResponse.response else {
                throw NetworkError.noData
            }

            let responseTime = Date().timeIntervalSince(startTime)

            // 验证HTTP状态
            // try ResponseValidator.validateHTTPStatus(httpResponse.statusCode)

            // 验证响应头
            // try? ResponseValidator.validateResponseHeaders(httpResponse.allHeaderFields as? [AnyHashable: Any] ?? [:])

            // 验证响应大小
            // try ResponseValidator.validateResponseSize(data)

            // 验证JSON格式
            // try ResponseValidator.validateJSONFormat(data)

            // 记录响应
            // ResponseLogger.shared.logResponse(
            //     endpoint: url.absoluteString,
            //     statusCode: httpResponse.statusCode,
            //     dataSize: data.count,
            //     responseTime: responseTime
            // )

            // 记录性能警告
            // ResponseLogger.shared.logSlowRequest(endpoint: url.absoluteString, responseTime: responseTime)
            // ResponseLogger.shared.logLargeResponse(endpoint: url.absoluteString, dataSize: data.count)

            // 记录完整响应数据（调试模式）
            // ResponseLogger.shared.logFullResponseData(data, endpoint: url.absoluteString)

            switch httpResponse.statusCode {
            case 200...299:
                do {
                    let decodedResponse = try JSONDecoder().decode(T.self, from: data)

                    // 如果是标准响应，进行验证
                    // 这里需要更复杂的类型检查，暂时跳过自动验证
                    // 用户可以使用 requestWithStandardResponse 方法进行验证

                    // ResponseLogger.shared.logRequestSuccess(
                    //     endpoint: url.absoluteString,
                    //     statusCode: httpResponse.statusCode,
                    //     responseTime: responseTime
                    // )

                    return decodedResponse
                } catch let decodingError as DecodingError {
                    // ResponseLogger.shared.logRequestFailure(
                    //     endpoint: url.absoluteString,
                    //     error: decodingError,
                    //     statusCode: httpResponse.statusCode
                    // )
                    throw NetworkError.decodingFailed(decodingError)
                }

            case 401:
                // Token 过期，尝试刷新
                try await refreshToken()
                // 重新请求
                return try await request(endpoint: endpoint, parameters: parameters, headers: headers)

            default:
                let error = NetworkError.serverError(httpResponse.statusCode, nil)
                // ResponseLogger.shared.logRequestFailure(
                //     endpoint: url.absoluteString,
                //     error: error,
                //     statusCode: httpResponse.statusCode
                // )
                throw error
            }
        } catch {
            let responseTime = Date().timeIntervalSince(startTime)

            // 记录错误
            // ResponseLogger.shared.logRequestFailure(
            //     endpoint: url.absoluteString,
            //     error: error
            // )
            throw error
        }
    }

    /// 通用请求方法（自定义端点）
    func request<T: Codable>(
        endpoint: CustomEndpoint,
        parameters: [String: Any]? = nil,
        headers: HTTPHeaders? = nil
    ) async throws -> T {

        isLoading = true
        errorMessage = nil

        defer {
            isLoading = false
        }

        let startTime = Date()
        let url = endpoint.url
        var urlRequest = URLRequest(url: url)
        urlRequest.httpMethod = endpoint.method.rawValue

        // 记录请求开始
        // ResponseLogger.shared.logRequestStart(
        //     endpoint: url.absoluteString,
        //     method: endpoint.method.rawValue,
        //     parameters: parameters
        // )

        // 设置请求头
        var httpHeaders = HTTPHeaders()
        httpHeaders["Content-Type"] = "application/json"

        // 添加认证头
        if let token = AuthManager.shared.getAccessToken() {
            httpHeaders["Authorization"] = "Bearer \(token)"
        }

        // 添加自定义头部
        if let headers = headers {
            for (key, value) in headers.dictionary {
                httpHeaders[key] = value
            }
        }

        urlRequest.headers = httpHeaders

        // 添加请求体
        if let parameters = parameters, endpoint.method != .get {
            do {
                urlRequest.httpBody = try JSONSerialization.data(withJSONObject: parameters)
            } catch let serializeError {
                throw NetworkError.decodingFailed(serializeError)
            }
        }

        do {
            let afResponse = await session.request(urlRequest).serializingData().response
            guard let data = afResponse.value else {
                throw NetworkError.noData
            }
            guard let httpResponse = afResponse.response else {
                throw NetworkError.noData
            }

            let responseTime = Date().timeIntervalSince(startTime)

            // 验证HTTP状态
            // try ResponseValidator.validateHTTPStatus(httpResponse.statusCode)

            // 验证响应头
            // try? ResponseValidator.validateResponseHeaders(httpResponse.allHeaderFields as? [AnyHashable: Any] ?? [:])

            // 验证响应大小
            // try ResponseValidator.validateResponseSize(data)

            // 验证JSON格式
            // try ResponseValidator.validateJSONFormat(data)

            // 记录响应
            // ResponseLogger.shared.logResponse(
            //     endpoint: url.absoluteString,
            //     statusCode: httpResponse.statusCode,
            //     dataSize: data.count,
            //     responseTime: responseTime
            // )

            // 记录性能警告
            if responseTime > AppConfig.requestTimeout {
                // Logger.warning("API request took longer than expected: \(url.absoluteString)")
                print("Warning: API request took longer than expected: \(url.absoluteString)")
            }

            // 解码响应
            do {
                let decoder = JSONDecoder()
                return try decoder.decode(T.self, from: data)
            } catch let decodingError {
                // ResponseLogger.shared.logRequestFailure(
                //     endpoint: url.absoluteString,
                //     error: decodingError,
                //     statusCode: httpResponse.statusCode
                // )
                throw NetworkError.decodingFailed(decodingError)
            }

        } catch let error as NetworkError {
            throw error
        } catch {
            let responseTime = Date().timeIntervalSince(startTime)

            // 记录错误
            // ResponseLogger.shared.logRequestFailure(
            //     endpoint: url.absoluteString,
            //     error: error
            // )
            throw error
        }
    }

    // MARK: - Convenience Methods

    /// GET 请求便捷方法
    func get<T: Codable>(_ path: String, parameters: [String: Any]? = nil) async throws -> T {
        let url = URL(string: "\(APIEndpoint.baseURL)\(path)")!
        let endpoint = CustomEndpoint(url: url, method: .get)
        return try await request(endpoint: endpoint, parameters: parameters)
    }

    /// POST 请求便捷方法
    func post<T: Codable>(_ path: String, parameters: [String: Any]? = nil) async throws -> T {
        let url = URL(string: "\(APIEndpoint.baseURL)\(path)")!
        let endpoint = CustomEndpoint(url: url, method: .post)
        return try await request(endpoint: endpoint, parameters: parameters)
    }

    /// PUT 请求便捷方法
    func put<T: Codable>(_ path: String, parameters: [String: Any]? = nil) async throws -> T {
        let url = URL(string: "\(APIEndpoint.baseURL)\(path)")!
        let endpoint = CustomEndpoint(url: url, method: .put)
        return try await request(endpoint: endpoint, parameters: parameters)
    }

    /// DELETE 请求便捷方法
    func delete<T: Codable>(_ path: String, parameters: [String: Any]? = nil) async throws -> T {
        let url = URL(string: "\(APIEndpoint.baseURL)\(path)")!
        let endpoint = CustomEndpoint(url: url, method: .delete)
        return try await request(endpoint: endpoint, parameters: parameters)
    }

    /// 刷新Token
    private func refreshToken() async throws {
        do {
            let _: TokenResponse = try await request(endpoint: .refreshToken)
        } catch {
            throw NetworkError.unauthorized
        }
    }

    // MARK: - Enhanced Request Methods

    /// 请求标准响应格式的API
    func requestWithStandardResponse<T: Codable>(
        endpoint: APIEndpoint,
        parameters: [String: Any]? = nil,
        headers: HTTPHeaders? = nil
    ) async throws -> T {
        let response: StandardResponse<T> = try await request(endpoint: endpoint, parameters: parameters, headers: headers)
        return try ResponseUtils.validateResponse(response)
    }

    /// 请求分页响应格式的API
    func requestWithPaginatedResponse<T: Codable>(
        endpoint: APIEndpoint,
        parameters: [String: Any]? = nil,
        headers: HTTPHeaders? = nil
    ) async throws -> (data: [T], pagination: PaginationInfo) {
        let response: PaginatedResponse<T> = try await request(endpoint: endpoint, parameters: parameters, headers: headers)
        return try ResponseUtils.validatePaginatedResponse(response)
    }

    /// 请求简单成功响应的API
    func requestWithSuccessResponse(
        endpoint: APIEndpoint,
        parameters: [String: Any]? = nil,
        headers: HTTPHeaders? = nil
    ) async throws -> String {
        let response: SuccessResponse = try await request(endpoint: endpoint, parameters: parameters, headers: headers)
        guard response.success else {
            throw APIError.serverError(response.message)
        }
        return response.message
    }

    /// 请求操作结果响应的API
    func requestWithOperationResult(
        endpoint: APIEndpoint,
        parameters: [String: Any]? = nil,
        headers: HTTPHeaders? = nil
    ) async throws -> OperationResult {
        let response: StandardResponse<OperationResult> = try await request(endpoint: endpoint, parameters: parameters, headers: headers)
        return try ResponseUtils.validateResponse(response)
    }

    /// 处理可能返回错误详细信息的API响应
    func requestWithErrorHandling<T: Codable>(
        endpoint: APIEndpoint,
        parameters: [String: Any]? = nil,
        headers: HTTPHeaders? = nil
    ) async throws -> T {
        do {
            let response: StandardResponse<T> = try await request(endpoint: endpoint, parameters: parameters, headers: headers)
            return try ResponseUtils.validateResponse(response)
        } catch NetworkError.serverError(_, let message) {
            // 尝试解析详细错误信息
            if let message = message {
                if message.contains("validation") {
                    throw NetworkError.validationError(message)
                } else if message.contains("unauthorized") {
                    throw NetworkError.unauthorized
                } else if message.contains("forbidden") {
                    throw NetworkError.forbidden
                } else if message.contains("not found") {
                    throw NetworkError.notFound
                } else {
                    throw NetworkError.serverMessage(message)
                }
            } else {
                throw NetworkError.unknownError
            }
        } catch {
            throw error
        }
    }

    // MARK: - Pixel Operations

    /// Fetch pixels within a specified bounds
    public func fetchPixels(in bounds: TileBounds, zoom: Int) async throws -> [Pixel] {
        let params: [String: Any] = [
            "minLat": bounds.minLatitude,
            "maxLat": bounds.maxLatitude,
            "minLon": bounds.minLongitude,
            "maxLon": bounds.maxLongitude,
            "zoom": zoom
        ]

        return try await request(endpoint: .getPixelsInArea, parameters: params)
    }

    // MARK: - Notifications

    /// 获取通知列表
    /// - Parameters:
    ///   - page: 页码，默认为 1
    ///   - limit: 每页数量，默认为 20
    ///   - unreadOnly: 是否只获取未读通知，默认为 false
    /// - Returns: 通知列表响应
    public func fetchNotifications(page: Int = 1, limit: Int = 20, unreadOnly: Bool = false) async throws -> NotificationListResponse {
        var queryItems = [
            URLQueryItem(name: "page", value: "\(page)"),
            URLQueryItem(name: "limit", value: "\(limit)")
        ]

        if unreadOnly {
            queryItems.append(URLQueryItem(name: "unread_only", value: "true"))
        }

        let endpoint = "/notifications"
        var urlComponents = URLComponents(string: baseURL + endpoint)!
        urlComponents.queryItems = queryItems

        guard let url = urlComponents.url else {
            throw APIError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("Bearer \(authToken ?? "")", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.networkError
        }

        guard httpResponse.statusCode == 200 else {
            throw APIError.serverError(httpResponse.statusCode)
        }

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return try decoder.decode(NotificationListResponse.self, from: data)
    }

    /// 获取未读通知数量
    /// - Returns: 未读数量
    public func getUnreadNotificationCount() async throws -> Int {
        let endpoint = "/notifications/unread-count"

        guard let url = URL(string: baseURL + endpoint) else {
            throw APIError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("Bearer \(authToken ?? "")", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.networkError
        }

        guard httpResponse.statusCode == 200 else {
            throw APIError.serverError(httpResponse.statusCode)
        }

        let decoder = JSONDecoder()
        let result = try decoder.decode(UnreadCountResponse.self, from: data)
        return result.data.unreadCount
    }

    /// 标记通知为已读
    /// - Parameter notificationId: 通知 ID
    public func markNotificationAsRead(_ notificationId: String) async throws {
        let endpoint = "/notifications/\(notificationId)/read"

        guard let url = URL(string: baseURL + endpoint) else {
            throw APIError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = "PUT"
        request.setValue("Bearer \(authToken ?? "")", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let (_, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.networkError
        }

        guard httpResponse.statusCode == 200 else {
            throw APIError.serverError(httpResponse.statusCode)
        }
    }

    /// 标记所有通知为已读
    /// - Parameter type: 可选，只标记特定类型的通知
    public func markAllNotificationsAsRead(type: String? = nil) async throws {
        var endpoint = "/notifications/mark-all-read"

        if let type = type {
            endpoint += "?type=\(type)"
        }

        guard let url = URL(string: baseURL + endpoint) else {
            throw APIError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = "PUT"
        request.setValue("Bearer \(authToken ?? "")", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let (_, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.networkError
        }

        guard httpResponse.statusCode == 200 else {
            throw APIError.serverError(httpResponse.statusCode)
        }
    }

    /// 删除通知
    /// - Parameter notificationId: 通知 ID
    public func deleteNotification(_ notificationId: String) async throws {
        let endpoint = "/notifications/\(notificationId)"

        guard let url = URL(string: baseURL + endpoint) else {
            throw APIError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = "DELETE"
        request.setValue("Bearer \(authToken ?? "")", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let (_, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.networkError
        }

        guard httpResponse.statusCode == 200 else {
            throw APIError.serverError(httpResponse.statusCode)
        }
    }
}

// Note: AuthResponse and TokenResponse are now defined as typealiases in SessionManager.swift
// to avoid conflicts with LoginResponse and TokenRefreshResponse in APIResponseModels.swift