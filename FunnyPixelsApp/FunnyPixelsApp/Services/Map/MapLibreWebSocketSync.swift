import Foundation
#if canImport(MapLibre)
import MapLibre
#endif
import Combine
#if canImport(SwiftUI)
import SwiftUI
#endif

// MARK: - MapLibre WebSocket Sync (仅 iOS)

#if canImport(MapLibre)

/// WebSocket 事件类型
public enum MapLibreWebSocketEvent: Equatable, Hashable {
    case pixelCreated(Pixel)
    case pixelUpdated(Pixel)
    case pixelDeleted(String)
    case batchUpdate([Pixel])
    case regionUpdate(String, [Pixel])
    case error(String)

    public static func == (lhs: MapLibreWebSocketEvent, rhs: MapLibreWebSocketEvent) -> Bool {
        switch (lhs, rhs) {
        case (.pixelCreated(let l), .pixelCreated(let r)):
            return l.id == r.id
        case (.pixelUpdated(let l), .pixelUpdated(let r)):
            return l.id == r.id
        case (.pixelDeleted(let l), .pixelDeleted(let r)):
            return l == r
        case (.batchUpdate(let l), .batchUpdate(let r)):
            return l.map(\.id) == r.map(\.id)
        case (.regionUpdate(let l1, let l2), .regionUpdate(let r1, let r2)):
            return l1 == r1 && l2.map(\.id) == r2.map(\.id)
        case (.error(let l), .error(let r)):
            return l == r
        default:
            return false
        }
    }

    public func hash(into hasher: inout Hasher) {
        switch self {
        case .pixelCreated(let pixel):
            hasher.combine("created")
            hasher.combine(pixel.id)
        case .pixelUpdated(let pixel):
            hasher.combine("updated")
            hasher.combine(pixel.id)
        case .pixelDeleted(let id):
            hasher.combine("deleted")
            hasher.combine(id)
        case .batchUpdate(let pixels):
            hasher.combine("batch")
            hasher.combine(pixels.map(\.id))
        case .regionUpdate(let id, let pixels):
            hasher.combine("region")
            hasher.combine(id)
            hasher.combine(pixels.map(\.id))
        case .error(let msg):
            hasher.combine("error")
            hasher.combine(msg)
        }
    }
}

/// MapLibre WebSocket 同步管理器
/// 处理通过 WebSocket 接收的像素更新并同步到地图
@MainActor
public class MapLibreWebSocketSync: NSObject, ObservableObject {
    // MARK: - Properties

    /// 单例
    public static let shared = MapLibreWebSocketSync()

    /// 地图视图（弱引用）
    private weak var mapView: MLNMapView?

    /// 像素数据源
    private weak var pixelSource: MLNShapeSource?

    /// WebSocket 管理器 (Switch to SocketIOManager)
    private let socketManager: SocketIOManager

    /// 连接状态
    @Published public var syncState: SyncState = .disconnected

    /// 同步状态枚举
    public enum SyncState: Equatable {
        case disconnected
        case connecting
        case connected
        case syncing
        case error(String)

        public static func == (lhs: SyncState, rhs: SyncState) -> Bool {
            switch (lhs, rhs) {
            case (.disconnected, .disconnected),
                 (.connecting, .connecting),
                 (.connected, .connected),
                 (.syncing, .syncing):
                return true
            case (.error(let lhsMsg), .error(let rhsMsg)):
                return lhsMsg == rhsMsg
            default:
                return false
            }
        }
    }

    /// 订阅的区域
    private var subscribedRegions: [TileBounds] = []

    // MARK: - Initialization

    private override init() {
        self.socketManager = SocketIOManager.shared
        super.init()

        setupWebSocketHandlers()
    }

    // MARK: - Public Methods

    /// 设置地图视图
    public func setupMapView(_ mapView: MLNMapView, pixelSource: MLNShapeSource) {
        self.mapView = mapView
        self.pixelSource = pixelSource

        Logger.info("MapLibre WebSocket Sync: Map view configured")
    }

