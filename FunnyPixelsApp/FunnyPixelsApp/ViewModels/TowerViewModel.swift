//
//  TowerViewModel.swift
//  FunnyPixelsApp
//
//  Task: #38 - Week 2 iOS 核心渲染逻辑
//  3D 像素塔场景管理和渲染
//

import Foundation
import SceneKit
import CoreLocation
import Combine
import UIKit

@MainActor
class TowerViewModel: ObservableObject {
    // MARK: - Published State

    @Published var isLoading = false
    @Published var error: String?
    @Published var loadedTowerCount = 0
    @Published var selectedTower: TowerDetailsData?
    @Published var showTowerDetails = false

    // MARK: - SceneKit Properties

    let scene = SCNScene()
    private var rootNode: SCNNode!
    private var cameraNode: SCNNode!

    // MARK: - Performance Optimization

    private var towerNodes: [String: SCNNode] = [:]  // tileId -> node
    private var loadedTiles = Set<String>()

    // Shared geometry for instancing
    private var sharedFloorGeometry: SCNBox!

    // Coordinate converter
    private var coordinateConverter: CoordinateConverter?

    // LOD thresholds
    private let nearDistance: Float = 50.0
    private let farDistance: Float = 200.0
    private let cullDistance: Float = 1500.0

    // Memory management
    private let maxVisibleTowers = 500
    private var currentCameraPosition: SCNVector3 = SCNVector3Zero

    // LOD tracking
    private var towerLODLevels: [String: TowerLOD] = [:]  // tileId -> current LOD

    // MARK: - Initialization

    init() {
        setupScene()
        setupSharedGeometry()
    }

    private func setupScene() {
        rootNode = scene.rootNode

        // Camera setup
        cameraNode = SCNNode()
        let camera = SCNCamera()
        camera.zNear = 0.1
        camera.zFar = 5000
        camera.fieldOfView = 60
        cameraNode.camera = camera
        cameraNode.position = SCNVector3(0, 100, 200)
        cameraNode.look(at: SCNVector3Zero)
        scene.rootNode.addChildNode(cameraNode)

        // Lighting
        let ambientLight = SCNNode()
        ambientLight.light = SCNLight()
        ambientLight.light?.type = .ambient
        ambientLight.light?.color = UIColor(white: 0.4, alpha: 1.0)
        scene.rootNode.addChildNode(ambientLight)

        let directionalLight = SCNNode()
        directionalLight.light = SCNLight()
        directionalLight.light?.type = .directional
        directionalLight.light?.intensity = 800
        directionalLight.position = SCNVector3(10, 50, 10)
        directionalLight.look(at: SCNVector3Zero)
        scene.rootNode.addChildNode(directionalLight)

        // Background - 透明（显示下层2D地图）
        scene.background.contents = UIColor.clear
    }

    private func setupSharedGeometry() {
        // 创建共享的楼层几何体（用于 instancing）
        let floorHeight: CGFloat = 0.15
        let floorSize: CGFloat = 0.9

        sharedFloorGeometry = SCNBox(
            width: floorSize,
            height: floorHeight,
            length: floorSize,
            chamferRadius: 0.02
        )

        // 默认材质（会被实例覆盖）
        let material = SCNMaterial()
        material.lightingModel = .physicallyBased
        material.metalness.contents = 0.1
        material.roughness.contents = 0.8
        sharedFloorGeometry.materials = [material]
    }

    // MARK: - Loading Towers

    /// 加载视口范围内的塔
    func loadTowers(center: CLLocationCoordinate2D, bounds: ViewportBounds) async {
        isLoading = true
        error = nil

        // 初始化坐标转换器
        if coordinateConverter == nil {
            coordinateConverter = CoordinateConverter(referencePoint: center)
        }

        do {
            let towers = try await fetchTowersInViewport(bounds: bounds)

            // 渲染塔
            await renderTowers(towers)

            loadedTowerCount = towers.count
            isLoading = false

            Logger.info("[Tower] Loaded \(towers.count) towers")

        } catch {
            self.error = error.localizedDescription
            isLoading = false
            Logger.error("[Tower] Load failed: \(error)")
        }
    }

