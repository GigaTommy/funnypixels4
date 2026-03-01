import Foundation
import CoreLocation

/// 地图上的漂流瓶标记
struct BottleMapMarker: Identifiable, Equatable, Hashable {
    let id: String  // bottle_id
    let coordinate: CLLocationCoordinate2D
    let distance: Double  // 距离（米）

    init(bottleId: String, lat: Double, lng: Double, distance: Double) {
        self.id = bottleId
        self.coordinate = CLLocationCoordinate2D(latitude: lat, longitude: lng)
        self.distance = distance
    }

    // MARK: - Equatable

    static func == (lhs: BottleMapMarker, rhs: BottleMapMarker) -> Bool {
        lhs.id == rhs.id
    }

    // MARK: - Hashable

    func hash(into hasher: inout Hasher) {
        hasher.combine(id)
    }

    // MARK: - Helpers

    /// 格式化距离显示
    var distanceText: String {
        if distance < 1000 {
            return String(format: "%.0fm", distance)
        } else {
            return String(format: "%.1fkm", distance / 1000)
        }
    }

    /// 是否在拾取范围内（100米）
    var isInPickupRange: Bool {
        distance <= 100
    }
}
