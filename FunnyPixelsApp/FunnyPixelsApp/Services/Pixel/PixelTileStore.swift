import Foundation
import CoreLocation
import Combine

/// 像素瓦片更新
public struct TileUpdate: Sendable {
    public let coordinate: TileCoordinate
    public let pixels: [Pixel]
    public let version: Int
    public let timestamp: Date

    public init(coordinate: TileCoordinate, pixels: [Pixel], version: Int, timestamp: Date = Date()) {
        self.coordinate = coordinate
        self.pixels = pixels
        self.version = version
        self.timestamp = timestamp
    }
}

/// 像素瓦片版本信息
public struct TileVersion: Codable, Sendable {
    public let tileId: String
    public var version: Int
    public var lastModified: Date

    public init(tileId: String, version: Int, lastModified: Date = Date()) {
        self.tileId = tileId
        self.version = version
        self.lastModified = lastModified
    }
}

/// 像素瓦片数据（增强版）
/// NOTE: Must be a class to work with NSCache
public final class EnhancedPixelTile: NSObject, Codable {
    public let coordinate: TileCoordinate
    public var pixels: [Pixel]
    public var version: Int
    public var lastModified: Date

    public init(coordinate: TileCoordinate, pixels: [Pixel] = [], version: Int = 0) {
        self.coordinate = coordinate
        self.pixels = pixels
        self.version = version
        self.lastModified = Date()
        super.init()
    }

    // Codable support for class
    enum CodingKeys: String, CodingKey {
        case coordinate, pixels, version, lastModified
    }

    required public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        self.coordinate = try container.decode(TileCoordinate.self, forKey: .coordinate)
        self.pixels = try container.decode([Pixel].self, forKey: .pixels)
        self.version = try container.decode(Int.self, forKey: .version)
        self.lastModified = try container.decode(Date.self, forKey: .lastModified)
        super.init()
    }

    public func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(coordinate, forKey: .coordinate)
        try container.encode(pixels, forKey: .pixels)
        try container.encode(version, forKey: .version)
        try container.encode(lastModified, forKey: .lastModified)
    }

    /// 合并像素（用于增量更新）
    /// 🚀 性能优化：避免数组→字典→数组的多次转换
    public func merge(_ pixels: [Pixel]) {
        // 快速路径：如果新像素数量很少，直接修改数组
        if pixels.count <= 10 && self.pixels.count < 100 {
            // 小规模更新：O(n*m) 但常数小，适合小数组
            for newPixel in pixels {
                if let index = self.pixels.firstIndex(where: { $0.id == newPixel.id }) {
                    self.pixels[index] = newPixel  // 更新现有像素
                } else {
                    self.pixels.append(newPixel)  // 添加新像素
                }
            }
        } else {
            // 大规模更新：使用字典但保持有序
            var pixelMap: [String: Pixel] = [:]
            pixelMap.reserveCapacity(self.pixels.count + pixels.count)

            // 构建字典并记录顺序
            var orderedIds: [String] = []
            orderedIds.reserveCapacity(self.pixels.count + pixels.count)

            // 先添加现有像素
            for pixel in self.pixels {
                pixelMap[pixel.id] = pixel
                orderedIds.append(pixel.id)
            }

            // 合并新像素（保持插入顺序）
            for pixel in pixels {
                if pixelMap[pixel.id] == nil {
                    orderedIds.append(pixel.id)  // 新像素
                }
                pixelMap[pixel.id] = pixel
            }

            // 按顺序重建数组（保持一致性）
            self.pixels = orderedIds.compactMap { pixelMap[$0] }
        }

        self.version += 1
        self.lastModified = Date()
    }

    /// 应用差异更新
    /// 🚀 性能优化：使用集合操作减少复杂度
    public func applyDiff(_ diff: PixelDiffUpdate) {
        // 快速路径：如果变更很少，直接操作数组
        let totalChanges = diff.added.count + diff.updated.count + diff.removed.count
        if totalChanges <= 5 && self.pixels.count < 100 {
            // 删除像素
            if !diff.removed.isEmpty {
                let removeSet = Set(diff.removed)
                self.pixels.removeAll { removeSet.contains($0.id) }
            }

            // 更新像素
            for updatedPixel in diff.updated {
                if let index = self.pixels.firstIndex(where: { $0.id == updatedPixel.id }) {
                    self.pixels[index] = updatedPixel
                }
            }

            // 添加新像素
            self.pixels.append(contentsOf: diff.added)
        } else {
            // 大规模更新：使用字典
            var pixelMap: [String: Pixel] = [:]
            pixelMap.reserveCapacity(pixels.count + diff.added.count)

            // 先添加现有像素
            for pixel in pixels {
                pixelMap[pixel.id] = pixel
            }

            // 添加新像素
            for pixel in diff.added {
                pixelMap[pixel.id] = pixel
            }

            // 更新像素
            for pixel in diff.updated {
                pixelMap[pixel.id] = pixel
            }

            // 删除像素
            for pixelId in diff.removed {
                pixelMap.removeValue(forKey: pixelId)
            }

            self.pixels = Array(pixelMap.values)
        }

        self.version = diff.version
        self.lastModified = Date()
    }
}

