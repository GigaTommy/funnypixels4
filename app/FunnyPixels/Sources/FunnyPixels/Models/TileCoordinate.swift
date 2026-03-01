import Foundation
import CoreLocation

/// 瓦片坐标系统 (XYZ Tile Coordinate System)
/// 用于地图渲染和矢量瓦片 (MVT)
public struct TileCoordinate: Hashable, Codable, Sendable {
    /// X 坐标 (列号)
    public let x: Int

    /// Y 坐标 (行号)
    public let y: Int

    /// Z 坐标 (缩放级别)
    public let z: Int

    public init(x: Int, y: Int, z: Int) {
        self.x = x
        self.y = y
        self.z = z
    }

    /// 缓存键
    public var cacheKey: String {
        "\(z)_\(x)_\(y)"
    }

    /// 瓦片 ID
    public var tileId: String {
        cacheKey
    }

    /// 父瓦片 (缩小一级)
    public var parent: TileCoordinate {
        TileCoordinate(x: x / 2, y: y / 2, z: z - 1)
    }

    /// 子瓦片 (放大一级)
    public func children() -> [TileCoordinate] {
        let newZ = z + 1
        return [
            TileCoordinate(x: x * 2, y: y * 2, z: newZ),
            TileCoordinate(x: x * 2 + 1, y: y * 2, z: newZ),
            TileCoordinate(x: x * 2, y: y * 2 + 1, z: newZ),
            TileCoordinate(x: x * 2 + 1, y: y * 2 + 1, z: newZ)
        ]
    }

    /// 瓦片边界 (TileBounds)
    public var bounds: TileBounds {
        let n = pow(2.0, Double(z))
        let minLon = Double(x) / n * 360.0 - 180.0
        let maxLon = Double(x + 1) / n * 360.0 - 180.0

        let latRad = atan(sinh(.pi * (1 - 2 * Double(y) / n)))
        let maxLat = latRad * 180 / .pi

        let latRad2 = atan(sinh(.pi * (1 - 2 * Double(y + 1) / n)))
        let minLat = latRad2 * 180 / .pi

        return TileBounds(
            minLatitude: minLat,
            maxLatitude: maxLat,
            minLongitude: minLon,
            maxLongitude: maxLon
        )
    }

    /// 中心坐标
    public var center: CLLocationCoordinate2D {
        CLLocationCoordinate2D(
            latitude: (bounds.minLatitude + bounds.maxLatitude) / 2,
            longitude: (bounds.minLongitude + bounds.maxLongitude) / 2
        )
    }

    /// 比较运算符 (用于排序)
    public static func < (lhs: TileCoordinate, rhs: TileCoordinate) -> Bool {
        if lhs.z != rhs.z { return lhs.z < rhs.z }
        if lhs.y != rhs.y { return lhs.y < rhs.y }
        return lhs.x < rhs.x
    }

    /// 从经纬度和缩放级别计算瓦片坐标
    /// - Parameters:
    ///   - coordinate: 地理坐标
    ///   - zoom: 缩放级别
    /// - Returns: 瓦片坐标
    public static func from(coordinate: CLLocationCoordinate2D, zoom: Int) -> TileCoordinate {
        let n = pow(2.0, Double(zoom))
        let x = Int((coordinate.longitude + 180.0) / 360.0 * n)
        let latRad = coordinate.latitude * .pi / 180.0
        let y = Int((1 - log(tan(latRad) + 1 / cos(latRad)) / .pi) / 2 * n)
        return TileCoordinate(x: x, y: y, z: zoom)
    }

    /// 从瓦片路径参数转换
    /// - Parameters:
    ///   - x: X坐标
    ///   - y: Y坐标
    ///   - z: 缩放级别
    /// - Returns: TileCoordinate
    public static func from(x: Int, y: Int, z: Int) -> TileCoordinate {
        TileCoordinate(x: x, y: y, z: z)
    }
}

// MARK: - Tile Extensions

extension TileCoordinate {
    /// 检查两个瓦片是否相邻
    /// - Parameter other: 另一个瓦片
    /// - Returns: 是否相邻
    public func isAdjacent(to other: TileCoordinate) -> Bool {
        guard z == other.z else { return false }
        let dx = abs(x - other.x)
        let dy = abs(y - other.y)
        return (dx == 1 && dy == 0) || (dx == 0 && dy == 1) || (dx == 1 && dy == 1)
    }

    /// 计算到另一个瓦片的距离 (单位: 瓦片数)
    /// - Parameter other: 另一个瓦片
    /// - Returns: 曼哈顿距离
    public func distance(to other: TileCoordinate) -> Int {
        guard z == other.z else { return Int.max }
        return abs(x - other.x) + abs(y - other.y)
    }
}

// MARK: - CustomStringConvertible

extension TileCoordinate: CustomStringConvertible {
    public var description: String {
        "Tile(x: \(x), y: \(y), z: \(z))"
    }
}

// MARK: - Collection Extensions

extension Array where Element == TileCoordinate {
    /// 获取指定缩放级别的所有瓦片
    /// - Parameter zoom: 缩放级别
    /// - Returns: 该缩放级别的瓦片数组
    func filter(zoom: Int) -> [TileCoordinate] {
        filter { $0.z == zoom }
    }

    /// 获取指定边界范围内的所有瓦片
    /// - Parameter bounds: 边界范围
    /// - Returns: 边界内的瓦片数组
    func filter(in bounds: TileBounds) -> [TileCoordinate] {
        filter { tile in
            let tileBounds = tile.bounds
            return tileBounds.intersects(bounds)
        }
    }

    /// 按缩放级别分组
    /// - Returns: 按缩放级别分组的字典
    func groupedByZoom() -> [Int: [TileCoordinate]] {
        Dictionary(grouping: self) { $0.z }
    }
}
