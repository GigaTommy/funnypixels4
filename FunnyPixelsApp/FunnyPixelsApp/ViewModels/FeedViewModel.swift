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

    init() {
        $filter
            .dropFirst()
            .sink { [weak self] _ in
                Task { await self?.loadFeed(refresh: true) }
            }
            .store(in: &cancellables)
    }

    func loadFeed(refresh: Bool = false) async {
        if refresh {
            isLoading = items.isEmpty  // 有缓存数据时不显示 loading
            hasMore = true
        }
        errorMessage = nil

        defer { isLoading = false }

        do {
            // ✨ 获取位置参数（nearby筛选需要）
            var lat: Double? = nil
            var lng: Double? = nil
            if filter == "nearby" {
                if let location = LocationManager.shared.currentLocation {
                    lat = location.coordinate.latitude
                    lng = location.coordinate.longitude
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
            // ✨ 获取位置参数（nearby筛选需要）
            var lat: Double? = nil
            var lng: Double? = nil
            if filter == "nearby", let location = LocationManager.shared.currentLocation {
                lat = location.coordinate.latitude
                lng = location.coordinate.longitude
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

    func shouldLoadMore(currentItem: FeedService.FeedItem) -> Bool {
        guard let index = items.firstIndex(where: { $0.id == currentItem.id }) else { return false }
        return index >= items.count - 5
    }
}
