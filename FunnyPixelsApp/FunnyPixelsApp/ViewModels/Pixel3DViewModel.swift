import Foundation
import SceneKit
import Combine
import CoreLocation

/// 3D 像素地图视图模型
/// 负责管理 SceneKit 场景、瓦片加载、内存优化和 GPU Instancing
@MainActor
class Pixel3DViewModel: ObservableObject {
    // MARK: - Published State

    @Published var loadedColumns: [PixelColumn] = []
    @Published var totalLayerCount: Int = 0
    @Published var currentGeometryDetail: String = "high"
    @Published var isLoading = false
    @Published var showGuide = true
    @Published var errorMessage: String?

    // Memory monitoring
    @Published var memoryUsageMB: Double = 0
    @Published var isMemoryWarning = false

    // MARK: - SceneKit

    let scene = SCNScene()
    let camera = SCNNode()
    private let rootNode = SCNNode()  // 所有柱体的父节点
    private let lightNode = SCNNode()

    // MARK: - Tile Management

    private var loadedTiles: Set<TileKey> = []
    private var columnNodes: [String: SCNNode] = [:]  // columnId -> SCNNode
    private let tileSize: Double = 0.1  // 瓦片大小：0.1° ≈ 11km

    // MARK: - Memory Management (防崩溃核心)

    private let maxColumnCount = 15000  // 最大柱体数量
    private let maxMemoryMB: Double = 800  // 最大内存占用 800MB
    private var memoryMonitorTimer: Timer?

    // MARK: - Coordinate System

    private var coordinateConverter: CoordinateConverter?
    private var lastReferencePoint: CLLocationCoordinate2D?

    // MARK: - Geometry Cache (GPU Instancing)

    private var geometryCache: [GeometryDetail: SCNGeometry] = [:]

    // MARK: - Background Queue

    private let processingQueue = DispatchQueue(label: "com.funnypixels.pixel3d", qos: .userInitiated)

    // MARK: - Initialization

    init() {
        setupScene()
        setupCamera()
        setupLighting()
        setupMemoryMonitoring()
    }

    deinit {
        stopMemoryMonitoring()
    }

    // MARK: - Scene Setup

    private func setupScene() {
        // 使用透明背景（显示底层内容）
        scene.background.contents = UIColor.clear
        scene.rootNode.addChildNode(rootNode)
        scene.rootNode.addChildNode(camera)

        Logger.info("🎬 [3D Scene] Scene setup completed")
    }

    private func setupCamera() {
        let cameraObj = SCNCamera()
        cameraObj.fieldOfView = 60
        cameraObj.zNear = 0.01
        cameraObj.zFar = 1000

        camera.camera = cameraObj
        camera.position = SCNVector3(0, 5, 10)
        camera.eulerAngles = SCNVector3(-Float.pi / 6, 0, 0)
    }

    private func setupLighting() {
        // Ambient light
        let ambientLight = SCNLight()
        ambientLight.type = .ambient
        ambientLight.color = UIColor(white: 0.4, alpha: 1.0)
        let ambientNode = SCNNode()
        ambientNode.light = ambientLight
        scene.rootNode.addChildNode(ambientNode)

        // Directional light
        let directionalLight = SCNLight()
        directionalLight.type = .directional
        directionalLight.color = UIColor(white: 0.8, alpha: 1.0)
        lightNode.light = directionalLight
        lightNode.position = SCNVector3(10, 20, 10)
        lightNode.look(at: SCNVector3Zero)
        scene.rootNode.addChildNode(lightNode)
    }

    // MARK: - Memory Monitoring (关键防崩溃机制)

    private func setupMemoryMonitoring() {
        memoryMonitorTimer = Timer.scheduledTimer(withTimeInterval: 2.0, repeats: true) { [weak self] _ in
            Task { @MainActor [weak self] in
                guard let self = self else { return }
                self.checkMemoryUsage()
            }
        }
    }

    nonisolated private func stopMemoryMonitoring() {
        Task { @MainActor in
            memoryMonitorTimer?.invalidate()
            memoryMonitorTimer = nil
        }
    }

