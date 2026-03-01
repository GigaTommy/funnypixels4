import Foundation

/// 商店服务
/// 负责处理商店商品、购买、库存等操作
class ShopService {
    static let shared = ShopService()

    private init() {}

    // MARK: - 数据模型

    /// 商品分类（从 metadata.category 获取）
    enum ItemCategory: String, Codable {
        case consumable = "consumable"    // 消耗品
        case special = "special"           // 特殊道具
        case cosmetic = "cosmetic"         // 装饰品
    }

    /// 商品模型
    struct StoreItem: Codable, Identifiable {
        let id: String  // 支持 ID 字符串（数字会被转换为字符串）
        let originalId: Any?  // 保存原始 ID 值
        let name: String
        let description: String
        let itemType: String  // 保持原始类型
        let pricePoints: Int
        let priceCny: Double?
        let active: Bool
        let imageUrl: String?
        let quantity: Int?
        let metadata: ItemMetadata?

        var displayName: String { name }
        var displayDescription: String { description }

        /// 从 metadata.category 获取商品分类（用于UI显示）
        var category: ItemCategory? {
            guard let categoryName = metadata?.category else { return nil }
            return ItemCategory(rawValue: categoryName)
        }

        // 自定义解码，处理 Int 和 String 两种 ID 类型
        init(from decoder: Decoder) throws {
            let container = try decoder.container(keyedBy: CodingKeys.self)
            name = try container.decode(String.self, forKey: .name)
            description = try container.decode(String.self, forKey: .description)
            itemType = try container.decode(String.self, forKey: .itemType)
            pricePoints = try container.decode(Int.self, forKey: .pricePoints)
            priceCny = try container.decodeIfPresent(Double.self, forKey: .priceCny)
            active = try container.decode(Bool.self, forKey: .active)
            imageUrl = try container.decodeIfPresent(String.self, forKey: .imageUrl)
            quantity = try container.decodeIfPresent(Int.self, forKey: .quantity)
            metadata = try container.decodeIfPresent(ItemMetadata.self, forKey: .metadata)

            // 处理 ID 字段，支持 Int 和 String
            if let intId = try? container.decode(Int.self, forKey: .id) {
                id = String(intId)
                originalId = intId
            } else {
                id = try container.decode(String.self, forKey: .id)
                originalId = id
            }
        }

        private enum CodingKeys: String, CodingKey {
            case id, name, description
            case itemType = "item_type"
            case pricePoints = "price_points"
            case priceCny = "price_cny"
            case active
            case imageUrl = "image_url"
            case quantity
            case metadata
        }
    }

    /// 商品元数据
    struct ItemMetadata: Codable {
        let category: String?
        let dailyLimit: Int?
        let boostAmount: Int?
        let bottleType: String?
        let maxMessages: Int?
        let width: Int?
        let height: Int?
        let sizeType: String?
        let bombType: String?

        private enum CodingKeys: String, CodingKey {
            case category
            case dailyLimit = "daily_limit"
            case boostAmount = "boost_amount"
            case bottleType = "bottle_type"
            case maxMessages = "max_messages"
            case width
            case height
            case sizeType = "size_type"
            case bombType = "bomb_type"
        }
    }

    /// 库存项模型
    struct InventoryItem: Codable, Identifiable {
        let id: String
        let itemId: String
        var itemName: String
        let quantity: Int
        let itemType: String
        let createdAt: Date
        let updatedAt: Date

        var displayName: String { itemName }

        private enum CodingKeys: String, CodingKey {
            case id
            case itemId = "item_id"
            case itemName = "item_name"
            case quantity
            case itemType = "item_type"
            case createdAt = "created_at"
            case updatedAt = "updated_at"
        }

        // 自定义解码，处理 Int, Double, String 三种 ID 类型
        init(from decoder: Decoder) throws {
            let container = try decoder.container(keyedBy: CodingKeys.self)
            
            // 处理 itemId 字段
            if let intItemId = try? container.decode(Int.self, forKey: .itemId) {
                itemId = String(intItemId)
            } else if let doubleItemId = try? container.decode(Double.self, forKey: .itemId) {
                itemId = String(Int(doubleItemId))
            } else {
                itemId = try container.decode(String.self, forKey: .itemId)
            }
            
            if let name = try? container.decode(String.self, forKey: .itemName) {
                itemName = name
            } else {
                itemName = "Item \(itemId)"
            }
            if let qty = try? container.decode(Int.self, forKey: .quantity) {
                quantity = qty
            } else {
                quantity = 1
            }
            
            if let type = try? container.decode(String.self, forKey: .itemType) {
                itemType = type
            } else {
                itemType = "unknown"
            }
            if let created = try? container.decode(Date.self, forKey: .createdAt) {
                createdAt = created
            } else {
                createdAt = Date()
            }
            
            if let updated = try? container.decode(Date.self, forKey: .updatedAt) {
                updatedAt = updated
            } else {
                updatedAt = Date()
            }

            // 处理 id 字段
            if let intId = try? container.decode(Int.self, forKey: .id) {
                id = String(intId)
            } else if let doubleId = try? container.decode(Double.self, forKey: .id) {
                id = String(Int(doubleId))
            } else {
                id = try container.decode(String.self, forKey: .id)
            }
        }
    }