    private func fetchTowersInViewport(bounds: ViewportBounds) async throws -> [TowerSummary] {
        let path = "/towers/viewport"
        let parameters: [String: Any] = [
            "minLat": bounds.minLat,
            "maxLat": bounds.maxLat,
            "minLng": bounds.minLng,
            "maxLng": bounds.maxLng,
            "limit": 2000
        ]

        let response: TowerViewportResponse = try await APIManager.shared.get(path, parameters: parameters)
        return response.data.towers
    }

    // MARK: - Rendering

    private func renderTowers(_ towers: [TowerSummary]) async {
        guard let converter = coordinateConverter else { return }

        for tower in towers {
            // 跳过已加载的塔
            if loadedTiles.contains(tower.tileId) { continue }

            // 创建塔节点
            let towerNode = createTowerNode(tower: tower, converter: converter)

            // 初始设置为透明（准备淡入动画）
            towerNode.opacity = 0.0

            await MainActor.run {
                rootNode.addChildNode(towerNode)
                towerNodes[tower.tileId] = towerNode
                loadedTiles.insert(tower.tileId)

                // 淡入动画
                SCNTransaction.begin()
                SCNTransaction.animationDuration = 0.5
                towerNode.opacity = 1.0
                SCNTransaction.commit()
            }
        }
    }

    private func createTowerNode(tower: TowerSummary, converter: CoordinateConverter) -> SCNNode {
        let towerNode = SCNNode()
        towerNode.name = "tower_\(tower.tileId)"

        // 位置
        let basePosition = converter.gpsToScene(
            latitude: tower.lat,
            longitude: tower.lng,
            height: 0
        )
        towerNode.position = basePosition

        // 创建简化的柱体（初始 LOD）
        let simplifiedGeometry = createSimplifiedTower(height: Float(tower.height), color: tower.topColor)
        let geometryNode = SCNNode(geometry: simplifiedGeometry)
        geometryNode.position = SCNVector3(0, Float(tower.height) / 2, 0)
        towerNode.addChildNode(geometryNode)

        // 存储元数据（用于交互）
        towerNode.setValue(tower.tileId, forKey: "tileId")
        towerNode.setValue(tower.pixelCount, forKey: "pixelCount")

        return towerNode
    }

    private func createSimplifiedTower(height: Float, color: String) -> SCNGeometry {
        let box = SCNBox(width: 0.9, height: CGFloat(height), length: 0.9, chamferRadius: 0.05)

        let material = SCNMaterial()
        material.diffuse.contents = UIColor(hex: color) ?? .gray
        material.lightingModel = .physicallyBased
        material.metalness.contents = 0.2
        material.roughness.contents = 0.7

        box.materials = [material]
        return box
    }

    // MARK: - Detail Loading (按需加载详细楼层)

    /// 加载塔的详细楼层数据
    func loadTowerDetails(tileId: String) async {
        do {
            let path = "/towers/\(tileId)/floors"
            let userId = AuthManager.shared.currentUser?.id ?? ""
            let parameters: [String: Any] = [
                "userId": userId,
                "limit": 100  // 先加载前 100 层
            ]

            let response: TowerDetailsResponse = try await APIManager.shared.get(path, parameters: parameters)

            await MainActor.run {
                selectedTower = response.data
                showTowerDetails = true

                // 替换简化模型为详细楼层
                if let towerNode = towerNodes[tileId] {
                    replaceWithDetailedFloors(towerNode: towerNode, details: response.data)
                }
            }

            Logger.info("[Tower] Loaded details for \(tileId): \(response.data.totalFloors) floors")

        } catch {
            Logger.error("[Tower] Failed to load details: \(error)")
            self.error = "Failed to load tower details"
        }
    }

