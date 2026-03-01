import Foundation
import CoreLocation
import Combine
#if canImport(MapLibre)
import MapLibre
#endif

/// 位置管理器：负责 GPS 定位和位置更新
@MainActor
class LocationManager: NSObject, ObservableObject {
    // MARK: - Singleton

    static let shared = LocationManager()

    // MARK: - Properties

    private let locationManager = CLLocationManager()
    private var updateHandlers: [(CLLocation) -> Void] = []
    private var locationCancellable: AnyCancellable? // Store cancellable properly

    @Published var currentLocation: CLLocation?

    @Published var authorizationStatus: CLAuthorizationStatus = .notDetermined

    /// 当前设备朝向（度数，0=北，90=东，180=南，270=西）
    @Published var currentHeading: Double = 0

    /// 是否处于高精度后台模式
    @Published private(set) var isHighPrecisionMode = false

    /// 上一个位置（用于计算移动方向）
    private var previousLocation: CLLocation?

    /// iOS 17+ 后台活动会话（保障后台定位持续性）
    private var backgroundActivitySession: AnyObject? // Type-erased to avoid @available on stored property

    /// 保存原始GPS参数（用于专注模式优化后恢复）
    var originalDistanceFilter: CLLocationDistance?
    var originalDesiredAccuracy: CLLocationAccuracy?

    // MARK: - Persistence Keys
    private let kCachedLat = "cached_last_location_lat"
    private let kCachedLng = "cached_last_location_lng"

    // MARK: - Initialization

    private override init() {
        super.init()
        setupLocationManager()
    }

    // MARK: - Setup

    private func setupLocationManager() {
        locationManager.delegate = self
        locationManager.activityType = .fitness

        // ✅ 移除：不在初始化时启动heading更新
        // heading更新将在需要时（GPS绘制模式）手动启动

        // 默认使用标准模式（省电）
        enableStandardMode()
    }
    
    // MARK: - Power Optimization

    /// 启用高精度模式（用于 GPS 绘制）
    /// - Warning: 需要在 Xcode "Signing & Capabilities -> Background Modes" 中勾选 "Location updates"，否则导致 Crash
    func enableHighPrecisionMode() {
        locationManager.desiredAccuracy = kCLLocationAccuracyBest
        locationManager.distanceFilter = 5 // 高频更新
        locationManager.allowsBackgroundLocationUpdates = true // 允许后台运行
        locationManager.pausesLocationUpdatesAutomatically = false // 禁止自动暂停
        locationManager.activityType = .fitness // 步行/跑步场景优化，减少约15-20%电耗
        locationManager.showsBackgroundLocationIndicator = true // iOS 16.4+ 必须为 true，否则后台定位可能失效
        isHighPrecisionMode = true

        // iOS 17+：创建后台活动会话，保障后台定位持续性
        // 即使 App 被系统终止也可重新唤醒
        if #available(iOS 17.0, *) {
            if backgroundActivitySession == nil {
                backgroundActivitySession = CLBackgroundActivitySession()
                Logger.info("🔒 CLBackgroundActivitySession 已创建")
            }
        }

