import SwiftUI
import MapKit
import CoreLocation

/// 库存视图
struct InventoryView: View {
    @ObservedObject private var fontManager = FontSizeManager.shared
    @Environment(\.dismiss) private var dismiss
    @ObservedObject var viewModel: ShopViewModel

    // Bomb location picker states
    @State private var showBombLocationPicker = false
    @State private var bombInventoryItemId: String?
    @State private var bombStoreItem: ShopService.StoreItem?
    @State private var bombTargetLocation: CLLocationCoordinate2D?
    @State private var bombLocationName: String?

    var body: some View {
        NavigationStack {
            ZStack {
                AppColors.background.ignoresSafeArea()

                if viewModel.inventory.isEmpty {
                    EmptyStateView(
                        title: NSLocalizedString("inventory.empty.title", comment: ""),
                        message: NSLocalizedString("inventory.empty.message", comment: ""),
                        systemImage: "backpack.fill"
                    )
                } else {
                    List {
                        ForEach(viewModel.inventory) { item in

                            // Robust Matching Strategy
                            // 1. Precise Match
                            let preciseMatch = viewModel.items.first(where: { $0.id == item.itemId })

                            // 2. Type Match (Fallback for Ads/Special items where IDs might differ)
                            let typeMatch = preciseMatch ?? viewModel.items.first(where: {
                                // Only fallback if types roughly match and we are desperate
                                // e.g. Inventory "advertisement" -> Shop "advertisement"
                                $0.itemType == item.itemType && ($0.itemType == "advertisement" || $0.itemType == "special")
                            })

                            let storeItem = preciseMatch ?? typeMatch

                            InventoryItemRow(item: item, storeItem: storeItem) {
                                if storeItem?.metadata?.bombType != nil {
                                    // Bomb item: show location picker first
                                    bombInventoryItemId = item.itemId
                                    bombStoreItem = storeItem
                                    bombTargetLocation = nil
                                    bombLocationName = nil
                                    showBombLocationPicker = true
                                } else {
                                    Task {
                                        await viewModel.useItem(item.itemId)
                                    }
                                }
                            }
                            .listRowBackground(AppColors.surface)
                        }
                    }
                    .listStyle(.plain)
                    .refreshable {
                        await viewModel.loadInventory()
                    }
                }
            }
            .navigationTitle(NSLocalizedString("inventory.title", comment: ""))
            .navigationBarTitleDisplayMode(.inline)
        .hideTabBar()
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button(action: { dismiss() }) {
                        Text(NSLocalizedString("common.done", comment: ""))
                            .font(AppTypography.body())
                            .fontWeight(.medium)
                    }
                }
            }
            .sheet(isPresented: $showBombLocationPicker) {
                BombLocationPickerView(
                    item: bombStoreItem,
                    selectedLocation: $bombTargetLocation,
                    locationName: $bombLocationName
                ) {
                    guard let itemId = bombInventoryItemId, let loc = bombTargetLocation else { return }
                    let targetId = "\(loc.latitude),\(loc.longitude)"
                    Task {
                        await viewModel.useItem(itemId, targetId: targetId)
                    }
                }
            }
            .onAppear {
                Task {
                    // Refresh inventory, but also rely on VM's existing items
                    await viewModel.loadInventory()
                }
            }
        }
    }
}

/// 库存项行
struct InventoryItemRow: View {
    let item: ShopService.InventoryItem
    var storeItem: ShopService.StoreItem? = nil
    let onUse: () -> Void

    var body: some View {
        HStack(spacing: 8) { // Compact spacing
            // 图标
            ZStack {
                RoundedRectangle(cornerRadius: 8) // Slightly smaller radius
                    .fill(itemColor.opacity(0.1))
                    .frame(width: 40, height: 40) // Smaller icon container (was 48)

                if Image.assetExists(itemIcon) {
                    Image(itemIcon)
                        .resizable()
                        .scaledToFit()
                        .frame(width: 24, height: 24) // Smaller icon (was 32)
                        .blendMode(.multiply)
                } else if let imageUrl = storeItem?.imageUrl, let url = URL(string: imageUrl) {
                     CachedAsyncImagePhase(url: url) { phase in
                         switch phase {
                         case .success(let image):
                             image.resizable()
                                 .scaledToFit()
                                 .frame(width: 24, height: 24)
                                 .blendMode(.multiply)
                         default:
                             Image(itemIcon)
                                 .resizable()
                                 .scaledToFit()
                                 .frame(width: 24, height: 24)
                                 .blendMode(.multiply)
                         }
                     }
                } else {
                    Image(itemIcon)
                        .resizable()
                        .scaledToFit()
                        .frame(width: 24, height: 24)
                        .blendMode(.multiply)
                }
            }

            // Name + Quantity (One Line)
            HStack(spacing: 4) {
                // Fix: Prefer storeItem.name (rich metadata) over inventoryItem.displayName (potential fallback ID)
                Text(storeItem?.name ?? item.displayName)
                    .responsiveFont(.subheadline, weight: .medium)
                    .foregroundColor(AppColors.textPrimary)
                    .lineLimit(1)

                Text("x\(item.quantity)")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundColor(AppColors.primary)
            }
            .layoutPriority(1)

            Spacer()

            // 使用按钮 (Compact) - 广告和自定义旗帜不显示使用按钮（审批后自动投放）
            if item.quantity > 0 && item.itemType != "advertisement" && item.itemType != "custom_flag" {
                Button(action: onUse) {
                    Text(NSLocalizedString("inventory.use", comment: ""))
                        .responsiveFont(.caption2, weight: .medium)
                        .foregroundColor(AppColors.primary)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 6)
                        .background(
                            Capsule()
                                .strokeBorder(AppColors.primary.opacity(0.3), lineWidth: 1)
                        )
                        .background(
                            Capsule().fill(AppColors.primary.opacity(0.05))
                        )
                }
            }
        }
        .padding(.vertical, 4) // Very tight vertical padding
    }

    private var itemColor: Color {
        // 1. Try item type
        switch item.itemType {
        case "consumable": return .green
        case "special": return .orange
        case "cosmetic": return .purple
        case "advertisement": return .indigo
        case "custom_flag": return .blue
        default: return AppColors.textSecondary
        }
    }

    private var itemIcon: String {
        // Specific Item ID Mapping
        if let id = Int(item.itemId) {
            switch id {
            case 43: return "IconItemFastRecovery"
            case 44: return "IconItemSuperRecovery"
            case 45: return "IconItemColorBomb"
            case 46: return "IconItemGoldenFrame"
            case 47: return "IconItemRainbowBubble"
            case 48: return "IconItemPixelMaster"
            default: break
            }
        }

        switch item.itemType {
        case "consumable":
            return "IconShopConsumable"
        case "special":
            return "IconShopSpecial"
        case "cosmetic":
            return "IconShopCosmetic"
        case "advertisement":
            return "IconShopAd"
        default:
            return "IconShopDefault"
        }
    }
}
