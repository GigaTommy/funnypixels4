import Foundation
import Combine

/// 排行榜视图模型
/// 使用聚合接口：1 次请求预加载全部 4 个排行榜，Tab 切换零延迟
@MainActor
class LeaderboardViewModel: ObservableObject {
    // MARK: - Published Properties

    @Published var isLoading = false  // 首次加载时为 true
    @Published var isRefreshing = false  // 刷新/切换周期时为 true
    @Published var errorMessage: String?
    @Published var selectedPeriod: LeaderboardService.Period = .daily
    @Published var selectedSubTab = 0

    // 个人榜数据
    @Published var personalEntries: [LeaderboardService.LeaderboardEntry] = []
    @Published var personalPagination: LeaderboardService.LeaderboardResponse.LeaderboardData.Pagination?
    @Published var myRank: LeaderboardService.MyRank?

    // 好友榜数据
    @Published var friendsEntries: [LeaderboardService.LeaderboardEntry] = []
    @Published var totalFriends: Int = 0

    // 联盟榜数据
    @Published var allianceEntries: [LeaderboardService.LeaderboardEntry] = []
    @Published var alliancePagination: LeaderboardService.LeaderboardResponse.LeaderboardData.Pagination?

    // 城市榜数据
    @Published var cityEntries: [LeaderboardService.CityLeaderboardEntry] = []
    @Published var cityPagination: LeaderboardService.CityLeaderboardResponse.CityLeaderboardData.Pagination?

    // Pagination: load more
    @Published var isLoadingMore = false
    @Published var personalHasMore = true
    @Published var allianceHasMore = true
    @Published var cityHasMore = true

    // MARK: - Private Properties

    private let leaderboardService = LeaderboardService.shared
    private var cancellables = Set<AnyCancellable>()

    /// 按 period 缓存加载时间（聚合接口一次加载所有 tab，按 period 缓存即可）
    private var periodLoadTimes: [String: Date] = [:]
    private let cacheValidDuration: TimeInterval = 60

    // MARK: - Initialization

    init() {
        setupBindings()
    }

    private func setupBindings() {
        // 时间段改变 → 通过聚合接口重新加载所有 tab
        $selectedPeriod
            .dropFirst()
            .sink { [weak self] _ in
                self?.loadAllLeaderboards(force: true)
            }
            .store(in: &cancellables)

        // 子 Tab 切换 → 数据已预加载，无需网络请求
    }

    // MARK: - Public Methods

    /// 通过聚合接口加载所有排行榜（1 个请求返回 4 种数据）
    func loadAllLeaderboards(force: Bool = false) {
        let cacheKey = selectedPeriod.rawValue

        // 缓存检查：相同 period 在 60 秒内不重复请求
        if !force, let lastLoad = periodLoadTimes[cacheKey],
           Date().timeIntervalSince(lastLoad) < cacheValidDuration,
           !personalEntries.isEmpty {
            return
        }

        // 防止重复请求
        guard !isLoading && !isRefreshing else { return }

        Task {
            // ✅ 首次加载（所有数据为空）显示全屏 Loading
            // ✅ 刷新/切换周期时只显示导航栏 Loading，不阻塞 UI
            let isFirstLoad = personalEntries.isEmpty && allianceEntries.isEmpty &&
                              cityEntries.isEmpty && friendsEntries.isEmpty

            if isFirstLoad {
                isLoading = true
            } else {
                isRefreshing = true
            }

            defer {
                isLoading = false
                isRefreshing = false
            }

            // 首次加载时预热 flag pattern 缓存
            if periodLoadTimes.isEmpty {
                await FlagPatternCache.shared.loadPatterns()
            }

            do {
                let response = try await leaderboardService.getAllLeaderboards(
                    period: selectedPeriod,
                    limit: 50,
                    forceRefresh: force
                )

                if response.success, let data = response.data {
                    // 从单个响应更新全部 4 个 tab 的数据
                    if let personal = data.personal {
                        personalEntries = personal.data
                        personalPagination = personal.pagination
                        personalHasMore = personal.data.count == 50
                        myRank = personal.myRank
                    }
                    if let friends = data.friends {
                        friendsEntries = friends.data
                        totalFriends = friends.totalFriends ?? 0
                    }
                    if let alliance = data.alliance {
                        allianceEntries = alliance.data
                        alliancePagination = alliance.pagination
                        allianceHasMore = alliance.data.count == 50
                    }
                    if let city = data.city {
                        cityEntries = city.data
                        cityPagination = city.pagination
                        cityHasMore = city.data.count == 50
                    }

                    periodLoadTimes[cacheKey] = Date()
                    Logger.info("✅ All leaderboards loaded via aggregated endpoint (1 request)")
                } else {
                    errorMessage = response.message ?? "加载排行榜失败"
                }
            } catch {
                errorMessage = "加载排行榜失败: \(error.localizedDescription)"
                Logger.error("Failed to load aggregated leaderboards: \(error)")
            }
        }
    }

    /// 刷新当前排行榜
    func refresh() {
        loadAllLeaderboards(force: true)
    }

    /// 点赞排行榜项目
    func likeItem(type: String, itemId: String) async {
        do {
            let success = try await leaderboardService.likeLeaderboardItem(type: type, itemId: itemId)
            if success {
                Logger.info("Liked item: \(itemId)")
                refresh()
            }
        } catch {
            errorMessage = "点赞失败: \(error.localizedDescription)"
        }
    }

    /// 取消点赞
    func unlikeItem(type: String, itemId: String) async {
        do {
            let success = try await leaderboardService.unlikeLeaderboardItem(type: type, itemId: itemId)
            if success {
                Logger.info("Unliked item: \(itemId)")
                refresh()
            }
        } catch {
            errorMessage = "取消点赞失败: \(error.localizedDescription)"
        }
    }

    // MARK: - Load More (Pagination) — 使用各自独立的端点

    func loadMorePersonal() async {
        guard !isLoadingMore, personalHasMore else { return }
        isLoadingMore = true
        defer { isLoadingMore = false }

        do {
            let response = try await leaderboardService.getPersonalLeaderboard(
                period: selectedPeriod,
                limit: 50,
                offset: personalEntries.count
            )
            if response.success, let data = response.data {
                personalEntries.append(contentsOf: data.data)
                personalHasMore = data.data.count == 50
            }
        } catch {
            Logger.error("Failed to load more personal: \(error)")
        }
    }

    func loadMoreAlliance() async {
        guard !isLoadingMore, allianceHasMore else { return }
        isLoadingMore = true
        defer { isLoadingMore = false }

        do {
            let response = try await leaderboardService.getAllianceLeaderboard(
                period: selectedPeriod,
                limit: 50,
                offset: allianceEntries.count
            )
            if response.success, let data = response.data {
                allianceEntries.append(contentsOf: data.data)
                allianceHasMore = data.data.count == 50
            }
        } catch {
            Logger.error("Failed to load more alliance: \(error)")
        }
    }

    func loadMoreCity() async {
        guard !isLoadingMore, cityHasMore else { return }
        isLoadingMore = true
        defer { isLoadingMore = false }

        do {
            let response = try await leaderboardService.getCityLeaderboard(
                period: selectedPeriod,
                limit: 50,
                offset: cityEntries.count
            )
            if response.success, let data = response.data {
                cityEntries.append(contentsOf: data.data)
                cityHasMore = data.data.count == 50
            }
        } catch {
            Logger.error("Failed to load more city: \(error)")
        }
    }
}
