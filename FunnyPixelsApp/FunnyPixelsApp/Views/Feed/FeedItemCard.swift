import SwiftUI

/// 动态卡片 - 遵循简约设计原则
struct FeedItemCard: View {
    let item: FeedService.FeedItem
    let onLike: () -> Void
    let onComment: () -> Void
    let onBookmark: () -> Void
    let onVote: ((Int) -> Void)?

    @State private var showReportAlert = false
    @State private var reportReason: String?
    @State private var showSessionDetail = false  // ✅ 控制会话详情显示

    var body: some View {
        VStack(alignment: .leading, spacing: FeedDesign.Spacing.m) {
            // 左右布局：左侧用户信息+内容，右侧缩略图
            HStack(alignment: .top, spacing: FeedDesign.Spacing.m) {
                // 左侧：用户信息 + 内容描述
                VStack(alignment: .leading, spacing: FeedDesign.Spacing.s) {
                    // 用户信息（可点击跳转）
                    NavigationLink(destination: UserProfileView(userId: item.user.id)) {
                        HStack(spacing: FeedDesign.Spacing.s) {
                            AvatarView(
                                avatarUrl: item.user.avatar_url,
                                avatar: item.user.avatar,
                                displayName: item.user.displayName,
                                size: 40
                            )

                            VStack(alignment: .leading, spacing: 2) {
                                Text(item.user.displayName)
                                    .font(.system(size: 15, weight: .semibold))
                                    .foregroundColor(FeedDesign.Colors.text)
                                    .lineLimit(1)

                                Text(item.timeAgo)
                                    .font(.system(size: 12))
                                    .foregroundColor(FeedDesign.Colors.textSecondary)
                            }
                        }
                    }
                    .buttonStyle(PlainButtonStyle())

                    // 内容描述（紧跟用户信息）
                    feedContentView
                }

                // 右侧：缩略图（64x64）
                if let sessionId = item.drawing_session_id, !sessionId.isEmpty,
                   (item.type == "drawing_complete" || item.type == "showcase") {
                    SessionThumbnailView(sessionId: sessionId)
                        .frame(width: 64, height: 64)
                        .cornerRadius(8)
                        .onTapGesture {
                            showSessionDetail = true
                        }
                }
            }

            // 底部操作栏
            HStack(spacing: FeedDesign.Spacing.xl) {
                // 点赞
                Button {
                    onLike()
                } label: {
                    HStack(spacing: 4) {
                        Image(systemName: item.is_liked ? "heart.fill" : "heart")
                            .font(.system(size: 16))
                            .foregroundColor(item.is_liked ? FeedDesign.Colors.like : FeedDesign.Colors.textTertiary)
                        if item.like_count > 0 {
                            Text("\(item.like_count)")
                                .font(FeedDesign.Typography.caption)
                                .foregroundColor(FeedDesign.Colors.textSecondary)
                        }
                    }
                }

                // 评论
                Button(action: onComment) {
                    HStack(spacing: 4) {
                        Image(systemName: "bubble.right")
                            .font(.system(size: 16))
                            .foregroundColor(FeedDesign.Colors.textTertiary)
                        if item.comment_count > 0 {
                            Text("\(item.comment_count)")
                                .font(FeedDesign.Typography.caption)
                                .foregroundColor(FeedDesign.Colors.textSecondary)
                        }
                    }
                }

                Spacer()

                // 分享
                ShareLink(item: shareText) {
                    Image(systemName: "square.and.arrow.up")
                        .font(.system(size: 16))
                        .foregroundColor(FeedDesign.Colors.textTertiary)
                }

                // 收藏
                Button(action: onBookmark) {
                    Image(systemName: item.is_bookmarked ? "bookmark.fill" : "bookmark")
                        .font(.system(size: 16))
                        .foregroundColor(item.is_bookmarked ? FeedDesign.Colors.text : FeedDesign.Colors.textTertiary)
                }
            }
        }
        .padding(FeedDesign.Spacing.m)
        .background(AppColors.surface)
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .shadow(color: Color.black.opacity(0.05), radius: 4, x: 0, y: 2)
        .contentShape(RoundedRectangle(cornerRadius: 12))
        .onTapGesture {
            // 统一点击行为：打开作品详情（如果有）
            if item.drawing_session_id != nil && !item.drawing_session_id!.isEmpty,
               (item.type == "drawing_complete" || item.type == "showcase") {
                showSessionDetail = true
            }
        }
        .contextMenu {
            Button {
                showReportAlert = true
            } label: {
                Label(NSLocalizedString("feed.report.title", comment: ""), systemImage: "exclamationmark.triangle")
            }
        }
        .alert(NSLocalizedString("feed.report.title", comment: ""), isPresented: $showReportAlert) {
            Button(NSLocalizedString("feed.report.spam", comment: "")) {
                reportItem(reason: "spam")
            }
            Button(NSLocalizedString("feed.report.harassment", comment: "")) {
                reportItem(reason: "harassment")
            }
            Button(NSLocalizedString("feed.report.inappropriate", comment: "")) {
                reportItem(reason: "inappropriate")
            }
            Button(NSLocalizedString("common.cancel", comment: ""), role: .cancel) {}
        } message: {
            Text(NSLocalizedString("feed.report.reason", comment: ""))
        }
        .sheet(isPresented: $showSessionDetail) {
            // ✅ 显示会话详情（只显示地图部分）
            if let sessionId = item.drawing_session_id {
                SessionDetailMapView(sessionId: sessionId)
            }
        }
    }

