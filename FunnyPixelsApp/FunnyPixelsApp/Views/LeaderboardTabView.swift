
import SwiftUI

struct LeaderboardTabView: View {
    @StateObject private var viewModel = LeaderboardViewModel()
    @State private var selectedEntry: LeaderboardService.LeaderboardEntry?
    @ObservedObject var fontManager = FontSizeManager.shared
    @Namespace private var periodAnimation
    @State private var hasAppeared = false  // ⚡ 懒加载标志

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                typeBar
                periodBar

                // ✅ 刷新时在顶部显示小的 loading 条，不阻塞 UI
                if viewModel.isRefreshing {
                    HStack(spacing: 8) {
                        ProgressView()
                            .scaleEffect(0.8)
                        Text(NSLocalizedString("leaderboard.refreshing", comment: "Refreshing..."))
                            .font(AppTypography.caption())
                            .foregroundColor(AppColors.textSecondary)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 8)
                    .background(AppColors.surface)
                }

                Group {
                    // ✅ 只在首次加载且数据为空时显示全屏 Loading
                    if viewModel.isLoading {
                        LoadingView()
                    } else if viewModel.selectedSubTab == 0 {
                        personalList
                    } else if viewModel.selectedSubTab == 1 {
                        friendsList
                    } else if viewModel.selectedSubTab == 2 {
                        allianceList
                    } else {
                        cityList
                    }
                }
            }
            .navigationTitle(NSLocalizedString("leaderboard.title", comment: "Leaderboard"))
            .navigationBarTitleDisplayMode(.inline)
            .background(AppColors.background)
            .onAppear {
                // ⚡ 懒加载：只在首次显示时加载数据
                guard !hasAppeared else { return }
                hasAppeared = true
                viewModel.loadAllLeaderboards()
            }
            .refreshable { viewModel.refresh() }
            .sheet(item: $selectedEntry) { entry in
                PlayerDetailSheet(entry: entry)
            }
        }
    }

    // MARK: - Type Bar (Primary Capsule Buttons)

    private var typeBar: some View {
        let types: [(String, Int)] = [
            (NSLocalizedString("leaderboard.type.personal", comment: "Personal"), 0),
            (NSLocalizedString("leaderboard.type.friends", comment: "Friends"), 1),
            (NSLocalizedString("leaderboard.type.alliance", comment: "Alliance"), 2),
            (NSLocalizedString("leaderboard.type.city", comment: "City"), 3),
        ]

        return ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: AppSpacing.m) {
                ForEach(types, id: \.1) { label, tag in
                    Button {
                        HapticManager.shared.impact(style: .light)
                        withAnimation(.easeInOut(duration: 0.2)) {
                            viewModel.selectedSubTab = tag
                        }
                    } label: {
                        Text(label)
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundColor(viewModel.selectedSubTab == tag ? .white : AppColors.textSecondary)
                            .padding(.horizontal, 20)
                            .padding(.vertical, 10)
                            .background(
                                Capsule()
                                    .fill(viewModel.selectedSubTab == tag ? AppColors.primary : Color(.systemGray6))
                            )
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, AppSpacing.l)
        }
        .padding(.top, AppSpacing.l)
    }

    // MARK: - Period Bar (Secondary Underlined Text Tabs)

    private var periodBar: some View {
        HStack(spacing: 0) {
            ForEach(LeaderboardService.Period.allCases, id: \.self) { period in
                Button {
                    HapticManager.shared.impact(style: .light)
                    withAnimation(.easeInOut(duration: 0.25)) {
                        viewModel.selectedPeriod = period
                    }
                } label: {
                    VStack(spacing: 6) {
                        Text(period.displayName)
                            .font(.system(size: 13, weight: .medium))
                            .foregroundColor(viewModel.selectedPeriod == period ? AppColors.primary : AppColors.textTertiary)

                        if viewModel.selectedPeriod == period {
                            Rectangle()
                                .fill(AppColors.primary)
                                .frame(height: 2)
                                .matchedGeometryEffect(id: "periodUnderline", in: periodAnimation)
                        } else {
                            Rectangle()
                                .fill(Color.clear)
                                .frame(height: 2)
                        }
                    }
                    .padding(.top, 4)
                }
                .buttonStyle(.plain)
                .frame(maxWidth: .infinity)
            }
        }
        .padding(.horizontal, AppSpacing.l)
        .padding(.top, AppSpacing.m)
    }

    // MARK: - List Views

    private var personalList: some View {
        ScrollView {
            LazyVStack(spacing: AppSpacing.m) {
                if viewModel.personalEntries.isEmpty {
                    leaderboardEmptyState(
                        icon: "chart.bar.xaxis",
                        message: NSLocalizedString("leaderboard.personal.empty", comment: "No entries yet"),
                        hint: NSLocalizedString("leaderboard.personal.emptyHint", comment: "Start drawing to appear on the leaderboard")
                    )
                } else {
                    // 个人排名卡
                    if let myRank = viewModel.myRank {
                        MyRankCard(myRank: myRank)
                    }

                    // Top 3 展台
                    let top3 = viewModel.personalEntries.filter { $0.rank <= 3 }
                    if top3.count >= 3 {
                        Top3PodiumView(entries: top3)
                    }

                    // 第4名起的列表
                    let rest = top3.count >= 3
                        ? viewModel.personalEntries.filter { $0.rank > 3 }
                        : viewModel.personalEntries
                    ForEach(rest) { entry in
                        LeaderboardEntryRow(entry: entry)
                            .onTapGesture {
                                HapticManager.shared.impact(style: .light)
                                selectedEntry = entry
                            }
                    }

                    // Load more trigger
                    if viewModel.personalHasMore {
                        ProgressView()
                            .frame(maxWidth: .infinity)
                            .padding()
                            .onAppear {
                                Task { await viewModel.loadMorePersonal() }
                            }
                    }
                }
            }
            .padding(AppSpacing.l)
        }
    }

    private var friendsList: some View {
        ScrollView {
            LazyVStack(spacing: AppSpacing.m) {
                if viewModel.friendsEntries.isEmpty {
                    VStack(spacing: AppSpacing.l) {
                        Image(systemName: "person.2.slash")
                            .font(.system(size: 48))
                            .foregroundColor(AppColors.textTertiary)
                        Text(NSLocalizedString("leaderboard.friends.empty", comment: "No friends yet"))
                            .font(AppTypography.body())
                            .foregroundColor(AppColors.textSecondary)
                        Text(NSLocalizedString("leaderboard.friends.emptyHint", comment: "Follow other players to see them here"))
                            .font(AppTypography.caption())
                            .foregroundColor(AppColors.textTertiary)
                            .multilineTextAlignment(.center)
                    }
                    .padding(.top, 60)
                } else {
                    ForEach(viewModel.friendsEntries) { entry in
                        FriendsLeaderboardEntryRow(entry: entry)
                            .onTapGesture {
                                HapticManager.shared.impact(style: .light)
                                selectedEntry = entry
                            }
                    }
                }
            }
            .padding(AppSpacing.l)
        }
    }

    private var allianceList: some View {
        ScrollView {
            LazyVStack(spacing: AppSpacing.m) {
                if viewModel.allianceEntries.isEmpty {
                    leaderboardEmptyState(
                        icon: "shield.slash",
                        message: NSLocalizedString("leaderboard.alliance.empty", comment: "No alliance entries"),
                        hint: NSLocalizedString("leaderboard.alliance.emptyHint", comment: "Join an alliance and start drawing together")
                    )
                } else {
                    ForEach(viewModel.allianceEntries) { entry in
                        LeaderboardEntryRow(entry: entry)
                            .onTapGesture {
                                HapticManager.shared.impact(style: .light)
                                selectedEntry = entry
                            }
                    }

                    // Load more trigger
                    if viewModel.allianceHasMore {
                        ProgressView()
                            .frame(maxWidth: .infinity)
                            .padding()
                            .onAppear {
                                Task { await viewModel.loadMoreAlliance() }
                            }
                    }
                }
            }
            .padding(AppSpacing.l)
        }
    }

    private var cityList: some View {
        ScrollView {
            LazyVStack(spacing: AppSpacing.m) {
                if viewModel.cityEntries.isEmpty {
                    leaderboardEmptyState(
                        icon: "building.2.crop.circle",
                        message: NSLocalizedString("leaderboard.city.empty", comment: "No city entries"),
                        hint: NSLocalizedString("leaderboard.city.emptyHint", comment: "Cities with active players will appear here")
                    )
                } else {
                    ForEach(viewModel.cityEntries) { entry in
                        CityLeaderboardEntryRow(entry: entry)
                    }

                    // Load more trigger
                    if viewModel.cityHasMore {
                        ProgressView()
                            .frame(maxWidth: .infinity)
                            .padding()
                            .onAppear {
                                Task { await viewModel.loadMoreCity() }
                            }
                    }
                }
            }
            .padding(AppSpacing.l)
        }
    }

    // MARK: - Empty State Helper

    private func leaderboardEmptyState(icon: String, message: String, hint: String) -> some View {
        VStack(spacing: AppSpacing.l) {
            Image(systemName: icon)
                .font(.system(size: 48))
                .foregroundColor(AppColors.textTertiary)
            Text(message)
                .font(AppTypography.body())
                .foregroundColor(AppColors.textSecondary)
            Text(hint)
                .font(AppTypography.caption())
                .foregroundColor(AppColors.textTertiary)
                .multilineTextAlignment(.center)
        }
        .padding(.top, 60)
    }
}

