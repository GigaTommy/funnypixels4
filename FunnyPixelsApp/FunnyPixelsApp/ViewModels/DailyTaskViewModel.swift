import Foundation
import Combine
import UIKit

@MainActor
class DailyTaskViewModel: ObservableObject {
    @Published var tasks: [DailyTaskService.DailyTask] = []
    @Published var completedCount = 0
    @Published var totalCount = 0
    @Published var allCompleted = false
    @Published var bonusAvailable = false
    @Published var bonusClaimed = false
    @Published var bonusPoints = 50
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var claimingTaskId: Int?
    @Published var claimingBonus = false
    @Published var toastMessage: String?
    @Published var showRewardAnimation = false
    @Published var lastClaimedPoints = 0

    private let service = DailyTaskService.shared
    private var cancellables = Set<AnyCancellable>()

    init() {
        // ✨ 监听任务刷新通知
        NotificationCenter.default.publisher(for: .dailyTasksNeedRefresh)
            .sink { [weak self] notification in
                guard let self = self else { return }

                Task { @MainActor [weak self] in
                    guard let self = self else { return }

                    // 检查是否是乐观更新
                    if let userInfo = notification.userInfo as? [String: Any],
                       let isOptimistic = userInfo["optimisticUpdate"] as? Bool,
                       isOptimistic {

                        // 🚀 乐观更新：本地立即更新UI，不调用API
                        if let sessions = userInfo["sessionCompleted"] as? Int,
                           let pixels = userInfo["pixelsDrawn"] as? Int {
                            Logger.info("🚀 执行乐观更新: sessions=\(sessions), pixels=\(pixels)")
                            self.updateTasksLocally(sessions: sessions, pixels: pixels)
                        }
                    } else if let userInfo = notification.userInfo as? [String: Any],
                              let rollback = userInfo["rollback"] as? Bool,
                              rollback {
                        // ❌ 回滚：重新加载任务
                        Logger.warning("❌ 回滚乐观更新，重新加载任务")
                        await self.loadTasks()
                    } else {
                        // ✅ 正常刷新：调用API同步后端数据
                        await self.loadTasks()
                    }
                }
            }
            .store(in: &cancellables)
    }

    func loadTasks() async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        Logger.info("📊 开始加载每日任务...")

        do {
            let data = try await service.getTasks()
            tasks = data.tasks
            completedCount = data.completedCount
            totalCount = data.totalCount
            allCompleted = data.allCompleted
            bonusAvailable = data.bonusAvailable
            bonusClaimed = data.bonusClaimed
            bonusPoints = data.bonusPoints

            Logger.info("✅ 成功加载每日任务: \(totalCount) 个任务, \(completedCount) 个已完成")
            Logger.info("   任务列表:")
            for (index, task) in tasks.enumerated() {
                Logger.info("   \(index + 1). [\(task.type)] \(task.title): \(task.current)/\(task.target)")
            }
        } catch {
            errorMessage = error.localizedDescription
            Logger.error("❌ 加载每日任务失败: \(error)")
            Logger.error("   错误详情: \(error.localizedDescription)")

            // 重置为空数组，避免显示旧数据
            tasks = []
            completedCount = 0
            totalCount = 0
        }
    }

    func claimReward(taskId: Int) async {
        claimingTaskId = taskId
        defer { claimingTaskId = nil }

        do {
            let points = try await service.claimReward(taskId: taskId)

            // ✨ Success feedback
            HapticManager.shared.notification(type: .success)
            SoundManager.shared.playSuccess()

            // ✨ Show celebration animation
            lastClaimedPoints = points
            showRewardAnimation = true

            toastMessage = "+\(points) pts"

            // Update local state
            if let index = tasks.firstIndex(where: { $0.id == taskId }) {
                tasks[index].isClaimed = true
            }

            // Update bonus state locally
            completedCount = tasks.filter { $0.isCompleted }.count
            allCompleted = completedCount >= totalCount && totalCount > 0
            if allCompleted && !bonusClaimed {
                bonusAvailable = true
            }
        } catch {
            // ✨ Failure feedback
            HapticManager.shared.notification(type: .error)
            SoundManager.shared.playFailure()

            toastMessage = NSLocalizedString("daily_task.claim_failed", comment: "Claim failed")
            Logger.error("Failed to claim task reward: \(error)")
        }
    }

    func claimBonus() async {
        claimingBonus = true
        defer { claimingBonus = false }

        do {
            let points = try await service.claimBonus()

            // ✨ Success feedback
            HapticManager.shared.notification(type: .success)
            SoundManager.shared.playSuccess()

            // ✨ Show celebration animation
            lastClaimedPoints = points
            showRewardAnimation = true

            toastMessage = "+\(points) pts"
            bonusClaimed = true
            bonusAvailable = false
        } catch {
            // ✨ Failure feedback
            HapticManager.shared.notification(type: .error)
            SoundManager.shared.playFailure()

            toastMessage = NSLocalizedString("daily_task.claim_failed", comment: "Claim failed")
            Logger.error("Failed to claim bonus: \(error)")
        }
    }

    // MARK: - 🚀 乐观更新

    /// 本地更新任务进度（乐观更新，不调用API）
    private func updateTasksLocally(sessions: Int, pixels: Int) {
        Logger.info("📊 本地更新任务进度: sessions=\(sessions), pixels=\(pixels)")

        var updated = false

        // 更新 draw_sessions 任务
        if sessions > 0, let index = tasks.firstIndex(where: { $0.type == "draw_sessions" }) {
            var task = tasks[index]
            let oldCurrent = task.current
            task.current = min(task.current + sessions, task.target)
            task.progress = Double(task.current) / Double(task.target)
            task.isCompleted = task.current >= task.target

            tasks[index] = task
            updated = true

            Logger.info("  ✅ draw_sessions: \(oldCurrent) → \(task.current)/\(task.target) \(task.isCompleted ? "✓完成" : "")")
        }

        // 更新 draw_pixels 任务
        if pixels > 0, let index = tasks.firstIndex(where: { $0.type == "draw_pixels" }) {
            var task = tasks[index]
            let oldCurrent = task.current
            task.current = min(task.current + pixels, task.target)
            task.progress = Double(task.current) / Double(task.target)
            task.isCompleted = task.current >= task.target

            tasks[index] = task
            updated = true

            Logger.info("  ✅ draw_pixels: \(oldCurrent) → \(task.current)/\(task.target) \(task.isCompleted ? "✓完成" : "")")
        }

        // 更新统计信息
        if updated {
            completedCount = tasks.filter { $0.isCompleted }.count
            allCompleted = completedCount >= totalCount && totalCount > 0

            if allCompleted && !bonusClaimed {
                bonusAvailable = true
            }

            Logger.info("  📊 任务进度: \(completedCount)/\(totalCount) \(allCompleted ? "🎉全部完成" : "")")

            // ✨ 震动反馈
            HapticManager.shared.notification(type: .success)
        }
    }
}
