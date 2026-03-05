import SwiftUI

/// 商品卡片
struct ShopItemCard: View {
    @ObservedObject private var fontManager = FontSizeManager.shared
    let item: ShopService.StoreItem
    let inventoryCount: Int
    let userPoints: Int
    let onPurchase: () -> Void
    let onUse: (() -> Void)?

    @State private var isPurchasing = false

    private var canAfford: Bool {
        userPoints >= item.pricePoints
    }

    // Add cleaner init if needed or just update call sites
    init(item: ShopService.StoreItem, inventoryCount: Int = 0, userPoints: Int = 0, onPurchase: @escaping () -> Void, onUse: (() -> Void)? = nil) {
        self.item = item
        self.inventoryCount = inventoryCount
        self.userPoints = userPoints
        self.onPurchase = onPurchase
        self.onUse = onUse
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 6) { // Reduced spacing (was AppSpacing.s)
            // ... (keep existing top part unchanged) ...
            // 商品图标
            ZStack {
                RoundedRectangle(cornerRadius: AppRadius.m)
                    .fill(itemColor.opacity(0.15))
                    .frame(height: 70) // Reduced height (was 80)

                if Image.assetExists(itemIcon) {
                    Image(itemIcon)
                        .resizable()
                        .scaledToFit()
                        .frame(width: 40, height: 40) // Reduced icon
                        .blendMode(.multiply)
                } else if let imageUrl = item.imageUrl, let url = URL(string: imageUrl) {
                    CachedAsyncImagePhase(url: url) { phase in
                        switch phase {
                        case .success(let image):
                            image.resizable()
                                .scaledToFit()
                                .frame(width: 40, height: 40)
                                .blendMode(.multiply)
                        default:
                             Image(itemIcon)
                                .resizable()
                                .scaledToFit()
                                .frame(width: 40, height: 40)
                                .blendMode(.multiply)
                        }
                    }
                } else {
                    Image(itemIcon)
                        .resizable()
                        .scaledToFit()
                        .frame(width: 40, height: 40)
                        .blendMode(.multiply)
                }
            }
            .frame(maxWidth: .infinity)

            // Text Content
            VStack(alignment: .leading, spacing: 2) {
                // 商品名称
                Text(item.displayName)
                    .responsiveFont(.footnote)
                    .foregroundColor(AppColors.textPrimary)
                    .lineLimit(1)

                // 商品描述
                Text(item.displayDescription)
                    .responsiveFont(.caption2)
                    .foregroundColor(AppColors.textSecondary)
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)
                    .fixedSize(horizontal: false, vertical: true)
            }

            // Minimal Spacer to keep bottom alignment but allow compactness
            Spacer(minLength: 2)

            // 价格和购买按钮
            HStack(alignment: .bottom, spacing: 4) {
                VStack(alignment: .leading, spacing: 0) {
                    Text(String(format: NSLocalizedString("shop.price_points", comment: ""), item.pricePoints))
                        .responsiveFont(.caption)
                        .foregroundColor(canAfford ? AppColors.primary : .red)

                    if let priceCny = item.priceCny, priceCny > 0 {
                        Text("¥\(String(format: "%.2f", priceCny))")
                            .responsiveFont(.caption2)
                            .foregroundColor(AppColors.textTertiary)
                    }
                }
                .layoutPriority(1)

                Spacer(minLength: 4)

                // Smart Action Row
                if inventoryCount > 0, let onUse = onUse {
                    Button(action: {
                        // 1. Haptic Feedback
                        #if !targetEnvironment(simulator)
                        let generator = UIImpactFeedbackGenerator(style: .medium)
                        generator.impactOccurred()
                        #endif

                        // 2. Trigger Action
                        onUse()

                        // 3. Local Animation trigger if needed (button style handles press mostly)
                    }) {
                        HStack(spacing: 1) {
                            Image(systemName: "bolt.fill")
                                .responsiveFont(.caption2)
                                .symbolEffect(.pulse, options: .repeating, isActive: true) // Constant pulse for active items
                            Text("\(inventoryCount)")
                                .responsiveFont(.caption2)
                        }
                        .foregroundColor(AppColors.primary)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 6)
                        .background(
                            Capsule()
                                .strokeBorder(AppColors.primary.opacity(0.3), lineWidth: 1)
                        )
                        .background(
                            Capsule().fill(AppColors.primary.opacity(0.05))
                        )
                    }
                    .buttonStyle(ScaleButtonStyle()) // Add scale effect
                    .transition(.move(edge: .trailing).combined(with: .opacity))
                    .layoutPriority(2)
                }

                Button(action: onPurchase) {
                    Image(systemName: "plus")
                        .responsiveFont(.caption2, weight: .semibold)
                        .foregroundColor(.white)
                        .frame(width: 28, height: 28)
                        .background(canAfford ? AppColors.primary : Color.gray)
                        .clipShape(Circle())
                        .shadow(color: (canAfford ? AppColors.primary : Color.gray).opacity(0.3), radius: 3, x: 0, y: 2)
                }
                .disabled(!canAfford)
                .opacity(canAfford ? 1.0 : 0.6)
                .layoutPriority(3)
            }
        }
        .padding(10) // Reduced container padding (was AppSpacing.m which is usually 12 or 16)
        .background(AppColors.surface)
        .cornerRadius(AppRadius.l)
        .modifier(AppShadows.small())
    }

    private var itemColor: Color {
        // 1. Try metadata category
        if let category = item.metadata?.category {
            switch category {
            case "consumable": return .green
            case "special": return .orange
            case "cosmetic": return .purple
            case "ad_item": return .indigo
            default: break
            }
        }

        // 2. Try item type fallback
        switch item.itemType {
        case "consumable": return .green
        case "special": return .orange
        case "cosmetic": return .purple
        case "advertisement": return .indigo
        case "custom_flag": return .blue
        default: return Color(white: 0.95)
        }
    }

    private var itemIcon: String {
        // Specific Item ID Mapping
        let cleanIdString = item.id
            .replacingOccurrences(of: "item_", with: "")
            .replacingOccurrences(of: "flag_", with: "")

        if let id = Int(cleanIdString) {
            switch id {
            // Item Products
            case 25: return "IconItemFastRecovery"
            case 26: return "IconItemSuperRecovery"
            case 27: return "IconItemColorBomb"
            case 28: return "IconItemEmojiBomb"
            case 29: return "IconItemAllianceBomb"
            case 30: return "IconItemGoldenFrame"
            case 31: return "IconItemRainbowBubble"
            case 32: return "IconItemPixelMaster"

            // Flag Products (Colored)
            case 81...85: return "IconItemFlagColored"

            // Flag Products (Alliance)
            case 101...105: return "IconItemFlagAlliance"

            default: break
            }
        }

        // Fallback to Category/Type Mapping
        let typeOrCategory = item.metadata?.category ?? item.itemType

        switch typeOrCategory {
        case "consumable":
            return "IconShopConsumable"
        case "special":
            return "IconShopSpecial"
        case "cosmetic":
            return "IconShopCosmetic"
        case "ad_item", "advertisement":
            return "IconShopAd"
        default:
            return "IconShopDefault"
        }
    }
}
