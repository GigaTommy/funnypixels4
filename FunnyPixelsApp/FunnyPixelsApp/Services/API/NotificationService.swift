import Foundation

/// 消息通知服务
class NotificationService {
    static let shared = NotificationService()
    
    struct SystemMessage: Codable, Identifiable {
        let id: String
        let sender_id: String?
        let receiver_id: String?
        let title: String
        let content: String
        let attachments: [String: JSONValue]?
        let type: String // notification, reward, activity
        var is_read: Bool
        let created_at: String
        
        enum CodingKeys: String, CodingKey {
            case id, sender_id, receiver_id, title, content, attachments, type, is_read, created_at
        }
    }
    
    struct UnreadCount: Codable {
        let system_unread: Int
        let notification_unread: Int
        let total_unread: Int
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
    
    private init() {}
    
    /// 获取未读消息统计
    func getUnreadCount() async throws -> UnreadCount {
        let response: UnreadResponse = try await APIManager.shared.get("/messages/unread-count")
        return response.data
    }
    
    /// 获取消息列表
    func getMessages(page: Int = 1, limit: Int = 20) async throws -> [SystemMessage] {
        let response: MessageResponse = try await APIManager.shared.get("/messages", parameters: [
            "page": String(page),
            "limit": String(limit)
        ])
        return response.data.messages
    }
    
    /// 标记消息为已读
    func markAsRead(id: String) async throws {
        let _: SuccessResponse = try await APIManager.shared.put("/messages/\(id)/read", parameters: [:])
    }
}

// 简单的 JSON 处理
enum JSONValue: Codable {
    case string(String)
    case int(Int)
    case double(Double)
    case bool(Bool)
    case dictionary([String: JSONValue])
    case array([JSONValue])
    case null

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let x = try? container.decode(String.self) { self = .string(x) }
        else if let x = try? container.decode(Int.self) { self = .int(x) }
        else if let x = try? container.decode(Double.self) { self = .double(x) }
        else if let x = try? container.decode(Bool.self) { self = .bool(x) }
        else if let x = try? container.decode([String: JSONValue].self) { self = .dictionary(x) }
        else if let x = try? container.decode([JSONValue].self) { self = .array(x) }
        else { self = .null }
    }

    func encode(to encoder: Encoder) throws {
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

    var doubleValue: Double? {
        switch self {
        case .double(let v): return v
        case .int(let v): return Double(v)
        case .string(let v): return Double(v)
        default: return nil
        }
    }
}
