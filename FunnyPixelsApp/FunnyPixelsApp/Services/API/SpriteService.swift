import Foundation
import UIKit
import Combine
#if canImport(MapLibre)
import MapLibre
#endif

/// Sprite 数据模型
public struct SpriteInfo: Codable, Sendable {
    public let id: Int
    public let key: String
    public let name: String
    public let category: String
    public let render_type: String
    public let unicode_char: String?
    public let color: String?
    public let sprite_url: String
    public let width: Int
    public let height: Int
    public let updated_at: String
    public let hash: String
}

/// Sprite 列表响应
public struct SpriteListResponse: Codable {
    public let version: String
    public let incremental: Bool
    public let count: Int
    public let sprites: [SpriteInfo]
}

/// Sprite 缓存条目
private struct SpriteCacheEntry {
    let image: UIImage
    let timestamp: Date
    let hash: String
}

/// Sprite 加载服务
/// 从后端 API 获取 sprite 列表并下载图片
public class SpriteService: ObservableObject, Sendable {

    // MARK: - Singleton

    public static let shared = SpriteService()

    // MARK: - Published Properties

    @Published public private(set) var isLoading = false
    @Published public private(set) var loadedSprites: Set<String> = []
    @Published public private(set) var spriteVersion: String?

    // MARK: - Private Properties

    private var cache: [String: SpriteCacheEntry] = [:]
    private let cacheQueue = DispatchQueue(label: "com.funnypixels.sprite-cache", attributes: .concurrent)
    private let downloadSession: URLSession

    // Cache configuration
    private let maxCacheSize = 10000 // 10k sprites
    private let maxCacheMemory = 100 * 1024 * 1024 // 100MB
    private let cacheTTL: TimeInterval = 24 * 60 * 60 // 24 hours

    // Actor for thread-safe access
    private actor State {
        var loadedSprites: Set<String> = []
        var spriteVersion: String?
        var spriteInfo: [String: SpriteInfo] = [:]  // key -> SpriteInfo

        func add(_ spriteName: String) {
            loadedSprites.insert(spriteName)
        }

        func addMany(_ spriteNames: [String]) {
            loadedSprites.formUnion(spriteNames)
        }

        func addSpriteInfo(_ info: SpriteInfo) {
            spriteInfo[info.key] = info
        }

        func addSpriteInfos(_ infos: [SpriteInfo]) {
            for info in infos {
                spriteInfo[info.key] = info
            }
        }

        func contains(_ spriteName: String) -> Bool {
            loadedSprites.contains(spriteName)
        }

        func getSpriteInfo(for key: String) -> SpriteInfo? {
            spriteInfo[key]
        }

        func getAllSpriteInfo() -> [SpriteInfo] {
            Array(spriteInfo.values)
        }

        func setVersion(_ version: String) {
            self.spriteVersion = version
        }
    }

    private let state = State()

    // MARK: - Initialization

    private init() {
        let configuration = URLSessionConfiguration.default
        configuration.timeoutIntervalForRequest = 30
        configuration.timeoutIntervalForResource = 60
        configuration.httpMaximumConnectionsPerHost = 6 // 并发下载限制
        self.downloadSession = URLSession(configuration: configuration)

        // Load cached version on startup
        Task {
            await loadCachedVersion()
        }
    }

    // MARK: - Public API

    /// 获取所有已加载的 emoji 列表
    public func getAllLoadedEmojis() -> [String] {
        getEmojiList().sorted()
    }

    /// 检查 sprite 是否已加载
    public func isSpriteLoaded(_ name: String) -> Bool {
        Task {
            return await state.contains(name)
        }
        return false // Synchronous fallback
    }

    /// 从后端 API 加载 sprite 列表
    /// - Parameter scale: 屏幕缩放倍数 (1, 2, or 3)
    /// - Returns: 加载的 sprite 数量
    public func loadSpritesFromAPI(scale: Int = 2) async throws -> Int {
        guard (1...3).contains(scale) else {
            throw SpriteError.invalidScale
        }

        await MainActor.run {
            isLoading = true
        }

        defer {
            Task { @MainActor in
                isLoading = false
            }
        }

        Logger.info("🎨 Loading sprites from API (scale: \(scale))...")

        // 1. Fetch sprite list from API
        let spriteList = try await fetchSpriteList(scale: scale)

        // 2. Download sprites concurrently
        let downloadedCount = try await downloadSprites(sprites: spriteList.sprites)

        // 3. Update state
        await state.setVersion(spriteList.version)

        // Store sprite keys (not unicode chars) for all sprites
        let allSpriteKeys = spriteList.sprites.map { $0.key }
        await state.addMany(allSpriteKeys)

        // Store all sprite info for later retrieval
        await state.addSpriteInfos(spriteList.sprites)

        // 4. Cache version for future incremental updates
        cacheSpriteVersion(spriteList.version)

        Logger.info("✅ Loaded \(downloadedCount)/\(spriteList.count) sprites")
        Logger.info("   - Version: \(spriteList.version)")

        return downloadedCount
    }