struct LeaderboardEntryRow: View {
    let entry: LeaderboardService.LeaderboardEntry

    var body: some View {
        HStack(spacing: AppSpacing.m) {
            // Rank
            RankBadge(rank: entry.rank)

            // Avatar
            AvatarView(
                avatarUrl: entry.avatar_url,
                avatar: entry.avatar,
                avatarColor: entry.avatarColor,
                displayName: entry.displayName,
                flagPatternId: entry.flag_pattern_id ?? entry.flag_pattern,
                patternType: entry.pattern_type,
                unicodeChar: entry.unicode_char,
                size: 44
            )
            .onAppear {
                let patternId = entry.flag_pattern_id ?? entry.flag_pattern
                Logger.info("📊 LeaderboardEntryRow: Creating AvatarView for \(entry.displayName), flagPatternId=\(patternId ?? "nil"), allianceName=\(entry.alliance_name ?? "nil")")
            }

            // Info
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 6) {
                    Text(entry.displayName)
                        .font(AppTypography.body())
                        .foregroundColor(AppColors.textPrimary)
                        .lineLimit(1)

                    if let tier = entry.rankTier {
                        RankTierBadge(tier: tier, showName: false, fontSize: 11)
                    }
                }

                if let allianceName = entry.alliance_name {
                    Text(allianceName)
                        .font(AppTypography.caption())
                        .foregroundColor(AppColors.textSecondary)
                }
            }

