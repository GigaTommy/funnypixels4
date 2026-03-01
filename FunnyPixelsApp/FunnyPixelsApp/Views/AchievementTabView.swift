import SwiftUI
import Combine




/// 成就Tab视图
struct AchievementTabView: View {
    @StateObject private var viewModel = AchievementViewModel()
    @EnvironmentObject var authViewModel: AuthViewModel
    @State private var showShareSheet = false
    @State private var shareImage: UIImage?
    @Environment(\.displayScale) var displayScale

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // 统计概览卡片
                if let stats = viewModel.userStats {
                    AchievementStatsCard(stats: stats)
                        .padding()
                }

                // 分类选择器
                categoryPicker

                // 成就列表
                if viewModel.isLoading && viewModel.achievements.isEmpty {
                    ProgressView(NSLocalizedString("common.loading", comment: ""))
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if filteredAchievements.isEmpty {
                    emptyStateView
                } else {
                    ScrollView {
                        LazyVStack(spacing: 12) {
                            ForEach(filteredAchievements) { achievement in
                                AchievementCard(achievement: achievement, onClaim: {
                                    Task {
                                        await viewModel.claimReward(achievementId: achievement.id)
                                    }
                                }, onShare: {
                                    renderAndShare(achievement: achievement)
                                })
                            }
                        }
                        .padding()
                    }
                }
            }
            .navigationTitle(NSLocalizedString("profile.achievements", comment: ""))
            .navigationBarTitleDisplayMode(.inline)
            .hideTabBar()
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button(action: {
                        Task {
                            await viewModel.refresh()
                        }
                    }) {
                        Image(systemName: "arrow.clockwise")
                    }
                }
            }
            .onAppear {
                viewModel.loadAchievements()
            }
            .refreshable {
                await viewModel.refresh()
            }
        }
        .overlay {
            if viewModel.showSuccessAlert {
                AchievementCelebrationOverlay(message: viewModel.successMessage) {
                    viewModel.showSuccessAlert = false
                }
            }
        }
        .alert(NSLocalizedString("common.error", comment: ""), isPresented: $viewModel.showError) {
            Button(NSLocalizedString("common.confirm", comment: "")) {}
        } message: {
            Text(viewModel.errorMessage)
        }
        .sheet(isPresented: $showShareSheet) {
            if let image = shareImage {
                ShareSheet(activityItems: [image])
            }
        }
    }

    private var categoryPicker: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 12) {
                ForEach(AchievementService.AchievementCategory.allCases, id: \.self) { category in
                    AchievementCategoryButton(
                        category: category,
                        isSelected: viewModel.selectedCategory == category.rawValue
                    ) {
                        withAnimation(.spring()) {
                            viewModel.selectedCategory = category.rawValue
                        }
                    }
                }
            }
            .padding(.horizontal)
        }
        .padding(.vertical, 8)
    }

    private var filteredAchievements: [AchievementService.UserAchievement] {
        if viewModel.selectedCategory == "all" {
            return viewModel.achievements
        }
        return viewModel.achievements.filter { $0.category == viewModel.selectedCategory }
    }

    private var emptyStateView: some View {
        VStack(spacing: 16) {
            Image("IconAchievementPixels")
                .resizable()
                .scaledToFit()
                .frame(width: 80, height: 80)
                .foregroundColor(.secondary)

            Text(NSLocalizedString("achievement.empty.title", comment: ""))
                .font(.headline)
                .foregroundColor(.secondary)

            Text(NSLocalizedString("achievement.empty.message", comment: ""))
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
    private func renderAndShare(achievement: AchievementService.UserAchievement) {
        guard let user = authViewModel.currentUser else { return }
        
        let profile = ProfileViewModel.UserProfile(
            id: user.id,
            username: user.username,
            email: user.email,
            phone: nil,
            avatarUrl: user.avatarUrl,  // ✅ 使用avatar_url（CDN路径）
            avatar: nil,                 // ❌ 不使用avatar（仅用于编辑）
            motto: nil,
            displayName: user.displayOrUsername,
            points: nil,
            totalPixels: user.totalPixels,
            flagPatternId: user.alliance?.flagPatternId,
            rankTier: user.rankTier
        )
        
        let view = AchievementShareView(achievement: achievement, userProfile: profile)
        let renderer = ImageRenderer(content: view)
        renderer.scale = displayScale
        
        if let image = renderer.uiImage {
            self.shareImage = image
            self.showShareSheet = true
        }
    }
}

/// 成就统计卡片
struct AchievementStatsCard: View {
    let stats: AchievementService.UserAchievementStats

    var body: some View {
        VStack(spacing: 16) {
            Text(NSLocalizedString("achievement.stats.title", comment: ""))
                .font(.headline)
                .frame(maxWidth: .infinity, alignment: .leading)

            HStack(spacing: 16) {
                AchievementStatItem(icon: "IconAchievementSpecial", title: NSLocalizedString("achievement.stats.unlocked", comment: ""), value: "\(stats.totalPoints)", isSystemIcon: false)
                AchievementStatItem(icon: "IconAchievementPixels", title: NSLocalizedString("achievement.stats.total", comment: ""), value: "\(stats.totalAchievements ?? 0)", isSystemIcon: false)
            }

            HStack(spacing: 16) {
                AchievementStatItem(icon: "IconAchievementActivity", title: NSLocalizedString("achievement.stats.pixels", comment: ""), value: "\(stats.pixelsDrawnCount)", isSystemIcon: false)
                AchievementStatItem(icon: "IconAchievementLikes", title: NSLocalizedString("achievement.stats.likes", comment: ""), value: "\(stats.likeReceivedCount)", isSystemIcon: false)
            }
        }
        .padding()
        .background(
            LinearGradient(
                gradient: Gradient(colors: [Color.blue.opacity(0.1), Color.purple.opacity(0.1)]),
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        )
        .cornerRadius(16)
        .overlay(
            RoundedRectangle(cornerRadius: 16)
                .stroke(Color.blue.opacity(0.2), lineWidth: 1)
        )
    }
}

/// 统计项
struct AchievementStatItem: View {
    let icon: String
    let title: String
    let value: String
    var isSystemIcon: Bool = true

    var body: some View {
        VStack(spacing: 8) {
            if isSystemIcon {
                Image(systemName: icon)
                    .font(.title2)
                    .foregroundColor(.blue)
            } else {
                Image(icon)
                    .resizable()
                    .scaledToFit()
                    .frame(width: 32, height: 32)
                    .blendMode(.multiply)
            }

            VStack(spacing: 2) {
                Text(value)
                    .font(.headline)
                Text(title)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
        .frame(maxWidth: .infinity)
    }
}

/// 成就卡片
struct AchievementCard: View {
    let achievement: AchievementService.UserAchievement
    let onClaim: () -> Void
    var onShare: (() -> Void)? = nil

    var body: some View {
        HStack(spacing: 12) {
            // 图标
            ZStack {
                RoundedRectangle(cornerRadius: 12)
                    .fill(rarityColor.opacity(0.2))
                    .frame(width: 60, height: 60)

                if let localName = localAssetName, Image.assetExists(localName) {
                    Image(localName)
                        .resizable()
                        .scaledToFit()
                        .frame(width: 48, height: 48)
                } else if let iconUrl = achievement.iconUrl, !iconUrl.isEmpty {
                    let url: URL? = {
                        if iconUrl.hasPrefix("http") {
                            return URL(string: iconUrl)
                        } else {
                            let cleanPath = iconUrl.hasPrefix("/") ? String(iconUrl.dropFirst()) : iconUrl
                            return URL(string: "\(APIEndpoint.baseURL)/\(cleanPath)")
                        }
                    }()
                    
                    CachedAsyncImagePhase(url: url) { phase in
                        switch phase {
                        case .empty:
                            ProgressView()
                                .scaleEffect(0.5)
                        case .success(let image):
                            image.resizable()
                                .scaledToFit()
                                .frame(width: 48, height: 48)
                        case .failure:
                            // Fallback to local category icon
                            if Image.assetExists(categoryIcon) {
                                Image(categoryIcon)
                                    .resizable()
                                    .scaledToFit()
                                    .frame(width: 40, height: 40)
                                    // Remove multiply blend mode
                            } else {
                                Image(systemName: "star.fill")
                                    .foregroundColor(.orange)
                            }
                        @unknown default:
                            EmptyView()
                        }
                    }
                    .frame(width: 48, height: 48)
                } else if Image.assetExists(categoryIcon) {
                    Image(categoryIcon)
                        .resizable()
                        .scaledToFit()
                        .frame(width: 40, height: 40)
                        // Remove multiply blend mode
                } else {
                    Image(systemName: "star.fill")
                        .foregroundColor(.orange)
                }
            }
            .frame(width: 60, height: 60)

            // 信息
            VStack(alignment: .leading, spacing: 6) {
                HStack {
                    Text(localizeBackendString(achievement.name))
                        .font(.headline)

                    // 稀有度标签
                    if let rarity = achievement.metadata?.rarity, let rarityEnum = AchievementService.Rarity(rawValue: rarity) {
                        Text(rarityEnum.displayName)
                            .font(.caption)
                            .foregroundColor(rarityEnum.color)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(rarityEnum.color.opacity(0.1))
                            .cornerRadius(4)
                    }
                }

                Text(localizeBackendString(achievement.description))
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .lineLimit(2)

                // 进度条
                if !achievement.isCompleted {
                    VStack(alignment: .leading, spacing: 4) {
                        ProgressView(value: achievement.progressPercentage)
                            .tint(.blue)

                        HStack {
                            Text("\(achievement.currentProgress)")
                                .font(.caption)
                            Text("/")
                                .font(.caption)
                                .foregroundColor(.secondary)
                            Text("\(achievement.targetProgress)")
                                .font(.caption)
                                .foregroundColor(.secondary)

                            Spacer()

                            if let unit = achievement.metadata?.progressUnit {
                                Text(unit)
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                            }
                        }
                    }
                } else if !achievement.isClaimed {
                    Text(NSLocalizedString("achievement.claimable", comment: ""))
                        .font(.caption)
                        .foregroundColor(.orange)
                } else {
                    Text(NSLocalizedString("achievement.completed", comment: ""))
                        .font(.caption)
                        .foregroundColor(.green)
                }
            }

            Spacer()

            // 奖励/操作按钮
            VStack(spacing: 4) {
                Text("+\(achievement.rewardPoints)")
                    .font(.caption)
                    .fontWeight(.semibold)
                    .foregroundColor(.orange)

                if achievement.isCompleted && !achievement.isClaimed {
                    Button(action: onClaim) {
                        Text(NSLocalizedString("achievement.btn.claim", comment: ""))
                            .font(.caption)
                            .fontWeight(.semibold)
                            .foregroundColor(.white)
                            .padding(.horizontal, 12)
                            .padding(.vertical, 6)
                            .background(Color.orange)
                            .cornerRadius(12)
                    }
                } else if achievement.isClaimed {
                    VStack(spacing: 2) {
                        Image(systemName: "checkmark.circle.fill")
                            .foregroundColor(.green)
                        
                        Button(action: { onShare?() }) {
                            Label(NSLocalizedString("common.share", comment: ""), systemImage: "square.and.arrow.up")
                                .font(DesignTokens.Typography.caption2)
                                .padding(.horizontal, 8)
                                .padding(.vertical, 4)
                                .background(Color.blue.opacity(0.1))
                                .cornerRadius(8)
                        }
                    }
                }
            }
        }
        .padding()
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color.white)
                .shadow(color: .black.opacity(0.05), radius: 3, x: 0, y: 1)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(achievement.isCompleted ? Color.green.opacity(0.3) : Color.clear, lineWidth: 1)
        )
    }

    private var rarityColor: Color {
        guard let rarity = achievement.metadata?.rarity,
              let rarityEnum = AchievementService.Rarity(rawValue: rarity) else {
            return .gray
        }
        return rarityEnum.color
    }

    private var localAssetName: String? {
        let name = achievement.name
        
        // Pixel
        if name.contains("新手") || name.lowercased().contains("novice") { return "AchievementPixelNovice" }
        if name.contains("爱好者") || name.lowercased().contains("lover") { return "AchievementPixelLover" }
        if name.contains("艺术家") || name.lowercased().contains("artist") { return "AchievementPixelArtist" }
        if name.contains("大师") || name.lowercased().contains("master") { return "AchievementPixelMaster" }
        if name.contains("传奇") || name.lowercased().contains("legend") { return "AchievementPixelLegend" }
        if name.contains("连续绘制") { return "AchievementPixelArtist" }
        
        // Social
        if name.contains("社交新手") || name.lowercased().contains("social beginner") { return "AchievementSocialBeginner" }
        if name.contains("蝴蝶") || name.lowercased().contains("butterfly") { return "AchievementSocialButterfly" }
        if name.contains("私信") || name.lowercased().contains("pm") { return "AchievementSocialPM" }
        if name.contains("聊天") || name.lowercased().contains("chat") { return "AchievementSocialExpert" }
        if name.contains("明星") || name.lowercased().contains("star") { return "AchievementSocialStar" }
        
        // Shop
        if name.contains("购物新手") || name.lowercased().contains("shop beginner") { return "AchievementShopBeginner" }
        if name.contains("购物达人") || name.lowercased().contains("shop expert") { return "AchievementShopExpert" }
        if name.contains("土豪") || name.lowercased().contains("tycoon") || name.lowercased().contains("rich") { return "AchievementShopTycoon" }
        
        // Alliance
        if name.contains("联盟新手") { return "AchievementAllianceBeginner" }
        if name.contains("联盟领袖") { return "AchievementAllianceLeader" }
        if name.contains("联盟活跃") || name.contains("活跃分子") { return "AchievementAllianceActive" }
        
        // Special
        if name.contains("早起鸟") { return "AchievementSpecialEarlyBird" }
        if name.contains("夜猫子") { return "AchievementSpecialNightOwl" }
        if name.contains("幸运儿") { return "AchievementSpecialLucky" }
        
        return nil
    }

    private var categoryIcon: String {
        guard let category = achievement.category else { return "IconAchievementPixels" }
        
        switch category {
        case "pixel", "pixels":
            return "IconAchievementPixels"
        case "social":
            return "IconAchievementSocial"
        case "alliance":
            return "IconAchievementAlliance"
        case "shop":
            return "IconAchievementShop"
        case "special":
            return "IconAchievementSpecial"
        case "likes":
            return "IconAchievementLikes"
        case "activity":
            return "IconAchievementActivity"
        default:
            return "IconAchievementPixels"
        }
    }
    
    private func localizeBackendString(_ key: String) -> String {
        let localized = NSLocalizedString(key, comment: "")
        if localized != key {
            return localized
        }
        
        // Try lowercase
        let lower = key.lowercaseFirst
        let localizedLower = NSLocalizedString(lower, comment: "")
        if localizedLower != lower {
            return localizedLower
        }
        
        // Try fully lowercase
        let fullLower = key.lowercased()
        let localizedFullLower = NSLocalizedString(fullLower, comment: "")
        if localizedFullLower != fullLower {
            return localizedFullLower
        }

        return key
    }
}

extension String {
    var lowercaseFirst: String {
        prefix(1).lowercased() + dropFirst()
    }
}

/// 分类按钮
struct AchievementCategoryButton: View {
    let category: AchievementService.AchievementCategory
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 6) {
                Image(category.icon)
                    .resizable()
                    .scaledToFit()
                    .frame(width: 20, height: 20)
                Text(category.displayName)
            }
            .font(.subheadline)
            .foregroundColor(isSelected ? .white : .blue)
            .padding(.horizontal, 16)
            .padding(.vertical, 8)
            .background(isSelected ? Color.blue : Color.blue.opacity(0.1))
            .cornerRadius(20)
        }
    }
}

