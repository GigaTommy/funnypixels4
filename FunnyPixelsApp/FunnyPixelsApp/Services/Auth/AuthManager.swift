import Foundation
import Combine
#if canImport(UIKit)
import UIKit
#endif

/// 认证管理器
class AuthManager: ObservableObject {
    static let shared = AuthManager()

    @Published var isAuthenticated = false
    @Published var currentUser: User?
    @Published var isGuest = false
    /// 是否正在验证会话（用于显示启动加载状态）
    @Published var isValidatingSession = false

    private let keychainManager = KeychainManager.shared

    private let accessTokenKey = "access_token"
    private let refreshTokenKey = "refresh_token"
    private let userIdKey = "user_id"
    private let isGuestKey = "is_guest"

    private var cancellables = Set<AnyCancellable>()

    private init() {
        setupObservers()
        loadStoredAuthData()
    }

    private func setupObservers() {
        NotificationCenter.default.publisher(for: .sessionExpired)
            .sink { [weak self] _ in
                Logger.info("🔄 Session expired received in AuthManager - clearing data")
                Task {
                    await self?.clearAuthData()
                }
            }
            .store(in: &cancellables)
    }

    /// 登录（手机验证码）
    func login(phone: String, code: String) async throws -> User {
        let parameters = [
            "phone": phone,
            "code": code
        ]

        let response: AuthResponse = try await APIManager.shared.request(
            endpoint: .login,
            parameters: parameters
        )

        // 保存认证信息
        try saveAuthData(response, isGuest: false)

        return response.user
    }

    /// 账号密码登录（支持用户名/邮箱/手机号）
    func loginWithAccount(account: String, password: String) async throws -> User {
        // 检测账号类型
        let accountType = detectAccountType(account)
        Logger.userAction("Account login attempt", details: ["account": account, "type": accountType])

        // ✅ 使用统一的 account-login 端点
        let parameters: [String: Any] = [
            "account": account,
            "password": password
        ]

        let response: AuthResponse = try await APIManager.shared.request(
            endpoint: .accountLogin,
            parameters: parameters
        )

        // 保存认证信息
        try saveAuthData(response, isGuest: false)

        return response.user
    }

    /// Apple 登录
    func loginWithApple(identityToken: String, authorizationCode: String?, fullName: String?, email: String?) async throws -> User {
        var parameters: [String: Any] = [
            "identity_token": identityToken
        ]

        if let authorizationCode = authorizationCode {
            parameters["authorization_code"] = authorizationCode
        }
        if let fullName = fullName, !fullName.isEmpty {
            parameters["full_name"] = fullName
        }
        if let email = email, !email.isEmpty {
            parameters["email"] = email
        }

        Logger.userAction("Apple login attempt", details: ["has_email": email != nil])

        let response: AuthResponse = try await APIManager.shared.request(
            endpoint: .appleLogin,
            parameters: parameters
        )

        // 保存认证信息
        try saveAuthData(response, isGuest: false)

        // 连接 Socket
        Task {
            await SocketIOManager.shared.connect(
                userId: response.user.id,
                username: response.user.username
            )
        }

        return response.user
    }

    /// Google 登录
    func loginWithGoogle(idToken: String, fullName: String?, email: String?) async throws -> User {
        var parameters: [String: Any] = [
            "id_token": idToken
        ]

        if let fullName = fullName, !fullName.isEmpty {
            parameters["full_name"] = fullName
        }
        if let email = email, !email.isEmpty {
            parameters["email"] = email
        }

        Logger.userAction("Google login attempt", details: ["has_email": email != nil])

        let response: AuthResponse = try await APIManager.shared.request(
            endpoint: .googleLogin,
            parameters: parameters
        )

        // 保存认证信息
        try saveAuthData(response, isGuest: false)

        // 连接 Socket
        Task {
            await SocketIOManager.shared.connect(
                userId: response.user.id,
                username: response.user.username
            )
        }

        return response.user
    }

    /// 检测账号类型
    private func detectAccountType(_ account: String) -> AccountType {
        // 邮箱格式检测 - 更宽松的匹配，只要包含 @ 即可
        if account.contains("@") {
            // 简单检查：包含 @ 且 @ 不在开头或结尾
            let parts = account.split(separator: "@", maxSplits: 1)
            if parts.count == 2 && !parts[0].isEmpty && !parts[1].isEmpty {
                return .email
            }
        }

        // 手机号格式检测（中国手机号）
        let phoneRegex = "^1[3-9]\\d{9}$"
        let cleanedPhone = account.replacingOccurrences(of: "\\D", with: "", options: .regularExpression)
        if let _ = cleanedPhone.range(of: phoneRegex, options: .regularExpression) {
            return .phone
        }

        // 默认作为用户名处理
        return .username
    }

