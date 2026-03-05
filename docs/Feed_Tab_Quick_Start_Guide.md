# Feed Tab重构 - 快速实施指南

> **开发团队执行手册**
>
> 本文档为开发团队提供最小化可行产品(MVP)的快速实施路径

---

## 🎯 MVP范围定义

### ✅ 包含功能（Phase 1 MVP）

**推荐Tab**
- ✅ 基础推荐流（简化算法）
- ✅ 快速筛选器：推荐/关注/联盟/附近
- ✅ 双击点赞
- ✅ 下拉刷新 + 无限滚动

**探索Tab**
- ✅ 热门动态（网格展示）
- ✅ 挑战列表（基础卡片）
- ✅ 精选创作者（横向滚动）
- ❌ ~~话题标签~~（Phase 2）

**我的Tab**
- ✅ 作品集（网格视图）
- ✅ 统计（迁移现有）
- ❌ ~~收藏夹~~（Phase 2）
- ❌ ~~草稿箱~~（Phase 2）

### ❌ 不包含功能（Phase 2+）
- 长按菜单（不感兴趣/举报）
- 滑动切换筛选器
- 高级推荐算法（协同过滤）
- 话题标签系统
- 收藏夹和草稿箱

---

## 📁 文件结构规划

```
FunnyPixelsApp/
├── Views/
│   └── Feed/
│       ├── FeedTabView.swift                 # [修改] 主容器
│       │
│       ├── Recommend/                        # [新建] 推荐Tab
│       │   ├── RecommendTabView.swift       # 推荐主视图
│       │   ├── RecommendFilterPicker.swift  # 筛选器
│       │   └── FeedCard.swift               # [优化] 卡片组件
│       │
│       ├── Explore/                         # [新建] 探索Tab
│       │   ├── ExploreTabView.swift         # 探索主视图
│       │   ├── TrendingGridView.swift       # 热门网格
│       │   ├── ChallengeListView.swift      # 挑战列表
│       │   └── FeaturedArtistsView.swift    # 精选创作者
│       │
│       └── Mine/                            # [新建] 我的Tab
│           ├── MineTabView.swift            # 我的主视图
│           ├── GallerySubTab.swift          # 作品集（迁移MyRecordsView）
│           └── StatsSubTab.swift            # 统计（迁移DataDashboardView）
│
├── ViewModels/
│   ├── FeedViewModel.swift                  # [优化] 推荐逻辑
│   ├── ExploreViewModel.swift               # [新建] 探索逻辑
│   └── MineViewModel.swift                  # [新建] 我的逻辑
│
├── Services/
│   └── API/
│       └── FeedService.swift                # [扩展] 新增explore接口
│
└── State/
    └── AppState.swift                       # [修改] 更新FeedSubTab枚举
```

---

## 🚀 分步实施计划

### Step 1: 准备工作（30分钟）

**1.1 创建分支**
```bash
git checkout -b feature/feed-tab-redesign
```

**1.2 备份现有文件**
```bash
# 备份现有实现（以防回滚）
cp FunnyPixelsApp/Views/Feed/FeedTabView.swift FunnyPixelsApp/Views/Feed/FeedTabView.swift.backup
cp FunnyPixelsApp/State/AppState.swift FunnyPixelsApp/State/AppState.swift.backup
```

**1.3 创建目录结构**
```bash
mkdir -p FunnyPixelsApp/Views/Feed/Recommend
mkdir -p FunnyPixelsApp/Views/Feed/Explore
mkdir -p FunnyPixelsApp/Views/Feed/Mine
```

---

### Step 2: 修改AppState（30分钟）

**文件**: `FunnyPixelsApp/State/AppState.swift`

