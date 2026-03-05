//
//  NetworkMonitor.swift
//  FunnyPixelsApp
//
//  Network connectivity monitor using NWPathMonitor
//  Provides real-time network status and connection type detection
//

import Foundation
import Network
import Combine

/// Network connectivity monitor
/// Provides real-time network status and connection type information
@MainActor
class NetworkMonitor: ObservableObject {
    static let shared = NetworkMonitor()

    /// Whether device has network connectivity
    @Published private(set) var isConnected = true

    /// Current connection type
    @Published private(set) var connectionType: ConnectionType = .unknown

    /// Whether connection is expensive (cellular data)
    @Published private(set) var isExpensive = false

    /// Whether connection is constrained (low data mode)
    @Published private(set) var isConstrained = false

    private let monitor = NWPathMonitor()
    private let queue = DispatchQueue(label: "NetworkMonitor", qos: .utility)

    enum ConnectionType: String {
        case wifi = "WiFi"
        case cellular = "Cellular"
        case ethernet = "Ethernet"
        case unknown = "Unknown"

        var displayName: String {
            return self.rawValue
        }
    }

    private init() {
        startMonitoring()
    }

    deinit {
        stopMonitoring()
    }

    // MARK: - Public Methods

    /// Start monitoring network status
    func startMonitoring() {
        monitor.pathUpdateHandler = { [weak self] path in
            guard let self = self else { return }

            Task { @MainActor in
                self.updateStatus(with: path)
            }
        }

        monitor.start(queue: queue)
        Logger.info("🌐 NetworkMonitor started")
    }

    /// Stop monitoring network status
    nonisolated func stopMonitoring() {
        monitor.cancel()
        Logger.info("🌐 NetworkMonitor stopped")
    }

    /// Get recommended timeout for network requests based on connection type
    func getRecommendedTimeout() -> TimeInterval {
        guard isConnected else {
            return 0.5  // Very short timeout for offline
        }

        switch connectionType {
        case .wifi:
            return 5.0  // WiFi: 5 seconds
        case .cellular:
            return 8.0  // Cellular: 8 seconds
        case .ethernet:
            return 5.0  // Ethernet: 5 seconds
        case .unknown:
            return 5.0  // Unknown: 5 seconds (default)
        }
    }

    /// Get recommended timeout for session validation (shorter)
    func getValidationTimeout() -> UInt64 {
        guard isConnected else {
            return 200_000_000  // Offline: 200ms (quick fail)
        }

        switch connectionType {
        case .wifi:
            return 500_000_000  // WiFi: 500ms
        case .cellular:
            return 800_000_000  // Cellular: 800ms
        case .ethernet:
            return 500_000_000  // Ethernet: 500ms
        case .unknown:
            return 500_000_000  // Unknown: 500ms (default)
        }
    }

    // MARK: - Private Methods

    private func updateStatus(with path: NWPath) {
        // Update connection status
        isConnected = path.status == .satisfied

        // Update connection type
        if path.usesInterfaceType(.wifi) {
            connectionType = .wifi
        } else if path.usesInterfaceType(.cellular) {
            connectionType = .cellular
        } else if path.usesInterfaceType(.wiredEthernet) {
            connectionType = .ethernet
        } else {
            connectionType = .unknown
        }

        // Update connection characteristics
        isExpensive = path.isExpensive
        isConstrained = path.isConstrained

        Logger.info("""
        🌐 Network status updated:
        - Connected: \(isConnected)
        - Type: \(connectionType.displayName)
        - Expensive: \(isExpensive)
        - Constrained: \(isConstrained)
        """)
    }
}

// MARK: - Convenience Properties

extension NetworkMonitor {
    /// Whether current connection is suitable for large downloads
    var isSuitableForLargeDownloads: Bool {
        return isConnected && !isExpensive && !isConstrained
    }

    /// Whether current connection is good quality (WiFi/Ethernet)
    var isHighQualityConnection: Bool {
        return isConnected && (connectionType == .wifi || connectionType == .ethernet)
    }

    /// Whether should use aggressive caching
    var shouldUseAggressiveCaching: Bool {
        return !isConnected || isExpensive || isConstrained
    }
}
