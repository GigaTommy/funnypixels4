import Foundation

/// 认证用户模型
struct AuthUser: Codable, Identifiable {
    let id: String
    let username: String
    let email: String?  // 改为可选
    let displayName: String?
    let avatarUrl: String?  // 🔧 FIX: CDN/文件路径（用于加载图片）
    let avatar: String?     // 像素数据（1024个颜色值，备用）
    let createdAt: String?  // 改为可选
    let updatedAt: String?  // 改为可选
    let lastLogin: String?
    let isActive: Bool?
    let totalPixels: Int?
    let currentPixels: Int?
    let preferences: UserPreferences?  // 改为可选
    let alliance: UserAlliance?
    let rankTier: RankTier?

    struct UserAlliance: Codable {
        let id: String
        let name: String
        let flagPatternId: String?

        enum CodingKeys: String, CodingKey {
            case id, name
            case flagPatternId = "flag_pattern_id"
        }

        init(id: String, name: String, flagPatternId: String? = nil) {
            self.id = id
            self.name = name
            self.flagPatternId = flagPatternId
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
                throw DecodingError.dataCorruptedError(
                    forKey: .id,
                    in: container,
                    debugDescription: "alliance.id must be String, Int, or Double"
                )
            }

            self.name = try container.decode(String.self, forKey: .name)
            self.flagPatternId = try? container.decode(String.self, forKey: .flagPatternId)
        }
    }

    /// 计算属性：显示名称（优先使用displayName，否则使用username）
    var displayOrUsername: String {
        return displayName ?? username
    }

    enum CodingKeys: String, CodingKey {
        case id, username, email
        case displayName = "display_name"
        case avatarUrl = "avatar_url"  // 🔧 FIX: Map to avatar_url from backend
        case avatar
        case createdAt = "created_at"
        case updatedAt = "updated_at"
        case lastLogin = "last_login"
        case isActive = "is_active"
        case totalPixels = "total_pixels"
        case currentPixels = "current_pixels"
        case preferences
        case alliance
        case rankTier
    }
}

/// 用户偏好设置
public struct UserPreferences: Codable {
    let theme: AppTheme?
    let notifications: Bool?
    let privacy: PrivacySettings?

    enum AppTheme: String, Codable {
        case light = "light"
        case dark = "dark"
        case system = "system"
    }

    struct PrivacySettings: Codable {
        let showEmail: Bool?
        let showLocation: Bool?
        let showAlliance: Bool?
    }

    /// 默认偏好设置
    static var `default`: UserPreferences {
        return UserPreferences(
            theme: .system,
            notifications: true,
            privacy: PrivacySettings(showEmail: false, showLocation: true, showAlliance: true)
        )
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