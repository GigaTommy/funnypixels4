import Foundation
import Combine
import CoreLocation

/// 社交动态 Feed 视图模型
@MainActor
class FeedViewModel: ObservableObject {
    @Published var items: [FeedService.FeedItem] = []
    @Published var isLoading = false
    @Published var isLoadingMore = false
    @Published var hasMore = true
    @Published var filter: String = "all"  // "all", "following", "alliance", or "nearby"
    @Published var errorMessage: String?

    private let feedService = FeedService.shared
    private var cancellables = Set<AnyCancellable>()
    private let pageSize = 20

    // 🚀 性能优化：位置缓存（5分钟有效期）
    private var cachedLocation: CLLocationCoordinate2D?
    private var locationCacheTime: Date?
    private let locationCacheValidDuration: TimeInterval = 300  // 5分钟

    init() {
        $filter
            .dropFirst()
            .sink { [weak self] _ in
                Task { await self?.loadFeed(refresh: true) }
            }
            .store(in: &cancellables)
    }

    // 🚀 性能优化：获取缓存的位置（5分钟内复用）
    private func getCachedLocationIfNeeded() -> CLLocationCoordinate2D? {
        // 检查缓存是否有效
        if let cached = cachedLocation,
           let cacheTime = locationCacheTime,
           Date().timeIntervalSince(cacheTime) < locationCacheValidDuration {
            return cached
        }

        // 缓存过期或不存在，获取新位置
        if let location = LocationManager.shared.currentLocation {
            cachedLocation = location.coordinate
            locationCacheTime = Date()
            return location.coordinate
        }

        return nil
    }

    func loadFeed(refresh: Bool = false) async {
        if refresh {
            isLoading = items.isEmpty  // 有缓存数据时不显示 loading
            hasMore = true
        }
        errorMessage = nil

        defer { isLoading = false }

        do {
            // ✨ 获取位置参数（nearby筛选需要）- 🚀 使用缓存（5分钟内复用）
            var lat: Double? = nil
            var lng: Double? = nil
            if filter == "nearby" {
                if let location = getCachedLocationIfNeeded() {
                    lat = location.latitude
                    lng = location.longitude
                } else {
                    errorMessage = NSLocalizedString("feed.nearby.location_required", comment: "Location permission required for nearby feed")
                    return
                }
            }

            let response = try await feedService.getFeed(
                filter: filter,
                limit: pageSize,
                offset: 0,
                lat: lat,
                lng: lng
            )
            if response.success, let data = response.data {
                items = data.items  // 原子替换
                hasMore = data.hasMore
            } else {
                errorMessage = response.message
            }
        } catch {
            errorMessage = error.localizedDescription
            Logger.error("Failed to load feed: \(error)")
        }
    }

    func loadMore() async {
        guard hasMore, !isLoadingMore else { return }
        isLoadingMore = true
        defer { isLoadingMore = false }

        do {
            // ✨ 获取位置参数（nearby筛选需要）- 🚀 使用缓存（5分钟内复用）
            var lat: Double? = nil
            var lng: Double? = nil
            if filter == "nearby", let location = getCachedLocationIfNeeded() {
                lat = location.latitude
                lng = location.longitude
            }

            let response = try await feedService.getFeed(
                filter: filter,
                limit: pageSize,
                offset: items.count,
                lat: lat,
                lng: lng
            )
            if response.success, let data = response.data {
                items.append(contentsOf: data.items)
                hasMore = data.hasMore
            }
        } catch {
            Logger.error("Failed to load more feed: \(error)")
        }
    }

    func toggleLike(item: FeedService.FeedItem) async {
        // 乐观更新：立即更新本地状态
        if let index = items.firstIndex(where: { $0.id == item.id }) {
            var updated = items[index]
            updated.is_liked = !item.is_liked
            updated.like_count = item.is_liked ? max(0, item.like_count - 1) : item.like_count + 1
            items[index] = updated
        }

        do {
            if item.is_liked {
                _ = try await feedService.unlikeFeedItem(id: item.id)
            } else {
                _ = try await feedService.likeFeedItem(id: item.id)
                // ✨ 通知每日任务刷新
                NotificationCenter.default.post(name: .dailyTasksNeedRefresh, object: nil)
            }
        } catch {
            // 回滚：恢复原始状态
            if let index = items.firstIndex(where: { $0.id == item.id }) {
                var reverted = items[index]
                reverted.is_liked = item.is_liked
                reverted.like_count = item.like_count
                items[index] = reverted
            }
            Logger.error("Failed to toggle like: \(error)")
        }
    }

    func toggleBookmark(item: FeedService.FeedItem) async {
        // 乐观更新：立即更新本地状态
        if let index = items.firstIndex(where: { $0.id == item.id }) {
            var updated = items[index]
            updated.is_bookmarked = !item.is_bookmarked
            items[index] = updated
        }

        do {
            if item.is_bookmarked {
                _ = try await feedService.unbookmarkFeedItem(id: item.id)
            } else {
                _ = try await feedService.bookmarkFeedItem(id: item.id)
            }
        } catch {
            // 回滚：恢复原始状态
            if let index = items.firstIndex(where: { $0.id == item.id }) {
                var reverted = items[index]
                reverted.is_bookmarked = item.is_bookmarked
                items[index] = reverted
            }
            Logger.error("Failed to toggle bookmark: \(error)")
        }
    }

    func votePoll(item: FeedService.FeedItem, optionIndex: Int) async {
        guard let index = items.firstIndex(where: { $0.id == item.id }) else { return }

        do {
            let response = try await feedService.votePoll(id: item.id, optionIndex: optionIndex)
            if response.success, let voteData = response.data {
                // 更新投票结果
                var updated = items[index]
                if var pollData = updated.poll_data {
                    pollData.votes = voteData.votes
                    updated.poll_data = pollData
                    updated.my_vote_option_index = optionIndex
                    items[index] = updated
                }
            }
        } catch {
            Logger.error("Failed to vote poll: \(error)")
        }
    }

    func shouldLoadMore(currentItem: FeedService.FeedItem) -> Bool {
        guard let index = items.firstIndex(where: { $0.id == currentItem.id }) else { return false }
        return index >= items.count - 5
    }
}