    /// 购买响应
    struct PurchaseResponse: Codable {
        let success: Bool
        let data: PurchaseData?
        let error: String?

        struct PurchaseData: Codable {
            let message: String
            let item: StoreItem?
            let quantity: Int
            let totalPrice: Int
            let remainingPoints: Int
            let isAdOrder: Bool
        }
    }

    /// 使用道具响应
    struct UseItemResponse: Codable {
        let success: Bool
        let data: UseItemData?
        let error: String?

        struct UseItemData: Codable {
            let message: String
            let remainingQuantity: Int
        }
    }

    /// 用户积分响应
    struct PointsResponse: Codable {
        let success: Bool
        let data: PointsData?
        let error: String?

        struct PointsData: Codable {
            let points: Int
            let totalEarned: Int?
            let totalSpent: Int?
            let lastUpdated: String?
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
        let type: String  // "purchase", "use", "refund"
        let status: String  // "pending", "completed", "failed"
        let createdAt: String
        let metadata: [String: String]?

        private enum CodingKeys: String, CodingKey {
            case id, userId = "user_id", itemId = "item_id", itemName = "item_name"
            case quantity, price, type, status, createdAt = "created_at", metadata
        }

        // 自定义解码
        init(from decoder: Decoder) throws {
            let container = try decoder.container(keyedBy: CodingKeys.self)
            
            // Handle id (Int/String)
            if let intId = try? container.decode(Int.self, forKey: .id) {
                id = String(intId)
            } else {
                id = try container.decode(String.self, forKey: .id)
            }
            
            // Handle itemId (Int/String)
            if let intItemId = try? container.decode(Int.self, forKey: .itemId) {
                itemId = String(intItemId)
            } else {
                itemId = try container.decode(String.self, forKey: .itemId)
            }
            
            userId = try container.decode(String.self, forKey: .userId)
            itemName = try container.decode(String.self, forKey: .itemName)
            quantity = try container.decode(Int.self, forKey: .quantity)
            price = try container.decode(Int.self, forKey: .price)
            type = try container.decode(String.self, forKey: .type)
            status = try container.decode(String.self, forKey: .status)
            createdAt = try container.decode(String.self, forKey: .createdAt)
            metadata = try container.decodeIfPresent([String: String].self, forKey: .metadata)
        }
    }

    /// 交易记录响应
    struct TransactionsResponse: Codable {
        let success: Bool?
        let ok: Bool? // Backend uses "ok"
        let data: [Transaction]?
        let pagination: Pagination?
        let error: String?
        
        var isSuccess: Bool {
            return ok == true || success == true
        }

        struct Pagination: Codable {
            let total: Int
            let limit: Int
            let offset: Int
            let page: Int
            let pages: Int
        }
    }

    /// 充值订单响应
    struct RechargeOrdersResponse: Codable {
        let success: Bool?
        let ok: Bool? // Backend uses "ok"
        let data: [RechargeOrder]?
        let error: String?
        
        var isSuccess: Bool {
            return ok == true || success == true
        }
    }

    /// 充值会话响应
    struct RechargeSessionResponse: Codable {
        let ok: Bool
        let data: RechargeSessionData?
        let error: String?

        struct RechargeSessionData: Codable {
            let orderId: String
            let amountRmb: Double
            let points: Int
            let channel: String
            let paymentUrl: String?
            let qrCodeDataUrl: String?
            let paymentInstructions: [String]?
        }
    }

    /// 充值订单
    struct RechargeOrder: Codable, Identifiable {
        let id: String
        let userId: String
        let amountRmb: Double
        let amountPoints: Int
        let channel: String
        let status: String  // "pending", "paid", "failed", "refunded"
        let createdAt: String
        let paidAt: String?

        private enum CodingKeys: String, CodingKey {
            case id, userId = "user_id", amountRmb = "amount_rmb"
            case amountPoints = "amount_points", channel, status
            case createdAt = "created_at", paidAt = "paid_at"
        }

