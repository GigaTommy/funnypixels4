import Foundation
import StoreKit
import Combine

/// StoreKit 2 管理器 - 处理 Apple In-App Purchase
@MainActor
class StoreKitManager: ObservableObject {
    static let shared = StoreKitManager()

    /// 可购买的商品
    @Published private(set) var products: [Product] = []
    /// 正在处理的购买
    @Published private(set) var purchasedProductIDs: Set<String> = []
    /// 加载状态
    @Published private(set) var isLoading = false
    /// 错误信息
    @Published var errorMessage: String?

    /// 商品ID映射到积分数量
    /// 格式: com.funnypixels.points.{amount}
    /// 基准汇率: $1 ≈ 100 积分, 大额递增赠送 10-30%
    /// Tier 1 $0.99 = 100pt | Tier 2 $2.99 = 330pt (+10%)
    /// Tier 3 $4.99 = 580pt (+16%) | Tier 4 $9.99 = 1200pt (+20%) ⭐推荐
    /// Tier 5 $29.99 = 3800pt (+27%) | Tier 6 $49.99 = 6500pt (+30%)
    private let productPointsMap: [String: Int] = [
        "com.funnypixels.points.100": 100,
        "com.funnypixels.points.330": 330,
        "com.funnypixels.points.580": 580,
        "com.funnypixels.points.1200": 1200,
        "com.funnypixels.points.3800": 3800,
        "com.funnypixels.points.6500": 6500
    ]

    /// 所有商品ID
    private var productIDs: [String] {
        Array(productPointsMap.keys).sorted()
    }

    private var updateListenerTask: Task<Void, Error>?

    private init() {
        // 支付模块待接入 Stripe 后开放，暂停 StoreKit 交易监听和商品加载
        // updateListenerTask = listenForTransactions()
        // Task {
        //     await loadProducts()
        // }
    }

    deinit {
        updateListenerTask?.cancel()
    }

    // MARK: - Public Methods

    /// 加载App Store商品列表
    func loadProducts() async {
        isLoading = true
        errorMessage = nil

        do {
            let storeProducts = try await Product.products(for: productIDs)
            // 按价格排序
            products = storeProducts.sorted { $0.price < $1.price }
            Logger.info("✅ Loaded \(products.count) IAP products")

            for product in products {
                Logger.debug("  - \(product.id): \(product.displayPrice)")
            }
        } catch {
            Logger.error("❌ Failed to load IAP products: \(error)")
            errorMessage = "无法加载商品信息"
        }

        isLoading = false
    }

    /// 购买商品
    /// - Parameter product: 要购买的商品
    /// - Returns: 购买成功获得的积分数，失败返回nil
    func purchase(_ product: Product) async -> Int? {
        isLoading = true
        errorMessage = nil

        do {
            let result = try await product.purchase()

            switch result {
            case .success(let verification):
                // 验证交易
                let transaction = try checkVerified(verification)

                // 获取积分数量
                let points = productPointsMap[product.id] ?? 0

                // 向后端验证并发放积分
                let verified = await verifyWithBackend(transaction: transaction, points: points)

                if verified {
                    // 完成交易
                    await transaction.finish()
                    Logger.info("✅ Purchase completed: \(product.id), points: \(points)")
                    isLoading = false
                    return points
                } else {
                    errorMessage = "服务器验证失败，请联系客服"
                    isLoading = false
                    return nil
                }

            case .userCancelled:
                Logger.info("User cancelled purchase")
                isLoading = false
                return nil

            case .pending:
                Logger.info("Purchase pending (e.g., parental approval)")
                errorMessage = "购买待确认（可能需要家长批准）"
                isLoading = false
                return nil

            @unknown default:
                Logger.warning("Unknown purchase result")
                isLoading = false
                return nil
            }
        } catch StoreKitError.userCancelled {
            Logger.info("User cancelled purchase")
            isLoading = false
            return nil
        } catch {
            Logger.error("❌ Purchase failed: \(error)")
            errorMessage = "购买失败: \(error.localizedDescription)"
            isLoading = false
            return nil
        }
    }

