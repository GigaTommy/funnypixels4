import Foundation
import Combine

/// Pixel Cache Statistics
public struct PixelCacheStatistics: Sendable {
    public var totalCount: Int
    public var totalSize: Int
    public var hitCount: Int
    public var missCount: Int
    public var memoryCount: Int
    public var diskCount: Int

    public var hitRate: Double {
        let total = hitCount + missCount
        return total > 0 ? Double(hitCount) / Double(total) : 0
    }

    public init(
        totalCount: Int = 0,
        totalSize: Int = 0,
        hitCount: Int = 0,
        missCount: Int = 0,
        memoryCount: Int = 0,
        diskCount: Int = 0
    ) {
        self.totalCount = totalCount
        self.totalSize = totalSize
        self.hitCount = hitCount
        self.missCount = missCount
        self.memoryCount = memoryCount
        self.diskCount = diskCount
    }

    // 🔧 添加：nonisolated(unsafe) 初始化器，用于 actor 上下文
    public static func create(
        totalCount: Int = 0,
        totalSize: Int = 0,
        hitCount: Int = 0,
        missCount: Int = 0,
        memoryCount: Int = 0,
        diskCount: Int = 0
    ) -> PixelCacheStatistics {
        return PixelCacheStatistics(
            totalCount: totalCount,
            totalSize: totalSize,
            hitCount: hitCount,
            missCount: missCount,
            memoryCount: memoryCount,
            diskCount: diskCount
        )
    }
}

/// Pixel Cache Manager
/// Manages caching of pixel data
public class PixelCacheManager {
    public static let shared = PixelCacheManager()

    private var cache: [String: Pixel] = [:]
    public private(set) var statistics: PixelCacheStatistics = PixelCacheStatistics()

    private init() {}

    /// Cache a pixel
    public func cache(_ pixel: Pixel) {
        cache[pixel.id] = pixel
        statistics.totalCount = cache.count
    }

    /// Retrieve a pixel from cache
    public func retrieve(id: String) -> Pixel? {
        if let pixel = cache[id] {
            statistics.hitCount += 1
            return pixel
        } else {
            statistics.missCount += 1
            return nil
        }
    }

    /// Clear the cache
    public func clear() {
        cache.removeAll()
        statistics = PixelCacheStatistics()
    }
}
