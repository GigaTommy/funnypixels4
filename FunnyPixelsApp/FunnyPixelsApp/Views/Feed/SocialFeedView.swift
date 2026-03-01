import SwiftUI

/// 社交动态列表
struct SocialFeedView: View {
    @StateObject private var viewModel = FeedViewModel()
    @State private var selectedCommentItem: FeedService.FeedItem?

    var body: some View {
        VStack(spacing: 0) {
            // 筛选器
            FeedFilterPicker(filter: $viewModel.filter)
                .padding(.horizontal)
                .padding(.vertical, AppSpacing.s)

            if viewModel.isLoading {
                LoadingView()
            } else if viewModel.items.isEmpty {
                feedEmptyView
            } else {
                ScrollView {
                    LazyVStack(spacing: AppSpacing.m) {
                        ForEach(viewModel.items) { item in
                            FeedItemCard(
                                item: item,
                                onLike: { Task { await viewModel.toggleLike(item: item) } },
                                onComment: { selectedCommentItem = item }
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
        VStack(spacing: AppSpacing.l) {
            Spacer()
            Image(systemName: "person.2.wave.2")
                .font(.system(size: 48))
                .foregroundColor(AppColors.textTertiary)
            Text(NSLocalizedString("feed.social.empty", comment: "No feed items yet"))
                .font(AppTypography.body())
                .foregroundColor(AppColors.textSecondary)
            Text(NSLocalizedString("feed.social.empty_hint", comment: "Follow players and start drawing"))
                .font(AppTypography.caption())
                .foregroundColor(AppColors.textTertiary)
                .multilineTextAlignment(.center)
            Spacer()
        }
        .padding()
    }
}

/// 筛选器
struct FeedFilterPicker: View {
    @Binding var filter: String

    var body: some View {
        HStack(spacing: AppSpacing.m) {
            FilterChip(
                title: NSLocalizedString("feed.filter.following", comment: "Following"),
                isSelected: filter == "following"
            ) { filter = "following" }

            FilterChip(
                title: NSLocalizedString("feed.filter.all", comment: "All"),
                isSelected: filter == "all"
            ) { filter = "all" }

            Spacer()
        }
    }
}

struct FilterChip: View {
    let title: String
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(AppTypography.caption())
                .fontWeight(isSelected ? .semibold : .regular)
                .foregroundColor(isSelected ? .white : AppColors.textSecondary)
                .padding(.horizontal, 14)
                .padding(.vertical, 6)
                .background(
                    Capsule()
                        .fill(isSelected ? AppColors.primary : AppColors.surface)
                )
                .overlay(
                    Capsule()
                        .stroke(isSelected ? Color.clear : AppColors.border, lineWidth: 1)
                )
        }
    }
}
