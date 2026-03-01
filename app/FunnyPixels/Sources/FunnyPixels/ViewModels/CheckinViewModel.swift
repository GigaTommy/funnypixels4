import Foundation

@MainActor
class CheckinViewModel: ObservableObject {
    @Published var canCheckin = false
    @Published var isLoading = false
    @Published var checkinResult: CheckinResult?
    @Published var stats: CheckinStats?
    @Published var showSuccess = false
    @Published var errorMessage: String?

    func checkCanCheckin() async {
        do {
            let response: CanCheckinResponse = try await APIManager.shared.request(endpoint: .canCheckin)
            canCheckin = response.canCheckin
        } catch {
            Logger.error("检查签到状态失败: \(error)")
        }
    }

    func performCheckin() async {
        guard canCheckin, !isLoading else { return }
        isLoading = true
        errorMessage = nil

        do {
            let response: CheckinResponse = try await APIManager.shared.request(endpoint: .dailyCheckin)
            if response.success, let result = response.checkin {
                checkinResult = result
                canCheckin = false
                SoundManager.shared.playCheckinSuccess()
                showSuccess = true
            } else {
                errorMessage = response.message ?? "签到失败"
            }
        } catch {
            errorMessage = "网络错误，请稍后重试"
            Logger.error("签到失败: \(error)")
        }

        isLoading = false
    }

    func fetchStats() async {
        do {
            let response: CheckinStatsResponse = try await APIManager.shared.request(endpoint: .checkinStats)
            stats = response.stats
        } catch {
            Logger.error("获取签到统计失败: \(error)")
        }
    }
}
