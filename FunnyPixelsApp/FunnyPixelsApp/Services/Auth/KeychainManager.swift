import Foundation
import Combine
import Security

/// Keychain 错误类型
enum KeychainError: Error, LocalizedError {
    case saveFailed(OSStatus)
    case loadFailed(OSStatus)
    case deleteFailed(OSStatus)
    case invalidData
    case encodingFailed(any Error)
    case decodingFailed(any Error)
    case itemNotFound
    case duplicateItem
    case unexpectedStatus(OSStatus)

    var errorDescription: String? {
        switch self {
        case .saveFailed(let status):
            return "保存到 Keychain 失败: \(status) - \(Self.statusMessage(status))"
        case .loadFailed(let status):
            return "从 Keychain 加载失败: \(status) - \(Self.statusMessage(status))"
        case .deleteFailed(let status):
            return "从 Keychain 删除失败: \(status) - \(Self.statusMessage(status))"
        case .invalidData:
            return "Keychain 数据无效"
        case .encodingFailed(let error):
            return "编码数据失败: \(error.localizedDescription)"
        case .decodingFailed(let error):
            return "解码数据失败: \(error.localizedDescription)"
        case .itemNotFound:
            return "Keychain 中未找到该项"
        case .duplicateItem:
            return "Keychain 中已存在该项"
        case .unexpectedStatus(let status):
            return "意外的状态码: \(status) - \(Self.statusMessage(status))"
        }
    }

    /// 将 OSStatus 转换为可读消息
    private static func statusMessage(_ status: OSStatus) -> String {
        switch status {
        case errSecSuccess:
            return "成功"
        case errSecItemNotFound:
            return "项未找到"
        case errSecDuplicateItem:
            return "重复项"
        case errSecAuthFailed:
            return "认证失败"
        case errSecParam:
            return "参数错误"
        case errSecAllocate:
            return "内存分配失败"
        case errSecNotAvailable:
            return "服务不可用"
        case errSecInteractionNotAllowed:
            return "交互不允许"
        case errSecUnimplemented:
            return "功能未实现"
        case errSecDecode:
            return "解码失败"
        default:
            return "错误代码 \(status)"
        }
    }
}

/// Keychain 安全存储管理器
/// 使用 Security framework 提供的原生 Keychain API 实现安全存储
final class KeychainManager {

    // MARK: - Singleton

    static let shared = KeychainManager()

    // MARK: - Properties

    /// Keychain 服务标识符
    private let service: String

    /// 访问组（用于应用间共享 Keychain 项）
    private let accessGroup: String?

    // MARK: - Initialization

    private init(service: String = "com.funnypixels.app", accessGroup: String? = nil) {
        self.service = service
        self.accessGroup = accessGroup
    }

    // MARK: - Token Management

    /// 保存 Token 到 Keychain
    /// - Parameters:
    ///   - token: 要保存的 Token 字符串
    ///   - account: 账户标识符（通常是用户 ID 或 email）
    /// - Throws: KeychainError 如果保存失败
    func saveToken(_ token: String, for account: String) throws {
        guard let data = token.data(using: .utf8) else {
            throw KeychainError.invalidData
        }

        try saveData(data, for: account)
    }

    /// 从 Keychain 加载 Token
    /// - Parameter account: 账户标识符
    /// - Returns: Token 字符串，如果不存在则返回 nil
    /// - Throws: KeychainError 如果加载失败
    func loadToken(for account: String) throws -> String? {
        guard let data = try loadData(for: account) else {
            return nil
        }

        guard let token = String(data: data, encoding: .utf8) else {
            throw KeychainError.invalidData
        }

        return token
    }

    /// 删除 Token
    /// - Parameter account: 账户标识符
    /// - Throws: KeychainError 如果删除失败
    func deleteToken(for account: String) throws {
        try deleteData(for: account)
    }

    // MARK: - Generic Codable Storage

    /// 保存可编码对象到 Keychain
    /// - Parameters:
    ///   - object: 要保存的对象（必须遵循 Codable）
    ///   - key: 存储键名
    /// - Throws: KeychainError 如果保存失败
    func save<T: Codable>(_ object: T, for key: String) throws {
        let encoder = JSONEncoder()
        encoder.outputFormatting = .prettyPrinted

        do {
            let data = try encoder.encode(object)
            try saveData(data, for: key)
        } catch let encodingError {
            throw KeychainError.encodingFailed(encodingError)
        }
    }

    /// 从 Keychain 加载可编码对象
    /// - Parameters:
    ///   - type: 对象类型
    ///   - key: 存储键名
    /// - Returns: 解码后的对象，如果不存在则返回 nil
    /// - Throws: KeychainError 如果加载或解码失败
    func load<T: Codable>(_ type: T.Type, for key: String) throws -> T? {
        guard let data = try loadData(for: key) else {
            return nil
        }

        let decoder = JSONDecoder()
        do {
            let object = try decoder.decode(type, from: data)
            return object
        } catch let decodingError {
            throw KeychainError.decodingFailed(decodingError)
        }
    }

    /// 删除可编码对象
    /// - Parameter key: 存储键名
    /// - Throws: KeychainError 如果删除失败
    func delete(for key: String) throws {
        try deleteData(for: key)
    }

    // MARK: - Low-level Data Operations