    private func checkMemoryUsage() {
        let metrics = getMemoryMetrics()
        memoryUsageMB = metrics.usedMB

        if metrics.isCritical {
            Logger.error("⚠️ Critical memory usage: \(String(format: "%.1f", metrics.usagePercent))%")
            isMemoryWarning = true
            handleMemoryWarning()
        } else if metrics.isWarning {
            Logger.warning("⚠️ High memory usage: \(String(format: "%.1f", metrics.usagePercent))%")
            isMemoryWarning = true
            // 主动释放部分资源
            reduceLOD()
        } else {
            isMemoryWarning = false
        }
    }

    private func getMemoryMetrics() -> MemoryMetrics {
        var info = mach_task_basic_info()
        var count = mach_msg_type_number_t(MemoryLayout<mach_task_basic_info>.size) / 4

        let kerr: kern_return_t = withUnsafeMutablePointer(to: &info) {
            $0.withMemoryRebound(to: integer_t.self, capacity: 1) {
                task_info(mach_task_self_, task_flavor_t(MACH_TASK_BASIC_INFO), $0, &count)
            }
        }

        let usedMB = kerr == KERN_SUCCESS ? Double(info.resident_size) / 1024.0 / 1024.0 : 0.0

        // 动态获取设备物理内存（优化）
        let totalMB = Double(ProcessInfo.processInfo.physicalMemory) / 1024.0 / 1024.0

        return MemoryMetrics(
            usedMB: usedMB,
            totalMB: totalMB,
            availableMB: totalMB - usedMB
        )
    }

    private func handleMemoryWarning() {
        let startTime = Date()
        let beforeMemory = getMemoryMetrics()

        Logger.warning("🔥 [Performance] Memory warning - Before: \(String(format: "%.1f", beforeMemory.usedMB))MB (\(String(format: "%.1f", beforeMemory.usagePercent))%)")

        // 1. 降低 LOD
        reduceLOD()

        // 2. 卸载最旧的瓦片（FIFO）
        let tilesToRemove = Array(loadedTiles.prefix(loadedTiles.count / 3))
        tilesToRemove.forEach { unloadTile($0) }

        // 3. 清理几何缓存
        let cacheSize = geometryCache.count
        geometryCache.removeAll()

        let afterMemory = getMemoryMetrics()
        let duration = Date().timeIntervalSince(startTime)
        let freedMB = beforeMemory.usedMB - afterMemory.usedMB

        Logger.info("✅ [Performance] Memory cleanup completed in \(String(format: "%.3f", duration))s - Freed \(String(format: "%.1f", freedMB))MB, Removed \(tilesToRemove.count) tiles + \(cacheSize) cached geometries")
    }

    private func reduceLOD() {
        guard let current = GeometryDetail(rawValue: currentGeometryDetail) else { return }

        let newDetail: GeometryDetail
        switch current {
        case .high:
            newDetail = .medium
        case .medium:
            newDetail = .low
        case .low:
            return  // Already lowest
        }

        currentGeometryDetail = newDetail.rawValue
        Logger.info("🔽 Reduced LOD: \(current.rawValue) → \(newDetail.rawValue)")

        // 重新加载当前柱体
        reloadColumnsWithNewLOD()
    }

    private func reloadColumnsWithNewLOD() {
        // 清空当前节点
        rootNode.childNodes.forEach { $0.removeFromParentNode() }
        columnNodes.removeAll()

        // 使用新 LOD 重新渲染
        renderColumns(loadedColumns)
    }

    // MARK: - Tile Loading

    /// 加载可见瓦片
    /// - Parameters:
    ///   - center: 地图中心点
    ///   - viewport: 当前视口边界
    func loadVisibleTiles(center: CLLocationCoordinate2D, in viewport: ViewportBounds) {
        // 检查是否需要更新参考点
        if coordinateConverter == nil || coordinateConverter!.needsUpdate(for: center) {
            Logger.info("📍 [3D Scene] Updating reference point to (\(center.latitude), \(center.longitude))")
            coordinateConverter = CoordinateConverter(referencePoint: center)
            lastReferencePoint = center

            // 参考点变化时，清空现有场景并重新加载
            if !loadedTiles.isEmpty {
                recenterScene()
            }
        }

        let startTime = Date()
        let requiredTiles = viewport.tilesInBounds(tileSize: tileSize)
        let tilesToLoad = requiredTiles.subtracting(loadedTiles)

        guard !tilesToLoad.isEmpty else {
            return
        }

        Logger.info("📦 [Performance] Loading \(tilesToLoad.count) new tiles (total loaded: \(loadedTiles.count))")

        Task {
            for tile in tilesToLoad {
                await loadTile(tile)
            }
            let duration = Date().timeIntervalSince(startTime)
            Logger.info("✅ [Performance] Batch tile load completed in \(String(format: "%.3f", duration))s (\(String(format: "%.3f", duration / Double(tilesToLoad.count)))s/tile)")
        }
    }

