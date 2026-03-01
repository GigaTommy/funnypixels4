import Foundation

// MARK: - Leaderboard Entry Models

/// 排行榜条目基础协议
protocol LeaderboardEntry: Codable, Identifiable {
    var id: String { get }
    var rank: Int { get }
    var previousRank: Int? { get }
    var periodPixels: Int { get }
    var totalPixels: Int { get }
    var currentPixels: Int { get }
}

/// 用户排行榜条目
struct PersonalLeaderboardEntry: LeaderboardEntry {
    let id: String
    let username: String
    let displayName: String?
    let avatar: String?
    let rank: Int
    let previousRank: Int?
    let periodPixels: Int
    let totalPixels: Int
    let currentPixels: Int
    let level: Int
    let allianceName: String?
    let isCurrentUser: Bool
    let isOnline: Bool
    let likedByUser: Bool?
    let likeCount: Int?
    let lastActive: String?

    enum CodingKeys: String, CodingKey {
        case id, username, displayName, avatar, rank
        case previousRank = "previous_rank"
        case periodPixels = "period_pixels"
        case totalPixels = "total_pixels"
        case currentPixels = "current_pixels"
        case level, allianceName
        case isCurrentUser = "is_current_user"
        case isOnline = "is_online"
        case likedByUser = "liked_by_user"
        case likeCount = "like_count"
        case lastActive = "last_active"
    }

    /// 计算属性：显示名称
    var displayOrUsername: String {
        return displayName ?? username
    }

    /// 计算属性：排名变化
    var rankChange: RankChange {
        guard let previousRank = previousRank else {
            return .new
        }

        if previousRank > rank {
            return .up
        } else if previousRank < rank {
            return .down
        } else {
            return .same
        }
    }

    /// 计算属性：排名变化值
    var rankChangeValue: Int {
        guard let previousRank = previousRank else {
            return 0
        }
        return previousRank - rank
    }
}

/// 联盟排行榜条目
struct AllianceLeaderboardEntry: LeaderboardEntry {
    let id: String
    let name: String
    let description: String?
    let flagColor: String?
    let flagPattern: String?
    let bannerUrl: String?
    let rank: Int
    let previousRank: Int?
    let periodPixels: Int
    let totalPixels: Int
    let currentPixels: Int
    let memberCount: Int
    let leaderName: String?
    let isUserAlliance: Bool
    let likedByUser: Bool?
    let likeCount: Int?
    let createdAt: String?

    enum CodingKeys: String, CodingKey {
        case id, name, description, rank
        case flagColor = "flag_color"
        case flagPattern = "flag_pattern"
        case bannerUrl = "banner_url"
        case previousRank = "previous_rank"
        case periodPixels = "period_pixels"
        case totalPixels = "total_pixels"
        case currentPixels = "current_pixels"
        case memberCount = "member_count"
        case leaderName = "leader_name"
        case isUserAlliance = "is_user_alliance"
        case likedByUser = "liked_by_user"
        case likeCount = "like_count"
        case createdAt = "created_at"
    }

    /// 计算属性：排名变化
    var rankChange: RankChange {
        guard let previousRank = previousRank else {
            return .new
        }

        if previousRank > rank {
            return .up
        } else if previousRank < rank {
            return .down
        } else {
            return .same
        }
    }

    /// 计算属性：排名变化值
    var rankChangeValue: Int {
        guard let previousRank = previousRank else {
            return 0
        }
        return previousRank - rank
    }

    /// 计算属性：平均贡献
    var averageContribution: Double {
        guard memberCount > 0 else { return 0 }
        return Double(periodPixels) / Double(memberCount)
    }
}

/// 地区排行榜条目
struct RegionLeaderboardEntry: LeaderboardEntry {
    let id: String
    let regionCode: String
    let regionName: String
    let regionType: RegionType
    let level: String
    let rank: Int
    let previousRank: Int?
    let periodPixels: Int
    let totalPixels: Int
    let currentPixels: Int
    let userCount: Int
    let allianceCount: Int
    let likedByUser: Bool?
    let likeCount: Int?

    enum CodingKeys: String, CodingKey {
        case id, rank
        case regionCode = "region_code"
        case regionName = "region_name"
        case regionType = "region_type"
        case level, userCount, allianceCount
        case previousRank = "previous_rank"
        case periodPixels = "period_pixels"
        case totalPixels = "total_pixels"
        case currentPixels = "current_pixels"
        case likedByUser = "liked_by_user"
        case likeCount = "like_count"
    }

    /// 计算属性：排名变化
    var rankChange: RankChange {
        guard let previousRank = previousRank else {
            return .new
        }

        if previousRank > rank {
            return .up
        } else if previousRank < rank {
            return .down
        } else {
            return .same
        }
    }

