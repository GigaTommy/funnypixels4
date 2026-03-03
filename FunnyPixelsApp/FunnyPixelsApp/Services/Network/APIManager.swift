import Foundation
import Alamofire
import Combine

extension Notification.Name {
    static let sessionExpired = Notification.Name("sessionExpired")
}

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
    // 使用 AppEnvironment 配置的 API Base URL
    static let baseURL: String = AppEnvironment.current.apiBaseURL

    // 认证相关
    case login
    case accountLogin  // 账户登录（支持用户名/邮箱/手机号）
    case register
    case refreshToken
    case logout
    case appleLogin
    case googleLogin

    // 像素相关
    case getPixels
    case createPixel
    case drawPixel
    case updatePixel
    case deletePixel
    case getPixelsInArea
    case getPixelDetails
    case reportPixel
    case validatePixelState // New endpoint for pixel state validation


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

    // 排行榜相关
    case getPersonalLeaderboard
    case getAllianceLeaderboard
    case getFriendsLeaderboard
    case getRegionLeaderboard
    case likeLeaderboard
    case unlikeLeaderboard
    case getAvailableRegions
    case getUserRank
    
    // 社交相关
    case followUser(String)
    case unfollowUser(String)
    case checkFollowStatus(String)
    
    // 点赞相关
    case likePixel(String)
    case unlikePixel(String)
    case checkPixelLikeStatus(String)
    
    // 隐私设置
    case getPrivacySettings
    case updatePrivacySettings
    case getPublicPrivacySettings(String)

    var url: URL {
        let baseURLString = APIEndpoint.baseURL

        switch self {
        // 认证相关
        case .login:
            return URL(string: "\(baseURLString)/auth/login")!
        case .accountLogin:
            return URL(string: "\(baseURLString)/auth/account-login")!
        case .register:
            return URL(string: "\(baseURLString)/auth")!
        case .refreshToken:
            return URL(string: "\(baseURLString)/auth/refresh")!
        case .logout:
            return URL(string: "\(baseURLString)/auth/logout")!
        case .appleLogin:
            return URL(string: "\(baseURLString)/auth/apple")!
        case .googleLogin:
            return URL(string: "\(baseURLString)/auth/google")!

        // 像素相关
        case .getPixels:
            return URL(string: "\(baseURLString)/pixels")!
        case .createPixel:
            return URL(string: "\(baseURLString)/pixels")!
        case .drawPixel:
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
            return URL(string: "\(baseURLString)/reports")!
        case .validatePixelState:
            return URL(string: "\(baseURLString)/pixel-draw/validate")!


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

        // 排行榜相关
        case .getPersonalLeaderboard:
            return URL(string: "\(baseURLString)/leaderboard/personal")!
        case .getAllianceLeaderboard:
            return URL(string: "\(baseURLString)/leaderboard/alliance")!
        case .getFriendsLeaderboard:
            return URL(string: "\(baseURLString)/leaderboard/friends")!
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
            
        // Social
        case .followUser(let userId):
            return URL(string: "\(baseURLString)/social/follow/\(userId)")!
        case .unfollowUser(let userId):
            return URL(string: "\(baseURLString)/social/unfollow/\(userId)")!
        case .checkFollowStatus(let userId):
            return URL(string: "\(baseURLString)/social/follow-status/\(userId)")!
            
        // Pixel Like
        case .likePixel(let pixelId):
            return URL(string: "\(baseURLString)/pixels/\(pixelId)/like")!
        case .unlikePixel(let pixelId):
             return URL(string: "\(baseURLString)/pixels/\(pixelId)/like")!
        case .checkPixelLikeStatus(let pixelId):
             return URL(string: "\(baseURLString)/pixels/\(pixelId)/like-status")!
             
        // 隐私设置
        case .getPrivacySettings:
            return URL(string: "\(baseURLString)/privacy/settings")!
        case .updatePrivacySettings:
            return URL(string: "\(baseURLString)/privacy/settings")!
        case .getPublicPrivacySettings(let userId):
            return URL(string: "\(baseURLString)/privacy/user/\(userId)/settings")!
        }
    }

    var method: HTTPMethod {
        switch self {
        // POST 请求
        case .login, .accountLogin, .register, .createPixel, .drawPixel, .purchaseItem, .useItem, .changePassword, .createAlliance, .joinAlliance, .kickMember, .updateMemberRole, .transferLeadership, .generateInviteLink, .joinByInviteLink, .likeLeaderboard, .reportPixel, .sendVerificationCode, .verifyCode, .applyToAlliance, .processApplication, .refreshToken, .followUser, .likePixel, .appleLogin, .googleLogin:
            return .post

        // GET 请求
        case .getUserProfile, .getUserStats, .getPixels, .getPixelsInArea, .getPixelDetails, .getStoreItems, .getUserInventory, .getUserPoints, .getFlagPatterns, .getUserPixelHistory, .getUserPixelStats, .getLocationHistory, .getRegionStats, .getStatsOverview, .getUserAvailablePixels, .getUserAlliances, .getPublicAlliances, .searchAlliances, .getAllianceMembers, .getInviteLinks, .getPersonalLeaderboard, .getAllianceLeaderboard, .getFriendsLeaderboard, .getRegionLeaderboard, .getPendingApplications, .getAvailableFlagPatterns, .getAvailableRegions, .getUserRank, .validatePixelState, .checkFollowStatus, .checkPixelLikeStatus, .getPrivacySettings, .getPublicPrivacySettings:
            return .get

        // PUT 请求
        case .updatePixel, .updateAlliance, .updateProfile, .updatePrivacySettings:
            return .put

        // DELETE 请求
        case .logout, .deletePixel, .leaveAlliance, .deleteInviteLink, .unlikeLeaderboard, .disbandAlliance, .deleteAccount, .unfollowUser, .unlikePixel:
            return .delete
        }
    }
}