/// 像素差异更新
public struct PixelDiffUpdate: Codable, Sendable {
    public let added: [Pixel]
    public let updated: [Pixel]
    public let removed: [String]  // pixel IDs
    public let version: Int
    public let timestamp: Date

    public init(added: [Pixel] = [], updated: [Pixel] = [], removed: [String] = [], version: Int, timestamp: Date = Date()) {
        self.added = added
        self.updated = updated
        self.removed = removed
        self.version = version
        self.timestamp = timestamp
    }
}

/// 像素瓦片存储 (Actor)
/// 线程安全的瓦片数据管理，使用四叉树索引和 LRU 缓存
@MainActor
public final class PixelTileStore: ObservableObject {
    // MARK: - Published Properties

    /// 可见的瓦片列表
    @Published public var visibleTiles: [EnhancedPixelTile] = []

    /// 缓存大小（字节）
    @Published public var cacheSize: Int = 0

    /// 缓存命中率
    @Published public var cacheHitRate: Double = 0.0

    // MARK: - Private Properties

    /// 四叉树索引
    private var tileIndex: TileQuadTree<EnhancedPixelTile>

    /// 内存缓存
    private let memoryCache: NSCache<NSString, EnhancedPixelTile>

    /// 瓦片版本跟踪
    private var tileVersions: [String: TileVersion] = [:]

    /// LRU 访问顺序
    private var accessOrder: [String] = []

    /// 缓存统计
    private var cacheHits: Int = 0
    private var cacheMisses: Int = 0

    /// 最大缓存数量
    private let maxCacheCount: Int

    /// 最大缓存大小（字节）
    private let maxCacheSizeBytes: Int

    /// API 管理器
    private let apiManager: APIManager

    // MARK: - Constants

    public static let cacheCountLimit = 100
    public static let cacheSizeLimit = 50 * 1024 * 1024  // 50 MB

    // MARK: - Initialization

    public init(
        maxCacheCount: Int = 100,
        maxCacheSize: Int = 50 * 1024 * 1024,
        apiManager: APIManager
    ) {
        self.maxCacheCount = maxCacheCount
        self.maxCacheSizeBytes = maxCacheSize
        self.apiManager = apiManager
        self.tileIndex = TileQuadTree(maxDepth: 18)

        // 配置内存缓存
        self.memoryCache = NSCache<NSString, EnhancedPixelTile>()
        self.memoryCache.countLimit = maxCacheCount
        self.memoryCache.totalCostLimit = maxCacheSize

        // Note: NSCacheDelegate requires NSObject inheritance which conflicts with @MainActor
        // Cache eviction handling can be added through memory pressure notifications if needed
    }

    // MARK: - Public Methods - Query

