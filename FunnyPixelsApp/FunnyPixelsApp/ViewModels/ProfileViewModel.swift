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
        let equippedCosmetics: EquippedCosmetics?

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
                    rankTier: user.rankTier,
                    equippedCosmetics: user.equippedCosmetics
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
                    rankTier: user.rankTier,
                    equippedCosmetics: user.equipped_cosmetics
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

    /// 加载所有数据（稳定版 - 顺序执行 + 独立错误处理）
    ///
    /// 优化点：
    /// - ✅ 单次isLoading切换（避免UI闪烁）
    /// - ✅ 独立错误处理（一个失败不影响其他）
    /// - ✅ 智能缓存（60秒内不重复请求）
    /// - ✅ 稳定可靠（顺序执行，避免并发问题）
    ///
    /// force=true 时忽略缓存强制刷新（用于 pull-to-refresh）
    func loadAllData(force: Bool = false) async {
        // 缓存检查：60秒内不重复请求
        if !force, let lastLoad = lastLoadTime,
           Date().timeIntervalSince(lastLoad) < cacheValidDuration,
           userProfile != nil {
            Logger.debug("📦 Using cached profile data (age: \(Int(Date().timeIntervalSince(lastLoad)))s)")
            return
        }

        guard let userId = authManager.currentUser?.id else {
            errorMessage = "未登录"
            return
        }

        isLoading = true
        errorMessage = nil
        let startTime = Date()

        defer {
            isLoading = false
            let elapsed = Date().timeIntervalSince(startTime)
            Logger.info("⏱️ Profile data loaded in \(String(format: "%.2f", elapsed))s")
        }

        // 1️⃣ 加载用户资料（核心数据）
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
                    rankTier: user.rankTier,
                    equippedCosmetics: user.equipped_cosmetics
                )
                followersCount = response.followers_count ?? 0
                followingCount = response.following_count ?? 0
                editDisplayName = user.display_name ?? user.username
                editMotto = user.motto ?? ""
                lastLoadTime = Date()
            }
        } catch {
            Logger.error("Failed to load profile: \(error)")
            errorMessage = "加载用户资料失败"
        }

        // 2️⃣ 加载统计数据（防御性实现）
        do {
            Logger.debug("📊 Loading user stats...")
            let response = try await profileService.getUserStats()
            Logger.debug("📊 Stats response received: success=\(response.success)")

            if response.success {
                let statsData = response.stats
                userStats = UserStats(
                    totalPixels: statsData.total_pixels,
                    drawingTimeMinutes: statsData.drawing_time_minutes,
                    sessionsCount: statsData.sessions_count,
                    rank: statsData.rank,
                    pixelsThisWeek: statsData.pixels_this_week,
                    pixelsThisMonth: statsData.pixels_this_month
                )
                Logger.info("✅ Stats loaded successfully")
            }
        } catch let error as NSError {
            Logger.error("❌ Failed to load stats - Domain: \(error.domain), Code: \(error.code), Description: \(error.localizedDescription)")
        } catch {
            Logger.error("❌ Failed to load stats: \(error)")
        }

        // 3️⃣ 加载成就高亮
        do {
            achievementHighlights = try await AchievementService.shared.getUserAchievementHighlights()
        } catch {
            Logger.error("Failed to load achievement highlights: \(error)")
        }

        // 4️⃣ 加载成就统计
        do {
            let stats = try await AchievementService.shared.getUserAchievementStats()
            let completed = stats.completedCount ?? 0
            let claimed = stats.claimedCount ?? 0
            hasUnclaimedRewards = completed > claimed
        } catch {
            Logger.error("Failed to load achievement stats: \(error)")
        }

        // 5️⃣ 加载未读消息数
        do {
            let unread = try await NotificationService.shared.getUnreadCount()
            unreadMessageCount = unread.total_unread
        } catch {
            Logger.error("Failed to load unread count: \(error)")
        }
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
                // ✅ 更新成功
                Logger.info("✅ Profile update API succeeded")

                // 清除头像图片缓存，确保新头像能被加载
                if editAvatarData != nil {
                    ImageCache.removeCachedImages(matching: "avatar")
                }

                // 尝试刷新用户信息（如果失败也不影响成功状态）
                do {
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
                        rankTier: user.rankTier,
                        equippedCosmetics: user.equippedCosmetics
                    )
                    Logger.info("✅ Profile refreshed successfully")
                } catch {
                    // 刷新失败不影响保存成功状态，数据会在下次loadAllData时刷新
                    Logger.warning("⚠️ Failed to refresh profile after save (non-critical): \(error)")
                }

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
