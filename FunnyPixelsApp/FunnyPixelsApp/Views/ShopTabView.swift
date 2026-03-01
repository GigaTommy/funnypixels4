import SwiftUI
import Combine
import CoreImage.CIFilterBuiltins
import StoreKit
import MapKit
import CoreLocation

/// 商店Tab视图
struct ShopTabView: View {
    @StateObject private var viewModel = ShopViewModel()
    @State private var selectedCategory: ShopViewModel.ItemCategory = .all
    @State private var showInventory = false
    @State private var showRecharge = false
    @State private var showPurchaseApproval = false
    @State private var showPurchaseConfirmation = false
    @State private var selectedItem: ShopService.StoreItem?
    @State private var showAlert = false
    @State private var alertMessage = ""
    @State private var showToast = false
    @State private var toastMessage = ""
    @State private var showInsufficientPointsAlert = false

    // Bomb location picker states
    @State private var showBombLocationPicker = false
    @State private var bombItemToUse: ShopService.StoreItem?
    @State private var bombTargetLocation: CLLocationCoordinate2D?
    @State private var bombLocationName: String?

    var body: some View {
        NavigationStack {
            ZStack {
                AppColors.background.ignoresSafeArea()

                VStack(spacing: 0) {
                    // 顶部积分显示
                    pointsHeader
                        .padding(.horizontal, AppSpacing.l)
                        .padding(.top, AppSpacing.m)

                    // 内容区域 (直接显示商店内容)
                    storeContentView
                }
            }
            .navigationTitle(NSLocalizedString("shop.title", comment: ""))
            .navigationBarTitleDisplayMode(.inline)
            .hideTabBar()
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button(action: {
                        showRecharge = true
                    }) {
                        ShopWalletIcon(size: 28)
                    }
                }
            }
            .sheet(isPresented: $showInventory) {
                InventoryView(viewModel: viewModel)
            }
            .sheet(isPresented: $showRecharge) {
                RechargeView { newPoints in
                    viewModel.userPoints += newPoints
                }
            }
            .sheet(isPresented: $showPurchaseApproval) {
                if let item = selectedItem {
                    PurchaseApprovalView(item: item, userPoints: viewModel.userPoints) { title, desc, image, location, time in
                        Task {
                            var details: [String: Any] = [
                                "adTitle": title,
                                "adDescription": desc
                            ]

                            if image.hasPrefix("http") {
                                details["imageUrl"] = image
                            } else {
                                details["imageData"] = image
                            }
                            if let location = location { details["targetLocation"] = location }
                            if let time = time {
                                let formatter = ISO8601DateFormatter()
                                details["scheduledTime"] = formatter.string(from: time)
                            }
                            await viewModel.purchaseItemWithDetails(itemId: item.id, details: details)
                        }
                    }
                }
            }
            .sheet(isPresented: $showBombLocationPicker) {
                BombLocationPickerView(
                    item: bombItemToUse,
                    selectedLocation: $bombTargetLocation,
                    locationName: $bombLocationName
                ) {
                    // On confirm: use the bomb at selected location
                    guard let item = bombItemToUse, let loc = bombTargetLocation else { return }
                    let targetId = "\(loc.latitude),\(loc.longitude)"
                    Task {
                        await viewModel.useItem(item.id, targetId: targetId)
                        if viewModel.errorMessage == nil {
                            toastMessage = String(format: NSLocalizedString("shop.item.used", comment: ""), item.displayName)
                            showToast = true
                        }
                    }
                }
            }
            .alert(
                NSLocalizedString("shop.purchase.confirm_title", comment: ""),
                isPresented: $showPurchaseConfirmation,
                presenting: selectedItem
            ) { item in
                Button(NSLocalizedString("shop.purchase.button", comment: "")) {
                    Task {
                        await viewModel.purchaseItem(item.id)
                    }
                }
                Button(NSLocalizedString("common.cancel", comment: ""), role: .cancel) { }
            } message: { item in
                Text(String(format: NSLocalizedString("shop.purchase.confirm_message", comment: ""), item.pricePoints, item.displayName))
            }
            .alert(NSLocalizedString("common.hint", comment: ""), isPresented: $showAlert) {
                Button(NSLocalizedString("common.confirm", comment: ""), role: .cancel) { }
            } message: {
                Text(alertMessage)
            }
            .alert(
                NSLocalizedString("shop.insufficient_points.title", comment: "积分不足"),
                isPresented: $showInsufficientPointsAlert,
                presenting: selectedItem
            ) { item in
                Button(NSLocalizedString("shop.insufficient_points.recharge", comment: "去充值")) {
                    showRecharge = true
                }
                Button(NSLocalizedString("common.cancel", comment: ""), role: .cancel) { }
            } message: { item in
                Text(String(format: NSLocalizedString("shop.insufficient_points.message", comment: ""), viewModel.userPoints, item.pricePoints))
            }
            .onAppear {
                Task {
                    await viewModel.loadItems()
                    await viewModel.loadInventory()
                }
            }
            .onChange(of: viewModel.errorMessage) { oldMessage, newMessage in
                if let message = newMessage {
                    alertMessage = message
                    showAlert = true
                }
            }
            .toast(isPresented: $showToast, message: toastMessage, style: .success)
        }
    }

    private var storeContentView: some View {
        VStack(spacing: 0) {
            // 分类筛选
            categoryPicker
                .padding(.vertical, AppSpacing.s)

            // 商品列表
            if viewModel.isLoading && viewModel.items.isEmpty {
                ProgressView(NSLocalizedString("common.loading", comment: ""))
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if viewModel.items.isEmpty {
                EmptyStateView(
                    title: NSLocalizedString("shop.empty.title", comment: ""),
                    message: NSLocalizedString("shop.empty.message", comment: ""),
                    systemImage: "bag"
                )
            } else {
                ScrollView {
                    LazyVGrid(columns: [GridItem(.flexible(), spacing: AppSpacing.m), GridItem(.flexible(), spacing: AppSpacing.m)], spacing: AppSpacing.m) {
                        ForEach(filteredItems) { item in
                            ShopItemCard(
                                item: item,
                                inventoryCount: getInventoryCount(for: item),
                                userPoints: viewModel.userPoints,
                                onPurchase: {
                                    // 检查积分是否足够
                                    guard viewModel.userPoints >= item.pricePoints else {
                                        selectedItem = item
                                        showInsufficientPointsAlert = true
                                        return
                                    }
                                    selectedItem = item
                                    if item.itemType == "advertisement" || item.itemType == "custom_flag" {
                                        showPurchaseApproval = true
                                    } else {
                                        showPurchaseConfirmation = true
                                    }
                                },
                                onUse: {
                                    if item.metadata?.bombType != nil {
                                        // Bomb item: show location picker first
                                        bombItemToUse = item
                                        bombTargetLocation = nil
                                        bombLocationName = nil
                                        showBombLocationPicker = true
                                    } else {
                                        Task {
                                            await viewModel.useItem(item.id)
                                            if viewModel.errorMessage == nil {
                                                toastMessage = String(format: NSLocalizedString("shop.item.used", comment: ""), item.displayName)
                                                showToast = true
                                            }
                                        }
                                    }
                                }
                            )
                        }
                    }

                    .padding(AppSpacing.l)
                    .padding(.bottom, AppSpacing.xxl) // Avoid TabBar overlap
                }
                .refreshable {
                    await viewModel.loadItems()
                }
            }
        }
    }

    private var pointsHeader: some View {
        StandardCard(padding: AppSpacing.m) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text(NSLocalizedString("shop.my_points", comment: ""))
                        .font(AppTypography.caption())
                        .foregroundColor(AppColors.textSecondary)
                    Text("\(viewModel.userPoints)")
                        .font(AppTypography.title2())
                        .foregroundColor(AppColors.primary)
                }

                Spacer()

                Button(action: {
                    showInventory = true
                }) {
                    HStack(spacing: 6) {
                        Image("IconAchievementShop") // Using Shop (Cart) for Backpack
                            .resizable()
                            .scaledToFit()
                            .frame(width: 20, height: 20)
                        Text(NSLocalizedString("shop.backpack", comment: ""))
                            .font(AppTypography.subheadline())
                    }
                    .foregroundColor(.white)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 8)
                    .background(AppColors.primary)
                    .cornerRadius(AppRadius.l)
                    .shadow(color: AppColors.primary.opacity(0.3), radius: 4, x: 0, y: 2)
                }
            }
        }
    }

    private var categoryPicker: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 12) {
                ForEach(ShopViewModel.ItemCategory.allCases, id: \.self) { category in
                    CategoryButton(
                        category: category,
                        isSelected: selectedCategory == category
                    ) {
                        withAnimation(.spring()) {
                            selectedCategory = category
                        }
                    }
                }
            }
            .padding(.horizontal, AppSpacing.l)
        }
    }

    private var filteredItems: [ShopService.StoreItem] {
        let activeItems = viewModel.items.filter { $0.active }

        if selectedCategory == .all {
            return activeItems
        }

        return activeItems.filter { item in
            // 1. Try metadata category
            if let categoryName = item.metadata?.category {
                return categoryName == selectedCategory.rawValue
            }

            // 2. Try item type fallback
            switch selectedCategory {
            case .consumable:
                return item.itemType == "consumable"
            case .special:
                return item.itemType == "special"
            case .cosmetic:
                return item.itemType == "cosmetic" || item.itemType == "custom_flag"
            default:
                return false
            }
        }
    }
    private func getInventoryCount(for item: ShopService.StoreItem) -> Int {
        // 1. Precise Match (ID)
        if let invItem = viewModel.inventory.first(where: { String(describing: $0.itemId) == item.id }) {
            return invItem.quantity
        }

        // 2. Fallback: Advertisement Type Match
        // If the shop item is an advertisement (judged by itemType or metadata.category),
        // check if we have ANY advertisement items in inventory.
        // Assuming 'itemType' == 'advertisement' or checking category.
        if item.itemType == "advertisement" || item.metadata?.category == "advertisement" {
             // Sum up all advertisement items in inventory?
             // Or find first one that looks like an ad?
             // Let's assume inventory has items with itemType="advertisement"
             let adCount = viewModel.inventory.filter { $0.itemType == "advertisement" }.reduce(0) { $0 + $1.quantity }
             if adCount > 0 { return adCount }
        }

        return 0
    }
}