            Spacer()

            // Points + Rank Change
            VStack(alignment: .trailing, spacing: 2) {
                Text("\(entry.total_pixels)")
                    .font(AppTypography.headline())
                    .foregroundColor(AppColors.secondary)

                Text(NSLocalizedString("leaderboard.pixel", comment: "Pixels"))
                    .font(AppTypography.caption())
                    .foregroundColor(AppColors.textTertiary)

                // 排名变化指示器
                if let change = entry.rankChange, change != 0 {
                    HStack(spacing: 2) {
                        Image(systemName: change > 0 ? "arrow.up" : "arrow.down")
                            .font(.system(size: 10, weight: .bold))
                        Text("\(abs(change))")
                            .font(AppTypography.caption())
                    }
                    .foregroundColor(change > 0 ? AppColors.secondary : AppColors.tertiary)
                } else if entry.previousRank == nil && entry.rank > 0 {
                    Text("NEW")
                        .font(.system(size: 9, weight: .bold))
                        .foregroundColor(AppColors.primary)
                }
            }
        }
        .padding(AppSpacing.l)
        .background(AppColors.surface)
        .clipShape(RoundedRectangle(cornerRadius: AppRadius.l))
        .modifier(AppShadows.small())
        .overlay(
            RoundedRectangle(cornerRadius: AppRadius.l)
                .stroke(entry.is_current_user == true ? AppColors.primary : Color.clear, lineWidth: 2)
        )
        .contentShape(Rectangle())
    }


}