    /// 计算属性：排名变化值
    var rankChangeValue: Int {
        guard let previousRank = previousRank else {
            return 0
        }
        return previousRank - rank
    }

    /// 计算属性：人均像素
    var averagePixelsPerUser: Double {
        guard userCount > 0 else { return 0 }
        return Double(periodPixels) / Double(userCount)
    }
}

// MARK: - Enums

/// 排行榜类型
enum LeaderboardType: String, Codable, CaseIterable {
    case personal = "personal"
    case alliance = "alliance"
    case region = "region"
    case province = "province"
    case city = "city"
    case country = "country"

    var displayName: String {
        switch self {
        case .personal: return "个人排行"
        case .alliance: return "联盟排行"
        case .region: return "地区排行"
        case .province: return "省份排行"
        case .city: return "城市排行"
        case .country: return "国家排行"
        }
    }

    var icon: String {
        switch self {
        case .personal: return "person.fill"
        case .alliance: return "flag.fill"
        case .region: return "map.fill"
        case .province: return "location.fill"
        case .city: return "building.2.fill"
        case .country: return "globe.americas.fill"
        }
    }

    var isGeographic: Bool {
        switch self {
        case .region, .province, .city, .country:
            return true
        case .personal, .alliance:
            return false
        }
    }
}

/// 时间周期
enum LeaderboardPeriod: String, Codable, CaseIterable {
    case daily = "daily"
    case weekly = "weekly"
    case monthly = "monthly"
    case yearly = "yearly"
    case allTime = "allTime"

    var displayName: String {
        switch self {
        case .daily: return "日榜"
        case .weekly: return "周榜"
        case .monthly: return "月榜"
        case .yearly: return "年榜"
        case .allTime: return "总榜"
        }
    }

    var icon: String {
        switch self {
        case .daily: return "sun.max.fill"
        case .weekly: return "calendar.badge.clock"
        case .monthly: return "calendar.badge.plus"
        case .yearly: return "calendar.badge.gearshape"
        case .allTime: return "clock.arrow.circlepath"
        }
    }
}

/// 地区类型
enum RegionType: String, Codable, CaseIterable {
    case country = "country"
    case province = "province"
    case city = "city"
    case district = "district"

    var displayName: String {
        switch self {
        case .country: return "国家"
        case .province: return "省份"
        case .city: return "城市"
        case .district: return "区县"
        }
    }

    var icon: String {
        switch self {
        case .country: return "globe.americas.fill"
        case .province: return "location.fill"
        case .city: return "building.2.fill"
        case .district: return "location.circle.fill"
        }
    }
}

/// 排名变化
enum RankChange: Codable {
    case up
    case down
    case same
    case new

    var icon: String {
        switch self {
        case .up: return "arrow.up"
        case .down: return "arrow.down"
        case .same: return "minus"
        case .new: return "star.fill"
        }
    }

    var color: String {
        switch self {
        case .up: return "#10B981" // 绿色
        case .down: return "#EF4444" // 红色
        case .same: return "#6B7280" // 灰色
        case .new: return "#3B82F6" // 蓝色
        }
    }

    var displayText: String {
        switch self {
        case .up: return "上升"
        case .down: return "下降"
        case .same: return "持平"
        case .new: return "新上榜"
        }
    }
}

/// 排行榜指标
enum LeaderboardMetric: String, Codable, CaseIterable {
    case pixels = "pixels"
    case time = "time"
    case sessions = "sessions"
    case contributions = "contributions"
    case growth = "growth"

    var displayName: String {
        switch self {
        case .pixels: return "像素数量"
        case .time: return "绘制时长"
        case .sessions: return "绘制次数"
        case .contributions: return "贡献值"
        case .growth: return "增长率"
        }
    }

    var icon: String {
        switch self {
        case .pixels: return "paintbrush.fill"
        case .time: return "clock.fill"
        case .sessions: return "doc.text.fill"
        case .contributions: return "star.fill"
        case .growth: return "chart.line.uptrend.xyaxis"
        }
    }

    var unit: String {
        switch self {
        case .pixels: return "像素"
        case .time: return "小时"
        case .sessions: return "次"
        case .contributions: return "贡献"
        case .growth: return "%"
        }
    }
}

// MARK: - Request/Response Models

/// 排行榜请求参数
struct LeaderboardRequest: Codable {
    let type: LeaderboardType
    let period: LeaderboardPeriod
    let metric: LeaderboardMetric
    let page: Int
    let limit: Int
    let regionCode: String?

    enum CodingKeys: String, CodingKey {
        case type, period, metric, page, limit
        case regionCode = "region_code"
    }
}

/// 点赞请求
struct LeaderboardLikeRequest: Codable {
    let itemType: LeaderboardType
    let itemId: String

    enum CodingKeys: String, CodingKey {
        case itemType = "item_type"
        case itemId = "item_id"
    }
}

