import SwiftUI
import Combine

/// 用户主页 - 遵循简约设计原则
struct UserProfileView: View {
    @ObservedObject private var fontManager = FontSizeManager.shared
    let userId: String

    @StateObject private var viewModel = UserProfileViewModel()
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ScrollView {
            VStack(spacing: FeedDesign.Spacing.l) {
                if viewModel.isLoading {
                    ProgressView()
                        .padding()
                } else if let profile = viewModel.userProfile {
                    // 用户信息头部
                    userHeader(profile)

                    // 统计数据
                    statsSection(profile)

                    // 用户动态（TODO: 未来实现）
                    Spacer()
                } else if viewModel.showError {
                    errorView
                }
            }
            .padding(FeedDesign.Spacing.m)
        }
        .background(FeedDesign.Colors.background)
        .navigationBarTitleDisplayMode(.inline)
        .task {
            await viewModel.loadProfile(userId: userId)
        }
    }

    // MARK: - User Header

    private func userHeader(_ profile: FeedUserProfile) -> some View {
        VStack(spacing: FeedDesign.Spacing.m) {
            // 头像
            AvatarView(
                avatarUrl: profile.avatar_url,
                avatar: profile.avatar,
                displayName: profile.display_name ?? profile.username ?? "",
                size: 80
            )

            // 用户名
            Text(profile.display_name ?? profile.username ?? NSLocalizedString("common.unknown_user", comment: ""))
                .font(FeedDesign.Typography.title)
                .foregroundColor(FeedDesign.Colors.text)

            // 关注按钮
            if !profile.is_self {
                followButton(profile)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, FeedDesign.Spacing.m)
    }

    private func followButton(_ profile: FeedUserProfile) -> some View {
        Button {
            Task {
                await viewModel.toggleFollow(userId: userId)
            }
        } label: {
            Text(profile.is_following ? NSLocalizedString("feed.action.following", comment: "") : NSLocalizedString("feed.action.follow", comment: ""))
                .font(FeedDesign.Typography.body)
                .foregroundColor(profile.is_following ? FeedDesign.Colors.textSecondary : FeedDesign.Colors.text)
                .padding(.horizontal, FeedDesign.Spacing.m)
                .padding(.vertical, FeedDesign.Spacing.xs)
                .frame(minWidth: 100)
                .overlay(
                    Rectangle()
                        .stroke(profile.is_following ? FeedDesign.Colors.line : FeedDesign.Colors.text, lineWidth: FeedDesign.Layout.borderWidth)
                )
        }
    }

    // MARK: - Stats Section

    private func statsSection(_ profile: FeedUserProfile) -> some View {
        HStack(spacing: 0) {
            statItem(
                count: profile.followers_count ?? 0,
                label: NSLocalizedString("profile.followers", comment: "Followers")
            )

            Rectangle()
                .fill(FeedDesign.Colors.line)
                .frame(width: FeedDesign.Layout.borderWidth)
                .frame(height: 40)

            statItem(
                count: profile.following_count ?? 0,
                label: NSLocalizedString("profile.following", comment: "Following")
            )

            Rectangle()
                .fill(FeedDesign.Colors.line)
                .frame(width: FeedDesign.Layout.borderWidth)
                .frame(height: 40)

            statItem(
                count: profile.pixel_count ?? 0,
                label: NSLocalizedString("common.pixels", comment: "Pixels")
            )
        }
        .overlay(
            Rectangle()
                .stroke(FeedDesign.Colors.line, lineWidth: FeedDesign.Layout.borderWidth)
        )
    }

    private func statItem(count: Int, label: String) -> some View {
        VStack(spacing: FeedDesign.Spacing.xs) {
            Text("\(count)")
                .font(FeedDesign.Typography.title)
                .foregroundColor(FeedDesign.Colors.text)

            Text(label)
                .font(FeedDesign.Typography.caption)
                .foregroundColor(FeedDesign.Colors.textSecondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, FeedDesign.Spacing.s)
    }

    // MARK: - Error View

    private var errorView: some View {
        VStack(spacing: FeedDesign.Spacing.m) {
            Text(NSLocalizedString("feed.error.load_failed", comment: ""))
                .font(FeedDesign.Typography.body)
                .foregroundColor(FeedDesign.Colors.textSecondary)

            Button {
                Task {
                    await viewModel.loadProfile(userId: userId)
                }
            } label: {
                Text(NSLocalizedString("common.retry", comment: ""))
                    .font(FeedDesign.Typography.body)
                    .foregroundColor(FeedDesign.Colors.text)
                    .padding(.horizontal, FeedDesign.Spacing.m)
                    .padding(.vertical, FeedDesign.Spacing.xs)
                    .overlay(
                        Rectangle()
                            .stroke(FeedDesign.Colors.text, lineWidth: FeedDesign.Layout.borderWidth)
                    )
            }
        }
        .padding()
    }
}

// MARK: - ViewModel

@MainActor
class UserProfileViewModel: ObservableObject {
    @Published var userProfile: FeedUserProfile?
    @Published var isLoading = false
    @Published var showError = false

    func loadProfile(userId: String) async {
        isLoading = true
        showError = false
        defer { isLoading = false }

        do {
            let response = try await ProfileService.shared.getUserProfile(userId: userId)
            // 将 ProfileService.UserProfileResponse 转换为简化的 UserProfile
            userProfile = FeedUserProfile(
                id: response.user.id,
                username: response.user.username,
                display_name: nil, // ProfileService doesn't have display_name
                avatar: response.user.avatar,
                avatar_url: response.user.avatar_url,
                pixel_count: response.user.total_pixels,
                followers_count: response.followers_count,
                following_count: response.following_count,
                is_following: response.is_following ?? false,
                is_self: false // TODO: check if current user
            )
        } catch {
            Logger.error("Failed to load user profile: \(error)")
            showError = true
        }
    }

    func toggleFollow(userId: String) async {
        guard let profile = userProfile else { return }

        // 乐观更新
        var updated = profile
        updated.is_following = !profile.is_following
        updated.followers_count = profile.is_following
            ? max(0, (profile.followers_count ?? 0) - 1)
            : (profile.followers_count ?? 0) + 1
        userProfile = updated

        do {
            if profile.is_following {
                _ = try await SocialService.shared.unfollowUser(userId: userId)
            } else {
                _ = try await SocialService.shared.followUser(userId: userId)
            }
        } catch {
            // 回滚
            userProfile = profile
            Logger.error("Failed to toggle follow: \(error)")
        }
    }
}

// MARK: - Models

struct FeedUserProfile {
    let id: String
    let username: String?
    let display_name: String?
    let avatar: String?
    let avatar_url: String?
    let pixel_count: Int?
    var followers_count: Int?
    var following_count: Int?
    var is_following: Bool
    let is_self: Bool
}