/// Actor for thread-safe token refresh state management (Swift 6 compatible)
private actor TokenRefreshState {
    private var isRefreshing = false
    private var pendingWaiters: [CheckedContinuation<Void, Error>] = []

    func beginRefreshIfNeeded() async -> Bool {
        if isRefreshing {
            // Already refreshing, wait for completion
            return false
        }
        isRefreshing = true
        return true
    }

    func addWaiter(_ continuation: CheckedContinuation<Void, Error>) {
        pendingWaiters.append(continuation)
    }

    func completeRefresh(error: Error? = nil) {
        isRefreshing = false
        let waiters = pendingWaiters
        pendingWaiters.removeAll()

        for waiter in waiters {
            if let error = error {
                waiter.resume(throwing: error)
            } else {
                waiter.resume(returning: ())
            }
        }
    }
}

/// API 管理器
public class APIManager: ObservableObject {
    public static let shared = APIManager()

    private let session: Session
    @Published var isLoading = false
    @Published var errorMessage: String?

    /// 防止token刷新死循环 (Swift 6 compatible actor)
    private let tokenRefreshState = TokenRefreshState()

    private init() {
        // 配置会话
        let configuration = URLSessionConfiguration.default
        // ⚡ 网络超时设置
        // - request: 单个请求的超时时间（15秒足够处理头像上传、CDN生成等耗时操作）
        // - resource: 整个资源下载的超时时间（30秒）
        configuration.timeoutIntervalForRequest = 15   // 增加到15秒，支持头像上传等耗时操作
        configuration.timeoutIntervalForResource = 30  // 增加到30秒

        // 启用 HTTP 缓存：服务器返回 Cache-Control 头后，URLSession 自动缓存响应
        // 缓存命中时零网络开销，比 ViewModel 层缓存更高效
        configuration.urlCache = URLCache(
            memoryCapacity: 10 * 1024 * 1024,   // 10 MB 内存
            diskCapacity: 50 * 1024 * 1024       // 50 MB 磁盘
        )
        configuration.requestCachePolicy = .useProtocolCachePolicy

        self.session = Session(configuration: configuration)
    }

