import Foundation

// MARK: - P0-1: Event Signup Statistics Models

/// 活动报名统计数据
struct EventSignupStats: Codable {
    let allianceCount: Int
    let userCount: Int
    let estimatedParticipants: Int
    let topAlliances: [AllianceSignupInfo]
    let requirementsMet: Bool

    enum CodingKeys: String, CodingKey {
        case allianceCount, userCount, estimatedParticipants, topAlliances, requirementsMet
    }
}

/// 联盟报名信息
struct AllianceSignupInfo: Codable, Identifiable {
    let id: String
    let name: String
    let memberCount: Int
    let power: Int

    enum CodingKeys: String, CodingKey {
        case id, name, memberCount, power
    }
}

/// 报名统计响应
struct SignupStatsResponse: Codable {
    let success: Bool
    let data: EventSignupStats
    let message: String?
}
