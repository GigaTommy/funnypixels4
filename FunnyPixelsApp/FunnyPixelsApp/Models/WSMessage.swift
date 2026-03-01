import Foundation

// MARK: - WebSocket Event Types

/// WebSocket 事件类型
public enum WSEventType: String, Codable {
    case pixelAdded = "pixel_added"
    case pixelUpdated = "pixel_updated"
    case pixelRemoved = "pixel_removed"
    case regionUpdate = "region_update"
    case error = "error"
    case ping = "ping"
    case pong = "pong"
}

// MARK: - WebSocket Message

/// WebSocket 消息模型
public struct WSMessage: Codable {
    /// 消息类型
    public let type: WSEventType

    /// 消息数据
    public let data: WSMessageData

    /// 时间戳
    public let timestamp: Date

    /// 消息ID（用于追踪和去重）
    public let messageId: String

    public init(
        type: WSEventType,
        data: WSMessageData,
        timestamp: Date = Date(),
        messageId: String = UUID().uuidString
    ) {
        self.type = type
        self.data = data
        self.timestamp = timestamp
        self.messageId = messageId
    }

    // MARK: - Codable

    enum CodingKeys: String, CodingKey {
        case type
        case data
        case timestamp
        case messageId = "message_id"
    }
}

// MARK: - WebSocket Message Data

/// WebSocket 消息数据
public enum WSMessageData: Codable {
    case pixel(Pixel)
    case pixels([Pixel])
    case region(WSTileBounds)
    case error(String)
    case empty

    // MARK: - Codable

    enum CodingKeys: String, CodingKey {
        case type
        case pixel
        case pixels
        case region
        case error
    }

    enum DataType: String, Codable {
        case pixel
        case pixels
        case region
        case error
        case empty
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let type = try container.decode(DataType.self, forKey: .type)

        switch type {
        case .pixel:
            let pixel = try container.decode(Pixel.self, forKey: .pixel)
            self = .pixel(pixel)

        case .pixels:
            let pixels = try container.decode([Pixel].self, forKey: .pixels)
            self = .pixels(pixels)

        case .region:
            let region = try container.decode(WSTileBounds.self, forKey: .region)
            self = .region(region)

        case .error:
            let errorMessage = try container.decode(String.self, forKey: .error)
            self = .error(errorMessage)

        case .empty:
            self = .empty
        }
    }

    public func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)

        switch self {
        case .pixel(let pixel):
            try container.encode(DataType.pixel, forKey: .type)
            try container.encode(pixel, forKey: .pixel)

        case .pixels(let pixels):
            try container.encode(DataType.pixels, forKey: .type)
            try container.encode(pixels, forKey: .pixels)

        case .region(let bounds):
            try container.encode(DataType.region, forKey: .type)
            try container.encode(bounds, forKey: .region)

        case .error(let message):
            try container.encode(DataType.error, forKey: .type)
            try container.encode(message, forKey: .error)

        case .empty:
            try container.encode(DataType.empty, forKey: .type)
        }
    }
}

// MARK: - WebSocket Tile Bounds

/// WebSocket区域订阅边界（用于WebSocket区域订阅）
public struct WSTileBounds: Codable, Equatable, Hashable {
    /// 最小纬度
    public let minLat: Double

    /// 最大纬度
    public let maxLat: Double

    /// 最小经度
    public let minLng: Double

    /// 最大经度
    public let maxLng: Double

    /// 缩放级别
    public let zoom: Int

    /// 瓦片X坐标
    public let tileX: Int?

    /// 瓦片Y坐标
    public let tileY: Int?

    public init(
        minLat: Double,
        maxLat: Double,
        minLng: Double,
        maxLng: Double,
        zoom: Int = 15,
        tileX: Int? = nil,
        tileY: Int? = nil
    ) {
        self.minLat = minLat
        self.maxLat = maxLat
        self.minLng = minLng
        self.maxLng = maxLng
        self.zoom = zoom
        self.tileX = tileX
        self.tileY = tileY
    }

    /// 生成区域ID（用于订阅管理）
    public var regionId: String {
        if let x = tileX, let y = tileY {
            return "\(zoom)_\(x)_\(y)"
        }
        return "\(minLat)_\(maxLat)_\(minLng)_\(maxLng)_\(zoom)"
    }

    /// 检查坐标是否在边界内
    public func contains(latitude: Double, longitude: Double) -> Bool {
        return latitude >= minLat && latitude <= maxLat &&
               longitude >= minLng && longitude <= maxLng
    }

    // MARK: - Codable

    enum CodingKeys: String, CodingKey {
        case minLat = "min_lat"
        case maxLat = "max_lat"
        case minLng = "min_lng"
        case maxLng = "max_lng"
        case zoom
        case tileX = "tile_x"
        case tileY = "tile_y"
    }
}

// MARK: - Convenience Extensions

extension WSMessage {
    /// 创建像素添加消息
    public static func pixelAdded(_ pixel: Pixel) -> WSMessage {
        WSMessage(type: .pixelAdded, data: .pixel(pixel))
    }

    /// 创建像素更新消息
    public static func pixelUpdated(_ pixel: Pixel) -> WSMessage {
        WSMessage(type: .pixelUpdated, data: .pixel(pixel))
    }

    /// 创建像素删除消息
    public static func pixelRemoved(_ pixel: Pixel) -> WSMessage {
        WSMessage(type: .pixelRemoved, data: .pixel(pixel))
    }

    /// 创建区域更新消息
    public static func regionUpdate(_ bounds: WSTileBounds, pixels: [Pixel]) -> WSMessage {
        WSMessage(type: .regionUpdate, data: .pixels(pixels))
    }

    /// 创建错误消息
    public static func error(_ message: String) -> WSMessage {
        WSMessage(type: .error, data: .error(message))
    }

    /// 创建ping消息
    public static func ping() -> WSMessage {
        WSMessage(type: .ping, data: .empty)
    }

    /// 创建pong消息
    public static func pong() -> WSMessage {
        WSMessage(type: .pong, data: .empty)
    }
}
