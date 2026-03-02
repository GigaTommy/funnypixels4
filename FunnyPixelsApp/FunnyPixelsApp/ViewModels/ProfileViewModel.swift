import Foundation
import Combine
import UIKit

/// 个人中心视图模型
/// 负责管理用户资料和统计数据
@MainActor
class ProfileViewModel: ObservableObject {
    // MARK: - Published Properties

    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var userProfile: UserProfile?
    @Published var userStats: UserStats?
    @Published var achievementHighlights: [AchievementService.UserAchievement] = []
    @Published var hasUnclaimedRewards = false
    @Published var unreadMessageCount = 0
    @Published var isEditing = false
    @Published var followersCount = 0
    @Published var followingCount = 0
    // 编辑表单数据
    @Published var editDisplayName = ""
    @Published var editMotto = ""
    @Published var editAvatarData: String?

    // MARK: - Types

    struct UserProfile {
        let id: String
        let username: String
        let email: String?
        let phone: String?
        let avatarUrl: String?
        let avatar: String?
        let motto: String?
        let displayName: String?
        let points: Int?
        let totalPixels: Int?
        let flagPatternId: String?
        let rankTier: RankTier?

        var displayOrUsername: String {
            displayName ?? username
        }
    }

    struct UserStats {
        let totalPixels: Int
        let drawingTimeMinutes: Int?
        let sessionsCount: Int?
        let rank: Int?
        let pixelsThisWeek: Int?
        let pixelsThisMonth: Int?

        var formattedDrawingTime: String {
            guard let minutes = drawingTimeMinutes else { return "暂无数据" }
            if minutes < 60 {
                return "\(minutes)分钟"
            } else {
                let hours = minutes / 60
                let mins = minutes % 60
                return "\(hours)小时\(mins)分钟"
            }
        }
    }

    // MARK: - Private Properties

    private let profileService = ProfileService.shared
    private let authManager = AuthManager.shared
    private var cancellables = Set<AnyCancellable>()

    /// 数据缓存：避免频繁切换 Tab 时重复请求（60秒内复用缓存）
    private var lastLoadTime: Date?
    private let cacheValidDuration: TimeInterval = 60

    // MARK: - Initialization

    init() {
        // 监听当前用户变化
        authManager.$currentUser
            .compactMap { $0 }
            .sink { [weak self] user in
                self?.userProfile = UserProfile(
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    phone: nil,
                    avatarUrl: user.avatarUrl,
                    avatar: user.avatar,
                    motto: nil,
                    displayName: user.displayName,
                    points: nil,
                    totalPixels: nil,
                    flagPatternId: user.alliance?.flagPatternId,
                    rankTier: user.rankTier
                )
            }
            .store(in: &cancellables)

        // ✅ 监听未读消息数更新通知（由 MessageCenterViewModel 发送）
        NotificationCenter.default.publisher(for: .init("RefreshUnreadCount"))
            .compactMap { $0.object as? NotificationService.UnreadCount }
            .receive(on: DispatchQueue.main)
            .sink { [weak self] count in
                self?.unreadMessageCount = count.total_unread
                Logger.info("✅ Badge updated: unread count = \(count.total_unread)")
            }
            .store(in: &cancellables)
    }

    // MARK: - Public Methods

    /// 加载用户资料
    func loadUserProfile() async {
        guard let userId = authManager.currentUser?.id else {
            errorMessage = "未登录"
            return
        }

        isLoading = true
        errorMessage = nil

        defer { isLoading = false }

        do {
            let response = try await profileService.getUserProfile(userId: userId)

            if response.success {
                let user = response.user
                userProfile = UserProfile(
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    phone: user.phone,
                    avatarUrl: user.avatar_url ?? user.avatar,
                    avatar: user.avatar,
                    motto: user.motto,
                    displayName: user.display_name,
                    points: user.points,
                    totalPixels: user.total_pixels,
                    flagPatternId: user.alliance?.flag_pattern_id,
                    rankTier: user.rankTier
                )

                // Social stats
                followersCount = response.followers_count ?? 0
                followingCount = response.following_count ?? 0

                // 初始化编辑表单
                editDisplayName = user.display_name ?? user.username
                editMotto = user.motto ?? ""
                editAvatarData = user.avatar

                Logger.info("✅ User profile loaded")
            }
        } catch {
            errorMessage = "获取用户资料失败: \(error.localizedDescription)"
            Logger.error("Failed to load user profile: \(error)")
        }
    }

    /// 加载用户统计
    func loadUserStats() async {
        isLoading = true
        errorMessage = nil

        defer { isLoading = false }

        do {
            let response = try await profileService.getUserStats()

            if response.success {
                let stats = response.stats
                userStats = UserStats(
                    totalPixels: stats.total_pixels,
                    drawingTimeMinutes: stats.drawing_time_minutes,
                    sessionsCount: stats.sessions_count,
                    rank: stats.rank,
                    pixelsThisWeek: stats.pixels_this_week,
                    pixelsThisMonth: stats.pixels_this_month
                )
                Logger.info("✅ User stats loaded")
            }
        } catch {
            errorMessage = "获取用户统计失败: \(error.localizedDescription)"
            Logger.error("Failed to load user stats: \(error)")
        }
    }