    /// 连接到 WebSocket
    public func connect() {
        syncState = .connecting
        // SocketIOManager handles connection globally via AuthManager usually.
        // If we need to force connect:
        if let user = AuthManager.shared.currentUser {
           Task {
               await socketManager.connect(userId: user.id, username: user.username)
           }
        }
        Logger.info("Connecting to WebSocket for pixel sync (via SocketIOManager)")
    }

    /// 断开 WebSocket 连接
    public func disconnect() {
        // SocketIOManager is global, maybe we shouldn't disconnect it just for this service?
        // But for parity:
        Task {
            await socketManager.disconnect()
        }
        syncState = .disconnected
        Logger.info("Disconnected from WebSocket")
    }

    /// 订阅区域更新
    public func subscribeToRegion(_ bounds: TileBounds) {
        subscribedRegions.append(bounds)
        // SocketIOManager currently supports tile-based subscription.
        // Region subscription logic needs backend support via Socket.IO events.
        // For now, we log it.
        Logger.info("Subscribed to region: \(bounds) (Logic pending SocketIO implementation)")
    }

    /// 取消订阅区域
    public func unsubscribeFromRegion(_ bounds: TileBounds) {
        subscribedRegions.removeAll { $0 == bounds }
        Logger.info("Unsubscribed from region: \(bounds)")
    }

    /// 订阅当前可见区域
    public func subscribeToVisibleRegion() {
        guard let mapView = mapView else { return }

        let bounds = mapView.visibleCoordinateBounds

        let tileBounds = TileBounds(
            minLatitude: bounds.sw.latitude,
            maxLatitude: bounds.ne.latitude,
            minLongitude: bounds.sw.longitude,
            maxLongitude: bounds.ne.longitude
        )

        subscribeToRegion(tileBounds)
    }

    // MARK: - Private Methods

    private func setupWebSocketHandlers() {
        // 监听连接状态变化
        // 注意：这里简化了实现，实际需要更完整的 WebSocket 处理
    }

    // MARK: - Pixel Update Handlers

    /// 处理单个像素更新
    public func handlePixelUpdate(_ pixel: Pixel) {
        guard pixelSource != nil else { return }

        // Check for new emoji that's not in the common pool
        if let emoji = pixel.emoji, !emoji.isEmpty {
            checkAndNotifyNewEmoji(emoji)
        }

        Logger.debug("Updated pixel: \(pixel.id)")
    }

    /// Check if emoji is new and notify if needed
    private func checkAndNotifyNewEmoji(_ emoji: String) {
        if !SpriteConfig.isCommonEmoji(emoji) {
            Logger.info("🆕 New emoji discovered via WebSocket: \(emoji)")
            NotificationCenter.default.post(
                name: .newEmojiDiscovered,
                object: nil,
                userInfo: ["emoji": emoji]
            )
        }
    }

    /// 处理像素删除
    public func handlePixelDelete(pixelId: String) {
        guard pixelSource != nil else { return }

        // 简化实现：暂时只记录日志
        Logger.debug("Deleted pixel: \(pixelId)")
    }

    /// 处理批量像素更新
    public func handleBatchPixelUpdate(_ pixels: [Pixel]) {
        guard pixelSource != nil else { return }

        syncState = .syncing

        // 简化实现
        Logger.info("Batch updated \(pixels.count) pixels")

        syncState = .connected
    }
}

// MARK: - MapLibre WebSocket Event Handler

/// MapLibre WebSocket 事件处理器
public class MapLibreWebSocketEventHandler {
    // MARK: - Properties

    /// 同步管理器
    private weak var syncManager: MapLibreWebSocketSync?

    /// 事件回调
    private var eventCallbacks: [String: (Any) -> Void] = [:]

    // MARK: - Initialization

    public init(syncManager: MapLibreWebSocketSync) {
        self.syncManager = syncManager
    }

    // MARK: - Public Methods

    /// 注册事件回调
    public func on(_ event: MapLibreWebSocketEvent, callback: @escaping (Any) -> Void) {
        let key = eventKey(for: event)
        eventCallbacks[key] = callback
    }

