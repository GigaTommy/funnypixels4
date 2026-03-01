import Foundation
import Combine

/// WebSocket Connection State
public enum WebSocketConnectionState: Equatable {
    case disconnected
    case connecting
    case connected
    case disconnecting((any Error)?)

    public static func == (lhs: WebSocketConnectionState, rhs: WebSocketConnectionState) -> Bool {
        switch (lhs, rhs) {
        case (.disconnected, .disconnected),
             (.connecting, .connecting),
             (.connected, .connected):
            return true
        case (.disconnecting(let lhsError), .disconnecting(let rhsError)):
            return lhsError?.localizedDescription == rhsError?.localizedDescription
        default:
            return false
        }
    }
}

/// Pixel Update Event (from WebSocket)
public struct PixelUpdate: Codable {
    public let id: String
    public let type: String  // "color", "emoji", "complex"
    public let lat: Double
    public let lng: Double
    public let color: String?
    public let emoji: String?
    public let patternId: String? // Added for complex pattern identification
    public let materialId: String? // Added for material system identification
    public let imageUrl: String?
    public let payload: String? // Image payload for complex patterns
    public let likeCount: Int?
    public let updatedAt: String
}

/// WebSocket Message Types
private enum WebSocketMessageType: String, Codable {
    case tileUpdate = "tile_update"
    case pixelUpdate = "pixel_update"
    case batchUpdate = "batch_update"
    case error = "error"
}

/// WebSocket Message
private struct WebSocketMessage: Codable {
    let type: String
    let data: [PixelUpdate]
}

/// WebSocket Manager
/// Manages WebSocket connection for real-time pixel updates
/// References Web端 tileUpdateSubscriber implementation
public class WebSocketManager: ObservableObject {
    public static let shared = WebSocketManager()

    @Published public private(set) var connectionState: WebSocketConnectionState = .disconnected

    // WebSocket session
    private var webSocketTask: URLSessionWebSocketTask?
    private var urlSession: URLSession?

    // Pixel update callbacks
    private var pixelUpdateCallbacks: [(PixelUpdate) -> Void] = []

    // Heartbeat
    private var heartbeatTimer: Timer?
    private let heartbeatInterval: TimeInterval = 30

    // Reconnect
    private var reconnectAttempts: Int = 0
    private let maxReconnectAttempts: Int = 5
    private let reconnectDelay: TimeInterval = 2

    private init() {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 30
        config.timeoutIntervalForResource = 60
        self.urlSession = URLSession(configuration: config)
    }

    /// Connect to the WebSocket server
    public func connect() {
        guard case .disconnected = connectionState else {
            Logger.info("WebSocket already connected or connecting")
            return
        }

        connectionState = .connecting

        // 使用 AppEnvironment 配置的 WebSocket URL
        let wsURLString = AppEnvironment.current.wsURL
        guard let wsURL = URL(string: wsURLString) else {
            Logger.error("Invalid WebSocket URL: \(wsURLString)")
            connectionState = .disconnected
            return
        }

        var request = URLRequest(url: wsURL)
        request.timeoutInterval = 10

        // Add authentication token if available
        if let token = AuthManager.shared.getAccessToken() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        webSocketTask = urlSession?.webSocketTask(with: request)
        webSocketTask?.resume()

        Logger.info("🔌 WebSocket connecting to: \(wsURL.absoluteString)")

        // Start receiving messages
        receiveMessage()

        // Start heartbeat
        startHeartbeat()

        // Update state
        DispatchQueue.main.asyncAfter(deadline: .now() + 1) { [weak self] in
            self?.connectionState = .connected
            self?.reconnectAttempts = 0
            Logger.info("✅ WebSocket connected")

            // Subscribe to tile updates (like Web端 tileUpdateSubscriber.connect)
            self?.subscribeToTileUpdates()
        }
    }

    /// Disconnect from the WebSocket server
    public func disconnect() {
        connectionState = .disconnecting(nil)

        webSocketTask?.cancel(with: .goingAway, reason: nil)
        webSocketTask = nil

        stopHeartbeat()

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { [weak self] in
            self?.connectionState = .disconnected
            Logger.info("🔌 WebSocket disconnected")
        }
    }

    /// Send a message through the WebSocket
    public func send(_ message: String) {
        guard case .connected = connectionState else {
            Logger.warning("Cannot send message: not connected")
            return
        }

        webSocketTask?.send(.string(message)) { [weak self] error in
            if let error = error {
                Logger.error("WebSocket send error: \(error)")
                self?.handleConnectionError(error)
            }
        }
    }

    /// Send a JSON message
    public func send<T: Encodable>(_ data: T) {
        do {
            let jsonData = try JSONEncoder().encode(data)
            if let jsonString = String(data: jsonData, encoding: .utf8) {
                send(jsonString)
            }
        } catch {
            Logger.error("Failed to encode WebSocket message: \(error)")
        }
    }

    /// Subscribe to pixel updates
    public func subscribeToPixelUpdates(_ callback: @escaping (PixelUpdate) -> Void) {
        pixelUpdateCallbacks.append(callback)
        Logger.info("Subscribed to pixel updates, total subscribers: \(pixelUpdateCallbacks.count)")
    }