    private func reportItem(reason: String) {
        Task {
            do {
                _ = try await FeedService.shared.reportFeedItem(id: item.id, reason: reason, description: nil)
            } catch {
                Logger.error("Failed to report: \(error)")
            }
        }
    }


    // MARK: - Content View

    @ViewBuilder
    private var feedContentView: some View {
        switch item.type {
        case "drawing_complete", "showcase":
            artworkContent
        case "achievement":
            achievementContent
        case "checkin":
            checkinContent
        case "alliance_join":
            allianceContent
        case "moment":
            momentContent
        case "poll":
            pollContent
        default:
            Text(item.type)
                .font(FeedDesign.Typography.body)
                .foregroundColor(FeedDesign.Colors.textSecondary)
        }
    }

    private var artworkContent: some View {
        VStack(alignment: .leading, spacing: 8) {
            // 创作故事（showcase独有，优先显示）
            if let story = item.content.story, !story.isEmpty {
                Text(story)
                    .font(.body)
                    .foregroundColor(FeedDesign.Colors.text)
                    .lineLimit(3)
            }

            // 统计信息（统一格式）
            HStack(spacing: 4) {
                if let pixelCount = item.content.pixel_count, pixelCount > 0 {
                    Image(systemName: "chart.bar.fill")
                        .font(.system(size: 11))
                        .foregroundColor(FeedDesign.Colors.textTertiary)
                    Text("\(pixelCount)")
                        .font(.system(size: 12))
                        .foregroundColor(FeedDesign.Colors.textSecondary)
                }

                if let city = item.content.city, !city.isEmpty {
                    Text("·")
                        .font(.system(size: 12))
                        .foregroundColor(FeedDesign.Colors.textTertiary)
                    Image(systemName: "location.fill")
                        .font(.system(size: 11))
                        .foregroundColor(FeedDesign.Colors.textTertiary)
                    Text(city)
                        .font(.system(size: 12))
                        .foregroundColor(FeedDesign.Colors.textSecondary)
                }

                if let duration = item.content.duration_seconds, duration > 0 {
                    Text("·")
                        .font(.system(size: 12))
                        .foregroundColor(FeedDesign.Colors.textTertiary)
                    Image(systemName: "clock.fill")
                        .font(.system(size: 11))
                        .foregroundColor(FeedDesign.Colors.textTertiary)
                    Text(FeedFormatters.formatDuration(duration))
                        .font(.system(size: 12))
                        .foregroundColor(FeedDesign.Colors.textSecondary)
                }
            }
        }
    }

    private var achievementContent: some View {
        Text(item.content.achievement_name ?? NSLocalizedString("feed.achievement.unlocked", comment: ""))
            .font(FeedDesign.Typography.body)
            .foregroundColor(FeedDesign.Colors.text)
    }