    /// 重置场景（参考点变化时）
    private func recenterScene() {
        Logger.info("🔄 [3D Scene] Recentering scene")

        // 清空所有节点
        rootNode.childNodes.forEach { $0.removeFromParentNode() }
        columnNodes.removeAll()

        // 清空已加载瓦片
        loadedColumns.removeAll()
        loadedTiles.removeAll()
        totalLayerCount = 0
    }

    private func loadTile(_ tile: TileKey) async {
        guard !loadedTiles.contains(tile) else { return }

        let startTime = Date()
        let bounds = tile.toBounds(tileSize: tileSize)

        do {
            let fetchStart = Date()
            let columns = try await fetchTileData(bounds: bounds)
            let fetchDuration = Date().timeIntervalSince(fetchStart)

            let renderStart = Date()
            await MainActor.run {
                loadedTiles.insert(tile)
                loadedColumns.append(contentsOf: columns)
                totalLayerCount = loadedColumns.count
                renderColumns(columns)

                // 检查是否超出限制
                if loadedColumns.count > maxColumnCount {
                    handleMemoryWarning()
                }
            }
            let renderDuration = Date().timeIntervalSince(renderStart)
            let totalDuration = Date().timeIntervalSince(startTime)

            Logger.info("✅ [Performance] Tile (\(tile.x),\(tile.y)): \(columns.count) columns in \(String(format: "%.3f", totalDuration))s (fetch: \(String(format: "%.3f", fetchDuration))s, render: \(String(format: "%.3f", renderDuration))s)")
        } catch {
            Logger.error("Failed to load tile \(tile.x),\(tile.y): \(error)")
            await MainActor.run {
                errorMessage = "加载失败: \(error.localizedDescription)"
            }
        }
    }

    private func unloadTile(_ tile: TileKey) {
        loadedTiles.remove(tile)
        Logger.debug("Unloaded tile \(tile.x),\(tile.y)")
    }

    // MARK: - Data Fetching

    /// 从后端获取瓦片数据
    private func fetchTileData(bounds: ViewportBounds) async throws -> [PixelColumn] {
        // APIManager.get() 会自动添加 baseURL，这里只需要路径
        let path = "/pixels-3d/viewport"

        let parameters: [String: Any] = [
            "minLat": bounds.minLat,
            "maxLat": bounds.maxLat,
            "minLng": bounds.minLng,
            "maxLng": bounds.maxLng,
            "zoom": 15,  // Default zoom level
            "limit": 10000
        ]

        Logger.info("🌐 [API] Fetching 3D data from: \(path)")
        Logger.info("🌐 [API] Parameters: \(parameters)")

        let response: Pixel3DResponse = try await APIManager.shared.get(path, parameters: parameters)

        guard response.success else {
            throw NSError(domain: "Pixel3DViewModel", code: -1, userInfo: [
                NSLocalizedDescriptionKey: response.message ?? "Unknown error"
            ])
        }

        return response.data.pixels
    }

    // MARK: - Rendering (GPU Instancing)

    /// 渲染柱体（使用 GPU Instancing）
    private func renderColumns(_ columns: [PixelColumn]) {
        guard !columns.isEmpty else { return }

        let detail = GeometryDetail(rawValue: currentGeometryDetail) ?? .high

        // 按颜色分组以启用 Instancing
        let groupedByColor = Dictionary(grouping: columns, by: { $0.color })

        for (color, colorColumns) in groupedByColor {
            renderInstancedColumns(colorColumns, color: color, detail: detail)
        }
    }

