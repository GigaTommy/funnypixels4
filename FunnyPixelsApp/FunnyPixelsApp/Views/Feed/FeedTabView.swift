import SwiftUI

/// Feed Center - 重构后的历史 Tab
/// 包含三个子标签：广场 / 足迹 / 数据
struct FeedTabView: View {
    @EnvironmentObject var authViewModel: AuthViewModel
    @EnvironmentObject var appState: AppState
    @State private var subTabVisited: Set<FeedSubTab> = [.plaza]  // 默认加载"广场"

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                CapsuleTabPicker(items: FeedSubTab.allCases, selection: $appState.feedSubTab)

                ZStack {
                    if subTabVisited.contains(.plaza) {
                        WorldStateFeedView()
                            .environmentObject(appState)
                            .opacity(appState.feedSubTab == .plaza ? 1 : 0)
                            .allowsHitTesting(appState.feedSubTab == .plaza)
                    }
                    if subTabVisited.contains(.tracks) {
                        MyRecordsView()
                            .environmentObject(authViewModel)
                            .opacity(appState.feedSubTab == .tracks ? 1 : 0)
                            .allowsHitTesting(appState.feedSubTab == .tracks)
                    }
                    if subTabVisited.contains(.data) {
                        DataDashboardView()
                            .opacity(appState.feedSubTab == .data ? 1 : 0)
                            .allowsHitTesting(appState.feedSubTab == .data)
                    }
                }
                .onChange(of: appState.feedSubTab) { oldValue, newValue in
                    // 记录已访问的子Tab（用于懒加载）
                    if !subTabVisited.contains(appState.feedSubTab) {
                        subTabVisited.insert(appState.feedSubTab)
                    }
                    // ✅ 音效由 CapsuleTabPicker 负责，此处不重复播放
                }
            }
            .navigationTitle(NSLocalizedString("feed.title", comment: "Feed Center"))
            .navigationBarTitleDisplayMode(.inline)
            .background(AppColors.background)
        }
    }
}

/// 我的记录 - 迁移原 DrawingHistoryView 的内容
struct MyRecordsView: View {
    // ✅ 响应式设计：监听字体设置变化
    @ObservedObject private var fontManager = FontSizeManager.shared

    @EnvironmentObject var authViewModel: AuthViewModel
    @StateObject private var viewModel = DrawingHistoryViewModel()
    @State private var showFilters = false
    @State private var hasAppeared = false  // ⚡ 懒加载标志

    // 下一个视图模式的图标
    private var nextViewModeIcon: String {
        switch viewModel.viewMode {
        case .map:
            return "square.grid.2x2"  // 当前地图，下一个是网格
        case .grid:
            return "list.bullet"       // 当前网格，下一个是列表
        case .list:
            return "map"               // 当前列表，下一个是地图
        }
    }

