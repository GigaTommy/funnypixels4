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

    /// API Base URL for the environment
    public var apiBaseURL: String {
        switch self {
        case .development:
            return "https://dev-api.funnypixels.com"
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
            return "wss://dev-api.funnypixels.com/ws"
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
