import Foundation

/// Application Configuration
/// Central configuration for the FunnyPixels app
public struct AppConfig {
    // MARK: - Environment Configuration

    /// Current environment
    public enum Environment {
        case development
        case production

        /// Current active environment
        static var current: Environment {
            #if DEBUG
            return .development
            #else
            return .production
            #endif
        }
    }

    /// Development server IP (update this when your IP changes)
    /// 开发服务器 IP（当您的 IP 变更时修改此处）
    private static let developmentServerIP = "192.168.0.3"

    /// API Base URL
    public static var apiBaseURL: String {
        switch Environment.current {
        case .development:
            return "http://\(developmentServerIP):3001"
        case .production:
            return "https://api.funnypixels.com"
        }
    }

    /// WebSocket URL
    public static var webSocketURL: String {
        switch Environment.current {
        case .development:
            return "ws://\(developmentServerIP):3001"
        case .production:
            return "wss://api.funnypixels.com/ws"
        }
    }

    /// Map tile server URL
    public static let mapTileURL = "https://tiles.openfreemap.org/styles/liberty"

    /// Default map center coordinates (Guangzhou)
    public static let defaultMapCenter = (lat: 23.109722, lon: 113.324520)

    /// Default zoom level
    public static let defaultZoomLevel: Double = 12.0

    /// Minimum zoom level
    public static let minZoomLevel: Double = 3.0

    /// Maximum zoom level
    public static let maxZoomLevel: Double = 18.0

    /// Request timeout interval
    public static let requestTimeout: TimeInterval = 30.0

    /// WebSocket connection timeout
    public static let webSocketTimeout: TimeInterval = 10.0

    /// Cache size limit in bytes
    public static let cacheSizeLimit: Int = 100 * 1024 * 1024 // 100MB

    /// Cache count limit
    public static let cacheCountLimit: Int = 100

    /// Enable debug mode
    public static var isDebugMode: Bool {
        #if DEBUG
        return true
        #else
        return false
        #endif
    }

    /// App version
    public static let appVersion = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0.0"

    /// Build number
    public static let buildNumber = Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "1"
}
