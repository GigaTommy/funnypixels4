import Foundation
import MapKit

// MARK: - RenderingMode

/// 渲染模式枚举
public enum RenderingMode: Equatable {
    /// 聚合模式（网格聚合）
    /// - Parameter gridSize: 网格大小（度）
    case clustered(gridSize: Double)

    /// 简化模式（降采样渲染）
    case simplified

    /// 完整模式（渲染所有像素）
    case full

    /// 获取人类可读的描述
    public var description: String {
        switch self {
        case .clustered(let gridSize):
            return "Clustered (grid: \(gridSize)°)"
        case .simplified:
            return "Simplified"
        case .full:
            return "Full Detail"
        }
    }

    /// 是否需要聚合
    public var requiresClustering: Bool {
        if case .clustered = self {
            return true
        }
        return false
    }

    /// 是否需要简化
    public var requiresSimplification: Bool {
        return self == .simplified
    }

    /// 获取聚合网格大小
    public var clusterGridSize: Double? {
        if case .clustered(let gridSize) = self {
            return gridSize
        }
        return nil
    }
}

// MARK: - PixelLODStrategy

/// 像素LOD（Level of Detail）渲染策略
public struct PixelLODStrategy {

    // MARK: - Constants

    /// 缩放级别阈值
    private enum ZoomThreshold {
        /// 聚合模式阈值（低缩放级别）
        static let clustered: Int = 12

        /// 简化模式阈值（中等缩放级别）
        static let simplified: Int = 15

        /// 完整模式阈值（高缩放级别）
        static let full: Int = 16
    }

    /// 聚合网格大小配置（根据缩放级别）
    private static let clusterGridSizes: [Int: Double] = [
        0: 10.0,
        1: 5.0,
        2: 2.5,
        3: 1.25,
        4: 0.625,
        5: 0.3125,
        6: 0.15625,
        7: 0.078125,
        8: 0.0390625,
        9: 0.01953125,
        10: 0.009765625,
        11: 0.0048828125,
        12: 0.00244140625
    ]

    // MARK: - Public Methods

    /// 根据缩放级别获取渲染模式
    /// - Parameter zoomLevel: 缩放级别（0-20）
    /// - Returns: 渲染模式
    public static func renderingMode(for zoomLevel: Int) -> RenderingMode {
        switch zoomLevel {
        case ...ZoomThreshold.clustered:
            // 低缩放级别：使用聚合模式
            let gridSize = clusterGridSizes[zoomLevel] ?? 1.0
            return .clustered(gridSize: gridSize)

        case ZoomThreshold.clustered..<ZoomThreshold.simplified:
            // 中等缩放级别：使用简化模式
            return .simplified

        case ZoomThreshold.simplified...:
            // 高缩放级别：使用完整模式
            return .full

        default:
            return .simplified
        }
    }

    /// 从地图区域计算缩放级别
    /// - Parameter region: 地图区域
    /// - Returns: 缩放级别（0-20）
    public static func zoomLevel(from region: MKCoordinateRegion) -> Int {
        // 使用纬度跨度计算缩放级别
        let latitudeDelta = region.span.latitudeDelta

        // 缩放级别计算公式
        // zoom = log2(360 / latitudeDelta)
        let zoom = log2(360.0 / latitudeDelta)

        // 限制在0-20之间
        return max(0, min(20, Int(round(zoom))))
    }

    /// 从地图区域直接获取渲染模式
    /// - Parameter region: 地图区域
    /// - Returns: 渲染模式
    public static func renderingMode(from region: MKCoordinateRegion) -> RenderingMode {
        let zoom = zoomLevel(from: region)
        return renderingMode(for: zoom)
    }

    /// 判断是否应该渲染像素（根据LOD策略）
    /// - Parameters:
    ///   - pixel: 像素
    ///   - mode: 渲染模式
    ///   - visibleRect: 可见区域
    /// - Returns: 是否应该渲染
    public static func shouldRender(pixel: Pixel, mode: RenderingMode, in visibleRect: MKMapRect) -> Bool {
        // 检查像素是否在可见区域内
        let pixelPoint = MKMapPoint(pixel.coordinate)
        guard visibleRect.contains(pixelPoint) else {
            return false
        }

        // 根据渲染模式决定是否渲染
        switch mode {
        case .clustered:
            // 聚合模式：只渲染聚合中心点
            return false // 聚合模式下单个像素不直接渲染

        case .simplified:
            // 简化模式：可以添加降采样逻辑
            // 例如：只渲染部分像素（每N个像素渲染一个）
            return pixel.id.hashValue % 2 == 0

        case .full:
            // 完整模式：渲染所有像素
            return true
        }
    }