        // 自定义解码
        init(from decoder: Decoder) throws {
            let container = try decoder.container(keyedBy: CodingKeys.self)
            
            // Handle id (Int/String)
            if let intId = try? container.decode(Int.self, forKey: .id) {
                id = String(intId)
            } else {
                id = try container.decode(String.self, forKey: .id)
            }
            
            userId = try container.decode(String.self, forKey: .userId)
            amountRmb = try container.decode(Double.self, forKey: .amountRmb)
            amountPoints = try container.decode(Int.self, forKey: .amountPoints)
            channel = try container.decode(String.self, forKey: .channel)
            status = try container.decode(String.self, forKey: .status)
            createdAt = try container.decode(String.self, forKey: .createdAt)
            paidAt = try container.decodeIfPresent(String.self, forKey: .paidAt)
        }
    }

    /// 每日使用限制
    struct DailyUsage: Codable {
        let used: Int
        let limit: Int
        let remaining: Int
        let resetTime: String

        var remainingString: String {
            return "\(remaining)/\(limit)"
        }

        private enum CodingKeys: String, CodingKey {
            case used, limit, remaining, resetTime = "reset_time"
        }
    }

    /// 推荐商品响应
    struct RecommendedItemsResponse: Codable {
        let success: Bool?
        let ok: Bool?
        let data: [StoreItem]?
        let error: String?
        
        var isSuccess: Bool {
            return ok == true || success == true
        }
    }

    // MARK: - API方法

    /// 获取所有商品
    func getAllItems(activeOnly: Bool = true) async throws -> [StoreItem] {
        var path = "/store/items"
        if activeOnly {
            path += "?active=1"
        }

        let response: ShopResponse = try await APIManager.shared.get(path)

        guard response.success else {
            throw NetworkError.serverError(response.error ?? "获取商品列表失败")
        }

        return response.data ?? []
    }

    /// 按类型获取商品
    func getItemsByType(_ type: String) async throws -> [StoreItem] {
        let path = "/store/items/type/\(type)"

        let response: ShopResponse = try await APIManager.shared.get(path)

        guard response.success else {
            throw NetworkError.serverError(response.error ?? "获取商品失败")
        }

        return response.data ?? []
    }

    /// 购买商品
    func purchaseItem(itemId: String, quantity: Int = 1, paymentMethod: String = "points", details: [String: Any]? = nil) async throws -> PurchaseResponse.PurchaseData {
        let path = "/store/purchase"

        // 直接使用字符串 ID，后端需要 String 类型来调用 startsWith
        var body: [String: Any] = [
            "itemId": itemId,
            "quantity": quantity,
            "paymentMethod": paymentMethod
        ]
        
        if let details = details {
            body.merge(details) { (_, new) in new }
        }

        let response: PurchaseResponse = try await APIManager.shared.post(path, parameters: body)

        guard response.success, let data = response.data else {
            throw NetworkError.serverError(response.error ?? "购买失败")
        }

        return data
    }

    /// 获取用户库存
    func getUserInventory() async throws -> [InventoryItem] {
        let path = "/store/inventory"

        let response: InventoryResponse = try await APIManager.shared.get(path)

        guard response.success else {
            throw NetworkError.serverError(response.error ?? "获取库存失败")
        }
        
        if let data = response.data {
             Logger.info("📦 Inventory loaded: \(data.count) items")
             for item in data {
                 Logger.debug("   - \(item.itemName) (ID: \(item.id), Qty: \(item.quantity))")
             }
        } else {
             Logger.info("📦 Inventory empty or nil data")
        }

        return response.data ?? []
    }

    /// 使用道具
    func useItem(itemId: String, quantity: Int = 1, targetId: String? = nil) async throws -> UseItemResponse.UseItemData {
        let path = "/store/use"

        var body: [String: Any] = [
            "itemId": itemId,
            "quantity": quantity
        ]

        if let targetId = targetId {
            body["targetId"] = targetId
        }

        let response: UseItemResponse = try await APIManager.shared.post(path, parameters: body)

        guard response.success, let data = response.data else {
            throw NetworkError.serverError(response.error ?? "使用道具失败")
        }

        return data
    }

    /// 获取用户积分
    func getUserPoints() async throws -> Int {
        let path = "/store/points"

        let response: PointsResponse = try await APIManager.shared.get(path)

        guard response.success, let data = response.data else {
            throw NetworkError.serverError(response.error ?? "获取积分失败")
        }

        return data.points
    }

    /// 获取用户装饰品
    func getUserCosmetics() async throws -> [InventoryItem] {
        let path = "/store/cosmetics"

        let response: InventoryResponse = try await APIManager.shared.get(path)

        guard response.success else {
            throw NetworkError.serverError(response.error ?? "获取装饰品失败")
        }

        return response.data ?? []
    }