**修改FeedSubTab枚举**
```swift
// 原有代码（删除）
enum FeedSubTab: String, CaseIterable, CustomStringConvertible {
    case plaza
    case tracks
    case data

    var description: String {
        switch self {
        case .plaza: return NSLocalizedString("feed.plaza", comment: "")
        case .tracks: return NSLocalizedString("feed.tracks", comment: "")
        case .data: return NSLocalizedString("feed.data", comment: "")
        }
    }
}

// 新代码（替换）
enum FeedSubTab: String, CaseIterable, CustomStringConvertible {
    case recommend  // 推荐（原plaza）
    case explore    // 探索（新增）
    case mine       // 我的（合并tracks+data）

    var description: String {
        switch self {
        case .recommend: return NSLocalizedString("feed.recommend", comment: "Recommend")
        case .explore: return NSLocalizedString("feed.explore", comment: "Explore")
        case .mine: return NSLocalizedString("feed.mine", comment: "Mine")
        }
    }

    var icon: String {
        switch self {
        case .recommend: return "flame.fill"
        case .explore: return "sparkle.magnifyingglass"
        case .mine: return "person.crop.square.fill"
        }
    }
}
```

---

### Step 3: 创建推荐Tab（2小时）

#### 3.1 创建RecommendTabView

**新建文件**: `FunnyPixelsApp/Views/Feed/Recommend/RecommendTabView.swift`

```swift
import SwiftUI

struct RecommendTabView: View {
    @StateObject private var viewModel = FeedViewModel()
    @State private var selectedFilter: RecommendFilter = .recommend
    @State private var selectedCommentItem: FeedService.FeedItem?

    var body: some View {
        VStack(spacing: 0) {
            // 顶部筛选器
            RecommendFilterPicker(selection: $selectedFilter)
                .padding(.vertical, AppSpacing.s)
                .background(AppColors.background)

            // Feed流
            if viewModel.isLoading && viewModel.items.isEmpty {
                LoadingView()
            } else if viewModel.items.isEmpty {
                emptyStateView
            } else {
                ScrollView {
                    LazyVStack(spacing: AppSpacing.l) {
                        ForEach(viewModel.items) { item in
                            FeedCard(
                                item: item,
                                onLike: { Task { await viewModel.toggleLike(item: item) } },
                                onComment: { selectedCommentItem = item },
                                onBookmark: { Task { await viewModel.toggleBookmark(item: item) } }
                            )
                            .onAppear {
                                if viewModel.shouldLoadMore(currentItem: item) {
                                    Task { await viewModel.loadMore() }
                                }
                            }
                        }

                        if viewModel.isLoadingMore {
                            ProgressView()
                                .padding()
                        }
                    }
                    .padding(AppSpacing.l)
                }
                .refreshable {
                    await viewModel.loadFeed(refresh: true)
                }
            }
        }
        .onChange(of: selectedFilter) { oldValue, newValue in
            viewModel.filter = newValue.apiValue
        }
        .task {
            await viewModel.loadFeed(refresh: true)
        }
        .sheet(item: $selectedCommentItem) { item in
            FeedCommentSheet(feedItem: item)
                .presentationDetents([.medium, .large])
        }
    }

    private var emptyStateView: some View {
        VStack(spacing: AppSpacing.l) {
            Spacer()
            Image(systemName: "sparkles")
                .font(.system(size: 48))
                .foregroundColor(AppColors.textTertiary)
            Text(emptyTitle)
                .font(AppTypography.headline())
                .foregroundColor(AppColors.textPrimary)
            Text(emptyMessage)
                .font(AppTypography.caption())
                .foregroundColor(AppColors.textSecondary)
                .multilineTextAlignment(.center)
            Spacer()
        }
        .padding()
    }

    private var emptyTitle: String {
        switch selectedFilter {
        case .recommend: return NSLocalizedString("feed.empty.recommend.title", comment: "")
        case .following: return NSLocalizedString("feed.empty.following.title", comment: "")
        case .alliance: return NSLocalizedString("feed.empty.alliance.title", comment: "")
        case .nearby: return NSLocalizedString("feed.empty.nearby.title", comment: "")
        }
    }

    private var emptyMessage: String {
        switch selectedFilter {
        case .recommend: return NSLocalizedString("feed.empty.recommend.message", comment: "")
        case .following: return NSLocalizedString("feed.empty.following.message", comment: "")
        case .alliance: return NSLocalizedString("feed.empty.alliance.message", comment: "")
        case .nearby: return NSLocalizedString("feed.empty.nearby.message", comment: "")
        }
    }
}

// 推荐筛选器枚举
enum RecommendFilter: String, CaseIterable {
    case recommend  // 推荐
    case following  // 关注
    case alliance   // 联盟
    case nearby     // 附近

    var title: String {
        switch self {
        case .recommend: return NSLocalizedString("feed.filter.recommend", comment: "Recommend")
        case .following: return NSLocalizedString("feed.filter.following", comment: "Following")
        case .alliance: return NSLocalizedString("feed.filter.alliance", comment: "Alliance")
        case .nearby: return NSLocalizedString("feed.filter.nearby", comment: "Nearby")
        }
    }

    var icon: String {
        switch self {
        case .recommend: return "flame.fill"
        case .following: return "person.2.fill"
        case .alliance: return "shield.fill"
        case .nearby: return "location.fill"
        }
    }

    // 映射到API filter参数
    var apiValue: String {
        switch self {
        case .recommend: return "all"  // 后端暂时用"all"表示推荐
        case .following: return "following"
        case .alliance: return "alliance"
        case .nearby: return "nearby"
        }
    }
}
```