    /// 获取所有已加载的 sprite 信息
    public func getAllSpriteInfo() async -> [SpriteInfo] {
        return await state.getAllSpriteInfo()
    }

    /// 获取缓存的图片
    public func getCachedImage(for key: String) -> UIImage? {
        cacheQueue.sync {
            guard let entry = cache[key] else { return nil }

            // Check if cache entry is still valid
            if Date().timeIntervalSince(entry.timestamp) > cacheTTL {
                cache.removeValue(forKey: key)
                return nil
            }

            return entry.image
        }
    }

    /// 增量更新 sprites
    public func updateSpritesIncrementally(scale: Int = 2) async throws -> Int {
        guard let currentVersion = await state.spriteVersion else {
            // No previous version, do full load
            return try await loadSpritesFromAPI(scale: scale)
        }

        Logger.info("🔄 Checking for sprite updates since version \(currentVersion)...")

        let spriteList = try await fetchSpriteList(scale: scale, since: currentVersion)

        if spriteList.sprites.isEmpty {
            Logger.info("✅ No new sprites to load")
            return 0
        }

        // Download new sprites
        let downloadedCount = try await downloadSprites(sprites: spriteList.sprites)

        // Update state
        await state.setVersion(spriteList.version)
        let newSpriteKeys = spriteList.sprites.map { $0.key }

        await state.addMany(newSpriteKeys)
        await state.addSpriteInfos(spriteList.sprites)
        cacheSpriteVersion(spriteList.version)

        Logger.info("✅ Updated with \(downloadedCount) new sprites")

        return downloadedCount
    }

    /// 获取 sprite 列表（用于渲染器）
    public func getEmojiList() -> [String] {
        Task {
            let spriteKeys = cacheQueue.sync {
                Array(cache.keys)
            }
            return spriteKeys
        }
        // Synchronous fallback for non-async context
        return cache.keys.filter { $0.count <= 2 }.sorted()
    }

    /// 预加载 sprite 到 MapLibre Style
    public func preloadSpritesIntoStyle(_ style: MLNStyle) async {
        let spriteKeys = cacheQueue.sync { cache.keys }

        Logger.info("🎨 Pre-loading \(spriteKeys.count) sprites into MapLibre style...")

        var loadedCount = 0
        for key in spriteKeys {
            if let image = getCachedImage(for: key) {
                style.setImage(image, forName: key)
                loadedCount += 1
            }
        }

        Logger.info("✅ Pre-loaded \(loadedCount)/\(spriteKeys.count) sprites")
    }

    // MARK: - Private Methods

    /// Fetch sprite list from API
    private func fetchSpriteList(scale: Int, since: String? = nil) async throws -> SpriteListResponse {
        var components = URLComponents(string: "\(AppConfig.apiBaseURL)/sprites/list")!
        var queryItems: [URLQueryItem] = [
            URLQueryItem(name: "scale", value: String(scale))
        ]

        if let since = since {
            queryItems.append(URLQueryItem(name: "since", value: since))
        }

        components.queryItems = queryItems

        guard let url = components.url else {
            throw SpriteError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        // Add auth token if available
        if let token = AuthManager.shared.getAccessToken() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        let (data, response) = try await downloadSession.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw SpriteError.invalidResponse
        }

        // Handle 304 Not Modified
        if httpResponse.statusCode == 304 {
            return SpriteListResponse(version: since ?? "", incremental: true, count: 0, sprites: [])
        }

        guard (200...299).contains(httpResponse.statusCode) else {
            throw SpriteError.httpError(httpResponse.statusCode)
        }

        let decoder = JSONDecoder()
        let spriteList = try decoder.decode(SpriteListResponse.self, from: data)

        return spriteList
    }

