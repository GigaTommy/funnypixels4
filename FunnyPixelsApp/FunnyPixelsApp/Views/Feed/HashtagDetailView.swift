import SwiftUI
import Combine

/// 话题详情页 - 显示某个话题下的所有动态
struct HashtagDetailView: View {
    @ObservedObject private var fontManager = FontSizeManager.shared
    let hashtag: String

    @StateObject private var viewModel = HashtagDetailViewModel()
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        VStack(spacing: 0) {
            // 话题信息头部
            if let tagInfo = viewModel.tagInfo {
                hashtagHeader(tagInfo)
            }

            // 动态列表
            if viewModel.isLoading {
                LoadingView()
            } else if viewModel.items.isEmpty {
                emptyView
            } else {
                ScrollView {
                    LazyVStack(spacing: FeedDesign.Spacing.m) {
                        ForEach(viewModel.items) { item in
                            FeedItemCard(
                                item: item,
                                onLike: { Task { await viewModel.toggleLike(item: item) } },
                                onComment: { /* TODO: 打开评论 */ },
                                onBookmark: { Task { await viewModel.toggleBookmark(item: item) } },
                                onVote: { optionIndex in
                                    Task { await viewModel.votePoll(item: item, optionIndex: optionIndex) }
                                }
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
                    .padding(FeedDesign.Spacing.l)
                }
                .refreshable {
                    await viewModel.loadData(hashtag: hashtag, refresh: true)
                }
            }
        }
        .navigationTitle("#\(hashtag)")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            await viewModel.loadData(hashtag: hashtag)
        }
    }

    // MARK: - Hashtag Header

    @ViewBuilder
    private func hashtagHeader(_ info: HashtagService.HashtagInfo) -> some View {
        VStack(spacing: FeedDesign.Spacing.xs) {
            Text("#\(info.localized)")
                .font(FeedDesign.Typography.title)
                .foregroundColor(FeedDesign.Colors.text)

            Text(String(format: NSLocalizedString("feed.hashtag.posts_count", comment: ""), info.count))
                .font(FeedDesign.Typography.caption)
                .foregroundColor(FeedDesign.Colors.textSecondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, FeedDesign.Spacing.l)
        .background(FeedDesign.Colors.surface)
    }

    // MARK: - Empty View

    private var emptyView: some View {
        VStack(spacing: FeedDesign.Spacing.l) {
            Spacer()

            Image(systemName: FeedDesign.Icon.hashtag)
                .font(.system(size: 48))
                .foregroundColor(FeedDesign.Colors.textTertiary)

            Text(NSLocalizedString("feed.empty.all.title", comment: ""))
                .font(FeedDesign.Typography.body)
                .foregroundColor(FeedDesign.Colors.textSecondary)

            Spacer()
        }
        .padding()
    }
}

// MARK: - ViewModel

@MainActor
class HashtagDetailViewModel: ObservableObject {
    @Published var tagInfo: HashtagService.HashtagInfo?
    @Published var items: [FeedService.FeedItem] = []
    @Published var isLoading = false
    @Published var isLoadingMore = false
    @Published var hasMore = true

    private var currentHashtag = ""
    private let pageSize = 20

    func loadData(hashtag: String, refresh: Bool = false) async {
        guard refresh || currentHashtag != hashtag else { return }

        currentHashtag = hashtag
        isLoading = true
        defer { isLoading = false }

        do {
            let detail = try await HashtagService.shared.getHashtagDetail(
                tag: hashtag,
                offset: 0,
                limit: pageSize
            )

            if let detail = detail {
                tagInfo = detail.tag
                items = detail.items
                hasMore = detail.hasMore
            }
        } catch {
            Logger.error("Failed to load hashtag detail: \(error)")
        }
    }

    func loadMore() async {
        guard hasMore, !isLoadingMore else { return }

        isLoadingMore = true
        defer { isLoadingMore = false }

        do {
            let detail = try await HashtagService.shared.getHashtagDetail(
                tag: currentHashtag,
                offset: items.count,
                limit: pageSize
            )

            if let detail = detail {
                items.append(contentsOf: detail.items)
                hasMore = detail.hasMore
            }
        } catch {
            Logger.error("Failed to load more: \(error)")
        }
    }

    func toggleLike(item: FeedService.FeedItem) async {
        // 乐观更新
        if let index = items.firstIndex(where: { $0.id == item.id }) {
            var updated = items[index]
            updated.is_liked = !item.is_liked
            updated.like_count = item.is_liked ? max(0, item.like_count - 1) : item.like_count + 1
            items[index] = updated
        }

        do {
            if item.is_liked {
                _ = try await FeedService.shared.unlikeFeedItem(id: item.id)
            } else {
                _ = try await FeedService.shared.likeFeedItem(id: item.id)
            }
        } catch {
            // 回滚
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
        // 乐观更新
        if let index = items.firstIndex(where: { $0.id == item.id }) {
            var updated = items[index]
            updated.is_bookmarked = !item.is_bookmarked
            items[index] = updated
        }

        do {
            if item.is_bookmarked {
                _ = try await FeedService.shared.unbookmarkFeedItem(id: item.id)
            } else {
                _ = try await FeedService.shared.bookmarkFeedItem(id: item.id)
            }
        } catch {
            // 回滚
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
            let response = try await FeedService.shared.votePoll(id: item.id, optionIndex: optionIndex)
            if response.success, let voteData = response.data {
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