    /// 处理接收到的消息
    public func handleMessage(_ message: String) {
        guard let data = message.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let type = json["type"] as? String else {
            return
        }

        switch type {
        case "pixel_created":
            handlePixelCreated(json)

        case "pixel_updated":
            handlePixelUpdated(json)

        case "pixel_deleted":
            handlePixelDeleted(json)

        case "batch_update":
            handleBatchUpdate(json)

        case "region_update":
            handleRegionUpdate(json)

        default:
            Logger.warning("Unknown WebSocket event type: \(type)")
        }
    }

    // MARK: - Private Methods

    private func eventKey(for event: MapLibreWebSocketEvent) -> String {
        switch event {
        case .pixelCreated:
            return "pixelCreated"
        case .pixelUpdated:
            return "pixelUpdated"
        case .pixelDeleted:
            return "pixelDeleted"
        case .batchUpdate:
            return "batchUpdate"
        case .regionUpdate:
            return "regionUpdate"
        case .error(let msg):
            return "error_\(msg)"
        }
    }

    private func handlePixelCreated(_ json: [String: Any]) {
        guard let data = json["data"] as? [String: Any],
              let pixel = parsePixel(from: data) else {
            return
        }

        Task { @MainActor in
            syncManager?.handlePixelUpdate(pixel)
        }
        eventCallbacks["pixelCreated"]?(pixel)

        Logger.debug("Pixel created via WebSocket: \(pixel.id)")
    }

    private func handlePixelUpdated(_ json: [String: Any]) {
        guard let data = json["data"] as? [String: Any],
              let pixel = parsePixel(from: data) else {
            return
        }

        Task { @MainActor in
            syncManager?.handlePixelUpdate(pixel)
        }
        eventCallbacks["pixelUpdated"]?(pixel)

        Logger.debug("Pixel updated via WebSocket: \(pixel.id)")
    }

    private func handlePixelDeleted(_ json: [String: Any]) {
        guard let data = json["data"] as? [String: Any],
              let pixelId = data["id"] as? String else {
            return
        }

        Task { @MainActor in
            syncManager?.handlePixelDelete(pixelId: pixelId)
        }
        eventCallbacks["pixelDeleted"]?(pixelId)

        Logger.debug("Pixel deleted via WebSocket: \(pixelId)")
    }

    private func handleBatchUpdate(_ json: [String: Any]) {
        guard let data = json["data"] as? [String: Any],
              let pixelsArray = data["pixels"] as? [[String: Any]] else {
            return
        }

        let pixels = pixelsArray.compactMap { parsePixel(from: $0) }

        Task { @MainActor in
            syncManager?.handleBatchPixelUpdate(pixels)
        }
        eventCallbacks["batchUpdate"]?(pixels)

        Logger.debug("Batch update via WebSocket: \(pixels.count) pixels")
    }

    private func handleRegionUpdate(_ json: [String: Any]) {
        guard let data = json["data"] as? [String: Any],
              let regionId = data["region_id"] as? String,
              let pixelsArray = data["pixels"] as? [[String: Any]] else {
            return
        }

        let pixels = pixelsArray.compactMap { parsePixel(from: $0) }

        Task { @MainActor in
            syncManager?.handleBatchPixelUpdate(pixels)
        }
        eventCallbacks["regionUpdate"]?((regionId, pixels))

        Logger.debug("Region \(regionId) updated: \(pixels.count) pixels")
    }

    private func parsePixel(from data: [String: Any]) -> Pixel? {
        guard let id = data["id"] as? String,
              let latitude = data["latitude"] as? Double,
              let longitude = data["longitude"] as? Double,
              let color = data["color"] as? String,
              let authorId = data["author_id"] as? String else {
            return nil
        }

        let createdAt = data["created_at"] as? String ?? ISO8601DateFormatter().string(from: Date())

        return Pixel(
            id: id,
            latitude: latitude,
            longitude: longitude,
            color: color,
            authorId: authorId,
            patternId: data["pattern_id"] as? String,
            materialId: data["material_id"] as? String,
            createdAt: parseDate(from: createdAt)
        )
    }

