import Foundation

// MARK: - Pixel Column Model

/// 单个像素柱体数据
struct PixelColumn: Codable, Identifiable, Sendable {
    let lat: Double
    let lng: Double
    let height: Double      // Visual height for rendering
    let rawHeight: Int      // Original layer count
    let color: String       // Hex color "#RRGGBB"
    let allianceId: String?
    let gridId: String?

    // Computed property for Identifiable
    var id: String {
        gridId ?? "\(lat),\(lng)"
    }

    enum CodingKeys: String, CodingKey {
        case lat, lng, height, color
        case rawHeight
        case allianceId
        case gridId
    }
}

// MARK: - API Response Models

/// 3D 地图数据 API 响应
struct Pixel3DResponse: Codable, Sendable {
    let success: Bool
    let data: Pixel3DData
    let message: String?
}

/// 3D 数据容器
struct Pixel3DData: Codable, Sendable {
    let pixels: [PixelColumn]
    let lodLevel: String
    let zoom: Int
    let bounds: ResponseBounds
    let count: Int

    enum CodingKeys: String, CodingKey {
        case pixels, bounds, count, zoom
        case lodLevel
    }
}

/// API 响应边界信息 (避免与 PixelTile.TileBounds 冲突)
struct ResponseBounds: Codable, Sendable {
    let minLat: Double
    let maxLat: Double
    let minLng: Double
    let maxLng: Double
}

// MARK: - Tile Management

/// 瓦片索引键（用于缓存和去重）
struct TileKey: Hashable, Sendable {
    let x: Int
    let y: Int

    /// 转换为地理边界
    /// - Parameter tileSize: 瓦片大小（经纬度单位）
    /// - Returns: 视口边界
    func toBounds(tileSize: Double) -> ViewportBounds {
        let minLng = Double(x) * tileSize
        let maxLng = Double(x + 1) * tileSize
        let minLat = Double(y) * tileSize
        let maxLat = Double(y + 1) * tileSize

        return ViewportBounds(
            minLat: minLat,
            maxLat: maxLat,
            minLng: minLng,
            maxLng: maxLng
        )
    }
}

/// 视口边界（用于计算可见瓦片）
struct ViewportBounds: Sendable, Codable {
    let minLat: Double
    let maxLat: Double
    let minLng: Double
    let maxLng: Double

    /// 计算需要加载的瓦片
    /// - Parameter tileSize: 瓦片大小
    /// - Returns: 瓦片键集合
    func tilesInBounds(tileSize: Double) -> Set<TileKey> {
        var tiles = Set<TileKey>()

        let startX = Int(floor(minLng / tileSize))
        let endX = Int(floor(maxLng / tileSize))
        let startY = Int(floor(minLat / tileSize))
        let endY = Int(floor(maxLat / tileSize))

        for x in startX...endX {
            for y in startY...endY {
                tiles.insert(TileKey(x: x, y: y))
            }
        }

        return tiles
    }
}

// MARK: - Array Extension

extension Array {
    /// 将数组分块
    /// - Parameter size: 块大小
    /// - Returns: 分块后的二维数组
    func chunked(into size: Int) -> [[Element]] {
        guard size > 0 else { return [] }
        return stride(from: 0, to: count, by: size).map {
            Array(self[$0..<Swift.min($0 + size, count)])
        }
    }
}

// MARK: - Geometry Detail Level

/// 几何体细节级别（LOD）
enum GeometryDetail: String, Sendable {
    case low = "low"       // 低质量：8 段圆柱
    case medium = "medium" // 中等质量：16 段圆柱
    case high = "high"     // 高质量：32 段圆柱

    var segmentCount: Int {
        switch self {
        case .low: return 8
        case .medium: return 16
        case .high: return 32
        }
    }
}

// MARK: - Memory Metrics

/// 内存使用指标
struct MemoryMetrics: Sendable {
    let usedMB: Double
    let totalMB: Double
    let availableMB: Double

    var usagePercent: Double {
        guard totalMB > 0 else { return 0 }
        return (usedMB / totalMB) * 100
    }

    var isWarning: Bool {
        usagePercent > 75
    }

    var isCritical: Bool {
        usagePercent > 90
    }
}
