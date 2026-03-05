import SwiftUI

/// 社交动态列表
struct SocialFeedView: View {
    @StateObject private var viewModel = FeedViewModel()
    @State private var selectedCommentItem: FeedService.FeedItem?
    @ObservedObject private var fontManager = FontSizeManager.shared

    var body: some View {
        VStack(spacing: 0) {
            // 筛选器
            FeedFilterPicker(filter: $viewModel.filter)
                .padding(.vertical, AppSpacing.s)
                .background(AppColors.background)

            if viewModel.isLoading {
                LoadingView()
            } else if viewModel.items.isEmpty {
                feedEmptyView
            } else {
                ScrollView {
                    LazyVStack(spacing: AppSpacing.l) {
                        ForEach(viewModel.items) { item in
                            FeedItemCard(
                                item: item,
                                onLike: { Task { await viewModel.toggleLike(item: item) } },
                                onComment: { selectedCommentItem = item },
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
                    .padding(AppSpacing.l)
                }
                .refreshable {
                    await viewModel.loadFeed(refresh: true)
                }
            }
        }
        .task {
            await viewModel.loadFeed(refresh: true)
        }
        .sheet(item: $selectedCommentItem) { item in
            FeedCommentSheet(feedItem: item)
                .presentationDetents([.medium, .large])
                .presentationDragIndicator(.visible)
        }
    }

    private var feedEmptyView: some View {
        VStack(spacing: FeedDesign.Spacing.l) {
            Spacer()
            Text(emptyTitle)
                .font(FeedDesign.Typography.body)
                .foregroundColor(FeedDesign.Colors.textSecondary)
            Text(emptyMessage)
                .font(FeedDesign.Typography.caption)
                .foregroundColor(FeedDesign.Colors.textTertiary)
                .multilineTextAlignment(.center)
            Spacer()
        }
        .padding()
    }

    private var emptyTitle: String {
        switch viewModel.filter {
        case "following":
            return NSLocalizedString("feed.empty.following.title", comment: "")
        case "alliance":
            return NSLocalizedString("feed.empty.alliance.title", comment: "")
        case "nearby":
            return NSLocalizedString("feed.empty.nearby.title", comment: "")
        default:
            return NSLocalizedString("feed.empty.all.title", comment: "")
        }
    }

    private var emptyMessage: String {
        switch viewModel.filter {
        case "following":
            return NSLocalizedString("feed.empty.following.action", comment: "")
        case "alliance":
            return NSLocalizedString("feed.empty.alliance.message", comment: "")
        case "nearby":
            return NSLocalizedString("feed.empty.nearby.message", comment: "")
        default:
            return NSLocalizedString("feed.empty.all.message", comment: "")
        }
    }
}

/// 筛选器 - 二级菜单（无音效，避免与一级菜单音效重复）
struct FeedFilterPicker: View {
    @Binding var filter: String

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: AppSpacing.m) {
                FilterChip(
                    title: NSLocalizedString("feed.filter.all", comment: ""),
                    isSelected: filter == "all"
                ) {
                    filter = "all"
                }

                FilterChip(
                    title: NSLocalizedString("feed.filter.following", comment: ""),
                    isSelected: filter == "following"
                ) {
                    filter = "following"
                }

                FilterChip(
                    title: NSLocalizedString("feed.filter.alliance", comment: ""),
                    isSelected: filter == "alliance"
                ) {
                    filter = "alliance"
                }

                FilterChip(
                    title: NSLocalizedString("feed.filter.trending", comment: ""),
                    isSelected: filter == "trending"
                ) {
                    filter = "trending"
                }

                FilterChip(
                    title: NSLocalizedString("feed.filter.challenges", comment: ""),
                    isSelected: filter == "challenges"
                ) {
                    filter = "challenges"
                }

                FilterChip(
                    title: NSLocalizedString("feed.filter.nearby", comment: ""),
                    isSelected: filter == "nearby"
                ) {
                    filter = "nearby"
                }
            }
            .padding(.horizontal, AppSpacing.l)
        }
    }
}

/// 筛选器按钮 - 胶囊样式，与排行榜一致
struct FilterChip: View {
    let title: String
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .responsiveFont(.subheadline, weight: .semibold)  // ✅ 与CapsuleTabPicker相同字体
                .foregroundColor(isSelected ? .white : AppColors.textSecondary)
                .padding(.horizontal, 20)
                .padding(.vertical, 10)
                .background(
                    Capsule()
                        .fill(isSelected ? AppColors.primary : Color(.systemGray6))
                )
        }
        .buttonStyle(.plain)
    }
}
