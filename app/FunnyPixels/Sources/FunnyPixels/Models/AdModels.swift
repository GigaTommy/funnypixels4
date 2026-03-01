import Foundation
import CoreLocation

// MARK: - Advertisement Models

/// 广告尺寸类型
enum AdSizeType: String, Codable, CaseIterable {
    case square = "square"        // 方形 (64x64)
    case rectangle = "rectangle"  // 长方形 (128x64)
    case large = "large"          // 大型 (128x128)

    var displayName: String {
        switch self {
        case .square: return "方形"
        case .rectangle: return "长方形"
        case .large: return "大型"
        }
    }

    var dimensions: (width: Int, height: Int) {
        switch self {
        case .square: return (64, 64)
        case .rectangle: return (128, 64)
        case .large: return (128, 128)
        }
    }
}

/// 广告产品（商店中的商品）
struct AdProduct: Identifiable, Codable {
    let id: String
    let name: String
    let description: String
    let price: Int
    let width: Int
    let height: Int
    let sizeType: AdSizeType
    let durationHours: Int
    let category: String
    let isActive: Bool
    let createdAt: String
    let updatedAt: String

    enum CodingKeys: String, CodingKey {
        case id, name, description, price, width, height
        case sizeType = "size_type"
        case durationHours = "duration_hours"
        case category, isActive
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}

/// 广告像素点
struct AdPixel: Codable {
    let x: Int
    let y: Int
    let color: String
    let alpha: Double
}

/// 广告订单状态
enum AdOrderStatus: String, Codable, CaseIterable {
    case pending = "pending"       // 待审核
    case approved = "approved"     // 已审核
    case active = "active"         // 投放中
    case paused = "paused"         // 已暂停
    case completed = "completed"   // 已完成
    case rejected = "rejected"     // 已拒绝

    var displayName: String {
        switch self {
        case .pending: return "待审核"
        case .approved: return "已审核"
        case .active: return "投放中"
        case .paused: return "已暂停"
        case .completed: return "已完成"
        case .rejected: return "已拒绝"
        }
    }

    var icon: String {
        switch self {
        case .pending: return "clock.fill"
        case .approved: return "checkmark.circle.fill"
        case .active: return "play.circle.fill"
        case .paused: return "pause.circle.fill"
        case .completed: return "checkmark.seal.fill"
        case .rejected: return "xmark.circle.fill"
        }
    }
}

/// 广告订单
struct AdOrder: Identifiable, Codable {
    let id: String
    let userId: String
    let productId: String
    let productName: String
    let title: String
    let description: String?
    let imageData: String
    let pixelData: [[AdPixel]]?
    let status: AdOrderStatus
    let startTime: String
    let endTime: String
    let createdAt: String
    let updatedAt: String
    let reviewedAt: String?
    let rejectionReason: String?

    enum CodingKeys: String, CodingKey {
        case id, userId, title, description, imageData, status
        case productId = "product_id"
        case productName = "product_name"
        case pixelData = "pixel_data"
        case startTime = "start_time"
        case endTime = "end_time"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
        case reviewedAt = "reviewed_at"
        case rejectionReason = "rejection_reason"
    }
}

/// 广告库存状态
enum AdInventoryStatus: String, Codable, CaseIterable {
    case available = "available"   // 可用
    case placed = "placed"         // 已投放
    case expired = "expired"       // 已过期

    var displayName: String {
        switch self {
        case .available: return "可用"
        case .placed: return "已投放"
        case .expired: return "已过期"
        }
    }
}

/// 用户广告库存
struct UserAdInventory: Identifiable, Codable {
    let id: String
    let userId: String
    let orderId: String
    let productId: String
    let productName: String
    let title: String
    let width: Int
    let height: Int
    let imageData: String
    let status: AdInventoryStatus
    let placementId: String?
    let placedAt: String?
    let expiresAt: String
    let createdAt: String
    let usageCount: Int
    let maxUsage: Int