    private func replaceWithDetailedFloors(towerNode: SCNNode, details: TowerDetailsData) {
        // 移除简化几何体
        towerNode.childNodes.forEach { $0.removeFromParentNode() }

        let floorHeight: Float = 0.15

        // 渲染每一层（最多渲染 100 层以保持性能）
        let floorsToRender = Array(details.floors.prefix(100))

        for floor in floorsToRender {
            let floorNode = SCNNode(geometry: sharedFloorGeometry)

            // 材质（每层不同颜色）
            let material = SCNMaterial()
            material.diffuse.contents = UIColor(hex: floor.color) ?? .gray
            material.lightingModel = .physicallyBased
            material.metalness.contents = 0.1
            material.roughness.contents = 0.8

            // 高亮用户楼层
            if let userFloors = details.userFloors,
               floor.floorIndex >= userFloors.firstFloorIndex &&
               floor.floorIndex <= userFloors.lastFloorIndex {
                material.emission.contents = UIColor(white: 1.0, alpha: 0.3)  // 发光效果
            }

            floorNode.geometry?.materials = [material]

            // 位置
            floorNode.position = SCNVector3(
                0,
                Float(floor.floorIndex) * floorHeight + floorHeight / 2,
                0
            )

            floorNode.name = "floor_\(floor.floorIndex)"
            towerNode.addChildNode(floorNode)
        }

        // 如果总楼层 > 100，在顶部添加标记
        if details.totalFloors > 100 {
            let label = createFloorCountLabel(count: details.totalFloors - 100)
            let labelNode = SCNNode(geometry: label)
            labelNode.position = SCNVector3(0, Float(100) * floorHeight + 2, 0)
            towerNode.addChildNode(labelNode)
        }

        // 自动定位到用户楼层
        if let userFloors = details.userFloors {
            focusOnFloor(towerNode: towerNode, floorIndex: userFloors.lastFloorIndex)
        }
    }

    private func createFloorCountLabel(count: Int) -> SCNText {
        let text = SCNText(string: "+\(count) more", extrusionDepth: 0.1)
        text.font = UIFont.systemFont(ofSize: 2)
        text.flatness = 0.1

        let material = SCNMaterial()
        material.diffuse.contents = UIColor.white
        text.materials = [material]

        return text
    }

    // MARK: - Camera Control

    func updateCamera(center: CLLocationCoordinate2D, zoom: Double) {
        if coordinateConverter == nil {
            coordinateConverter = CoordinateConverter(referencePoint: center)
        }

        let cameraHeight = calculateCameraHeight(zoom: zoom)
        let cameraDistance = cameraHeight * 0.8

        SCNTransaction.begin()
        SCNTransaction.animationDuration = 0.5
        cameraNode.position = SCNVector3(0, Float(cameraHeight), Float(cameraDistance))
        cameraNode.look(at: SCNVector3Zero)
        SCNTransaction.commit()

        currentCameraPosition = cameraNode.position

        // 🎯 触发 LOD 更新
        updateAllTowerLODs()
    }

    private func calculateCameraHeight(zoom: Double) -> Double {
        return 20.0 * pow(2.0, 18.0 - zoom)
    }

    func focusOnFloor(towerNode: SCNNode, floorIndex: Int) {
        let floorHeight: Float = 0.15
        let targetY = Float(floorIndex) * floorHeight

        let targetPosition = SCNVector3(
            towerNode.position.x,
            targetY + 5,  // 稍微偏上
            towerNode.position.z + 10
        )

        let lookAtPosition = SCNVector3(
            towerNode.position.x,
            targetY,
            towerNode.position.z
        )

        SCNTransaction.begin()
        SCNTransaction.animationDuration = 1.0
        cameraNode.position = targetPosition
        cameraNode.look(at: lookAtPosition)
        SCNTransaction.commit()

        currentCameraPosition = targetPosition
    }

    // MARK: - Interaction