        Logger.info("🚀 启用高精度 GPS 模式 (后台运行 + 最佳精度 + 蓝色状态栏)")
    }

    /// 优化GPS参数（专注模式 - 降低频率和精度以省电）
    func optimizeForFocusMode() {
        // 保存当前参数
        if originalDistanceFilter == nil {
            originalDistanceFilter = locationManager.distanceFilter
            originalDesiredAccuracy = locationManager.desiredAccuracy
        }

        // 降低定位频率和精度
        locationManager.distanceFilter = 10.0  // 5m → 10m
        locationManager.desiredAccuracy = kCLLocationAccuracyNearestTenMeters  // best → 10m

        Logger.info("🎯 GPS optimized for focus mode: filter=10m, accuracy=10m")
    }

    /// 恢复GPS正常参数
    func restoreFromFocusMode() {
        guard let originalFilter = originalDistanceFilter,
              let originalAccuracy = originalDesiredAccuracy else {
            return
        }

        locationManager.distanceFilter = originalFilter
        locationManager.desiredAccuracy = originalAccuracy

        // 清除保存的值
        originalDistanceFilter = nil
        originalDesiredAccuracy = nil

        Logger.info("🎯 GPS restored from focus mode")
    }

    /// 启用标准模式（用于普通浏览）
    /// - Note: 降低精度以省电，关闭后台更新
    func enableStandardMode() {
        locationManager.desiredAccuracy = kCLLocationAccuracyNearestTenMeters
        locationManager.distanceFilter = 10 // 低频更新
        locationManager.allowsBackgroundLocationUpdates = false // 禁止后台运行
        locationManager.pausesLocationUpdatesAutomatically = true // 允许自动暂停
        locationManager.showsBackgroundLocationIndicator = false
        isHighPrecisionMode = false

        // 释放后台活动会话
        if #available(iOS 17.0, *) {
            if let session = backgroundActivitySession as? CLBackgroundActivitySession {
                session.invalidate()
                backgroundActivitySession = nil
                Logger.info("🔓 CLBackgroundActivitySession 已释放")
            }
        }

        Logger.info("🍃 启用标准 GPS 模式 (省电模式)")
    }

    /// 切换后台距离过滤（后台时增大 distanceFilter 减少回调频率以省电）
    func setBackgroundDistanceFilter(_ isBackground: Bool) {
        guard isHighPrecisionMode else { return }
        locationManager.distanceFilter = isBackground ? 8 : 5
        Logger.info(isBackground ? "📍 后台模式：距离过滤增至 8m" : "📍 前台模式：距离过滤恢复 5m")
    }

    // MARK: - Public Methods

    /// 请求位置权限
    func requestAuthorization() {
        #if os(iOS)
        locationManager.requestWhenInUseAuthorization()
        #endif
    }

    /// 开始更新位置
    func startUpdating() {
        locationManager.startUpdatingLocation()
        Logger.info("开始更新 GPS 位置")
    }

    /// 停止更新位置
    func stopUpdating() {
        locationManager.stopUpdatingLocation()
        Logger.info("停止更新 GPS 位置")
    }

    /// 开始更新设备朝向（仅在需要时调用，如GPS绘制）
    func startHeadingUpdates() {
        guard CLLocationManager.headingAvailable() else {
            Logger.warning("🧭 Heading not available on this device")
            return
        }
        locationManager.startUpdatingHeading()
        Logger.info("🧭 Started heading updates")
    }

    /// 停止更新设备朝向
    func stopHeadingUpdates() {
        locationManager.stopUpdatingHeading()
        Logger.info("🧭 Stopped heading updates")
    }

    /// 请求一次性位置
    func requestLocation() {
        locationManager.requestLocation()
    }

    /// 定位到当前位置（用于地图工具栏的定位按钮）
    /// 获取当前位置并通知地图控制器居中显示
    func centerToCurrentLocation() {
        guard isAuthorized else {
            Logger.warning("未授权位置权限，无法定位")
            // 请求权限
            requestAuthorization()
            return
        }

        Logger.info("📍 centerToCurrentLocation 被调用，当前坐标: \(currentCoordinate?.latitude.description ?? "nil")")

        // 确保正在更新位置
        startUpdating()

        if let coordinate = currentCoordinate {
            // 已有位置信息，直接居中
            Logger.info("📍 使用现有位置居中")
            MapController.shared.centerOnCurrentLocation(coordinate: coordinate)
        } else {
            // 没有位置信息，请求一次性位置
            // 🔧 修复：使用 Combine 监听位置更新，并在获取到有效位置后居中
            Logger.info("📍 当前无位置，开始请求一次性定位...")

            // 监听位置更新，获取第一个有效位置（非 nil）
            locationCancellable = $currentLocation
                .filter { $0 != nil }  // 过滤 nil
                .compactMap { $0 }  // 解包 Optional
                .timeout(.seconds(10), scheduler: DispatchQueue.main)  // 10秒超时
                .first()
                .sink { completion in
                    switch completion {
                    case .finished:
                        Logger.info("📍 定位完成")
                    case .failure(let error):
                        Logger.error("📍 定位超时或失败: \(error)")
                    }
                } receiveValue: { (location: CLLocation) in
                    let coordinate = CLLocationCoordinate2D(
                        latitude: location.coordinate.latitude,
                        longitude: location.coordinate.longitude
                    )
                    MapController.shared.centerOnCurrentLocation(coordinate: coordinate)
                    Logger.info("📍 定位到当前位置: \(coordinate.latitude), \(coordinate.longitude)")
                }
        }
    }

    /// 注册位置更新回调
    func onUpdate(handler: @escaping (CLLocation) -> Void) {
        updateHandlers.append(handler)
    }

    /// 移除所有回调
    func removeAllHandlers() {
        updateHandlers.removeAll()
    }

    // MARK: - Computed Properties

    /// 是否已授权
    var isAuthorized: Bool {
        authorizationStatus == .authorizedWhenInUse || authorizationStatus == .authorizedAlways
    }

    /// 当前坐标（如果有的话）
    var currentCoordinate: CLLocationCoordinate2D? {
        guard let location = currentLocation else { return nil }
        #if canImport(MapLibre)
        return CLLocationCoordinate2D(
            latitude: location.coordinate.latitude,
            longitude: location.coordinate.longitude
        )
        #else
        return nil
        #endif
    }
    /// 缓存的最后已知位置
    var cachedCoordinate: CLLocationCoordinate2D? {
        let lat = UserDefaults.standard.double(forKey: kCachedLat)
        let lng = UserDefaults.standard.double(forKey: kCachedLng)
        
        // 检查是否有有效值 (0,0 在北京附近不太可能，且 UserDefaults 默认 0)
        // 更严谨的检查：UserDefaults 如果没有值返回 0，所以我们需要区分
        guard UserDefaults.standard.object(forKey: kCachedLat) != nil else { return nil }
        
        return CLLocationCoordinate2D(latitude: lat, longitude: lng)
    }
}

