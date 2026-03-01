import Foundation

// MARK: - User Profile Models

/// 用户个人资料
struct UserProfile: Codable, Identifiable {
    let id: String
    let username: String
    let displayName: String?
    let email: String?
    let phone: String?
    let avatar: String?
    let avatarUrl: String?
    let motto: String?
    let privacySettings: PrivacySettings
    let socialStats: SocialStats
    let statistics: UserStatistics
    let preferences: UserPreferences
    let verification: UserVerification?
    let membership: UserMembership?
    let createdAt: String
    let updatedAt: String
    let lastActive: String?

    enum CodingKeys: String, CodingKey {
        case id, username, displayName, email, phone, avatar, motto
        case avatarUrl = "avatar_url"
        case privacySettings = "privacy_settings"
        case socialStats = "social_stats"
        case statistics = "statistics"
        case preferences = "preferences"
        case verification = "verification"
        case membership = "membership"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
        case lastActive = "last_active"
    }

    /// 计算属性：显示名称
    var displayOrUsername: String {
        return displayName ?? username
    }

    /// 计算属性：账号年龄（天数）
    var accountAge: Int {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd'T'HH:mm:ss.SSS'Z"
        guard let createdDate = formatter.date(from: createdAt) else {
            return 0
        }
        let now = Date()
        let calendar = Calendar.current
        let components = calendar.dateComponents([.day], from: createdDate, to: now)
        return components.day ?? 0
    }

    /// 计算属性：是否为活跃用户
    var isActive: Bool {
        guard let lastActive = lastActive else { return false }
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd'T'HH:mm:ss.SSS'Z"
        guard let lastActiveDate = formatter.date(from: lastActive) else {
            return false
        }
        let thirtyDaysAgo = Calendar.current.date(byAdding: .day, value: -30, to: Date()) ?? Date()
        return lastActiveDate > thirtyDaysAgo
    }

    /// 计算属性：头像显示URL或颜色
    var avatarDisplay: AvatarDisplay {
        if let avatarUrl = avatarUrl, !avatarUrl.isEmpty {
            return .url(avatarUrl)
        } else if let avatar = avatar, !avatar.isEmpty {
            return .pixelData(avatar)
        } else {
            return .`default`
        }
    }
}

/// 头像显示类型
enum AvatarDisplay {
    case url(String)
    case pixelData(String)
    case color(String)
    case `default`
}

/// 隐私设置
struct PrivacySettings: Codable {
    let showEmail: Bool
    let showPhone: Bool
    let showAlliance: Bool
    let showStatistics: Bool
    let showDrawingHistory: Bool
    let allowProfileView: Bool
    let allowFollowRequests: Bool
    let allowDirectMessages: Bool

    enum CodingKeys: String, CodingKey {
        case showEmail = "show_email"
        case showPhone = "show_phone"
        case showAlliance = "show_alliance"
        case showStatistics = "show_statistics"
        case showDrawingHistory = "show_drawing_history"
        case allowProfileView = "allow_profile_view"
        case allowFollowRequests = "allow_follow_requests"
        case allowDirectMessages = "allow_direct_messages"
    }
}

/// 社交统计
struct SocialStats: Codable {
    let followers: Int
    let following: Int
    let likes: Int
    let shares: Int
    let comments: Int
    let views: Int

    enum CodingKeys: String, CodingKey {
        case followers, following, likes, shares, comments, views
    }
}

/// 用户统计
struct UserStatistics: Codable {
    let totalPixels: Int
    let currentPixels: Int
    let drawingSessions: Int
    let totalDrawingTime: Int // 秒
    let averagePixelsPerSession: Double
    let longestSessionTime: Int // 秒
    let favoriteColors: [String]
    let mostActiveDay: String?
    let achievements: [UserAchievement]

