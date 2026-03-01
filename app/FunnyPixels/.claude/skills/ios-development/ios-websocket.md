# iOS WebSocket Manager Skill

**描述**: 实现iOS专用WebSocket实时通信管理器

**使用场景**:
- 建立WebSocket连接到后端
- 实现区域订阅机制（基于地图视口）
- 处理实时像素更新事件
- 断线重连和网络抖动处理

**参数**:
- `ws_url`: WebSocket服务器地址
- `reconnect_interval`: 重连间隔（秒），默认5秒
- `max_retry`: 最大重试次数，默认10次

**实现步骤**:

## 1. 创建WebSocket事件模型

```swift
// Sources/FunnyPixels/Models/WebSocketEvents.swift

import Foundation

/// WebSocket事件类型
public enum WSEventType: String, Codable {
    case pixelAdded = "pixel:added"
    case pixelUpdated = "pixel:updated"
    case pixelRemoved = "pixel:removed"
    case regionUpdate = "region:update"
    case error = "error"
    case ping = "ping"
    case pong = "pong"
}

/// WebSocket消息
public struct WSMessage: Codable {
    public let type: WSEventType
    public let data: WSMessageData
    public let timestamp: Date
    public let messageId: String

    public init(type: WSEventType, data: WSMessageData) {
        self.type = type
        self.data = data
        self.timestamp = Date()
        self.messageId = UUID().uuidString
    }
}

/// WebSocket消息数据
public enum WSMessageData: Codable {
    case pixel(Pixel)
    case pixels([Pixel])
    case region(TileBounds)
    case error(String)
    case empty

    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()

        if let pixel = try? container.decode(Pixel.self) {
            self = .pixel(pixel)
        } else if let pixels = try? container.decode([Pixel].self) {
            self = .pixels(pixels)
        } else if let region = try? container.decode(TileBounds.self) {
            self = .region(region)
        } else if let error = try? container.decode(String.self) {
            self = .error(error)
        } else {
            self = .empty
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .pixel(let pixel):
            try container.encode(pixel)
        case .pixels(let pixels):
            try container.encode(pixels)
        case .region(let region):
            try container.encode(region)
        case .error(let error):
            try container.encode(error)
        case .empty:
            try container.encodeNil()
        }
    }
}
```

## 2. 实现WebSocket管理器

