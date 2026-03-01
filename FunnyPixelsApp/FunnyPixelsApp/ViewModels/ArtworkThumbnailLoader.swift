import SwiftUI
import Combine

/// 缓存对象封装 (NSCache 需要 NSObject)
class CachedPixels: NSObject {
    let pixels: [SessionPixel]
    init(pixels: [SessionPixel]) { self.pixels = pixels }
}

/// 作品缩略图加载器 - 管理像素数据的异步加载、内存缓存和磁盘缓存
@MainActor
class ArtworkThumbnailLoader: ObservableObject {
    @Published var pixels: [SessionPixel]?
    @Published var isLoading = false
    
    private let sessionId: String
    private let service = DrawingHistoryService.shared
    
    // 内存缓存 (NSCache 自动处理内存警告)
    nonisolated(unsafe) private static let memoryCache: NSCache<NSString, CachedPixels> = {
        let cache = NSCache<NSString, CachedPixels>()
        cache.countLimit = 100 // 最多缓存100个会话的像素点
        cache.totalCostLimit = 20 * 1024 * 1024 // 20MB 限制
        return cache
    }()

    // 磁盘缓存目录
    nonisolated private static let diskCacheDirectory: URL = {
        let paths = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)
        let cacheDir = paths[0].appendingPathComponent("ArtworkCache", isDirectory: true)
        try? FileManager.default.createDirectory(at: cacheDir, withIntermediateDirectories: true)
        return cacheDir
    }()
    
    init(sessionId: String) {
        self.sessionId = sessionId
        
        // 1. 优先检查内存缓存
        let key = sessionId as NSString
        if let cached = Self.memoryCache.object(forKey: key) {
            self.pixels = cached.pixels
            return
        }
        
        // 2. 检查磁盘缓存 (异步加载，避免阻塞主线程)
        // 注意：初始化不能是异步的，所以先留空，让 task 去触发加载
    }
    
    /// 加载像素数据 (内存 -> 磁盘 -> 网络)
    func loadPixels() async {
        // 如果已有数据，跳过
        guard pixels == nil else { return }
        
        // 1. 再次确内存缓存
        let key = sessionId as NSString
        if let cached = Self.memoryCache.object(forKey: key) {
            self.pixels = cached.pixels
            return
        }
        
        // 避免重复加载
        guard !isLoading else { return }
        isLoading = true
        
        // 2. 尝试从磁盘加载
        if let diskPixels = await loadFromDisk() {
            self.pixels = diskPixels
            // 回填到内存缓存
            Self.memoryCache.setObject(CachedPixels(pixels: diskPixels), forKey: key)
            isLoading = false
            return
        }
        
        // 3. 从网络加载
        do {
            let loadedPixels = try await service.getSessionPixels(id: sessionId)
            
            self.pixels = loadedPixels
            
            // 写入内存缓存
            Self.memoryCache.setObject(CachedPixels(pixels: loadedPixels), forKey: key)
            
            // 写入磁盘缓存 (后台进行)
            Task.detached(priority: .background) {
                await self.saveToDisk(pixels: loadedPixels)
            }
            
        } catch is CancellationError {
            // Task 被取消
            Logger.info("ℹ️ 像素加载已取消 [\(sessionId)]")
        } catch {
            Logger.error("❌ 加载会话像素失败 [\(sessionId)]: \(error.localizedDescription)")
            // 失败不写入缓存，允许重试
        }
        
        isLoading = false
    }
    
    // MARK: - Disk Cache Helpers
    
    private func loadFromDisk() async -> [SessionPixel]? {
        let fileURL = Self.diskCacheDirectory.appendingPathComponent("\(sessionId).json")
        
        return await Task.detached(priority: .background) {
            guard FileManager.default.fileExists(atPath: fileURL.path) else { return nil }
            
            do {
                let data = try Data(contentsOf: fileURL)
                let pixels = try JSONDecoder().decode([SessionPixel].self, from: data)
                return pixels
            } catch {
                Logger.warning("⚠️ 磁盘缓存读取失败 [\(self.sessionId)]: \(error)")
                // 缓存损坏，尝试删除
                try? FileManager.default.removeItem(at: fileURL)
                return nil
            }
        }.value
    }
    
    private func saveToDisk(pixels: [SessionPixel]) async {
        let fileURL = Self.diskCacheDirectory.appendingPathComponent("\(sessionId).json")
        
        do {
            let data = try JSONEncoder().encode(pixels)
            try data.write(to: fileURL)
        } catch {
            Logger.warning("⚠️ 磁盘缓存写入失败 [\(sessionId)]: \(error)")
        }
    }
    
    /// 批量缓存像素数据（用于批量预取优化）
    /// - Parameter batchPixels: 字典，key为sessionId，value为像素列表
    static func cacheBatchPixels(_ batchPixels: [String: [SessionPixel]]) {
        for (sessionId, pixels) in batchPixels {
            let key = sessionId as NSString
            memoryCache.setObject(CachedPixels(pixels: pixels), forKey: key)

            // 后台写入磁盘缓存
            Task.detached(priority: .background) {
                let fileURL = diskCacheDirectory.appendingPathComponent("\(sessionId).json")
                do {
                    let data = try JSONEncoder().encode(pixels)
                    try data.write(to: fileURL)
                } catch {
                    Logger.warning("⚠️ 批量缓存写入磁盘失败 [\(sessionId)]: \(error)")
                }
            }
        }
        Logger.info("📦 批量缓存完成: \(batchPixels.count)个会话")
    }

    /// 清除所有缓存
    static func clearCache() {
        memoryCache.removeAllObjects()
        try? FileManager.default.removeItem(at: diskCacheDirectory)
        try? FileManager.default.createDirectory(at: diskCacheDirectory, withIntermediateDirectories: true)
    }
}