/// 取消点赞请求
struct UnlikeRequest: Codable {
    let itemType: LeaderboardType
    let itemId: String

    enum CodingKeys: String, CodingKey {
        case itemType = "item_type"
        case itemId = "item_id"
    }
}

/// 分页信息
struct LeaderboardPagination: Codable {
    let page: Int
    let limit: Int
    let total: Int
    let totalPages: Int
    let hasNext: Bool
    let hasPrev: Bool

    enum CodingKeys: String, CodingKey {
        case page, limit, total
        case totalPages = "total_pages"
        case hasNext = "has_next"
        case hasPrev = "has_prev"
    }
}

/// 排行榜响应基础结构
struct LeaderboardResponse<T: Codable>: Codable {
    let success: Bool
    let message: String?
    let data: LeaderboardData<T>
}

/// 排行榜数据
struct LeaderboardData<T: Codable>: Codable {
    let entries: [T]
    let pagination: LeaderboardPagination
    let period: LeaderboardPeriod
    let metric: LeaderboardMetric
    let updatedAt: String

    enum CodingKeys: String, CodingKey {
        case entries, pagination, period, metric
        case updatedAt = "updated_at"
    }
}

/// 个人排行榜响应
struct PersonalLeaderboardResponse: Codable {
    let success: Bool
    let message: String?
    let data: PersonalLeaderboardData
}

/// 个人排行榜数据
struct PersonalLeaderboardData: Codable {
    let entries: [PersonalLeaderboardEntry]
    let currentUser: PersonalLeaderboardEntry?
    let pagination: LeaderboardPagination
    let period: LeaderboardPeriod
    let metric: LeaderboardMetric
    let updatedAt: String

    enum CodingKeys: String, CodingKey {
        case entries, pagination, period, metric
        case currentUser = "current_user"
        case updatedAt = "updated_at"
    }
}

/// 联盟排行榜响应
struct AllianceLeaderboardResponse: Codable {
    let success: Bool
    let message: String?
    let data: AllianceLeaderboardData
}

/// 联盟排行榜数据
struct AllianceLeaderboardData: Codable {
    let entries: [AllianceLeaderboardEntry]
    let userAlliance: AllianceLeaderboardEntry?
    let pagination: LeaderboardPagination
    let period: LeaderboardPeriod
    let metric: LeaderboardMetric
    let updatedAt: String

    enum CodingKeys: String, CodingKey {
        case entries, pagination, period, metric
        case userAlliance = "user_alliance"
        case updatedAt = "updated_at"
    }
}

/// 地区排行榜响应
struct RegionLeaderboardResponse: Codable {
    let success: Bool
    let message: String?
    let data: RegionLeaderboardData
}

/// 地区排行榜数据
struct RegionLeaderboardData: Codable {
    let entries: [RegionLeaderboardEntry]
    let pagination: LeaderboardPagination
    let level: String
    let period: LeaderboardPeriod
    let metric: LeaderboardMetric
    let updatedAt: String

    enum CodingKeys: String, CodingKey {
        case entries, pagination, level, period, metric
        case updatedAt = "updated_at"
    }
}

/// 点赞响应
struct LikeResponse: Codable {
    let success: Bool
    let message: String?
    let data: LikeData?
}

/// 点赞数据
struct LikeData: Codable {
    let liked: Bool
    let likeCount: Int
    let itemId: String

    enum CodingKeys: String, CodingKey {
        case liked
        case likeCount = "like_count"
        case itemId = "item_id"
    }
}

/// 用户排名响应
struct UserRankResponse: Codable {
    let success: Bool
    let message: String?
    let data: UserRankData?
}

/// 用户排名数据
struct UserRankData: Codable {
    let rank: Int
    let previousRank: Int?
    let periodPixels: Int
    let totalPixels: Int
    let rankChange: RankChange

    enum CodingKeys: String, CodingKey {
        case rank
        case previousRank = "previous_rank"
        case periodPixels = "period_pixels"
        case totalPixels = "total_pixels"
        case rankChange = "rank_change"
    }
}

// MARK: - Utility Extensions

// Note: formattedLargeNumber() and formattedDuration() extensions are defined in ProfileModels.swift

extension String {
    /// 获取排名徽章
    func rankBadge() -> String {
        switch self {
        case "1": return "🥇"
        case "2": return "🥈"
        case "3": return "🥉"
        default: return self
        }
    }

    /// 验证地区编码格式
    func isValidRegionCode() -> Bool {
        // 简单的地区编码验证
        let regionCodeRegex = "^[A-Z]{2}-[A-Z0-9]{1,3}$"
        let predicate = NSPredicate(format: "SELF MATCHES %@", regionCodeRegex)
        return predicate.evaluate(with: self)
    }
}