    enum CodingKeys: String, CodingKey {
        case id, userId, title, width, height, status
        case orderId = "order_id"
        case productId = "product_id"
        case productName = "product_name"
        case imageData = "image_data"
        case placementId = "placement_id"
        case placedAt = "placed_at"
        case expiresAt = "expires_at"
        case createdAt = "created_at"
        case usageCount = "usage_count"
        case maxUsage = "max_usage"
    }

    /// 是否可用
    var isAvailable: Bool {
        return status == .available && usageCount < maxUsage
    }

    /// 剩余使用次数
    var remainingUsage: Int {
        return max(0, maxUsage - usageCount)
    }
}

/// 广告投放状态
enum AdPlacementStatus: String, Codable, CaseIterable {
    case active = "active"       // 投放中
    case paused = "paused"       // 已暂停
    case expired = "expired"     // 已过期

    var displayName: String {
        switch self {
        case .active: return "投放中"
        case .paused: return "已暂停"
        case .expired: return "已过期"
        }
    }
}

/// 广告投放记录
struct AdPlacement: Identifiable, Codable {
    let id: String
    let userId: String
    let inventoryId: String
    let orderId: String
    let title: String
    let latitude: Double
    let longitude: Double
    let gridId: String
    let width: Int
    let height: Int
    let pixelData: [[AdPixel]]
    let status: AdPlacementStatus
    let placedAt: String
    let expiresAt: String
    let impressions: Int
    let clicks: Int

    enum CodingKeys: String, CodingKey {
        case id, userId, title, status
        case inventoryId = "inventory_id"
        case orderId = "order_id"
        case latitude, longitude, gridId, width, height
        case pixelData = "pixel_data"
        case placedAt = "placed_at"
        case expiresAt = "expires_at"
        case impressions, clicks
    }

    /// 计算属性：坐标
    var coordinate: CLLocationCoordinate2D {
        CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
    }

    /// 点击率
    var clickThroughRate: Double {
        guard impressions > 0 else { return 0 }
        return Double(clicks) / Double(impressions)
    }
}

/// 广告统计数据
struct AdStatistics: Codable {
    let totalOrders: Int
    let activePlacements: Int
    let totalImpressions: Int
    let totalClicks: Int
    let averageCTR: Double
    let topPerformingAds: [AdPlacement]

    enum CodingKeys: String, CodingKey {
        case totalOrders = "total_orders"
        case activePlacements = "active_placements"
        case totalImpressions = "total_impressions"
        case totalClicks = "total_clicks"
        case averageCTR = "average_ctr"
        case topPerformingAds = "top_performing_ads"
    }
}

/// 广告购买表单数据
struct AdPurchaseFormData: Codable {
    var title: String
    var description: String
    var imageData: Data
    var pixelData: [[AdPixel]]?
    var selectedLocation: AdLocation?
    var duration: Int
    var productId: String
}

/// 广告位置信息
struct AdLocation: Codable, Equatable {
    let latitude: Double
    let longitude: Double
    let name: String?
    let address: String?

    var coordinate: CLLocationCoordinate2D {
        CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
    }
}

// MARK: - API Response Models

/// 广告产品列表响应
struct AdProductsResponse: Codable {
    let success: Bool
    let data: [AdProduct]
    let message: String?
}

/// 广告订单响应
struct AdOrderResponse: Codable {
    let success: Bool
    let data: AdOrder?
    let message: String?
    let error: String?
}

/// 广告库存列表响应
struct AdInventoryResponse: Codable {
    let success: Bool
    let data: [UserAdInventory]
    let message: String?
}

/// 广告投放响应
struct AdPlacementResponse: Codable {
    let success: Bool
    let data: AdPlacement?
    let message: String?
    let error: String?
}

/// 广告统计响应
struct AdStatisticsResponse: Codable {
    let success: Bool
    let data: AdStatistics?
    let message: String?
}
