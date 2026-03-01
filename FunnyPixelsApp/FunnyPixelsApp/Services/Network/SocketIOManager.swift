import Foundation
import SocketIO
import Combine

// MARK: - Socket.IO Connection State

/// Socket.IO 连接状态
public enum SocketIOState: Equatable, Sendable {
    case disconnected
    case connecting
    case connected
    case reconnecting(Int)
    case error(String)

    public nonisolated static func == (lhs: SocketIOState, rhs: SocketIOState) -> Bool {
        switch (lhs, rhs) {
        case (.disconnected, .disconnected),
             (.connecting, .connecting),
             (.connected, .connected):
            return true
        case (.reconnecting(let l), .reconnecting(let r)):
            return l == r
        case (.error(let l), .error(let r)):
            return l == r
        default:
            return false
        }
    }
}

// MARK: - Socket.IO Manager

/// Socket.IO 管理器 - 与后端Socket.IO实现完全匹配
public actor SocketIOManager {
    // MARK: - Singleton

    public static let shared = SocketIOManager()

    // MARK: - Properties

    /// Socket.IO 客户端
    private var socket: SocketIOClient?

    /// Socket.IO 管理器
    private var manager: SocketManager?

    /// 连接状态
    private let stateSubject = CurrentValueSubject<SocketIOState, Never>(.disconnected)

    /// 像素变化发布者
    private let pixelChangesSubject = PassthroughSubject<[Pixel], Never>()

    /// 瓦片数据发布者
    private let tileDataSubject = PassthroughSubject<TileData, Never>()

    /// 🔄 瓦片失效发布者 (当像素更新需要刷新MVT瓦片时触发)
    private let tileInvalidateSubject = PassthroughSubject<(gridId: String, tileIds: [String], reason: String), Never>()

    /// ⚔️ 赛事战况发布者
    private let battleUpdateSubject = PassthroughSubject<[String: Any], Never>()
    
    /// 📅 活动列表更新发布者 (当后台活动列表变更时触发)
    private let eventsUpdatedSubject = PassthroughSubject<Void, Never>()
    
    /// 🏴 联盟信息更新发布者 (当联盟信息变更时触发)
    private let allianceUpdatedSubject = PassthroughSubject<[String: Any], Never>()

    /// 🛡️ 领土动态发布者 (当用户像素被覆盖时触发)
    private let territoryBattleSubject = PassthroughSubject<TerritoryBattleEvent, Never>()

    /// 🍾 漂流瓶遭遇发布者
    private let bottleNearbySubject = PassthroughSubject<DriftBottle, Never>()

    /// 🌊 漂流瓶沉没发布者
    private let bottleSunkSubject = PassthroughSubject<JourneyCardDetail, Never>()

    /// 🔔 新通知发布者
    private let newNotificationSubject = PassthroughSubject<NotificationService.SystemMessage, Never>()

    /// 连接状态发布者

    /// 连接状态发布者
    public var statePublisher: AnyPublisher<SocketIOState, Never> {
        stateSubject.eraseToAnyPublisher()
    }

    /// 像素变化发布者
    public var pixelChangesPublisher: AnyPublisher<[Pixel], Never> {
        pixelChangesSubject.eraseToAnyPublisher()
    }

    /// 瓦片数据发布者
    public var tileDataPublisher: AnyPublisher<TileData, Never> {
        tileDataSubject.eraseToAnyPublisher()
    }

    /// 瓦片失效发布者
    public var tileInvalidatePublisher: AnyPublisher<(gridId: String, tileIds: [String], reason: String), Never> {
        tileInvalidateSubject.eraseToAnyPublisher()
    }

    /// ⚔️ 赛事战况发布者
    public var battleUpdatePublisher: AnyPublisher<[String: Any], Never> {
        battleUpdateSubject.eraseToAnyPublisher()
    }
    
    public var eventsUpdatedPublisher: AnyPublisher<Void, Never> {
        eventsUpdatedSubject.eraseToAnyPublisher()
    }
    
    /// 🏴 联盟信息更新发布者
    public var allianceUpdatedPublisher: AnyPublisher<[String: Any], Never> {
        allianceUpdatedSubject.eraseToAnyPublisher()
    }

    /// 🛡️ 领土动态发布者
    public var territoryBattlePublisher: AnyPublisher<TerritoryBattleEvent, Never> {
        territoryBattleSubject.eraseToAnyPublisher()
    }

    /// 漂流瓶遭遇发布者
    var bottleNearbyPublisher: AnyPublisher<DriftBottle, Never> {
        bottleNearbySubject.eraseToAnyPublisher()
    }

    /// 漂流瓶沉没发布者
    var bottleSunkPublisher: AnyPublisher<JourneyCardDetail, Never> {
        bottleSunkSubject.eraseToAnyPublisher()
    }

    /// 🔔 新通知发布者
    public var newNotificationPublisher: AnyPublisher<NotificationService.SystemMessage, Never> {
        newNotificationSubject.eraseToAnyPublisher()
    }

    // MARK: - Initialization

    /// 当前连接状态
    public var state: SocketIOState {
        stateSubject.value
    }

    /// 是否已连接
    public var isConnected: Bool {
        stateSubject.value == .connected
    }

    /// 已订阅的瓦片房间
    private var subscribedTiles: Set<String> = []

    /// 待订阅的瓦片（连接成功后自动订阅）
    private var pendingSubscriptions: Set<String> = []

    /// 当前用户信息
    private var currentUser: (userId: String, username: String)?

    /// 当前加入的赛事房间 ID
    private var currentEventId: String?

    // MARK: - Initialization

    private init() {}

    // MARK: - Connection Management

    /// 连接到 Socket.IO 服务器
    /// - Parameters:
    ///   - url: 服务器 URL
    ///   - userId: 用户 ID
    ///   - username: 用户名
    public func connect(to url: URL, userId: String, username: String) async {
        // 如果已经连接，直接返回
        if isConnected, let manager = manager {
            // Check status using nonisolated comparison
            let status = manager.status
            if status == .connected {
                Logger.debug("Socket.IO 已连接")
                return
            }
        }

        // 更新状态
        stateSubject.send(.connecting)
        currentUser = (userId, username)

        // 配置 Socket.IO - 使用正确的 API 格式
        // 使用非隔离方法以避免 actor 隔离问题
        let appVersion = AppConfig.getAppVersion()
        let buildNumber = AppConfig.getBuildNumber()

        // 获取认证 Token
        // 🚨 Critical Fix: Inject token into handshake headers to ensure immediate authentication.
        // Waiting for post-connect 'authenticate' event is too slow and causes race conditions (e.g. joinEventRoom failing).
        var config: SocketIOClientConfiguration = [
            .forceNew(true),
            .reconnects(true),
            .reconnectWait(1),
            .reconnectWaitMax(30),
            .reconnectAttempts(10),
            .log(true), // Enable logs for debugging
            .connectParams([
                "platform": "ios",
                "appVersion": appVersion,
                "buildNumber": buildNumber
            ])
        ]

        if let token = await AuthManager.shared.getAccessToken() {
            config.insert(.extraHeaders(["Authorization": "Bearer \(token)"]))
            // Also add to auth params if server supports Socket.IO v4 Auth Middleware
            config.insert(.connectParams([
                "token": token, 
                "platform": "ios",
                "appVersion": appVersion,
                "buildNumber": buildNumber
            ]))
        }

        // 创建 Socket.IO 管理器
        manager = SocketManager(socketURL: url, config: config)

        guard let socketManager = manager else {
            Logger.error("创建 Socket.IO 管理器失败")
            stateSubject.send(.error("创建管理器失败"))
            return
        }

        // 获取默认 socket (namespace: /)
        socket = socketManager.socket(forNamespace: "/")

        guard let socket = socket else {
            Logger.error("创建 Socket.IO 客户端失败")
            stateSubject.send(.error("创建客户端失败"))
            return
        }

        // 设置事件监听
        setupEventHandlers(socket)

        // 连接
        socket.connect()

        Logger.info("Socket.IO 开始连接: \(url.absoluteString)")
    }

    /// 断开连接
    public func disconnect() async {
        Logger.info("断开 Socket.IO 连接")

        socket?.disconnect()
        socket = nil
        manager?.disconnect()
        manager = nil

        stateSubject.send(.disconnected)
        subscribedTiles.removeAll()
        currentUser = nil
    }

    // MARK: - Event Handlers Setup

    private func setupEventHandlers(_ socket: SocketIOClient) {
        // 连接事件
        socket.on(clientEvent: .connect) { [weak self] data, ack in
            guard let self = self else { return }
            Logger.info("Socket.IO 连接成功")
            Task {
                await self.stateSubject.send(.connected)

                // 发送认证
                await self.authenticate()

                // 恢复订阅
                await self.restoreSubscriptions()
            }
        }

        // 断开连接事件
        socket.on(clientEvent: .disconnect) { [weak self] data, ack in
            guard let self = self else { return }
            Logger.info("Socket.IO 断开连接")
            Task {
                await self.stateSubject.send(.disconnected)
                await self.clearSubscriptions()
            }
        }

        // 错误事件
        socket.on(clientEvent: .error) { [weak self] data, ack in
            guard let self = self else { return }
            let errorMessage = data.first as? String ?? "未知错误"
            Logger.error("Socket.IO 错误: \(errorMessage)")
            Task {
                await self.stateSubject.send(.error(errorMessage))
            }
        }

        // 重连事件
        socket.on(clientEvent: .reconnect) { [weak self] data, ack in
            guard let self = self else { return }
            let attempt = data.first as? Int ?? 0
            Logger.info("Socket.IO 重连中... 第\(attempt)次")
            Task {
                await self.stateSubject.send(.reconnecting(attempt))
            }
        }

        // 重连成功
        socket.on(clientEvent: .reconnectAttempt) { [weak self] data, ack in
            // Check if self still exists
            if self != nil {
                Logger.debug("Socket.IO 重连尝试")
            }
        }

        // MARK: - 认证事件

        // 认证成功
        socket.on("authenticated") { [weak self] data, ack in
            // Check if self still exists
            guard self != nil else { return }
            if let dict = data.first as? [String: Any],
               let success = dict["success"] as? Bool {
                if success {
                    Logger.info("Socket.IO 认证成功")
                } else {
                    Logger.error("Socket.IO 认证失败")
                }
            }
        }
        
        // 活动列表变更通知
        socket.on("events_updated") { [weak self] _, _ in
            guard let self = self else { return }
            Logger.info("📡 收到活动列表更新通知")
            Task {
                await self.eventsUpdatedSubject.send()
            }
        }
        
        // MARK: - 瓦片事件

        // 瓦片数据（初始数据）
        socket.on("tile_data") { [weak self] data, ack in
            guard let self = self else { return }
            Task {
                await self.handleTileData(data)
            }
        }

        // 像素差异（增量更新）
        socket.on("pixel_diff") { [weak self] data, ack in
            guard let self = self else { return }
            Task {
                await self.handlePixelDiff(data)
            }
        }

        // 瓦片更新（元数据）
        socket.on("tile_updated") { [weak self] data, ack in
            guard let self = self else { return }
            Task {
                await self.handleTileUpdated(data)
            }
        }

        // 瓦片失效（需要刷新）
        socket.on("tileInvalidate") { [weak self] data, ack in
            guard let self = self else { return }
            Task {
                await self.handleTileInvalidate(data)
            }
        }

        // 房间加入成功
        socket.on("room_joined") { data, ack in
            Logger.debug("Socket.IO 房间加入成功")
        }

        // MARK: - 聊天事件（如果有）

        socket.on("chat_message_batch") { data, ack in
            Logger.debug("收到聊天消息批量")
        }
        
        // MARK: - ⚔️ 赛事活动事件
        
        socket.on("battle_update") { [weak self] data, ack in
            guard let self = self else { return }
            Task {
                await self.handleBattleUpdate(data)
            }
        }
        
        // MARK: - 🏴 联盟更新事件
        
        socket.on("alliance:updated") { [weak self] data, ack in
            guard let self = self else { return }
            Task {
                await self.handleAllianceUpdate(data)
            }
        }

        // MARK: - 🛡️ 领土动态事件

        socket.on("territory_battle") { [weak self] data, ack in
            guard let self = self else { return }
            Task {
                await self.handleTerritoryBattle(data)
            }
        }

        // 🍾 漂流瓶遭遇
        socket.on("bottle_nearby") { [weak self] data, ack in
            guard let self = self else { return }
            Task {
                await self.handleBottleNearby(data)
            }
        }

        // 🌊 漂流瓶沉没
        socket.on("bottle_sunk") { [weak self] data, ack in
            guard let self = self else { return }
            Task {
                await self.handleBottleSunk(data)
            }
        }

        // 🔔 新通知事件
        socket.on("new_notification") { [weak self] data, ack in
            guard let self = self else { return }

            // 在非 actor 上下文中解码
            guard let dict = data.first as? [String: Any],
                  let jsonData = try? JSONSerialization.data(withJSONObject: dict) else {
                Logger.warning("Invalid new_notification data")
                return
            }

            // 使用 nonisolated 上下文解码
            Task.detached {
                guard let notification = try? JSONDecoder().decode(NotificationService.SystemMessage.self, from: jsonData) else {
                    Logger.warning("Failed to decode notification")
                    return
                }
                await self.handleNewNotification(notification)
            }
        }
    }

    // MARK: - Event Handlers

    private func handleTileData(_ data: [Any]) async {
        guard let dict = data.first as? [String: Any],
              let tileId = dict["tileId"] as? String else {
            Logger.warning("无效的 tile_data 格式")
            return
        }

        // 解析像素数据 (MainActor required for Pixel decoding)
        var pixels: [Pixel] = []
        if let pixelsArray = dict["data"] as? [[String: Any]] {
            pixels = await MainActor.run {
                pixelsArray.compactMap { pixelDict in
                    try? JSONDecoder().decode(Pixel.self, from: JSONSerialization.data(withJSONObject: pixelDict))
                }
            }
        }

        let tileData = TileData(
            tileId: tileId,
            pixels: pixels,
            timestamp: (dict["timestamp"] as? TimeInterval) ?? Date().timeIntervalSince1970
        )

        Logger.info("收到瓦片数据: \(tileId), 像素数: \(pixels.count)")
        tileDataSubject.send(tileData)
    }

    private func handlePixelDiff(_ data: [Any]) async {
        guard let dict = data.first as? [String: Any],
              let tileId = dict["tileId"] as? String,
              let pixelsArray = dict["pixels"] as? [[String: Any]] else {
            Logger.warning("无效的 pixel_diff 格式")
            return
        }

        let pixels = await MainActor.run {
            pixelsArray.compactMap { pixelDict in
                try? JSONDecoder().decode(Pixel.self, from: JSONSerialization.data(withJSONObject: pixelDict))
            }
        }

        Logger.debug("收到像素差异: \(tileId), 像素数: \(pixels.count)")
        pixelChangesSubject.send(pixels)
    }

    private func handleTileUpdated(_ data: [Any]) {
        guard let dict = data.first as? [String: Any],
              let tileId = dict["tileId"] as? String else {
            return
        }

        let pixelCount = (dict["pixelCount"] as? Int) ?? 0
        Logger.debug("瓦片更新: \(tileId), 像素数: \(pixelCount)")
    }

    private func handleTileInvalidate(_ data: [Any]) async {
        guard let dict = data.first as? [String: Any],
              let tileIds = dict["tileIds"] as? [String],
              let gridId = dict["pixelGridId"] as? String else {
            Logger.warning("无效的 tileInvalidate 格式")
            return
        }

        let reason = dict["reason"] as? String ?? "unknown"
        Logger.info("🔄 收到瓦片失效通知: gridId=\(gridId), reason=\(reason), tiles=\(tileIds.count)")

        // 通知需要刷新的瓦片
        tileInvalidateSubject.send((gridId: gridId, tileIds: tileIds, reason: reason))
    }
    
    private func handleBattleUpdate(_ data: [Any]) {
        guard let dict = data.first as? [String: Any] else {
            return
        }
        Logger.debug("收到赛事战况更新")
        battleUpdateSubject.send(dict)
    }
    
    private func handleAllianceUpdate(_ data: [Any]) {
        guard let dict = data.first as? [String: Any] else {
            return
        }
        Logger.debug("收到联盟更新通知")
        allianceUpdatedSubject.send(dict)
    }

    private func handleTerritoryBattle(_ data: [Any]) {
        guard let dict = data.first as? [String: Any],
              let jsonData = try? JSONSerialization.data(withJSONObject: dict),
              let event = try? JSONDecoder().decode(TerritoryBattleEvent.self, from: jsonData)
        else { return }

        Logger.debug("收到领土动态: \(event.grid_id)")
        territoryBattleSubject.send(event)

        Task { @MainActor in
            TerritoryBannerManager.shared.addBattleEvent(event)
        }
    }

    // MARK: - Drift Bottle Handlers

    private func decodeBottle(from data: [Any]) async -> DriftBottle? {
        guard let dict = data.first as? [String: Any],
              let jsonData = try? JSONSerialization.data(withJSONObject: dict)
        else { return nil }
        return await MainActor.run {
            try? JSONDecoder().decode(DriftBottle.self, from: jsonData)
        }
    }

    private func decodeJourneyCardDetail(from data: [Any]) async -> JourneyCardDetail? {
        guard let dict = data.first as? [String: Any],
              let journeyData = dict["journeyDetail"] as? [String: Any],
              let jsonData = try? JSONSerialization.data(withJSONObject: journeyData)
        else { return nil }
        return await MainActor.run {
            try? JSONDecoder().decode(JourneyCardDetail.self, from: jsonData)
        }
    }

    private func handleBottleNearby(_ data: [Any]) async {
        guard let bottle = await decodeBottle(from: data) else {
            Logger.warning("Invalid bottle_nearby data")
            return
        }
        Logger.debug("Received bottle nearby: \(bottle.bottleId)")
        bottleNearbySubject.send(bottle)
    }

    private func handleBottleSunk(_ data: [Any]) async {
        guard let detail = await decodeJourneyCardDetail(from: data) else {
            Logger.warning("Invalid bottle_sunk data")
            return
        }
        Logger.debug("Received bottle sunk: \(detail.bottleId)")
        bottleSunkSubject.send(detail)
    }

    /// 处理新通知事件
    private func handleNewNotification(_ notification: NotificationService.SystemMessage) async {
        Logger.info("🔔 收到新通知: \(notification.title)")
        newNotificationSubject.send(notification)
    }

    // MARK: - Authentication

    private func authenticate() async {
        guard let socket = socket,
              let user = currentUser else {
            Logger.error("无法认证: socket 或用户信息为空")
            return
        }

        socket.emit("authenticate", [
            "userId": user.userId,
            "username": user.username
        ])

        Logger.debug("发送认证请求")
    }

    // MARK: - Tile Subscription

    /// 订阅瓦片房间
    /// - Parameter tileId: 瓦片 ID (格式: "z/x/y")
    public func subscribeTile(_ tileId: String) async {
        // 检查是否已订阅
        if subscribedTiles.contains(tileId) {
            Logger.debug("瓦片已订阅: \(tileId)")
            return
        }

        // 如果未连接，加入待订阅列表
        guard isConnected else {
            pendingSubscriptions.insert(tileId)
            Logger.debug("Socket.IO 未连接，瓦片已加入待订阅: \(tileId)")
            return
        }

        guard let socket = socket else {
            Logger.error("Socket 客户端为空")
            return
        }

        // 发送加入瓦片房间事件
        socket.emit("join_tile_room", ["tileId": tileId])
        subscribedTiles.insert(tileId)

        Logger.info("订阅瓦片: \(tileId)")
    }

    /// 取消订阅瓦片房间
    /// - Parameter tileId: 瓦片 ID
    public func unsubscribeTile(_ tileId: String) async {
        // 从待订阅列表移除
        pendingSubscriptions.remove(tileId)

        // 检查是否已订阅
        guard subscribedTiles.contains(tileId) else {
            Logger.debug("瓦片未订阅: \(tileId)")
            return
        }

        // 如果未连接，直接从列表移除
        guard isConnected, let socket = socket else {
            subscribedTiles.remove(tileId)
            Logger.debug("Socket.IO 未连接，从订阅列表移除: \(tileId)")
            return
        }

        // 发送离开瓦片房间事件
        socket.emit("leave_tile_room", ["tileId": tileId])
        subscribedTiles.remove(tileId)

        Logger.info("取消订阅瓦片: \(tileId)")
    }

    /// 发送像素更新
    /// - Parameters:
    ///   - tileId: 瓦片 ID
    ///   - pixelData: 像素数据
    public func emitPixelUpdate(tileId: String, pixelData: [String: Any]) async {
        guard let socket = socket, isConnected else {
            Logger.error("Socket.IO 未连接")
            return
        }

        guard let user = currentUser else {
            Logger.error("用户未认证")
            return
        }

        socket.emit("pixel_update", [
            "tileId": tileId,
            "pixelData": pixelData,
            "userId": user.userId
        ])

        Logger.debug("发送像素更新: \(tileId)")
    }

    // MARK: - Subscription Management

    /// 恢复订阅
    private func restoreSubscriptions() async {
        Logger.info("恢复瓦片订阅: \(pendingSubscriptions.count) 个瓦片")

        for tileId in pendingSubscriptions {
            await subscribeTile(tileId)
        }

        pendingSubscriptions.removeAll()
    }

    /// 清理所有订阅
    private func clearSubscriptions() async {
        subscribedTiles.removeAll()
        pendingSubscriptions.removeAll()
    }

    /// 更新瓦片订阅
    /// - Parameter tileIds: 新的瓦片 ID 列表
    public func updateTileSubscriptions(_ tileIds: Set<String>) async {
        let newTileIds = tileIds
        let currentTileIds = subscribedTiles

        // 找出需要取消订阅的瓦片
        let toUnsubscribe = currentTileIds.subtracting(newTileIds)
        for tileId in toUnsubscribe {
            await unsubscribeTile(tileId)
        }

        // 找出需要新订阅的瓦片
        let toSubscribe = newTileIds.subtracting(currentTileIds)
        for tileId in toSubscribe {
            await subscribeTile(tileId)
        }

        Logger.info("更新瓦片订阅完成: +\(toSubscribe.count) -\(toUnsubscribe.count)")
    }

    // MARK: - ⚔️ Event Room Management

    /// 加入赛事房间
    public func joinEventRoom(_ eventId: String) async {
        // 保存 ID 以便重连时恢复
        currentEventId = eventId
        
        guard let socket = socket, isConnected else {
            Logger.warning("Socket.IO 未连接，将在连接后自动加入赛事房间: \(eventId)")
            return
        }
        
        socket.emit("join_event_room", ["eventId": eventId])
        Logger.info("加入赛事房间: \(eventId)")
    }

    /// 离开赛事房间
    public func leaveEventRoom(_ eventId: String) async {
        if currentEventId == eventId {
            currentEventId = nil
        }
        
        guard let socket = socket, isConnected else {
            return
        }
        
        socket.emit("leave_event_room", ["eventId": eventId])
        Logger.info("离开赛事房间: \(eventId)")
    }

    // MARK: - Convenience Methods

    /// 使用默认 URL 连接
    public func connect(userId: String, username: String) async {
        // 使用非隔离方法获取 WebSocket URL
        let urlString = AppConfig.getWebSocketURL()
        guard let url = URL(string: urlString) else {
            Logger.error("无效的 WebSocket URL")
            return
        }
        await connect(to: url, userId: userId, username: username)
    }

    /// 获取当前订阅的瓦片数量
    public var subscribedTileCount: Int {
        subscribedTiles.count
    }

    /// 获取所有已订阅的瓦片 ID
    public var allSubscribedTiles: Set<String> {
        subscribedTiles
    }
}

// MARK: - Tile Data Model

/// 瓦片数据
public struct TileData {
    /// 瓦片 ID
    public let tileId: String

    /// 像素数组
    public let pixels: [Pixel]

    /// 时间戳
    public let timestamp: TimeInterval
}
