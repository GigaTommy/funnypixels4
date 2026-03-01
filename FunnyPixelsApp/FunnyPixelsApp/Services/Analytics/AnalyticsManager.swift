import Foundation
import Combine
import CoreLocation

/// 用户行为埋点管理器
public class AnalyticsManager: ObservableObject {
    public static let shared = AnalyticsManager()

    private var eventQueue: [AnalyticsEvent] = []
    private let maxQueueSize = 100
    private let batchUploadInterval: TimeInterval = 30.0

    @Published public var isEnabled: Bool = true

    private init() {}

    // MARK: - 事件追踪

    /// 追踪事件
    public func track(_ eventName: String, properties: [String: Any]? = nil) {
        guard isEnabled else { return }

        let event = AnalyticsEvent(
            name: eventName,
            properties: properties ?? [:],
            timestamp: Date(),
            userId: getCurrentUserId()
        )

        eventQueue.append(event)

        // 达到批量上传大小或队列满时上传
        if eventQueue.count >= 20 {
            Task { await self.uploadEvents() }
        }
    }

    /// 追踪像素绘制
    public func trackPixelDraw(latitude: Double, longitude: Double, color: String) {
        track("pixel_draw", properties: [
            "lat": latitude,
            "lng": longitude,
            "color": color,
            "method": "tap"
        ])
    }

    /// 追踪GPS路径绘制
    public func trackGPSPathDraw(pixelCount: Int, distance: Double) {
        track("gps_path_draw", properties: [
            "pixel_count": pixelCount,
            "distance_meters": distance
        ])
    }

    /// 追踪地图浏览
    public func trackMapView(zoomLevel: Int, center: CLLocationCoordinate2D) {
        track("map_view", properties: [
            "zoom": zoomLevel,
            "center_lat": center.latitude,
            "center_lng": center.longitude
        ])
    }

    /// 追踪登录
    public func trackLogin(method: String = "email") {
        track("login", properties: ["method": method])
    }

    /// 追踪登出
    public func trackLogout() {
        track("logout")
    }

    /// 追踪错误
    public func trackError(_ error: any Error, context: String) {
        track("error", properties: [
            "context": context,
            "error_message": error.localizedDescription,
            "error_type": String(describing: type(of: error))
        ])
    }

    // MARK: - 批量上传

    /// 上传事件队列
    public func uploadEvents() async {
        guard !eventQueue.isEmpty else { return }

        let events = eventQueue
        eventQueue.removeAll()

        // TODO: 调用分析API上传事件
        Logger.info("📊 Uploaded \(events.count) analytics events")
    }

    /// 清空事件队列
    public func clearQueue() {
        eventQueue.removeAll()
    }

    // MARK: - 辅助方法

    private func getCurrentUserId() -> String? {
        // 从KeychainManager获取当前用户ID，避免并发问题
        return try? KeychainManager.shared.loadUserId()
    }
}

/// 分析事件模型
public struct AnalyticsEvent: Codable {
    public let name: String
    public let properties: [String: Any]
    public let timestamp: Date
    public let userId: String?

    public init(name: String, properties: [String: Any], timestamp: Date, userId: String?) {
        self.name = name
        self.properties = properties
        self.timestamp = timestamp
        self.userId = userId
    }

    // MARK: - Codable

    enum CodingKeys: String, CodingKey {
        case name
        case properties
        case timestamp
        case userId = "user_id"
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        name = try container.decode(String.self, forKey: .name)
        timestamp = try container.decode(Date.self, forKey: .timestamp)
        userId = try container.decodeIfPresent(String.self, forKey: .userId)

        // 解码properties
        if let dict = try? container.decode([String: String].self, forKey: .properties) {
            properties = dict
        } else if let dict = try? container.decode([String: Double].self, forKey: .properties) {
            properties = dict
        } else {
            properties = [:]
        }
    }

    public func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(name, forKey: .name)
        try container.encode(timestamp, forKey: .timestamp)
        try container.encodeIfPresent(userId, forKey: .userId)

        // 简化properties编码
        if let dict = properties as? [String: String] {
            try container.encode(dict, forKey: .properties)
        }
    }
}