```swift
// Sources/FunnyPixels/Services/WebSocketManager.swift

import Foundation
import Combine

public actor WebSocketManager {
    private var webSocketTask: URLSessionWebSocketTask?
    private var isConnected = false
    private var reconnectAttempts = 0
    private let maxReconnectAttempts = 10
    private var reconnectTimer: Task<Void, Never>?

    private let messageSubject = PassthroughSubject<WSMessage, Never>()
    private let connectionSubject = PassthroughSubject<Bool, Never>()

    private var subscribedRegions: Set<String> = []
    private var messageQueue: [String] = [] // 离线时缓存消息

    public var messagePublisher: AnyPublisher<WSMessage, Never> {
        messageSubject.eraseToAnyPublisher()
    }

    public var connectionPublisher: AnyPublisher<Bool, Never> {
        connectionSubject.eraseToAnyPublisher()
    }

    public init() {}

    // MARK: - Connection Management

    /// 连接WebSocket
    public func connect(to url: URL, token: String? = nil) {
        var request = URLRequest(url: url)
        if let token = token {
            request.addValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        let session = URLSession(configuration: .default)
        webSocketTask = session.webSocketTask(with: request)
        webSocketTask?.resume()

        isConnected = true
        reconnectAttempts = 0
        connectionSubject.send(true)

        // 开始接收消息
        receiveMessage()

        // 启动心跳
        startHeartbeat()

        print("✅ WebSocket connected to \(url)")
    }

    /// 断开连接
    public func disconnect() {
        webSocketTask?.cancel(with: .goingAway, reason: nil)
        webSocketTask = nil
        isConnected = false
        connectionSubject.send(false)
        reconnectTimer?.cancel()

        print("❌ WebSocket disconnected")
    }

    /// 重新连接
    private func reconnect(to url: URL, token: String?) {
        guard reconnectAttempts < maxReconnectAttempts else {
            print("❌ Max reconnect attempts reached")
            return
        }

        reconnectAttempts += 1
        let delay = min(pow(2.0, Double(reconnectAttempts)), 60.0) // 指数退避，最多60秒

        print("🔄 Reconnecting in \(delay)s (attempt \(reconnectAttempts)/\(maxReconnectAttempts))")

        reconnectTimer = Task {
            try? await Task.sleep(nanoseconds: UInt64(delay * 1_000_000_000))
            connect(to: url, token: token)
        }
    }

    // MARK: - Message Handling

    /// 发送消息
    public func send(_ message: WSMessage) async throws {
        guard isConnected else {
            // 离线时缓存消息
            let encoder = JSONEncoder()
            if let data = try? encoder.encode(message),
               let json = String(data: data, encoding: .utf8) {
                messageQueue.append(json)
            }
            throw WSError.notConnected
        }

        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        let data = try encoder.encode(message)

        let textMessage = URLSessionWebSocketTask.Message.string(String(data: data, encoding: .utf8)!)
        try await webSocketTask?.send(textMessage)
    }

    /// 接收消息
    private func receiveMessage() {
        webSocketTask?.receive { [weak self] result in
            Task {
                await self?.handleReceiveResult(result)
                await self?.receiveMessage() // 继续接收
            }
        }
    }

    private func handleReceiveResult(_ result: Result<URLSessionWebSocketTask.Message, Error>) async {
        switch result {
        case .success(let message):
            switch message {
            case .string(let text):
                await handleTextMessage(text)
            case .data(let data):
                await handleDataMessage(data)
            @unknown default:
                break
            }

        case .failure(let error):
            print("❌ WebSocket receive error: \(error)")
            isConnected = false
            connectionSubject.send(false)
            // 触发重连（需要保存URL和token）
        }
    }

    private func handleTextMessage(_ text: String) async {
        guard let data = text.data(using: .utf8) else { return }

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601

        do {
            let message = try decoder.decode(WSMessage.self, from: data)

            // 消息去重（基于messageId）
            // TODO: 实现去重逻辑

            // 发布消息
            messageSubject.send(message)

            // 处理特定类型的消息
            await handleSpecificMessage(message)
        } catch {
            print("❌ Failed to decode message: \(error)")
        }
    }

    private func handleDataMessage(_ data: Data) async {
        // 处理二进制消息（如果需要）
    }

    private func handleSpecificMessage(_ message: WSMessage) async {
        switch message.type {
        case .ping:
            // 回复pong
            let pong = WSMessage(type: .pong, data: .empty)
            try? await send(pong)

        case .pixelAdded, .pixelUpdated:
            // 像素更新事件会通过Publisher传递给订阅者
            break

        case .error:
            if case .error(let errorMsg) = message.data {
                print("❌ Server error: \(errorMsg)")
            }

        default:
            break
        }
    }

    // MARK: - Region Subscription

    /// 订阅区域
    public func subscribeRegion(_ bounds: TileBounds) async throws {
        let regionKey = "\(bounds.minLatitude)_\(bounds.minLongitude)"

        guard !subscribedRegions.contains(regionKey) else {
            return // 已订阅
        }

        let message = WSMessage(
            type: .regionUpdate,
            data: .region(bounds)
        )

        try await send(message)
        subscribedRegions.insert(regionKey)

        print("📍 Subscribed to region: \(regionKey)")
    }

    /// 取消订阅区域
    public func unsubscribeRegion(_ bounds: TileBounds) async throws {
        let regionKey = "\(bounds.minLatitude)_\(bounds.minLongitude)"

        guard subscribedRegions.contains(regionKey) else {
            return // 未订阅
        }

        // 发送取消订阅消息（需要后端支持）
        subscribedRegions.remove(regionKey)

        print("📍 Unsubscribed from region: \(regionKey)")
    }

    /// 更新订阅区域（根据地图视口）
    public func updateSubscriptions(for regions: [TileBounds]) async throws {
        let newRegionKeys = Set(regions.map { "\($0.minLatitude)_\($0.minLongitude)" })

        // 取消不再需要的订阅
        let toUnsubscribe = subscribedRegions.subtracting(newRegionKeys)
        for key in toUnsubscribe {
            // TODO: 发送取消订阅消息
        }

        // 添加新订阅
        for bounds in regions {
            try await subscribeRegion(bounds)
        }
    }

    // MARK: - Heartbeat

    private func startHeartbeat() {
        Task {
            while isConnected {
                try? await Task.sleep(nanoseconds: 30_000_000_000) // 30秒
                let ping = WSMessage(type: .ping, data: .empty)
                try? await send(ping)
            }
        }
    }

    // MARK: - Offline Queue

    /// 发送队列中的消息（重连后）
    private func flushMessageQueue() async {
        for json in messageQueue {
            if let data = json.data(using: .utf8),
               let message = try? JSONDecoder().decode(WSMessage.self, from: data) {
                try? await send(message)
            }
        }
        messageQueue.removeAll()
    }
}

public enum WSError: Error {
    case notConnected
    case encodingFailed
    case decodingFailed
}
```

