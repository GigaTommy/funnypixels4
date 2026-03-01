import Foundation

// MARK: - Pattern Models

/// 图案审核状态
public enum PatternApprovalStatus: String, Codable, CaseIterable {
    case pending = "pending"       // 待审核
    case approved = "approved"     // 已通过
    case rejected = "rejected"     // 已拒绝
    case processing = "processing" // 处理中

    var displayName: String {
        switch self {
        case .pending: return "待审核"
        case .approved: return "已通过"
        case .rejected: return "已拒绝"
        case .processing: return "处理中"
        }
    }

    var icon: String {
        switch self {
        case .pending: return "clock"
        case .approved: return "checkmark.circle.fill"
        case .rejected: return "xmark.circle.fill"
        case .processing: return "gear"
        }
    }
}

/// 图案服务类型
public enum PatternServiceType: String, Codable, CaseIterable {
    case flag = "flag"           // 旗帜
    case territory = "territory" // 领土
    case avatar = "avatar"       // 头像
    case background = "background" // 背景

    var displayName: String {
        switch self {
        case .flag: return "旗帜"
        case .territory: return "领土"
        case .avatar: return "头像"
        case .background: return "背景"
        }
    }
}

/// 图案数据模型
@preconcurrency public struct Pattern: Identifiable, Codable, Sendable {
    public let id: String
    public let userId: String
    public let userName: String?
    public let name: String
    public let description: String?

    // RLE编码数据
    public let rleData: String?
    public let width: Int
    public let height: Int

    // 图片数据（Base64）
    public let thumbnail: String?
    public let fullImage: String?

    // 元数据
    public let colors: [String]
    public let colorCount: Int
    public let serviceType: PatternServiceType

    // 审核状态
    public let approvalStatus: PatternApprovalStatus
    public let rejectionReason: String?
    public let reviewedAt: String?
    public let reviewedBy: String?

    // 统计数据
    public let usageCount: Int
    public let rating: Double?
    public let ratingCount: Int

    public init(id: String, userId: String, userName: String?, name: String, description: String?, rleData: String?, width: Int, height: Int, thumbnail: String?, fullImage: String?, colors: [String], colorCount: Int, serviceType: PatternServiceType, approvalStatus: PatternApprovalStatus, rejectionReason: String?, reviewedAt: String?, reviewedBy: String?, usageCount: Int, rating: Double?, ratingCount: Int, createdAt: String, updatedAt: String) {
        self.id = id
        self.userId = userId
        self.userName = userName
        self.name = name
        self.description = description
        self.rleData = rleData
        self.width = width
        self.height = height
        self.thumbnail = thumbnail
        self.fullImage = fullImage
        self.colors = colors
        self.colorCount = colorCount
        self.serviceType = serviceType
        self.approvalStatus = approvalStatus
        self.rejectionReason = rejectionReason
        self.reviewedAt = reviewedAt
        self.reviewedBy = reviewedBy
        self.usageCount = usageCount
        self.rating = rating
        self.ratingCount = ratingCount
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }

    // 时间戳
    public let createdAt: String
    public let updatedAt: String

    public enum CodingKeys: String, CodingKey {
        case id, userId, name, description
        case userName = "user_name"
        case rleData = "rle_data"
        case width, height
        case thumbnail, fullImage = "full_image"
        case colors, colorCount = "color_count"
        case serviceType = "service_type"
        case approvalStatus = "approval_status"
        case rejectionReason = "rejection_reason"
        case reviewedAt = "reviewed_at"
        case reviewedBy = "reviewed_by"
        case usageCount = "usage_count"
        case rating, ratingCount = "rating_count"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }

    /// 计算属性：是否已通过审核
    public var isApproved: Bool {
        return approvalStatus == .approved
    }

    /// 计算属性：是否可使用
    public var isUsable: Bool {
        return approvalStatus == .approved
    }

    /// 计算属性：评分显示文本
    public var ratingDisplay: String {
        guard let rating = rating else {
            return "暂无评分"
        }
        return String(format: "%.1f", rating)
    }

    /// 计算属性：尺寸描述
    public var sizeDescription: String {
        return "\(width)×\(height)"
    }
}

/// 图案市场筛选条件
struct PatternMarketFilter: Codable {
    var serviceType: PatternServiceType?
    var status: PatternApprovalStatus?
    var minRating: Double?
    var searchQuery: String?
    var sortOption: PatternSortOption = .newest
    var userId: String?

    enum PatternSortOption: String, Codable, CaseIterable {
        case newest = "newest"
        case popular = "popular"
        case rating = "rating"
        case usage = "usage"

