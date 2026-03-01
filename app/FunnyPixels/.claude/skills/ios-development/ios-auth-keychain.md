# iOS Auth & Keychain Skill

**描述**: 实现iOS用户认证和安全存储（Keychain）

**使用场景**:
- 用户Token安全存储（Keychain）
- 登录状态恢复
- 游客模式支持
- 自动登录

**参数**:
- `keychain_service`: Keychain服务名称，默认为Bundle ID
- `enable_guest_mode`: 是否启用游客模式，默认true

**实现步骤**:

## 1. 创建Keychain管理器

```swift
// Sources/FunnyPixels/Services/KeychainManager.swift

import Foundation
import Security

public class KeychainManager {
    public static let shared = KeychainManager()

    private let serviceName: String

    private init() {
        self.serviceName = Bundle.main.bundleIdentifier ?? "com.funnypixels.app"
    }

    // MARK: - Save

    /// 保存Token到Keychain
    public func saveToken(_ token: String, for account: String = "user_token") throws {
        let data = token.data(using: .utf8)!

        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: serviceName,
            kSecAttrAccount as String: account,
            kSecValueData as String: data
        ]

        // 先删除旧的（如果存在）
        SecItemDelete(query as CFDictionary)

        // 添加新的
        let status = SecItemAdd(query as CFDictionary, nil)

        guard status == errSecSuccess else {
            throw KeychainError.saveFailed(status)
        }

        print("✅ Token saved to Keychain")
    }

    // MARK: - Load

    /// 从Keychain加载Token
    public func loadToken(for account: String = "user_token") throws -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: serviceName,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]

        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)

        guard status == errSecSuccess else {
            if status == errSecItemNotFound {
                return nil // Token不存在
            }
            throw KeychainError.loadFailed(status)
        }

        guard let data = result as? Data,
              let token = String(data: data, encoding: .utf8) else {
            throw KeychainError.invalidData
        }

        print("✅ Token loaded from Keychain")
        return token
    }

    // MARK: - Delete

    /// 删除Token
    public func deleteToken(for account: String = "user_token") throws {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: serviceName,
            kSecAttrAccount as String: account
        ]

        let status = SecItemDelete(query as CFDictionary)

        guard status == errSecSuccess || status == errSecItemNotFound else {
            throw KeychainError.deleteFailed(status)
        }

        print("✅ Token deleted from Keychain")
    }

    // MARK: - Generic Storage

    /// 保存任意Codable对象
    public func save<T: Codable>(_ object: T, for key: String) throws {
        let encoder = JSONEncoder()
        let data = try encoder.encode(object)

        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: serviceName,
            kSecAttrAccount as String: key,
            kSecValueData as String: data
        ]

        SecItemDelete(query as CFDictionary)

        let status = SecItemAdd(query as CFDictionary, nil)

        guard status == errSecSuccess else {
            throw KeychainError.saveFailed(status)
        }
    }

    /// 加载任意Codable对象
    public func load<T: Codable>(_ type: T.Type, for key: String) throws -> T? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: serviceName,
            kSecAttrAccount as String: key,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]

        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)

        guard status == errSecSuccess else {
            if status == errSecItemNotFound {
                return nil
            }
            throw KeychainError.loadFailed(status)
        }

        guard let data = result as? Data else {
            throw KeychainError.invalidData
        }

        let decoder = JSONDecoder()
        return try decoder.decode(type, from: data)
    }
}

public enum KeychainError: LocalizedError {
    case saveFailed(OSStatus)
    case loadFailed(OSStatus)
    case deleteFailed(OSStatus)
    case invalidData

    public var errorDescription: String? {
        switch self {
        case .saveFailed(let status):
            return "Failed to save to Keychain: \(status)"
        case .loadFailed(let status):
            return "Failed to load from Keychain: \(status)"
        case .deleteFailed(let status):
            return "Failed to delete from Keychain: \(status)"
        case .invalidData:
            return "Invalid data in Keychain"
        }
    }
}
```

## 2. 创建用户会话管理器