    /// 获取指定瓦片坐标的数据
    /// - Parameter coord: 瓦片坐标
    /// - Returns: 像素瓦片数据，如果不存在返回 nil
    public func getTile(_ coord: TileCoordinate) async -> EnhancedPixelTile? {
        let cacheKey = coord.cacheKey as NSString

        // 检查内存缓存
        if let cached = memoryCache.object(forKey: cacheKey) {
            cacheHits += 1
            updateCacheStats()
            updateAccessOrder(cacheKey: cacheKey)
            return cached
        }

        cacheMisses += 1
        updateCacheStats()

        // 从四叉树索引获取
        if let tile = tileIndex.search(at: coord) {
            // 加入内存缓存
            memoryCache.setObject(tile, forKey: cacheKey)
            updateAccessOrder(cacheKey: cacheKey)
            return tile
        }

        return nil
    }

    /// 获取指定边界范围内的所有瓦片
    /// - Parameter bounds: 边界范围
    /// - Returns: 该范围内的所有像素瓦片
    public func getTiles(in bounds: TileBounds) async -> [EnhancedPixelTile] {
        let tiles = tileIndex.search(in: bounds)

        // 更新可见瓦片列表
        visibleTiles = tiles

        return tiles
    }

    /// 获取指定缩放级别的所有瓦片
    /// - Parameter zoom: 缩放级别
    /// - Returns: 该缩放级别的所有像素瓦片
    public func getTiles(zoom: Int) async -> [EnhancedPixelTile] {
        return tileIndex.search(zoom: zoom)
    }

    // MARK: - Public Methods - Update

    /// 更新瓦片数据
    /// - Parameters:
    ///   - coord: 瓦片坐标
    ///   - pixels: 像素数据
    public func updateTile(_ coord: TileCoordinate, with pixels: [Pixel]) async {
        let tile = await getTile(coord) ?? EnhancedPixelTile(coordinate: coord)
        tile.merge(pixels)

        await setTile(tile)
    }

    /// 设置瓦片数据
    /// - Parameter tile: 像素瓦片数据
    public func setTile(_ tile: EnhancedPixelTile) async {
        let cacheKey = tile.coordinate.cacheKey as NSString

        // 更新四叉树索引
        tileIndex.insert(tile, at: tile.coordinate)

        // 更新内存缓存
        memoryCache.setObject(tile, forKey: cacheKey)

        // 更新版本信息
        tileVersions[tile.coordinate.tileId] = TileVersion(
            tileId: tile.coordinate.tileId,
            version: tile.version,
            lastModified: tile.lastModified
        )

        // 更新访问顺序
        updateAccessOrder(cacheKey: cacheKey)

        // 更新可见瓦片列表
        await updateVisibleTiles()

        // 计算缓存大小
        updateCacheSize()
    }

    /// 批量更新瓦片（用于 WebSocket 增量更新）
    /// - Parameter updates: 瓦片更新数组
    public func batchUpdate(_ updates: [TileUpdate]) async {
        // 并发处理多个瓦片更新
        await withTaskGroup(of: Void.self) { group in
            for update in updates {
                group.addTask { [weak self] in
                    guard let self = self else { return }
                    await self.updateTile(update.coordinate, with: update.pixels)
                }
            }
        }
    }

    /// 应用差异更新
    /// - Parameters:
    ///   - coord: 瓦片坐标
    ///   - diff: 像素差异更新
    /// - Returns: 是否更新成功
    @discardableResult
    public func applyDiff(_ coord: TileCoordinate, diff: PixelDiffUpdate) async -> Bool {
        // 检查版本冲突
        if let currentVersion = tileVersions[coord.tileId]?.version,
           currentVersion > diff.version {
            // 版本冲突，需要从服务器获取完整数据
            return false
        }

        let tile = await getTile(coord) ?? EnhancedPixelTile(coordinate: coord)
        tile.applyDiff(diff)

        await setTile(tile)
        return true
    }

    // MARK: - Public Methods - Delete

    /// 移除瓦片
    /// - Parameter coord: 瓦片坐标
    /// - Returns: 被移除的瓦片数据
    @discardableResult
    public func removeTile(_ coord: TileCoordinate) async -> EnhancedPixelTile? {
        let cacheKey = coord.cacheKey as NSString

        // 从内存缓存移除
        let removed = memoryCache.object(forKey: cacheKey)
        memoryCache.removeObject(forKey: cacheKey)

        // 从四叉树索引移除
        if let tile = tileIndex.remove(at: coord) {
            // 更新可见瓦片列表
            await updateVisibleTiles()
            return tile
        }

        return removed
    }