    enum CodingKeys: String, CodingKey {
        case totalPixels = "total_pixels"
        case currentPixels = "current_pixels"
        case drawingSessions = "drawing_sessions"
        case totalDrawingTime = "total_drawing_time"
        case averagePixelsPerSession = "average_pixels_per_session"
        case longestSessionTime = "longest_session_time"
        case favoriteColors = "favorite_colors"
        case mostActiveDay = "most_active_day"
        case achievements = "achievements"
    }

    /// 计算属性：总绘制时间（小时）
    var totalDrawingHours: Double {
        return Double(totalDrawingTime) / 3600.0
    }

    /// 计算属性：最长会话时间（小时）
    var longestSessionHours: Double {
        return Double(longestSessionTime) / 3600.0
    }
}

/// 用户成就
struct UserAchievement: Codable, Identifiable {
    let id: String
    let name: String
    let description: String
    let icon: String
    let category: AchievementCategory
    let progress: Double // 0.0 - 1.0
    let unlockedAt: String?
    let isHidden: Bool

    enum CodingKeys: String, CodingKey {
        case id, name, description, icon, category, progress
        case unlockedAt = "unlocked_at"
        case isHidden = "is_hidden"
    }

    /// 计算属性：是否已解锁
    var isUnlocked: Bool {
        return unlockedAt != nil && progress >= 1.0
    }

    /// 计算属性：进度百分比
    var progressPercentage: Int {
        return Int(progress * 100)
    }
}

/// 成就分类
enum AchievementCategory: String, Codable, CaseIterable {
    case drawing = "drawing"
    case social = "social"
    case time = "time"
    case special = "special"

    var displayName: String {
        switch self {
        case .drawing: return "绘制成就"
        case .social: return "社交成就"
        case .time: return "时间成就"
        case .special: return "特殊成就"
        }
    }

    var icon: String {
        switch self {
        case .drawing: return "paintbrush.fill"
        case .social: return "person.2.fill"
        case .time: return "clock.fill"
        case .special: return "star.fill"
        }
    }

    var color: String {
        switch self {
        case .drawing: return "#3B82F6" // 蓝色
        case .social: return "#10B981" // 绿色
        case .time: return "#F59E0B" // 橙色
        case .special: return "#8B5CF6" // 紫色
        }
    }
}

/// 用户验证
struct UserVerification: Codable {
    let isEmailVerified: Bool
    let isPhoneVerified: Bool
    let isIdentityVerified: Bool
    let verificationLevel: VerificationLevel
    let verifiedAt: String?

    enum CodingKeys: String, CodingKey {
        case isEmailVerified = "is_email_verified"
        case isPhoneVerified = "is_phone_verified"
        case isIdentityVerified = "is_identity_verified"
        case verificationLevel = "verification_level"
        case verifiedAt = "verified_at"
    }

    /// 计算属性：是否已验证
    var isVerified: Bool {
        return verificationLevel != .unverified
    }
}

/// 验证等级
enum VerificationLevel: String, Codable, CaseIterable {
    case unverified = "unverified"
    case basic = "basic"
    case verified = "verified"
    case premium = "premium"

    var displayName: String {
        switch self {
        case .unverified: return "未验证"
        case .basic: return "基础验证"
        case .verified: return "已验证"
        case .premium: return "高级验证"
        }
    }

    var icon: String {
        switch self {
        case .unverified: return "exclamationmark.circle"
        case .basic: return "checkmark.circle"
        case .verified: return "checkmark.shield.fill"
        case .premium: return "crown.fill"
        }
    }

    var color: String {
        switch self {
        case .unverified: return "#EF4444" // 红色
        case .basic: return "#F59E0B" // 橙色
        case .verified: return "#10B981" // 绿色
        case .premium: return "#8B5CF6" // 紫色
        }
    }
}

/// 用户会员
struct UserMembership: Codable {
    let tier: MembershipTier
    let startDate: String
    let endDate: String?
    let autoRenew: Bool
    let benefits: [String]

    enum CodingKeys: String, CodingKey {
        case tier, benefits
        case startDate = "start_date"
        case endDate = "end_date"
        case autoRenew = "auto_renew"
    }

