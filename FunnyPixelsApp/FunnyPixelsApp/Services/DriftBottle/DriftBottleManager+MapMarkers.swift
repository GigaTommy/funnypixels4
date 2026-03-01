import Foundation
import CoreLocation

/// DriftBottleManager的地图标记扩展
extension DriftBottleManager {
    // MARK: - Map Markers

    /// 刷新地图上的漂流瓶标记
    /// - Parameters:
    ///   - lat: 当前纬度
    ///   - lng: 当前经度
    ///   - radius: 搜索半径（米），默认2000米
    func refreshMapMarkers(lat: Double, lng: Double, radius: Double = 2000) async {
        guard !isLoadingMarkers else {
            Logger.debug("Already loading markers, skipping")
            return
        }

        isLoadingMarkers = true
        defer { isLoadingMarkers = false }

        do {
            // 调用API获取附近的瓶子
            let bottles = try await api.getMapBottles(lat: lat, lng: lng, radius: radius)

            Logger.info("🗺️ Fetched \(bottles.count) bottles from API")

            // 转换为地图标记
            let markers = bottles.map { bottle in
                let distance = calculateDistance(
                    from: CLLocationCoordinate2D(latitude: lat, longitude: lng),
                    to: CLLocationCoordinate2D(latitude: bottle.lat, longitude: bottle.lng)
                )

                return BottleMapMarker(
                    bottleId: bottle.bottleId,
                    lat: bottle.lat,
                    lng: bottle.lng,
                    distance: distance
                )
            }

            // 更新UI（在主线程）
            await MainActor.run {
                self.mapMarkers = markers
                Logger.info("🗺️ Map markers updated: \(markers.count) bottles")

                // 如果有范围内的瓶子，播放提示音
                let inRangeCount = markers.filter { $0.isInPickupRange }.count
                if inRangeCount > 0 {
                    Logger.info("🎯 \(inRangeCount) bottles in pickup range")
                    SoundManager.shared.play(.bottleEncounter)
                }
            }

        } catch {
            Logger.error("Failed to refresh map markers: \(error.localizedDescription)")
            await MainActor.run {
                self.mapMarkers = []
            }
        }
    }

    /// 启动地图标记自动刷新
    /// - Parameters:
    ///   - lat: 当前纬度
    ///   - lng: 当前经度
    ///   - interval: 刷新间隔（秒），默认30秒
    func startMapMarkersAutoRefresh(lat: Double, lng: Double, interval: TimeInterval = 30) {
        stopMapMarkersAutoRefresh()

        // 存储最新坐标，定时器每次刷新时使用最新值
        latestRefreshLat = lat
        latestRefreshLng = lng

        Logger.info("🗺️ Starting map markers auto-refresh (interval: \(interval)s) at (\(lat), \(lng))")

        // 立即刷新一次
        Task {
            await refreshMapMarkers(lat: lat, lng: lng)
        }

        // 启动定时器，每次使用最新存储的坐标
        markersRefreshTimer = Timer.scheduledTimer(withTimeInterval: interval, repeats: true) { [weak self] _ in
            Task { @MainActor [weak self] in
                guard let self = self else { return }
                await self.refreshMapMarkers(lat: self.latestRefreshLat, lng: self.latestRefreshLng)
            }
        }
    }

    /// 更新最新坐标（供外部位置变化时调用）
    func updateRefreshCoordinates(lat: Double, lng: Double) {
        latestRefreshLat = lat
        latestRefreshLng = lng
    }

    /// 停止地图标记自动刷新
    func stopMapMarkersAutoRefresh() {
        markersRefreshTimer?.invalidate()
        markersRefreshTimer = nil

        Logger.info("🗺️ Map markers auto-refresh stopped")

        // 清空标记
        mapMarkers = []
    }

    /// 处理地图标记点击
    /// - Parameter bottleId: 瓶子ID
    func handleMarkerTap(bottleId: String) async {
        Logger.info("🗺️ Map marker tapped: \(bottleId)")

        do {
            // 获取瓶子详情
            let bottle = try await api.getBottleDetails(bottleId: bottleId)

            await MainActor.run {
                // 设置为当前遭遇
                self.currentEncounter = bottle

                // 显示遭遇横幅
                self.showEncounterBanner = true

                // 自动隐藏横幅（10秒后）
                self.scheduleEncounterBannerDismiss()

                Logger.info("🗺️ Encounter banner shown for bottle: \(bottleId)")
            }

        } catch {
            Logger.error("Failed to get bottle details: \(error.localizedDescription)")
        }
    }

    // MARK: - Helpers

    /// 计算两点之间的距离（米）
    private func calculateDistance(from: CLLocationCoordinate2D, to: CLLocationCoordinate2D) -> Double {
        let fromLocation = CLLocation(latitude: from.latitude, longitude: from.longitude)
        let toLocation = CLLocation(latitude: to.latitude, longitude: to.longitude)
        return fromLocation.distance(from: toLocation)
    }

    /// 定时隐藏遭遇横幅
    private func scheduleEncounterBannerDismiss() {
        // 取消之前的定时器
        bannerDismissTimer?.invalidate()

        // 10秒后自动隐藏
        bannerDismissTimer = Timer.scheduledTimer(withTimeInterval: 10, repeats: false) { [weak self] _ in
            Task { @MainActor [weak self] in
                self?.showEncounterBanner = false
            }
        }
    }
}

// MARK: - Published Properties Extension

/// 在DriftBottleManager主文件中添加这些属性：
///
/// ```swift
/// @Published var mapMarkers: [BottleMapMarker] = []
/// @Published var isLoadingMarkers = false
/// private var markersRefreshTimer: Timer?
/// ```