struct CityLeaderboardEntryRow: View {
    let entry: LeaderboardService.CityLeaderboardEntry

    var body: some View {
        HStack(spacing: AppSpacing.m) {
            // Rank
            RankBadge(rank: entry.rank)

            // Flag
            Text(CountryCodeHelper.shared.getFlagEmoji(for: entry.country_code))
                .font(DesignTokens.Typography.title1)
                .frame(width: 44)

            // Info
            VStack(alignment: .leading, spacing: 2) {
                Text(entry.city_name)
                    .font(AppTypography.body())
                    .foregroundColor(AppColors.textPrimary)

                if let countryCode = entry.country_code {
                    Text(countryCode)
                        .font(AppTypography.caption())
                        .foregroundColor(AppColors.textSecondary)
                }
            }

            Spacer()

            // Stats
            VStack(alignment: .trailing, spacing: 2) {
                Text("\(entry.total_pixels)")
                    .font(AppTypography.headline())
                    .foregroundColor(AppColors.secondary)

                Text("\(entry.total_users) \(NSLocalizedString("leaderboard.users", comment: "Users"))")
                    .font(AppTypography.caption())
                    .foregroundColor(AppColors.textTertiary)
            }
        }
        .padding(AppSpacing.l)
        .background(AppColors.surface)
        .clipShape(RoundedRectangle(cornerRadius: AppRadius.l))
        .modifier(AppShadows.small())
    }
}

struct FriendsLeaderboardEntryRow: View {
    let entry: LeaderboardService.LeaderboardEntry

    var body: some View {
        HStack(spacing: AppSpacing.m) {
            // Rank
            RankBadge(rank: entry.rank)

            // Avatar
            AvatarView(
                avatarUrl: entry.avatar_url,
                avatar: entry.avatar,
                avatarColor: entry.avatarColor,
                displayName: entry.displayName,
                flagPatternId: entry.flag_pattern_id ?? entry.flag_pattern,
                patternType: entry.pattern_type,
                unicodeChar: entry.unicode_char,
                size: 44
            )

            // Info
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 6) {
                    Text(entry.displayName)
                        .font(AppTypography.body())
                        .foregroundColor(AppColors.textPrimary)
                        .lineLimit(1)

                    if let tier = entry.rankTier {
                        RankTierBadge(tier: tier, showName: false, fontSize: 11)
                    }

                    // 互关标识
                    if entry.isMutual == true {
                        Image(systemName: "arrow.left.arrow.right")
                            .font(.system(size: 10, weight: .semibold))
                            .foregroundColor(AppColors.primary)
                    }
                }

                if let allianceName = entry.alliance_name {
                    Text(allianceName)
                        .font(AppTypography.caption())
                        .foregroundColor(AppColors.textSecondary)
                }
            }

            Spacer()

            // Points
            VStack(alignment: .trailing, spacing: 2) {
                Text("\(entry.total_pixels)")
                    .font(AppTypography.headline())
                    .foregroundColor(AppColors.secondary)

                Text(NSLocalizedString("leaderboard.pixel", comment: "Pixels"))
                    .font(AppTypography.caption())
                    .foregroundColor(AppColors.textTertiary)
            }
        }
        .padding(AppSpacing.l)
        .background(AppColors.surface)
        .clipShape(RoundedRectangle(cornerRadius: AppRadius.l))
        .modifier(AppShadows.small())
        .overlay(
            RoundedRectangle(cornerRadius: AppRadius.l)
                .stroke(entry.is_current_user == true ? AppColors.primary : Color.clear, lineWidth: 2)
        )
        .contentShape(Rectangle())
    }
}