    /// 恢复购买（对于消耗型商品通常不需要，但保留接口）
    func restorePurchases() async {
        isLoading = true
        errorMessage = nil

        do {
            try await AppStore.sync()
            Logger.info("✅ Restored purchases")
        } catch {
            Logger.error("❌ Failed to restore purchases: \(error)")
            errorMessage = "恢复购买失败"
        }

        isLoading = false
    }

    /// 根据积分数量获取对应商品
    func product(forPoints points: Int) -> Product? {
        let productID = "com.funnypixels.points.\(points)"
        return products.first { $0.id == productID }
    }

    // MARK: - Private Methods

    /// 监听交易更新
    private func listenForTransactions() -> Task<Void, Error> {
        return Task.detached {
            for await result in StoreKit.Transaction.updates {
                do {
                    let transaction = try await self.checkVerified(result)

                    // 处理未完成的交易
                    let points = await MainActor.run {
                        self.productPointsMap[transaction.productID] ?? 0
                    }

                    if points > 0 {
                        let verified = await self.verifyWithBackend(transaction: transaction, points: points)
                        if verified {
                            await transaction.finish()
                            Logger.info("✅ Finished pending transaction: \(transaction.productID)")
                        }
                    }
                } catch {
                    Logger.error("❌ Transaction verification failed: \(error)")
                }
            }
        }
    }

    /// 验证交易签名
    private func checkVerified<T>(_ result: VerificationResult<T>) throws -> T {
        switch result {
        case .unverified(_, let error):
            throw error
        case .verified(let safe):
            return safe
        }
    }

    /// 向后端验证交易并发放积分
    private func verifyWithBackend(transaction: StoreKit.Transaction, points: Int) async -> Bool {
        do {
            // 获取原始交易数据用于服务器验证
            guard let appStoreReceiptURL = Bundle.main.appStoreReceiptURL,
                  FileManager.default.fileExists(atPath: appStoreReceiptURL.path) else {
                Logger.error("❌ No App Store receipt found")
                return false
            }

            let receiptData = try Data(contentsOf: appStoreReceiptURL)
            let receiptString = receiptData.base64EncodedString()

            // 调用后端验证API
            let parameters: [String: Any] = [
                "receipt": receiptString,
                "transaction_id": String(transaction.id),
                "product_id": transaction.productID,
                "points": points,
                "environment": transaction.environment.rawValue
            ]

            let response: AppleIAPVerifyResponse = try await APIManager.shared.post(
                "/store-payment/apple/verify",
                parameters: parameters
            )

            if response.success {
                Logger.info("✅ Backend verified Apple IAP: +\(response.pointsAdded) points")
                return true
            } else {
                Logger.error("❌ Backend rejected Apple IAP: \(response.message ?? "Unknown error")")
                return false
            }
        } catch {
            Logger.error("❌ Backend verification request failed: \(error)")
            // 如果是网络错误，交易会保留待后续处理
            return false
        }
    }
}

// MARK: - Response Models

struct AppleIAPVerifyResponse: Codable {
    let success: Bool
    let message: String?
    let pointsAdded: Int
    let newBalance: Int?

    enum CodingKeys: String, CodingKey {
        case success, message
        case pointsAdded = "points_added"
        case newBalance = "new_balance"
    }
}

// MARK: - Product Extension

extension Product {
    /// 获取格式化的价格显示
    var localizedPrice: String {
        return displayPrice
    }

    /// 获取对应的积分数量
    var pointsAmount: Int {
        // 从商品ID解析积分数量
        // 格式: com.funnypixels.points.{amount}
        let components = id.split(separator: ".")
        if let lastComponent = components.last,
           let points = Int(lastComponent) {
            return points
        }
        return 0
    }
}
