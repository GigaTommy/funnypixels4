import Foundation
import Combine
#if canImport(UIKit)
import UIKit
#endif

/// 会话错误类型
enum SessionError: Error, LocalizedError {
    case notAuthenticated
    case invalidCredentials
    case sessionExpired
    case networkError(any Error)
    case keychainError(KeychainError)
    case apiError(APIError)
    case tokenRefreshFailed
    case userDataMissing
    case invalidEmail
    case invalidPassword
    case invalidUsername
    case guestConversionFailed(String)
    case unknown(any Error)

    var errorDescription: String? {
        switch self {
        case .notAuthenticated:
            return "用户未认证，请先登录"
        case .invalidCredentials:
            return "用户名或密码错误"
        case .sessionExpired:
            return "会话已过期，请重新登录"
        case .networkError(let error):
            return "网络错误: \(error.localizedDescription)"
        case .keychainError(let error):
            return "安全存储错误: \(error.localizedDescription)"
        case .apiError(let error):
            return "API 错误: \(error.localizedDescription)"
        case .tokenRefreshFailed:
            return "刷新令牌失败，请重新登录"
        case .userDataMissing:
            return "用户数据缺失"
        case .invalidEmail:
            return "邮箱格式无效"
        case .invalidPassword:
            return "密码格式无效（至少 8 位，包含字母和数字）"
        case .invalidUsername:
            return "用户名格式无效（3-20 位字母、数字或下划线）"
        case .guestConversionFailed(let message):
            return "游客账号转换失败: \(message)"
        case .unknown(let error):
            return "未知错误: \(error.localizedDescription)"
        }
    }

    var recoverySuggestion: String? {
        switch self {
        case .notAuthenticated, .sessionExpired, .tokenRefreshFailed:
            return "请重新登录"
        case .invalidCredentials:
            return "请检查用户名和密码是否正确"
        case .networkError:
            return "请检查网络连接后重试"
        case .invalidEmail:
            return "请输入有效的邮箱地址"
        case .invalidPassword:
            return "密码至少需要 8 位，包含字母和数字"
        case .invalidUsername:
            return "用户名需要 3-20 位字母、数字或下划线"
        default:
            return nil
        }
    }
}

/// 会话数据模型
struct SessionData: Codable {
    let userId: String
    let accessToken: String
    let refreshToken: String
    let isGuest: Bool
    let loginDate: Date
    let lastRefreshDate: Date?

    var isExpired: Bool {
        // Token 有效期为 24 小时
        guard let lastRefresh = lastRefreshDate else {
            return Date().timeIntervalSince(loginDate) > 24 * 60 * 60
        }
        return Date().timeIntervalSince(lastRefresh) > 24 * 60 * 60
    }

    var shouldRefresh: Bool {
        // 在过期前 1 小时刷新
        guard let lastRefresh = lastRefreshDate else {
            return Date().timeIntervalSince(loginDate) > 23 * 60 * 60
        }
        return Date().timeIntervalSince(lastRefresh) > 23 * 60 * 60
    }
}

// MARK: - Auth Response Types

/// Authentication response with user and token data
struct AuthResponse: Codable {
    let user: User
    let token: String
    let refreshToken: String

    init(user: User, token: String, refreshToken: String) {
        self.user = user
        self.token = token
        self.refreshToken = refreshToken
    }
}

/// Token refresh response
public struct TokenResponse: Codable {
    public let token: String
    public let refreshToken: String

    public init(token: String, refreshToken: String) {
        self.token = token
        self.refreshToken = refreshToken
    }
}

/// 用户会话管理器
/// 负责管理用户的认证状态、会话数据和令牌刷新
@MainActor
final class SessionManager: ObservableObject {

    // MARK: - Singleton

    static let shared = SessionManager()

    // MARK: - Published Properties

    /// 当前用户
    @Published private(set) var currentUser: User?

    /// 是否已认证
    @Published private(set) var isAuthenticated: Bool = false

    /// 是否是游客模式
    @Published private(set) var isGuest: Bool = false

    /// 当前访问令牌
    @Published private(set) var authToken: String?

    /// 加载状态
    @Published private(set) var isLoading: Bool = false

    /// 错误信息
    @Published private(set) var error: SessionError?

    /// 显示登录提示（用于游客模式限制操作）
    @Published var showLoginPrompt: Bool = false

