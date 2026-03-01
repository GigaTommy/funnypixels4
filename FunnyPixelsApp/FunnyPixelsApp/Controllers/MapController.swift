import Foundation
#if canImport(MapLibre)
import MapLibre
#endif
import SwiftUI
import CoreLocation

/// 地图控制器
/// 负责管理地图的各种控制操作（缩放、定位、漫游等）
@MainActor
class MapController {
    static let shared = MapController()

    #if canImport(MapLibre)
    private weak var mapView: MLNMapView?
    #endif

    /// 漫游状态
    private var isRoaming = false

    // MARK: - Viewport Cache (survives tab switches)
    private(set) var cachedCenter: CLLocationCoordinate2D?
    private(set) var cachedZoomLevel: Double?

    func cacheViewport(center: CLLocationCoordinate2D, zoomLevel: Double) {
        self.cachedCenter = center
        self.cachedZoomLevel = zoomLevel
    }

    // MARK: - GPS跟随状态
    /// GPS跟随模式状态
    private var isFollowingGPS = false
    /// 上次位置（用于计算速度和方向）
    private var lastLocation: CLLocation?
    /// 上次更新缩放级别的时间
    private var lastZoomUpdateTime: Date?
    /// 最小缩放级别调整间隔（秒）
    private let minZoomUpdateInterval: TimeInterval = 3.0
    /// GPS 跟随暂停结束时间（用户手动拖动地图时临时暂停）
    private var followingPauseUntil: Date?
    /// GPS 跟随暂停持续时间（秒）
    private let followingPauseDuration: TimeInterval = 10.0

    private init() {
        // 监听地图拖动事件
        NotificationCenter.default.addObserver(
            forName: .mapTrackingStateChanged,
            object: nil,
            queue: .main
        ) { [weak self] notification in
            if let isPanned = notification.object as? Bool, isPanned {
                Task { @MainActor [weak self] in
                    self?.pauseGPSFollowingTemporarily()
                }
            }
        }
    }

    #if canImport(MapLibre)
    /// 设置地图引用
    /// 设置地图引用
    func setMapView(_ mapView: MLNMapView) {
        self.mapView = mapView
        // Share with GPS service for preview and snapshot
        GPSDrawingService.shared.setMapView(mapView)
    }

    /// 放大地图
    func zoomIn() {
        guard let mapView = mapView else { return }
        let currentZoom = mapView.zoomLevel
        let newZoom = min(currentZoom + 1, mapView.maximumZoomLevel)
        mapView.setZoomLevel(newZoom, animated: true)
        Logger.info("🔍 Zoom in: \(currentZoom) -> \(newZoom)")
    }

    /// 缩小地图
    func zoomOut() {
        guard let mapView = mapView else { return }
        let currentZoom = mapView.zoomLevel
        let newZoom = max(currentZoom - 1, mapView.minimumZoomLevel)
        mapView.setZoomLevel(newZoom, animated: true)
        Logger.info("🔍 Zoom out: \(currentZoom) -> \(newZoom)")
    }

    /// 定位到当前位置
    func centerOnCurrentLocation(coordinate: CLLocationCoordinate2D?) {
        guard let coordinate = coordinate else {
            Logger.info("正在获取当前位置...")
            return
        }

        if let mapView = mapView {
            mapView.setCenter(coordinate, zoomLevel: 15, animated: true)
            Logger.info("📍 定位到当前位置: \(coordinate.latitude), \(coordinate.longitude)")
        } else {
            Logger.error("❌ 定位失败: MapView 未设置")
        }
    }

    /// 更新地图中心到指定坐标（保持当前缩放级别）
    /// 用于GPS绘制模式下的自动跟随
    func updateCenter(to coordinate: CLLocationCoordinate2D) {
        if let mapView = mapView {
            mapView.setCenter(coordinate, animated: true)
            Logger.debug("📍 地图中心已更新: \(coordinate.latitude), \(coordinate.longitude)")
        }
    }

    /// Fly to a specific coordinate with a destination name
    func flyToCoordinate(_ coordinate: CLLocationCoordinate2D, name: String) async {
        guard !isRoaming else { return }
        guard let mapView = mapView else { return }
        guard CLLocationCoordinate2DIsValid(coordinate) else { return }

        isRoaming = true
        defer { isRoaming = false }

        if let renderer = GPSDrawingService.shared.getHighPerformanceRenderer() {
            renderer.prefetchTilesAround(coordinate: coordinate)
        }

        NotificationCenter.default.post(name: NSNotification.Name("roamingStarted"), object: name)
        mapView.setCenter(coordinate, zoomLevel: 14.0, animated: true)
        Logger.info("✈️ 飞往: \(name) (\(coordinate.latitude), \(coordinate.longitude))")
    }

    /// 检查是否正在漫游
    var isRoamingActive: Bool {
        isRoaming
    }

    // MARK: - GPS跟随模式（导航风格）

    /// 开始GPS跟随模式（参考导航应用体验）
    func startGPSFollowing() {
        isFollowingGPS = true
        Logger.info("🎯 GPS跟随模式已启动")
    }

    /// 停止GPS跟随模式
    func stopGPSFollowing() {
        isFollowingGPS = false
        lastLocation = nil
        lastZoomUpdateTime = nil
        followingPauseUntil = nil
        Logger.info("🎯 GPS跟随模式已停止")
    }

