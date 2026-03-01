import Foundation
import CoreLocation

/// 瓦片四叉树 (Tile Quadtree)
/// 用于高效索引和查询瓦片数据
public class TileQuadTree<T>: @unchecked Sendable {
    // MARK: - Node Class

    public class Node: @unchecked Sendable {
        public let tileCoordinate: TileCoordinate
        public var data: T?
        public var children: [Node]?

        public init(coordinate: TileCoordinate, data: T? = nil) {
            self.tileCoordinate = coordinate
            self.data = data
        }

        /// 是否为叶子节点
        public var isLeaf: Bool {
            children == nil || children?.isEmpty == true
        }

        /// 分裂节点
        public func split() {
            guard isLeaf else { return }
            children = tileCoordinate.children().map { Node(coordinate: $0) }
        }

        /// 合并子节点
        public func merge() {
            children?.removeAll()
            children = nil
        }
    }

    // MARK: - Properties

    private var root: Node?

    /// 最大深度 (默认 18，对应最大缩放级别)
    public let maxDepth: Int

    /// 当前深度
    public private(set) var currentDepth: Int = 0

    /// 节点数量
    public private(set) var nodeCount: Int = 0

    // MARK: - Initialization

    public init(maxDepth: Int = 18) {
        self.maxDepth = maxDepth
        // 初始化根节点 (缩放级别 0，全球范围)
        self.root = Node(coordinate: TileCoordinate(x: 0, y: 0, z: 0))
        self.nodeCount = 1
    }

    // MARK: - Search

    /// 搜索指定瓦片坐标的数据
    /// - Parameter coord: 瓦片坐标
    /// - Returns: 找到的数据，如果不存在返回 nil
    public func search(at coord: TileCoordinate) -> T? {
        guard let root = root else { return nil }
        return search(coord, in: root)
    }

    private func search(_ coord: TileCoordinate, in node: Node) -> T? {
        // 精确匹配
        if node.tileCoordinate == coord {
            return node.data
        }

        // 检查子节点
        if let children = node.children, !children.isEmpty {
            // 找到包含目标坐标的子节点
            for child in children where child.tileCoordinate.bounds.contains(coord.center) {
                if let result = search(coord, in: child) {
                    return result
                }
            }
        }

        return nil
    }

    /// 搜索指定边界范围内的所有数据
    /// - Parameter bounds: 边界范围
    /// - Returns: 该范围内的所有数据
    public func search(in bounds: TileBounds) -> [T] {
        guard let root = root else { return [] }
        var results: [T] = []
        search(bounds, in: root, results: &results)
        return results
    }

    private func search(_ bounds: TileBounds, in node: Node, results: inout [T]) {
        // 检查当前节点是否在范围内
        if node.tileCoordinate.bounds.intersects(bounds), let data = node.data {
            results.append(data)
        }

        // 递归搜索子节点
        if let children = node.children {
            for child in children {
                if child.tileCoordinate.bounds.intersects(bounds) {
                    search(bounds, in: child, results: &results)
                }
            }
        }
    }

    /// 搜索指定缩放级别的所有数据
    /// - Parameter zoom: 缩放级别
    /// - Returns: 该缩放级别的所有数据
    public func search(zoom: Int) -> [T] {
        guard let root = root else { return [] }
        var results: [T] = []
        search(zoom: zoom, in: root, results: &results)
        return results
    }

    private func search(zoom: Int, in node: Node, results: inout [T]) {
        if node.tileCoordinate.z == zoom, let data = node.data {
            results.append(data)
        }

        if let children = node.children {
            for child in children {
                search(zoom: zoom, in: child, results: &results)
            }
        }
    }

    // MARK: - Insert

    /// 插入数据
    /// - Parameters:
    ///   - data: 要插入的数据
    ///   - coord: 瓦片坐标
    /// - Returns: 是否插入成功
    @discardableResult
    public func insert(_ data: T, at coord: TileCoordinate) -> Bool {
        guard let root = root else { return false }

        // 检查深度限制
        if coord.z > maxDepth {
            return false
        }

        let success = insert(data, at: coord, in: root, currentDepth: 0)
        if success {
            // 更新当前深度
            currentDepth = max(currentDepth, coord.z)
        }
        return success
    }

    private func insert(_ data: T, at coord: TileCoordinate, in node: Node, currentDepth: Int) -> Bool {
        // 找到目标位置
        if node.tileCoordinate == coord {
            node.data = data
            return true
        }

        // 检查是否需要分裂
        if node.isLeaf && currentDepth < maxDepth {
            node.split()
            nodeCount += 4
        }

        // 递归插入到子节点
        if let children = node.children {
            for child in children where child.tileCoordinate.bounds.contains(coord.center) {
                return insert(data, at: coord, in: child, currentDepth: currentDepth + 1)
            }
        }

        return false
    }