#### 3.2 创建筛选器组件

**新建文件**: `FunnyPixelsApp/Views/Feed/Recommend/RecommendFilterPicker.swift`

```swift
import SwiftUI

struct RecommendFilterPicker: View {
    @Binding var selection: RecommendFilter

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: AppSpacing.m) {
                ForEach(RecommendFilter.allCases, id: \.self) { filter in
                    FilterChip(
                        title: filter.title,
                        isSelected: selection == filter
                    ) {
                        selection = filter
                    }
                }
            }
            .padding(.horizontal, AppSpacing.l)
        }
    }
}
```

#### 3.3 优化FeedCard（添加双击点赞）

**修改文件**: `FunnyPixelsApp/Views/Feed/FeedItemCard.swift`

在FeedItemCard的body中添加：

```swift
// 在卡片的主内容区添加双击手势
.contentShape(Rectangle())
.onTapGesture(count: 2) {
    // 双击点赞
    if !item.is_liked {
        Task {
            await onLike()
        }

        // Haptic反馈
        let generator = UIImpactFeedbackGenerator(style: .medium)
        generator.impactOccurred()

        // 显示心形动画
        withAnimation(.spring(response: 0.5, dampingFraction: 0.6)) {
            showLikeAnimation = true
        }

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            showLikeAnimation = false
        }
    }
}

// 在卡片内容上层添加心形动画
.overlay(
    Group {
        if showLikeAnimation {
            Image(systemName: "heart.fill")
                .font(.system(size: 60))
                .foregroundColor(.red.opacity(0.8))
                .scaleEffect(showLikeAnimation ? 2.0 : 0.1)
                .opacity(showLikeAnimation ? 0 : 1)
        }
    }
)

// 添加State变量
@State private var showLikeAnimation = false
```

---

### Step 4: 创建探索Tab（2小时）

#### 4.1 创建ExploreTabView

**新建文件**: `FunnyPixelsApp/Views/Feed/Explore/ExploreTabView.swift`

