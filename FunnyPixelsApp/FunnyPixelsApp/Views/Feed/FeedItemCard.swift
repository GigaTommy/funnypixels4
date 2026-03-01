import SwiftUI

/// 动态卡片
struct FeedItemCard: View {
    let item: FeedService.FeedItem
    let onLike: () -> Void
    let onComment: () -> Void
    @State private var likeAnimating = false

    var body: some View {
        VStack(alignment: .leading, spacing: AppSpacing.m) {
            // 头部：头像 + 名称 + 时间
            HStack(spacing: AppSpacing.m) {
                AvatarView(
                    avatarUrl: item.user.avatar_url,
                    avatar: item.user.avatar,
                    displayName: item.user.displayName,
                    size: 40
                )

                VStack(alignment: .leading, spacing: 2) {
                    Text(item.user.displayName)
                        .font(AppTypography.body())
                        .foregroundColor(AppColors.textPrimary)
                        .lineLimit(1)

                    Text(item.timeAgo)
                        .font(AppTypography.caption())
                        .foregroundColor(AppColors.textTertiary)
                }

                Spacer()

                feedTypeIcon
            }

            // 内容描述
            feedContentView

            // 底部操作栏
            HStack(spacing: AppSpacing.xl) {
                // 点赞
                Button {
                    // ⚡ 点赞反馈
                    SoundManager.shared.play(.likeSend)
                    HapticManager.shared.impact(style: .light)

                    withAnimation(.spring(response: 0.3, dampingFraction: 0.5)) {
                        likeAnimating = true
                    }
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                        likeAnimating = false
                    }
                    onLike()
                } label: {
                    HStack(spacing: 4) {
                        Image(systemName: item.is_liked ? "heart.fill" : "heart")
                            .font(.system(size: 16))
                            .foregroundColor(item.is_liked ? .red : AppColors.textTertiary)
                            .scaleEffect(likeAnimating ? 1.3 : 1.0)
                        if item.like_count > 0 {
                            Text("\(item.like_count)")
                                .font(AppTypography.caption())
                                .foregroundColor(AppColors.textSecondary)
                        }
                    }
                }

                // 评论
                Button(action: onComment) {
                    HStack(spacing: 4) {
                        Image(systemName: "bubble.right")
                            .font(.system(size: 16))
                            .foregroundColor(AppColors.textTertiary)
                        if item.comment_count > 0 {
                            Text("\(item.comment_count)")
                                .font(AppTypography.caption())
                                .foregroundColor(AppColors.textSecondary)
                        }
                    }
                }

                Spacer()
            }
        }
        .padding(AppSpacing.l)
        .background(AppColors.surface)
        .clipShape(RoundedRectangle(cornerRadius: AppRadius.l))
        .modifier(AppShadows.small())
    }

    // MARK: - Type Icon

    @ViewBuilder
    private var feedTypeIcon: some View {
        switch item.type {
        case "drawing_complete":
            Image(systemName: "paintbrush.fill")
                .font(.system(size: 14))
                .foregroundColor(AppColors.primary)
        case "achievement":
            Image(systemName: "trophy.fill")
                .font(.system(size: 14))
                .foregroundColor(.orange)
        case "checkin":
            Image(systemName: "calendar.badge.checkmark")
                .font(.system(size: 14))
                .foregroundColor(.green)
        case "alliance_join":
            Image(systemName: "flag.fill")
                .font(.system(size: 14))
                .foregroundColor(.blue)
        default:
            EmptyView()
        }
    }

    // MARK: - Content View

    @ViewBuilder
    private var feedContentView: some View {
        switch item.type {
        case "drawing_complete":
            drawingContent
        case "achievement":
            achievementContent
        case "checkin":
            checkinContent
        case "alliance_join":
            allianceContent
        default:
            Text(item.type)
                .font(AppTypography.body())
                .foregroundColor(AppColors.textSecondary)
        }
    }

    private var drawingContent: some View {
        VStack(alignment: .leading, spacing: AppSpacing.s) {
            HStack(spacing: AppSpacing.m) {
                if let pixelCount = item.content.pixel_count, pixelCount > 0 {
                    Label("\(pixelCount)", systemImage: "square.grid.3x3.fill")
                        .font(AppTypography.caption())
                        .foregroundColor(AppColors.secondary)
                }

                if let city = item.content.city, !city.isEmpty {
                    Label(city, systemImage: "mappin")
                        .font(AppTypography.caption())
                        .foregroundColor(AppColors.textSecondary)
                }

                if let duration = item.content.duration_seconds, duration > 0 {
                    Label(formatDuration(duration), systemImage: "clock")
                        .font(AppTypography.caption())
                        .foregroundColor(AppColors.textSecondary)
                }
            }

            Text(String(format: NSLocalizedString("feed.drawing.description", comment: ""), item.content.pixel_count ?? 0))
                .font(AppTypography.body())
                .foregroundColor(AppColors.textPrimary)
        }
    }

    private var achievementContent: some View {
        HStack(spacing: AppSpacing.m) {
            Image(systemName: "trophy.fill")
                .font(.system(size: 24))
                .foregroundColor(.orange)
            Text(item.content.achievement_name ?? NSLocalizedString("feed.achievement.unlocked", comment: "Achievement unlocked"))
                .font(AppTypography.body())
                .foregroundColor(AppColors.textPrimary)
        }
    }

    private var checkinContent: some View {
        Text(NSLocalizedString("feed.checkin.description", comment: "Checked in today"))
            .font(AppTypography.body())
            .foregroundColor(AppColors.textPrimary)
    }

    private var allianceContent: some View {
        HStack(spacing: AppSpacing.m) {
            Image(systemName: "flag.fill")
                .font(.system(size: 20))
                .foregroundColor(.blue)
            Text(String(format: NSLocalizedString("feed.alliance.joined", comment: ""), item.content.alliance_name ?? ""))
                .font(AppTypography.body())
                .foregroundColor(AppColors.textPrimary)
        }
    }

    private func formatDuration(_ seconds: Int) -> String {
        if seconds < 60 { return "\(seconds)s" }
        let minutes = seconds / 60
        if minutes < 60 { return "\(minutes)m" }
        let hours = minutes / 60
        return "\(hours)h \(minutes % 60)m"
    }
}