    /// 计算属性：是否有效
    var isActive: Bool {
        guard let endDate = endDate else { return false }
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd'T'HH:mm:ss.SSS'Z"
        guard let expirationDate = formatter.date(from: endDate) else {
            return false
        }
        return expirationDate > Date()
    }

    /// 计算属性：剩余天数
    var remainingDays: Int? {
        guard let endDate = endDate else { return nil }
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd'T'HH:mm:ss.SSS'Z"
        guard let expirationDate = formatter.date(from: endDate) else {
            return nil
        }
        let now = Date()
        let calendar = Calendar.current
        let components = calendar.dateComponents([.day], from: now, to: expirationDate)
        return max(0, components.day ?? 0)
    }
}

/// 会员等级
enum MembershipTier: String, Codable, CaseIterable {
    case free = "free"
    case basic = "basic"
    case premium = "premium"
    case vip = "vip"

    var displayName: String {
        switch self {
        case .free: return "免费用户"
        case .basic: return "基础会员"
        case .premium: return "高级会员"
        case .vip: return "VIP会员"
        }
    }

    var icon: String {
        switch self {
        case .free: return "person.circle"
        case .basic: return "star.circle"
        case .premium: return "star.circle.fill"
        case .vip: return "crown.circle.fill"
        }
    }

    var color: String {
        switch self {
        case .free: return "#6B7280" // 灰色
        case .basic: return "#10B981" // 绿色
        case .premium: return "#3B82F6" // 蓝色
        case .vip: return "#F59E0B" // 金色
        }
    }
}

// MARK: - Drawing History Models

/// 绘制历史记录
struct DrawingHistoryItem: Codable, Identifiable {
    let id: String
    let sessionId: String
    let userId: String
    let username: String
    let displayName: String?
    let pixels: Int
    let duration: Int // 秒
    let thumbnailUrl: String?
    let imageUrl: String?
    let isShared: Bool
    let tags: [String]
    let location: LocationInfo?
    let createdAt: String

    enum CodingKeys: String, CodingKey {
        case id, sessionId, userId, username, displayName, pixels
        case duration, thumbnailUrl, imageUrl, tags, location
        case isShared = "is_shared"
        case createdAt = "created_at"
    }

    /// 计算属性：绘制时长（分钟）
    var durationMinutes: Int {
        return duration / 60
    }

    /// 计算属性：平均像素/分钟
    var averagePixelsPerMinute: Double {
        guard durationMinutes > 0 else { return 0 }
        return Double(pixels) / Double(durationMinutes)
    }
}

/// 位置信息
struct LocationInfo: Codable {
    let latitude: Double
    let longitude: Double
    let gridId: String
    let address: String?

    enum CodingKeys: String, CodingKey {
        case latitude, longitude, address
        case gridId = "grid_id"
    }
}

/// 绘制统计
struct DrawingStats: Codable {
    let totalSessions: Int
    let totalPixels: Int
    let totalDuration: Int
    let averagePixelsPerSession: Double
    let averageDuration: Int
    let longestSession: Int
    let favoriteColors: [ColorUsage]
    let activeDays: Int
    let currentStreak: Int
    let longestStreak: Int

    enum CodingKeys: String, CodingKey {
        case totalSessions, totalPixels, totalDuration
        case averagePixelsPerSession = "average_pixels_per_session"
        case averageDuration = "average_duration"
        case longestSession = "longest_session"
        case favoriteColors = "favorite_colors"
        case activeDays = "active_days"
        case currentStreak = "current_streak"
        case longestStreak = "longest_streak"
    }

    /// 计算属性：总绘制时间（小时）
    var totalHours: Double {
        return Double(totalDuration) / 3600.0
    }
}

/// 颜色使用统计
struct ColorUsage: Codable {
    let color: String
    let usage: Int
    let percentage: Double
}

// MARK: - Social Interaction Models

/// 关注关系
struct FollowRelationship: Codable, Identifiable {
    let id: String
    let followerId: String
    let followingId: String
    let followerName: String
    let followingName: String
    let createdAt: String

