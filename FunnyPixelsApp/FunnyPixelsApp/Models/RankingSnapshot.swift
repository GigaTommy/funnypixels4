import Foundation

/// P1-4: Ranking Snapshot for Trend Analysis
/// Historical ranking data at a specific point in time
struct RankingSnapshot: Codable, Identifiable {
    let id: UUID = UUID()
    let timestamp: Date
    let totalPixels: Int
    let rankings: [RankingEntry]

    enum CodingKeys: String, CodingKey {
        case timestamp
        case totalPixels = "total_pixels"
        case rankings
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)

        // Parse timestamp (ISO8601 or custom format)
        let timestampString = try container.decode(String.self, forKey: .timestamp)
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]

        if let date = formatter.date(from: timestampString) {
            timestamp = date
        } else {
            // Fallback to standard ISO8601
            formatter.formatOptions = [.withInternetDateTime]
            timestamp = formatter.date(from: timestampString) ?? Date()
        }

        totalPixels = try container.decode(Int.self, forKey: .totalPixels)
        rankings = try container.decode([RankingEntry].self, forKey: .rankings)
    }
}

/// Single ranking entry in a snapshot
struct RankingEntry: Codable, Identifiable {
    let userId: String
    let username: String
    let pixels: Int
    let rank: Int

    var id: String { userId }

    enum CodingKeys: String, CodingKey {
        case userId = "user_id"
        case username
        case pixels
        case rank
    }
}

/// Response from GET /api/events/:id/ranking-history
struct RankingHistoryResponse: Codable {
    let success: Bool
    let data: RankingHistoryData
}

struct RankingHistoryData: Codable {
    let eventId: String
    let hours: Int
    let snapshots: Int
    let history: [RankingSnapshot]

    enum CodingKeys: String, CodingKey {
        case eventId = "event_id"
        case hours
        case snapshots
        case history
    }
}
