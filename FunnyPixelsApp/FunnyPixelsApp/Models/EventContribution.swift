import Foundation

// MARK: - P0-3: Event Contribution Models

/// 个人活动贡献数据
struct EventContribution: Codable {
    let pixelCount: Int
    let alliance: ContributionAlliance?
    let contributionRate: Double
    let rankInAlliance: Int?
    let topContributors: [ContributorInfo]
    let milestones: MilestoneProgress

    enum CodingKeys: String, CodingKey {
        case pixelCount, alliance, contributionRate, rankInAlliance, topContributors, milestones
    }
}

/// 联盟贡献信息
struct ContributionAlliance: Codable {
    let id: String
    let name: String
    let totalPixels: Int

    enum CodingKeys: String, CodingKey {
        case id, name, totalPixels
    }

    init(id: String, name: String, totalPixels: Int) {
        self.id = id
        self.name = name
        self.totalPixels = totalPixels
    }
}

/// 贡献者信息
struct ContributorInfo: Codable, Identifiable {
    let id: String
    let username: String
    let pixelCount: Int
    let contributionRate: Double

    enum CodingKeys: String, CodingKey {
        case id, username, pixelCount, contributionRate
    }
}

/// 里程碑进度
struct MilestoneProgress: Codable {
    let current: Int // 当前像素数
    let next: Int // 下一个里程碑目标
    let achieved: [Int] // 已达成的里程碑
    let progress: Double // 到下一个里程碑的进度 (0-1)

    enum CodingKeys: String, CodingKey {
        case current, next, achieved, progress
    }
}

/// 贡献统计响应
struct ContributionResponse: Codable {
    let success: Bool
    let data: EventContribution
    let message: String?
}
