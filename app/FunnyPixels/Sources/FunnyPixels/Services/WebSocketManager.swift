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

/// WebSocket Manager
/// Manages WebSocket connection for real-time pixel updates
public class WebSocketManager: ObservableObject {
    public static let shared = WebSocketManager()

    @Published public private(set) var connectionState: WebSocketConnectionState = .disconnected

    private init() {}

    /// Connect to the WebSocket server
    public func connect() {
        connectionState = .connecting
        // Stub implementation
        print("Connecting to WebSocket...")
    }

    /// Disconnect from the WebSocket server
    public func disconnect() {
        connectionState = .disconnecting(nil)
        // Stub implementation
        print("Disconnecting from WebSocket...")
    }

    /// Send a message through the WebSocket
    public func send(_ message: String) {
        guard case .connected = connectionState else {
            print("Cannot send message: not connected")
            return
        }
        print("Sending message: \(message)")
    }

    /// Send a JSON message
    public func send<T: Encodable>(_ data: T) {
        // Stub implementation
        print("Sending data")
    }
}