// MARK: - CLLocationManagerDelegate

extension LocationManager: CLLocationManagerDelegate {
    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let location = locations.last else { return }

        // 如果设备不支持heading，则基于位置变化计算移动方向
        if !CLLocationManager.headingAvailable(), let previous = previousLocation {
            let bearing = calculateBearing(from: previous.coordinate, to: location.coordinate)
            currentHeading = bearing
        }

        previousLocation = currentLocation
        currentLocation = location

        Logger.debug("📍 GPS 更新: \(location.coordinate.latitude), \(location.coordinate.longitude)")
        Logger.debug("🎯 精度: \(location.horizontalAccuracy)m")

        // 通知所有观察者
        for handler in updateHandlers {
            handler(location)
        }

        // 更新缓存
        UserDefaults.standard.set(location.coordinate.latitude, forKey: kCachedLat)
        UserDefaults.standard.set(location.coordinate.longitude, forKey: kCachedLng)
    }

    func locationManager(_ manager: CLLocationManager, didUpdateHeading newHeading: CLHeading) {
        // 使用magneticHeading（磁北）或trueHeading（真北）
        // trueHeading在某些情况下可能为负值，表示不可用
        if newHeading.trueHeading >= 0 {
            currentHeading = newHeading.trueHeading
        } else {
            currentHeading = newHeading.magneticHeading
        }

        Logger.debug("🧭 Heading 更新: \(String(format: "%.1f", currentHeading))°")
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        if let clError = error as? CLError {
            switch clError.code {
            case .locationUnknown:
                // Code 0: This is partial/transient, usually not a fatal error
                Logger.warning("⚠️ GPS位置暂时不可用 (Code 0), 等待更新...")
                return
            case .denied:
                Logger.error("❌ 位置权限被拒绝")
            default:
                Logger.error("❌ 位置错误: \(clError.localizedDescription)")
            }
        } else {
            Logger.error("❌ GPS 定位失败: \(error.localizedDescription)")
        }
    }

    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        authorizationStatus = manager.authorizationStatus

        switch authorizationStatus {
        case .authorizedWhenInUse, .authorizedAlways:
            Logger.info("✅ 位置权限已授权")
            startUpdating()

        case .denied, .restricted:
            Logger.error("❌ 位置权限被拒绝或受限")
            stopUpdating()
            NotificationCenter.default.post(name: Notification.Name("LocationPermissionDenied"), object: nil)

        case .notDetermined:
            Logger.info("⚠️ 位置权限未确定，等待用户授权")

        @unknown default:
            Logger.warning("⚠️ 未知的授权状态")
        }
    }

    // MARK: - Helper Methods

    /// 计算两个坐标之间的方位角（度数）
    private func calculateBearing(from: CLLocationCoordinate2D, to: CLLocationCoordinate2D) -> Double {
        let lat1 = from.latitude * .pi / 180
        let lon1 = from.longitude * .pi / 180
        let lat2 = to.latitude * .pi / 180
        let lon2 = to.longitude * .pi / 180

        let dLon = lon2 - lon1
        let y = sin(dLon) * cos(lat2)
        let x = cos(lat1) * sin(lat2) - sin(lat1) * cos(lat2) * cos(dLon)
        let bearing = atan2(y, x) * 180 / .pi

        return (bearing + 360).truncatingRemainder(dividingBy: 360)
    }
}
