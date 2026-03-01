import SwiftUI

/// 评论弹窗
struct FeedCommentSheet: View {
    let feedItem: FeedService.FeedItem
    @State private var comments: [FeedService.FeedComment] = []
    @State private var isLoading = true
    @State private var newComment = ""
    @State private var isSending = false
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                if isLoading {
                    LoadingView()
                } else if comments.isEmpty {
                    VStack(spacing: AppSpacing.l) {
                        Spacer()
                        Image(systemName: "bubble.left.and.bubble.right")
                            .font(.system(size: 40))
                            .foregroundColor(AppColors.textTertiary)
                        Text(NSLocalizedString("feed.comments.empty", comment: "No comments yet"))
                            .font(AppTypography.body())
                            .foregroundColor(AppColors.textSecondary)
                        Spacer()
                    }
                } else {
                    ScrollView {
                        LazyVStack(spacing: AppSpacing.m) {
                            ForEach(comments) { comment in
                                CommentRow(comment: comment, onDelete: {
                                    Task { await deleteComment(comment) }
                                })
                            }
                        }
                        .padding(AppSpacing.l)
                    }
                }

                // 评论输入栏
                commentInputBar
            }
            .navigationTitle(NSLocalizedString("feed.comments.title", comment: "Comments"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button(NSLocalizedString("common.confirm", comment: "Done")) {
                        dismiss()
                    }
                }
            }
            .task {
                await loadComments()
            }
        }
    }

    private var commentInputBar: some View {
        HStack(spacing: AppSpacing.m) {
            TextField(NSLocalizedString("feed.comments.placeholder", comment: "Write a comment..."), text: $newComment)
                .textFieldStyle(.roundedBorder)
                .disabled(isSending)

            Button(action: { Task { await sendComment() } }) {
                if isSending {
                    ProgressView()
                        .frame(width: 32, height: 32)
                } else {
                    Image(systemName: "paperplane.fill")
                        .font(.system(size: 18))
                        .foregroundColor(newComment.trimmingCharacters(in: .whitespaces).isEmpty ? AppColors.textTertiary : AppColors.primary)
                }
            }
            .disabled(newComment.trimmingCharacters(in: .whitespaces).isEmpty || isSending)
        }
        .padding(AppSpacing.m)
        .background(AppColors.surface)
    }

    private func loadComments() async {
        isLoading = true
        defer { isLoading = false }

        do {
            let response = try await FeedService.shared.getComments(feedItemId: feedItem.id)
            if response.success, let data = response.data {
                comments = data.comments
            }
        } catch {
            Logger.error("Failed to load comments: \(error)")
        }
    }

    private func sendComment() async {
        let content = newComment.trimmingCharacters(in: .whitespaces)
        guard !content.isEmpty else { return }

        isSending = true
        defer { isSending = false }

        do {
            let response = try await FeedService.shared.addComment(feedItemId: feedItem.id, content: content)
            if response.success {
                newComment = ""
                await loadComments()
            }
        } catch {
            Logger.error("Failed to add comment: \(error)")
        }
    }

    private func deleteComment(_ comment: FeedService.FeedComment) async {
        do {
            let response = try await FeedService.shared.deleteComment(commentId: comment.id)
            if response.success {
                comments.removeAll { $0.id == comment.id }
            }
        } catch {
            Logger.error("Failed to delete comment: \(error)")
        }
    }
}

struct CommentRow: View {
    let comment: FeedService.FeedComment
    let onDelete: () -> Void

    var body: some View {
        HStack(alignment: .top, spacing: AppSpacing.m) {
            AvatarView(
                avatarUrl: comment.user.avatar_url,
                avatar: comment.user.avatar,
                displayName: comment.user.displayName,
                size: 32
            )

            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(comment.user.displayName)
                        .font(AppTypography.caption())
                        .fontWeight(.semibold)
                        .foregroundColor(AppColors.textPrimary)

                    Spacer()

                    Text(formatTime(comment.created_at))
                        .font(.system(size: 11))
                        .foregroundColor(AppColors.textTertiary)
                }

                Text(comment.content)
                    .font(AppTypography.body())
                    .foregroundColor(AppColors.textPrimary)
            }
        }
    }

    private func formatTime(_ dateString: String) -> String {
        guard let date = ISO8601DateFormatter().date(from: dateString) ??
              DateFormatter.feedDateFormatter.date(from: dateString) else {
            return dateString
        }
        let interval = Date().timeIntervalSince(date)
        if interval < 60 { return NSLocalizedString("feed.time.just_now", comment: "Just now") }
        if interval < 3600 { return "\(Int(interval / 60))m" }
        if interval < 86400 { return "\(Int(interval / 3600))h" }
        return "\(Int(interval / 86400))d"
    }
}