    private var checkinContent: some View {
        Text(NSLocalizedString("feed.checkin.description", comment: ""))
            .font(FeedDesign.Typography.body)
            .foregroundColor(FeedDesign.Colors.text)
    }

    private var allianceContent: some View {
        Text(String(format: NSLocalizedString("feed.alliance.joined", comment: ""), item.content.alliance_name ?? ""))
            .font(FeedDesign.Typography.body)
            .foregroundColor(FeedDesign.Colors.text)
    }

    private var momentContent: some View {
        VStack(alignment: .leading, spacing: FeedDesign.Spacing.xs) {
            if let text = item.content.text, !text.isEmpty {
                Text(text)
                    .font(FeedDesign.Typography.body)
                    .foregroundColor(FeedDesign.Colors.text)
            }
        }
    }

    private var pollContent: some View {
        VStack(alignment: .leading, spacing: FeedDesign.Spacing.m) {
            if let pollData = item.poll_data {
                // 投票问题
                Text(pollData.question)
                    .font(FeedDesign.Typography.body)
                    .foregroundColor(FeedDesign.Colors.text)

                // 投票选项
                VStack(spacing: FeedDesign.Spacing.xs) {
                    ForEach(Array(pollData.options.enumerated()), id: \.offset) { index, option in
                        pollOption(option: option, index: index, pollData: pollData)
                    }
                }

                // 总票数
                let totalVotes = pollData.votes.reduce(0, +)
                if totalVotes > 0 {
                    Text(String(format: NSLocalizedString("feed.poll.votes_count", comment: ""), totalVotes))
                        .font(FeedDesign.Typography.caption)
                        .foregroundColor(FeedDesign.Colors.textTertiary)
                }
            }
        }
    }

    @ViewBuilder
    private func pollOption(option: String, index: Int, pollData: FeedService.FeedItem.PollData) -> some View {
        let totalVotes = pollData.votes.reduce(0, +)
        let votes = pollData.votes[index]
        let percentage = totalVotes > 0 ? Double(votes) / Double(totalVotes) : 0.0
        let hasVoted = item.my_vote_option_index != nil
        let isSelected = item.my_vote_option_index == index

        Button {
            if !hasVoted, let onVote = onVote {
                onVote(index)
            }
        } label: {
            HStack(spacing: FeedDesign.Spacing.s) {
                Text(option)
                    .font(FeedDesign.Typography.body)
                    .foregroundColor(FeedDesign.Colors.text)

                Spacer()

                if hasVoted {
                    Text(String(format: "%.0f%%", percentage * 100))
                        .font(FeedDesign.Typography.caption)
                        .foregroundColor(FeedDesign.Colors.textSecondary)
                }
            }
            .padding(FeedDesign.Spacing.s)
            .background(
                GeometryReader { geometry in
                    HStack(spacing: 0) {
                        Rectangle()
                            .fill(isSelected ? FeedDesign.Colors.surface : FeedDesign.Colors.background)
                            .opacity(hasVoted ? 0.5 : 0)
                            .frame(width: hasVoted ? geometry.size.width * percentage : 0)

                        Spacer(minLength: 0)
                    }
                }
            )
            .overlay(
                Rectangle()
                    .stroke(isSelected ? FeedDesign.Colors.text : FeedDesign.Colors.line, lineWidth: FeedDesign.Layout.borderWidth)
            )
        }
        .disabled(hasVoted)
    }

    // MARK: - Share Text

    private var shareText: String {
        let username = item.user.displayName
        switch item.type {
        case "moment":
            if let text = item.content.text {
                return "\(username): \(text) - FunnyPixels"
            }
        case "showcase":
            if let story = item.content.story, !story.isEmpty {
                return "\(username) 分享了作品: \(story) - FunnyPixels"
            } else if let pixels = item.content.pixel_count {
                return "\(username) 创作了\(pixels)像素的作品 - FunnyPixels"
            }
        case "poll":
            if let pollData = item.poll_data {
                return "\(username) 发起投票: \(pollData.question) - FunnyPixels"
            }
        case "drawing_complete":
            if let pixels = item.content.pixel_count {
                return "\(username) 完成了\(pixels)像素的绘画 - FunnyPixels"
            }
        default:
            break
        }
        return "\(username) 在 FunnyPixels 上发布了动态"
    }
}
