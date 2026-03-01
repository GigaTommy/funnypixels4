import Foundation

// MARK: - Store Item Models

/// 商店物品基础协议
protocol StoreItemProtocol: Codable, Identifiable {
    var id: String { get }
    var name: String { get }
    var description: String { get }
    var price: Int { get }
    var type: StoreItemType { get }
    var icon: String? { get }
    var isActive: Bool { get }
    var createdAt: String { get }
    var updatedAt: String { get }
}

/// 商店物品
struct StoreItem: StoreItemProtocol, Codable {
    let id: String
    let name: String
    let description: String
    let price: Int
    let type: StoreItemType
    let icon: String?
    let imageUrl: String?
    let category: StoreItemCategory
    let isActive: Bool
    let isLimited: Bool
    let limitedQuantity: Int?
    let currentQuantity: Int?
    let effectDescription: String?
    let usageLimit: Int?
    let cooldownSeconds: Int?
    let createdAt: String
    let updatedAt: String

    enum CodingKeys: String, CodingKey {
        case id, name, description, price, type, icon, category
        case imageUrl = "image_url"
        case isActive = "is_active"
        case isLimited = "is_limited"
        case limitedQuantity = "limited_quantity"
        case currentQuantity = "current_quantity"
        case effectDescription = "effect_description"
        case usageLimit = "usage_limit"
        case cooldownSeconds = "cooldown_seconds"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }

    /// 计算属性：是否可以购买
    var isAvailable: Bool {
        guard isActive else { return false }

        if isLimited, let limitedQuantity = limitedQuantity,
           let currentQuantity = currentQuantity {
            return currentQuantity < limitedQuantity
        }

        return true
    }

    /// 计算属性：剩余库存
    var remainingStock: Int? {
        guard isLimited, let limitedQuantity = limitedQuantity,
              let currentQuantity = currentQuantity else {
            return nil
        }
        return max(0, limitedQuantity - currentQuantity)
    }

    /// 计算属性：库存状态
    var stockStatus: StockStatus {
        guard isLimited else { return .unlimited }

        if let remaining = remainingStock {
            if remaining == 0 {
                return .soldOut
            } else if remaining <= 10 {
                return .lowStock
            } else {
                return .available
            }
        }

        return .unknown
    }
}

/// 商品类型
enum StoreItemType: String, Codable, CaseIterable {
    case pixelBoost = "pixel_boost"
    case pattern = "pattern"
    case frame = "frame"
    case ad = "ad"
    case bomb = "bomb"
    case customFlag = "custom_flag"
    case colorBomb = "color_bomb"
    case emojiBomb = "emoji_bomb"
    case avatarFrame = "avatar_frame"
    case chatBubble = "chat_bubble"
    case badge = "badge"

    var displayName: String {
        switch self {
        case .pixelBoost: return "像素加速"
        case .pattern: return "图案"
        case .frame: return "框架"
        case .ad: return "广告"
        case .bomb: return "炸弹"
        case .customFlag: return "自定义旗帜"
        case .colorBomb: return "颜色炸弹"
        case .emojiBomb: return "Emoji炸弹"
        case .avatarFrame: return "头像框"
        case .chatBubble: return "聊天气泡"
        case .badge: return "徽章"
        }
    }

    var icon: String {
        switch self {
        case .pixelBoost: return "paintbrush.fill"
        case .pattern: return "square.grid.3x3.fill"
        case .frame: return "photo.artframe"
        case .ad: return "megaphone.fill"
        case .bomb: return "bomb.fill"
        case .customFlag: return "flag.fill"
        case .colorBomb: return "paintpalette.fill"
        case .emojiBomb: return "face.smiling.fill"
        case .avatarFrame: return "person.crop.circle.badge.plus"
        case .chatBubble: return "message.fill"
        case .badge: return "rosette"
        }
    }

    var isConsumable: Bool {
        switch self {
        case .pixelBoost, .bomb, .colorBomb, .emojiBomb:
            return true
        case .pattern, .frame, .ad, .customFlag, .avatarFrame, .chatBubble, .badge:
            return false
        }
    }

    var hasCooldown: Bool {
        switch self {
        case .bomb, .colorBomb, .emojiBomb:
            return true
        default:
            return false
        }
    }
}

/// 商品分类
enum StoreItemCategory: String, Codable, CaseIterable {
    case all = "all"
    case consumables = "consumables"
    case decorations = "decorations"
    case tools = "tools"
    case special = "special"
    case advertising = "advertising"

    var displayName: String {
        switch self {
        case .all: return "全部"
        case .consumables: return "消耗品"
        case .decorations: return "装饰品"
        case .tools: return "工具"
        case .special: return "特殊"
        case .advertising: return "广告"
        }
    }

    var icon: String {
        switch self {
        case .all: return "square.grid.2x2"
        case .consumables: return "pill.fill"
        case .decorations: return "sparkles"
        case .tools: return "wrench.and.screwdriver.fill"
        case .special: return "star.fill"
        case .advertising: return "megaphone.fill"
        }
    }
}

/// 库存状态
enum StockStatus {
    case available
    case lowStock
    case soldOut
    case unlimited
    case unknown

    var displayText: String {
        switch self {
        case .available: return "有货"
        case .lowStock: return "库存紧张"
        case .soldOut: return "售罄"
        case .unlimited: return "不限"
        case .unknown: return "未知"
        }
    }

    var color: String {
        switch self {
        case .available: return "#10B981" // 绿色
        case .lowStock: return "#F59E0B" // 橙色
        case .soldOut: return "#EF4444" // 红色
        case .unlimited: return "#6B7280" // 灰色
        case .unknown: return "#9CA3AF" // 浅灰色
        }
    }
}

