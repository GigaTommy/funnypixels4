import Foundation
import Combine
#if canImport(UIKit)
import UIKit
#endif

/// 图案缓存配置
struct PatternCacheConfig {
    let maxMemoryCapacity: Int
    let maxDiskCapacity: Int
    let ttl: TimeInterval

    nonisolated static let `default` = PatternCacheConfig(
        maxMemoryCapacity: 100,
        maxDiskCapacity: 100 * 1024 * 1024, // 100 MB
        ttl: 86400 // 24小时
    )
}

/// 图案缓存条目
private struct PatternCacheEntry {
    let pattern: Pattern
    let timestamp: Date
    #if canImport(UIKit)
    let image: UIImage?
    #endif

    func isExpired(ttl: TimeInterval) -> Bool {
        return Date().timeIntervalSince(timestamp) > ttl
    }
}

/// Actor for thread-safe cache storage
private actor PatternCacheStorage {
    private var memoryCache: [String: PatternCacheEntry] = [:]

    func getEntry(id: String) -> PatternCacheEntry? {
        return memoryCache[id]
    }

    func setEntry(id: String, entry: PatternCacheEntry) {
        memoryCache[id] = entry
    }

    func removeEntry(id: String) {
        memoryCache.removeValue(forKey: id)
    }

    func getAllKeys() -> [String] {
        return Array(memoryCache.keys)
    }
}

/// 图案缓存统计
public struct PatternCacheStatistics {
    public var totalCached: Int = 0
    public var memoryUsage: Int = 0
    public var diskUsage: Int = 0
}

/// 图案缓存管理器
@MainActor
public class PatternCacheManager: ObservableObject {
    public static let shared = PatternCacheManager()

    private let config: PatternCacheConfig
    private let diskCachePath: URL
    private let cacheStorage = PatternCacheStorage()

    @Published public private(set) var cacheStatistics = PatternCacheStatistics()

    private init(config: PatternCacheConfig? = nil) {
        // Use nonisolated default or create a new config
        self.config = config ?? PatternCacheConfig(
            maxMemoryCapacity: 100,
            maxDiskCapacity: 100 * 1024 * 1024,
            ttl: 86400
        )

        let cacheDir = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
        self.diskCachePath = cacheDir.appendingPathComponent("PatternCache")

        try? FileManager.default.createDirectory(at: diskCachePath, withIntermediateDirectories: true)
    }

    /// 缓存图案
    #if canImport(UIKit)
    public func cachePattern(_ pattern: Pattern, image: UIImage? = nil) async {
        let entry = PatternCacheEntry(
            pattern: pattern,
            timestamp: Date(),
            image: image
        )

        await cacheStorage.setEntry(id: pattern.id, entry: entry)

        // 异步保存到磁盘
        Task { @MainActor in
            Self.saveToDisk(pattern: pattern, image: image, diskCachePath: diskCachePath)
        }

        updateStatistics()
    }
    #else
    public func cachePattern(_ pattern: Pattern) async {
        let entry = PatternCacheEntry(
            pattern: pattern,
            timestamp: Date()
        )

        await cacheStorage.setEntry(id: pattern.id, entry: entry)

        // 异步保存到磁盘
        Task { @MainActor in
            Self.saveToDisk(pattern: pattern, diskCachePath: diskCachePath)
        }

        updateStatistics()
    }
    #endif

    /// 获取图案
    public func getPattern(id: String) async -> Pattern? {
        if let entry = await cacheStorage.getEntry(id: id) {
            if !entry.isExpired(ttl: config.ttl) {
                return entry.pattern
            } else {
                await cacheStorage.removeEntry(id: id)
            }
        }

        if let pattern = loadFromDisk(id: id) {
            return pattern
        }

        return nil
    }

    /// 获取图案图像
    #if canImport(UIKit)
    public func getPatternImage(id: String) async -> UIImage? {
        if let entry = await cacheStorage.getEntry(id: id), let image = entry.image {
            return image
        }

        return nil
    }
    #endif

    /// 移除图案
    public func removePattern(_ id: String) async {
        await cacheStorage.removeEntry(id: id)
        try? FileManager.default.removeItem(at: diskCachePath.appendingPathComponent("\(id).json"))
        try? FileManager.default.removeItem(at: diskCachePath.appendingPathComponent("\(id).png"))

        updateStatistics()
    }

    /// 清空所有缓存
    public func clearAll() async {
        let keys = await cacheStorage.getAllKeys()
        for key in keys {
            await cacheStorage.removeEntry(id: key)
        }

        try? FileManager.default.removeItem(at: diskCachePath)
        try? FileManager.default.createDirectory(at: diskCachePath, withIntermediateDirectories: true)

        updateStatistics()
    }

    // MARK: - Private Methods

    private func updateStatistics() {
        Task {
            let keys = await cacheStorage.getAllKeys()
            cacheStatistics.totalCached = keys.count
            cacheStatistics.memoryUsage = 0 // TODO: Calculate actual memory usage
            cacheStatistics.diskUsage = calculateDiskUsage()
        }
    }

    private func calculateDiskUsage() -> Int {
        guard let enumerator = FileManager.default.enumerator(at: diskCachePath, includingPropertiesForKeys: [.fileSizeKey]) else {
            return 0
        }

        var totalSize = 0
        for case let fileURL as URL in enumerator {
            if let resourceValues = try? fileURL.resourceValues(forKeys: [.fileSizeKey]),
               let fileSize = resourceValues.fileSize {
                totalSize += fileSize
            }
        }

        return totalSize
    }

    #if canImport(UIKit)
    private static func saveToDisk(pattern: Pattern, image: UIImage?, diskCachePath: URL) {
        let jsonPath = diskCachePath.appendingPathComponent("\(pattern.id).json")
        let imagePath = diskCachePath.appendingPathComponent("\(pattern.id).png")

        // Save pattern JSON
        if let data = try? JSONEncoder().encode(pattern) {
            try? data.write(to: jsonPath)
        }

        // Save image if available
        if let image = image, let pngData = image.pngData() {
            try? pngData.write(to: imagePath)
        }
    }
    #else
    private static func saveToDisk(pattern: Pattern, diskCachePath: URL) {
        let jsonPath = diskCachePath.appendingPathComponent("\(pattern.id).json")

        // Save pattern JSON
        if let data = try? JSONEncoder().encode(pattern) {
            try? data.write(to: jsonPath)
        }
    }
    #endif

    private func loadFromDisk(id: String) -> Pattern? {
        let jsonPath = diskCachePath.appendingPathComponent("\(id).json")

        guard let data = try? Data(contentsOf: jsonPath),
              let pattern = try? JSONDecoder().decode(Pattern.self, from: data) else {
            return nil
        }

        // Cache it back in memory
        #if canImport(UIKit)
        let imagePath = diskCachePath.appendingPathComponent("\(id).png")
        let image = UIImage(contentsOfFile: imagePath.path)

        let entry = PatternCacheEntry(
            pattern: pattern,
            timestamp: Date(),
            image: image
        )

        Task {
            await cacheStorage.setEntry(id: id, entry: entry)
        }
        #else
        let entry = PatternCacheEntry(
            pattern: pattern,
            timestamp: Date()
        )

        Task {
            await cacheStorage.setEntry(id: id, entry: entry)
        }
        #endif

        return pattern
    }
}
