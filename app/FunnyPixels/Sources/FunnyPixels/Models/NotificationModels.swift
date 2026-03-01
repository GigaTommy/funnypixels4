import Foundation

// MARK: - Notification Models

/// App 通知模型
struct AppNotification: Identifiable, Codable, Hashable {
    let id: Int  // ✅ 修复：id 是整数类型
    let userId: String
    let type: String
    let title: String
    let message: String  // ✅ 修复：使用 message 而非 content
    let data: AnyCodable?
    var isRead: Bool
    let createdAt: Date
    let readAt: Date?  // ✅ 新增：已读时间
    let updatedAt: Date?  // ✅ 新增：更新时间

    enum CodingKeys: String, CodingKey {
        case id, type, title, message, data  // ✅ 使用 message
        case userId = "user_id"
        case isRead = "is_read"
        case createdAt = "created_at"
        case readAt = "read_at"
        case updatedAt = "updated_at"
    }

    /// 通知类型
    var notificationType: NotificationType {
        NotificationType(rawValue: type) ?? .system
    }

    /// 便利属性：获取通知内容（兼容旧代码）
    var content: String {
        return message
    }
}

/// 通知类型枚举
enum NotificationType: String, CaseIterable {
    case achievement = "achievement"              // 成就解锁
    case eventReward = "event_reward"             // 活动奖励
    case eventEnded = "event_ended"               // 活动结束
    case eventStarted = "event_started"           // 活动开始
    case allianceApplication = "alliance_application"  // 联盟申请
    case allianceApplicationResult = "alliance_application_result"  // 联盟申请结果
    case system = "system"                        // 系统通知

    var displayName: String {
        switch self {
        case .achievement:
            return L10n.NotificationType.achievement
        case .eventReward:
            return L10n.NotificationType.eventReward
        case .eventEnded:
            return L10n.NotificationType.eventEnded
        case .eventStarted:
            return L10n.NotificationType.eventStarted
        case .allianceApplication:
            return L10n.NotificationType.allianceApplication
        case .allianceApplicationResult:
            return L10n.NotificationType.allianceResult
        case .system:
            return L10n.NotificationType.system
        }
    }

    var icon: String {
        switch self {
        case .achievement:
            return "trophy.fill"
        case .eventReward:
            return "gift.fill"
        case .eventEnded:
            return "flag.checkered"
        case .eventStarted:
            return "flag.fill"
        case .allianceApplication:
            return "person.2.fill"
        case .allianceApplicationResult:
            return "checkmark.circle.fill"
        case .system:
            return "bell.fill"
        }
    }

    var color: String {
        switch self {
        case .achievement:
            return "#FFA500"  // Orange
        case .eventReward:
            return "#9C27B0"  // Purple
        case .eventEnded, .eventStarted:
            return "#2196F3"  // Blue
        case .allianceApplication, .allianceApplicationResult:
            return "#4CAF50"  // Green
        case .system:
            return "#9E9E9E"  // Gray
        }
    }
}

/// 通知列表响应
struct NotificationListResponse: Codable {
    let success: Bool
    let data: NotificationData

    struct NotificationData: Codable {
        let notifications: [AppNotification]
        let pagination: Pagination
    }
}

/// 未读数量响应
struct UnreadCountResponse: Codable {
    let success: Bool
    let data: UnreadCountData

    struct UnreadCountData: Codable {
        let unreadCount: Int

        enum CodingKeys: String, CodingKey {
            case unreadCount = "unread_count"
        }
    }
}

/// 分页信息
struct Pagination: Codable {
    let page: Int
    let limit: Int
    let total: Int
    let totalPages: Int

    enum CodingKeys: String, CodingKey {
        case page, limit, total
        case totalPages = "total_pages"
    }
}

/// 用于解码任意 JSON 的辅助类型
struct AnyCodable: Codable, Hashable {
    let value: Any

    init(_ value: Any) {
        self.value = value
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()

        if let bool = try? container.decode(Bool.self) {
            value = bool
        } else if let int = try? container.decode(Int.self) {
            value = int
        } else if let double = try? container.decode(Double.self) {
            value = double
        } else if let string = try? container.decode(String.self) {
            value = string
        } else if let array = try? container.decode([AnyCodable].self) {
            value = array.map { $0.value }
        } else if let dict = try? container.decode([String: AnyCodable].self) {
            value = dict.mapValues { $0.value }
        } else {
            value = NSNull()
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()

        switch value {
        case let bool as Bool:
            try container.encode(bool)
        case let int as Int:
            try container.encode(int)
        case let double as Double:
            try container.encode(double)
        case let string as String:
            try container.encode(string)
        case let array as [Any]:
            try container.encode(array.map { AnyCodable($0) })
        case let dict as [String: Any]:
            try container.encode(dict.mapValues { AnyCodable($0) })
        default:
            try container.encodeNil()
        }
    }

    static func == (lhs: AnyCodable, rhs: AnyCodable) -> Bool {
        // Simple comparison for common types
        switch (lhs.value, rhs.value) {
        case let (l as Bool, r as Bool): return l == r
        case let (l as Int, r as Int): return l == r
        case let (l as Double, r as Double): return l == r
        case let (l as String, r as String): return l == r
        default: return false
        }
    }

    func hash(into hasher: inout Hasher) {
        // Hash based on type and value
        switch value {
        case let bool as Bool:
            hasher.combine(bool)
        case let int as Int:
            hasher.combine(int)
        case let double as Double:
            hasher.combine(double)
        case let string as String:
            hasher.combine(string)
        default:
            break
        }
    }
}
