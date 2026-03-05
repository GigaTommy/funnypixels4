import Foundation

// MARK: - World State Event Models

struct WorldStateEvent: Codable, Identifiable, Equatable {
    let id: String
    let eventType: EventType
    let title: String
    let description: String
    let metadata: EventMetadata
    let actionButtons: [EventActionButton]
    let createdAt: String
    let priority: Int

    // Equatable实现 - 优化ForEach性能
    static func == (lhs: WorldStateEvent, rhs: WorldStateEvent) -> Bool {
        lhs.id == rhs.id &&
        lhs.eventType == rhs.eventType &&
        lhs.title == rhs.title &&
        lhs.createdAt == rhs.createdAt
    }

    enum CodingKeys: String, CodingKey {
        case id
        case eventType = "event_type"
        case title
        case description
        case metadata
        case actionButtons = "action_buttons"
        case createdAt = "created_at"
        case priority
    }

    enum EventType: String, Codable {
        case milestoneReached = "milestone_reached"
        case artworkCompleted = "artwork_completed"
        case territoryChanged = "territory_changed"
        case eventProgress = "event_progress"
        case officialAnnouncement = "official_announcement"
    }
}

struct EventMetadata: Codable, Equatable {
    let userId: String?
    let userName: String?
    let avatarUrl: String?
    let avatar: String?
    let milestoneValue: Int?
    let pixelCount: Int?
    let sessionId: String?
    let location: EventLocationInfo?
    let allianceId: String?
    let allianceName: String?
    let previousAllianceName: String?
    let territoryName: String?
    let eventId: String?
    let eventTitle: String?
    let participantCount: Int?
    let announcementType: String?

    enum CodingKeys: String, CodingKey {
        case userId = "user_id"
        case userName = "user_name"
        case avatarUrl = "avatar_url"
        case avatar
        case milestoneValue = "milestone_value"
        case pixelCount = "pixel_count"
        case sessionId = "session_id"
        case location
        case allianceId = "alliance_id"
        case allianceName = "alliance_name"
        case previousAllianceName = "previous_alliance_name"
        case territoryName = "territory_name"
        case eventId = "event_id"
        case eventTitle = "event_title"
        case participantCount = "participant_count"
        case announcementType = "announcement_type"
    }
}

struct EventLocationInfo: Codable, Equatable {
    let name: String
    let lat: Double?
    let lng: Double?
}

struct EventActionButton: Codable, Equatable {
    let label: String
    let actionType: EventActionType
    let targetId: String?

    enum CodingKeys: String, CodingKey {
        case label
        case actionType = "action_type"
        case targetId = "target_id"
    }
}

enum EventActionType: String, Codable {
    case viewProfile = "view_profile"
    case viewSession = "view_session"
    case navigateMap = "navigate_map"
    case viewAlliance = "view_alliance"
    case viewEvent = "view_event"
    case viewAnnouncement = "view_announcement"
}

// MARK: - API Response

struct WorldStateFeedResponse: Codable {
    let success: Bool
    let data: WorldStateFeedData?
}

struct WorldStateFeedData: Codable {
    let events: [WorldStateEvent]
    let hasMore: Bool

    enum CodingKeys: String, CodingKey {
        case events
        case hasMore = "hasMore"
    }
}