    var body: some View {
        VStack(spacing: 0) {
            // 快捷筛选栏（始终显示，除非未登录）
            if authViewModel.isAuthenticated {
                quickFilterBar
            }

            // 操作栏（仅在有数据时显示）
            if authViewModel.isAuthenticated && !viewModel.sessions.isEmpty {
                recordsActionBar
            }

            ZStack {
                if !authViewModel.isAuthenticated {
                    guestPrompt
                } else if viewModel.isLoading && viewModel.sessions.isEmpty {
                    skeletonLoadingView
                } else if viewModel.sessions.isEmpty {
                    emptyStateView
                } else {
                    Group {
                        switch viewModel.viewMode {
                        case .map:
                            galleryMapView
                                .transition(.opacity)
                        case .grid:
                            galleryGridView
                                .transition(.opacity)
                        case .list:
                            galleryListView
                                .transition(.opacity)
                        }
                    }
                    .animation(.easeInOut(duration: 0.2), value: viewModel.viewMode)
                }
            }
        }
        .safeAreaInset(edge: .top, spacing: 0) {
            if viewModel.isOfflineMode {
                HStack(spacing: 8) {
                    Image(systemName: "wifi.slash")
                        .responsiveFont(.caption)
                    Text(NSLocalizedString("gallery.offline_mode", comment: ""))
                        .responsiveFont(.caption)
                    Spacer()
                    Button(action: {
                        Task { await viewModel.refresh() }
                    }) {
                        Image(systemName: "arrow.clockwise")
                            .responsiveFont(.caption)
                    }
                }
                .foregroundColor(.white)
                .padding(.horizontal, 16)
                .padding(.vertical, 8)
                .background(Color.orange)
            }
        }
        .sheet(isPresented: $showFilters) {
            filterSheet
        }
        .onAppear {
            // ⚡ 懒加载：只在第一次显示时加载数据
            guard !hasAppeared else { return }
            hasAppeared = true
            Task {
                await viewModel.loadSessions(refresh: true)
                viewModel.extractUserCities()  // 提取用户城市列表用于快捷筛选
            }
        }
        .refreshable {
            await viewModel.refresh()
            viewModel.extractUserCities()  // 更新城市列表
        }
        .alert(NSLocalizedString("common.error", comment: "Error"), isPresented: $viewModel.showError) {
            Button(NSLocalizedString("common.confirm", comment: "OK")) {}
        } message: {
            if let error = viewModel.errorMessage {
                Text(error)
            }
        }
    }

    // MARK: - Quick Filter Bar

