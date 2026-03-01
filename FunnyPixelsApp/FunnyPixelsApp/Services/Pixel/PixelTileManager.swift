import Foundation
import Combine
import MapKit

/// Tile缓存项（包含访问时间用于LRU）
private struct CachedTile {
    let tileId: String
    let bounds: TileBounds
    let zoomLevel: Int
    var lastAccessTime: Date
}

/// 像素Tile管理器（使用LRU缓存策略）
public actor PixelTileManager {
    // MARK: - Properties

    /// LRU缓存（最多100个tile）
    private var tileCache: [String: CachedTile] = [:]

    /// 最大缓存数量
    private let maxCacheSize: Int

    /// API管理器（用于从服务器获取像素数据）
    private let apiManager: APIManager

    /// 缓存访问顺序（用于LRU淘汰）
    private var accessOrder: [String] = []

    // MARK: - Constants

    /// 默认Tile大小（度）
    private static let defaultTileSize: [Int: Double] = [
        0: 180.0,   // 世界级别
        1: 90.0,
        2: 45.0,
        3: 22.5,
        4: 11.25,
        5: 5.625,
        6: 2.8125,
        7: 1.40625,
        8: 0.703125,
        9: 0.3515625,
        10: 0.17578125,
        11: 0.087890625,
        12: 0.0439453125,
        13: 0.02197265625,
        14: 0.010986328125,
        15: 0.0054931640625,
        16: 0.00274658203125,
        17: 0.001373291015625,
        18: 0.0006866455078125,
        19: 0.00034332275390625,
        20: 0.000171661376953125
    ]

    // MARK: - Initialization

    public init(maxCacheSize: Int = 100, apiManager: APIManager) {
        self.maxCacheSize = maxCacheSize
        self.apiManager = apiManager
    }

    // MARK: - Public Methods

    /// 获取指定边界和缩放级别的Tile
    /// - Parameters:
    ///   - bounds: Tile边界
    ///   - zoom: 缩放级别
    /// - Returns: PixelTile
    public func fetchTile(for bounds: TileBounds, zoom: Int) async throws -> PixelTile {
        let tileId = "\(zoom)_\(bounds.minLatitude)_\(bounds.minLongitude)"

        // 检查缓存 - 只检查是否存在，不返回缓存的tile
        if tileCache[tileId] != nil {
            // 更新访问时间
            tileCache[tileId]?.lastAccessTime = Date()
            updateAccessOrder(tileId: tileId)
        }

        // 从服务器获取像素数据
        let pixels = try await fetchPixelsFromServer(bounds: bounds, zoom: zoom)

        // 创建新的Tile
        let tile = await PixelTile(
            id: tileId,
            bounds: bounds,
            zoomLevel: zoom,
            pixels: pixels,
            lastUpdated: Date()
        )

        // 缓存Tile元数据（不缓存tile本身，因为它包含main actor数据）
        cacheTileMetadata(id: tileId, bounds: bounds, zoom: zoom)

        return tile
    }

    /// 获取可见区域需要加载的所有Tile边界
    /// - Parameters:
    ///   - region: 可见地图区域
    ///   - zoom: 缩放级别
    /// - Returns: Tile边界数组
    public func tilesForVisibleRegion(_ region: MKCoordinateRegion, zoom: Int) async -> [TileBounds] {
        let tileSize = tileSizeForZoom(zoom)

        // 计算可见区域的边界
        let minLat = region.center.latitude - region.span.latitudeDelta / 2
        let maxLat = region.center.latitude + region.span.latitudeDelta / 2
        let minLon = region.center.longitude - region.span.longitudeDelta / 2
        let maxLon = region.center.longitude + region.span.longitudeDelta / 2

        // 计算需要的Tile数量
        let startRow = Int(floor(minLat / tileSize))
        let endRow = Int(ceil(maxLat / tileSize))
        let startCol = Int(floor(minLon / tileSize))
        let endCol = Int(ceil(maxLon / tileSize))

        var tiles: [TileBounds] = []

        for row in startRow...endRow {
            for col in startCol...endCol {
                let tileBounds = await TileBounds(
                    minLatitude: Double(row) * tileSize,
                    maxLatitude: Double(row + 1) * tileSize,
                    minLongitude: Double(col) * tileSize,
                    maxLongitude: Double(col + 1) * tileSize
                )
                tiles.append(tileBounds)
            }
        }

        return tiles
    }

    /// 清空缓存
    public func clearCache() {
        tileCache.removeAll()
        accessOrder.removeAll()
    }

    /// 预加载指定区域的Tiles
    /// - Parameters:
    ///   - region: 要预加载的区域
    ///   - zoom: 缩放级别
    public func preloadTiles(for region: MKCoordinateRegion, zoom: Int) async {
        let tileBounds = await tilesForVisibleRegion(region, zoom: zoom)

        await withTaskGroup(of: Void.self) { group in
            for bounds in tileBounds {
                group.addTask {
                    do {
                        _ = try await self.fetchTile(for: bounds, zoom: zoom)
                    } catch {
                        Logger.warning("⚠️ Failed to preload tile at zoom \(zoom): \(error.localizedDescription)")
                    }
                }
            }
        }
    }

    /// 获取缓存统计信息
    /// - Returns: 缓存统计信息（缓存数量、命中率等）
    public func getCacheStats() -> (cacheSize: Int, maxSize: Int, usagePercentage: Double) {
        let size = tileCache.count
        let percentage = Double(size) / Double(maxCacheSize) * 100.0
        return (cacheSize: size, maxSize: maxCacheSize, usagePercentage: percentage)
    }

    /// 移除过期的Tile
    /// - Parameter maxAge: 最大缓存时间（秒）
    public func removeExpiredTiles(maxAge: TimeInterval = 3600) {
        let now = Date()
        var expiredTileIds: [String] = []

        for (tileId, cachedTile) in tileCache {
            if now.timeIntervalSince(cachedTile.lastAccessTime) > maxAge {
                expiredTileIds.append(tileId)
            }
        }

        for tileId in expiredTileIds {
            tileCache.removeValue(forKey: tileId)
            accessOrder.removeAll { $0 == tileId }
        }
    }

    // MARK: - Private Methods

    /// 获取指定缩放级别的Tile大小
    /// - Parameter zoom: 缩放级别
    /// - Returns: Tile大小（度）
    private func tileSizeForZoom(_ zoom: Int) -> Double {
        return Self.defaultTileSize[zoom] ?? 0.1
    }

    /// 缓存Tile元数据并执行LRU淘汰
    /// - Parameters:
    ///   - id: Tile ID
    ///   - bounds: Tile边界
    ///   - zoom: 缩放级别
    private func cacheTileMetadata(id: String, bounds: TileBounds, zoom: Int) {
        // 如果缓存已满，移除最久未使用的Tile
        if tileCache.count >= maxCacheSize {
            evictLRUTile()
        }

        // 添加到缓存
        let cachedTile = CachedTile(tileId: id, bounds: bounds, zoomLevel: zoom, lastAccessTime: Date())
        tileCache[id] = cachedTile
        updateAccessOrder(tileId: id)
    }

    /// 更新访问顺序（LRU）
    /// - Parameter tileId: Tile ID
    private func updateAccessOrder(tileId: String) {
        // 移除旧位置
        accessOrder.removeAll { $0 == tileId }
        // 添加到末尾（最近访问）
        accessOrder.append(tileId)
    }

    /// 淘汰最久未使用的Tile
    private func evictLRUTile() {
        guard let lruTileId = accessOrder.first else { return }

        tileCache.removeValue(forKey: lruTileId)
        accessOrder.removeFirst()
    }

    /// 从服务器获取像素数据
    /// - Parameters:
    ///   - bounds: 区域边界
    ///   - zoom: 缩放级别
    /// - Returns: 像素数组
    private func fetchPixelsFromServer(bounds: TileBounds, zoom: Int = 15) async throws -> [Pixel] {
        // 这里使用APIManager获取像素数据
        // 实际实现需要根据后端API调整

        do {
            // 使用APIManager的fetchPixels方法
            let pixels = try await apiManager.fetchPixels(in: bounds, zoom: zoom)
            return pixels
        } catch {
            // 如果获取失败，返回空数组
            Logger.error("Failed to fetch pixels from server: \(error)")
            return []
        }
    }
}