    private func renderInstancedColumns(_ columns: [PixelColumn], color: String, detail: GeometryDetail) {
        guard let converter = coordinateConverter else {
            Logger.warning("⚠️ CoordinateConverter not initialized, skipping render")
            return
        }

        let geometry = getOrCreateGeometry(detail: detail)
        let material = createMaterial(color: color)
        geometry.firstMaterial = material

        // 为每个柱体创建节点（SceneKit 会自动优化相同几何体的渲染）
        for column in columns {
            let node = SCNNode(geometry: geometry)

            // 使用坐标转换器将 GPS 坐标转换为 SceneKit 坐标
            let position = converter.gpsToScene(
                latitude: column.lat,
                longitude: column.lng,
                height: column.height / 2.0  // 柱体中心高度
            )
            node.position = position

            // 固定宽度（1 unit = 10 meters），高度基于数据
            let width: Float = 1.0  // 10 米宽
            node.scale = SCNVector3(width, Float(column.height), width)

            rootNode.addChildNode(node)
            columnNodes[column.id] = node
        }
    }

    // MARK: - Geometry Creation (LOD)

    private func getOrCreateGeometry(detail: GeometryDetail) -> SCNGeometry {
        if let cached = geometryCache[detail] {
            return cached
        }

        let geometry = createGeometry(detail: detail)
        geometryCache[detail] = geometry
        return geometry
    }

    private func createGeometry(detail: GeometryDetail) -> SCNGeometry {
        let cylinder = SCNCylinder(radius: 0.5, height: 1.0)
        cylinder.radialSegmentCount = detail.segmentCount
        cylinder.heightSegmentCount = 1

        return cylinder
    }

    private func createMaterial(color: String) -> SCNMaterial {
        let material = SCNMaterial()
        material.diffuse.contents = UIColor(hex: color) ?? .gray
        material.lightingModel = .blinn
        material.shininess = 0.3
        return material
    }

    // MARK: - Camera Control

    /// 更新相机位置以跟随地图状态
    /// - Parameters:
    ///   - center: 地图中心点（用于初始化坐标转换器）
    ///   - zoom: 地图缩放级别（影响相机高度）
    func updateCamera(center: CLLocationCoordinate2D, zoom: Double) {
        // 确保坐标转换器已初始化
        if coordinateConverter == nil {
            coordinateConverter = CoordinateConverter(referencePoint: center)
            lastReferencePoint = center
        }

        // 根据缩放级别计算相机高度
        // Zoom 10 → 500 units (5000m)
        // Zoom 15 → 100 units (1000m)
        // Zoom 18 → 20 units (200m)
        let cameraHeight = calculateCameraHeight(zoom: zoom)
        let cameraDistance = cameraHeight * 0.8  // 45度视角

        // 使用平滑动画更新相机位置
        SCNTransaction.begin()
        SCNTransaction.animationDuration = 0.5
        SCNTransaction.animationTimingFunction = CAMediaTimingFunction(name: .easeInEaseOut)

        camera.position = SCNVector3(0, Float(cameraHeight), Float(cameraDistance))
        camera.look(at: SCNVector3Zero)

        SCNTransaction.commit()

        Logger.info("📷 [Camera] Updated position: height=\(cameraHeight), distance=\(cameraDistance), zoom=\(zoom)")
    }

    /// 计算相机高度（基于缩放级别）
    private func calculateCameraHeight(zoom: Double) -> Double {
        // 使用指数函数：height = 20 × 2^(18 - zoom)
        // 这样在不同缩放级别下相机高度呈指数变化
        return 20.0 * pow(2.0, 18.0 - zoom)
    }

    // MARK: - Public Controls

    /// 切换几何体细节
    func setGeometryDetail(_ detail: String) {
        currentGeometryDetail = detail
        reloadColumnsWithNewLOD()
    }

    /// 清空所有数据
    func clearAll() {
        rootNode.childNodes.forEach { $0.removeFromParentNode() }
        columnNodes.removeAll()
        loadedColumns.removeAll()
        loadedTiles.removeAll()
        totalLayerCount = 0
    }

    /// 关闭引导
    func dismissGuide() {
        showGuide = false
    }
}