```swift
import SwiftUI

struct ExploreTabView: View {
    @StateObject private var viewModel = ExploreViewModel()
    @State private var selectedSection: ExploreSection = .trending

    var body: some View {
        VStack(spacing: 0) {
            // 顶部导航
            exploreSectionPicker
                .padding(.vertical, AppSpacing.s)
                .background(AppColors.background)

            ScrollView {
                LazyVStack(spacing: AppSpacing.xl) {
                    switch selectedSection {
                    case .trending:
                        trendingSection
                    case .challenges:
                        challengesSection
                    case .artists:
                        artistsSection
                    }
                }
                .padding(AppSpacing.l)
            }
            .refreshable {
                await viewModel.loadExplore(section: selectedSection)
            }
        }
        .task {
            await viewModel.loadExplore(section: selectedSection)
        }
    }

    private var exploreSectionPicker: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: AppSpacing.m) {
                ForEach(ExploreSection.allCases, id: \.self) { section in
                    FilterChip(
                        title: section.title,
                        isSelected: selectedSection == section
                    ) {
                        selectedSection = section
                        Task {
                            await viewModel.loadExplore(section: section)
                        }
                    }
                }
            }
            .padding(.horizontal, AppSpacing.l)
        }
    }

    private var trendingSection: some View {
        TrendingGridView(items: viewModel.trendingItems)
    }

    private var challengesSection: some View {
        ChallengeListView(challenges: viewModel.challenges)
    }

    private var artistsSection: some View {
        FeaturedArtistsView(artists: viewModel.featuredArtists)
    }
}

enum ExploreSection: String, CaseIterable {
    case trending
    case challenges
    case artists

    var title: String {
        switch self {
        case .trending: return NSLocalizedString("explore.trending", comment: "Trending")
        case .challenges: return NSLocalizedString("explore.challenges", comment: "Challenges")
        case .artists: return NSLocalizedString("explore.artists", comment: "Artists")
        }
    }

    var icon: String {
        switch self {
        case .trending: return "chart.line.uptrend.xyaxis"
        case .challenges: return "flag.checkered"
        case .artists: return "star.circle.fill"
        }
    }
}
```

#### 4.2 创建热门网格

**新建文件**: `FunnyPixelsApp/Views/Feed/Explore/TrendingGridView.swift`

```swift
import SwiftUI

struct TrendingGridView: View {
    let items: [FeedService.FeedItem]

    var body: some View {
        LazyVGrid(columns: [
            GridItem(.flexible(), spacing: AppSpacing.m),
            GridItem(.flexible(), spacing: AppSpacing.m),
            GridItem(.flexible(), spacing: AppSpacing.m)
        ], spacing: AppSpacing.m) {
            ForEach(items) { item in
                NavigationLink(destination: SessionDetailView(sessionId: item.drawing_session_id ?? "")) {
                    TrendingGridItem(item: item)
                }
            }
        }
    }
}

struct TrendingGridItem: View {
    let item: FeedService.FeedItem

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            // 缩略图
            if let sessionId = item.drawing_session_id {
                SessionThumbnailView(sessionId: sessionId)
                    .aspectRatio(1, contentMode: .fill)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
            } else {
                Rectangle()
                    .fill(Color.gray.opacity(0.3))
                    .aspectRatio(1, contentMode: .fill)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
            }

            // 热度值
            HStack(spacing: 4) {
                Image(systemName: "flame.fill")
                    .font(.system(size: 10))
                    .foregroundColor(.orange)
                Text("\(item.like_count + item.comment_count * 2)")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundColor(.orange)
            }
        }
    }
}
```

#### 4.3 创建ViewModel

**新建文件**: `FunnyPixelsApp/ViewModels/ExploreViewModel.swift`

```swift
import Foundation

class ExploreViewModel: ObservableObject {
    @Published var trendingItems: [FeedService.FeedItem] = []
    @Published var challenges: [Challenge] = []  // 定义Challenge模型
    @Published var featuredArtists: [FeaturedArtist] = []  // 定义FeaturedArtist模型
    @Published var isLoading = false

    private let feedService = FeedService.shared

    func loadExplore(section: ExploreSection) async {
        isLoading = true
        defer { isLoading = false }

        do {
            switch section {
            case .trending:
                // 调用热门接口（复用现有filter="trending"）
                let response = try await feedService.getFeed(filter: "trending", limit: 30)
                await MainActor.run {
                    self.trendingItems = response.data?.items ?? []
                }
            case .challenges:
                // TODO: 后端新增挑战接口
                // 暂时留空
                break
            case .artists:
                // TODO: 后端新增精选创作者接口
                // 暂时留空
                break
            }
        } catch {
            Logger.error("加载探索内容失败: \(error)")
        }
    }
}
```

