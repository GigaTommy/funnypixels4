import Foundation

/// 成就服务
/// 负责处理成就相关的API操作
class AchievementService {
    static let shared = AchievementService()

    private init() {}

    // MARK: - 数据模型

    /// 成就定义模型
    struct Achievement: Codable, Identifiable {
        let id: Int
        let key: String?
        let name: String
        let description: String
        let iconUrl: String?
        let rewardPoints: Int
        let type: String
        let requirement: Int?
        let repeatCycle: String?
        let category: String?
        let displayPriority: Int?
        let isActive: Bool
        let metadata: AchievementMetadata?
        let rewardItems: [RewardItem]?
        let rewardDetails: RewardDetails?
        let createdAt: String?
        let updatedAt: String?

        var displayName: String { name }
        
        var fullIconUrl: String? {
             guard let iconUrl = iconUrl else { return nil }
             if iconUrl.hasPrefix("http") {
                 return iconUrl
             }
             return "\(APIEndpoint.baseURL)\(iconUrl)"
        }

        private enum CodingKeys: String, CodingKey {
            case id, key, name, description, type, category, isActive
            case iconUrl = "icon_url"
            case rewardPoints = "reward_points"
            case requirement
            case repeatCycle = "repeat_cycle"
            case displayPriority = "display_priority"
            case metadata
            case rewardItems = "reward_items"
            case rewardDetails = "reward_details"
            case createdAt = "created_at"
            case updatedAt = "updated_at"
        }
    }

    /// 成就元数据
    struct AchievementMetadata: Codable {
        let progressUnit: String?
        let ctaLabel: String?
        let ctaLink: String?
        let rarity: String?

        private enum CodingKeys: String, CodingKey {
            case progressUnit = "progress_unit"
            case ctaLabel = "cta_label"
            case ctaLink = "cta_link"
            case rarity
        }
    }

    /// 奖励物品
    struct RewardItem: Codable {
        let itemId: String?
        let itemName: String?
        let quantity: Int?

        private enum CodingKeys: String, CodingKey {
            case itemId = "item_id"
            case itemName = "item_name"
            case quantity
        }
    }

    /// 奖励详情
    struct RewardDetails: Codable {
        let description: String?
        let title: String?
        let specialColor: String?

        private enum CodingKeys: String, CodingKey {
            case description, title
            case specialColor = "special_color"
        }
    }

    /// 用户成就进度模型
    struct UserAchievementProgress: Codable, Identifiable {
        let id: String
        let achievementId: Int
        let currentProgress: Int
        let targetProgress: Int
        let isCompleted: Bool
        let isClaimed: Bool
        let completedAt: String?
        let claimedAt: String?
        let createdAt: String
        let updatedAt: String

        var progressPercentage: Double {
            guard targetProgress > 0 else { return 0 }
            return min(Double(currentProgress) / Double(targetProgress), 1.0)
        }

        private enum CodingKeys: String, CodingKey {
            case id
            case achievementId = "achievement_id"
            case currentProgress = "current_progress"
            case targetProgress = "target_progress"
            case isCompleted = "is_completed"
            case isClaimed = "is_claimed"
            case completedAt = "completed_at"
            case claimedAt = "claimed_at"
            case createdAt = "created_at"
            case updatedAt = "updated_at"
        }
    }

    /// 用户成就统计模型
    struct UserAchievementStats: Codable {
        let totalPoints: Int
        let likeReceivedCount: Int
        let likeGivenCount: Int
        let pixelsDrawnCount: Int
        let daysActiveCount: Int
        let achievementsUnlocked: [Int]?
        let totalAchievements: Int?
        let completedCount: Int?
        let claimedCount: Int?

        private enum CodingKeys: String, CodingKey {
            case totalPoints = "total_points"
            case likeReceivedCount = "like_received_count"
            case likeGivenCount = "like_given_count"
            case pixelsDrawnCount = "pixels_drawn_count"
            case daysActiveCount = "days_active_count"
            case achievementsUnlocked = "achievements_unlocked"
            case totalAchievements = "total_achievements"
            case completedCount = "completed_count"
            case claimedCount = "claimed_count"
        }
    }

    /// 用户成就详情模型（包含进度信息）
    struct UserAchievement: Codable, Identifiable {
        let id: Int
        let name: String
        let description: String
        let iconUrl: String?
        let rewardPoints: Int
        let category: String?
        let type: String
        let requirement: Int?
        let metadata: AchievementMetadata?
        let currentProgress: Int
        let targetProgress: Int
        let isCompleted: Bool
        let isClaimed: Bool
        let completedAt: String?
        let claimedAt: String?

