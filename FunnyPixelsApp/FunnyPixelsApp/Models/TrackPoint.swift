import Foundation
import CoreLocation

/// GPS 轨迹点
struct TrackPoint: Codable, Identifiable {
    let id: UUID
    let lat: Double
    let lng: Double
    let timestamp: TimeInterval

    init(lat: Double, lng: Double, timestamp: TimeInterval) {
        self.id = UUID()
        self.lat = lat
        self.lng = lng
        self.timestamp = timestamp
    }

    /// 转换为 CLLocation
    var location: CLLocation {
        return CLLocation(
            coordinate: CLLocationCoordinate2D(latitude: lat, longitude: lng),
            altitude: 0,
            horizontalAccuracy: 0,
            verticalAccuracy: 0,
            timestamp: Date(timeIntervalSince1970: timestamp)
        )
    }

    /// 计算与另一个轨迹点的距离（单位：米）
    func distance(to point: TrackPoint) -> Double {
        let loc1 = CLLocation(latitude: lat, longitude: lng)
        let loc2 = CLLocation(latitude: point.lat, longitude: point.lng)
        return loc1.distance(from: loc2)
    }

    /// 计算与另一个轨迹点的时间差（单位：秒）
    func timeInterval(to point: TrackPoint) -> TimeInterval {
        return point.timestamp - timestamp
    }
}