---

### Step 5: 创建我的Tab（1.5小时）

#### 5.1 创建MineTabView

**新建文件**: `FunnyPixelsApp/Views/Feed/Mine/MineTabView.swift`

```swift
import SwiftUI

struct MineTabView: View {
    @EnvironmentObject var authViewModel: AuthViewModel
    @State private var selectedSubTab: MineSubTab = .gallery

    var body: some View {
        VStack(spacing: 0) {
            // 顶部个人卡片
            personalHeaderCard
                .padding(AppSpacing.l)

            // 子Tab切换
            mineSubTabPicker
                .padding(.vertical, AppSpacing.s)
                .background(AppColors.background)

            // 内容区域
            Group {
                switch selectedSubTab {
                case .gallery:
                    GallerySubTab()
                        .environmentObject(authViewModel)
                case .stats:
                    StatsSubTab()
                }
            }
        }
    }

    private var personalHeaderCard: some View {
        HStack(spacing: AppSpacing.m) {
            // 头像
            AvatarView(
                avatarUrl: authViewModel.currentUser?.avatarUrl,
                avatar: authViewModel.currentUser?.avatar,
                displayName: authViewModel.currentUser?.displayOrUsername ?? "",
                flagPatternId: authViewModel.currentUser?.alliance?.flagPatternId,
                size: 80
            )

            VStack(alignment: .leading, spacing: AppSpacing.s) {
                // 用户名
                Text("@\(authViewModel.currentUser?.username ?? "User")")
                    .font(AppTypography.headline())
                    .foregroundColor(AppColors.textPrimary)

                // 联盟徽章
                if let alliance = authViewModel.currentUser?.alliance {
                    HStack(spacing: 4) {
                        Image(systemName: "shield.fill")
                            .font(.system(size: 12))
                        Text(alliance.name)
                            .font(.system(size: 12))
                    }
                    .foregroundColor(AppColors.secondary)
                }

                // 核心数据
                HStack(spacing: AppSpacing.l) {
                    statItem(icon: "paintbrush.fill", value: "123", label: NSLocalizedString("mine.artworks", comment: ""))
                    statItem(icon: "chart.bar.fill", value: "45.6K", label: NSLocalizedString("mine.pixels", comment: ""))
                }
            }

            Spacer()
        }
        .padding(AppSpacing.l)
        .background(AppColors.surface)
        .clipShape(RoundedRectangle(cornerRadius: AppRadius.l))
        .modifier(AppShadows.small())
    }

    private func statItem(icon: String, value: String, label: String) -> some View {
        VStack(spacing: 2) {
            HStack(spacing: 4) {
                Image(systemName: icon)
                    .font(.system(size: 10))
                    .foregroundColor(AppColors.secondary)
                Text(value)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundColor(AppColors.textPrimary)
            }
            Text(label)
                .font(.system(size: 10))
                .foregroundColor(AppColors.textTertiary)
        }
    }

    private var mineSubTabPicker: some View {
        HStack(spacing: AppSpacing.m) {
            ForEach(MineSubTab.allCases, id: \.self) { tab in
                FilterChip(
                    title: tab.title,
                    isSelected: selectedSubTab == tab
                ) {
                    selectedSubTab = tab
                }
            }
            Spacer()
        }
        .padding(.horizontal, AppSpacing.l)
    }
}

enum MineSubTab: String, CaseIterable {
    case gallery  // 作品集
    case stats    // 统计

    var title: String {
        switch self {
        case .gallery: return NSLocalizedString("mine.gallery", comment: "Gallery")
        case .stats: return NSLocalizedString("mine.stats", comment: "Stats")
        }
    }
}
```

#### 5.2 迁移作品集

**新建文件**: `FunnyPixelsApp/Views/Feed/Mine/GallerySubTab.swift`

