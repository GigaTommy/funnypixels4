import Foundation
import CoreLocation

/// 像素模型
public struct Pixel: Codable, Identifiable, Sendable {
    public let id: String
    public let latitude: Double
    public let longitude: Double
    public let color: String
    public let emoji: String?
    public let type: String?
    public let renderType: String?
    public let authorId: String
    public let authorName: String?
    public let authorAvatarUrl: String?
    public let allianceId: String?
    public let allianceName: String?
    public let allianceFlag: String?
    public let city: String?
    public let country: String?
    public let patternId: String?
    public let materialId: String?
    public let payload: String?
    public let imageUrl: String?  // 🆕 用户头像 URL（用于动态加载 sprite）
    public let likeCount: Int?
    public let createdAt: Date
    public let updatedAt: Date

    /// 计算属性：坐标（排除在Codable之外）
    public var coordinate: CLLocationCoordinate2D {
        CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
    }

    // 自定义CodingKeys以排除coordinate属性（它本身就不会被编码因为是计算属性）
    enum CodingKeys: String, CodingKey {
        case id
        case latitude
        case longitude
        case color
        case emoji
        case type
        case renderType = "render_type"
        case authorId
        case authorName
        case authorAvatarUrl
        case allianceId
        case allianceName
        case allianceFlag
        case city
        case country
        case patternId = "pattern_id"
        case materialId = "material_id"
        case payload
        case imageUrl = "image_url"  // 🆕 用户头像 URL
        case likeCount = "like_count"
        case createdAt
        case updatedAt
    }

    private enum AltCodingKeys: String, CodingKey {
        case gridId
        case pixelType
        case patternId
        case userId
        case renderType
    }