        var progressPercentage: Double {
            guard targetProgress > 0 else { return 0 }
            return min(Double(currentProgress) / Double(targetProgress), 1.0)
        }

        private enum CodingKeys: String, CodingKey {
            case id, name, description, category, type, requirement, metadata
            case iconUrl = "icon_url"
            case rewardPoints = "reward_points"
            case currentProgress = "current_progress"
            case targetProgress = "target_progress"
            case isCompleted = "is_completed"
            case isClaimed = "is_claimed"
            case completedAt = "completed_at"
            case claimedAt = "claimed_at"
        }
    }

    /// 成就排行榜条目
    struct AchievementLeaderboardEntry: Codable, Identifiable {
        let userId: String
        let username: String
        let avatarUrl: String?
        let score: Int
        let rank: Int

        var id: String { userId }

        private enum CodingKeys: String, CodingKey {
            case userId = "user_id"
            case username
            case avatarUrl = "avatar_url"
            case score, rank
        }
    }

    /// 领取奖励响应
    struct ClaimRewardResponse: Codable {
        let success: Bool?
        let message: String
        let reward: ClaimedReward?
        let pointsAwarded: Int?

        struct ClaimedReward: Codable {
            let points: Int
            let items: [RewardItem]?
        }
    }

    /// 成就概览响应
    struct AchievementOverview: Codable {
        let stats: UserAchievementStats
        let totalAchievements: Int
        let recentAchievements: [RecentAchievement]?

        struct RecentAchievement: Codable {
            let id: Int
            let name: String
            let unlockedAt: String

            private enum CodingKeys: String, CodingKey {
                case id, name
                case unlockedAt = "unlocked_at"
            }
        }
    }

    // MARK: - API方法

    /// 获取所有成就定义
    func getAllAchievements(category: String? = nil) async throws -> [Achievement] {
        var path = "/currency/achievements"
        if let category = category {
            path += "?category=\(category)"
        }

        let response: AchievementsResponse = try await APIManager.shared.get(path)

        guard response.success ?? true else {
            throw NetworkError.serverError(NSLocalizedString("error.achievement_list_failed", comment: "Fetch achievements failed"))
        }

        return response.data ?? []
    }

    /// 获取用户成就列表（含进度）
    func getUserAchievements() async throws -> [UserAchievement] {
        let path = "/currency/achievements/user"

        let response: UserAchievementsResponse = try await APIManager.shared.get(path)

        guard response.success ?? true else {
            throw NetworkError.serverError(NSLocalizedString("error.user_achievement_failed", comment: "Fetch user achievements failed"))
        }

        return response.data ?? []
    }

    /// 获取用户已完成成就
    func getCompletedAchievements() async throws -> [UserAchievement] {
        let path = "/currency/achievements/completed"

        let response: UserAchievementsResponse = try await APIManager.shared.get(path)

        guard response.success ?? true else {
            throw NetworkError.serverError(NSLocalizedString("error.completed_achievement_failed", comment: "Fetch completed achievements failed"))
        }

        return response.data ?? []
    }

    /// 获取用户成就统计
    func getUserAchievementStats() async throws -> UserAchievementStats {
        let path = "/currency/achievements/stats"

        let response: AchievementStatsResponse = try await APIManager.shared.get(path)

        guard response.success ?? true, let stats = response.data else {
            throw NetworkError.serverError(NSLocalizedString("error.achievement_stats_failed", comment: "Fetch stats failed"))
        }

        return stats
    }

    /// 获取用户成就推荐/亮点
    func getUserAchievementHighlights() async throws -> [UserAchievement] {
        let path = "/currency/achievements/highlights"

        let response: UserAchievementsResponse = try await APIManager.shared.get(path)

        guard response.success ?? true else {
            throw NetworkError.serverError(NSLocalizedString("error.achievement_highlights_failed", comment: "Fetch highlights failed"))
        }

        return response.data ?? []
    }

    /// 领取成就奖励
    func claimAchievementReward(achievementId: Int) async throws -> (points: Int, items: [RewardItem]?) {
        let path = "/currency/achievements/\(achievementId)/claim"

        let response: ClaimRewardResponse = try await APIManager.shared.post(path, parameters: [:])

        guard response.success ?? true, let reward = response.reward else {
            throw NetworkError.serverError(response.message)
        }

        return (reward.points, reward.items)
    }

    /// 获取成就排行榜
    func getAchievementLeaderboard(type: String = "like_received_count", limit: Int = 50) async throws -> [AchievementLeaderboardEntry] {
        var path = "/achievements/leaderboard?type=\(type)&limit=\(limit)"
        path = path.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? path

        let response: LeaderboardResponse = try await APIManager.shared.get(path)

        guard response.success ?? true else {
            throw NetworkError.serverError(NSLocalizedString("error.leaderboard_failed", comment: "Fetch leaderboard failed"))
        }

        return response.data ?? []
    }