    /// 注册
    func register(phone: String, code: String, username: String) async throws -> User {
        let parameters = [
            "phone": phone,
            "code": code,
            "username": username
        ]

        let response: AuthResponse = try await APIManager.shared.request(
            endpoint: .register,
            parameters: parameters
        )

        // 保存认证信息
        try saveAuthData(response, isGuest: false)

        return response.user
    }

    /// 游客登录
    func loginAsGuest() async throws -> User {
        #if canImport(UIKit)
        let parameters = [
            "device_id": UIDevice.current.identifierForVendor?.uuidString ?? UUID().uuidString,
            "device_name": UIDevice.current.model,
            "system_version": UIDevice.current.systemVersion
        ] as [String: Any]
        #else
        let parameters = [
            "device_id": UUID().uuidString,
            "device_name": "Unknown",
            "system_version": "Unknown"
        ] as [String: Any]
        #endif

        let response: AuthResponse = try await APIManager.shared.request(
            endpoint: .login,
            parameters: parameters
        )

        // 保存认证信息
        try saveAuthData(response, isGuest: true)

        return response.user
    }

    /// 登出
    func logout() async {
        do {
            let _: String = try await APIManager.shared.request(endpoint: .logout)
        } catch {
            Logger.error("Logout request failed: \(error)")
        }

        // 清除本地数据
        await clearAuthData()
    }

    /// 刷新Token
    func refreshToken() async throws {
        guard let refreshToken = getRefreshToken() else {
            throw AuthError.noRefreshToken
        }

        // 参数名必须与后端匹配: const { refreshToken } = req.body (camelCase)
        let parameters = ["refreshToken": refreshToken]

        let response: TokenResponse = try await APIManager.shared.request(
            endpoint: .refreshToken,
            parameters: parameters
        )

        // 更新Token
        try keychainManager.saveAccessToken(response.token)
        try keychainManager.saveRefreshToken(response.refreshToken)
    }

    /// 获取用户信息
    func fetchUserProfile() async throws -> AuthUser {
        let wrapper: UserProfileWrapper = try await APIManager.shared.request(
            endpoint: .getUserProfile
        )
        let response = wrapper.user

        // 使用默认值处理可选字段
        // avatarUrl: CDN/文件路径（用于所有显示场景）
        // avatar: 不在前端使用（后端从数据库读取生成sprite）
        let user = AuthUser(
            id: response.id,
            username: response.username,
            email: response.email,
            displayName: response.displayName,
            avatarUrl: response.avatarUrl,  // ✅ CDN路径（用于所有显示）
            avatar: nil,                     // ❌ 前端不使用（后端从数据库读取）
            createdAt: response.createdAt,
            updatedAt: response.updatedAt,
            lastLogin: response.lastLogin,
            isActive: response.isActive ?? true,
            totalPixels: response.totalPixels,
            currentPixels: response.currentPixels,
            preferences: response.preferences ?? .default,
            alliance: response.alliance != nil ? AuthUser.UserAlliance(
                id: response.alliance?.id ?? "",
                name: response.alliance?.name ?? "",
                flagPatternId: response.alliance?.flagPatternId
            ) : nil,
            rankTier: response.rankTier
        )

        // 更新当前用户信息
        await MainActor.run {
            self.currentUser = user
            // 保存用户信息到Keychain
            try? self.keychainManager.saveUserId(user.id)
        }

        return user
    }

    /// 更新用户资料
    func updateProfile(profileData: [String: Any]) async throws -> AuthUser {
        let wrapper: UserProfileWrapper = try await APIManager.shared.request(
            endpoint: .updateProfile,
            parameters: profileData
        )
        let response = wrapper.user

        // 使用默认值处理可选字段
        // avatarUrl: CDN/文件路径（用于加载图片）
        // avatar: 像素数据（已弃用，设为 nil）
        let updatedUser = AuthUser(
            id: response.id,
            username: response.username,
            email: response.email,
            displayName: response.displayName,
            avatarUrl: response.avatarUrl,  // ✅ CDN/文件路径
            avatar: nil,                    // ❌ 不再使用像素数据
            createdAt: response.createdAt,
            updatedAt: response.updatedAt,
            lastLogin: response.lastLogin,
            isActive: response.isActive ?? true,
            totalPixels: response.totalPixels,
            currentPixels: nil,
            preferences: response.preferences ?? .default,
            alliance: response.alliance != nil ? AuthUser.UserAlliance(
                id: response.alliance?.id ?? "",
                name: response.alliance?.name ?? "",
                flagPatternId: response.alliance?.flagPatternId
            ) : nil,
            rankTier: response.rankTier
        )

        await MainActor.run {
            self.currentUser = updatedUser
            Logger.info("👤 AuthManager.refreshUserProfile: Updated user alliance info - allianceName=\(updatedUser.alliance?.name ?? "nil"), flagPatternId=\(updatedUser.alliance?.flagPatternId ?? "nil")")
        }

        return updatedUser
    }

