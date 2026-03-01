import Foundation
import Combine

@MainActor
class DailyRewardSummaryViewModel: ObservableObject {
    @Published var summary: DailyRewardService.RewardSummary?
    @Published var isLoading = false
    @Published var dismissed = false

    private let service = DailyRewardService.shared

    func loadSummary() async {
        isLoading = true
        defer { isLoading = false }

        do {
            let data = try await service.getPendingSummary()
            if data.has_pending {
                summary = data.summary
            }
        } catch {
            Logger.error("Failed to load daily reward summary: \(error)")
        }
    }

    func acknowledge() async {
        guard let date = summary?.reward_date else { return }
        do {
            try await service.acknowledge(date: date)
        } catch {
            Logger.error("Failed to acknowledge daily reward: \(error)")
        }
        dismissed = true
    }
}
