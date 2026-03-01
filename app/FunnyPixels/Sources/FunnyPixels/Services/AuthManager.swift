import Foundation
import KeychainAccess
#if canImport(UIKit)
import UIKit
#endif

/// 认证管理器
class AuthManager: ObservableObject {
    static let shared = AuthManager()

    @Published var isAuthenticated = false
    @Published var currentUser: User?
    @Published var isGuest = false

    private let keychain = Keychain(service: "com.funnypixels.auth")

    private let accessTokenKey = "access_token"
    private let refreshTokenKey = "refresh_token"
    private let userIdKey = "user_id"
    private let isGuestKey = "is_guest"

    private init() {
        loadStoredAuthData()
    }

    /// 登录
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
            print("Logout request failed: \(error)")
        }

        // 清除本地数据
        clearAuthData()
    }

    /// 刷新Token
    func refreshToken() async throws {
        guard let refreshToken = getRefreshToken() else {
            throw AuthError.noRefreshToken
        }

        let parameters = ["refresh_token": refreshToken]

        let response: TokenResponse = try await APIManager.shared.request(
            endpoint: .refreshToken,
            parameters: parameters
        )

        // 更新Token
        try keychain.set(response.token, key: accessTokenKey)
        try keychain.set(response.refreshToken, key: refreshTokenKey)
    }

    /// 获取用户信息
    func fetchUserProfile() async throws -> AuthUser {
        let response: AuthUserProfileResponse = try await APIManager.shared.request(
            endpoint: .getUserProfile
        )

        let user = AuthUser(
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

        // 更新当前用户信息
        await MainActor.run {
            self.currentUser = user
            // 保存用户信息到Keychain
            try? self.keychain.set(user.id, key: self.userIdKey)
        }

        return user
    }

    /// 更新用户资料
    func updateProfile(profileData: [String: Any]) async throws -> AuthUser {
        let response: AuthUserProfileResponse = try await APIManager.shared.request(
            endpoint: .updateProfile,
            parameters: profileData
        )

        let updatedUser = AuthUser(
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

        await MainActor.run {
            self.currentUser = updatedUser
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
        try keychain.set(response.token, key: accessTokenKey)
        try keychain.set(response.refreshToken, key: refreshTokenKey)

        // 保存用户信息
        try keychain.set(response.user.id, key: userIdKey)
        try keychain.set(isGuest ? "true" : "false", key: isGuestKey)

        // 更新状态
        Task { @MainActor in
            self.currentUser = response.user
            self.isAuthenticated = true
            self.isGuest = isGuest
        }
    }

    private func loadStoredAuthData() {
        // 加载Token
        let accessToken = try? keychain.get(accessTokenKey)

        if let accessToken = accessToken, !accessToken.isEmpty {
            // 加载用户信息
            let userId = try? keychain.get(userIdKey)
            let isGuestString = try? keychain.get(isGuestKey)
            let isGuest = isGuestString == "true"

            Task { @MainActor in
                self.isAuthenticated = true
                self.isGuest = isGuest
            }

            // 异步获取用户信息
            Task {
                do {
                    _ = try await fetchUserProfile()
                } catch {
                    print("Failed to fetch user profile: \(error)")
                    // 如果获取失败，清除认证信息
                    clearAuthData()
                }
            }
        }
    }

    private func clearAuthData() {
        // 清除Keychain数据
        try? keychain.remove(accessTokenKey)
        try? keychain.remove(refreshTokenKey)
        try? keychain.remove(userIdKey)
        try? keychain.remove(isGuestKey)

        // 清除状态
        Task { @MainActor in
            self.isAuthenticated = false
            self.currentUser = nil
            self.isGuest = false
        }
    }

    // MARK: - Public Methods for Token Access

    /// 获取访问令牌（供APIManager使用）
    func getAccessToken() -> String? {
        return try? keychain.get(accessTokenKey)
    }

    private func getRefreshToken() -> String? {
        return try? keychain.get(refreshTokenKey)
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

/// 用户资料响应
/// 用户资料响应（简化版）
struct AuthUserProfileResponse: Codable {
    let id: String
    let username: String
    let email: String
    let displayName: String?
    let avatar: String?
    let createdAt: String
    let updatedAt: String
    let lastLogin: String?
    let isActive: Bool
    let preferences: UserPreferences
}

/// 修改密码响应
struct ChangePasswordResponse: Codable {
    let success: Bool
    let message: String
}