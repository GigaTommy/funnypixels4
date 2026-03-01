import Foundation

/// 认证用户模型
struct AuthUser: Codable, Identifiable {
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

    /// 计算属性：显示名称（优先使用displayName，否则使用username）
    var displayOrUsername: String {
        return displayName ?? username
    }

    /// 计算属性：头像URL
    var avatarURL: URL? {
        guard let avatar = avatar else { return nil }
        return URL(string: avatar)
    }
}

/// 用户偏好设置
public struct UserPreferences: Codable {
    let theme: AppTheme
    let notifications: Bool
    let privacy: PrivacySettings

    enum AppTheme: String, Codable {
        case light = "light"
        case dark = "dark"
        case system = "system"
    }

    struct PrivacySettings: Codable {
        let showEmail: Bool
        let showLocation: Bool
        let showAlliance: Bool
    }
}

/// 用户状态
enum UserStatus: String, CaseIterable, Codable {
    case online = "online"
    case offline = "offline"
    case away = "away"
    case playing = "playing"
}

/// 用户类型
enum UserType: String, CaseIterable, Codable {
    case guest = "guest"
    case registered = "registered"
    case premium = "premium"
}

// 为了向后兼容，添加User类型别名
typealias User = AuthUser