```swift
// Sources/FunnyPixels/Services/SessionManager.swift

import Foundation
import Combine

@MainActor
public class SessionManager: ObservableObject {
    @Published public private(set) var currentUser: User?
    @Published public private(set) var isAuthenticated = false
    @Published public private(set) var isGuest = false
    @Published public private(set) var authToken: String?

    private let keychain = KeychainManager.shared
    private let apiManager: APIManager

    public init(apiManager: APIManager) {
        self.apiManager = apiManager
    }

    // MARK: - Login

    /// 用户登录
    public func login(email: String, password: String) async throws {
        let response = try await apiManager.login(email: email, password: password)

        // 保存Token到Keychain
        try keychain.saveToken(response.token)

        // 保存用户信息
        try keychain.save(response.user, for: "current_user")

        // 更新状态
        authToken = response.token
        currentUser = response.user
        isAuthenticated = true
        isGuest = false

        print("✅ User logged in: \(response.user.email)")
    }

    /// 用户注册
    public func register(email: String, password: String, username: String) async throws {
        let response = try await apiManager.register(
            email: email,
            password: password,
            username: username
        )

        try keychain.saveToken(response.token)
        try keychain.save(response.user, for: "current_user")

        authToken = response.token
        currentUser = response.user
        isAuthenticated = true
        isGuest = false

        print("✅ User registered: \(response.user.email)")
    }

    // MARK: - Logout

    /// 用户登出
    public func logout() async {
        try? keychain.deleteToken()
        try? keychain.save(nil as User?, for: "current_user")

        authToken = nil
        currentUser = nil
        isAuthenticated = false
        isGuest = false

        print("✅ User logged out")
    }

    // MARK: - Restore Session

    /// 恢复登录状态（App启动时调用）
    public func restoreSession() async {
        do {
            // 从Keychain加载Token
            guard let token = try keychain.loadToken() else {
                print("ℹ️ No token found, starting as guest")
                enterGuestMode()
                return
            }

            // 验证Token有效性
            authToken = token

            // 获取用户信息
            if let cachedUser: User = try keychain.load(User.self, for: "current_user") {
                currentUser = cachedUser
            }

            // 从服务器验证Token
            do {
                let user = try await apiManager.getCurrentUser(token: token)
                currentUser = user
                isAuthenticated = true
                isGuest = false

                print("✅ Session restored: \(user.email)")
            } catch {
                // Token无效，清除
                print("⚠️ Token invalid, clearing session")
                try? keychain.deleteToken()
                enterGuestMode()
            }

        } catch {
            print("❌ Failed to restore session: \(error)")
            enterGuestMode()
        }
    }

    // MARK: - Guest Mode

    /// 进入游客模式
    public func enterGuestMode() {
        currentUser = nil
        authToken = nil
        isAuthenticated = false
        isGuest = true

        print("👤 Entered guest mode")
    }

    /// 游客转正式用户
    public func convertGuestToUser(email: String, password: String, username: String) async throws {
        try await register(email: email, password: password, username: username)

        // TODO: 迁移游客数据（如果有）
    }

    // MARK: - Token Refresh

    /// 刷新Token（如果需要）
    public func refreshTokenIfNeeded() async throws {
        guard let currentToken = authToken else {
            throw SessionError.notAuthenticated
        }

        // 检查Token是否即将过期
        if isTokenExpiring(currentToken) {
            let newToken = try await apiManager.refreshToken(currentToken)
            try keychain.saveToken(newToken)
            authToken = newToken

            print("✅ Token refreshed")
        }
    }

    private func isTokenExpiring(_ token: String) -> Bool {
        // TODO: 解析JWT Token，检查过期时间
        // 这里简化处理，实际应该解析JWT
        return false
    }
}

public enum SessionError: LocalizedError {
    case notAuthenticated
    case invalidCredentials
    case tokenExpired

    public var errorDescription: String? {
        switch self {
        case .notAuthenticated:
            return "Not authenticated"
        case .invalidCredentials:
            return "Invalid email or password"
        case .tokenExpired:
            return "Session expired, please login again"
        }
    }
}

// API响应模型
public struct LoginResponse: Codable {
    public let token: String
    public let user: User
}
```

## 3. 集成到AuthViewModel