    /// 加载成就亮点
    func loadAchievementHighlights() async {
        do {
            let highlights = try await AchievementService.shared.getUserAchievementHighlights()
            achievementHighlights = highlights
        } catch {
            Logger.error("Failed to load achievement highlights: \(error)")
            // Don't show error message to user, just log it as this is secondary info
        }
    }

    /// 加载成就统计（用于检查未领取奖励）
    func loadAchievementStats() async {
        do {
            let stats = try await AchievementService.shared.getUserAchievementStats()
            let completed = stats.completedCount ?? 0
            let claimed = stats.claimedCount ?? 0
            hasUnclaimedRewards = completed > claimed
        } catch {
            Logger.error("Failed to load achievement stats for red dot: \(error)")
        }
    }

    /// 加载消息未读数
    func loadUnreadCount() async {
        do {
            let counts = try await NotificationService.shared.getUnreadCount()
            unreadMessageCount = counts.total_unread
            Logger.info("✅ Unread message count: \(unreadMessageCount)")
        } catch {
            Logger.error("Failed to load unread count: \(error)")
        }
    }

    /// 加载所有数据（带缓存检查 + 并行请求）
    /// force=true 时忽略缓存强制刷新（用于 pull-to-refresh）
    func loadAllData(force: Bool = false) async {
        // 缓存检查：60秒内不重复请求
        if !force, let lastLoad = lastLoadTime,
           Date().timeIntervalSince(lastLoad) < cacheValidDuration,
           userProfile != nil {
            return
        }

        // 并行加载所有数据
        async let profile: () = loadUserProfile()
        async let stats: () = loadUserStats()
        async let highlights: () = loadAchievementHighlights()
        async let achievementStats: () = loadAchievementStats()
        async let unread: () = loadUnreadCount()

        _ = await (profile, stats, highlights, achievementStats, unread)
        lastLoadTime = Date()
    }

    /// 保存用户资料
    func saveProfile() async {
        isLoading = true
        errorMessage = nil

        defer { isLoading = false }

        var parameters: [String: Any] = [:]
        parameters["display_name"] = editDisplayName
        parameters["motto"] = editMotto
        
        if let avatar = editAvatarData {
            parameters["avatar"] = avatar
        }

        do {
            let response = try await profileService.updateProfile(parameters: parameters)

            if response.success {
                // 清除头像图片缓存，确保新头像能被加载
                if editAvatarData != nil {
                    ImageCache.removeCachedImages(matching: "avatar")
                }

                // 更新本地用户信息（fetchUserProfile 已返回最新数据，无需再调 loadUserProfile）
                let user = try await authManager.fetchUserProfile()
                userProfile = UserProfile(
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    phone: nil,
                    avatarUrl: user.avatarUrl,  // ✅ CDN路径
                    avatar: user.avatar,         // ✅ 像素数据
                    motto: nil,
                    displayName: user.displayName,
                    points: nil,
                    totalPixels: nil,
                    flagPatternId: user.alliance?.flagPatternId,
                    rankTier: user.rankTier
                )
                lastLoadTime = nil  // 下次 loadAllData 时强制刷新完整数据

                isEditing = false

                // ✨ Success feedback
                SoundManager.shared.playSuccess()
                HapticManager.shared.notification(type: .success)

                Logger.info("✅ Profile saved successfully")
            }
        } catch {
            errorMessage = "保存失败: \(error.localizedDescription)"

            // ✨ Failure feedback
            SoundManager.shared.playFailure()
            HapticManager.shared.notification(type: .error)

            Logger.error("❌ Failed to save profile: \(error)")
            if let networkError = error as? NetworkError {
                Logger.error("❌ Network error detail: \(networkError)")
            }
        }
    }

    /// 开始编辑
    func startEditing() {
        guard let profile = userProfile else { return }
        editDisplayName = profile.displayOrUsername
        editMotto = profile.motto ?? ""
        editAvatarData = profile.avatar
        isEditing = true
    }

    /// 取消编辑
    func cancelEditing() {
        isEditing = false
        editDisplayName = ""
        editMotto = ""
    }

    /// 删除账号
    func deleteAccount() async {
        isLoading = true
        errorMessage = nil

        defer { isLoading = false }

        do {
            let success = try await profileService.deleteAccount()

            if success {
                // 登出
                await authManager.logout()
                Logger.info("✅ Account deleted successfully")
            } else {
                errorMessage = "删除账号失败"
            }
        } catch {
            errorMessage = "删除账号失败: \(error.localizedDescription)"
            Logger.error("Failed to delete account: \(error)")
        }
    }
}
