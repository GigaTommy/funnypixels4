import Foundation

// MARK: - 像素快照: 5x5 颜色矩阵

struct PixelSnapshot: Codable, Sendable {
    let grid: [[String?]] // 5x5, 每个元素是 hex color 或 nil(空格)

    init(grid: [[String?]] = Array(repeating: Array(repeating: nil, count: 5), count: 5)) {
        self.grid = grid
    }
}

// MARK: - 漂流瓶

struct DriftBottle: Codable, Identifiable, Sendable {
    let bottleId: String
    let originalOwnerId: String
    let content: String?
    let pixelSnapshot: PixelSnapshot?
    let currentLat: Double
    let currentLng: Double
    let originLat: Double
    let originLng: Double
    let originCity: String?
    let originCountry: String?
    let currentCity: String?
    let currentCountry: String?
    let totalDistance: Int
    let openCount: Int
    let maxOpeners: Int
    let isSunk: Bool
    let directionAngle: Double?
    let createdAt: String?
    var messages: [BottleMessage]?

    var id: String { bottleId }

    enum CodingKeys: String, CodingKey {
        case bottleId = "bottle_id"
        case originalOwnerId = "original_owner_id"
        case content
        case pixelSnapshot = "pixel_snapshot"
        case currentLat = "current_lat"
        case currentLng = "current_lng"
        case originLat = "origin_lat"
        case originLng = "origin_lng"
        case originCity = "origin_city"
        case originCountry = "origin_country"
        case currentCity = "current_city"
        case currentCountry = "current_country"
        case totalDistance = "total_distance"
        case openCount = "open_count"
        case maxOpeners = "max_openers"
        case isSunk = "is_sunk"
        case directionAngle = "direction_angle"
        case createdAt = "created_at"
        case messages
    }

    /// 漂流天数
    var daysAfloat: Int {
        guard let created = createdAt else { return 0 }
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = formatter.date(from: created) {
            return max(1, Calendar.current.dateComponents([.day], from: date, to: Date()).day ?? 0)
        }
        return 0
    }

    /// 漂流距离(km)
    var distanceKm: Double {
        Double(totalDistance) / 1000.0
    }
}

// MARK: - 瓶中留言

struct BottleMessage: Codable, Identifiable, Sendable {
    let id: Int
    let bottleId: String
    let authorId: String
    let authorName: String
    let authorAvatar: String?
    let message: String?
    let stationNumber: Int
    let city: String?
    let country: String?
    let createdAt: String?

    enum CodingKeys: String, CodingKey {
        case id
        case bottleId = "bottle_id"
        case authorId = "author_id"
        case authorName = "author_name"
        case authorAvatar = "author_avatar"
        case message
        case stationNumber = "station_number"
        case city
        case country
        case createdAt = "created_at"
    }
}

// MARK: - 遭遇结果

struct BottleEncounter: Codable, Sendable {
    let bottles: [DriftBottle]
    let reunionBottle: DriftBottle?

    enum CodingKeys: String, CodingKey {
        case bottles
        case reunionBottle = "reunionBottle"
    }
}

// MARK: - 配额信息

struct BottleQuota: Codable, Sendable {
    let dailyFree: Int              // 每日免费总数
    let dailyUsed: Int              // 今日已使用
    let dailyRemaining: Int         // 今日剩余
    let bonusFromPixels: Int        // 画像素奖励
    let totalAvailable: Int         // 总可用数
    let pixelsForNextBottle: Int    // 距下个瓶子还需多少像素
    let resetTime: String           // 重置时间

    enum CodingKeys: String, CodingKey {
        case dailyFree = "daily_free"
        case dailyUsed = "daily_used"
        case dailyRemaining = "daily_remaining"
        case bonusFromPixels = "bonus_from_pixels"
        case totalAvailable = "total_available"
        case pixelsForNextBottle = "pixels_for_next_bottle"
        case resetTime = "reset_time"
    }

    /// 是否可以扔瓶子
    var canThrow: Bool {
        totalAvailable > 0
    }

    /// 画像素进度 (0.0 - 1.0)
    var pixelProgress: Double {
        let total = 50.0  // 每50像素1个瓶子
        let earned = total - Double(pixelsForNextBottle)
        return max(0, min(1, earned / total))
    }

    /// 显示文本
    var displayText: String {
        if dailyRemaining > 0 {
            return "今日剩余 \(dailyRemaining)/\(dailyFree)"
        } else if bonusFromPixels > 0 {
            return "奖励 \(bonusFromPixels) 个"
        } else {
            return "已用完"
        }
    }