/// 分类按钮
struct CategoryButton: View {
    let category: ShopViewModel.ItemCategory
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(category.displayName)
            .font(AppTypography.subheadline())
            .foregroundColor(isSelected ? .white : AppColors.primary)
            .padding(.horizontal, 16)
            .padding(.vertical, 8)
            .background(isSelected ? AppColors.primary : AppColors.primary.opacity(0.1))
            .cornerRadius(AppRadius.l)
        }
    }
}

/// 充值视图
struct RechargeView: View {
    let onSuccess: (Int) -> Void
    @Environment(\.dismiss) private var dismiss
    @StateObject private var rechargeViewModel = RechargeViewModel()
    @StateObject private var transactionsViewModel = TransactionsViewModel()
    @ObservedObject private var storeKitManager = StoreKitManager.shared

    @State private var selectedTab = 0
    @State private var showPaymentAlert = false
    @State private var paymentMessage = ""
    @State private var historyType = 0 // 0: Recharge, 1: Spending

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Tab Picker
                Picker("Type", selection: $selectedTab) {
                    Text(NSLocalizedString("wallet.tab.recharge", comment: "")).tag(0)
                    Text(NSLocalizedString("wallet.tab.bills", comment: "")).tag(1)
                }
                .pickerStyle(.segmented)
                .padding()

