import Foundation

/// 消息通知服务
public class NotificationService {
    public static let shared = NotificationService()

    private init() {}

    public struct SystemMessage: Identifiable, Sendable {
        public let id: String
        public let sender_id: String?
        public let receiver_id: String?
        public let title: String
        public let content: String
        public let attachments: [String: JSONValue]?
        public let type: String // notification, reward, activity
        public var is_read: Bool
        public let created_at: String

        enum CodingKeys: String, CodingKey {
            case id, sender_id, receiver_id, title, content, attachments, type, is_read, created_at
        }
    }
}

// MARK: - Codable Conformance
extension NotificationService.SystemMessage: Codable {
    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        sender_id = try container.decodeIfPresent(String.self, forKey: .sender_id)
        receiver_id = try container.decodeIfPresent(String.self, forKey: .receiver_id)
        title = try container.decode(String.self, forKey: .title)
        content = try container.decode(String.self, forKey: .content)
        attachments = try container.decodeIfPresent([String: JSONValue].self, forKey: .attachments)
        type = try container.decode(String.self, forKey: .type)
        is_read = try container.decode(Bool.self, forKey: .is_read)
        created_at = try container.decode(String.self, forKey: .created_at)
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(id, forKey: .id)
        try container.encodeIfPresent(sender_id, forKey: .sender_id)
        try container.encodeIfPresent(receiver_id, forKey: .receiver_id)
        try container.encode(title, forKey: .title)
        try container.encode(content, forKey: .content)
        try container.encodeIfPresent(attachments, forKey: .attachments)
        try container.encode(type, forKey: .type)
        try container.encode(is_read, forKey: .is_read)
        try container.encode(created_at, forKey: .created_at)
    }
}

// MARK: - NotificationService Types
extension NotificationService {

    public struct UnreadCount: Codable {
        public let system_unread: Int
        public let notification_unread: Int
        public let announcement_unread: Int?
        public let total_unread: Int
    }
    
    struct MessageResponse: Codable {
        let success: Bool?
        let data: MessageListData
    }
    
    struct MessageListData: Codable {
        let messages: [SystemMessage]
        let pagination: Pagination
    }
    
    struct UnreadResponse: Codable {
        let success: Bool?
        let data: UnreadCount
    }
    
    struct Pagination: Codable {
        let page: Int
        let limit: Int
        let total: Int
        let total_pages: Int
    }

    /// 获取未读消息统计
    public func getUnreadCount() async throws -> UnreadCount {
        let response: UnreadResponse = try await APIManager.shared.get("/messages/unread-count")
        return response.data
    }

    /// 获取消息列表
    /// - Parameters:
    ///   - page: 页码
    ///   - limit: 每页数量
    ///   - type: 消息类型筛选（可选）
    public func getMessages(page: Int = 1, limit: Int = 20, type: String? = nil) async throws -> [SystemMessage] {
        var parameters: [String: String] = [
            "page": String(page),
            "limit": String(limit)
        ]

        if let type = type {
            parameters["type"] = type
        }

        let response: MessageResponse = try await APIManager.shared.get("/messages", parameters: parameters)
        return response.data.messages
    }
    
    /// 标记消息为已读
    public func markAsRead(id: String) async throws {
        let _: SuccessResponse = try await APIManager.shared.put("/messages/\(id)/read", parameters: [:])
    }

    /// 批量标记为已读
    /// - Parameter ids: 消息ID列表
    public func batchMarkAsRead(ids: [String]) async throws {
        let parameters: [String: Any] = ["messageIds": ids]
        let _: SuccessResponse = try await APIManager.shared.put("/messages/batch/read", parameters: parameters)
    }

    /// 批量删除消息
    /// - Parameter ids: 消息ID列表
    public func batchDelete(ids: [String]) async throws {
        let parameters: [String: Any] = ["messageIds": ids]
        let _: SuccessResponse = try await APIManager.shared.delete("/messages/batch", parameters: parameters)
    }
}

// 简单的 JSON 处理
public enum JSONValue: Sendable {
    case string(String)
    case int(Int)
    case double(Double)
    case bool(Bool)
    case dictionary([String: JSONValue])
    case array([JSONValue])
    case null

    public var doubleValue: Double? {
        switch self {
        case .double(let v): return v
        case .int(let v): return Double(v)
        case .string(let v): return Double(v)
        default: return nil
        }
    }
}

extension JSONValue: Codable {
    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let x = try? container.decode(String.self) { self = .string(x) }
        else if let x = try? container.decode(Int.self) { self = .int(x) }
        else if let x = try? container.decode(Double.self) { self = .double(x) }
        else if let x = try? container.decode(Bool.self) { self = .bool(x) }
        else if let x = try? container.decode([String: JSONValue].self) { self = .dictionary(x) }
        else if let x = try? container.decode([JSONValue].self) { self = .array(x) }
        else { self = .null }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .string(let x): try container.encode(x)
        case .int(let x): try container.encode(x)
        case .double(let x): try container.encode(x)
        case .bool(let x): try container.encode(x)
        case .dictionary(let x): try container.encode(x)
        case .array(let x): try container.encode(x)
        case .null: try container.encodeNil()
        }
    }
}