    /// 格式化重置时间
    var formattedResetTime: String {
        let formatter = ISO8601DateFormatter()
        guard let date = formatter.date(from: resetTime) else { return "明天" }

        let displayFormatter = DateFormatter()
        displayFormatter.dateFormat = "HH:mm"
        return displayFormatter.string(from: date)
    }
}

// MARK: - 旅途卡片

struct JourneyCard: Codable, Identifiable, Sendable {
    let id: Int
    let bottleId: String
    let participantRole: String
    let stationNumber: Int
    let totalStations: Int?
    let totalDistance: Int?
    let totalDays: Int?
    let pixelSnapshot: PixelSnapshot?
    let originCity: String?
    let originCountry: String?
    let isRead: Bool
    let isSunk: Bool?
    let createdAt: String?
    let stations: [JourneyStation]?

    enum CodingKeys: String, CodingKey {
        case id
        case bottleId = "bottle_id"
        case participantRole = "participant_role"
        case stationNumber = "station_number"
        case totalStations = "total_stations"
        case totalDistance = "total_distance"
        case totalDays = "total_days"
        case pixelSnapshot = "pixel_snapshot"
        case originCity = "origin_city"
        case originCountry = "origin_country"
        case isRead = "is_read"
        case isSunk = "is_sunk"
        case createdAt = "created_at"
        case stations
    }

    var distanceKm: Double {
        Double(totalDistance ?? 0) / 1000.0
    }
}

// MARK: - 旅途站点

struct JourneyStation: Codable, Sendable {
    let stationNumber: Int
    let city: String?
    let country: String?
    let message: String?
    let distanceFromPrev: Int
    let cumulativeDistance: Int
    let participantId: String?
    let participantRole: String?
    let username: String?
    let avatar: String?

    enum CodingKeys: String, CodingKey {
        case stationNumber = "station_number"
        case city
        case country
        case message
        case distanceFromPrev = "distance_from_prev"
        case cumulativeDistance = "cumulative_distance"
        case participantId = "participant_id"
        case participantRole = "participant_role"
        case username
        case avatar
    }
}

// MARK: - 打开结果

struct OpenBottleResult: Codable, Sendable {
    let bottle: DriftBottle
    let didSink: Bool
    let journeyCard: JourneyCardDetail?

    enum CodingKeys: String, CodingKey {
        case bottle
        case didSink
        case journeyCard
    }
}

// MARK: - 旅途卡片详情(完整旅途)

struct JourneyCardDetail: Codable, Sendable {
    let bottleId: String
    let pixelSnapshot: PixelSnapshot?
    let originCity: String?
    let originCountry: String?
    let totalDistance: Int
    let totalStations: Int
    let totalDays: Int
    let isSunk: Bool
    let sunkAt: String?
    let createdAt: String?
    let stations: [JourneyStation]
    let messages: [BottleMessage]

    enum CodingKeys: String, CodingKey {
        case bottleId = "bottle_id"
        case pixelSnapshot = "pixel_snapshot"
        case originCity = "origin_city"
        case originCountry = "origin_country"
        case totalDistance = "total_distance"
        case totalStations = "total_stations"
        case totalDays = "total_days"
        case isSunk = "is_sunk"
        case sunkAt = "sunk_at"
        case createdAt = "created_at"
        case stations
        case messages
    }

    var distanceKm: Double {
        Double(totalDistance) / 1000.0
    }
}

// MARK: - API Response Wrappers

struct DriftBottleResponse: Codable, Sendable {
    let success: Bool
    let message: String?
    let messageKey: String?
    let data: DriftBottleResponseData?
}

struct DriftBottleResponseData: Codable, Sendable {
    let bottle: DriftBottle?
    let didSink: Bool?
    let journeyCard: JourneyCardDetail?
}

struct EncounterResponse: Codable, Sendable {
    let success: Bool
    let data: BottleEncounter?
}

struct QuotaResponse: Codable, Sendable {
    let success: Bool
    let data: BottleQuota?
}

struct JourneyCardsResponse: Codable, Sendable {
    let success: Bool
    let data: JourneyCardsData?
}

struct JourneyCardsData: Codable, Sendable {
    let cards: [JourneyCard]
    let pagination: PaginationData?
}

struct PaginationData: Codable, Sendable {
    let page: Int
    let limit: Int
    let total: Int
    let totalPages: Int?

    enum CodingKeys: String, CodingKey {
        case page, limit, total
        case totalPages = "total_pages"
    }
}

struct JourneyCardDetailResponse: Codable, Sendable {
    let success: Bool
    let data: JourneyCardDetail?
}

struct SimpleSuccessResponse: Codable, Sendable {
    let success: Bool
    let message: String?
}
