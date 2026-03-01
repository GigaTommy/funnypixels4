import Foundation

/// Cache Statistics
public struct CacheStatistics {
    public var totalCount: Int = 0
    public var totalSize: Int = 0
    public var hitCount: Int = 0
    public var missCount: Int = 0
    public var memoryCount: Int = 0
    public var diskCount: Int = 0

    public var hitRate: Double {
        let total = hitCount + missCount
        return total > 0 ? Double(hitCount) / Double(total) : 0
    }
}

/// Pixel Cache Manager
/// Manages caching of pixel data
public class PixelCacheManager {
    public static let shared = PixelCacheManager()

    private var cache: [String: Pixel] = [:]
    public private(set) var statistics: CacheStatistics = CacheStatistics()

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
        statistics = CacheStatistics()
    }
}