    private var quickFilterBar: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: AppSpacing.s) {
                // 时间快捷筛选
                ForEach(DrawingHistoryViewModel.QuickTimeFilter.allCases, id: \.self) { filter in
                    FilterChip(
                        title: filter.rawValue,
                        isSelected: viewModel.quickTimeFilter == filter
                    ) {
                        viewModel.applyQuickTimeFilter(filter)
                        Task { await viewModel.refresh() }
                    }
                }

                // 城市筛选（从用户历史中提取）
                ForEach(viewModel.userCities, id: \.self) { city in
                    FilterChip(
                        title: city,
                        isSelected: viewModel.cityFilter == city
                    ) {
                        if viewModel.cityFilter == city {
                            // 点击已选中的城市 = 取消筛选
                            viewModel.cityFilter = ""
                        } else {
                            viewModel.cityFilter = city
                        }
                        Task { await viewModel.refresh() }
                    }
                }
            }
            .padding(.horizontal)
            .padding(.vertical, AppSpacing.s)
        }
        .background(AppColors.background)
    }

    // MARK: - Records Action Bar

    private var recordsActionBar: some View {
        HStack(spacing: AppSpacing.m) {
            // "更多筛选"按钮（原"筛选"按钮）
            FilterChip(
                title: NSLocalizedString("history.filter.more", comment: "More Filters"),
                isSelected: viewModel.useDateFilter,  // 仅当使用自定义日期时高亮
                action: { showFilters.toggle() }
            )

            // 清除筛选按钮（当有任何筛选条件时显示）
            if viewModel.quickTimeFilter != .all || !viewModel.cityFilter.isEmpty || viewModel.useDateFilter {
                Button(action: {
                    viewModel.clearAllFilters()
                    Task { await viewModel.refresh() }
                }) {
                    HStack(spacing: 4) {
                        Image(systemName: "xmark.circle.fill")
                        Text(NSLocalizedString("history.filter.clear", comment: "Clear"))
                    }
                    .responsiveFont(.caption, weight: .medium)
                    .foregroundColor(AppColors.textSecondary)
                }
            }

            Spacer()

            // 视图模式切换（循环：地图 → 网格 → 列表）
            Button {
                withAnimation {
                    switch viewModel.viewMode {
                    case .map:
                        viewModel.viewMode = .grid
                    case .grid:
                        viewModel.viewMode = .list
                    case .list:
                        viewModel.viewMode = .map
                    }
                }
            } label: {
                Image(systemName: nextViewModeIcon)
                    .responsiveFont(.callout, weight: .medium)
                    .foregroundColor(AppColors.textSecondary)
                    .frame(width: 32, height: 32)
                    .background(AppColors.surface)
                    .clipShape(RoundedRectangle(cornerRadius: AppRadius.m))
                    .overlay(
                        RoundedRectangle(cornerRadius: AppRadius.m)
                            .stroke(AppColors.border, lineWidth: 1)
                    )
            }
        }
        .padding(.horizontal)
        .padding(.vertical, AppSpacing.s)
    }

    // MARK: - Gallery Map View

    private var galleryMapView: some View {
        FootprintMapView(
            sessions: viewModel.sessions,
            onSessionTap: nil  // NavigationLink会自动处理
        )
    }

    // MARK: - Gallery Grid View

    private var galleryGridView: some View {
        ScrollView {
            LazyVGrid(columns: [
                GridItem(.flexible(), spacing: 12),
                GridItem(.flexible(), spacing: 12)
            ], spacing: 12) {
                ForEach(viewModel.sessions.indices, id: \.self) { index in
                    let session = viewModel.sessions[index]
                    NavigationLink(destination: SessionDetailView(sessionId: session.id)) {
                        ArtworkCard(session: session)
                    }
                    .id(session.id)  // 强制使用session.id作为稳定ID
                    .buttonStyle(PlainButtonStyle())
                    .task {
                        if viewModel.shouldPrefetchMore(currentIndex: index) {
                            await viewModel.loadMore()
                        }
                    }
                }

                if viewModel.hasMore {
                    GridRow {
                        ProgressView()
                            .gridCellColumns(2)
                            .padding()
                    }
                }
            }
            .padding()
        }
    }

    // MARK: - Gallery List View

    private var galleryListView: some View {
        ScrollView {
            LazyVStack(spacing: 12) {
                ForEach(viewModel.sessions.indices, id: \.self) { index in
                    let session = viewModel.sessions[index]
                    NavigationLink(destination: SessionDetailView(sessionId: session.id)) {
                        ArtworkListRow(session: session)
                    }
                    .id(session.id)  // 强制使用session.id作为稳定ID
                    .buttonStyle(PlainButtonStyle())
                    .task {
                        if viewModel.shouldPrefetchMore(currentIndex: index) {
                            await viewModel.loadMore()
                        }
                    }
                }

                if viewModel.hasMore {
                    ProgressView()
                        .padding()
                }
            }
            .padding()
        }
    }

    // MARK: - Empty State

    private var emptyStateView: some View {
        VStack(spacing: 16) {
            Image(systemName: "photo.on.rectangle.angled")
                .font(DesignTokens.Typography.largeTitle)
                .foregroundColor(.secondary)

            Text(NSLocalizedString("gallery.empty.title", comment: "No Artworks Yet"))
                .responsiveFont(.title3)
                .fontWeight(.semibold)

            Text(NSLocalizedString("gallery.empty.message", comment: "Start your first creation"))
                .font(.caption)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    // MARK: - Skeleton Loading

    private var skeletonLoadingView: some View {
        ScrollView {
            LazyVGrid(columns: [
                GridItem(.flexible(), spacing: 12),
                GridItem(.flexible(), spacing: 12)
            ], spacing: 12) {
                ForEach(0..<6, id: \.self) { _ in
                    ArtworkCardSkeleton()
                }
            }
            .padding()
        }
    }

    // MARK: - Guest Prompt

    private var guestPrompt: some View {
        VStack(spacing: 24) {
            Image(systemName: "photo.stack.fill")
                .font(.system(size: 80 * fontManager.scale))
                .foregroundColor(.blue.opacity(0.8))
                .padding(.top, 40)

            VStack(spacing: 12) {
                Text(NSLocalizedString("gallery.guest.title", comment: "Record Your Creativity"))
                    .responsiveFont(.title3)
                    .fontWeight(.bold)

                Text(NSLocalizedString("gallery.guest.message", comment: "Login to view artworks"))
                    .responsiveFont(.subheadline)
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal)
            }

            Button(action: {
                NotificationCenter.default.post(name: NSNotification.Name("ShowAuthSheet"), object: nil)
            }) {
                Text(NSLocalizedString("history.login_register", comment: "Login / Sign Up"))
                    .fontWeight(.semibold)
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .frame(height: 50)
                    .background(Color.blue)
                    .cornerRadius(25)
                    .shadow(radius: 4)
            }
            .padding(.horizontal, 40)
            .padding(.top, 10)

            Spacer()
        }
        .padding(.top, 20)
    }

    // MARK: - Filter Sheet

    private var filterSheet: some View {
        NavigationStack {
            Form {
                Section(NSLocalizedString("history.filter.date", comment: "Date Range")) {
                    Toggle(NSLocalizedString("history.filter.enable_date", comment: "Enable Date Filter"), isOn: $viewModel.useDateFilter)

                    if viewModel.useDateFilter {
                        DatePicker(NSLocalizedString("history.filter.start_date", comment: "Start Date"), selection: $viewModel.startDate, displayedComponents: .date)
                            .environment(\.locale, Locale.current)
                        DatePicker(NSLocalizedString("history.filter.end_date", comment: "End Date"), selection: $viewModel.endDate, displayedComponents: .date)
                            .environment(\.locale, Locale.current)
                    }
                }

                Section(NSLocalizedString("history.filter.city", comment: "City")) {
                    TextField(NSLocalizedString("history.filter.city_placeholder", comment: "Enter city name"), text: $viewModel.cityFilter)
                        .autocorrectionDisabled()
                }
            }
            .navigationTitle(NSLocalizedString("history.filter.title", comment: "Filter"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button(NSLocalizedString("history.filter.reset", comment: "Reset")) {
                        viewModel.useDateFilter = false
                        viewModel.startDate = Calendar.current.date(byAdding: .day, value: -30, to: Date()) ?? Date()
                        viewModel.endDate = Date()
                        viewModel.cityFilter = ""
                    }
                    .foregroundColor(.secondary)
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button(NSLocalizedString("history.filter.done", comment: "Done")) {
                        showFilters = false
                        Task { await viewModel.refresh() }
                    }
                }
            }
        }
        .presentationDetents([.medium])
    }
}

