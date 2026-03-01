import Foundation
import SocketIO
import Combine

// MARK: - Socket.IO Connection State

/// Socket.IO 连接状态
public enum SocketIOState: Equatable {
    case disconnected
    case connecting
    case connected
    case reconnecting(Int)
    case error(String)

    public static func == (lhs: SocketIOState, rhs: SocketIOState) -> Bool {
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

    /// 当前连接状态
    public var state: SocketIOState {
        stateSubject.value
    }

    /// 是否已连接
    public var isConnected: Bool {
        state == .connected
    }

    /// 已订阅的瓦片房间
    private var subscribedTiles: Set<String> = []

    /// 待订阅的瓦片（连接成功后自动订阅）
    private var pendingSubscriptions: Set<String> = []

    /// 当前用户信息
    private var currentUser: (userId: String, username: String)?

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
        if isConnected, let manager = manager, manager.status == .connected {
            Logger.debug("Socket.IO 已连接")
            return
        }

        // 更新状态
        stateSubject.send(.connecting)
        currentUser = (userId, username)

        // 配置 Socket.IO - 使用正确的 API 格式
        let config: SocketIOClientConfiguration = [
            .forceNew(true),
            .reconnects(true),
            .reconnectWait(1),
            .reconnectWaitMax(30),
            .reconnectAttempts(10),
            .log(false),
            .compress,
            .connectParams([
                "platform": "ios",
                "appVersion": AppConfig.appVersion,
                "buildNumber": AppConfig.buildNumber
            ])
        ]

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
            guard let self = self else { return }
            Logger.debug("Socket.IO 重连尝试")
        }

        // MARK: - 认证事件

        // 认证成功
        socket.on("authenticated") { [weak self] data, ack in
            guard let self = self else { return }
            if let dict = data.first as? [String: Any],
               let success = dict["success"] as? Bool {
                if success {
                    Logger.info("Socket.IO 认证成功")
                } else {
                    Logger.error("Socket.IO 认证失败")
                }
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

        // 房间加入成功
        socket.on("room_joined") { data, ack in
            Logger.debug("Socket.IO 房间加入成功")
        }

        // MARK: - 聊天事件（如果有）

        socket.on("chat_message_batch") { data, ack in
            Logger.debug("收到聊天消息批量")
        }
    }

    // MARK: - Event Handlers

    private func handleTileData(_ data: [Any]) {
        guard let dict = data.first as? [String: Any],
              let tileId = dict["tileId"] as? String else {
            Logger.warning("无效的 tile_data 格式")
            return
        }

        // 解析像素数据
        var pixels: [Pixel] = []
        if let pixelsArray = dict["data"] as? [[String: Any]] {
            pixels = pixelsArray.compactMap { pixelDict in
                self.parsePixel(from: pixelDict)
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

    private func handlePixelDiff(_ data: [Any]) {
        guard let dict = data.first as? [String: Any],
              let tileId = dict["tileId"] as? String,
              let pixelsArray = dict["pixels"] as? [[String: Any]] else {
            Logger.warning("无效的 pixel_diff 格式")
            return
        }

        let pixels = pixelsArray.compactMap { pixelDict in
            self.parsePixel(from: pixelDict)
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

    private func parsePixel(from dict: [String: Any]) -> Pixel? {
        // 尝试将字典转换为 JSON 数据，然后解码为 Pixel
        do {
            let jsonData = try JSONSerialization.data(withJSONObject: dict)
            let decoder = JSONDecoder()
            decoder.keyDecodingStrategy = .convertFromSnakeCase
            return try decoder.decode(Pixel.self, from: jsonData)
        } catch {
            Logger.error("解析像素失败: \(error)")
            return nil
        }
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

    // MARK: - Convenience Methods

    /// 使用默认 URL 连接
    public func connect(userId: String, username: String) async {
        guard let url = URL(string: AppEnvironment.current.wsURL) else {
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