```swift
import SwiftUI

// 直接复用MyRecordsView的内容，稍作简化
struct GallerySubTab: View {
    @EnvironmentObject var authViewModel: AuthViewModel
    @StateObject private var viewModel = DrawingHistoryViewModel()
    @State private var showFilters = false

    var body: some View {
        // 复用MyRecordsView的body内容
        // （代码与MyRecordsView.swift完全相同，直接复制粘贴）
    }
}
```

#### 5.3 迁移统计

**新建文件**: `FunnyPixelsApp/Views/Feed/Mine/StatsSubTab.swift`

```swift
import SwiftUI

// 直接复用DataDashboardView的内容
struct StatsSubTab: View {
    @StateObject private var viewModel = DashboardViewModel()

    var body: some View {
        // 复用DataDashboardView的body内容
        // （代码与DataDashboardView.swift完全相同，直接复制粘贴）
    }
}
```

---

### Step 6: 更新FeedTabView（30分钟）

**修改文件**: `FunnyPixelsApp/Views/Feed/FeedTabView.swift`

```swift
import SwiftUI

struct FeedTabView: View {
    @EnvironmentObject var authViewModel: AuthViewModel
    @EnvironmentObject var appState: AppState
    @State private var subTabVisited: Set<FeedSubTab> = [.recommend]

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // 一级Tab切换（胶囊）
                CapsuleTabPicker(items: FeedSubTab.allCases, selection: $appState.feedSubTab)

                // 内容区域
                ZStack {
                    if subTabVisited.contains(.recommend) {
                        RecommendTabView()
                            .opacity(appState.feedSubTab == .recommend ? 1 : 0)
                            .allowsHitTesting(appState.feedSubTab == .recommend)
                    }
                    if subTabVisited.contains(.explore) {
                        ExploreTabView()
                            .opacity(appState.feedSubTab == .explore ? 1 : 0)
                            .allowsHitTesting(appState.feedSubTab == .explore)
                    }
                    if subTabVisited.contains(.mine) {
                        MineTabView()
                            .environmentObject(authViewModel)
                            .opacity(appState.feedSubTab == .mine ? 1 : 0)
                            .allowsHitTesting(appState.feedSubTab == .mine)
                    }
                }
                .onChange(of: appState.feedSubTab) { oldValue, newValue in
                    if !subTabVisited.contains(newValue) {
                        subTabVisited.insert(newValue)
                    }
                }
            }
            .navigationTitle(NSLocalizedString("feed.title", comment: "Discover"))
            .navigationBarTitleDisplayMode(.inline)
            .background(AppColors.background)
        }
    }
}
```

---

### Step 7: 添加本地化字符串（15分钟）

**文件**: `FunnyPixelsApp/Resources/zh-Hans.lproj/Localizable.strings`

```strings
// FeedSubTab
"feed.recommend" = "推荐";
"feed.explore" = "探索";
"feed.mine" = "我的";

// RecommendFilter
"feed.filter.recommend" = "推荐";
"feed.filter.following" = "关注";
"feed.filter.alliance" = "联盟";
"feed.filter.nearby" = "附近";

// Empty States
"feed.empty.recommend.title" = "暂无推荐";
"feed.empty.recommend.message" = "开始关注创作者或加入联盟";
"feed.empty.following.title" = "关注列表为空";
"feed.empty.following.message" = "去探索页关注优质创作者";
"feed.empty.alliance.title" = "联盟暂无动态";
"feed.empty.alliance.message" = "邀请好友加入联盟一起创作";
"feed.empty.nearby.title" = "附近暂无动态";
"feed.empty.nearby.message" = "开启位置权限发现身边的创作";

// Explore
"explore.trending" = "热门";
"explore.challenges" = "挑战";
"explore.artists" = "精选";

// Mine
"mine.artworks" = "作品";
"mine.pixels" = "像素";
"mine.gallery" = "作品集";
"mine.stats" = "统计";
```