/// 用户库存物品
struct UserInventoryItem: Codable, Identifiable {
    let id: String
    let name: String
    let description: String
    let price: Int
    let type: StoreItemType
    let category: String
    let icon: String
    let effects: [String]?
    let requirements: [String]?
    let dailyLimit: Int?

    // 库存特有属性
    let quantity: Int
    let purchasedAt: String
    let expiresAt: String?
    let lastUsedAt: String?

    /// 计算属性：是否已过期
    var isExpired: Bool {
        guard let expiresAt = expiresAt else { return false }
        let formatter = ISO8601DateFormatter()
        guard let expiryDate = formatter.date(from: expiresAt) else { return false }
        return expiryDate < Date()
    }

    /// 计算属性：是否可使用
    var isUsable: Bool {
        return quantity > 0 && !isExpired
    }
}

/// 用户积分信息
struct UserPoints: Codable {
    let points: Int
    let totalEarned: Int
    let totalSpent: Int
    let lastUpdated: String

    /// 计算属性：积分变化
    var netChange: Int {
        return totalEarned - totalSpent
    }
}

/// 交易记录
struct Transaction: Codable, Identifiable {
    let id: String
    let userId: String
    let itemId: String
    let itemName: String
    let quantity: Int
    let price: Int
    let type: TransactionType
    let status: TransactionStatus
    let createdAt: String

    enum TransactionType: String, Codable {
        case purchase = "purchase"
        case use = "use"
        case refund = "refund"
        case gift = "gift"
    }

    enum TransactionStatus: String, Codable {
        case pending = "pending"
        case completed = "completed"
        case failed = "failed"
        case cancelled = "cancelled"
    }

    /// 计算属性：总价
    var totalPrice: Int {
        return price * quantity
    }

    /// 计算属性：状态显示名称
    var statusDisplayName: String {
        switch status {
        case .pending: return "处理中"
        case .completed: return "已完成"
        case .failed: return "失败"
        case .cancelled: return "已取消"
        }
    }
}

/// 每日使用限制
struct DailyUsage: Codable {
    let used: Int
    let limit: Int
    let remaining: Int
    let resetTime: String

    /// 计算属性：使用百分比
    var usagePercentage: Double {
        guard limit > 0 else { return 0 }
        return Double(used) / Double(limit)
    }

    /// 计算属性：是否已达上限
    var isAtLimit: Bool {
        return remaining <= 0
    }
}

/// 广告数据
struct AdvertisementData: Codable {
    let title: String
    let content: String
    let imageUrl: String?
    let targetUrl: String?
    let durationDays: Int
}

/// 广告
struct Advertisement: Codable, Identifiable {
    let id: String
    let userId: String
    let title: String
    let content: String
    let imageUrl: String?
    let targetUrl: String?
    let status: AdvertisementStatus
    let startDate: String
    let endDate: String
    let impressions: Int
    let clicks: Int
    let createdAt: String
    let updatedAt: String

    enum AdvertisementStatus: String, Codable {
        case pending = "pending"
        case active = "active"
        case paused = "paused"
        case expired = "expired"
        case rejected = "rejected"
    }

    /// 计算属性：点击率
    var clickThroughRate: Double {
        guard impressions > 0 else { return 0 }
        return Double(clicks) / Double(impressions)
    }

    /// 计算属性：状态显示名称
    var statusDisplayName: String {
        switch status {
        case .pending: return "待审核"
        case .active: return "投放中"
        case .paused: return "已暂停"
        case .expired: return "已过期"
        case .rejected: return "已拒绝"
        }
    }
}

/// 广告积分
struct AdCredits: Codable {
    let total: Int
    let used: Int
    let available: Int
    let lastUpdated: String

    /// 计算属性：使用百分比
    var usagePercentage: Double {
        guard total > 0 else { return 0 }
        return Double(used) / Double(total)
    }
}

/// 充值会话
struct RechargeSession: Codable {
    let sessionId: String
    let orderId: String
    let amountRmb: Double
    let amountPoints: Int
    let channel: String
    let paymentUrl: String?
    let qrCode: String?
    let status: String
    let createdAt: String
    let expiresAt: String
}

/// 充值订单
struct RechargeOrder: Codable, Identifiable {
    let id: String
    let userId: String
    let amountRmb: Double
    let amountPoints: Int
    let channel: String
    let status: RechargeStatus
    let paymentMethod: String?
    let transactionId: String?
    let createdAt: String
    let updatedAt: String
    let completedAt: String?

    enum RechargeStatus: String, Codable {
        case pending = "pending"
        case paid = "paid"
        case failed = "failed"
        case cancelled = "cancelled"
        case refunded = "refunded"
    }

    /// 计算属性：状态显示名称
    var statusDisplayName: String {
        switch status {
        case .pending: return "待支付"
        case .paid: return "已支付"
        case .failed: return "支付失败"
        case .cancelled: return "已取消"
        case .refunded: return "已退款"
        }
    }
}

// MARK: - User Profile Models

/// 用户偏好设置

// Note: DrawingHistoryItem, DrawingStats, DrawingHistoryResponse
// are defined in ProfileModels.swift to avoid duplication

/// 绘制历史查询参数
struct DrawingHistoryQuery: Codable {
    let page: Int
    let limit: Int
    let startDate: String?
    let endDate: String?
    let sharedOnly: Bool?
    let sortBy: SortField?
    let sortOrder: SortOrder?

    enum SortField: String, Codable {
        case createdAt = "created_at"
        case sessionPixels = "session_pixels"
        case drawTime = "draw_time"
    }

    enum SortOrder: String, Codable {
        case asc = "asc"
        case desc = "desc"
    }
}

// MARK: - Alliance Models

// Note: Alliance and AllianceMember types are defined in AllianceModels.swift
// to avoid duplicate declarations.