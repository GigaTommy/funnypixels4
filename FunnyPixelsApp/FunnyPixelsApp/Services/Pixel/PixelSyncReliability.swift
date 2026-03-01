import Foundation
import Combine

/// Pixel Sync Reliability Manager
/// Manages reliability of WebSocket pixel synchronization
public class PixelSyncReliability {
    public static let shared = PixelSyncReliability()

    private var pendingAcks: [String: Date] = [:]
    private let ackTimeout: TimeInterval = 30.0

    public private(set) var isReliable: Bool = true

    private init() {}

    /// Register a pending acknowledgment
    public func registerPendingAck(pixelId: String) {
        pendingAcks[pixelId] = Date()
    }

    /// Confirm acknowledgment received
    public func confirmAck(pixelId: String) {
        pendingAcks.removeValue(forKey: pixelId)
    }

    /// Check for timed-out acknowledgments
    public func checkTimeouts() -> [String] {
        let now = Date()
        let timedOut = pendingAcks.filter { now.timeIntervalSince($0.value) > ackTimeout }
        timedOut.forEach { pendingAcks.removeValue(forKey: $0.key) }
        return timedOut.map { $0.key }
    }
}