**同样添加到其他5种语言**（en/es/ja/ko/pt-BR）

---

### Step 8: 测试和验证（1小时）

#### 8.1 编译验证
```bash
xcodebuild -scheme FunnyPixelsApp -sdk iphonesimulator -destination 'platform=iOS Simulator,name=iPhone 17' build
```

#### 8.2 功能测试清单
- [ ] 推荐Tab - 筛选器切换正常
- [ ] 推荐Tab - 双击点赞有心形动画
- [ ] 推荐Tab - 下拉刷新正常
- [ ] 推荐Tab - 无限滚动加载更多
- [ ] 探索Tab - 热门内容显示正常
- [ ] 探索Tab - 切换section正常
- [ ] 我的Tab - 个人卡片显示正常
- [ ] 我的Tab - 作品集/统计切换正常
- [ ] Tab切换 - 懒加载生效
- [ ] 本地化 - 6种语言显示正常

---

## 🐛 常见问题和解决方案

### 问题1: 编译错误 - AppState.FeedSubTab case不匹配

**错误信息**:
```
Value of type 'FeedSubTab' has no member 'plaza'
```

**解决方案**:
全局搜索并替换：
```swift
.plaza  → .recommend
.tracks → .mine
.data   → .mine
```

### 问题2: SocialFeedView找不到

**错误信息**:
```
Cannot find 'SocialFeedView' in scope
```

**解决方案**:
SocialFeedView已重命名为RecommendTabView，更新import和引用。

### 问题3: 双击点赞没有反应

**检查清单**:
1. 确认添加了`.onTapGesture(count: 2)`
2. 确认添加了`@State private var showLikeAnimation = false`
3. 确认添加了`.overlay`心形动画

### 问题4: 热门网格加载失败

**可能原因**:
后端filter="trending"未实现

**解决方案**:
```javascript
// backend/src/controllers/feedController.js
if (filter === 'trending') {
  query = query
    .orderBy('like_count', 'desc')
    .orderBy('created_at', 'desc')
    .where('created_at', '>', knex.raw("NOW() - INTERVAL '7 days'"));
}
```

---

## 📊 验收标准

### 功能完整性
- ✅ 3个Tab均可正常切换
- ✅ 推荐Tab 4个筛选器正常工作
- ✅ 双击点赞有动画反馈
- ✅ 探索Tab热门内容正常显示
- ✅ 我的Tab作品集和统计正常显示

### 性能指标
- ✅ 首屏加载<1秒
- ✅ Tab切换<200ms
- ✅ 滚动流畅（60fps）
- ✅ 内存占用<150MB

### 视觉一致性
- ✅ 间距符合设计规范（8/12/16/24pt）
- ✅ 颜色符合品牌色（主色/功能色）
- ✅ 字体统一使用SF Pro
- ✅ 动画流畅自然

---

## 🚢 发布流程

### Pre-launch检查
1. ✅ 所有测试用例通过
2. ✅ 6种语言本地化完整
3. ✅ 代码review完成
4. ✅ 性能测试通过
5. ✅ UI/UX审查通过

### 灰度发布计划
```
Week 1: 5%用户（内部测试）
Week 2: 20%用户（观察数据）
Week 3: 50%用户（持续优化）
Week 4: 100%用户（全量发布）
```

### 监控指标
- Feed完播率（目标≥60%）
- 互动率（目标≥12%）
- 次日留存（目标≥40%）
- Crash率（<0.1%）

---

## 📞 联系和支持

**技术问题**:
- Slack: #feed-redesign频道
- 邮件: dev-team@funnypixels.com

**设计问题**:
- Figma: Feed Redesign V2
- 设计师: @DesignLead

**产品问题**:
- 产品经理: @ProductManager
- 产品需求文档: docs/Feed_Tab_Redesign_Proposal.md

---

**文档版本**: v1.0
**更新日期**: 2026-03-04
**预计完成时间**: 2周（80工时）
**负责人**: 前端团队Lead