    private func parseDate(from string: String) -> Date {
        let formatter = ISO8601DateFormatter()
        return formatter.date(from: string) ?? Date()
    }
}

// MARK: - MapLibre Realtime Layer Manager

/// 实时图层管理器
/// 管理 MapLibre 地图与 WebSocket 的集成
@MainActor
public class MapLibreRealtimeLayerManager: ObservableObject {
    // MARK: - Properties

    /// 同步管理器
    private let syncManager: MapLibreWebSocketSync

    /// 事件处理器
    private let eventHandler: MapLibreWebSocketEventHandler

    /// 地图视图
    private weak var mapView: MLNMapView?

    /// 像素源
    private weak var pixelSource: MLNShapeSource?

    /// 是否启用实时更新
    @Published public var isRealtimeEnabled: Bool = false

    // MARK: - Initialization

    public init() {
        self.syncManager = .shared
        self.eventHandler = MapLibreWebSocketEventHandler(syncManager: syncManager)
    }

    // MARK: - Public Methods

    /// 设置地图视图
    public func setupMapView(_ mapView: MLNMapView, pixelSource: MLNShapeSource) {
        self.mapView = mapView
        self.pixelSource = pixelSource

        syncManager.setupMapView(mapView, pixelSource: pixelSource)

        // 设置事件回调
        setupEventCallbacks()
    }

    /// 启用实时更新
    public func enableRealtime() {
        syncManager.connect()
        isRealtimeEnabled = true
        Logger.info("Realtime pixel updates enabled")
    }

    /// 禁用实时更新
    public func disableRealtime() {
        syncManager.disconnect()
        isRealtimeEnabled = false
        Logger.info("Realtime pixel updates disabled")
    }

    /// 切换实时更新状态
    public func toggleRealtime() {
        if isRealtimeEnabled {
            disableRealtime()
        } else {
            enableRealtime()
        }
    }

    /// 订阅当前可见区域
    public func subscribeToCurrentRegion() {
        syncManager.subscribeToVisibleRegion()
    }

    /// 获取同步状态
    public var syncState: MapLibreWebSocketSync.SyncState {
        return syncManager.syncState
    }
}

// MARK: - Private Methods

extension MapLibreRealtimeLayerManager {
    private func setupEventCallbacks() {
        eventHandler.on(.pixelCreated(Pixel.dummy)) { pixel in
            Logger.debug("Pixel created event")
        }

        eventHandler.on(.pixelUpdated(Pixel.dummy)) { pixel in
            Logger.debug("Pixel updated event")
        }

        eventHandler.on(.pixelDeleted("")) { pixelId in
            Logger.debug("Pixel deleted: \(pixelId)")
        }
    }
}

// Pixel extension for dummy instance
extension Pixel {
    static var dummy: Pixel {
        Pixel(
            id: "",
            latitude: 0,
            longitude: 0,
            color: "#4ECDC4",
            authorId: ""
        )
    }
}

// MARK: - WebSocket Connection Status Indicator

#if canImport(SwiftUI)

/// WebSocket 连接状态指示器视图
public struct WebSocketConnectionStatusView: View {
    @ObservedObject var syncManager: MapLibreWebSocketSync

    public init(syncManager: MapLibreWebSocketSync) {
        self.syncManager = syncManager
    }

    public var body: some View {
        HStack(spacing: 6) {
            Circle()
                .fill(statusColor)
                .frame(width: 8, height: 8)

            Text(statusText)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 6)
        .background(.ultraThinMaterial)
        .clipShape(Capsule())
    }

    private var statusColor: Color {
        switch syncManager.syncState {
        case .connected:
            return .green
        case .connecting, .syncing:
            return .orange
        case .disconnected:
            return .gray
        case .error:
            return .red
        }
    }

    private var statusText: String {
        switch syncManager.syncState {
        case .connected:
            return "实时同步"
        case .connecting:
            return "连接中..."
        case .syncing:
            return "同步中..."
        case .disconnected:
            return "未连接"
        case .error:
            return "连接错误"
        }
    }
}

#endif

#endif // canImport(MapLibre)