/// 成就ViewModel
@MainActor
class AchievementViewModel: ObservableObject {
    @Published var achievements: [AchievementService.UserAchievement] = []
    @Published var userStats: AchievementService.UserAchievementStats?
    @Published var selectedCategory = "all"
    @Published var isLoading = false
    @Published var showSuccessAlert = false
    @Published var showError = false
    @Published var successMessage = ""
    @Published var errorMessage = ""

    private let achievementService = AchievementService.shared

    func loadAchievements() {
        Task {
            isLoading = true
            defer { isLoading = false }

            do {
                // 并行加载数据
                async let achievements = achievementService.getUserAchievements()
                async let stats = achievementService.getUserAchievementStats()

                self.achievements = try await achievements
                self.userStats = try await stats
            } catch {
                errorMessage = error.localizedDescription
                showError = true
                Logger.error("Failed to load achievements: \(error)")
            }
        }
    }

    func refresh() async {
        do {
            async let achievements = achievementService.getUserAchievements()
            async let stats = achievementService.getUserAchievementStats()

            self.achievements = try await achievements
            self.userStats = try await stats
        } catch {
            errorMessage = error.localizedDescription
            showError = true
            Logger.error("Failed to refresh achievements: \(error)")
        }
    }

    func claimReward(achievementId: Int) async {
        do {
            let (points, items) = try await achievementService.claimAchievementReward(achievementId: achievementId)

            HapticManager.shared.notification(type: .success)
            SoundManager.shared.playSuccess()
            successMessage = String(format: NSLocalizedString("achievement.claim.success", comment: ""), points)
            showSuccessAlert = true

            // 刷新数据
            await refresh()

            Logger.info("Claimed achievement reward: \(points) points, \(items?.count ?? 0) items")
        } catch {
            errorMessage = error.localizedDescription
            showError = true
            Logger.error("Failed to claim reward: \(error)")
        }
    }
}

