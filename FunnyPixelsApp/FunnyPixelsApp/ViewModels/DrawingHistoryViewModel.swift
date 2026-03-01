import Foundation
import Combine

/// 绘制历史ViewModel
@MainActor
class DrawingHistoryViewModel: ObservableObject {
    @Published var sessions: [DrawingSession] = []
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var showError = false
    @Published var isOfflineMode = false // 🚀 优化：离线模式标识

    // 分页
    @Published var currentPage = 1
    @Published var hasMore = false
    private let pageSize = 20

    // 日期筛选
    @Published var startDate: Date = Calendar.current.date(byAdding: .day, value: -30, to: Date()) ?? Date()
    @Published var endDate: Date = Date()
    @Published var useDateFilter: Bool = false

    // 城市筛选
    @Published var cityFilter: String = ""

    // 视图模式
    enum ViewMode: String, CaseIterable {
        case grid = "square.grid.2x2"
        case list = "list.bullet"
    }

    @Published var viewMode: ViewMode = .grid {
        didSet {
            UserDefaults.standard.set(viewMode.rawValue, forKey: "artwork_view_mode")
        }
    }

    private let service = DrawingHistoryService.shared

    // 🚀 优化：离线缓存支持
    private static let offlineCacheKey = "offline_sessions_cache"
    private static let offlineCacheTimestampKey = "offline_sessions_cache_timestamp"
    private static let offlineCacheMaxAge: TimeInterval = 3600 * 24 // 24小时

    init() {
        // 从本地加载视图模式偏好
        if let savedMode = UserDefaults.standard.string(forKey: "artwork_view_mode"),
           let mode = ViewMode(rawValue: savedMode) {
            self.viewMode = mode
        }
        // 离线缓存不在 init 中加载：移至 loadSessions() 异步上下文，避免阻塞主线程视图构建
    }

    /// 从离线缓存加载数据
    private func loadFromOfflineCache() {
        guard let data = UserDefaults.standard.data(forKey: Self.offlineCacheKey),
              let cachedSessions = try? JSONDecoder().decode([DrawingSession].self, from: data) else {
            return
        }

        // 检查缓存是否过期
        let timestamp = UserDefaults.standard.double(forKey: Self.offlineCacheTimestampKey)
        let cacheAge = Date().timeIntervalSince1970 - timestamp

        if cacheAge < Self.offlineCacheMaxAge {
            sessions = cachedSessions
            Logger.info("📦 从离线缓存加载了 \(cachedSessions.count) 个会话")
        }
    }

    /// 保存到离线缓存
    private func saveToOfflineCache() {
        guard !sessions.isEmpty else { return }

        do {
            let data = try JSONEncoder().encode(sessions)
            UserDefaults.standard.set(data, forKey: Self.offlineCacheKey)
            UserDefaults.standard.set(Date().timeIntervalSince1970, forKey: Self.offlineCacheTimestampKey)
            Logger.info("💾 保存了 \(sessions.count) 个会话到离线缓存")
        } catch {
            Logger.warning("⚠️ 离线缓存保存失败: \(error)")
        }
    }

    /// 加载会话列表
    func loadSessions(refresh: Bool = false) async {
        if refresh {
            currentPage = 1
        }

        guard !isLoading else { return }

        // 首次加载时尝试从离线缓存恢复（在 async 上下文中，不阻塞视图构建）
        if sessions.isEmpty {
            loadFromOfflineCache()
        }

        isLoading = sessions.isEmpty  // 有缓存数据则静默刷新，无缓存才显示 loading
        errorMessage = nil

        do {
            let trimmedCity = cityFilter.trimmingCharacters(in: .whitespacesAndNewlines)
            let response = try await service.getSessions(
                page: currentPage,
                limit: pageSize,
                startDate: useDateFilter ? startDate : nil,
                endDate: useDateFilter ? endDate : nil,
                city: trimmedCity.isEmpty ? nil : trimmedCity
            )

            let newSessions = response.sessions

            if refresh {
                sessions = newSessions
            } else {
                sessions.append(contentsOf: newSessions)
            }

            hasMore = response.pagination.hasNext

            // 🚀 优化：成功加载，清除离线模式标识
            isOfflineMode = false

            // 🚀 优化：批量预取当前页的像素数据
            await prefetchPixelsForCurrentPage(newSessions: newSessions)

            // 🚀 优化：保存到离线缓存（仅在刷新时）
            if refresh {
                saveToOfflineCache()
            }

        } catch is CancellationError {
            // Swift Task 被取消（用户快速操作时正常现象），静默处理
            Logger.info("ℹ️ 会话列表加载已取消 (Task)")
        } catch {
            // 检查是否是 URLSession 取消错误 (Code -999)
            let nsError = error as NSError
            if nsError.domain == NSURLErrorDomain && nsError.code == NSURLErrorCancelled {
                Logger.info("ℹ️ 会话列表加载已取消 (URLSession)")
                return
            }

            // 🚀 优化：检查是否是网络不可用错误
            if nsError.domain == NSURLErrorDomain &&
               (nsError.code == NSURLErrorNotConnectedToInternet ||
                nsError.code == NSURLErrorNetworkConnectionLost) {
                isOfflineMode = true

                // 如果有离线缓存，使用缓存数据
                if !sessions.isEmpty {
                    Logger.info("📡 网络不可用，使用离线缓存数据")
                    errorMessage = "网络不可用，显示缓存数据"
                    showError = false
                } else {
                    errorMessage = "网络不可用，请检查网络连接"
                    showError = true
                }
            } else {
                // 其他错误
                isOfflineMode = false
                errorMessage = "加载失败: \(error.localizedDescription)"
                showError = true
                Logger.error("❌ 加载会话列表失败: \(error)")
            }
        }

        isLoading = false
    }

    /// 批量预取像素数据（性能优化）
    private func prefetchPixelsForCurrentPage(newSessions: [DrawingSession]) async {
        let sessionIds = newSessions.map { $0.id }
        guard !sessionIds.isEmpty else { return }

        do {
            let startTime = Date()
            let batchPixels = try await service.getBatchPixels(sessionIds: sessionIds)

            // 批量缓存到内存和磁盘
            ArtworkThumbnailLoader.cacheBatchPixels(batchPixels)

            let duration = Date().timeIntervalSince(startTime)
            Logger.info("⚡️ 批量预取完成: \(sessionIds.count)个会话, 耗时\(String(format: "%.2f", duration))秒")
        } catch {
            // 预取失败不影响主流程，静默处理
            Logger.warning("⚠️ 批量预取像素失败: \(error.localizedDescription)")
        }
    }

    /// 加载更多
    func loadMore() async {
        guard hasMore, !isLoading else { return }
        currentPage += 1
        await loadSessions()
    }

    /// 刷新
    func refresh() async {
        await loadSessions(refresh: true)
    }

    /// 判断是否应该预加载更多数据
    /// - Parameter currentIndex: 当前滚动到的索引
    /// - Returns: 是否应该预加载
    func shouldPrefetchMore(currentIndex: Int) -> Bool {
        // 🚀 优化：当滚动到倒数第5个时，提前加载下一页
        // 这样用户滚动到底部时，新数据已经准备好了
        let prefetchThreshold = 5
        return currentIndex >= sessions.count - prefetchThreshold && hasMore && !isLoading
    }

    /// 删除会话（可选功能）
    func deleteSession(_ session: DrawingSession) {
        sessions.removeAll { $0.id == session.id }
    }
}