    /// 获取交易记录
    func getTransactions(page: Int = 1, limit: Int = 20, type: String? = nil, startDate: String? = nil, endDate: String? = nil) async throws -> (transactions: [Transaction], pagination: TransactionsResponse.Pagination?) {
        var path = "/store-payment/transactions?page=\(page)&limit=\(limit)"
        if let type = type {
            path += "&type=\(type)"
        }
        if let startDate = startDate {
            path += "&startDate=\(startDate)"
        }
        if let endDate = endDate {
            path += "&endDate=\(endDate)"
        }

        let response: TransactionsResponse = try await APIManager.shared.get(path)

        guard response.isSuccess else {
            throw NetworkError.serverError(response.error ?? "获取交易记录失败")
        }
        
        if let data = response.data {
            Logger.info("📜 Transactions loaded: \(data.count)")
            for t in data {
                Logger.debug("   - \(t.type) \(t.itemName) Status: \(t.status)")
            }
        }

        return (response.data ?? [], response.pagination)
    }

    /// 获取商品详情
    func getItemDetails(itemId: String) async throws -> StoreItem {
        let path = "/store-payment/items/\(itemId)"

        let response: ItemDetailResponse = try await APIManager.shared.get(path)

        guard response.success, let item = response.data else {
            throw NetworkError.serverError(response.error ?? "获取商品详情失败")
        }

        return item
    }

    /// 获取推荐商品
    func getRecommendedItems() async throws -> [StoreItem] {
        let path = "/store-payment/recommended"

        let response: RecommendedItemsResponse = try await APIManager.shared.get(path)

        guard response.isSuccess else {
            throw NetworkError.serverError(response.error ?? "获取推荐商品失败")
        }

        return response.data ?? []
    }

    /// 获取每日使用限制
    func getDailyUsage(itemId: String) async throws -> DailyUsage {
        let path = "/store-payment/daily-usage/\(itemId)"

        let response: DailyUsageResponse = try await APIManager.shared.get(path)

        return response.data ?? DailyUsage(used: 0, limit: 0, remaining: 0, resetTime: "")
    }

    /// 创建充值会话
    func createRechargeSession(amountRmb: Double, channel: String = "mock") async throws -> RechargeSessionResponse.RechargeSessionData {
        let path = "/store-payment/recharge"

        let body: [String: Any] = [
            "amountRmb": amountRmb,
            "channel": channel
        ]

        let response: RechargeSessionResponse = try await APIManager.shared.post(path, parameters: body)

        guard response.ok, let data = response.data else {
            throw NetworkError.serverError(response.error ?? "创建充值会话失败")
        }

        return data
    }

    /// 确认支付
    func confirmPayment(orderId: String) async throws -> Bool {
        let path = "/store-payment/orders/\(orderId)/confirm"

        let response: ConfirmPaymentResponse = try await APIManager.shared.post(path, parameters: [:])

        guard response.isSuccess else {
            throw NetworkError.serverError(response.error ?? "确认支付失败")
        }

        return true
    }

    /// 获取充值订单列表
    func getRechargeOrders() async throws -> [RechargeOrder] {
        let path = "/store-payment/recharge-orders"

        let response: RechargeOrdersResponse = try await APIManager.shared.get(path)

        guard response.isSuccess else {
            throw NetworkError.serverError(response.error ?? "获取充值订单失败")
        }
        
        if let data = response.data {
             Logger.info("💳 Recharge orders loaded: \(data.count)")
             for o in data {
                 Logger.debug("   - Charge \(o.amountRmb) -> \(o.status)")
             }
        }

        return response.data ?? []
    }

    // MARK: - 辅助响应类型

    private struct ShopResponse: Codable {
        let success: Bool
        let data: [StoreItem]?
        let error: String?
    }

    private struct InventoryResponse: Codable {
        let success: Bool
        let data: [InventoryItem]?
        let error: String?
    }

    private struct ItemDetailResponse: Codable {
        let success: Bool
        let data: StoreItem?
        let error: String?
    }

    private struct DailyUsageResponse: Codable {
        let success: Bool
        let data: DailyUsage?
        let error: String?
    }

    private struct ConfirmPaymentResponse: Codable {
        let ok: Bool?
        let success: Bool?
        let data: ConfirmPaymentData?
        let error: String?
        
        var isSuccess: Bool {
            return ok == true || success == true
        }
        
        struct ConfirmPaymentData: Codable {
            let orderId: String
            let status: String
            let points: Int
        }
    }


}