    // MARK: - Remove

    /// 移除指定瓦片坐标的数据
    /// - Parameter coord: 瓦片坐标
    /// - Returns: 被移除的数据，如果不存在返回 nil
    @discardableResult
    public func remove(at coord: TileCoordinate) -> T? {
        guard let root = root else { return nil }
        return remove(coord, in: root, parent: nil)
    }

    private func remove(_ coord: TileCoordinate, in node: Node, parent: Node?) -> T? {
        // 找到目标节点
        if node.tileCoordinate == coord {
            let removedData = node.data
            node.data = nil

            // 如果是叶子节点且没有数据，尝试合并父节点
            if parent?.children?.allSatisfy({ $0.data == nil }) == true {
                parent?.merge()
                nodeCount -= 3
            }

            return removedData
        }

        // 递归搜索子节点
        if let children = node.children {
            for child in children where child.tileCoordinate.bounds.contains(coord.center) {
                if let result = remove(coord, in: child, parent: node) {
                    return result
                }
            }
        }

        return nil
    }

    // MARK: - Update

    /// 更新指定瓦片坐标的数据
    /// - Parameters:
    ///   - coord: 瓦片坐标
    ///   - updateFn: 更新函数
    /// - Returns: 是否更新成功
    @discardableResult
    public func update(at coord: TileCoordinate, updateFn: (inout T?) -> Void) -> Bool {
        guard let root = root else { return false }

        if let node = findNode(coord, in: root) {
            updateFn(&node.data)
            return true
        }

        return false
    }

    // MARK: - Query

    /// 获取指定坐标的所有祖先节点数据
    /// - Parameter coord: 瓦片坐标
    /// - Returns: 从根节点到目标节点的路径上的所有数据
    public func getAncestors(of coord: TileCoordinate) -> [T] {
        guard let root = root else { return [] }
        var results: [T] = []
        collectAncestors(of: coord, in: root, results: &results)
        return results
    }

    private func collectAncestors(of coord: TileCoordinate, in node: Node, results: inout [T]) {
        if let data = node.data {
            results.append(data)
        }

        if let children = node.children {
            for child in children where child.tileCoordinate.bounds.contains(coord.center) {
                collectAncestors(of: coord, in: child, results: &results)
            }
        }
    }

    /// 获取指定坐标的所有子节点数据
    /// - Parameter coord: 瓦片坐标
    /// - Returns: 所有子节点的数据
    public func getChildren(of coord: TileCoordinate) -> [T] {
        guard let root = root else { return [] }
        guard let node = findNode(coord, in: root) else { return [] }
        guard let children = node.children else { return [] }

        return children.compactMap { $0.data }
    }

    // MARK: - Helper

    private func findNode(_ coord: TileCoordinate, in node: Node) -> Node? {
        if node.tileCoordinate == coord {
            return node
        }

        if let children = node.children {
            for child in children where child.tileCoordinate.bounds.contains(coord.center) {
                if let found = findNode(coord, in: child) {
                    return found
                }
            }
        }

        return nil
    }

    // MARK: - Statistics

    /// 获取树的高度
    public func height() -> Int {
        guard let root = root else { return 0 }
        return calculateHeight(of: root)
    }

    private func calculateHeight(of node: Node) -> Int {
        guard let children = node.children, !children.isEmpty else { return 1 }
        let maxHeight = children.map { calculateHeight(of: $0) }.max() ?? 0
        return 1 + maxHeight
    }

    /// 获取指定深度的节点数量
    public func nodeCount(atDepth depth: Int) -> Int {
        guard let root = root else { return 0 }
        var count = 0
        countNodes(atDepth: depth, in: root, currentDepth: 0, count: &count)
        return count
    }

    private func countNodes(atDepth targetDepth: Int, in node: Node, currentDepth: Int, count: inout Int) {
        if currentDepth == targetDepth {
            count += 1
            return
        }

        if let children = node.children {
            for child in children {
                countNodes(atDepth: targetDepth, in: child, currentDepth: currentDepth + 1, count: &count)
            }
        }
    }

    /// 清空树
    public func clear() {
        root = Node(coordinate: TileCoordinate(x: 0, y: 0, z: 0))
        currentDepth = 0
        nodeCount = 1
    }
}

// MARK: - Debug Extensions

#if DEBUG
extension TileQuadTree {
    /// 打印树结构 (用于调试)
    public func debugPrint() {
        guard root != nil else {
            Logger.debug("Tree is empty")
            return
        }
        Logger.debug("=== TileQuadTree ===")
        Logger.debug("Max Depth: \(maxDepth)")
        Logger.debug("Current Depth: \(currentDepth)")
        Logger.debug("Node Count: \(nodeCount)")
        Logger.debug("Height: \(height())")
        Logger.debug("===================")
    }
}
#endif