    /// 处理点击事件（射线检测）
    func handleTap(at point: CGPoint, in sceneView: SCNView) {
        let hitResults = sceneView.hitTest(point, options: [:])

        guard let firstHit = hitResults.first,
              let towerNode = findTowerNode(from: firstHit.node),
              let tileId = towerNode.value(forKey: "tileId") as? String else {
            // 轻触反馈：未击中任何塔
            let feedbackGenerator = UIImpactFeedbackGenerator(style: .light)
            feedbackGenerator.impactOccurred()
            return
        }

        Logger.info("[Tower] Tapped tower: \(tileId)")

        // 触觉反馈：击中塔
        let feedbackGenerator = UIImpactFeedbackGenerator(style: .medium)
        feedbackGenerator.impactOccurred()

        // 加载详细楼层
        Task {
            await loadTowerDetails(tileId: tileId)
        }
    }

    private func findTowerNode(from node: SCNNode) -> SCNNode? {
        var currentNode: SCNNode? = node

        while let node = currentNode {
            if node.name?.starts(with: "tower_") == true {
                return node
            }
            currentNode = node.parent
        }

        return nil
    }

    // MARK: - Memory Management

    /// 移除指定的塔（从场景和内存中）
    private func removeTowers(tileIds: [String]) {
        for tileId in tileIds {
            towerNodes[tileId]?.removeFromParentNode()
            towerNodes.removeValue(forKey: tileId)
            loadedTiles.remove(tileId)
            towerLODLevels.removeValue(forKey: tileId)
        }

        if !tileIds.isEmpty {
            Logger.info("[Tower] Removed \(tileIds.count) distant towers")
        }
    }

    /// 激进剔除：移除最远的塔直到数量降到阈值以下
    private func performAggressiveCulling() {
        // 按距离排序所有塔
        let sortedTowers = towerNodes.map { (tileId, node) -> (String, Float) in
            let distance = node.position.distance(to: currentCameraPosition)
            return (tileId, distance)
        }.sorted { $0.1 > $1.1 }  // 距离从远到近

        // 计算需要移除的数量
        let currentCount = towerNodes.count
        let targetCount = Int(Float(maxVisibleTowers) * 0.8)  // 降到 80% 阈值
        let removeCount = max(0, currentCount - targetCount)

        if removeCount > 0 {
            let toRemove = sortedTowers.prefix(removeCount).map { $0.0 }
            removeTowers(tileIds: Array(toRemove))

            Logger.warning("[Tower] Aggressive culling: removed \(removeCount) towers (memory pressure)")
        }
    }

    /// 手动触发距离剔除（可从外部调用）
    @available(*, deprecated, message: "Use updateAllTowerLODs() instead")
    func pruneDistantTowers(threshold: Float = 1500) {
        var toRemove: [String] = []

        for (tileId, node) in towerNodes {
            let distance = node.position.distance(to: currentCameraPosition)

            if distance > threshold {
                toRemove.append(tileId)
            }
        }

        removeTowers(tileIds: toRemove)
    }

    /// 获取内存使用统计
    func getMemoryStats() -> (towerCount: Int, visibleCount: Int, hiddenCount: Int) {
        let visibleCount = towerNodes.values.filter { !$0.isHidden }.count
        return (
            towerCount: towerNodes.count,
            visibleCount: visibleCount,
            hiddenCount: towerNodes.count - visibleCount
        )
    }

    // MARK: - LOD System

    /// LOD 级别枚举
    enum TowerLOD {
        case high       // < 50m: 详细楼层（每层独立）
        case medium     // 50-200m: 简化柱体
        case low        // 200-1500m: 极简柱体
        case hidden     // > 1500m: 隐藏
    }

    /// 根据相机距离确定 LOD 级别
    private func calculateLOD(distance: Float) -> TowerLOD {
        if distance < nearDistance {
            return .high
        } else if distance < farDistance {
            return .medium
        } else if distance < cullDistance {
            return .low
        } else {
            return .hidden
        }
    }