    enum CodingKeys: String, CodingKey {
        case id, createdAt
        case followerId = "follower_id"
        case followingId = "following_id"
        case followerName = "follower_name"
        case followingName = "following_name"
    }
}

/// 点赞记录
struct LikeRecord: Codable, Identifiable {
    let id: String
    let userId: String
    let targetUserId: String
    let targetType: LikeTargetType
    let targetId: String
    let createdAt: String

    enum CodingKeys: String, CodingKey {
        case id, createdAt
        case userId = "user_id"
        case targetUserId = "target_user_id"
        case targetType = "target_type"
        case targetId = "target_id"
    }
}

/// 点赞目标类型
enum LikeTargetType: String, Codable, CaseIterable {
    case user = "user"
    case drawing = "drawing"
    case comment = "comment"

    var displayName: String {
        switch self {
        case .user: return "用户"
        case .drawing: return "绘制"
        case .comment: return "评论"
        }
    }
}

// MARK: - Settings Models

/// 账户设置
struct AccountSettings: Codable {
    let profile: ProfileSettings
    let privacy: PrivacySettings
    let notifications: NotificationSettings
    let preferences: AppPreferences
}

/// 个人资料设置
struct ProfileSettings: Codable {
    let allowNameChange: Bool
    let nameChangeFrequency: Int // 天数
    let nextNameChangeDate: String?
    let allowAvatarChange: Bool
    let allowMottoChange: Bool

    enum CodingKeys: String, CodingKey {
        case allowNameChange, allowAvatarChange, allowMottoChange
        case nameChangeFrequency = "name_change_frequency"
        case nextNameChangeDate = "next_name_change_date"
    }

    /// 计算属性：是否可以修改名称
    var canChangeName: Bool {
        guard let nextChangeDate = nextNameChangeDate else { return true }
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd'T'HH:mm:ss.SSS'Z"
        guard let nextChange = formatter.date(from: nextChangeDate) else {
            return true
        }
        return nextChange <= Date()
    }

    /// 计算属性：距离下次可修改名称的天数
    var daysUntilNameChange: Int? {
        guard let nextChangeDate = nextNameChangeDate else { return nil }
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd'T'HH:mm:ss.SSS'Z"
        guard let nextChange = formatter.date(from: nextChangeDate) else {
            return nil
        }
        let now = Date()
        let calendar = Calendar.current
        let components = calendar.dateComponents([.day], from: now, to: nextChange)
        return max(0, components.day ?? 0)
    }
}

/// 通知设置
struct NotificationSettings: Codable {
    let emailNotifications: Bool
    let pushNotifications: Bool
    let followNotifications: Bool
    let likeNotifications: Bool
    let commentNotifications: Bool
    let mentionNotifications: Bool
    let systemNotifications: Bool

    enum CodingKeys: String, CodingKey {
        case emailNotifications = "email_notifications"
        case pushNotifications = "push_notifications"
        case followNotifications = "follow_notifications"
        case likeNotifications = "like_notifications"
        case commentNotifications = "comment_notifications"
        case mentionNotifications = "mention_notifications"
        case systemNotifications = "system_notifications"
    }
}

/// 应用偏好设置
struct AppPreferences: Codable {
    let theme: AppTheme
    let language: String
    let autoSave: Bool
    let soundEffects: Bool
    let vibration: Bool
    let showCoordinates: Bool
    let showGrid: Bool

    enum CodingKeys: String, CodingKey {
        case theme, language, autoSave
        case soundEffects = "sound_effects"
        case vibration
        case showCoordinates = "show_coordinates"
        case showGrid = "show_grid"
    }
}

/// 应用主题
enum AppTheme: String, Codable, CaseIterable {
    case light = "light"
    case dark = "dark"
    case system = "system"

    var displayName: String {
        switch self {
        case .light: return "浅色主题"
        case .dark: return "深色主题"
        case .system: return "跟随系统"
        }
    }
}