                if selectedTab == 0 {
                    rechargeContent
                } else {
                    historyContent
                }
            }
            .navigationTitle(NSLocalizedString("wallet.title", comment: ""))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button(NSLocalizedString("common.done", comment: "")) {
                        dismiss()
                    }
                }
            }
            .alert(NSLocalizedString("wallet.payment_hint", comment: ""), isPresented: $showPaymentAlert) {
                Button(NSLocalizedString("common.confirm", comment: ""), role: .cancel) { }
            } message: {
                Text(paymentMessage)
            }
        }
    }

    private var rechargeContent: some View {
        ScrollView {
            VStack(spacing: AppSpacing.l) {
                // Apple In-App Purchase 商品列表
                VStack(alignment: .leading, spacing: AppSpacing.m) {
                    Text(NSLocalizedString("wallet.select_amount", comment: ""))
                        .font(AppTypography.headline())
                        .foregroundColor(AppColors.textPrimary)
                        .padding(.horizontal)

                    if storeKitManager.isLoading {
                        ProgressView(NSLocalizedString("wallet.loading_products", comment: ""))
                            .frame(maxWidth: .infinity)
                            .padding()
                    } else if storeKitManager.products.isEmpty {
                        VStack(spacing: 12) {
                            Image(systemName: "exclamationmark.triangle")
                                .font(.system(size: 40))
                                .foregroundColor(.orange)
                            Text(NSLocalizedString("wallet.no_products", comment: ""))
                                .font(AppTypography.body())
                                .foregroundColor(AppColors.textSecondary)
                            Button(NSLocalizedString("wallet.retry_load", comment: "")) {
                                Task {
                                    await storeKitManager.loadProducts()
                                }
                            }
                            .font(AppTypography.subheadline())
                            .foregroundColor(AppColors.primary)
                        }
                        .frame(maxWidth: .infinity)
                        .padding()
                    } else {
                        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: AppSpacing.m) {
                            ForEach(storeKitManager.products) { product in
                                AppleIAPPackageButton(
                                    product: product,
                                    isLoading: storeKitManager.isLoading,
                                    action: { handleAppleIAPPurchase(product: product) }
                                )
                            }
                        }
                        .padding(.horizontal)
                    }

                    // 恢复购买按钮
                    Button {
                        Task {
                            await storeKitManager.restorePurchases()
                            paymentMessage = NSLocalizedString("wallet.restore_completed", comment: "")
                            showPaymentAlert = true
                        }
                    } label: {
                        Text(NSLocalizedString("wallet.restore_purchases", comment: ""))
                            .font(AppTypography.caption())
                            .foregroundColor(AppColors.primary)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.top, 8)
                }
            }
            .padding(.vertical)
        }
    }

    private var historyContent: some View {
        VStack(spacing: 0) {
            // Sub-Filter
            HStack {
                Button(action: { historyType = 0 }) {
                    Text(NSLocalizedString("wallet.recharge_history", comment: ""))
                        .font(AppTypography.subheadline())
                        .foregroundColor(historyType == 0 ? .white : AppColors.textSecondary)
                        .padding(.horizontal, 16)
                        .padding(.vertical, 6)
                        .background(historyType == 0 ? AppColors.primary : Color.clear)
                        .clipShape(Capsule())
                }

                Button(action: { historyType = 1 }) {
                    Text(NSLocalizedString("wallet.spending_history", comment: ""))
                        .font(AppTypography.subheadline())
                        .foregroundColor(historyType == 1 ? .white : AppColors.textSecondary)
                        .padding(.horizontal, 16)
                        .padding(.vertical, 6)
                        .background(historyType == 1 ? AppColors.primary : Color.clear)
                        .clipShape(Capsule())
                }
                Spacer()
            }
            .padding(.horizontal)
            .padding(.vertical, 8)
            .background(AppColors.surface)

            if historyType == 0 {
                // Recharge History
                if rechargeViewModel.rechargeOrders.isEmpty {
                    EmptyStateView(title: NSLocalizedString("wallet.empty_recharge.title", comment: ""), message: NSLocalizedString("wallet.empty_recharge.message", comment: ""), systemImage: "yensign.circle")
                } else {
                    List {
                        ForEach(rechargeViewModel.rechargeOrders) { order in
                            HStack {
                                VStack(alignment: .leading, spacing: 4) {
                                    Text(String(format: NSLocalizedString("wallet.recharge_points", comment: ""), order.amountPoints))
                                        .font(AppTypography.body())
                                        .fontWeight(.medium)
                                    Text(order.createdAt)
                                        .font(AppTypography.caption())
                                        .foregroundColor(AppColors.textSecondary)
                                }
                                Spacer()
                                VStack(alignment: .trailing, spacing: 4) {
                                    Text("¥\(String(format: "%.2f", order.amountRmb))")
                                        .font(AppTypography.body())
                                        .fontWeight(.medium)
                                    Text(orderStatusText(order.status))
                                        .font(AppTypography.caption())
                                        .foregroundColor(orderStatusColor(order.status))
                                }
                            }
                        }
                    }
                    .listStyle(.plain)
                    .refreshable { await rechargeViewModel.loadHistory() }
                }
            } else {
                // Spending History
                if transactionsViewModel.transactions.isEmpty {
                    EmptyStateView(title: NSLocalizedString("wallet.empty_spending.title", comment: ""), message: NSLocalizedString("wallet.empty_spending.message", comment: ""), systemImage: "cart")
                } else {
                    List {
                        ForEach(transactionsViewModel.transactions) { transaction in
                            TransactionRow(transaction: transaction)
                        }
                    }
                    .listStyle(.plain)
                    .refreshable { transactionsViewModel.loadData() }
                }
            }
        }
        .task {
            // Load both
            await rechargeViewModel.loadHistory()
            transactionsViewModel.loadData()
        }
    }

    private func handleAppleIAPPurchase(product: Product) {
        Task {
            // 开始购买流程
            if let pointsGained = await storeKitManager.purchase(product) {
                // 购买成功
                await MainActor.run {
                    onSuccess(pointsGained)
                    paymentMessage = String(format: NSLocalizedString("wallet.payment_success", comment: ""), pointsGained)
                    showPaymentAlert = true

                    // ✨ Apple purchase success feedback
                    SoundManager.shared.playSuccess()
                    HapticManager.shared.notification(type: .success)
                }

                // 刷新历史记录
                await rechargeViewModel.loadHistory()
            } else if let error = storeKitManager.errorMessage {
                // 购买失败或取消
                await MainActor.run {
                    paymentMessage = error
                    showPaymentAlert = true

                    // ✨ Apple purchase failure feedback
                    SoundManager.shared.playFailure()
                    HapticManager.shared.notification(type: .error)
                }
            }
        }
    }

    private func orderStatusText(_ status: String) -> String {
        switch status {
        case "pending": return NSLocalizedString("order.status.pending", comment: "")
        case "paid", "completed": return NSLocalizedString("order.status.completed", comment: "")
        case "failed": return NSLocalizedString("order.status.failed", comment: "")
        default: return status
        }
    }

    private func orderStatusColor(_ status: String) -> Color {
        switch status {
        case "pending": return .orange
        case "paid", "completed": return .green
        case "failed": return .red
        default: return .secondary
        }
    }
}

