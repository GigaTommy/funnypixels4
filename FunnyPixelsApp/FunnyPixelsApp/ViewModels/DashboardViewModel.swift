import Foundation
import Combine

/// 数据仪表盘视图模型
@MainActor
class DashboardViewModel: ObservableObject {
    @Published var overview: DashboardStatsService.Overview?
    @Published var heatmap: [DashboardStatsService.HeatmapDay] = []
    @Published var weeklyTrend: [DashboardStatsService.TrendPoint] = []
    @Published var monthlyTrend: [DashboardStatsService.TrendPoint] = []
    @Published var cityFootprint: [DashboardStatsService.CityFootprintItem] = []
    @Published var isLoading = false
    @Published var errorMessage: String?

    private let service = DashboardStatsService.shared

    func loadDashboard() async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        do {
            let response = try await service.getDashboard()
            if response.success, let data = response.data {
                overview = data.overview
                heatmap = data.heatmap
                weeklyTrend = data.weeklyTrend
                monthlyTrend = data.monthlyTrend
                cityFootprint = data.cityFootprint
            } else {
                errorMessage = response.message
            }
        } catch {
            errorMessage = error.localizedDescription
            Logger.error("Failed to load dashboard: \(error)")
        }
    }
}