    /// 计算像素聚合
    /// - Parameters:
    ///   - pixels: 像素数组
    ///   - gridSize: 网格大小（度）
    /// - Returns: 聚合后的像素集群
    public static func clusterPixels(_ pixels: [Pixel], gridSize: Double) -> [PixelCluster] {
        var clusters: [String: PixelCluster] = [:]

        for pixel in pixels {
            // 计算像素所属的网格
            let gridX = Int(floor(pixel.latitude / gridSize))
            let gridY = Int(floor(pixel.longitude / gridSize))
            let gridKey = "\(gridX)_\(gridY)"

            // 添加到对应的聚合中
            if var cluster = clusters[gridKey] {
                cluster.addPixel(pixel)
                clusters[gridKey] = cluster
            } else {
                let center = CLLocationCoordinate2D(
                    latitude: Double(gridX) * gridSize + gridSize / 2,
                    longitude: Double(gridY) * gridSize + gridSize / 2
                )
                let cluster = PixelCluster(
                    id: gridKey,
                    center: center,
                    pixels: [pixel],
                    gridSize: gridSize
                )
                clusters[gridKey] = cluster
            }
        }

        return Array(clusters.values)
    }

    /// 获取推荐的最大渲染像素数
    /// - Parameter zoomLevel: 缩放级别
    /// - Returns: 最大渲染像素数
    public static func maxRenderablePixels(for zoomLevel: Int) -> Int {
        switch zoomLevel {
        case ...10:
            return 1000  // 低缩放级别：限制1000个
        case 11...15:
            return 5000  // 中等缩放级别：限制5000个
        case 16...:
            return 20000 // 高缩放级别：限制20000个
        default:
            return 5000
        }
    }

    /// 计算像素密度
    /// - Parameters:
    ///   - pixelCount: 像素数量
    ///   - area: 区域面积（平方度）
    /// - Returns: 像素密度（像素/平方度）
    public static func pixelDensity(pixelCount: Int, area: Double) -> Double {
        guard area > 0 else { return 0 }
        return Double(pixelCount) / area
    }
}

// MARK: - PixelCluster

/// 像素聚合集群
public struct PixelCluster: Identifiable {
    public let id: String
    public let center: CLLocationCoordinate2D
    public private(set) var pixels: [Pixel]
    public let gridSize: Double

    /// 聚合中的像素数量
    public var count: Int {
        pixels.count
    }

    /// 主要颜色（出现最多的颜色）
    public var dominantColor: String {
        // 统计颜色频率
        var colorCounts: [String: Int] = [:]
        for pixel in pixels {
            colorCounts[pixel.color, default: 0] += 1
        }

        // 找出出现最多的颜色
        return colorCounts.max(by: { $0.value < $1.value })?.key ?? "#FFFFFF"
    }

    /// 颜色分布
    public var colorDistribution: [String: Int] {
        var distribution: [String: Int] = [:]
        for pixel in pixels {
            distribution[pixel.color, default: 0] += 1
        }
        return distribution
    }

    /// 添加像素到聚合
    /// - Parameter pixel: 要添加的像素
    mutating func addPixel(_ pixel: Pixel) {
        pixels.append(pixel)
    }

    /// 获取聚合的边界
    public var bounds: TileBounds {
        let halfGrid = gridSize / 2
        return TileBounds(
            minLatitude: center.latitude - halfGrid,
            maxLatitude: center.latitude + halfGrid,
            minLongitude: center.longitude - halfGrid,
            maxLongitude: center.longitude + halfGrid
        )
    }
}

// MARK: - Extensions

extension PixelCluster: Equatable {
    public static func == (lhs: PixelCluster, rhs: PixelCluster) -> Bool {
        lhs.id == rhs.id
    }
}

extension PixelCluster: Hashable {
    public func hash(into hasher: inout Hasher) {
        hasher.combine(id)
    }
}

// MARK: - Rendering Helpers

extension PixelLODStrategy {
    /// 根据设备性能调整渲染模式
    /// - Parameters:
    ///   - mode: 基础渲染模式
    ///   - devicePerformance: 设备性能等级（0.0-1.0）
    /// - Returns: 调整后的渲染模式
    public static func adjustedMode(_ mode: RenderingMode, for devicePerformance: Double) -> RenderingMode {
        guard devicePerformance < 0.7 else {
            return mode // 高性能设备不调整
        }

        switch mode {
        case .full:
            // 低性能设备：降级到简化模式
            return .simplified

        case .simplified:
            // 低性能设备：降级到聚合模式
            return .clustered(gridSize: 0.01)

        case .clustered:
            // 已经是最低级别
            return mode
        }
    }

    /// 估算渲染性能
    /// - Parameters:
    ///   - pixelCount: 像素数量
    ///   - mode: 渲染模式
    /// - Returns: 预估的渲染时间（毫秒）
    public static func estimatedRenderTime(pixelCount: Int, mode: RenderingMode) -> Double {
        let baseTimePerPixel: Double

        switch mode {
        case .clustered:
            baseTimePerPixel = 0.01 // 聚合模式很快
        case .simplified:
            baseTimePerPixel = 0.05 // 简化模式中等
        case .full:
            baseTimePerPixel = 0.1  // 完整模式较慢
        }

        return Double(pixelCount) * baseTimePerPixel
    }
}