/// Apple IAP 充值套餐按钮
struct AppleIAPPackageButton: View {
    let product: Product
    let isLoading: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 8) {
                Image(systemName: "bitcoinsign.circle.fill")
                    .resizable()
                    .scaledToFit()
                    .frame(width: 40, height: 40)
                    .foregroundColor(AppColors.warning)

                Text(String(format: NSLocalizedString("shop.price_points", comment: ""), product.pointsAmount))
                    .font(AppTypography.headline())
                    .foregroundColor(AppColors.textPrimary)

                Text(product.displayPrice)
                    .font(AppTypography.subheadline())
                    .foregroundColor(AppColors.primary)
            }
            .padding(AppSpacing.m)
            .frame(maxWidth: .infinity)
            .background(AppColors.surface)
            .cornerRadius(AppRadius.m)
            .modifier(AppShadows.small())
            .overlay(
                RoundedRectangle(cornerRadius: AppRadius.m)
                    .stroke(AppColors.primary.opacity(0.1), lineWidth: 1)
            )
        }
        .disabled(isLoading)
        .opacity(isLoading ? 0.5 : 1.0)
    }
}

/// 充值套餐按钮（已弃用 - 保留以兼容其他代码）
struct RechargePackageButton: View {
    let points: Int
    let price: Double
    let appleProduct: Product?
    let isAppleChannel: Bool
    let isLoading: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 8) {
                Image(systemName: "bitcoinsign.circle.fill")
                    .resizable()
                    .scaledToFit()
                    .frame(width: 40, height: 40)
                    .foregroundColor(AppColors.warning)

                Text(String(format: NSLocalizedString("shop.price_points", comment: ""), points))
                    .font(AppTypography.headline())
                    .foregroundColor(AppColors.textPrimary)

                // 显示价格
                priceLabel
            }
            .padding(AppSpacing.m)
            .frame(maxWidth: .infinity)
            .background(AppColors.surface)
            .cornerRadius(AppRadius.m)
            .modifier(AppShadows.small())
            .overlay(
                RoundedRectangle(cornerRadius: AppRadius.m)
                    .stroke(AppColors.primary.opacity(0.1), lineWidth: 1)
            )
        }
        .disabled(isLoading || (isAppleChannel && appleProduct == nil))
        .opacity((isAppleChannel && appleProduct == nil) ? 0.5 : 1.0)
    }

    @ViewBuilder
    private var priceLabel: some View {
        if isAppleChannel {
            if let product = appleProduct {
                Text(product.displayPrice)
                    .font(AppTypography.subheadline())
                    .foregroundColor(AppColors.primary)
            } else {
                Text(NSLocalizedString("common.loading", comment: ""))
                    .font(AppTypography.caption())
                    .foregroundColor(AppColors.textSecondary)
            }
        } else {
            Text("¥\(String(format: "%.0f", price))")
                .font(AppTypography.subheadline())
                .foregroundColor(AppColors.primary)
        }
    }
}
