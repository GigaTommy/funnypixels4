import SwiftUI
import Combine

/// 关注/粉丝列表页
struct FollowListView: View {
    @ObservedObject private var fontManager = FontSizeManager.shared
    let userId: String
    let initialTab: Int // 0=following, 1=followers

    @StateObject private var viewModel = FollowListViewModel()
    @State private var selectedTab: Int

    init(userId: String, initialTab: Int = 0) {
        self.userId = userId
        self.initialTab = initialTab
        self._selectedTab = State(initialValue: initialTab)
    }

    var body: some View {
        VStack(spacing: 0) {
            // Segmented picker
            Picker("", selection: $selectedTab) {
                Text(NSLocalizedString("social.following", comment: "Following"))
                    .tag(0)
                Text(NSLocalizedString("social.followers", comment: "Followers"))
                    .tag(1)
            }
            .pickerStyle(.segmented)
            .padding(.horizontal, AppSpacing.l)
            .padding(.vertical, AppSpacing.m)

            // Content
            if viewModel.isLoading {
                Spacer()
                ProgressView()
                Spacer()
            } else {
                let users = selectedTab == 0 ? viewModel.following : viewModel.followers

                if users.isEmpty {
                    emptyState
                } else {
                    List(users) { user in
                        UserListRow(
                            user: user,
                            onFollowToggle: {
                                Task { await viewModel.toggleFollow(user: user) }
                            }
                        )
                        .listRowInsets(EdgeInsets(top: 8, leading: 16, bottom: 8, trailing: 16))
                        .listRowSeparator(.hidden)
                    }
                    .listStyle(.plain)
                }
            }
        }
        .navigationTitle(selectedTab == 0
                         ? NSLocalizedString("social.following", comment: "Following")
                         : NSLocalizedString("social.followers", comment: "Followers"))
        .navigationBarTitleDisplayMode(.inline)
        .hideTabBar()
        .task {
            await viewModel.load(userId: userId)
        }
        .onChange(of: selectedTab) {
            // Tab switch doesn't need reload since both lists are loaded
        }
        .overlay(alignment: .top) {
            if let toast = viewModel.toastMessage {
                Text(toast)
                    .responsiveFont(.subheadline, weight: .semibold)
                    .foregroundColor(.white)
                    .padding(.horizontal, 20)
                    .padding(.vertical, 10)
                    .background(Color.black.opacity(0.75))
                    .clipShape(Capsule())
                    .padding(.top, 8)
                    .transition(.move(edge: .top).combined(with: .opacity))
                    .onAppear {
                        DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
                            withAnimation { viewModel.toastMessage = nil }
                        }
                    }
            }
        }
    }

    private var emptyState: some View {
        VStack(spacing: 12) {
            Spacer()
            Image(systemName: selectedTab == 0 ? "person.badge.plus" : "person.2")
                .font(.system(size: 40))
                .foregroundColor(.secondary.opacity(0.5))
            Text(selectedTab == 0
                 ? NSLocalizedString("social.following.empty", comment: "Not following anyone yet")
                 : NSLocalizedString("social.followers.empty", comment: "No followers yet"))
                .responsiveFont(.subheadline)
                .foregroundColor(.secondary)
            Spacer()
        }
    }
}

// MARK: - User List Row

struct UserListRow: View {
    let user: SocialUser
    var onFollowToggle: (() -> Void)?

    var body: some View {
        HStack(spacing: 12) {
            // Avatar
            DecoratedAvatarView(
                avatarUrl: user.avatarUrl,
                avatar: user.avatar,
                displayName: user.displayOrUsername,
                size: 40
            )

            // Name + motto
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 4) {
                    Text(user.displayOrUsername)
                        .responsiveFont(.subheadline, weight: .medium)
                        .foregroundColor(AppColors.textPrimary)
                        .lineLimit(1)

                    if user.isMutual == true {
                        Image(systemName: "arrow.left.arrow.right")
                            .font(.system(size: 8))
                            .foregroundColor(.green)
                    }
                }

                if let motto = user.motto, !motto.isEmpty {
                    Text(motto)
                        .responsiveFont(.caption2)
                        .foregroundColor(.secondary)
                        .lineLimit(1)
                } else if let pixels = user.totalPixels, pixels > 0 {
                    Text("\(pixels) px")
                        .responsiveFont(.caption2)
                        .foregroundColor(.secondary)
                }
            }

            Spacer()

            // Follow button
            if let onFollowToggle = onFollowToggle {
                Button(action: onFollowToggle) {
                    Text(user.isFollowing == true
                         ? NSLocalizedString("social.following_btn", comment: "Following")
                         : NSLocalizedString("social.follow_btn", comment: "Follow"))
                        .responsiveFont(.caption2, weight: .semibold)
                        .foregroundColor(user.isFollowing == true ? .secondary : .white)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 6)
                        .background(
                            user.isFollowing == true
                                ? Color(.systemGray5)
                                : AppColors.primary
                        )
                        .clipShape(Capsule())
                }
            }
        }
        .padding(.vertical, 4)
    }
}

// MARK: - ViewModel

@MainActor
class FollowListViewModel: ObservableObject {
    @Published var following: [SocialUser] = []
    @Published var followers: [SocialUser] = []
    @Published var isLoading = false
    @Published var toastMessage: String?

    private let service = SocialService.shared

    func load(userId: String) async {
        isLoading = true
        defer { isLoading = false }

        async let followingResult = service.getFollowing(userId: userId)
        async let followersResult = service.getFollowers(userId: userId)

        do {
            let (followingList, followersList) = try await (followingResult, followersResult)
            following = followingList
            followers = followersList
        } catch {
            Logger.error("Failed to load follow lists: \(error)")
        }
    }

    func toggleFollow(user: SocialUser) async {
        let isCurrentlyFollowing = user.isFollowing == true

        do {
            if isCurrentlyFollowing {
                _ = try await service.unfollowUser(userId: user.id)
            } else {
                _ = try await service.followUser(userId: user.id)
            }

            // Update local state
            updateFollowState(userId: user.id, isFollowing: !isCurrentlyFollowing)

            // ✨ Success feedback
            HapticManager.shared.notification(type: .success)
            SoundManager.shared.playSuccess()

            toastMessage = isCurrentlyFollowing
                ? NSLocalizedString("social.unfollowed", comment: "Unfollowed")
                : NSLocalizedString("social.followed", comment: "Followed")
        } catch {
            // ✨ Failure feedback
            SoundManager.shared.playFailure()
            HapticManager.shared.notification(type: .error)

            Logger.error("Failed to toggle follow: \(error)")
        }
    }

    private func updateFollowState(userId: String, isFollowing: Bool) {
        if let idx = following.firstIndex(where: { $0.id == userId }) {
            following[idx].isFollowing = isFollowing
        }
        if let idx = followers.firstIndex(where: { $0.id == userId }) {
            followers[idx].isFollowing = isFollowing
        }
    }
}