    /// 更新所有塔的 LOD（同时执行内存管理）
    func updateAllTowerLODs() {
        var visibleCount = 0
        var toRemove: [String] = []

        for (tileId, node) in towerNodes {
            let distance = node.position.distance(to: currentCameraPosition)
            let newLOD = calculateLOD(distance: distance)
            let currentLOD = towerLODLevels[tileId] ?? .medium

            // 标记需要剔除的塔
            if newLOD == .hidden && distance > cullDistance * 1.2 {
                // 超过剔除距离 1.2 倍，完全移除
                toRemove.append(tileId)
                continue
            }

            // 只有 LOD 变化时才更新
            if newLOD != currentLOD {
                updateTowerLOD(tileId: tileId, node: node, newLOD: newLOD)
                towerLODLevels[tileId] = newLOD
            }

            if !node.isHidden {
                visibleCount += 1
            }
        }

        // 执行剔除
        if !toRemove.isEmpty {
            removeTowers(tileIds: toRemove)
        }

        // 内存压力管理：如果可见塔过多，强制剔除最远的
        if visibleCount > maxVisibleTowers {
            performAggressiveCulling()
        }
    }

    /// 更新单个塔的 LOD
    private func updateTowerLOD(tileId: String, node: SCNNode, newLOD: TowerLOD) {
        switch newLOD {
        case .high:
            // 已在 loadTowerDetails 中实现详细楼层加载
            // 这里只需要确保可见
            node.isHidden = false
            node.opacity = 1.0

        case .medium:
            // 简化为单一柱体（如果当前是详细模式）
            if node.childNodes.count > 1 {
                // 移除详细楼层，恢复简化柱体
                node.childNodes.forEach { $0.removeFromParentNode() }

                // 重新添加简化几何体
                if let tower = getTowerSummary(for: tileId) {
                    let simplifiedGeometry = createSimplifiedTower(
                        height: Float(tower.height),
                        color: tower.topColor
                    )
                    let geometryNode = SCNNode(geometry: simplifiedGeometry)
                    geometryNode.position = SCNVector3(0, Float(tower.height) / 2, 0)
                    node.addChildNode(geometryNode)
                }
            }
            node.isHidden = false
            node.opacity = 1.0

        case .low:
            // 极简柱体 + 透明度降低
            node.isHidden = false
            node.opacity = 0.6

        case .hidden:
            // 隐藏（但不从场景移除，保留在内存中）
            node.isHidden = true
        }

        // 添加平滑过渡动画
        SCNTransaction.begin()
        SCNTransaction.animationDuration = 0.3
        // opacity 变化已经在上面设置
        SCNTransaction.commit()

        Logger.debug("[Tower LOD] \(tileId): \(newLOD)")
    }

    /// 获取塔的摘要信息（用于 LOD 降级）
    private func getTowerSummary(for tileId: String) -> TowerSummary? {
        // 注意：这需要缓存塔的摘要信息
        // 简化实现：从节点元数据中获取
        guard towerNodes[tileId] != nil else { return nil }

        // 从存储的值构建 TowerSummary
        // （在实际应用中，应该在加载时缓存完整的 TowerSummary）
        return nil  // 占位符，实际需要缓存机制
    }

    // MARK: - Cleanup

    func cleanup() {
        towerNodes.values.forEach { $0.removeFromParentNode() }
        towerNodes.removeAll()
        loadedTiles.removeAll()
        towerLODLevels.removeAll()
        selectedTower = nil
    }
}

// MARK: - SCNVector3 Extension

extension SCNVector3 {
    func distance(to vector: SCNVector3) -> Float {
        let dx = x - vector.x
        let dy = y - vector.y
        let dz = z - vector.z
        return sqrt(dx*dx + dy*dy + dz*dz)
    }
}

// Note: UIColor.init(hex:) extension is defined in GPSDrawingService.swift