```swift
// Sources/FunnyPixels/ViewModels/AuthViewModel.swift 扩展

extension AuthViewModel {
    /// App启动时恢复会话
    func initializeSession() {
        Task {
            await sessionManager.restoreSession()

            if sessionManager.isAuthenticated {
                // 已登录，跳转到主界面
                isLoggedIn = true
            } else if sessionManager.isGuest {
                // 游客模式，允许浏览
                showGuestMode = true
            } else {
                // 显示登录界面
                showLoginScreen = true
            }
        }
    }

    /// 登录
    func login(email: String, password: String) async {
        isLoading = true
        errorMessage = nil

        do {
            try await sessionManager.login(email: email, password: password)
            isLoggedIn = true
        } catch {
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }

    /// 登出
    func logout() async {
        await sessionManager.logout()
        isLoggedIn = false
    }

    /// 游客模式绘制像素时提示登录
    func requireAuthForDrawing() -> Bool {
        if sessionManager.isGuest {
            showLoginPrompt = true
            return false
        }
        return true
    }
}
```

## 4. App启动流程

```swift
// Sources/FunnyPixelsApp/FunnyPixelsApp.swift

@main
struct FunnyPixelsApp: App {
    @StateObject private var sessionManager = SessionManager(apiManager: APIManager.shared)
    @StateObject private var authViewModel: AuthViewModel

    init() {
        let session = SessionManager(apiManager: APIManager.shared)
        _sessionManager = StateObject(wrappedValue: session)
        _authViewModel = StateObject(wrappedValue: AuthViewModel(sessionManager: session))
    }

    var body: some Scene {
        WindowGroup {
            ZStack {
                if sessionManager.isAuthenticated {
                    // 主界面
                    ContentView()
                        .environmentObject(sessionManager)
                } else if sessionManager.isGuest {
                    // 游客模式
                    ContentView()
                        .environmentObject(sessionManager)
                        .overlay(GuestModeIndicator())
                } else {
                    // 登录界面
                    AuthView()
                        .environmentObject(authViewModel)
                }
            }
            .task {
                // App启动时恢复会话
                await sessionManager.restoreSession()
            }
        }
    }
}
```

## 5. 游客模式指示器

```swift
// Sources/FunnyPixels/Views/GuestModeIndicator.swift

import SwiftUI

struct GuestModeIndicator: View {
    @EnvironmentObject var sessionManager: SessionManager

    var body: some View {
        VStack {
            Spacer()

            HStack {
                Image(systemName: "person.crop.circle.badge.questionmark")
                    .foregroundColor(.orange)

                Text("Guest Mode - Login to save your pixels")
                    .font(.caption)

                Button("Login") {
                    // 显示登录界面
                }
                .buttonStyle(.bordered)
            }
            .padding()
            .background(Color.orange.opacity(0.1))
            .cornerRadius(8)
            .padding()
        }
    }
}
```

## 验收标准

- ✅ Token可安全存储到Keychain
- ✅ App重启后自动恢复登录状态
- ✅ 游客模式可正常浏览地图
- ✅ 游客绘制像素时提示登录
- ✅ Token过期时自动刷新
- ✅ 登出时清除所有敏感数据

## 安全最佳实践

1. **使用Keychain**: 永远不要用UserDefaults存储敏感信息
2. **Token加密**: Keychain自动加密，无需额外处理
3. **及时清理**: 登出时彻底清除Token和用户数据
4. **HTTPS**: API通信必须使用HTTPS
5. **Token刷新**: 使用refresh token机制

## 测试方法

```swift
// Tests/FunnyPixelsTests/KeychainTests.swift

import XCTest
@testable import FunnyPixels

class KeychainTests: XCTestCase {
    let keychain = KeychainManager.shared

    override func tearDown() {
        try? keychain.deleteToken()
    }

    func testSaveAndLoadToken() throws {
        let token = "test_token_123"

        try keychain.saveToken(token)
        let loaded = try keychain.loadToken()

        XCTAssertEqual(loaded, token)
    }

    func testDeleteToken() throws {
        try keychain.saveToken("test")
        try keychain.deleteToken()

        let loaded = try keychain.loadToken()
        XCTAssertNil(loaded)
    }

    func testSaveCustomObject() throws {
        let user = User(id: "1", email: "test@example.com", username: "test")

        try keychain.save(user, for: "test_user")
        let loaded: User? = try keychain.load(User.self, for: "test_user")

        XCTAssertEqual(loaded?.id, user.id)
    }
}
```

## 依赖工具

- Security framework (Keychain)
- Combine (for reactive state)