    /// 临时暂停GPS跟随（用户手动拖动地图时）
    func pauseGPSFollowingTemporarily() {
        guard isFollowingGPS else { return }
        followingPauseUntil = Date().addingTimeInterval(followingPauseDuration)
        Logger.info("⏸️ GPS跟随暂停 \(Int(followingPauseDuration)) 秒（用户手动拖动）")
    }

    /// 恢复GPS跟随（用户点击定位按钮时）
    func resumeGPSFollowing() {
        followingPauseUntil = nil
        Logger.info("▶️ GPS跟随已恢复")
    }

    /// 检查GPS跟随是否被暂停
    var isGPSFollowingPaused: Bool {
        guard let pauseUntil = followingPauseUntil else { return false }
        return Date() < pauseUntil
    }

    /// 导航风格的GPS位置更新
    /// 根据速度动态调整缩放级别，提供类似导航的体验
    /// - 低速（<3km/h）：zoom 17-18，详细路网
    /// - 中速（3-10km/h）：zoom 16，平衡视野
    /// - 高速（>10km/h）：zoom 15-15，更广视野
    func updateForGPSFollowing(location: CLLocation) {
        guard let mapView = mapView, isFollowingGPS else { return }

        // 如果用户手动拖动地图，暂时不跟随（允许用户查看周围区域）
        if isGPSFollowingPaused {
            // 仍然更新 lastLocation 以便恢复后计算正确的速度
            lastLocation = location
            return
        }

        let coordinate = location.coordinate

        // 计算速度
        var speed = 0.0 // m/s

        if let last = lastLocation {
            let timeDiff = location.timestamp.timeIntervalSince(last.timestamp)
            if timeDiff > 0 {
                // 计算速度（米/秒）
                speed = last.distance(from: location) / timeDiff
            }
        }

        // 根据速度确定目标缩放级别
        let speedKmH = speed * 3.6 // 转换为 km/h

        // 根据速度确定目标缩放级别
        // 优化：提高阈值防止GPS漂移导致画面跳变
        // 普通步行/跑步 (0-15km/h) 保持最大缩放，方便绘制
        // 骑行/低速驾驶 (15-30km/h) 稍微缩小
        var targetZoom: Double
        if speedKmH < 15 {
            // 步行范围：最大缩放
            targetZoom = 18.0
        } else if speedKmH < 40 {
            // 骑行/低速驾驶：标准视图
            targetZoom = 16.0
        } else {
            // 高速：广角视野
            targetZoom = 15.0
        }

        // 限制缩放范围
        targetZoom = max(mapView.minimumZoomLevel, min(targetZoom, mapView.maximumZoomLevel))

        // 检查是否需要更新缩放级别（避免频繁调整）
        let shouldUpdateZoom: Bool
        if let lastUpdate = lastZoomUpdateTime {
            let timeSinceLastUpdate = Date().timeIntervalSince(lastUpdate)
            shouldUpdateZoom = timeSinceLastUpdate >= minZoomUpdateInterval
        } else {
            shouldUpdateZoom = true
        }

        // 平滑过渡到目标状态
        if shouldUpdateZoom {
            // 需要更新缩放级别时，同时更新中心和缩放
            mapView.setCenter(coordinate, zoomLevel: targetZoom, animated: true)
            lastZoomUpdateTime = Date()
            Logger.debug("🎯 GPS跟随: 速度=\(String(format: "%.1f", speedKmH))km/h, zoom=\(String(format: "%.1f", targetZoom))")
        } else {
            // 仅更新中心位置，保持当前缩放级别
            mapView.setCenter(coordinate, animated: true)
        }

        lastLocation = location
    }

    /// 简单的GPS跟随（不改变缩放，只更新中心）
    func followGPS(location: CLLocation) {
        guard let mapView = mapView, isFollowingGPS else { return }
        mapView.setCenter(location.coordinate, animated: true)
    }

    /// 检查是否在GPS跟随模式
    var isGPSFollowingActive: Bool {
        isFollowingGPS
    }

    /// 获取地图中心坐标
    func getCenterCoordinate() -> CLLocationCoordinate2D? {
        return mapView?.centerCoordinate
    }

    /// 将地理坐标转换为屏幕坐标
    /// - Parameter coordinate: 地理坐标
    /// - Returns: 屏幕坐标
    func coordinateToScreen(_ coordinate: CLLocationCoordinate2D) -> CGPoint {
        guard let mapView = mapView else {
            Logger.warning("MapView not available for coordinate conversion")
            return .zero
        }
        return mapView.convert(coordinate, toPointTo: mapView)
    }
    #else
    /// 放大地图 (回退实现)
    func zoomIn() {
        Logger.info("🔍 Zoom in (not implemented on this platform)")
    }

    /// 缩小地图 (回退实现)
    func zoomOut() {
        Logger.info("🔍 Zoom out (not implemented on this platform)")
    }

    /// 定位到当前位置 (回退实现)
    func centerOnCurrentLocation(coordinate: CLLocationCoordinate2D?) {
        Logger.info("📍 Center on location (not implemented on this platform)")
    }

    /// 检查是否正在漫游
    var isRoamingActive: Bool {
        isRoaming
    }

    /// 获取地图中心坐标 (回退实现)
    func getCenterCoordinate() -> CLLocationCoordinate2D? {
        return nil
    }
    #endif
}
