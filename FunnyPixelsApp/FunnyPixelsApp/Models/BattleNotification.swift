import Foundation
import CoreLocation

/// 领土动态 - WebSocket 实时事件
public struct TerritoryBattleEvent: Identifiable, Sendable {
    public var id: String { "\(grid_id)_\(timestamp)" }

    public let attacker_id: String
    public let grid_id: String
    public let latitude: Double
    public let longitude: Double
    public let old_color: String?
    public let new_color: String?
    public let old_pattern_id: String?
    public let new_pattern_id: String?
    public let count: Int?
    public let timestamp: Double

    public var coordinate: CLLocationCoordinate2D {
        CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
    }

    private enum CodingKeys: String, CodingKey {
        case attacker_id, grid_id, latitude, longitude
        case old_color, new_color, old_pattern_id, new_pattern_id
        case count, timestamp
    }
}

extension TerritoryBattleEvent: Codable {
    public nonisolated init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        attacker_id = try container.decode(String.self, forKey: .attacker_id)
        grid_id = try container.decode(String.self, forKey: .grid_id)
        latitude = try container.decode(Double.self, forKey: .latitude)
        longitude = try container.decode(Double.self, forKey: .longitude)
        old_color = try container.decodeIfPresent(String.self, forKey: .old_color)
        new_color = try container.decodeIfPresent(String.self, forKey: .new_color)
        old_pattern_id = try container.decodeIfPresent(String.self, forKey: .old_pattern_id)
        new_pattern_id = try container.decodeIfPresent(String.self, forKey: .new_pattern_id)
        count = try container.decodeIfPresent(Int.self, forKey: .count)
        timestamp = try container.decode(Double.self, forKey: .timestamp)
    }

    public nonisolated func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(attacker_id, forKey: .attacker_id)
        try container.encode(grid_id, forKey: .grid_id)
        try container.encode(latitude, forKey: .latitude)
        try container.encode(longitude, forKey: .longitude)
        try container.encodeIfPresent(old_color, forKey: .old_color)
        try container.encodeIfPresent(new_color, forKey: .new_color)
        try container.encodeIfPresent(old_pattern_id, forKey: .old_pattern_id)
        try container.encodeIfPresent(new_pattern_id, forKey: .new_pattern_id)
        try container.encodeIfPresent(count, forKey: .count)
        try container.encode(timestamp, forKey: .timestamp)
    }
}

/// 领土动态 - API feed 单条记录
struct BattleFeedItem: Codable, Identifiable {
    let id: String
    let attacker_id: String
    let victim_id: String
    let grid_id: String
    let latitude: Double
    let longitude: Double
    let old_color: String?
    let new_color: String?
    let old_pattern_id: String?
    let new_pattern_id: String?
    let region_name: String?
    let created_at: String
    let attacker_name: String?
    let attacker_avatar: String?

    var coordinate: CLLocationCoordinate2D {
        CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
    }

    var timeAgo: String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        guard let date = formatter.date(from: created_at) else { return created_at }
        let interval = Date().timeIntervalSince(date)
        if interval < 60 { return "刚刚" }
        if interval < 3600 { return "\(Int(interval / 60))分钟前" }
        if interval < 86400 { return "\(Int(interval / 3600))小时前" }
        return "\(Int(interval / 86400))天前"
    }
}

/// 领土动态 - API 分页响应
struct BattleFeedResponse: Codable {
    let success: Bool?
    let data: BattleFeedData
}

struct BattleFeedData: Codable {
    let battles: [BattleFeedItem]
    let pagination: BattlePagination
}

struct BattlePagination: Codable {
    let page: Int
    let limit: Int
    let total: Int
    let total_pages: Int
}

/// 未读数响应
struct BattleUnreadResponse: Codable {
    let success: Bool?
    let data: BattleUnreadData
}

struct BattleUnreadData: Codable {
    let unread_count: Int
}