    /// 修改密码
    func changePassword(currentPassword: String, newPassword: String) async throws {
        let parameters = [
            "current_password": currentPassword,
            "new_password": newPassword
        ] as [String: Any]

        let _: ChangePasswordResponse = try await APIManager.shared.request(
            endpoint: .changePassword,
            parameters: parameters
        )
    }

    // MARK: - Private Methods

    private func saveAuthData(_ response: AuthResponse, isGuest: Bool) throws {
        // 保存Token
        try keychainManager.saveAccessToken(response.token)
        try keychainManager.saveRefreshToken(response.refreshToken)

        // 保存用户信息
        try keychainManager.saveUserId(response.user.id)
        try keychainManager.saveToken(isGuest ? "true" : "false", for: isGuestKey)

        // 更新状态
        let userId = response.user.id
        let username = response.user.username
        Task { @MainActor in
            self.currentUser = response.user
            self.isAuthenticated = true
            self.isGuest = isGuest
            Logger.info("👤 AuthManager.saveAuthData: Saved user data - username=\(username), allianceName=\(response.user.alliance?.name ?? "nil"), flagPatternId=\(response.user.alliance?.flagPatternId ?? "nil")")
        }

        // 🚀 Connect Socket.IO（不阻塞登录流程）
        Task.detached {
            await SocketIOManager.shared.connect(userId: userId, username: username)
        }
    }

    private func loadStoredAuthData() {
        Task {
            let accessToken = try? keychainManager.loadAccessToken()
            let storedUserId = try? keychainManager.loadUserId()
            let isGuestString = try? keychainManager.loadToken(for: isGuestKey)

            processStoredAuthData(
                accessToken: accessToken,
                storedUserId: storedUserId,
                isGuest: isGuestString == "true"
            )
        }
    }

    /// 处理从 Keychain 读取的认证数据
    /// ✅ iOS 最佳实践：先验证 token，成功后才进入 app
    @MainActor
    private func processStoredAuthData(accessToken: String?, storedUserId: String?, isGuest: Bool) {
        guard let accessToken = accessToken, !accessToken.isEmpty else {
            Logger.info("🔐 No stored access token, showing login screen")
            return
        }

        // ✅ 显示验证中状态（品牌化加载界面）
        self.isValidatingSession = true
        Logger.info("🔐 Found stored token, validating session...")

        // ✅ 先验证 token，成功后才设置 isAuthenticated = true
        Task {
            // ✅ 2秒超时（快速失败策略）- 不让用户等太久
            let timeoutTask = Task {
                try? await Task.sleep(nanoseconds: 2_000_000_000)  // 2秒
                await MainActor.run {
                    if self.isValidatingSession {
                        Logger.warning("⚠️ Session validation timed out after 2s, showing login screen")
                        self.isValidatingSession = false
                        // ✅ 超时不进入 app，显示登录界面（不清除 token，下次再试）
                    }
                }
            }

            defer {
                timeoutTask.cancel()
                Task { @MainActor in
                    self.isValidatingSession = false
                }
            }

            do {
                // 尝试获取用户信息来验证 token（API 超时 5s，但 watchdog 2s 会截断）
                let user = try await fetchUserProfile()

                // ✅ Token 有效，现在才设置认证状态
                await MainActor.run {
                    self.currentUser = user
                    self.isAuthenticated = true
                    self.isGuest = isGuest
                    Logger.info("✅ Session validated successfully for user: \(user.username)")
                }

                // 🚀 Connect Socket.IO（不阻塞主流程，后台连接）
                Task.detached {
                    await SocketIOManager.shared.connect(
                        userId: user.id,
                        username: user.username
                    )
                }
            } catch {
                Logger.error("❌ Session validation failed: \(error)")

                // 验证失败，检查错误类型
                if let networkError = error as? NetworkError {
                    switch networkError {
                    case .unauthorized, .forbidden:
                        // Token 无效/过期 - 清除数据，显示登录界面
                        Logger.warning("🔓 Token invalid/expired - clearing auth data")
                        await clearAuthData()
                        return
                    default:
                        break
                    }
                } else if (error as NSError).code == 401 {
                    // 401 认证错误 - 清除数据
                    Logger.warning("🔓 Token 401 - clearing auth data")
                    await clearAuthData()
                    return
                }

                // 网络问题（非认证错误）：不清除 token，下次启动再试
                // 用户会看到登录界面，但 token 仍保存，网络恢复后可自动登录
                Logger.warning("⚠️ Network error during validation, keeping token for next retry")
            }
        }
    }