    /// 清空所有缓存
    public func clearCache() async {
        memoryCache.removeAllObjects()
        tileIndex.clear()
        tileVersions.removeAll()
        accessOrder.removeAll()
        cacheHits = 0
        cacheMisses = 0
        visibleTiles.removeAll()
        updateCacheStats()
        updateCacheSize()
    }

    // MARK: - Public Methods - Version

    /// 获取瓦片版本
    /// - Parameter tileId: 瓦片 ID
    /// - Returns: 版本信息
    public func getVersion(_ tileId: String) -> Int {
        return tileVersions[tileId]?.version ?? 0
    }

    /// 检查瓦片是否过期
    /// - Parameters:
    ///   - tileId: 瓦片 ID
    ///   - version: 版本号
    /// - Returns: 是否过期
    public func isStale(_ tileId: String, version: Int) -> Bool {
        guard let currentVersion = tileVersions[tileId]?.version else {
            return true
        }
        return version < currentVersion
    }

    // MARK: - Private Methods

    private func updateAccessOrder(cacheKey: NSString) {
        // 更新 LRU 访问顺序
        if let index = accessOrder.firstIndex(of: cacheKey as String) {
            accessOrder.remove(at: index)
        }
        accessOrder.append(cacheKey as String)

        // LRU 淘汰
        while accessOrder.count > maxCacheCount {
            if let lruKey = accessOrder.first {
                memoryCache.removeObject(forKey: lruKey as NSString)
                accessOrder.removeFirst()
            }
        }
    }

    private func updateCacheStats() {
        let total = cacheHits + cacheMisses
        cacheHitRate = total > 0 ? Double(cacheHits) / Double(total) : 0.0
    }

    private func updateCacheSize() {
        // 估算缓存大小（简化计算）
        cacheSize = visibleTiles.reduce(0) { $0 + $1.pixels.count * MemoryLayout<Pixel>.stride }
    }

    private func updateVisibleTiles() async {
        // 获取当前地图视野范围内的瓦片（简化版）
        visibleTiles = Array(tileIndex.search(zoom: 12).prefix(20))
    }

    // MARK: - Public Methods - Fetch

    /// 从服务器获取瓦片数据
    /// - Parameter coord: 瓦片坐标
    /// - Returns: 像素瓦片数据
    public func fetchTile(fromServer coord: TileCoordinate) async throws -> EnhancedPixelTile {
        let bounds = coord.bounds

        // 使用 API 管理器获取像素数据
        let pixels = try await apiManager.fetchPixels(
            in: bounds,
            zoom: coord.z
        )

        let tile = EnhancedPixelTile(
            coordinate: coord,
            pixels: pixels,
            version: Int(Date().timeIntervalSince1970)
        )

        await setTile(tile)

        return tile
    }
}

// MARK: - Cache Eviction Handler

/// Note: NSCacheDelegate requires NSObject inheritance which conflicts with @MainActor
/// Cache eviction is handled through memory pressure notifications instead
extension PixelTileStore {
    public func handleCacheEviction(for tile: EnhancedPixelTile) {
        // Handle cache eviction if needed
        Logger.debug("📦 Evicting tile: \(tile.coordinate.cacheKey)")
    }
}

// MARK: - Publisher Extensions

extension PixelTileStore {
    /// 创建可见瓦片发布者
    public var visibleTilesPublisher: AnyPublisher<[EnhancedPixelTile], Never> {
        $visibleTiles.eraseToAnyPublisher()
    }

    /// 创建缓存大小发布者
    public var cacheSizePublisher: AnyPublisher<Int, Never> {
        $cacheSize.eraseToAnyPublisher()
    }

    /// 创建缓存命中率发布者
    public var cacheHitRatePublisher: AnyPublisher<Double, Never> {
        $cacheHitRate.eraseToAnyPublisher()
    }
}
