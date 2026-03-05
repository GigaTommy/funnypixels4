import Foundation
import SwiftUI
import Combine

@MainActor
class WorldStateFeedViewModel: ObservableObject {
    @Published var events: [WorldStateEvent] = []
    @Published var isLoading = false
    @Published var isLoadingMore = false
    @Published var filter: String = "all"
    @Published var errorMessage: String?
    @Published var hasMore = false

    private let feedService = FeedService.shared
    private let pageSize = 20
    private var currentOffset = 0

    // 性能优化：内存管理
    private let maxCachedEvents = 100

    // 性能优化：任务管理
    private var filterChangeTask: Task<Void, Never>?
    private var loadTask: Task<Void, Never>?
    
    func loadFeed(refresh: Bool = false) async {
        // 性能优化：取消之前的加载任务
        loadTask?.cancel()

        if refresh {
            currentOffset = 0
            isLoading = true
        } else if isLoadingMore {
            return // 防止重复加载
        } else {
            isLoadingMore = true
        }

        defer {
            isLoading = false
            isLoadingMore = false
        }

        loadTask = Task {
            do {
                let response = try await feedService.getWorldStateFeed(
                    filter: filter,
                    limit: pageSize,
                    offset: currentOffset
                )

                guard !Task.isCancelled else { return }

                if response.success, let data = response.data {
                    if refresh {
                        events = data.events
                    } else {
                        events.append(contentsOf: data.events)
                    }
                    hasMore = data.hasMore
                    currentOffset += data.events.count
                }
            } catch {
                guard !Task.isCancelled else { return }
                errorMessage = error.localizedDescription
                Logger.error("Failed to load world state feed: \(error)")
            }
        }

        await loadTask?.value
    }
    
    func changeFilter(_ newFilter: String) async {
        guard newFilter != filter else { return }

        // 性能优化：取消之前的filter切换任务
        filterChangeTask?.cancel()

        filter = newFilter

        // 150ms防抖，避免快速点击导致多次请求
        filterChangeTask = Task {
            try? await Task.sleep(nanoseconds: 150_000_000)
            guard !Task.isCancelled else { return }
            await loadFeed(refresh: true)
        }

        await filterChangeTask?.value
    }

    func loadMore() async {
        guard hasMore && !isLoadingMore else { return }
        await loadFeed(refresh: false)

        // 性能优化：内存管理，保留最新100条事件
        if events.count > maxCachedEvents {
            let removeCount = events.count - maxCachedEvents
            events.removeFirst(removeCount)
            currentOffset -= removeCount
            Logger.info("Memory optimization: Removed \(removeCount) old events, current count: \(events.count)")
        }
    }
}
