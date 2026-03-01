import Foundation
import Combine
import UIKit

/// Tab Bar Badge 视图模型
/// 管理 badge 数据、60 秒轮询和 App 前台刷新
@MainActor
class BadgeViewModel: ObservableObject {
    static let shared = BadgeViewModel()

    // MARK: - Published Properties

    @Published private(set) var badges: BadgeCounts?

    // MARK: - Computed Badge Values

    var mapHasActivity: Bool { badges?.map.hasActivity ?? false }
    var allianceCount: Int { badges?.alliance.count ?? 0 }
    var profileCount: Int { badges?.profile.count ?? 0 }
    var leaderboardRankChanged: Bool { badges?.leaderboard.rankChanged ?? false }

    // MARK: - Private

    private var pollTimer: Timer?
    private var foregroundObserver: AnyCancellable?
    private let pollInterval: TimeInterval = 60

    // MARK: - Init

    private init() {}

    // MARK: - Lifecycle

    /// 启动 badge 轮询（在用户登录后调用）
    func startPolling() {
        stopPolling()

        // 立即刷新一次
        Task { await refresh() }

        // 60 秒定时轮询
        pollTimer = Timer.scheduledTimer(withTimeInterval: pollInterval, repeats: true) { [weak self] _ in
            Task { @MainActor [weak self] in
                await self?.refresh()
            }
        }

        // App 回到前台时刷新
        foregroundObserver = NotificationCenter.default
            .publisher(for: UIApplication.willEnterForegroundNotification)
            .sink { [weak self] _ in
                Task { @MainActor [weak self] in
                    await self?.refresh()
                }
            }
    }

    /// 停止轮询
    func stopPolling() {
        pollTimer?.invalidate()
        pollTimer = nil
        foregroundObserver?.cancel()
        foregroundObserver = nil
    }

    /// 手动刷新 badge 数据
    func refresh() async {
        do {
            badges = try await BadgeService.shared.fetchBadgeCounts()
        } catch {
            // 失败时保留现有数据，不清空
            Logger.warning("Badge refresh failed: \(error.localizedDescription)")
        }
    }

    /// 清空 badge 数据（用户登出时调用）
    func clear() {
        stopPolling()
        badges = nil
    }
}
