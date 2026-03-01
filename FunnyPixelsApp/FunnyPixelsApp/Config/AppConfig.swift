import Foundation

/// Application Configuration
/// Central configuration for the FunnyPixels app
public struct AppConfig {
    // MARK: - Configuration from Info.plist

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
        getConfigValue(for: "DevelopmentServerIP", defaultValue: "192.168.0.3")
    }

    /// Development Server Port (from Info.plist)
    private static var devServerPort: String {
        getConfigValue(for: "DevelopmentServerPort", defaultValue: "3001")
    }

    /// Development Frontend Port (from Info.plist)
    private static var devFrontendPort: String {
        getConfigValue(for: "DevelopmentFrontendPort", defaultValue: "3000")
    }

    /// Production API URL (from Info.plist)
    private static var prodAPIURL: String {
        getConfigValue(for: "ProductionAPIURL", defaultValue: "https://api.funnypixels.com")
    }

    /// Production Web URL (from Info.plist)
    private static var prodWebURL: String {
        getConfigValue(for: "ProductionWebURL", defaultValue: "https://funnypixels.com")
    }

    // MARK: - Public URLs

    /// Server Base URL (without /api suffix)
    /// 用于访问静态资源（uploads、materials等）
    public static var serverBaseURL: String {
        isDebugMode ? "http://\(devServerIP):\(devServerPort)" : prodAPIURL
    }

    /// API Base URL (with /api suffix)
    /// 用于API请求
    public static var apiBaseURL: String {
        isDebugMode ? "http://\(devServerIP):\(devServerPort)/api" : "\(prodAPIURL)/api"
    }

    /// WebSocket URL
    public static var webSocketURL: String {
        isDebugMode ? "ws://\(devServerIP):\(devServerPort)" : "wss://\(prodAPIURL.replacingOccurrences(of: "https://", with: ""))/ws"
    }

    /// Web Base URL (for user agreement, privacy policy, etc.)
    public static var webBaseURL: String {
        isDebugMode ? "http://\(devServerIP):\(devFrontendPort)" : prodWebURL
    }

    /// Current language code for API requests (maps device locale to supported backend languages)
    private static var currentLanguageCode: String {
        let languageCode: String
        if #available(iOS 16, *) {
            languageCode = Locale.current.language.languageCode?.identifier ?? "en"
        } else {
            languageCode = Locale.current.languageCode ?? "en"
        }
        // Map device locale to backend supported language codes
        switch languageCode {
        case "zh": return "zh-Hans"
        case "ja": return "ja"
        case "ko": return "ko"
        case "es": return "es"
        case "pt": return "pt-BR"
        default: return "en"
        }
    }

    /// User Agreement URL
    public static var userAgreementURL: String {
        "\(apiBaseURL)/system-config/public/user-agreement?lang=\(currentLanguageCode)"
    }

    /// Privacy Policy URL
    public static var privacyPolicyURL: String {
        "\(apiBaseURL)/system-config/public/privacy-policy?lang=\(currentLanguageCode)"
    }

    /// Map tile server URL (Primary)
    public static let mapTileURL = "https://tiles.openfreemap.org/styles/liberty"

    /// Map tile server URL (Fallback)
    public static let fallbackMapTileURL = "https://demotiles.maplibre.org/style.json"

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

    // MARK: - Nonisolated Accessors (for use in actor-isolated contexts)

    /// Get app version in a nonisolated context
    /// Use this from actor-isolated code to avoid main actor isolation issues
    public nonisolated static func getAppVersion() -> String {
        let version = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String
        return version ?? "1.0.0"
    }

    /// Get build number in a nonisolated context
    /// Use this from actor-isolated code to avoid main actor isolation issues
    public nonisolated static func getBuildNumber() -> String {
        let build = Bundle.main.infoDictionary?["CFBundleVersion"] as? String
        return build ?? "1"
    }

    /// Get WebSocket URL in a nonisolated context
    /// Use this from actor-isolated code to avoid main actor isolation issues
    public nonisolated static func getWebSocketURL() -> String {
        // Read from Info.plist in a nonisolated context
        guard let config = Bundle.main.infoDictionary?["AppConfiguration"] as? [String: Any] else {
            #if DEBUG
            return "ws://192.168.0.3:3001"
            #else
            return "wss://api.funnypixels.com/ws"
            #endif
        }

        let devIP = config["DevelopmentServerIP"] as? String ?? "192.168.0.3"
        let devPort = config["DevelopmentServerPort"] as? String ?? "3001"
        let prodURL = config["ProductionAPIURL"] as? String ?? "https://api.funnypixels.com"

        #if DEBUG
        return "ws://\(devIP):\(devPort)"
        #else
        return "wss://\(prodURL.replacingOccurrences(of: "https://", with: ""))/ws"
        #endif
    }

    /// App version (convenience property for non-actor contexts)
    public static var appVersion: String {
        getAppVersion()
    }

    /// Build number (convenience property for non-actor contexts)
    public static var buildNumber: String {
        getBuildNumber()
    }
}