    public init(
        id: String = UUID().uuidString,
        latitude: Double,
        longitude: Double,
        color: String,
        emoji: String? = nil,
        type: String? = nil,
        renderType: String? = nil,
        authorId: String,
        authorName: String? = nil,
        authorAvatarUrl: String? = nil,
        allianceId: String? = nil,
        allianceName: String? = nil,
        allianceFlag: String? = nil,
        city: String? = nil,
        country: String? = nil,
        patternId: String? = nil,
        materialId: String? = nil,
        payload: String? = nil,
        imageUrl: String? = nil,
        likeCount: Int? = nil,
        createdAt: Date = Date(),
        updatedAt: Date = Date()
    ) {
        self.id = id
        self.latitude = latitude
        self.longitude = longitude
        self.color = color
        self.emoji = emoji
        self.type = type
        self.renderType = renderType
        self.authorId = authorId
        self.authorName = authorName
        self.authorAvatarUrl = authorAvatarUrl
        self.allianceId = allianceId
        self.allianceName = allianceName
        self.allianceFlag = allianceFlag
        self.city = city
        self.country = country
        self.patternId = patternId
        self.materialId = materialId
        self.payload = payload
        self.imageUrl = imageUrl
        self.likeCount = likeCount
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let altContainer = try decoder.container(keyedBy: AltCodingKeys.self)

        func decodeDouble(_ key: CodingKeys, defaultValue: Double = 0) -> Double {
            if let value = (try? container.decodeIfPresent(Double.self, forKey: key)) ?? nil {
                return value
            }
            if let str = (try? container.decodeIfPresent(String.self, forKey: key)) ?? nil,
               let parsed = Double(str) {
                return parsed
            }
            return defaultValue
        }

        func decodeDate(_ key: CodingKeys) -> Date? {
            if let value = (try? container.decodeIfPresent(Date.self, forKey: key)) ?? nil {
                return value
            }
            if let timestamp = (try? container.decodeIfPresent(Double.self, forKey: key)) ?? nil {
                return Date(timeIntervalSince1970: timestamp)
            }
            if let timestamp = (try? container.decodeIfPresent(Int.self, forKey: key)) ?? nil {
                return Date(timeIntervalSince1970: TimeInterval(timestamp))
            }
            if let str = (try? container.decodeIfPresent(String.self, forKey: key)) ?? nil {
                let iso = ISO8601DateFormatter()
                iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
                if let date = iso.date(from: str) {
                    return date
                }
                let isoNoFrac = ISO8601DateFormatter()
                isoNoFrac.formatOptions = [.withInternetDateTime]
                if let date = isoNoFrac.date(from: str) {
                    return date
                }
            }
            return nil
        }

        self.id = try container.decodeIfPresent(String.self, forKey: .id)
            ?? altContainer.decodeIfPresent(String.self, forKey: .gridId)
            ?? UUID().uuidString

        self.latitude = decodeDouble(.latitude)
        self.longitude = decodeDouble(.longitude)

        self.color = try container.decodeIfPresent(String.self, forKey: .color)
            ?? "#4ECDC4"
        self.emoji = try container.decodeIfPresent(String.self, forKey: .emoji)
        self.type = try container.decodeIfPresent(String.self, forKey: .type)
            ?? altContainer.decodeIfPresent(String.self, forKey: .pixelType)
        self.renderType = try container.decodeIfPresent(String.self, forKey: .renderType)
            ?? altContainer.decodeIfPresent(String.self, forKey: .renderType)

        self.authorId = try container.decodeIfPresent(String.self, forKey: .authorId)
            ?? altContainer.decodeIfPresent(String.self, forKey: .userId)
            ?? ""
        self.authorName = try container.decodeIfPresent(String.self, forKey: .authorName)
        self.authorAvatarUrl = try container.decodeIfPresent(String.self, forKey: .authorAvatarUrl)
        self.allianceId = try container.decodeIfPresent(String.self, forKey: .allianceId)
        self.allianceName = try container.decodeIfPresent(String.self, forKey: .allianceName)
        self.allianceFlag = try container.decodeIfPresent(String.self, forKey: .allianceFlag)
        self.city = try container.decodeIfPresent(String.self, forKey: .city)
        self.country = try container.decodeIfPresent(String.self, forKey: .country)
        self.patternId = try container.decodeIfPresent(String.self, forKey: .patternId)
            ?? altContainer.decodeIfPresent(String.self, forKey: .patternId)
        self.materialId = try container.decodeIfPresent(String.self, forKey: .materialId)
        self.payload = try container.decodeIfPresent(String.self, forKey: .payload)
        self.imageUrl = try container.decodeIfPresent(String.self, forKey: .imageUrl)
        self.likeCount = try container.decodeIfPresent(Int.self, forKey: .likeCount)

        self.createdAt = decodeDate(.createdAt) ?? Date()
        self.updatedAt = decodeDate(.updatedAt) ?? Date()
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(id, forKey: .id)
        try container.encode(latitude, forKey: .latitude)
        try container.encode(longitude, forKey: .longitude)
        try container.encode(color, forKey: .color)
        try container.encodeIfPresent(emoji, forKey: .emoji)
        try container.encodeIfPresent(type, forKey: .type)
        try container.encodeIfPresent(renderType, forKey: .renderType)
        try container.encode(authorId, forKey: .authorId)
        try container.encodeIfPresent(authorName, forKey: .authorName)
        try container.encodeIfPresent(authorAvatarUrl, forKey: .authorAvatarUrl)
        try container.encodeIfPresent(allianceId, forKey: .allianceId)
        try container.encodeIfPresent(allianceName, forKey: .allianceName)
        try container.encodeIfPresent(allianceFlag, forKey: .allianceFlag)
        try container.encodeIfPresent(city, forKey: .city)
        try container.encodeIfPresent(country, forKey: .country)
        try container.encodeIfPresent(patternId, forKey: .patternId)
        try container.encodeIfPresent(materialId, forKey: .materialId)
        try container.encodeIfPresent(payload, forKey: .payload)
        try container.encodeIfPresent(imageUrl, forKey: .imageUrl)
        try container.encodeIfPresent(likeCount, forKey: .likeCount)
        try container.encode(createdAt, forKey: .createdAt)
        try container.encode(updatedAt, forKey: .updatedAt)
    }
}

/// 像素类型
public enum PixelType: String, CaseIterable, Codable {
    case normal = "normal"
    case pattern = "pattern"
    case advertisement = "advertisement"
    case custom = "custom"
}

/// 像素颜色常量
public struct PixelColors {
    public static let defaultColors = [
        "#FF6B6B", // 红色
        "#4ECDC4", // 青色
        "#FFE66D", // 黄色
        "#A8E6CF", // 绿色
        "#FFD3B6", // 粉色
        "#FF8CC6", // 粉红色
        "#C8B6DB", // 紫色
        "#FFA07A", // 橙色
        "#98D8C8", // 薄荷绿
        "#F7DC6F", // 桃色
    ]
}