    /// 通用请求方法
    func request<T: Codable>(
        endpoint: APIEndpoint,
        parameters: [String: Any]? = nil,
        headers: HTTPHeaders? = nil,
        isRetry: Bool = false
    ) async throws -> T {

        isLoading = true
        errorMessage = nil

        defer {
            isLoading = false
        }

        let startTime = Date()
        var url = endpoint.url

        // 为GET请求添加查询参数
        if endpoint.method == .get, let parameters = parameters, !parameters.isEmpty {
            var urlComponents = URLComponents(url: url, resolvingAgainstBaseURL: false)!
            urlComponents.queryItems = parameters.map { key, value in
                URLQueryItem(name: key, value: "\(value)")
            }
            url = urlComponents.url ?? url
        }

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

        // 添加语言头
        httpHeaders["Accept-Language"] = LocalizationManager.currentLanguageForHeaders

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
            guard afResponse.response != nil else {
                throw NetworkError.noData
            }

            _ = Date().timeIntervalSince(startTime)

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

            guard let httpResponse = afResponse.response else {
                throw NetworkError.noData
            }

            switch httpResponse.statusCode {
            case 200...299:
                do {
                    let decodedResponse = try JSONDecoder().decode(T.self, from: data)

                    // 如果是标准响应，进行验证
                    // 这里需要更复杂的类型检查，暂时跳过自动验证
                    // 用户可以使用 requestWithStandardResponse 方法进行验证

                    return decodedResponse
                } catch let decodingError as DecodingError {
                    if let jsonString = String(data: data, encoding: .utf8) {
                        Logger.error("❌ Decoding failed for \(url.absoluteString). Response: \(jsonString)")
                        // Attempt to pretty print if possible for clearer logs
                         if let jsonObject = try? JSONSerialization.jsonObject(with: data, options: []),
                            let prettyData = try? JSONSerialization.data(withJSONObject: jsonObject, options: .prettyPrinted),
                            let prettyString = String(data: prettyData, encoding: .utf8) {
                             Logger.error("❌ Pretty JSON: \(prettyString)")
                         }
                    }
                    throw NetworkError.decodingFailed(decodingError)
                }

            case 401, 403:
                // 401 = token 缺失, 403 = token 过期/无效 → 都尝试刷新
                // 跳过 refresh endpoint 本身避免死循环
                if case .refreshToken = endpoint {
                    Logger.error("❌ Refresh token endpoint returned \(httpResponse.statusCode) - session expired")
                    await MainActor.run {
                        NotificationCenter.default.post(name: .sessionExpired, object: nil)
                    }
                    throw NetworkError.unauthorized
                }

                guard !isRetry else {
                    Logger.error("❌ \(httpResponse.statusCode) after token refresh retry, giving up")
                    throw NetworkError.unauthorized
                }
                Logger.info("🔄 Got \(httpResponse.statusCode), attempting token refresh...")
                try await refreshToken()
                // 重新请求 (仅重试一次)
                return try await request(endpoint: endpoint, parameters: parameters, headers: headers, isRetry: true)

            case 400:
                // Bad Request - 尝试解析错误信息
                var errorMessage: String? = nil
                if let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
                    // ✅ 优先使用 message（用户友好消息），再使用 error（错误代码）
                    errorMessage = json["message"] as? String ?? json["error"] as? String
                }
                Logger.warning("⚠️ 400 Bad Request: \(errorMessage ?? "Unknown error")")
                throw NetworkError.serverError(400, errorMessage)

            case 404:
                throw NetworkError.notFound

            case 500...599:
                // 服务器错误
                var errorMessage: String? = nil
                if let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
                    // ✅ 优先使用 message（用户友好消息），再使用 error（错误代码）
                    errorMessage = json["message"] as? String ?? json["error"] as? String
                }
                throw NetworkError.serverError(httpResponse.statusCode, errorMessage)