    /// 获取用户排名
    func getUserRank(type: String = "like_received_count") async throws -> Int {
        let path = "/achievements/my/rank?type=\(type)"

        let response: UserRankResponse = try await APIManager.shared.get(path)

        guard response.success ?? true, let data = response.data else {
            throw NetworkError.serverError(NSLocalizedString("error.rank_failed", comment: "Fetch rank failed"))
        }

        return data.rank
    }

    /// 手动触发成就检查
    func checkAchievements() async throws -> (newCount: Int, achievements: [Achievement]) {
        let path = "/currency/achievements/my/check"

        let response: CheckAchievementsResponse = try await APIManager.shared.post(path, parameters: [:])

        guard response.success ?? true else {
            throw NetworkError.serverError(NSLocalizedString("error.check_achievement_failed", comment: "Check achievement failed"))
        }

        return (response.data?.newAchievements ?? 0, response.data?.achievements ?? [])
    }

    /// 检查成就并发送通知（如果有新解锁）
    func checkAndNotify() async {
        do {
            let (newCount, achievements) = try await checkAchievements()
            if newCount > 0, let first = achievements.first {
                Logger.info("🏆 解锁了 \(newCount) 个新成就，发送通知: \(first.name)")
                await MainActor.run {
                    NotificationCenter.default.post(
                        name: .achievementUnlocked,
                        object: first
                    )
                }
            }
        } catch {
            Logger.warning("Achievement check failed: \(error)")
        }
    }

    // MARK: - 辅助响应类型

    private struct AchievementsResponse: Codable {
        let success: Bool?
        let data: [Achievement]?
    }

    private struct UserAchievementsResponse: Codable {
        let success: Bool?
        let data: [UserAchievement]?
    }

    private struct AchievementStatsResponse: Codable {
        let success: Bool?
        let data: UserAchievementStats?
    }

    private struct LeaderboardResponse: Codable {
        let success: Bool?
        let data: [AchievementLeaderboardEntry]?
    }

    private struct UserRankResponse: Codable {
        let success: Bool?
        let data: UserRankData?

        struct UserRankData: Codable {
            let rank: Int
        }
    }

    private struct CheckAchievementsResponse: Codable {
        let success: Bool?
        let message: String?
        let data: CheckAchievementsData?

        struct CheckAchievementsData: Codable {
            let newAchievements: Int
            let achievements: [Achievement]

            private enum CodingKeys: String, CodingKey {
                case newAchievements = "newAchievements"
                case achievements
            }
        }
    }
}

// MARK: - 成就分类扩展

extension AchievementService {
    enum AchievementCategory: String, CaseIterable {
        case all = "all"
        case pixel = "pixel"
        case social = "social"
        case alliance = "alliance"
        case shop = "shop"
        case special = "special"

        var displayName: String {
            switch self {
            case .all: return NSLocalizedString("category.all", comment: "All")
            case .pixel: return NSLocalizedString("category.pixel", comment: "Pixel")
            case .social: return NSLocalizedString("category.social", comment: "Social")
            case .alliance: return NSLocalizedString("category.alliance", comment: "Alliance")
            case .shop: return NSLocalizedString("category.shop", comment: "Shop")
            case .special: return NSLocalizedString("category.special", comment: "Special")
            }
        }

        var icon: String {
            switch self {
            case .all: return "IconAchievementPixels"  // 使用默认图标
            case .pixel: return "IconAchievementPixels"
            case .social: return "IconAchievementSocial"
            case .alliance: return "IconAchievementAlliance"
            case .shop: return "IconAchievementShop"
            case .special: return "IconAchievementSpecial"
            }
        }
    }

    enum Rarity: String {
        case common = "common"
        case uncommon = "uncommon"
        case rare = "rare"
        case epic = "epic"
        case legendary = "legendary"

        var displayName: String {
            switch self {
            case .common: return NSLocalizedString("rarity.common", comment: "Common")
            case .uncommon: return NSLocalizedString("rarity.uncommon", comment: "Uncommon")
            case .rare: return NSLocalizedString("rarity.rare", comment: "Rare")
            case .epic: return NSLocalizedString("rarity.epic", comment: "Epic")
            case .legendary: return NSLocalizedString("rarity.legendary", comment: "Legendary")
            }
        }

        var color: Color {
            switch self {
            case .common: return .gray
            case .uncommon: return .green
            case .rare: return .blue
            case .epic: return .purple
            case .legendary: return .orange
            }
        }
    }
}

// Import SwiftUI for Color
import SwiftUI