/// 社交动态占位（Sprint 3 后续任务 #35-#36 实现）
struct SocialFeedPlaceholderView: View {
    @ObservedObject private var fontManager = FontSizeManager.shared

    var body: some View {
        VStack(spacing: AppSpacing.l) {
            Spacer()
            Image(systemName: "person.2.wave.2")
                .font(.system(size: 48 * fontManager.scale))
                .foregroundColor(AppColors.textTertiary)
            Text(NSLocalizedString("feed.social.coming_soon", comment: "Social Feed coming soon"))
                .font(AppTypography.body())
                .foregroundColor(AppColors.textSecondary)
            Text(NSLocalizedString("feed.social.coming_soon_hint", comment: "See what your friends are drawing"))
                .font(AppTypography.caption())
                .foregroundColor(AppColors.textTertiary)
                .multilineTextAlignment(.center)
            Spacer()
        }
        .padding()
    }
}

/// 数据仪表盘占位（Sprint 3 任务 #37 实现）
struct DashboardPlaceholderView: View {
    @ObservedObject private var fontManager = FontSizeManager.shared

    var body: some View {
        VStack(spacing: AppSpacing.l) {
            Spacer()
            Image(systemName: "chart.bar.xaxis")
                .font(.system(size: 48 * fontManager.scale))
                .foregroundColor(AppColors.textTertiary)
            Text(NSLocalizedString("feed.dashboard.coming_soon", comment: "Dashboard coming soon"))
                .font(AppTypography.body())
                .foregroundColor(AppColors.textSecondary)
            Text(NSLocalizedString("feed.dashboard.coming_soon_hint", comment: "Track your drawing stats"))
                .font(AppTypography.caption())
                .foregroundColor(AppColors.textTertiary)
                .multilineTextAlignment(.center)
            Spacer()
        }
        .padding()
    }
}