            default:
                let error = NetworkError.serverError(httpResponse.statusCode, nil)
                throw error
            }
        } catch {
            _ = Date().timeIntervalSince(startTime)

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
        headers: HTTPHeaders? = nil,
        decoder: JSONDecoder? = nil
    ) async throws -> T {

        isLoading = true
        errorMessage = nil

        defer {
            isLoading = false
        }

        let startTime = Date()
        var url = endpoint.url

        // 为GET请求添加查询参数
        if endpoint.method == .get, let parameters = parameters, !parameters.isEmpty {
            var urlComponents = URLComponents(url: url, resolvingAgainstBaseURL: false)!
            urlComponents.queryItems = parameters.map { key, value in
                URLQueryItem(name: key, value: "\(value)")
            }
            url = urlComponents.url ?? url
        }

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

        // 添加语言头
        httpHeaders["Accept-Language"] = LocalizationManager.currentLanguageForHeaders

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
            guard afResponse.response != nil else {
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
                Logger.warning("⚠️ API request took longer than expected: \(url.absoluteString)")
            }

            // 解码响应
            do {
                let responseDecoder = decoder ?? JSONDecoder()
                return try responseDecoder.decode(T.self, from: data)
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
            _ = Date().timeIntervalSince(startTime)

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
    func get<T: Codable>(_ path: String, parameters: [String: Any]? = nil, decoder: JSONDecoder? = nil) async throws -> T {
        let url = URL(string: "\(APIEndpoint.baseURL)\(path)")!
        let endpoint = CustomEndpoint(url: url, method: .get)
        return try await request(endpoint: endpoint, parameters: parameters, decoder: decoder)
    }

    /// POST 请求便捷方法
    func post<T: Codable>(_ path: String, parameters: [String: Any]? = nil, decoder: JSONDecoder? = nil) async throws -> T {
        let url = URL(string: "\(APIEndpoint.baseURL)\(path)")!
        let endpoint = CustomEndpoint(url: url, method: .post)
        return try await request(endpoint: endpoint, parameters: parameters, decoder: decoder)
    }

    /// PUT 请求便捷方法
    func put<T: Codable>(_ path: String, parameters: [String: Any]? = nil, decoder: JSONDecoder? = nil) async throws -> T {
        let url = URL(string: "\(APIEndpoint.baseURL)\(path)")!
        let endpoint = CustomEndpoint(url: url, method: .put)
        return try await request(endpoint: endpoint, parameters: parameters, decoder: decoder)
    }

    /// DELETE 请求便捷方法
    func delete<T: Codable>(_ path: String, parameters: [String: Any]? = nil, decoder: JSONDecoder? = nil) async throws -> T {
        let url = URL(string: "\(APIEndpoint.baseURL)\(path)")!
        let endpoint = CustomEndpoint(url: url, method: .delete)
        return try await request(endpoint: endpoint, parameters: parameters, decoder: decoder)
    }

    /// 刷新Token（带防重入保护，Swift 6 compatible）
    private func refreshToken() async throws {
        // 检查是否已在刷新中
        let shouldRefresh = await tokenRefreshState.beginRefreshIfNeeded()

        if !shouldRefresh {
            // 已在刷新中，等待完成
            Logger.info("🔄 Token refresh already in progress, waiting...")
            return try await withCheckedThrowingContinuation { continuation in
                Task {
                    await tokenRefreshState.addWaiter(continuation)
                }
            }
        }

        do {
            // 获取refresh token（不用 try? 以便记录真实错误）
            let refreshTokenValue: String?
            do {
                refreshTokenValue = try KeychainManager.shared.loadRefreshToken()
            } catch {
                Logger.error("❌ Failed to load refresh token from Keychain: \(error.localizedDescription)")
                refreshTokenValue = nil
            }

            guard let refreshTokenValue, !refreshTokenValue.isEmpty else {
                Logger.error("❌ No refresh token available")
                await MainActor.run {
                    NotificationCenter.default.post(name: .sessionExpired, object: nil)
                }
                await tokenRefreshState.completeRefresh(error: NetworkError.unauthorized)
                throw NetworkError.unauthorized
            }

            // 参数名必须与后端匹配: const { refreshToken } = req.body (camelCase)
            let parameters = ["refreshToken": refreshTokenValue]

            // 直接构建请求避免递归
            let url = APIEndpoint.refreshToken.url
            var urlRequest = URLRequest(url: url)
            urlRequest.httpMethod = "POST"
            urlRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")

            // refresh请求也需要带当前的access token
            if let accessToken = AuthManager.shared.getAccessToken() {
                urlRequest.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
            }

            urlRequest.httpBody = try JSONSerialization.data(withJSONObject: parameters)

            let afResponse = await session.request(urlRequest).serializingData().response

            guard let data = afResponse.value,
                  let httpResponse = afResponse.response else {
                await tokenRefreshState.completeRefresh(error: NetworkError.noData)
                throw NetworkError.noData
            }

            if httpResponse.statusCode == 200 || httpResponse.statusCode == 201 {
                let response = try JSONDecoder().decode(TokenResponse.self, from: data)
                // 保存新token
                try KeychainManager.shared.saveAccessToken(response.token)
                try KeychainManager.shared.saveRefreshToken(response.refreshToken)
                Logger.info("✅ Token refreshed successfully")
                await tokenRefreshState.completeRefresh()
            } else if httpResponse.statusCode == 401 || httpResponse.statusCode == 403 {
                // 401 或 403 都表示 refresh token 无效
                Logger.error("❌ Refresh token expired or invalid (status: \(httpResponse.statusCode))")
                await MainActor.run {
                    NotificationCenter.default.post(name: .sessionExpired, object: nil)
                }
                await tokenRefreshState.completeRefresh(error: NetworkError.unauthorized)
                throw NetworkError.unauthorized
            } else {
                Logger.error("❌ Token refresh failed with status: \(httpResponse.statusCode)")
                let error = NetworkError.serverError(httpResponse.statusCode, nil)
                await tokenRefreshState.completeRefresh(error: error)
                throw error
            }
        } catch {
            Logger.error("❌ Token refresh failed: \(error.localizedDescription)")
            // Refresh failed, notify session expiry
            await MainActor.run {
                NotificationCenter.default.post(name: .sessionExpired, object: nil)
            }

            await tokenRefreshState.completeRefresh(error: error)
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

    /// Perform a URLRequest directly (for new service files)
    /// - Parameters:
    ///   - urlRequest: The request to perform
    ///   - rateLimitRetry: Internal retry counter for 429 responses (max 2 retries)
    func performRequest<T: Codable>(_ urlRequest: URLRequest, rateLimitRetry: Int = 0) async throws -> T {
        _ = Date()

        let afRequest = session.request(urlRequest)

        do {
            let afResponse = await afRequest.serializingData().response
            guard let data = afResponse.value else {
                Logger.error("API Error: No data received for \(urlRequest.url?.absoluteString ?? "unknown")")
                Logger.error("Response status: \(afResponse.response?.statusCode ?? -1)")
                throw NetworkError.noData
            }

            // Log response for debugging
            if let jsonString = String(data: data, encoding: .utf8) {
                Logger.debug("API Response (\(urlRequest.httpMethod ?? "GET")) \(urlRequest.url?.absoluteString ?? "unknown")): \(jsonString)")
            }

            // Check for error status codes
            if let httpResponse = afResponse.response {
                if httpResponse.statusCode == 401 {
                    // Token 过期，尝试刷新
                    Logger.info("🔒 401 Unauthorized for \(urlRequest.url?.absoluteString ?? "unknown") - attempting refresh")
                    try await refreshToken()

                    // 重新构建请求（可能需要新的 Token）
                    var newRequest = urlRequest
                    if let token = AuthManager.shared.getAccessToken() {
                        newRequest.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
                    }

                    // 重新请求
                    return try await performRequest(newRequest)
                }

                // 429 Too Many Requests — 读取 Retry-After 头，指数退避重试（最多 2 次）
                if httpResponse.statusCode == 429 {
                    let retryAfterStr = httpResponse.value(forHTTPHeaderField: "Retry-After")
                    let retryAfter = TimeInterval(retryAfterStr ?? "") ?? 2.0

                    guard rateLimitRetry < 2 else {
                        Logger.error("⏱️ 429 Rate limited after \(rateLimitRetry) retries for \(urlRequest.url?.absoluteString ?? "unknown")")
                        throw NetworkError.rateLimited(retryAfter: retryAfter)
                    }

                    // 指数退避：第1次等 retryAfter 秒，第2次等 retryAfter×2 秒，上限 10 秒
                    let delay = min(retryAfter * pow(2.0, Double(rateLimitRetry)), 10.0)
                    Logger.info("⏱️ 429 Rate limited, retry #\(rateLimitRetry + 1) after \(String(format: "%.1f", delay))s")
                    try await Task.sleep(nanoseconds: UInt64(delay * 1_000_000_000))
                    return try await performRequest(urlRequest, rateLimitRetry: rateLimitRetry + 1)
                }

                if httpResponse.statusCode >= 400 {
                    Logger.error("API Error: Status \(httpResponse.statusCode) for \(urlRequest.url?.absoluteString ?? "unknown")")
                    if let jsonString = String(data: data, encoding: .utf8) {
                        Logger.error("Error response: \(jsonString)")
                    }

                    // Try to parse error message from response body using JSONSerialization
                    var errorMessage: String? = nil
                    if let jsonString = String(data: data, encoding: .utf8), !jsonString.isEmpty,
                       let errorData = jsonString.data(using: .utf8),
                       let json = try? JSONSerialization.jsonObject(with: errorData) as? [String: Any] {
                        errorMessage = json["error"] as? String ?? json["message"] as? String
                    }

                    throw NetworkError.serverError(httpResponse.statusCode, errorMessage)
                }
            }

            let decoded = try JSONDecoder().decode(T.self, from: data)
            return decoded
        } catch let error as NetworkError {
            // Already a NetworkError, just rethrow
            Logger.error("API request failed for \(urlRequest.url?.absoluteString ?? "unknown"): \(error.localizedDescription)")
            throw error
        } catch {
            Logger.error("API decode error for \(urlRequest.url?.absoluteString ?? "unknown"): \(error.localizedDescription)")
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
}

// MARK: - Token Response Model

/// Authentication response with user and token data — used by AuthManager for login flows.
/// Previously defined in SessionManager.swift (now removed).
struct AuthResponse: Codable {
    let user: User
    let tokens: Tokens?

    var token: String {
        return tokens?.accessToken ?? ""
    }

    var refreshToken: String {
        return tokens?.refreshToken ?? ""
    }

    init(user: User, token: String, refreshToken: String) {
        self.user = user
        self.tokens = Tokens(accessToken: token, refreshToken: refreshToken)
    }

    struct Tokens: Codable {
        let accessToken: String
        let refreshToken: String
    }
}

/// Token refresh response — used by APIManager and AuthManager for token refresh flow.
/// Previously defined in SessionManager.swift (now removed).
public struct TokenResponse: Codable {
    public let tokens: Tokens?

    public var token: String {
        return tokens?.accessToken ?? ""
    }

    public var refreshToken: String {
        return tokens?.refreshToken ?? ""
    }

    public init(token: String, refreshToken: String) {
        self.tokens = Tokens(accessToken: token, refreshToken: refreshToken)
    }

    public struct Tokens: Codable {
        public let accessToken: String
        public let refreshToken: String

        public init(accessToken: String, refreshToken: String) {
            self.accessToken = accessToken
            self.refreshToken = refreshToken
        }
    }
}