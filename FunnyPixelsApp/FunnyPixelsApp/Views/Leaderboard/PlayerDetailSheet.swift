import SwiftUI

/// Player detail half-sheet shown when tapping a leaderboard entry
struct PlayerDetailSheet: View {
    let entry: LeaderboardService.LeaderboardEntry
    @State private var isFollowing = false
    @State private var isLoadingFollow = false
    @State private var fullProfile: ProfileService.UserProfileResponse?
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        VStack(spacing: AppSpacing.l) {
            // Drag indicator
            Capsule()
                .fill(Color(.systemGray4))
                .frame(width: 36, height: 5)
                .padding(.top, 8)

            // Avatar + Name
            VStack(spacing: AppSpacing.m) {
                AvatarView(
                    avatarUrl: entry.avatar_url,
                    avatar: entry.avatar,
                    avatarColor: entry.avatarColor,
                    displayName: entry.displayName,
                    flagPatternId: entry.flag_pattern_id ?? entry.flag_pattern,
                    patternType: entry.pattern_type,
                    unicodeChar: entry.unicode_char,
                    size: 72
                )

                HStack(spacing: 6) {
                    Text(entry.displayName)
                        .font(AppTypography.headline())
                        .foregroundColor(AppColors.textPrimary)

                    if let tier = entry.rankTier {
                        RankTierBadge(tier: tier, fontSize: 13)
                    }
                }

                if let allianceName = entry.alliance_name {
                    HStack(spacing: 4) {
                        Image(systemName: "shield.fill")
                            .font(.system(size: 11))
                            .foregroundColor(AppColors.primary)
                        Text(allianceName)
                            .font(AppTypography.caption())
                            .foregroundColor(AppColors.textSecondary)
                    }
                }
            }

            // Stats row
            HStack(spacing: 0) {
                statItem(
                    value: "#\(entry.rank)",
                    label: NSLocalizedString("leaderboard.playerdetail.rank", comment: "Rank")
                )

                statDivider

                statItem(
                    value: "\(entry.total_pixels)",
                    label: NSLocalizedString("leaderboard.pixel", comment: "Pixels")
                )

                if let points = entry.points, points > 0 {
                    statDivider

                    statItem(
                        value: "\(points)",
                        label: NSLocalizedString("profile.points", comment: "Points")
                    )
                }
            }
            .padding(AppSpacing.l)
            .background(AppColors.surface)
            .clipShape(RoundedRectangle(cornerRadius: AppRadius.l))
            .modifier(AppShadows.small())

            // Follow button (skip for current user)
            if entry.is_current_user != true {
                Button {
                    Task { await toggleFollow() }
                } label: {
                    HStack(spacing: 6) {
                        if isLoadingFollow {
                            ProgressView()
                                .scaleEffect(0.8)
                                .tint(isFollowing ? AppColors.textSecondary : .white)
                        } else {
                            Image(systemName: isFollowing ? "checkmark" : "person.badge.plus")
                                .font(.system(size: 14))
                        }
                        Text(isFollowing
                             ? NSLocalizedString("social.following_btn", comment: "Following")
                             : NSLocalizedString("social.follow_btn", comment: "Follow"))
                            .font(.system(size: 15, weight: .semibold))
                    }
                    .foregroundColor(isFollowing ? AppColors.textSecondary : .white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .background(isFollowing ? Color(.systemGray5) : AppColors.primary)
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                }
                .disabled(isLoadingFollow)
            }

            Spacer()
        }
        .padding(.horizontal, AppSpacing.l)
        .presentationDetents([.medium])
        .presentationDragIndicator(.hidden)
        .task {
            await loadFollowStatus()
        }
    }

    // MARK: - Helpers

    private func statItem(value: String, label: String) -> some View {
        VStack(spacing: 2) {
            Text(value)
                .font(.system(size: 18, weight: .bold))
                .foregroundColor(AppColors.primary)
            Text(label)
                .font(AppTypography.caption())
                .foregroundColor(AppColors.textTertiary)
        }
        .frame(maxWidth: .infinity)
    }

    private var statDivider: some View {
        Rectangle()
            .fill(AppColors.border)
            .frame(width: 1, height: 30)
    }

    private func loadFollowStatus() async {
        do {
            let status = try await SocialService.shared.checkFollowStatus(userId: entry.userId)
            isFollowing = status.isFollowing
        } catch {
            Logger.error("Failed to check follow status: \(error)")
        }
    }

    private func toggleFollow() async {
        isLoadingFollow = true
        defer { isLoadingFollow = false }

        do {
            if isFollowing {
                _ = try await SocialService.shared.unfollowUser(userId: entry.userId)
                isFollowing = false

                // ✨ Success feedback
                HapticManager.shared.notification(type: .success)
                SoundManager.shared.playSuccess()
            } else {
                _ = try await SocialService.shared.followUser(userId: entry.userId)
                isFollowing = true

                // ✨ Success feedback
                HapticManager.shared.notification(type: .success)
                SoundManager.shared.playSuccess()
            }
        } catch {
            // ✨ Failure feedback
            SoundManager.shared.playFailure()
            HapticManager.shared.notification(type: .error)

            Logger.error("Failed to toggle follow: \(error)")
        }
    }
}