    // MARK: - Private Properties

    private let keychainManager = KeychainManager.shared
    private let apiManager = APIManager.shared

    private var sessionData: SessionData?
    private var cancellables = Set<AnyCancellable>()
    private var tokenRefreshTask: Task<Void, Never>?

    /// 游客期间绘制的像素缓存
    private var guestDrawings: [Pixel] = []

    // MARK: - Initialization

    private init() {
        // 启动时尝试恢复会话
        Task {
            await restoreSession()
        }
    }

    // MARK: - Authentication Methods

    /// 用户登录
    /// - Parameters:
    ///   - email: 用户邮箱或手机号
    ///   - password: 用户密码
    /// - Throws: SessionError 如果登录失败
    func login(email: String, password: String) async throws {
        // 验证输入
        guard !email.isEmpty else {
            throw SessionError.invalidEmail
        }

        guard isValidPassword(password) else {
            throw SessionError.invalidPassword
        }

        isLoading = true
        error = nil

        defer {
            isLoading = false
        }

        do {
            // 调用 API 登录
            let authResponse: LoginResponse = try await apiManager.request(
                endpoint: .login,
                parameters: ["email": email, "password": password]
            )

            // 从响应中提取数据
            guard let data = authResponse.data else {
                throw SessionError.userDataMissing
            }

            // 保存会话数据
            try await saveSession(
                user: data.user,
                accessToken: data.token,
                refreshToken: data.refreshToken,
                isGuest: false
            )

            // 启动令牌刷新定时器
            startTokenRefreshTimer()

        } catch let networkError as NetworkError {
            if case .unauthorized = networkError {
                throw SessionError.invalidCredentials
            }
            throw SessionError.networkError(networkError)
        } catch let keychainError as KeychainError {
            throw SessionError.keychainError(keychainError)
        } catch {
            throw SessionError.unknown(error)
        }
    }

    /// 用户注册
    /// - Parameters:
    ///   - email: 用户邮箱
    ///   - password: 用户密码
    ///   - username: 用户名
    /// - Throws: SessionError 如果注册失败
    func register(email: String, password: String, username: String) async throws {
        // 验证输入
        guard isValidEmail(email) else {
            throw SessionError.invalidEmail
        }

        guard isValidPassword(password) else {
            throw SessionError.invalidPassword
        }

        guard isValidUsername(username) else {
            throw SessionError.invalidUsername
        }

        isLoading = true
        error = nil

        defer {
            isLoading = false
        }

        do {
            // 调用 API 注册
            let authResponse: LoginResponse = try await apiManager.request(
                endpoint: .register,
                parameters: ["email": email, "password": password, "username": username]
            )

            // 从响应中提取数据
            guard let data = authResponse.data else {
                throw SessionError.userDataMissing
            }

            // 保存会话数据
            try await saveSession(
                user: data.user,
                accessToken: data.token,
                refreshToken: data.refreshToken,
                isGuest: false
            )

            // 启动令牌刷新定时器
            startTokenRefreshTimer()

        } catch let networkError as NetworkError {
            throw SessionError.networkError(networkError)
        } catch let keychainError as KeychainError {
            throw SessionError.keychainError(keychainError)
        } catch {
            throw SessionError.unknown(error)
        }
    }

    /// 用户登出
    func logout() async {
        isLoading = true

        // 停止令牌刷新定时器
        tokenRefreshTask?.cancel()
        tokenRefreshTask = nil

        // 调用登出 API（即使失败也继续清除本地数据）
        do {
            struct EmptyResponse: Codable {}
            struct LogoutResponse: Codable {
                let success: Bool
                let message: String?
                let data: EmptyResponse?
            }
            let _: LogoutResponse = try await apiManager.get("/auth/logout")
        } catch {
            print("Logout API call failed: \(error)")
        }

        // 清除本地会话数据
        await clearSession()

        isLoading = false
    }