// MARK: - Celebration Overlay

struct AchievementCelebrationOverlay: View {
    let message: String
    let onDismiss: () -> Void
    @State private var scale: CGFloat = 0.5
    @State private var opacity: Double = 0

    var body: some View {
        ZStack {
            Color.black.opacity(0.3)
                .ignoresSafeArea()
                .onTapGesture { dismiss() }

            VStack(spacing: 12) {
                Image(systemName: "party.popper.fill")
                    .font(.system(size: 48))
                    .foregroundColor(.orange)

                Text(message)
                    .font(.system(size: 18, weight: .bold))
                    .foregroundColor(AppColors.textPrimary)
                    .multilineTextAlignment(.center)
            }
            .padding(32)
            .background(
                RoundedRectangle(cornerRadius: 20)
                    .fill(AppColors.surface)
                    .shadow(color: .black.opacity(0.15), radius: 20, y: 5)
            )
            .scaleEffect(scale)
            .opacity(opacity)
        }
        .onAppear {
            withAnimation(.spring(response: 0.4, dampingFraction: 0.6)) {
                scale = 1.0
                opacity = 1.0
            }
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
                dismiss()
            }
        }
    }

    private func dismiss() {
        withAnimation(.easeOut(duration: 0.2)) {
            scale = 0.8
            opacity = 0
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) {
            onDismiss()
        }
    }
}
