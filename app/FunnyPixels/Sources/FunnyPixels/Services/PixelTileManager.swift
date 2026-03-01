import Foundation
import MapKit

/// Tile缓存项（包含访问时间用于LRU）
private struct CachedTile {
    let tile: PixelTile
    var lastAccessTime: Date

    init(tile: PixelTile) {
        self.tile = tile
        self.lastAccessTime = Date()
    }

    mutating func updateAccessTime() {
        self.lastAccessTime = Date()
    }
}

/// 🚀 LRU链表节点（用于O(1)缓存逐出）
private class LRUNode {
    let key: String
    var prev: LRUNode?
    var next: LRUNode?

    init(key: String) {
        self.key = key
    }
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

    // 🚀 优化的LRU数据结构（O(1)访问和逐出）
    /// 节点字典：快速查找节点
    private var nodeMap: [String: LRUNode] = [:]
    /// 链表头（最近访问）
    private var head: LRUNode?
    /// 链表尾（最久未访问）
    private var tail: LRUNode?

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

    public init(maxCacheSize: Int = 100, apiManager: APIManager = .shared) {
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
        let tileId = PixelTile.generateId(bounds: bounds, zoomLevel: zoom)

        // 检查缓存
        if var cachedTile = tileCache[tileId] {
            cachedTile.updateAccessTime()
            tileCache[tileId] = cachedTile
            updateAccessOrder(tileId: tileId)
            return cachedTile.tile
        }

        // 从服务器获取像素数据
        let pixels = try await fetchPixelsFromServer(bounds: bounds, zoom: zoom)

        // 创建新的Tile
        let tile = PixelTile(
            id: tileId,
            bounds: bounds,
            zoomLevel: zoom,
            pixels: pixels,
            lastUpdated: Date()
        )

        // 缓存Tile
        cacheTile(tile)

        return tile
    }

    /// 获取可见区域需要加载的所有Tile边界
    /// - Parameters:
    ///   - region: 可见地图区域
    ///   - zoom: 缩放级别
    /// - Returns: Tile边界数组
    public func tilesForVisibleRegion(_ region: MKCoordinateRegion, zoom: Int) -> [TileBounds] {
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
                let tileBounds = TileBounds(
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
        nodeMap.removeAll()
        head = nil
        tail = nil
    }

    /// 预加载指定区域的Tiles
    /// - Parameters:
    ///   - region: 要预加载的区域
    ///   - zoom: 缩放级别
    public func preloadTiles(for region: MKCoordinateRegion, zoom: Int) async {
        let tileBounds = tilesForVisibleRegion(region, zoom: zoom)

        await withTaskGroup(of: Void.self) { group in
            for bounds in tileBounds {
                group.addTask {
                    _ = try? await self.fetchTile(for: bounds, zoom: zoom)
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

        // 🚀 优化：使用新的LRU结构移除过期节点
        for tileId in expiredTileIds {
            tileCache.removeValue(forKey: tileId)

            // 从LRU链表中移除
            if let node = nodeMap[tileId] {
                removeNode(node)
                nodeMap.removeValue(forKey: tileId)
            }
        }
    }

    // MARK: - Private Methods

    /// 获取指定缩放级别的Tile大小
    /// - Parameter zoom: 缩放级别
    /// - Returns: Tile大小（度）
    private func tileSizeForZoom(_ zoom: Int) -> Double {
        return Self.defaultTileSize[zoom] ?? 0.1
    }

    /// 缓存Tile并执行LRU淘汰
    /// - Parameter tile: 要缓存的Tile
    private func cacheTile(_ tile: PixelTile) {
        // 如果缓存已满，移除最久未使用的Tile
        if tileCache.count >= maxCacheSize {
            evictLRUTile()
        }

        // 添加到缓存
        let cachedTile = CachedTile(tile: tile)
        tileCache[tile.id] = cachedTile
        updateAccessOrder(tileId: tile.id)
    }

    /// 🚀 更新访问顺序（LRU）- 优化版 O(1)
    /// - Parameter tileId: Tile ID
    private func updateAccessOrder(tileId: String) {
        // 如果节点已存在，移到头部
        if let node = nodeMap[tileId] {
            moveToHead(node)
        } else {
            // 创建新节点并添加到头部
            let newNode = LRUNode(key: tileId)
            nodeMap[tileId] = newNode
            addToHead(newNode)
        }
    }

    /// 🚀 淘汰最久未使用的Tile - 优化版 O(1)
    private func evictLRUTile() {
        guard let tailNode = tail else { return }

        // 从缓存中移除
        tileCache.removeValue(forKey: tailNode.key)
        nodeMap.removeValue(forKey: tailNode.key)

        // 从链表中移除尾节点
        removeTail()
    }

    // MARK: - LRU双向链表辅助方法

    /// 将节点添加到链表头部（最近访问）
    private func addToHead(_ node: LRUNode) {
        node.next = head
        node.prev = nil

        if let currentHead = head {
            currentHead.prev = node
        }

        head = node

        // 如果链表为空，head和tail都指向新节点
        if tail == nil {
            tail = node
        }
    }

    /// 从链表中移除节点
    private func removeNode(_ node: LRUNode) {
        if let prev = node.prev {
            prev.next = node.next
        } else {
            // 移除的是head节点
            head = node.next
        }

        if let next = node.next {
            next.prev = node.prev
        } else {
            // 移除的是tail节点
            tail = node.prev
        }

        node.prev = nil
        node.next = nil
    }

    /// 将节点移到链表头部
    private func moveToHead(_ node: LRUNode) {
        // 如果已经是head，不需要操作
        guard node !== head else { return }

        removeNode(node)
        addToHead(node)
    }

    /// 移除链表尾节点
    private func removeTail() {
        guard let tailNode = tail else { return }
        removeNode(tailNode)
    }

    /// 从服务器获取像素数据
    /// - Parameters:
    ///   - bounds: 区域边界
    ///   - zoom: 缩放级别
    /// - Returns: 像素数组
    private func fetchPixelsFromServer(bounds: TileBounds, zoom: Int = 15) async throws -> [Pixel] {
        // 这里使用APIManager获取像素数据
        // 实际实现需要根据后端API调整

        // 构造请求参数
        let params: [String: Any] = [
            "minLat": bounds.minLatitude,
            "maxLat": bounds.maxLatitude,
            "minLon": bounds.minLongitude,
            "maxLon": bounds.maxLongitude
        ]

        do {
            // 使用APIManager的fetchPixels方法
            let pixels = try await apiManager.fetchPixels(in: bounds, zoom: zoom)
            return pixels
        } catch {
            // 如果获取失败，返回空数组
            print("Failed to fetch pixels from server: \(error)")
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
    public func updatePixelInCache(_ pixel: Pixel) {
        for (tileId, var cachedTile) in tileCache {
            if cachedTile.tile.bounds.contains(pixel.coordinate) {
                var updatedTile = cachedTile.tile
                updatedTile.updatePixel(pixel)
                cachedTile = CachedTile(tile: updatedTile)
                tileCache[tileId] = cachedTile
            }
        }
    }

    /// 从缓存中移除像素
    /// - Parameter pixelId: 像素ID
    public func removePixelFromCache(withId pixelId: String) {
        for (tileId, var cachedTile) in tileCache {
            var updatedTile = cachedTile.tile
            updatedTile.removePixel(withId: pixelId)
            cachedTile = CachedTile(tile: updatedTile)
            tileCache[tileId] = cachedTile
        }
    }
}