// MARK: - Supporting Types

/// 像素数据响应模型
private struct PixelsResponse: Codable {
    let pixels: [Pixel]
    let total: Int?
    let hasMore: Bool?

    enum CodingKeys: String, CodingKey {
        case pixels
        case total
        case hasMore = "has_more"
    }
}

// MARK: - Extensions

extension PixelTileManager {
    /// 批量获取Tiles
    /// - Parameters:
    ///   - bounds: Tile边界数组
    ///   - zoom: 缩放级别
    /// - Returns: PixelTile数组
    public func fetchTiles(for bounds: [TileBounds], zoom: Int) async throws -> [PixelTile] {
        try await withThrowingTaskGroup(of: PixelTile.self) { group in
            for tileBounds in bounds {
                group.addTask {
                    try await self.fetchTile(for: tileBounds, zoom: zoom)
                }
            }

            var tiles: [PixelTile] = []
            for try await tile in group {
                tiles.append(tile)
            }
            return tiles
        }
    }

    /// 更新缓存中的像素
    /// - Parameter pixel: 更新的像素
    /// 注意：由于PixelTile是main actor-isolated，我们不再缓存tile本身
    public func updatePixelInCache(_ pixel: Pixel) async {
        // 找到包含该像素的tile ID
        let pixelCoord = await pixel.coordinate
        for (tileId, cachedTile) in tileCache {
            let tileBounds = cachedTile.bounds
            if tileBounds.minLatitude <= pixelCoord.latitude &&
               tileBounds.maxLatitude >= pixelCoord.latitude &&
               tileBounds.minLongitude <= pixelCoord.longitude &&
               tileBounds.maxLongitude >= pixelCoord.longitude {
                // 更新访问时间
                tileCache[tileId]?.lastAccessTime = Date()
            }
        }
    }

    /// 从缓存中移除像素
    /// - Parameter pixelId: 像素ID
    /// 注意：由于PixelTile是main actor-isolated，我们不再缓存tile本身
    public func removePixelFromCache(withId pixelId: String) async {
        // 由于不再缓存实际的tile对象，此方法目前是空操作
        // 如需实现，可以考虑在需要时重新获取tile数据
    }
}
