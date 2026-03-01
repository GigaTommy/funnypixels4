import SwiftUI
import Combine

/// 商店视图模型
class ShopViewModel: ObservableObject {
    @Published var items: [ShopService.StoreItem] = []
    @Published var inventory: [ShopService.InventoryItem] = []
    @Published var userPoints: Int = 0
    @Published var isLoading = false
    @Published var errorMessage: String?

    // 支付会话
    @Published var paymentSession: ShopService.RechargeSessionResponse.RechargeSessionData?

    private let service = ShopService.shared

    /// 商品分类
    enum ItemCategory: String, CaseIterable {
        case all = "all"
        case consumable = "consumable"
        case special = "special"
        case cosmetic = "cosmetic"

        var displayName: String {
            switch self {
            case .all: return NSLocalizedString("shop.category.all", comment: "")
            case .consumable: return NSLocalizedString("shop.category.consumable", comment: "")
            case .special: return NSLocalizedString("shop.category.special", comment: "")
            case .cosmetic: return NSLocalizedString("shop.category.cosmetic", comment: "")
            }
        }
    }

    init() {
        // Initial load happens in onAppear
    }

    @MainActor
    func loadItems() async {
        guard !isLoading else { return }
        isLoading = true
        errorMessage = nil

        do {
            // 并行加载商品和用户积分
            async let itemsTask = service.getAllItems(activeOnly: true)
            async let pointsTask = service.getUserPoints()

            let (fetchedItems, points) = try await (itemsTask, pointsTask)

            self.items = fetchedItems
            self.userPoints = points
        } catch {
            self.errorMessage = String(format: NSLocalizedString("shop.error.load_failed", comment: ""), error.localizedDescription)
        }
        self.isLoading = false
    }

    @MainActor
    func loadInventory() async {
        isLoading = true
        errorMessage = nil

        do {
            self.inventory = try await service.getUserInventory()
        } catch {
            self.errorMessage = String(format: NSLocalizedString("shop.error.inventory_load_failed", comment: ""), error.localizedDescription)
        }
        self.isLoading = false
    }

    @MainActor
    func purchaseItem(_ itemId: String) async {
        guard !isLoading else { return }
        isLoading = true
        errorMessage = nil

        do {
             let result = try await service.purchaseItem(itemId: itemId)
             // Purchase successful
             self.userPoints = result.remainingPoints

             // Refresh inventory if needed
             await loadInventory()

             // Refresh Pixel Draw Service in case the item has immediate effects (e.g. direct points)
             try? await PixelDrawService.shared.refresh()

             // ✨ Success feedback
             SoundManager.shared.playSuccess()
             HapticManager.shared.notification(type: .success)
        } catch {
            self.errorMessage = String(format: NSLocalizedString("shop.error.purchase_failed", comment: ""), error.localizedDescription)

            // ✨ Failure feedback
            SoundManager.shared.playFailure()
            HapticManager.shared.notification(type: .error)

            await loadInventory()
        }

        isLoading = false
    }

    @MainActor
    func purchaseItemWithDetails(itemId: String, details: [String: Any]) async {
        guard !isLoading else { return }
        isLoading = true
        errorMessage = nil

        do {
            let result = try await service.purchaseItem(itemId: itemId, details: details)
             self.userPoints = result.remainingPoints
             // Refresh Pixel Draw Service
             try? await PixelDrawService.shared.refresh()

             // ✨ Success feedback
             SoundManager.shared.playSuccess()
             HapticManager.shared.notification(type: .success)
        } catch {
            self.errorMessage = String(format: NSLocalizedString("shop.error.purchase_failed", comment: ""), error.localizedDescription)

            // ✨ Failure feedback
            SoundManager.shared.playFailure()
            HapticManager.shared.notification(type: .error)
        }

        isLoading = false
    }

    @MainActor
    func useItem(_ itemId: String, targetId: String? = nil) async {
        isLoading = true
        errorMessage = nil

        do {
            _ = try await service.useItem(itemId: itemId, targetId: targetId)
            await loadInventory() // Reload inventory to reflect changes

            // Refresh Pixel Draw Service to update total pixels
            Logger.debug("🔄 [ShopViewModel] Refreshing pixel state after item usage...")
            do {
                try await PixelDrawService.shared.refresh()
                Logger.info("✅ [ShopViewModel] Pixel state refreshed")
            } catch {
                Logger.error("❌ [ShopViewModel] Failed to refresh pixel state: \(error.localizedDescription)")
            }

        } catch {
            self.errorMessage = String(format: NSLocalizedString("shop.error.use_failed", comment: ""), error.localizedDescription)
        }

        isLoading = false
    }

    // For RechargeViewModel simple functionality
    @MainActor
    func createRecharge(amount: Double, channel: String) async {
        isLoading = true
        errorMessage = nil

        do {
            let session = try await service.createRechargeSession(amountRmb: amount, channel: channel)
            self.paymentSession = session
        } catch {
            self.errorMessage = String(format: NSLocalizedString("shop.error.recharge_failed", comment: ""), error.localizedDescription)
        }

        isLoading = false
    }
}
