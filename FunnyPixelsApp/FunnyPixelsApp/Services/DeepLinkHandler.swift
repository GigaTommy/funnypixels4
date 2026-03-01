import Foundation
import Combine
import CoreLocation

/// Handles parsing and routing of deep links (URL scheme + universal links)
class DeepLinkHandler: ObservableObject {
    static let shared = DeepLinkHandler()

    /// Navigation intent emitted when a deep link is parsed
    enum DeepLinkDestination: Equatable {
        case allianceInvite(code: String)
        case eventDetail(eventId: String)
        case userProfile(userId: String)
        case mapLocation(lat: Double, lng: Double)
        case checkin
        case leaderboard
        case tab(index: Int)

        static func == (lhs: DeepLinkDestination, rhs: DeepLinkDestination) -> Bool {
            switch (lhs, rhs) {
            case (.allianceInvite(let a), .allianceInvite(let b)): return a == b
            case (.eventDetail(let a), .eventDetail(let b)): return a == b
            case (.userProfile(let a), .userProfile(let b)): return a == b
            case (.mapLocation(let lat1, let lng1), .mapLocation(let lat2, let lng2)): return lat1 == lat2 && lng1 == lng2
            case (.checkin, .checkin): return true
            case (.leaderboard, .leaderboard): return true
            case (.tab(let a), .tab(let b)): return a == b
            default: return false
            }
        }
    }

    @Published var pendingDestination: DeepLinkDestination?

    private init() {}

    // MARK: - URL Handling

    /// Parse any incoming URL (both URL scheme and universal link)
    func handleURL(_ url: URL) {
        Logger.info("DeepLink: handling URL \(url.absoluteString)")

        if url.scheme == "funnypixels" {
            handleCustomScheme(url)
        } else if url.host?.contains("funnypixels.com") == true {
            handleUniversalLink(url)
        } else {
            Logger.info("DeepLink: unrecognized URL scheme \(url.scheme ?? "nil")")
        }
    }

    // MARK: - Custom URL Scheme (funnypixels://)

    private func handleCustomScheme(_ url: URL) {
        let host = url.host ?? ""
        let pathComponents = url.pathComponents.filter { $0 != "/" }

        switch host {
        case "alliance":
            if pathComponents.first == "invite", let code = pathComponents.dropFirst().first {
                setDestination(.allianceInvite(code: String(code)))
            } else if let code = url.queryValue(for: "code") {
                setDestination(.allianceInvite(code: code))
            }

        case "event":
            if let eventId = pathComponents.first {
                setDestination(.eventDetail(eventId: eventId))
            }

        case "profile":
            if let userId = pathComponents.first {
                setDestination(.userProfile(userId: userId))
            }

        case "map":
            if let lat = url.queryDouble(for: "lat"), let lng = url.queryDouble(for: "lng") {
                setDestination(.mapLocation(lat: lat, lng: lng))
            }

        case "checkin":
            setDestination(.checkin)

        case "leaderboard":
            setDestination(.leaderboard)

        case "invite":
            if let code = pathComponents.first {
                setDestination(.allianceInvite(code: code))
            }

        default:
            Logger.info("DeepLink: unknown custom scheme host: \(host)")
        }
    }

    // MARK: - Universal Links (https://funnypixels.com/link/...)

    private func handleUniversalLink(_ url: URL) {
        let pathComponents = url.pathComponents.filter { $0 != "/" }

        // Expect paths like /link/alliance/invite/{code}, /link/event/{id}, etc.
        guard pathComponents.first == "link" else {
            Logger.info("DeepLink: universal link missing /link/ prefix")
            return
        }

        let subComponents = Array(pathComponents.dropFirst())

        guard let section = subComponents.first else { return }

        switch section {
        case "alliance":
            if subComponents.count >= 3, subComponents[1] == "invite" {
                setDestination(.allianceInvite(code: subComponents[2]))
            }

        case "event":
            if subComponents.count >= 2 {
                setDestination(.eventDetail(eventId: subComponents[1]))
            }

        case "profile":
            if subComponents.count >= 2 {
                setDestination(.userProfile(userId: subComponents[1]))
            }

        case "map":
            if let lat = url.queryDouble(for: "lat"), let lng = url.queryDouble(for: "lng") {
                setDestination(.mapLocation(lat: lat, lng: lng))
            }

        case "checkin":
            setDestination(.checkin)

        case "invite":
            if subComponents.count >= 2 {
                setDestination(.allianceInvite(code: subComponents[1]))
            }

        default:
            Logger.info("DeepLink: unknown universal link section: \(section)")
        }
    }

    // MARK: - Helpers

    private func setDestination(_ destination: DeepLinkDestination) {
        Logger.info("DeepLink: navigating to \(destination)")
        DispatchQueue.main.async {
            self.pendingDestination = destination
        }
    }

    /// Clear the pending destination after navigation is handled
    func clearDestination() {
        pendingDestination = nil
    }
}

// MARK: - Notification Names for Deep Link Routing

extension Notification.Name {
    static let deepLinkAllianceInvite = Notification.Name("deepLinkAllianceInvite")
    static let deepLinkUserProfile = Notification.Name("deepLinkUserProfile")
}

// MARK: - URL Query Helpers

private extension URL {
    func queryValue(for key: String) -> String? {
        URLComponents(url: self, resolvingAgainstBaseURL: false)?
            .queryItems?
            .first(where: { $0.name == key })?
            .value
    }

    func queryDouble(for key: String) -> Double? {
        guard let value = queryValue(for: key) else { return nil }
        return Double(value)
    }
}