        var displayName: String {
            switch self {
            case .newest: return "最新"
            case .popular: return "最热"
            case .rating: return "评分"
            case .usage: return "使用"
            }
        }
    }
}

/// 图案统计信息
public struct PatternStatistics: Codable, Sendable {
    public let totalPatterns: Int
    public let approvedPatterns: Int
    public let pendingPatterns: Int
    public let rejectedPatterns: Int
    public let totalUsage: Int
    public let averageRating: Double

    public init(totalPatterns: Int, approvedPatterns: Int, pendingPatterns: Int, rejectedPatterns: Int, totalUsage: Int, averageRating: Double) {
        self.totalPatterns = totalPatterns
        self.approvedPatterns = approvedPatterns
        self.pendingPatterns = pendingPatterns
        self.rejectedPatterns = rejectedPatterns
        self.totalUsage = totalUsage
        self.averageRating = averageRating
    }

    public enum CodingKeys: String, CodingKey {
        case totalPatterns = "total_patterns"
        case approvedPatterns = "approved_patterns"
        case pendingPatterns = "pending_patterns"
        case rejectedPatterns = "rejected_patterns"
        case totalUsage = "total_usage"
        case averageRating = "average_rating"
    }
}

// MARK: - Request/Response Models

/// 创建图案请求
public struct CreatePatternRequest: Codable, Sendable {
    let name: String
    let description: String?
    let rleData: String
    let width: Int
    let height: Int
    let colors: [String]
    let thumbnail: String
    let fullImage: String
    let serviceType: PatternServiceType

    enum CodingKeys: String, CodingKey {
        case name, description
        case rleData = "rle_data"
        case width, height, colors, thumbnail
        case fullImage = "full_image"
        case serviceType = "service_type"
    }
}

/// 更新图案请求
public struct UpdatePatternRequest: Codable, Sendable {
    let patternId: String
    let name: String?
    let description: String?

    enum CodingKeys: String, CodingKey {
        case patternId = "pattern_id"
        case name, description
    }
}

/// 图案列表响应
public struct PatternsResponse: Codable, Sendable {
    public let success: Bool
    public let data: [Pattern]
    public let pagination: PaginationInfo?
    public let message: String?

    public init(success: Bool, data: [Pattern], pagination: PaginationInfo?, message: String?) {
        self.success = success
        self.data = data
        self.pagination = pagination
        self.message = message
    }
}

/// 图案详情响应
public struct PatternDetailResponse: Codable, Sendable {
    public let success: Bool
    public let data: Pattern?
    public let statistics: PatternStatistics?
    public let message: String?

    public init(success: Bool, data: Pattern?, statistics: PatternStatistics?, message: String?) {
        self.success = success
        self.data = data
        self.statistics = statistics
        self.message = message
    }
}

/// 图案统计响应
public struct PatternStatisticsResponse: Codable, Sendable {
    public let success: Bool
    public let data: PatternStatistics
    public let message: String?

    public init(success: Bool, data: PatternStatistics, message: String?) {
        self.success = success
        self.data = data
        self.message = message
    }
}

/// 应用图案到区域请求
public struct ApplyPatternRequest: Codable, Sendable {
    public let patternId: String
    public let serviceType: PatternServiceType
    public let targetId: String?
    public let startX: Int?
    public let startY: Int?

    public init(patternId: String, serviceType: PatternServiceType, targetId: String?, startX: Int?, startY: Int?) {
        self.patternId = patternId
        self.serviceType = serviceType
        self.targetId = targetId
        self.startX = startX
        self.startY = startY
    }

    enum CodingKeys: String, CodingKey {
        case patternId = "pattern_id"
        case serviceType = "service_type"
        case targetId = "target_id"
        case startX = "start_x"
        case startY = "start_y"
    }
}

/// 应用图案响应
public struct ApplyPatternResponse: Codable, Sendable {
    public let success: Bool
    public let data: AppliedPatternInfo?
    public let message: String?

    public init(success: Bool, data: AppliedPatternInfo?, message: String?) {
        self.success = success
        self.data = data
        self.message = message
    }
}

/// 已应用的图案信息
public struct AppliedPatternInfo: Codable, Sendable {
    public let applicationId: String
    public let pixelsAffected: Int
    public let cost: Int?
    public let estimatedTime: Int?

    public init(applicationId: String, pixelsAffected: Int, cost: Int?, estimatedTime: Int?) {
        self.applicationId = applicationId
        self.pixelsAffected = pixelsAffected
        self.cost = cost
        self.estimatedTime = estimatedTime
    }

    public enum CodingKeys: String, CodingKey {
        case applicationId = "application_id"
        case pixelsAffected = "pixels_affected"
        case cost
        case estimatedTime = "estimated_time"
    }
}
