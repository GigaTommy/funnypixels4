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

    // 性能优化：任务管理
    private var loadTask: Task<Void, Never>?

    func loadDashboard() async {
        // 性能优化：取消之前的加载任务
        loadTask?.cancel()

        // 防止重复加载
        guard !isLoading else { return }

        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        loadTask = Task {
            do {
                let response = try await service.getDashboard()
                guard !Task.isCancelled else { return }

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
                guard !Task.isCancelled else { return }
                errorMessage = error.localizedDescription
                Logger.error("Failed to load dashboard: \(error)")
            }
        }

        await loadTask?.value
    }
}