    /// 恢复会话
    /// 在应用启动时调用，尝试从 Keychain 恢复用户会话
    func restoreSession() async {
        isLoading = true

        do {
            // 从 Keychain 加载会话数据
            guard let savedSession = try keychainManager.load(SessionData.self, for: KeychainManager.Key.sessionData) else {
                isLoading = false
                return
            }

            sessionData = savedSession

            // 检查会话是否过期
            if savedSession.isExpired {
                // 尝试刷新令牌
                do {
                    try await refreshTokenIfNeeded()
                } catch {
                    // 刷新失败，清除会话
                    await clearSession()
                    isLoading = false
                    return
                }
            }

            // 加载用户数据
            guard let user = try keychainManager.loadCurrentUser() else {
                // 用户数据缺失，尝试从服务器获取
                do {
                    let user = try await fetchUserProfile()
                    try keychainManager.saveCurrentUser(user)
                    currentUser = user
                    return
                } catch {
                    await clearSession()
                    isLoading = false
                    return
                }
            }

            // 恢复会话状态
            currentUser = user
            authToken = savedSession.accessToken
            isAuthenticated = true
            isGuest = savedSession.isGuest

            // 启动令牌刷新定时器
            startTokenRefreshTimer()

        } catch {
            print("Failed to restore session: \(error)")
        }

        isLoading = false
    }

    /// 进入游客模式
    func enterGuestMode() {
        Task {
            isLoading = true
            error = nil

            do {
                // 生成设备 ID
                #if os(iOS)
                let deviceId = UIDevice.current.identifierForVendor?.uuidString ?? UUID().uuidString
                let deviceName = UIDevice.current.model
                let systemVersion = UIDevice.current.systemVersion
                #else
                let deviceId = UUID().uuidString
                let deviceName = "macOS"
                let systemVersion = ProcessInfo.processInfo.operatingSystemVersionString
                #endif

                // 调用游客登录 API - 使用 AuthManager 的方法
                let guestUser = try await AuthManager.shared.loginAsGuest()

                // 从 AuthManager 获取响应数据
                guard let token = AuthManager.shared.getAccessToken() else {
                    throw SessionError.userDataMissing
                }

                // 创建临时的会话数据
                let tempRefreshToken = token // 游客模式可能没有 refreshToken

                // 保存游客会话
                try await saveSession(
                    user: guestUser,
                    accessToken: token,
                    refreshToken: tempRefreshToken,
                    isGuest: true
                )

                // 启动令牌刷新定时器
                startTokenRefreshTimer()

            } catch let networkError as NetworkError {
                self.error = SessionError.networkError(networkError)
            } catch let keychainError as KeychainError {
                self.error = SessionError.keychainError(keychainError)
            } catch {
                self.error = SessionError.unknown(error)
            }

            isLoading = false
        }
    }

    // MARK: - Guest Mode Methods

    /// 检查是否需要认证才能绘制（游客限制）
    /// - Returns: 如果是游客模式，显示登录提示并返回 false；否则返回 true
    func requireAuthForDrawing() -> Bool {
        if isGuest {
            showLoginPrompt = true
            return false
        }
        return true
    }

    /// 添加游客绘制的像素到缓存
    /// - Parameter pixel: 游客绘制的像素
    func addGuestDrawing(_ pixel: Pixel) {
        guestDrawings.append(pixel)
        Logger.info("Guest drawing added: \(pixel.id)")
    }

    /// 迁移游客绘制的像素到正式用户账号
    /// - Parameter userId: 目标用户 ID
    /// - Throws: SessionError 如果迁移失败
    func migrateGuestDrawings(to userId: String) async throws {
        guard !guestDrawings.isEmpty else {
            Logger.info("No guest drawings to migrate")
            return
        }

        Logger.info("Migrating \(guestDrawings.count) guest drawings to user \(userId)")

        var successCount = 0
        var failureCount = 0

        for pixel in guestDrawings {
            do {
                // 创建新的像素对象，更新 authorId 为新用户 ID
                let updatedPixel = Pixel(
                    id: pixel.id,
                    latitude: pixel.latitude,
                    longitude: pixel.longitude,
                    color: pixel.color,
                    authorId: userId,
                    createdAt: pixel.createdAt,
                    updatedAt: Date()
                )

                // 提交到服务器 - 使用 APIManager 的 request 方法
                let _: Pixel = try await apiManager.request(
                    endpoint: .createPixel,
                    parameters: [
                        "latitude": updatedPixel.latitude,
                        "longitude": updatedPixel.longitude,
                        "color": updatedPixel.color
                    ]
                )

                successCount += 1
                Logger.info("Successfully migrated pixel \(pixel.id)")

            } catch {
                failureCount += 1
                Logger.error("Failed to migrate pixel \(pixel.id): \(error.localizedDescription)")
            }
        }

        // 清除游客缓存
        guestDrawings.removeAll()

        // 如果有失败的迁移，记录警告
        if failureCount > 0 {
            Logger.warning("Migration completed with \(successCount) successes and \(failureCount) failures")
        } else {
            Logger.info("Successfully migrated all \(successCount) guest drawings")
        }
    }