    /// Unsubscribe from pixel updates
    public func unsubscribeFromPixelUpdates() {
        pixelUpdateCallbacks.removeAll()
        Logger.info("Unsubscribed from all pixel updates")
    }

    // MARK: - Private Methods

    /// Subscribe to tile updates (like Web端)
    private func subscribeToTileUpdates() {
        let subscribeMessage: [String: Any] = [
            "type": "subscribe",
            "channel": "tile_updates"
        ]

        if let jsonData = try? JSONSerialization.data(withJSONObject: subscribeMessage),
           let jsonString = String(data: jsonData, encoding: .utf8) {
            send(jsonString)
            Logger.info("📡 Subscribed to tile updates channel")
        }
    }

    /// Receive messages from WebSocket
    private func receiveMessage() {
        webSocketTask?.receive { [weak self] result in
            switch result {
            case .success(let message):
                switch message {
                case .string(let text):
                    self?.handleMessage(text)
                case .data(let data):
                    if let text = String(data: data, encoding: .utf8) {
                        self?.handleMessage(text)
                    }
                @unknown default:
                    break
                }

                // Continue receiving
                self?.receiveMessage()

            case .failure(let error):
                Logger.error("WebSocket receive error: \(error)")
                self?.handleConnectionError(error)
            }
        }
    }

    // Ping tracking
    private var lastPingTime: Date?

    /// Send heartbeat ping
    private func sendHeartbeat() {
        guard case .connected = connectionState else { return }

        lastPingTime = Date()
        let ping: [String: Any] = ["type": "ping"]
        if let jsonData = try? JSONSerialization.data(withJSONObject: ping),
           let jsonString = String(data: jsonData, encoding: .utf8) {
            send(jsonString)
        }
    }
    
    /// Handle received message
    private func handleMessage(_ text: String) {
        // Record raw activity? Maybe not raw bytes, but packets.
        
        guard let data = text.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            return
        }

        guard let type = json["type"] as? String else { return }

        switch type {
        case "pong":
            if let startTime = lastPingTime {
                let rtt = Date().timeIntervalSince(startTime) * 1000
                PixelSyncMetrics.shared.recordLatency(rtt)
                lastPingTime = nil
            }
        case "tile_update", "pixel_update", "batch_update":
            handlePixelUpdate(json)
        case "error":
            handleErrorMessage(json)
        default:
            Logger.debug("Unknown WebSocket message type: \(type)")
        }
    }

    /// Handle pixel update
    private func handlePixelUpdate(_ json: [String: Any]) {
        guard let dataArray = json["data"] as? [[String: Any]] else { return }

        // Record metrics
        PixelSyncMetrics.shared.recordPixelsReceived(dataArray.count)

        let updates: [PixelUpdate] = dataArray.compactMap { dict -> PixelUpdate? in
            guard let id = dict["id"] as? String,
                  let lat = dict["lat"] as? Double ?? dict["latitude"] as? Double,
                  let lng = dict["lng"] as? Double ?? dict["longitude"] as? Double,
                  let type = dict["type"] as? String else {
                return nil
            }

            return PixelUpdate(
                id: id,
                type: type,
                lat: lat,
                lng: lng,
                color: dict["color"] as? String,
                emoji: dict["emoji"] as? String,
                patternId: dict["pattern_id"] as? String ?? dict["patternId"] as? String,
                materialId: dict["material_id"] as? String ?? dict["materialId"] as? String,
                imageUrl: dict["imageUrl"] as? String,
                payload: dict["payload"] as? String,
                likeCount: dict["like_count"] as? Int ?? dict["likeCount"] as? Int,
                updatedAt: dict["updatedAt"] as? String ?? ISO8601DateFormatter().string(from: Date())
            )
        }

        // Notify all subscribers
        for update in updates {
            for callback in pixelUpdateCallbacks {
                callback(update)
            }
        }

        Logger.debug("📦 Received \(updates.count) pixel updates via WebSocket")
    }

    /// Handle error message
    private func handleErrorMessage(_ json: [String: Any]) {
        let message = json["message"] as? String ?? "Unknown error"
        Logger.error("WebSocket error: \(message)")
    }

    /// Handle connection error
    private func handleConnectionError(_ error: Error) {
        Logger.error("WebSocket connection error: \(error)")

        // Attempt to reconnect
        guard reconnectAttempts < maxReconnectAttempts else {
            connectionState = .disconnected
            Logger.error("Max reconnect attempts reached")
            return
        }

        reconnectAttempts += 1
        Logger.info("Reconnecting in \(reconnectDelay)s (attempt \(reconnectAttempts)/\(maxReconnectAttempts))")

        DispatchQueue.main.asyncAfter(deadline: .now() + reconnectDelay) { [weak self] in
            self?.connect()
        }
    }

    /// Start heartbeat
    private func startHeartbeat() {
        heartbeatTimer = Timer.scheduledTimer(withTimeInterval: heartbeatInterval, repeats: true) { [weak self] _ in
            self?.sendHeartbeat()
        }
    }

    /// Stop heartbeat
    private func stopHeartbeat() {
        heartbeatTimer?.invalidate()
        heartbeatTimer = nil
    }
    deinit {
        disconnect()
    }
}