    /// Download sprites concurrently
    private func downloadSprites(sprites: [SpriteInfo]) async throws -> Int {
        Logger.info("📥 Downloading \(sprites.count) sprites...")

        // Use TaskGroup for concurrent downloads
        var downloadedCount = 0

        try await withThrowingTaskGroup(of: (String, UIImage).self) { group in
            for sprite in sprites {
                group.addTask {
                    guard let spriteURL = URL(string: sprite.sprite_url) else {
                        throw SpriteError.invalidImageData
                    }
                    let (data, _) = try await self.downloadSession.data(from: spriteURL)

                    guard let image = UIImage(data: data) else {
                        throw SpriteError.invalidImageData
                    }

                    // Always use sprite key as the sprite name for consistency
                    // This allows proper mapping in the renderer
                    let spriteName = sprite.key

                    return (spriteName, image)
                }
            }

            // Collect results
            for try await (spriteName, image) in group {
                cacheQueue.async(flags: .barrier) {
                    self.cache[spriteName] = SpriteCacheEntry(
                        image: image,
                        timestamp: Date(),
                        hash: ""
                    )
                }
                downloadedCount += 1
            }
        }

        // Clean up old cache entries if needed
        cleanupCacheIfNeeded()

        return downloadedCount
    }

    /// Cache sprite version to UserDefaults
    private func cacheSpriteVersion(_ version: String) {
        UserDefaults.standard.set(version, forKey: "sprite_version")
    }

    /// Load cached version from UserDefaults
    private func loadCachedVersion() async {
        if let cachedVersion = UserDefaults.standard.string(forKey: "sprite_version") {
            await state.setVersion(cachedVersion)
        }
    }

    /// Clean up cache if it exceeds limits
    private func cleanupCacheIfNeeded() {
        cacheQueue.async(flags: .barrier) {
            // Check count limit
            if self.cache.count > self.maxCacheSize {
                Logger.warning("⚠️ Sprite cache count exceeded, cleaning up...")
                self.removeOldestEntries(targetCount: self.maxCacheSize / 2)
            }

            // Check memory limit
            let currentMemorySize = self.cache.values.reduce(0) { total, entry in
                total + self.estimateImageSize(entry.image)
            }

            if currentMemorySize > self.maxCacheMemory {
                Logger.warning("⚠️ Sprite cache memory exceeded, cleaning up...")
                self.removeOldestEntries(targetMemory: self.maxCacheMemory / 2)
            }
        }
    }

    /// Remove oldest cache entries
    private func removeOldestEntries(targetCount: Int? = nil, targetMemory: Int? = nil) {
        let sortedEntries = cache.sorted { $0.value.timestamp < $1.value.timestamp }

        var removedCount = 0
        var removedMemory = 0

        for (key, _) in sortedEntries {
            if let target = targetCount, removedCount >= target { break }
            if let target = targetMemory, removedMemory >= target { break }

            if let entry = cache.removeValue(forKey: key) {
                removedCount += 1
                removedMemory += estimateImageSize(entry.image)
            }
        }

        Logger.info("🗑️ Removed \(removedCount) old cache entries (\(removedMemory / 1024)KB)")
    }

    /// Estimate image size in memory
    private func estimateImageSize(_ image: UIImage) -> Int {
        let width = Int(image.size.width * image.scale)
        let height = Int(image.size.height * image.scale)
        return width * height * 4 // RGBA
    }

    /// Clear all cached sprites
    @MainActor public func clearCache() {
        cacheQueue.async(flags: .barrier) {
            self.cache.removeAll()
        }
        loadedSprites.removeAll()
        Logger.info("🗑️ Sprite cache cleared")
    }
}

// MARK: - Errors

public enum SpriteError: Error, LocalizedError {
    case invalidScale
    case invalidURL
    case invalidResponse
    case httpError(Int)
    case invalidImageData
    case downloadFailed(Error)

    public var errorDescription: String? {
        switch self {
        case .invalidScale:
            return "Scale must be 1, 2, or 3"
        case .invalidURL:
            return "Invalid sprite URL"
        case .invalidResponse:
            return "Invalid response from server"
        case .httpError(let code):
            return "HTTP error: \(code)"
        case .invalidImageData:
            return "Invalid image data"
        case .downloadFailed(let error):
            return "Download failed: \(error.localizedDescription)"
        }
    }
}