    /// 获取游客绘制的像素数量
    var guestDrawingsCount: Int {
        return guestDrawings.count
    }

    /// 清除游客绘制的像素缓存
    func clearGuestDrawings() {
        guestDrawings.removeAll()
        Logger.info("Guest drawings cache cleared")
    }

    /// 将游客账号转换为正式账号
    /// - Parameters:
    ///   - email: 用户邮箱
    ///   - password: 用户密码
    ///   - username: 用户名
    /// - Throws: SessionError 如果转换失败
    func convertGuestToUser(email: String, password: String, username: String) async throws {
        guard isGuest else {
            throw SessionError.guestConversionFailed("当前不是游客账号")
        }

        guard isAuthenticated else {
            throw SessionError.notAuthenticated
        }

        // 验证输入
        guard isValidEmail(email) else {
            throw SessionError.invalidEmail
        }

        guard isValidPassword(password) else {
            throw SessionError.invalidPassword
        }

        guard isValidUsername(username) else {
            throw SessionError.invalidUsername
        }

        isLoading = true
        error = nil

        defer {
            isLoading = false
        }

        do {
            // 保存当前游客绘制的像素数量（迁移前）
            let drawingsCount = guestDrawingsCount

            // 调用注册 API 将游客转换为正式用户
            let authResponse: LoginResponse = try await apiManager.request(
                endpoint: .register,
                parameters: ["email": email, "password": password, "username": username]
            )

            // 从响应中提取数据
            guard let data = authResponse.data else {
                throw SessionError.userDataMissing
            }

            // 更新会话数据
            try await saveSession(
                user: data.user,
                accessToken: data.token,
                refreshToken: data.refreshToken,
                isGuest: false
            )

            // 迁移游客绘制的像素到新用户账号
            if drawingsCount > 0 {
                Logger.info("Converting guest account with \(drawingsCount) drawings")
                try await migrateGuestDrawings(to: data.user.id)
            }

            Logger.info("Guest account successfully converted to user: \(data.user.username)")

        } catch let networkError as NetworkError {
            throw SessionError.guestConversionFailed(networkError.localizedDescription)
        } catch let keychainError as KeychainError {
            throw SessionError.keychainError(keychainError)
        } catch let caughtError {
            throw SessionError.unknown(caughtError)
        }
    }

    /// 刷新访问令牌（如果需要）
    /// - Throws: SessionError 如果刷新失败
    func refreshTokenIfNeeded() async throws {
        guard let session = sessionData else {
            throw SessionError.sessionExpired
        }

        // 检查是否需要刷新
        guard session.shouldRefresh else {
            return
        }

        do {
            // 调用刷新令牌 API - 直接调用 post 方法获取完整响应
            struct RefreshTokenRequest: Codable {
                let refreshToken: String
                enum CodingKeys: String, CodingKey {
                    case refreshToken = "refresh_token"
                }
            }

            let tokenRefreshResponse: TokenRefreshResponse = try await apiManager.request(
                endpoint: .refreshToken,
                parameters: ["refreshToken": session.refreshToken]
            )

            // 从响应中提取数据
            guard let tokenData = tokenRefreshResponse.data else {
                throw SessionError.tokenRefreshFailed
            }

            // 更新会话数据
            let updatedSession = SessionData(
                userId: session.userId,
                accessToken: tokenData.token,
                refreshToken: tokenData.refreshToken,
                isGuest: session.isGuest,
                loginDate: session.loginDate,
                lastRefreshDate: Date()
            )

            sessionData = updatedSession
            authToken = tokenData.token

            // 保存到 Keychain
            try keychainManager.save(updatedSession, for: KeychainManager.Key.sessionData)
            try keychainManager.saveAccessToken(tokenData.token)
            try keychainManager.saveRefreshToken(tokenData.refreshToken)

        } catch is NetworkError {
            throw SessionError.tokenRefreshFailed
        } catch let keychainError as KeychainError {
            throw SessionError.keychainError(keychainError)
        } catch let caughtError {
            throw SessionError.unknown(caughtError)
        }
    }

