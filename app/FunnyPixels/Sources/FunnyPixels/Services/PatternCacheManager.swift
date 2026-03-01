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

    static let `default` = PatternCacheConfig(
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

/// 图案缓存管理器
public class PatternCacheManager: ObservableObject {
    public static let shared = PatternCacheManager()

    private let config: PatternCacheConfig
    private var memoryCache: [String: PatternCacheEntry] = [:]
    private let diskCachePath: URL
    private let cacheLock = NSLock()

    @Published public private(set) var cacheStatistics = CacheStatistics()

    private init(config: PatternCacheConfig = .default) {
        self.config = config

        let cacheDir = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
        self.diskCachePath = cacheDir.appendingPathComponent("PatternCache")

        try? FileManager.default.createDirectory(at: diskCachePath, withIntermediateDirectories: true)
    }

    /// 缓存图案
    #if canImport(UIKit)
    public func cachePattern(_ pattern: Pattern, image: UIImage? = nil) async {
        cacheLock.lock()
        defer { cacheLock.unlock() }

        let entry = PatternCacheEntry(
            pattern: pattern,
            timestamp: Date(),
            image: image
        )

        memoryCache[pattern.id] = entry

        // 异步保存到磁盘
        DispatchQueue.global(qos: .utility).async { [weak self] in
            self?.saveToDisk(pattern: pattern, image: image)
        }

        updateStatistics()
    }
    #else
    public func cachePattern(_ pattern: Pattern) async {
        cacheLock.lock()
        defer { cacheLock.unlock() }

        let entry = PatternCacheEntry(
            pattern: pattern,
            timestamp: Date()
        )

        memoryCache[pattern.id] = entry

        // 异步保存到磁盘
        DispatchQueue.global(qos: .utility).async { [weak self] in
            self?.saveToDisk(pattern: pattern)
        }

        updateStatistics()
    }
    #endif

    /// 获取图案
    public func getPattern(id: String) -> Pattern? {
        cacheLock.lock()
        defer { cacheLock.unlock() }

        if let entry = memoryCache[id] {
            if !entry.isExpired(ttl: config.ttl) {
                return entry.pattern
            } else {
                memoryCache.removeValue(forKey: id)
            }
        }

        if let pattern = loadFromDisk(id: id) {
            return pattern
        }

        return nil
    }

    /// 获取图案图像
    #if canImport(UIKit)
    public func getPatternImage(id: String) -> UIImage? {
        cacheLock.lock()
        defer { cacheLock.unlock() }

        if let entry = memoryCache[id], let image = entry.image {
            return image
        }

        return nil
    }
    #endif

    /// 移除图案
    public func removePattern(_ id: String) async {
        cacheLock.lock()
        defer { cacheLock.unlock() }

        memoryCache.removeValue(forKey: id)
        try? FileManager.default.removeItem(at: diskCachePath.appendingPathComponent("\(id).json"))
        try? FileManager.default.removeItem(at: diskCachePath.appendingPathComponent("\(id).png"))

        updateStatistics()
    }

    /// 清空所有缓存
    public func clearAll() {
        cacheLock.lock()
        defer { cacheLock.unlock() }

        memoryCache.removeAll()
        try? FileManager.default.removeItem(at: diskCachePath)
        try? FileManager.default.createDirectory(at: diskCachePath, withIntermediateDirectories: true)

        updateStatistics()
    }

    // MARK: - Private Methods

    #if canImport(UIKit)
    private func saveToDisk(pattern: Pattern, image: UIImage?) {
        // 保存图案元数据
        let metaURL = diskCachePath.appendingPathComponent("\(pattern.id).json")
        if let data = try? JSONEncoder().encode(pattern) {
            try? data.write(to: metaURL)
        }

        // 保存图像
        if let image = image, let pngData = image.pngData() {
            let imageURL = diskCachePath.appendingPathComponent("\(pattern.id).png")
            try? pngData.write(to: imageURL)
        }
    }
    #else
    private func saveToDisk(pattern: Pattern) {
        // 保存图案元数据
        let metaURL = diskCachePath.appendingPathComponent("\(pattern.id).json")
        if let data = try? JSONEncoder().encode(pattern) {
            try? data.write(to: metaURL)
        }
    }
    #endif

    private func loadFromDisk(id: String) -> Pattern? {
        let metaURL = diskCachePath.appendingPathComponent("\(id).json")
        guard let data = try? Data(contentsOf: metaURL),
              let pattern = try? JSONDecoder().decode(Pattern.self, from: data) else {
            return nil
        }

        // 检查是否过期
        if let attributes = try? FileManager.default.attributesOfItem(atPath: metaURL.path),
           let modificationDate = attributes[.modificationDate] as? Date {
            let age = Date().timeIntervalSince(modificationDate)
            if age > config.ttl {
                try? FileManager.default.removeItem(at: metaURL)
                return nil
            }
        }

        // 加载到内存缓存
        #if canImport(UIKit)
        let imageURL = diskCachePath.appendingPathComponent("\(id).png")
        if let imageData = try? Data(contentsOf: imageURL),
           let image = UIImage(data: imageData) {
            memoryCache[id] = PatternCacheEntry(
                pattern: pattern,
                timestamp: Date(),
                image: image
            )
        }
        #else
        memoryCache[id] = PatternCacheEntry(
            pattern: pattern,
            timestamp: Date()
        )
        #endif

        return pattern
    }

    private func updateStatistics() {
        cacheStatistics.memoryCount = memoryCache.count

        if let contents = try? FileManager.default.contentsOfDirectory(at: diskCachePath, includingPropertiesForKeys: nil) {
            cacheStatistics.diskCount = contents.count
        }
    }
}

// CacheStatistics is defined in PixelCacheManager.swift