// MARK: - Request/Response Models

/// 更新个人资料请求
struct UpdateProfileRequest: Codable {
    let displayName: String?
    let motto: String?
    let avatar: String?
    let privacySettings: PrivacySettings?

    enum CodingKeys: String, CodingKey {
        case displayName, motto, avatar
        case privacySettings = "privacy_settings"
    }
}

/// 修改密码请求
struct ChangePasswordRequest: Codable {
    let currentPassword: String
    let newPassword: String
    let confirmPassword: String

    enum CodingKeys: String, CodingKey {
        case currentPassword = "current_password"
        case newPassword = "new_password"
        case confirmPassword = "confirm_password"
    }
}

/// 删除账户请求
struct DeleteAccountRequest: Codable {
    let password: String
    let reason: String?
}

/// 关注请求
struct FollowRequest: Codable {
    let userId: String

    enum CodingKeys: String, CodingKey {
        case userId = "user_id"
    }
}

/// 点赞请求
struct LikeRequest: Codable {
    let targetId: String
    let targetType: LikeTargetType

    enum CodingKeys: String, CodingKey {
        case targetId = "target_id"
        case targetType = "target_type"
    }
}

/// 标准响应结构

/// 个人资料响应
struct UserProfileResponse: Codable {
    let success: Bool
    let data: UserProfile
    let message: String?
}

/// 绘制历史响应
struct DrawingHistoryResponse: Codable {
    let success: Bool
    let data: [DrawingHistoryItem]
    let pagination: PaginationInfo?
    let message: String?
}

/// 绘制统计响应
struct DrawingStatsResponse: Codable {
    let success: Bool
    let data: DrawingStats
    let message: String?
}

/// 关注关系响应
struct FollowResponse: Codable {
    let success: Bool
    let message: String?
    let data: FollowRelationship?
}

/// 社交统计响应
struct SocialStatsResponse: Codable {
    let success: Bool
    let data: SocialStats
    let message: String?
}

/// 分页信息

// MARK: - Utility Extensions

extension Int {
    /// 格式化数字显示
    func formattedLargeNumber() -> String {
        if self >= 1_000_000 {
            return String(format: "%.1fM", Double(self) / 1_000_000)
        } else if self >= 1_000 {
            return String(format: "%.1fK", Double(self) / 1_000)
        } else {
            return "\(self)"
        }
    }

    /// 格式化时长显示
    func formattedDuration() -> String {
        let hours = self / 3600
        let minutes = (self % 3600) / 60
        if hours > 0 {
            return "\(hours)h\(minutes)m"
        } else {
            return "\(minutes)m"
        }
    }
}

extension String {
    /// 格式化日期显示
    func formattedDate() -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd'T'HH:mm:ss.SSS'Z"

        guard let date = formatter.date(from: self) else {
            return self
        }

        let displayFormatter = DateFormatter()
        displayFormatter.dateStyle = .medium
        displayFormatter.timeStyle = .short

        return displayFormatter.string(from: date)
    }

    /// 格式化相对时间
    func formattedRelativeTime() -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd'T'HH:mm:ss.SSS'Z"

        guard let date = formatter.date(from: self) else {
            return self
        }

        let now = Date()
        let interval = now.timeIntervalSince(date)

        if interval < 60 {
            return "刚刚"
        } else if interval < 3600 {
            return "\(Int(interval / 60))分钟前"
        } else if interval < 86400 {
            return "\(Int(interval / 3600))小时前"
        } else if interval < 604800 {
            return "\(Int(interval / 86400))天前"
        } else {
            let displayFormatter = DateFormatter()
            displayFormatter.dateStyle = .short
            return displayFormatter.string(from: date)
        }
    }

    /// 验证手机号格式（中国）
    var isValidPhoneNumber: Bool {
        let phoneRegex = "^1[3-9]\\d{9}$"
        let predicate = NSPredicate(format: "SELF MATCHES %@", phoneRegex)
        return predicate.evaluate(with: self)
    }
}