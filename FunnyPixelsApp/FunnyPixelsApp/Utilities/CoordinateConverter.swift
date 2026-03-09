import Foundation
import CoreLocation
import SceneKit

/// 3D 像素城市坐标转换器
///
/// 将 GPS 坐标（纬度/经度）转换为 SceneKit 3D 空间坐标
/// 使用平面墨卡托投影，适用于城市尺度（< 100km 范围）
///
/// 坐标系统：
/// - SceneKit: X=东西, Y=高度, Z=南北（右手坐标系，Y 轴向上）
/// - 单位：1 unit = 10 meters
/// - 原点：地图中心（referencePoint）
struct CoordinateConverter {

    // MARK: - Properties

    /// 参考点（地图中心），所有坐标相对于此点计算
    let referencePoint: CLLocationCoordinate2D

    /// 参考点的纬度弧度值（预计算以提高性能）
    private let referenceLatRad: Double

    // MARK: - Constants

    /// 地球每度纬度对应的米数（约 111km）
    private static let metersPerDegreeLat: Double = 111_319.9

    /// SceneKit 单位换算：1 unit = 10 meters
    private static let unitsPerMeter: Double = 0.1

    // MARK: - Initialization

    /// 初始化坐标转换器
    /// - Parameter referencePoint: 参考点（通常为地图中心）
    init(referencePoint: CLLocationCoordinate2D) {
        self.referencePoint = referencePoint
        self.referenceLatRad = referencePoint.latitude * .pi / 180.0
    }

    // MARK: - Coordinate Conversion

    /// 将 GPS 坐标转换为 SceneKit 3D 坐标
    ///
    /// 使用简化的墨卡托投影：
    /// - X（东西）= ΔLng × cos(refLat) × metersPerDegree / 10
    /// - Y（高度）= height（由后端计算的可视高度）
    /// - Z（南北）= ΔLat × metersPerDegree / 10
    ///
    /// - Parameters:
    ///   - latitude: 目标纬度
    ///   - longitude: 目标经度
    ///   - height: 高度值（已经过后端对数缩放）
    /// - Returns: SceneKit 坐标（单位：1 unit = 10m）
    func gpsToScene(latitude: Double, longitude: Double, height: Double) -> SCNVector3 {
        // 计算相对于参考点的偏移（度）
        let deltaLat = latitude - referencePoint.latitude
        let deltaLng = longitude - referencePoint.longitude

        // 计算每度经度的米数（需要根据纬度校正）
        let metersPerDegreeLng = Self.metersPerDegreeLat * cos(referenceLatRad)

        // 转换为米，然后转换为 SceneKit 单位
        let xMeters = deltaLng * metersPerDegreeLng
        let zMeters = deltaLat * Self.metersPerDegreeLat

        let x = Float(xMeters * Self.unitsPerMeter)
        let y = Float(height)
        let z = Float(zMeters * Self.unitsPerMeter)

        return SCNVector3(x, y, z)
    }

    /// 批量转换 GPS 坐标（性能优化版本）
    ///
    /// - Parameters:
    ///   - coordinates: GPS 坐标数组 [(lat, lng, height)]
    /// - Returns: SceneKit 坐标数组
    func batchGpsToScene(_ coordinates: [(latitude: Double, longitude: Double, height: Double)]) -> [SCNVector3] {
        let metersPerDegreeLng = Self.metersPerDegreeLat * cos(referenceLatRad)

        return coordinates.map { coord in
            let deltaLat = coord.latitude - referencePoint.latitude
            let deltaLng = coord.longitude - referencePoint.longitude

            let x = Float(deltaLng * metersPerDegreeLng * Self.unitsPerMeter)
            let y = Float(coord.height)
            let z = Float(deltaLat * Self.metersPerDegreeLat * Self.unitsPerMeter)

            return SCNVector3(x, y, z)
        }
    }

    /// 计算两个 GPS 点之间的距离（米）
    ///
    /// 使用 Haversine 公式计算球面距离
    ///
    /// - Parameters:
    ///   - from: 起点坐标
    ///   - to: 终点坐标
    /// - Returns: 距离（米）
    static func distance(from: CLLocationCoordinate2D, to: CLLocationCoordinate2D) -> Double {
        let location1 = CLLocation(latitude: from.latitude, longitude: from.longitude)
        let location2 = CLLocation(latitude: to.latitude, longitude: to.longitude)
        return location1.distance(from: location2)
    }

    /// 检查是否需要更新参考点
    ///
    /// 当地图中心移动超过阈值时，应该重新创建 CoordinateConverter
    ///
    /// - Parameter newCenter: 新的地图中心
    /// - Returns: 是否需要更新（距离 > 5km）
    func needsUpdate(for newCenter: CLLocationCoordinate2D) -> Bool {
        let distance = Self.distance(from: referencePoint, to: newCenter)
        return distance > 5000  // 超过 5km 需要更新
    }

    /// 计算视口边界（用于瓦片加载）
    ///
    /// - Parameters:
    ///   - center: 中心点
    ///   - radiusMeters: 半径（米）
    /// - Returns: 边界坐标
    static func viewportBounds(center: CLLocationCoordinate2D, radiusMeters: Double) -> (minLat: Double, maxLat: Double, minLng: Double, maxLng: Double) {
        // 1 度纬度 ≈ 111km
        let latDelta = radiusMeters / metersPerDegreeLat

        // 1 度经度 = 111km × cos(lat)
        let lngDelta = radiusMeters / (metersPerDegreeLat * cos(center.latitude * .pi / 180.0))

        return (
            minLat: center.latitude - latDelta,
            maxLat: center.latitude + latDelta,
            minLng: center.longitude - lngDelta,
            maxLng: center.longitude + lngDelta
        )
    }
}

// MARK: - Extensions

extension CoordinateConverter {
    /// 调试信息
    var debugDescription: String {
        """
        CoordinateConverter(
            referencePoint: (\(referencePoint.latitude), \(referencePoint.longitude)),
            metersPerDegreeLng: \(Self.metersPerDegreeLat * cos(referenceLatRad))
        )
        """
    }
}