    // MARK: - Private Helper Methods

    /// 保存会话数据
    private func saveSession(
        user: User,
        accessToken: String,
        refreshToken: String,
        isGuest: Bool
    ) async throws {
        // 创建会话数据
        let session = SessionData(
            userId: user.id,
            accessToken: accessToken,
            refreshToken: refreshToken,
            isGuest: isGuest,
            loginDate: Date(),
            lastRefreshDate: nil
        )

        // 保存到 Keychain
        try keychainManager.save(session, for: KeychainManager.Key.sessionData)
        try keychainManager.saveAccessToken(accessToken)
        try keychainManager.saveRefreshToken(refreshToken)
        try keychainManager.saveUserId(user.id)
        try keychainManager.saveCurrentUser(user)

        // 更新状态
        sessionData = session
        currentUser = user
        authToken = accessToken
        isAuthenticated = true
        self.isGuest = isGuest
    }

    /// 清除会话数据
    private func clearSession() async {
        // 清除 Keychain 数据
        try? keychainManager.clearAuthData()

        // 重置状态
        sessionData = nil
        currentUser = nil
        authToken = nil
        isAuthenticated = false
        isGuest = false
        error = nil
    }

    /// 获取用户资料
    private func fetchUserProfile() async throws -> User {
        let response: AuthUserProfileResponse = try await apiManager.get("/auth/me")

        return AuthUser(
            id: response.id,
            username: response.username,
            email: response.email,
            displayName: response.displayName,
            avatar: response.avatar,
            createdAt: response.createdAt,
            updatedAt: response.updatedAt,
            lastLogin: response.lastLogin,
            isActive: response.isActive,
            preferences: response.preferences
        )
    }

    /// 启动令牌刷新定时器
    private func startTokenRefreshTimer() {
        // 取消现有任务
        tokenRefreshTask?.cancel()

        // 创建新的刷新任务
        tokenRefreshTask = Task {
            while !Task.isCancelled {
                // 每 30 分钟检查一次
                try? await Task.sleep(nanoseconds: 30 * 60 * 1_000_000_000)

                if Task.isCancelled { break }

                // 尝试刷新令牌
                do {
                    try await refreshTokenIfNeeded()
                } catch {
                    print("Token refresh failed: \(error)")
                    // 如果刷新失败，清除会话
                    await clearSession()
                    break
                }
            }
        }
    }

    // MARK: - Validation Helpers

    /// 验证邮箱格式
    private func isValidEmail(_ email: String) -> Bool {
        let emailRegex = "[A-Z0-9a-z._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,64}"
        let emailPredicate = NSPredicate(format: "SELF MATCHES %@", emailRegex)
        return emailPredicate.evaluate(with: email)
    }

    /// 验证密码格式（至少 8 位，包含字母和数字）
    private func isValidPassword(_ password: String) -> Bool {
        guard password.count >= 8 else { return false }

        let hasLetter = password.rangeOfCharacter(from: .letters) != nil
        let hasNumber = password.rangeOfCharacter(from: .decimalDigits) != nil

        return hasLetter && hasNumber
    }

    /// 验证用户名格式（3-20 位字母、数字或下划线）
    private func isValidUsername(_ username: String) -> Bool {
        guard username.count >= 3 && username.count <= 20 else { return false }

        let usernameRegex = "^[a-zA-Z0-9_]{3,20}$"
        let usernamePredicate = NSPredicate(format: "SELF MATCHES %@", usernameRegex)
        return usernamePredicate.evaluate(with: username)
    }
}

// MARK: - Public Convenience Methods

extension SessionManager {

    /// 检查用户是否已登录
    var isLoggedIn: Bool {
        return isAuthenticated && currentUser != nil
    }

    /// 获取当前用户 ID
    var currentUserId: String? {
        return currentUser?.id
    }

    /// 获取当前用户名
    var currentUsername: String? {
        return currentUser?.username
    }

    /// 是否需要刷新令牌
    var needsTokenRefresh: Bool {
        return sessionData?.shouldRefresh ?? false
    }

    /// 会话是否已过期
    var isSessionExpired: Bool {
        return sessionData?.isExpired ?? true
    }
}
