import Foundation
import CoreLocation

/// 像素模型
public struct Pixel: Codable, Identifiable {
    public let id: String
    public let latitude: Double
    public let longitude: Double
    public let color: String
    public let authorId: String
    public let createdAt: Date
    public let updatedAt: Date

    /// 计算属性：坐标
    public var coordinate: CLLocationCoordinate2D {
        CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
    }

    public init(
        id: String = UUID().uuidString,
        latitude: Double,
        longitude: Double,
        color: String,
        authorId: String,
        createdAt: Date = Date(),
        updatedAt: Date = Date()
    ) {
        self.id = id
        self.latitude = latitude
        self.longitude = longitude
        self.color = color
        self.authorId = authorId
        self.createdAt = createdAt
        self.updatedAt = updatedAt
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