## 3. 集成到ViewModel

```swift
// Sources/FunnyPixels/ViewModels/MapViewModel.swift 扩展

extension MapViewModel {
    private var cancellables = Set<AnyCancellable>()

    func setupWebSocket() {
        let wsURL = URL(string: "\(AppEnvironment.current.wsBaseURL)/pixels")!

        Task {
            await wsManager.connect(to: wsURL, token: authToken)

            // 监听连接状态
            await wsManager.connectionPublisher
                .sink { [weak self] isConnected in
                    self?.isWebSocketConnected = isConnected
                }
                .store(in: &cancellables)

            // 监听消息
            await wsManager.messagePublisher
                .sink { [weak self] message in
                    self?.handleWebSocketMessage(message)
                }
                .store(in: &cancellables)
        }
    }

    func handleWebSocketMessage(_ message: WSMessage) {
        switch message.type {
        case .pixelAdded:
            if case .pixel(let pixel) = message.data {
                // 添加到地图（乐观UI）
                pixels.append(pixel)
            }

        case .pixelUpdated:
            if case .pixel(let pixel) = message.data {
                // 更新像素
                if let index = pixels.firstIndex(where: { $0.id == pixel.id }) {
                    pixels[index] = pixel
                }
            }

        case .pixelRemoved:
            if case .pixel(let pixel) = message.data {
                // 移除像素
                pixels.removeAll { $0.id == pixel.id }
            }

        default:
            break
        }
    }

    func updateWebSocketSubscriptions(for region: MKCoordinateRegion) {
        Task {
            let zoomLevel = PixelLODStrategy.zoomLevel(from: region)
            let tiles = await tileManager.tilesForVisibleRegion(region, zoom: zoomLevel)

            try? await wsManager.updateSubscriptions(for: tiles)
        }
    }
}
```

## 4. 网络抖动处理

```swift
// Sources/FunnyPixels/Services/NetworkMonitor.swift

import Network
import Combine

public class NetworkMonitor: ObservableObject {
    private let monitor = NWPathMonitor()
    private let queue = DispatchQueue(label: "NetworkMonitor")

    @Published public var isConnected = true
    @Published public var connectionType: NWInterface.InterfaceType?

    public init() {
        monitor.pathUpdateHandler = { [weak self] path in
            DispatchQueue.main.async {
                self?.isConnected = path.status == .satisfied
                self?.connectionType = path.availableInterfaces.first?.type
            }
        }
        monitor.start(queue: queue)
    }

    deinit {
        monitor.cancel()
    }
}

// 使用网络监控自动重连
extension MapViewModel {
    func setupNetworkMonitoring() {
        networkMonitor.$isConnected
            .removeDuplicates()
            .sink { [weak self] isConnected in
                if isConnected {
                    // 网络恢复，重连WebSocket
                    self?.setupWebSocket()
                } else {
                    // 网络断开
                    Task {
                        await self?.wsManager.disconnect()
                    }
                }
            }
            .store(in: &cancellables)
    }
}
```

## 验收标准

- ✅ WebSocket可成功连接到服务器
- ✅ 能接收实时像素更新事件
- ✅ 区域订阅机制正常工作
- ✅ 断线后自动重连
- ✅ 离线消息队列正常缓存
- ✅ 心跳机制保持连接活跃

## 测试方法

```swift
// Tests/FunnyPixelsTests/WebSocketTests.swift

import XCTest
@testable import FunnyPixels

class WebSocketTests: XCTestCase {
    var wsManager: WebSocketManager!

    override func setUp() async throws {
        wsManager = WebSocketManager()
    }

    func testConnect() async throws {
        let url = URL(string: "ws://localhost:3000/pixels")!
        await wsManager.connect(to: url)

        // 等待连接建立
        try await Task.sleep(nanoseconds: 1_000_000_000)

        let isConnected = await wsManager.connectionPublisher
            .first()
            .await()

        XCTAssertTrue(isConnected)
    }

    func testSubscribeRegion() async throws {
        let bounds = TileBounds(
            minLatitude: 39.0,
            maxLatitude: 40.0,
            minLongitude: 116.0,
            maxLongitude: 117.0
        )

        try await wsManager.subscribeRegion(bounds)

        // 验证订阅成功
    }
}
```

## 性能优化

1. **消息去重**: 使用messageId防止重复处理
2. **批量更新**: 累积多个像素更新后一次性刷新UI
3. **区域裁剪**: 只订阅可见区域，离开视口时取消订阅
4. **消息压缩**: 使用二进制格式或压缩算法（如需要）

## 依赖工具

- URLSession.WebSocketTask
- Combine
- Network framework (for monitoring)
