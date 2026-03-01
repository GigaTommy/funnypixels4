import Foundation

/// Application Environment
/// Defines the current environment configuration
public enum AppEnvironment: String, CaseIterable {
    case development
    case staging
    case production

    /// Current environment
    public static var current: AppEnvironment {
        #if DEBUG
        return .development
        #else
        return .production
        #endif
    }

    // MARK: - Configuration Helpers

    /// Read configuration from Info.plist
    private static func getConfigValue(for key: String, defaultValue: String = "") -> String {
        guard let config = Bundle.main.infoDictionary?["AppConfiguration"] as? [String: Any],
              let value = config[key] as? String else {
            return defaultValue
        }
        return value
    }

    /// Development Server IP (from Info.plist)
    private static var devServerIP: String {
        getConfigValue(for: "DevelopmentServerIP", defaultValue: "192.168.1.5")
    }

    /// Development Server Port (from Info.plist)
    private static var devServerPort: String {
        getConfigValue(for: "DevelopmentServerPort", defaultValue: "3001")
    }

    // MARK: - Environment URLs

    /// API Base URL for the environment
    public var apiBaseURL: String {
        switch self {
        case .development:
            // 本地开发服务器 - 从 Info.plist 读取配置
            return "http://\(Self.devServerIP):\(Self.devServerPort)/api"
        case .staging:
            return "https://staging-api.funnypixels.com"
        case .production:
            return "https://api.funnypixels.com"
        }
    }

    /// WebSocket URL for the environment
    public var webSocketURL: String {
        switch self {
        case .development:
            // 本地开发服务器 - 从 Info.plist 读取配置
            return "ws://\(Self.devServerIP):\(Self.devServerPort)"
        case .staging:
            return "wss://staging-api.funnypixels.com/ws"
        case .production:
            return "wss://api.funnypixels.com/ws"
        }
    }

    /// WebSocket URL (alias for webSocketURL)
    public var wsURL: String {
        return webSocketURL
    }

    /// Whether debug logging is enabled
    public var isLoggingEnabled: Bool {
        switch self {
        case .development, .staging:
            return true
        case .production:
            return false
        }
    }

    /// Request timeout for the environment
    public var requestTimeout: TimeInterval {
        switch self {
        case .development:
            return 60.0
        case .staging:
            return 30.0
        case .production:
            return 30.0
        }
    }
}
