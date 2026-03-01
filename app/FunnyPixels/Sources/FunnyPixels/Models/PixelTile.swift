import Foundation
import MapKit

/// 像素Tile边界
public struct TileBounds: Codable, Hashable {
    public let minLatitude: Double
    public let maxLatitude: Double
    public let minLongitude: Double
    public let maxLongitude: Double

    /// 计算属性：转换为MKMapRect
    public var mapRect: MKMapRect {
        let topLeft = MKMapPoint(CLLocationCoordinate2D(latitude: maxLatitude, longitude: minLongitude))
        let bottomRight = MKMapPoint(CLLocationCoordinate2D(latitude: minLatitude, longitude: maxLongitude))

        return MKMapRect(
            x: topLeft.x,
            y: topLeft.y,
            width: bottomRight.x - topLeft.x,
            height: bottomRight.y - topLeft.y
        )
    }

    /// 计算属性：中心坐标
    public var center: CLLocationCoordinate2D {
        CLLocationCoordinate2D(
            latitude: (minLatitude + maxLatitude) / 2,
            longitude: (minLongitude + maxLongitude) / 2
        )
    }

    /// 计算属性：宽度（经度差）
    public var width: Double {
        maxLongitude - minLongitude
    }

    /// 计算属性：高度（纬度差）
    public var height: Double {
        maxLatitude - minLatitude
    }

    public init(minLatitude: Double, maxLatitude: Double, minLongitude: Double, maxLongitude: Double) {
        self.minLatitude = minLatitude
        self.maxLatitude = maxLatitude
        self.minLongitude = minLongitude
        self.maxLongitude = maxLongitude
    }

    /// 检查坐标是否在边界内
    /// - Parameter coordinate: 要检查的坐标
    /// - Returns: 如果坐标在边界内返回true，否则返回false
    public func contains(_ coordinate: CLLocationCoordinate2D) -> Bool {
        return coordinate.latitude >= minLatitude &&
               coordinate.latitude <= maxLatitude &&
               coordinate.longitude >= minLongitude &&
               coordinate.longitude <= maxLongitude
    }

    /// 检查边界是否与另一个边界相交
    /// - Parameter other: 另一个边界
    /// - Returns: 如果相交返回true，否则返回false
    public func intersects(_ other: TileBounds) -> Bool {
        return !(maxLatitude < other.minLatitude ||
                minLatitude > other.maxLatitude ||
                maxLongitude < other.minLongitude ||
                minLongitude > other.maxLongitude)
    }
}

/// 像素Tile数据结构
public struct PixelTile: Identifiable, Codable {
    public let id: String
    public let bounds: TileBounds
    public let zoomLevel: Int
    public var pixels: [Pixel]
    public var lastUpdated: Date

    /// 计算属性：像素数量
    public var pixelCount: Int {
        pixels.count
    }

    /// 计算属性：是否为空
    public var isEmpty: Bool {
        pixels.isEmpty
    }

    public init(
        id: String = UUID().uuidString,
        bounds: TileBounds,
        zoomLevel: Int,
        pixels: [Pixel] = [],
        lastUpdated: Date = Date()
    ) {
        self.id = id
        self.bounds = bounds
        self.zoomLevel = zoomLevel
        self.pixels = pixels
        self.lastUpdated = lastUpdated
    }

    /// 生成Tile ID（基于边界和缩放级别）
    /// - Parameters:
    ///   - bounds: Tile边界
    ///   - zoomLevel: 缩放级别
    /// - Returns: Tile ID
    public static func generateId(bounds: TileBounds, zoomLevel: Int) -> String {
        return "\(zoomLevel)_\(bounds.minLatitude)_\(bounds.minLongitude)_\(bounds.maxLatitude)_\(bounds.maxLongitude)"
    }

    /// 添加像素到Tile
    /// - Parameter pixel: 要添加的像素
    mutating public func addPixel(_ pixel: Pixel) {
        if bounds.contains(pixel.coordinate) {
            pixels.append(pixel)
            lastUpdated = Date()
        }
    }

    /// 移除像素
    /// - Parameter pixelId: 要移除的像素ID
    mutating public func removePixel(withId pixelId: String) {
        pixels.removeAll { $0.id == pixelId }
        lastUpdated = Date()
    }

    /// 更新像素
    /// - Parameter pixel: 要更新的像素
    mutating public func updatePixel(_ pixel: Pixel) {
        if let index = pixels.firstIndex(where: { $0.id == pixel.id }) {
            pixels[index] = pixel
            lastUpdated = Date()
        }
    }

    /// 过滤指定颜色的像素
    /// - Parameter color: 颜色值
    /// - Returns: 指定颜色的像素数组
    public func pixels(withColor color: String) -> [Pixel] {
        pixels.filter { $0.color == color }
    }

    /// 过滤指定作者的像素
    /// - Parameter authorId: 作者ID
    /// - Returns: 指定作者的像素数组
    public func pixels(byAuthor authorId: String) -> [Pixel] {
        pixels.filter { $0.authorId == authorId }
    }
}

// MARK: - PixelTile Extensions

extension PixelTile: Equatable {
    public static func == (lhs: PixelTile, rhs: PixelTile) -> Bool {
        lhs.id == rhs.id
    }
}

extension PixelTile: Hashable {
    public func hash(into hasher: inout Hasher) {
        hasher.combine(id)
    }
}