    /// 保存原始数据到 Keychain
    /// - Parameters:
    ///   - data: 要保存的数据
    ///   - key: 存储键名
    /// - Throws: KeychainError 如果保存失败
    private func saveData(_ data: Data, for key: String) throws {
        // 首先尝试删除现有项（如果存在）
        let deleteQuery = buildQuery(for: key)
        SecItemDelete(deleteQuery as CFDictionary)

        // 构建添加查询
        var query = buildQuery(for: key)
        query[kSecValueData as String] = data
        query[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly

        // 执行保存
        let status = SecItemAdd(query as CFDictionary, nil)

        guard status == errSecSuccess else {
            if status == errSecDuplicateItem {
                throw KeychainError.duplicateItem
            }
            throw KeychainError.saveFailed(status)
        }
    }

    /// 从 Keychain 加载原始数据
    /// - Parameter key: 存储键名
    /// - Returns: 数据，如果不存在则返回 nil
    /// - Throws: KeychainError 如果加载失败
    private func loadData(for key: String) throws -> Data? {
        var query = buildQuery(for: key)
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne

        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)

        if status == errSecItemNotFound {
            return nil
        }

        guard status == errSecSuccess else {
            throw KeychainError.loadFailed(status)
        }

        guard let data = result as? Data else {
            throw KeychainError.invalidData
        }

        return data
    }

    /// 从 Keychain 删除数据
    /// - Parameter key: 存储键名
    /// - Throws: KeychainError 如果删除失败
    private func deleteData(for key: String) throws {
        let query = buildQuery(for: key)
        let status = SecItemDelete(query as CFDictionary)

        // errSecItemNotFound 不算错误，因为删除一个不存在的项也达到了目的
        if status == errSecItemNotFound {
            return
        }

        guard status == errSecSuccess else {
            throw KeychainError.deleteFailed(status)
        }
    }

    // MARK: - Query Building

    /// 构建 Keychain 查询字典
    /// - Parameter key: 存储键名
    /// - Returns: 查询字典
    private func buildQuery(for key: String) -> [String: Any] {
        var query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key
        ]

        if let accessGroup = accessGroup {
            query[kSecAttrAccessGroup as String] = accessGroup
        }

        return query
    }

    // MARK: - Utility Methods

    /// 检查指定键是否存在
    /// - Parameter key: 存储键名
    /// - Returns: 如果存在返回 true，否则返回 false
    func exists(for key: String) -> Bool {
        do {
            let data = try loadData(for: key)
            return data != nil
        } catch {
            return false
        }
    }

    /// 清除所有 Keychain 项（谨慎使用）
    /// - Throws: KeychainError 如果清除失败
    func clearAll() throws {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service
        ]

        let status = SecItemDelete(query as CFDictionary)

        // errSecItemNotFound 不算错误
        if status == errSecItemNotFound {
            return
        }

        guard status == errSecSuccess else {
            throw KeychainError.deleteFailed(status)
        }
    }

    /// 获取所有存储的键名（调试用）
    /// - Returns: 键名数组
    func allKeys() -> [String] {
        var query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecReturnAttributes as String: true,
            kSecMatchLimit as String: kSecMatchLimitAll
        ]

        if let accessGroup = accessGroup {
            query[kSecAttrAccessGroup as String] = accessGroup
        }

        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)

        guard status == errSecSuccess,
              let items = result as? [[String: Any]] else {
            return []
        }

        return items.compactMap { $0[kSecAttrAccount as String] as? String }
    }
}

// MARK: - Convenience Extensions

extension KeychainManager {

    /// 常用的 Keychain 键名
    enum Key {
        static let accessToken = "access_token"
        static let refreshToken = "refresh_token"
        static let userId = "user_id"
        static let currentUser = "current_user"
        static let isGuest = "is_guest"
        static let deviceId = "device_id"
        static let lastLoginDate = "last_login_date"
        static let sessionData = "session_data"
    }

    /// 保存访问令牌
    func saveAccessToken(_ token: String) throws {
        try saveToken(token, for: Key.accessToken)
    }

    /// 加载访问令牌
    func loadAccessToken() throws -> String? {
        return try loadToken(for: Key.accessToken)
    }

    /// 删除访问令牌
    func deleteAccessToken() throws {
        try deleteToken(for: Key.accessToken)
    }

    /// 保存刷新令牌
    func saveRefreshToken(_ token: String) throws {
        try saveToken(token, for: Key.refreshToken)
    }

    /// 加载刷新令牌
    func loadRefreshToken() throws -> String? {
        return try loadToken(for: Key.refreshToken)
    }

    /// 删除刷新令牌
    func deleteRefreshToken() throws {
        try deleteToken(for: Key.refreshToken)
    }

    /// 保存用户 ID
    func saveUserId(_ userId: String) throws {
        try saveToken(userId, for: Key.userId)
    }

    /// 加载用户 ID
    func loadUserId() throws -> String? {
        return try loadToken(for: Key.userId)
    }

    /// 删除用户 ID
    func deleteUserId() throws {
        try deleteToken(for: Key.userId)
    }

    /// 保存当前用户对象
    func saveCurrentUser(_ user: AuthUser) throws {
        try save(user, for: Key.currentUser)
    }

    /// 加载当前用户对象
    func loadCurrentUser() throws -> AuthUser? {
        return try load(AuthUser.self, for: Key.currentUser)
    }

    /// 删除当前用户对象
    func deleteCurrentUser() throws {
        try delete(for: Key.currentUser)
    }

    /// 清除所有认证相关数据
    func clearAuthData() throws {
        try? deleteAccessToken()
        try? deleteRefreshToken()
        try? deleteUserId()
        try? deleteCurrentUser()
        try? delete(for: Key.isGuest)
        try? delete(for: Key.sessionData)
    }
}
