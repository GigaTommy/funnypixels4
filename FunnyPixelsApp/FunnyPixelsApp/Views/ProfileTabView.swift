import SwiftUI
import Combine

/// 个人中心Tab视图
struct ProfileTabView: View {
    @StateObject private var viewModel = ProfileViewModel()
    @EnvironmentObject var authViewModel: AuthViewModel
    @EnvironmentObject var appState: AppState
    @State private var showLogoutConfirm = false
    @ObservedObject private var fontManager = FontSizeManager.shared
    @State private var hasAppeared = false  // ⚡ 懒加载标志

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Sub-Tab 选择器
                CapsuleTabPicker(items: ProfileSubTab.allCases, selection: $appState.profileSubTab)

                // Sub-Tab 内容
                Group {
                    switch appState.profileSubTab {
                    case .personal:
                        personalTabContent
                    case .leaderboard:
                        LeaderboardTabView()
                    case .more:
                        moreTabContent
                    }
                }
            }
            .navigationTitle(NSLocalizedString("tab.profile", comment: ""))
            .navigationBarTitleDisplayMode(.inline)
            .background(AppColors.background)
            .onAppear {
                // ⚡ 懒加载：只在第一次显示时加载数据
                guard !hasAppeared else { return }
                hasAppeared = true
                Task {
                    await viewModel.loadAllData()
                }
            }
            .refreshable {
                await viewModel.loadAllData(force: true)
            }
            .alert(NSLocalizedString("profile.logout.confirm.title", comment: ""), isPresented: $showLogoutConfirm) {
                Button(NSLocalizedString("common.cancel", comment: ""), role: .cancel) {}
                Button(NSLocalizedString("profile.logout", comment: ""), role: .destructive) {
                    Task {
                        await authViewModel.logout()
                    }
                }
            } message: {
                Text(NSLocalizedString("profile.logout.confirm.message", comment: ""))
            }
            .sheet(isPresented: $viewModel.isEditing) {
                ProfileEditView(viewModel: viewModel)
            }
            .overlay(alignment: .top) {
                if let error = viewModel.errorMessage {
                    Text(error)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundColor(.white)
                        .padding(.horizontal, 20)
                        .padding(.vertical, 10)
                        .background(Color.red.opacity(0.85))
                        .clipShape(Capsule())
                        .padding(.top, 8)
                        .transition(.move(edge: .top).combined(with: .opacity))
                        .onAppear {
                            DispatchQueue.main.asyncAfter(deadline: .now() + 3) {
                                withAnimation { viewModel.errorMessage = nil }
                            }
                        }
                }
            }
        }
    }

    // MARK: - Personal Tab Content

    private var personalTabContent: some View {
        ScrollView(showsIndicators: false) {
                VStack(spacing: AppSpacing.l) {
                    if authViewModel.isAuthenticated {
                        // 1. Profile Hero Section
                        if let profile = viewModel.userProfile {
                            profileHeroSection(profile: profile)
                        }

                        // 2. Social Stats Bar (followers/following/pixels/achievements)
                        if viewModel.userProfile != nil {
                            socialStatsBar
                        }

                        // 3. Rank Tier Progress Card
                        if let tier = viewModel.userProfile?.rankTier {
                            NavigationLink(destination: RankTierGuideView()) {
                                StandardCard(padding: AppSpacing.l) {
                                    RankTierProgressBar(tier: tier)
                                }
                            }
                            .buttonStyle(.plain)
                        }

                        // 4. Honors Card
                        if !viewModel.achievementHighlights.isEmpty {
                            honorsCard
                        }

                        // 5. Menu Card
                        menuCard

                    } else {
                        guestView
                    }
                }
                .padding(.horizontal, AppSpacing.l)
                .padding(.top, AppSpacing.l)
                .padding(.bottom, 90)
        }
    }

    // MARK: - More Tab Content

    private var moreTabContent: some View {
        ScrollView(showsIndicators: false) {
            VStack(spacing: AppSpacing.l) {
                if authViewModel.isAuthenticated {
                    // More settings and options
                    StandardCard(padding: 0) {
                        VStack(spacing: 0) {
                            NavigationLink(destination: SettingsView()) {
                                StandardListRowContent(title: NSLocalizedString("profile.settings", comment: ""), icon: "gearshape.fill", iconColor: .gray)
                            }
                        }
                    }

                    // Logout Button
                    StandardButton(
                        title: NSLocalizedString("profile.logout", comment: ""),
                        icon: "rectangle.portrait.and.arrow.right",
                        style: .destructive,
                        size: .medium
                    ) {
                        showLogoutConfirm = true
                    }
                } else {
                    guestView
                }
            }
            .padding(.horizontal, AppSpacing.l)
            .padding(.top, AppSpacing.l)
            .padding(.bottom, 90)
        }
    }

    // MARK: - Profile Hero Section

    private func profileHeroSection(profile: ProfileViewModel.UserProfile) -> some View {
        StandardCard(padding: AppSpacing.l, onTap: {
            viewModel.startEditing()
        }) {
            HStack(spacing: AppSpacing.l) {
                AvatarView(
                    avatarUrl: profile.avatarUrl,
                    avatar: profile.avatar,
                    displayName: profile.displayOrUsername,
                    flagPatternId: profile.flagPatternId,
                    size: 60 * fontManager.scale
                )

                VStack(alignment: .leading, spacing: 4) {
                    HStack(spacing: 6) {
                        Text(profile.displayOrUsername)
                            .font(fontManager.scaledFont(.headline))
                            .foregroundColor(AppColors.textPrimary)

                        if let tier = profile.rankTier {
                            RankTierBadge(tier: tier, fontSize: 11)
                        }
                    }

                    if let motto = profile.motto, !motto.isEmpty {
                        Text(motto)
                            .font(fontManager.scaledFont(.caption))
                            .foregroundColor(AppColors.textSecondary)
                            .lineLimit(2)
                    }

                    if let points = profile.points {
                        HStack(spacing: 4) {
                            Image(systemName: "star.fill")
                                .font(fontManager.scaledFont(.caption2))
                                .foregroundColor(AppColors.warning)
                            Text("\(points) " + NSLocalizedString("profile.points", comment: ""))
                                .font(fontManager.scaledFont(.caption))
                                .foregroundColor(AppColors.textSecondary)
                        }
                    }
                }
                Spacer()

                Image(systemName: "chevron.right")
                    .font(.caption)
                    .foregroundColor(AppColors.textTertiary)
            }
        }
    }

    // MARK: - Social Stats Bar

    private var socialStatsBar: some View {
        StandardCard(padding: AppSpacing.m) {
            HStack(spacing: 0) {
                if let userId = viewModel.userProfile?.id {
                    NavigationLink(destination: FollowListView(userId: userId, initialTab: 0)) {
                        profileStatItem(
                            value: "\(viewModel.followingCount)",
                            label: NSLocalizedString("profile.following", comment: "Following")
                        )
                    }
                    .buttonStyle(.plain)

                    statDivider

                    NavigationLink(destination: FollowListView(userId: userId, initialTab: 1)) {
                        profileStatItem(
                            value: "\(viewModel.followersCount)",
                            label: NSLocalizedString("profile.followers", comment: "Followers")
                        )
                    }
                    .buttonStyle(.plain)
                }

                statDivider

                profileStatItem(
                    value: formatNumber(viewModel.userProfile?.totalPixels ?? 0),
                    label: NSLocalizedString("profile.total_pixels", comment: "Pixels")
                )

                statDivider

                NavigationLink(destination: AchievementTabView()) {
                    profileStatItem(
                        value: "\(viewModel.achievementHighlights.count)",
                        label: NSLocalizedString("profile.achievements_count", comment: "Achievements")
                    )
                }
                .buttonStyle(.plain)
            }
        }
    }

    private func profileStatItem(value: String, label: String) -> some View {
        VStack(spacing: 2) {
            Text(value)
                .font(.system(size: 16, weight: .bold))
                .foregroundColor(AppColors.textPrimary)
            Text(label)
                .font(.system(size: 10))
                .foregroundColor(AppColors.textTertiary)
        }
        .frame(maxWidth: .infinity)
    }

    private var statDivider: some View {
        Rectangle()
            .fill(Color(.systemGray5))
            .frame(width: 1, height: 20)
    }

    // MARK: - Honors Card

    private var honorsCard: some View {
        StandardCard(padding: 0) {
            VStack(alignment: .leading, spacing: AppSpacing.m) {
                HStack {
                    Image(systemName: "rosette")
                        .foregroundColor(AppColors.primary)
                        .font(fontManager.scaledFont(.headline))
                    Text(NSLocalizedString("profile.honors", comment: ""))
                        .foregroundColor(AppColors.textPrimary)
                        .font(fontManager.scaledFont(.headline))
                    Spacer()
                    NavigationLink(destination: AchievementTabView()) {
                        Text(NSLocalizedString("profile.view_all", comment: ""))
                            .font(.caption)
                            .foregroundColor(AppColors.textSecondary)
                            .padding(.vertical, 4)
                    }
                }
                .padding([.horizontal, .top], AppSpacing.l)

                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: AppSpacing.m) {
                        ForEach(viewModel.achievementHighlights) { achievement in
                            NavigationLink(destination: AchievementTabView()) {
                                AchievementBadgeView(achievement: achievement)
                            }
                            .buttonStyle(PlainButtonStyle())
                        }
                    }
                    .padding(.horizontal, AppSpacing.l)
                    .padding(.bottom, AppSpacing.l)
                }
            }
        }
    }

    // MARK: - Menu Card

    private var menuCard: some View {
        StandardCard(padding: 0) {
            VStack(spacing: 0) {
                NavigationLink(destination: ShopTabView()) {
                    StandardListRowContent(title: NSLocalizedString("profile.shop", comment: ""), icon: "cart.fill", iconColor: .blue)
                }
                Divider().padding(.leading, 56)

                NavigationLink(destination: EventCenterView()) {
                    StandardListRowContent(title: NSLocalizedString("profile.event_center", comment: ""), icon: "flag.2.crossed.fill", iconColor: .red)
                }
                Divider().padding(.leading, 56)

                NavigationLink(destination: MessageCenterView()) {
                    StandardListRowContent(title: NSLocalizedString("profile.messages", comment: ""), icon: "envelope.fill", iconColor: .green) {
                        if viewModel.unreadMessageCount > 0 {
                            Text("\(viewModel.unreadMessageCount)")
                                .font(.caption2)
                                .fontWeight(.bold)
                                .foregroundColor(.white)
                                .padding(5)
                                .background(Circle().fill(Color.red))
                        }
                    }
                }
                Divider().padding(.leading, 56)

                NavigationLink(destination: Text(NSLocalizedString("profile.items", comment: ""))) {
                    StandardListRowContent(title: NSLocalizedString("profile.items", comment: ""), icon: "bag.fill", iconColor: .orange)
                }
                Divider().padding(.leading, 56)

                NavigationLink(destination: DailyTaskListView()) {
                    StandardListRowContent(title: NSLocalizedString("profile.daily_tasks", comment: ""), icon: "checklist", iconColor: .teal)
                }
                Divider().padding(.leading, 56)

                NavigationLink(destination: RankTierGuideView()) {
                    StandardListRowContent(title: NSLocalizedString("rank.guide.title", comment: ""), icon: "shield.lefthalf.filled", iconColor: .indigo)
                }
                Divider().padding(.leading, 56)

                NavigationLink(destination: AchievementTabView()) {
                    StandardListRowContent(title: NSLocalizedString("profile.achievements", comment: ""), icon: "trophy.fill", iconColor: .purple) {
                        if viewModel.hasUnclaimedRewards {
                            Circle()
                                .fill(Color.red)
                                .frame(width: 8, height: 8)
                        }
                    }
                }
                Divider().padding(.leading, 56)

                NavigationLink(destination: JourneyCardListView()) {
                    StandardListRowContent(title: NSLocalizedString("profile.journey_collection", comment: ""), icon: "map.fill", iconColor: .cyan) {
                        if DriftBottleManager.shared.unreadJourneyCards > 0 {
                            Text("\(DriftBottleManager.shared.unreadJourneyCards)")
                                .font(.caption2)
                                .fontWeight(.bold)
                                .foregroundColor(.white)
                                .padding(5)
                                .background(Circle().fill(Color.red))
                        }
                    }
                }
                Divider().padding(.leading, 56)

                NavigationLink(destination: InviteFriendsView()) {
                    StandardListRowContent(title: NSLocalizedString("profile.invite_friends", comment: ""), icon: "gift.fill", iconColor: .orange)
                }
            }
        }
    }

    // MARK: - Guest View

    private var guestView: some View {
        VStack(spacing: AppSpacing.xl) {
            Image(systemName: "person.crop.circle.badge.plus")
                .font(DesignTokens.Typography.largeTitle.weight(.bold))
                .foregroundColor(AppColors.primary.opacity(0.8))
                .padding(.top, 40)

            VStack(spacing: AppSpacing.s) {
                Text(NSLocalizedString("profile.guest.title", comment: ""))
                    .font(fontManager.scaledFont(.title3))
                    .foregroundColor(AppColors.textPrimary)

                Text(NSLocalizedString("profile.guest.message", comment: ""))
                    .font(fontManager.scaledFont(.subheadline))
                    .foregroundColor(AppColors.textSecondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal)
            }

            StandardButton(
                title: NSLocalizedString("history.login_register", comment: ""),
                style: .primary,
                size: .large
            ) {
                NotificationCenter.default.post(name: NSNotification.Name("ShowAuthSheet"), object: nil)
            }
            .frame(width: 200)
        }
        .padding(.bottom, 40)
    }

    // MARK: - Helpers

    private func formatNumber(_ n: Int) -> String {
        if n >= 10000 { return String(format: "%.1fK", Double(n) / 1000.0) }
        return "\(n)"
    }

    private func formatDuration(_ seconds: Int) -> String {
        if seconds < 60 { return "\(seconds)s" }
        let minutes = seconds / 60
        if minutes < 60 { return "\(minutes)m" }
        let hours = minutes / 60
        let mins = minutes % 60
        return "\(hours)h\(mins)m"
    }
}

// Helper for NavigationLinks to mimic StandardListRow look
struct StandardListRowContent<Badge: View>: View {
    let title: String
    let icon: String
    let iconColor: Color
    let badge: Badge

    init(title: String, icon: String, iconColor: Color, @ViewBuilder badge: () -> Badge) {
        self.title = title
        self.icon = icon
        self.iconColor = iconColor
        self.badge = badge()
    }

    init(title: String, icon: String, iconColor: Color) where Badge == EmptyView {
        self.init(title: title, icon: icon, iconColor: iconColor) { EmptyView() }
    }

    var body: some View {
        HStack(spacing: AppSpacing.l) {
            ZStack {
                Circle()
                    .fill(iconColor.opacity(0.1))
                    .frame(width: 36, height: 36)

                Image(systemName: icon)
                    .font(DesignTokens.Typography.title3.weight(.semibold))
                    .foregroundColor(iconColor)
            }

            Text(title)
                .font(AppTypography.body())
                .foregroundColor(AppColors.textPrimary)

            Spacer()

            badge

            Image(systemName: "chevron.right")
                .font(.caption)
                .foregroundColor(AppColors.textTertiary)
        }
        .padding(AppSpacing.l)
        .contentShape(Rectangle())
    }
}
