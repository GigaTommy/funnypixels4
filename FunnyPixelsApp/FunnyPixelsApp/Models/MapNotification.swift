import Foundation
import SwiftUI

/// Map notification types for activity banner
enum MapNotificationType: String, Codable {
    case regionChallenge = "region_challenge"
    case allianceWar = "alliance_war"
    case treasureRefresh = "treasure_refresh"
    case seasonReminder = "season_reminder"
    case systemAnnouncement = "system_announcement"

    var iconName: String {
        switch self {
        case .regionChallenge: return "flag.fill"
        case .allianceWar: return "shield.fill"
        case .treasureRefresh: return "gift.fill"
        case .seasonReminder: return "calendar"
        case .systemAnnouncement: return "megaphone.fill"
        }
    }

    var gradientColors: [Color] {
        switch self {
        case .regionChallenge:
            return [Color(hex: "FF6B6B") ?? .red, Color(hex: "FFB347") ?? .orange] // Orange-Red
        case .allianceWar:
            return [Color(hex: "FF0066") ?? .red, Color(hex: "9933FF") ?? .purple] // Red-Purple
        case .treasureRefresh:
            return [Color(hex: "4A90E2") ?? .blue, Color(hex: "50C9C3") ?? .cyan] // Blue-Cyan
        case .seasonReminder:
            return [Color(hex: "9933FF") ?? .purple, Color(hex: "FF66CC") ?? .pink] // Purple-Pink
        case .systemAnnouncement:
            return [Color(hex: "666666") ?? .gray, Color(hex: "999999") ?? .gray] // Gray
        }
    }
}

/// Map notification model
struct MapNotification: Identifiable, Codable {
    let id: Int
    let type: MapNotificationType
    let title: String
    let message: String
    let priority: Int
    let remainingSeconds: Int?
    let targetLocation: Location?

    enum CodingKeys: String, CodingKey {
        case id, type, title, message, priority
        case remainingSeconds = "remaining_seconds"
        case targetLocation = "target_location"
    }

    struct Location: Codable {
        let lat: Double
        let lng: Double
    }

    var formattedTime: String? {
        guard let seconds = remainingSeconds, seconds > 0 else { return nil }

        let hours = seconds / 3600
        let minutes = (seconds % 3600) / 60
        let secs = seconds % 60

        if hours > 0 {
            return String(format: "%02d:%02d:%02d", hours, minutes, secs)
        } else {
            return String(format: "%02d:%02d", minutes, secs)
        }
    }
}

/// Response wrapper for notifications API
struct MapNotificationsResponse: Codable {
    let success: Bool
    let data: NotificationData

    struct NotificationData: Codable {
        let notifications: [MapNotification]
    }
}

