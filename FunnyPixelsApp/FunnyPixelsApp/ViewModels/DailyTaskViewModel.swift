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

    private let service = DailyTaskService.shared

    func loadTasks() async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        do {
            let data = try await service.getTasks()
            tasks = data.tasks
            completedCount = data.completedCount
            totalCount = data.totalCount
            allCompleted = data.allCompleted
            bonusAvailable = data.bonusAvailable
            bonusClaimed = data.bonusClaimed
            bonusPoints = data.bonusPoints
        } catch {
            errorMessage = error.localizedDescription
            Logger.error("Failed to load daily tasks: \(error)")
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

            toastMessage = "+\(points) pts"

            // Update local state
            if let index = tasks.firstIndex(where: { $0.id == taskId }) {
                let oldTask = tasks[index]
                let updated = DailyTaskService.DailyTask(
                    id: oldTask.id,
                    type: oldTask.type,
                    title: oldTask.title,
                    description: oldTask.description,
                    target: oldTask.target,
                    current: oldTask.current,
                    isCompleted: oldTask.isCompleted,
                    isClaimed: true,
                    rewardPoints: oldTask.rewardPoints,
                    progress: oldTask.progress
                )
                tasks[index] = updated
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
}