    /// 清除认证数据 (Internal for session expiry)
    func clearAuthData() async {
        // 清除Keychain数据
        try? keychainManager.clearAuthData()

        // 断开 Socket 连接
        await SocketIOManager.shared.disconnect()

        // 清除状态
        await MainActor.run {
            self.isAuthenticated = false
            self.currentUser = nil
            self.isGuest = false
        }
    }

    // MARK: - Public Methods for Token Access

    /// 获取访问令牌（供APIManager使用）
    func getAccessToken() -> String? {
        return try? keychainManager.loadAccessToken()
    }

    private func getRefreshToken() -> String? {
        return try? keychainManager.loadRefreshToken()
    }
}

/// 认证错误
enum AuthError: Error, LocalizedError {
    case invalidCredentials
    case networkError
    case noRefreshToken
    case unknownError

    var errorDescription: String? {
        switch self {
        case .invalidCredentials:
            return "用户名或密码错误"
        case .networkError:
            return "网络连接失败"
        case .noRefreshToken:
            return "请重新登录"
        case .unknownError:
            return "未知错误"
        }
    }
}

/// 用户资料响应包装器（匹配后端响应格式）
struct UserProfileWrapper: Codable {
    let success: Bool
    let user: AuthUserProfileResponse
}

/// 用户资料响应（简化版）
struct AuthUserProfileResponse: Codable {
    let id: String
    let username: String
    let email: String?
    let displayName: String?
    let avatar: String?
    let createdAt: String?
    let updatedAt: String?
    let lastLogin: String?
    let isActive: Bool?
    let preferences: UserPreferences?
    let phone: String?
    let role: String?
    let isAdmin: Bool?
    let avatarUrl: String?
    let points: Int?
    let totalPixels: Int?
    let currentPixels: Int?
    let lastActivity: String?
    let alliance: AllianceInfo?
    let rankTier: RankTier?

    enum CodingKeys: String, CodingKey {
        case id, username, email, phone, role, points
        case displayName = "display_name"
        case avatar, createdAt, updatedAt, lastLogin, isActive, preferences
        case isAdmin = "is_admin"
        case avatarUrl = "avatar_url"
        case totalPixels = "total_pixels"
        case currentPixels = "current_pixels"
        case lastActivity = "last_activity"
        case alliance
        case rankTier
    }
}

/// 联盟信息
struct AllianceInfo: Codable {
    let id: String?
    let name: String?
    let description: String?
    let flag: String?
    let flagPatternId: String?
    let color: String?
    let role: String?
    let joinedAt: String?

    enum CodingKeys: String, CodingKey {
        case id, name, description, flag, color, role
        case flagPatternId = "flag_pattern_id"
        case joinedAt = "joined_at"
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)

        // Handle id - could be String or Int/Double
        if let idString = try? container.decode(String.self, forKey: .id) {
            self.id = idString
        } else if let idInt = try? container.decode(Int.self, forKey: .id) {
            self.id = String(idInt)
        } else if let idDouble = try? container.decode(Double.self, forKey: .id) {
            self.id = String(Int(idDouble))
        } else {
            self.id = nil
        }

        self.name = try? container.decode(String.self, forKey: .name)
        self.description = try? container.decode(String.self, forKey: .description)
        self.flag = try? container.decode(String.self, forKey: .flag)
        self.flagPatternId = try? container.decode(String.self, forKey: .flagPatternId)
        self.color = try? container.decode(String.self, forKey: .color)
        self.role = try? container.decode(String.self, forKey: .role)
        self.joinedAt = try? container.decode(String.self, forKey: .joinedAt)
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try? container.encode(id, forKey: .id)
        try? container.encode(name, forKey: .name)
        try? container.encode(description, forKey: .description)
        try? container.encode(flag, forKey: .flag)
        try? container.encode(flagPatternId, forKey: .flagPatternId)
        try? container.encode(color, forKey: .color)
        try? container.encode(role, forKey: .role)
        try? container.encode(joinedAt, forKey: .joinedAt)
    }
}

/// 修改密码响应
struct ChangePasswordResponse: Codable {
    let success: Bool
    let message: String
}

/// 账号类型
enum AccountType {
    case email
    case phone
    case username
}