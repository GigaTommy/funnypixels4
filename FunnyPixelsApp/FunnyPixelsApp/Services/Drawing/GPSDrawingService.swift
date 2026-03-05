import Foundation
import CoreLocation
import Combine
import MapLibre
import UIKit

/// GPS绘制服务
/// 负责基于GPS位置自动绘制像素，使用用户的联盟旗帜图案
/// 支持实时地图更新、异步后端同步，以及后台持续运行
@MainActor
class GPSDrawingService: NSObject, ObservableObject {
    static let shared = GPSDrawingService()

    // MARK: - Published Properties

    @Published var isGPSDrawingMode = false
    @Published var currentCoordinate: CLLocationCoordinate2D?
    @Published var drawnPixelsCount = 0
    @Published var lastDrawnPixel: DrawnPixelInfo?
    @Published var isDrawing = false
    @Published var isFocusMode = false  // 专注模式状态（防误触+优化）
    @Published var isInBackground = false  // 是否在后台运行
    @Published var currentSpeedKmH: Double = 0.0  // 当前GPS速度（km/h），用于Live Activity动态图标

    @Published var errorMessage: String?

    /// 已绘制的网格ID集合（用于去重统计）
    private var drawnGridIds: Set<String> = []

    /// 是否正在运行随机测试（防止系统GPS数据干扰测试）
    public var isRunningRandomTest = false

    // MARK: - Background Execution

    /// 后台任务标识符（保护切后台时正在进行的像素提交）
    private var backgroundTaskID: UIBackgroundTaskIdentifier = .invalid

    /// GPS Drawing 开始时间
    private var drawingStartTime: Date?

    // MARK: - Services

    private var locationManager: LocationManager { LocationManager.shared }
    private var drawingService: DrawingService { DrawingService.shared }
    private var drawingState: DrawingStateManager { DrawingStateManager.shared }
    private var patternProvider: AllianceDrawingPatternProvider { AllianceDrawingPatternProvider.shared }
    private var pixelDrawService: PixelDrawService { PixelDrawService.shared }

    // MARK: - Computed Properties (from PixelDrawService)

    /// 总像素点数（从PixelDrawService获取）
    var totalPoints: Int {
        pixelDrawService.totalPoints
    }

    /// 剩余点数（从PixelDrawService获取）
    /// 返回用户当前可用的总点数（道具点 + 自然点）
    /// 注意：此值会在每次绘制成功后自动更新
    var remainingPoints: Int {
        pixelDrawService.totalPoints
    }

    /// 道具点数（从PixelDrawService获取）
    var itemPoints: Int {
        pixelDrawService.itemPoints
    }

    /// 自然点数（从PixelDrawService获取）
    var naturalPoints: Int {
        pixelDrawService.naturalPoints
    }

    /// 最大自然点数（从PixelDrawService获取）
    var maxNaturalPoints: Int {
        pixelDrawService.maxNaturalPoints
    }

    /// 冻结截止时间（从PixelDrawService获取）
    var freezeUntil: Int {
        pixelDrawService.freezeUntil
    }

    /// 是否冻结（从PixelDrawService获取）
    var isFrozen: Bool {
        pixelDrawService.isFrozen
    }

    /// 剩余冻结时间（秒）
    var freezeTimeLeft: Int {
        pixelDrawService.freezeTimeLeft
    }

    /// 是否可以绘制（从PixelDrawService获取）
    var canDraw: Bool {
        pixelDrawService.canDraw
    }

    // MARK: - Location Tracking

    private var lastDrawnCoordinate: CLLocationCoordinate2D?
    private var lastSuccessfulDrawnCoordinate: CLLocationCoordinate2D?  // ✅ 用于计算距离
    private var minimumDistance: Double = 5 // 最小绘制距离（米）
    private var drawingQueue: [(coordinate: CLLocationCoordinate2D, timestamp: Date)] = []
    
    // 🎨 本次会话的绘制记录（用于生成真实快照）
    private var currentSessionPixels: [DrawnPixelInfo] = []

    // MARK: - Map Integration

    private weak var mapView: MLNMapView?
    private weak var highPerformanceRenderer: HighPerformanceMVTRenderer?

    // MARK: - Cancellables

    private var cancellables = Set<AnyCancellable>()

    // MARK: - Initialization

    private override init() {
        super.init()
        setupLocationManager()
        setupSocketListeners()
        setupDebugLocationListener()
        setupPixelServiceListeners()
    }

    // MARK: - Setup

    private func setupPixelServiceListeners() {
        // 转发 PixelDrawService 的变更通知，确保UI能响应底层数据的变化
        pixelDrawService.objectWillChange
            .receive(on: RunLoop.main)
            .sink { [weak self] _ in
                self?.objectWillChange.send()
            }
            .store(in: &cancellables)
    }

    private func setupLocationManager() {
        // 注册位置更新回调
        locationManager.onUpdate { [weak self] location in
            Task { @MainActor in
                self?.handleLocationUpdate(location)
            }
        }

        // 监听位置权限被撤销 → 自动停止GPS绘画
        NotificationCenter.default.addObserver(forName: Notification.Name("LocationPermissionDenied"), object: nil, queue: .main) { [weak self] _ in
            Task { @MainActor in
                guard let self = self, self.isGPSDrawingMode else { return }
                Logger.warning("⚠️ Location permission revoked during GPS drawing, stopping")
                await self.stopGPSDrawing()
            }
        }
    }

    // MARK: - Test Helpers
    
    /// 模拟位置更新（用于随机GPS测试，绕过系统位置监听）
    /// - Parameter location: 模拟的CLLocation对象
    func simulateLocation(_ location: CLLocation) {
        // 直接加入绘制队列，绕过 isRunningRandomTest 的屏蔽逻辑
        let coordinate = location.coordinate
        currentCoordinate = coordinate
        
        // 模拟跟随模式更新
        MapController.shared.updateForGPSFollowing(location: location)
        
        // 触发活动围栏检查（用于测试环境下显示HUD）
        EventManager.shared.checkGeofence(location: coordinate)
        
        drawingQueue.append((coordinate, Date()))
        processNextInQueue()
    }

    private func setupSocketListeners() {
        // 监听像素变化 - 使用现有的publisher
        Task {
            for await pixels in await SocketIOManager.shared.pixelChangesPublisher.values {
                await MainActor.run {
                    handlePixelChanges(pixels)
                }
            }
        }
    }

    /// 设置调试模式位置监听（用于模拟器测试）
    private func setupDebugLocationListener() {
        #if DEBUG
        NotificationCenter.default.publisher(for: NSNotification.Name("SimulatedLocationUpdate"))
            .compactMap { $0.userInfo?["location"] as? CLLocation }
            .sink { [weak self] location in
                Task { @MainActor in
                    self?.handleLocationUpdate(location)
                }
            }
            .store(in: &cancellables)
        #endif
    }

    // MARK: - Socket Event Handlers

    private func handlePixelChanges(_ pixels: [Pixel]) {
        // 处理像素更新，在地图上显示
        for pixel in pixels {
            let coordinate = CLLocationCoordinate2D(
                latitude: pixel.latitude,
                longitude: pixel.longitude
            )

            // 通知地图更新
            NotificationCenter.default.post(
                name: .pixelDidUpdate,
                object: nil,
                userInfo: [
                    "coordinate": coordinate,
                    "pixel": pixel
                ] as [String: Any]
            )
        }
    }

    // MARK: - Map Integration

    /// 设置地图引用用于实时更新
    func setMapView(_ mapView: MLNMapView?) {
        self.mapView = mapView
    }
    
    /// 设置高性能渲染器引用
    func setHighPerformanceRenderer(_ renderer: HighPerformanceMVTRenderer?) {
        self.highPerformanceRenderer = renderer
    }
    
    /// 获取高性能渲染器
    func getHighPerformanceRenderer() -> HighPerformanceMVTRenderer? {
        return highPerformanceRenderer
    }

    /// 在地图上添加绘制预览
    private func addPixelPreview(at coordinate: CLLocationCoordinate2D, pattern: DrawingPattern) {
        guard let mapView = mapView, let style = mapView.style else {
            Logger.warning("无法添加像素预览：MapView 或 Style 为空")
            return
        }

        // 确保预览图层已初始化
        ensurePreviewLayers(style: style)

        // 获取或创建预览源
        guard let previewSource = style.source(withIdentifier: "pixel-preview-source") as? MLNShapeSource else {
            Logger.error("❌ 无法获取像素预览源")
            return
        }

        // 准备Sprite名称和类型
        var spriteName: String?
        let featureType: String

        switch pattern.type {
        case .color:
            featureType = "color"
            if let colorHex = pattern.color {
                let name = "preview_color_\(colorHex)"
                spriteName = name
                // 检查并添加Sprite
                if style.image(forName: name) == nil {
                    if let image = createColorSquare(colorHex: colorHex) {
                        style.setImage(image, forName: name)
                    }
                }
            }
        case .emoji:
            featureType = "emoji"
            if let emoji = pattern.emoji {
                // 使用与正式图层相同的命名约定，尝试复用
                let name = "emoji_\(emoji)"
                spriteName = name
                // 如果不仅在预览中使用，正式图层可能已经有了，检查一下
                if style.image(forName: name) == nil {
                    // 尝试创建
                    if let image = createEmojiImage(emoji) {
                        style.setImage(image, forName: name)
                    }
                }
            }
        case .complex:
            // 🔧 Complex类型预览兜底：如果sprite不存在，使用用户个人颜色方块代替
            if let patternId = pattern.patternId {
                if style.image(forName: patternId) != nil {
                    // Sprite存在，使用complex类型
                    featureType = "complex"
                    spriteName = patternId
                } else {
                    // Sprite不存在（如用户头像），使用用户个人颜色方块作为预览
                    let userId = AuthManager.shared.currentUser?.id ?? ""
                    let personalColor = PersonalColorPalette.colorForUser(userId)
                    Logger.info("ℹ️ Complex图案sprite不存在: \(patternId)，使用用户个人颜色预览方块: \(personalColor)")
                    featureType = "color"
                    let fallbackName = "preview_color_\(personalColor)"
                    spriteName = fallbackName
                    if style.image(forName: fallbackName) == nil {
                        if let image = createColorSquare(colorHex: personalColor) {
                            style.setImage(image, forName: fallbackName)
                        }
                    }
                }
            } else {
                // 没有patternId，使用用户个人颜色
                let userId = AuthManager.shared.currentUser?.id ?? ""
                let personalColor = PersonalColorPalette.colorForUser(userId)
                featureType = "color"
                let fallbackName = "preview_color_\(personalColor)"
                spriteName = fallbackName
                if style.image(forName: fallbackName) == nil {
                    if let image = createColorSquare(colorHex: personalColor) {
                        style.setImage(image, forName: fallbackName)
                    }
                }
            }
        default:
            // 使用用户个人颜色作为默认
            let userId = AuthManager.shared.currentUser?.id ?? ""
            let personalColor = PersonalColorPalette.colorForUser(userId)
            featureType = "color"
            let defaultName = "preview_color_\(personalColor)"
            spriteName = defaultName
            if style.image(forName: defaultName) == nil {
                if let image = createColorSquare(colorHex: personalColor) {
                    style.setImage(image, forName: defaultName)
                }
            }
        }

        guard let finalSpriteName = spriteName else {
            Logger.warning("⚠️ 无法确定预览Sprite名称")
            return
        }

        // 创建预览点
        let feature = MLNPointFeature()
        feature.coordinate = coordinate
        feature.attributes = [
            "grid_id": UUID().uuidString,
            "lat": coordinate.latitude,
            "lng": coordinate.longitude,
            "type": featureType,
            "sprite": finalSpriteName
        ]

        // 获取当前所有预览点并添加新点
        var previewFeatures: [MLNPointFeature] = []
        if let existingShape = previewSource.shape as? MLNShapeCollection {
            previewFeatures = existingShape.shapes.compactMap { $0 as? MLNPointFeature }
        }
        previewFeatures.append(feature)

        // 限制预览点数量（最多保留最近50个）
        if previewFeatures.count > 50 {
            previewFeatures = Array(previewFeatures.suffix(50))
        }

        // 更新源数据
        let shapeCollection = MLNShapeCollection(shapes: previewFeatures)
        previewSource.shape = shapeCollection

        Logger.debug("✅ 添加像素预览: \(coordinate.latitude), \(coordinate.longitude), type: \(featureType), sprite: \(finalSpriteName)")
    }

    /// 确保预览图层存在
    private func ensurePreviewLayers(style: MLNStyle) {
        if style.source(withIdentifier: "pixel-preview-source") == nil {
            let source = MLNShapeSource(identifier: "pixel-preview-source", shape: nil, options: nil)
            style.addSource(source)
            
            // 1. Color 预览图层
            let colorLayer = MLNSymbolStyleLayer(identifier: "pixel-preview-color", source: source)
            colorLayer.iconImageName = NSExpression(forKeyPath: "sprite")
            colorLayer.iconAllowsOverlap = NSExpression(forConstantValue: true)
            colorLayer.iconIgnoresPlacement = NSExpression(forConstantValue: true)
            colorLayer.iconScale = NSExpression(forConstantValue: 0.5) // 根据Sprite大小调整（64px -> 32px显示）
            colorLayer.iconOpacity = NSExpression(forConstantValue: 0.7) // 半透明以示预览
            colorLayer.predicate = NSPredicate(format: "type == 'color'")
            
            // 2. Emoji 预览图层
            let emojiLayer = MLNSymbolStyleLayer(identifier: "pixel-preview-emoji", source: source)
            emojiLayer.iconImageName = NSExpression(forKeyPath: "sprite")
            emojiLayer.iconAllowsOverlap = NSExpression(forConstantValue: true)
            emojiLayer.iconIgnoresPlacement = NSExpression(forConstantValue: true)
             emojiLayer.iconScale = NSExpression(forConstantValue: 0.5)
            emojiLayer.iconOpacity = NSExpression(forConstantValue: 0.8)
            emojiLayer.predicate = NSPredicate(format: "type == 'emoji'")

            // 3. Complex 预览图层
            let complexLayer = MLNSymbolStyleLayer(identifier: "pixel-preview-complex", source: source)
            complexLayer.iconImageName = NSExpression(forKeyPath: "sprite")
            complexLayer.iconAllowsOverlap = NSExpression(forConstantValue: true)
            complexLayer.iconIgnoresPlacement = NSExpression(forConstantValue: true)
            complexLayer.iconScale = NSExpression(forConstantValue: 0.5)
            complexLayer.iconOpacity = NSExpression(forConstantValue: 0.8)
            complexLayer.predicate = NSPredicate(format: "type == 'complex'")

            // 添加图层（确保在 label 图层之下，color 图层之上）
            // 尝试查找一个参考图层
            if let LabelLayer = style.layer(withIdentifier: "poi-label") {
                 style.insertLayer(colorLayer, below: LabelLayer)
                 style.insertLayer(emojiLayer, above: colorLayer)
                 style.insertLayer(complexLayer, above: emojiLayer)
            } else if let pixelsLayer = style.layer(withIdentifier: "pixels-complex") ?? style.layer(withIdentifier: "pixels-emoji") ?? style.layer(withIdentifier: "pixels-color") {
                 style.insertLayer(colorLayer, above: pixelsLayer)
                 style.insertLayer(emojiLayer, above: colorLayer)
                 style.insertLayer(complexLayer, above: emojiLayer)
            } else {
                 style.addLayer(colorLayer)
                 style.addLayer(emojiLayer)
                 style.addLayer(complexLayer)
            }

            Logger.debug("✅ 像素预览图层(Color/Emoji/Complex)已初始化")
        }
    }

    // MARK: - Sprite Helpers

    private func createEmojiImage(_ emoji: String) -> UIImage? {
        let size: CGFloat = 64
        let scale = mapView?.traitCollection.displayScale ?? 2.0
        
        let format = UIGraphicsImageRendererFormat()
        format.scale = scale
        format.opaque = false
        
        let renderer = UIGraphicsImageRenderer(size: CGSize(width: size, height: size), format: format)
        
        return renderer.image { context in
            let paragraphStyle = NSMutableParagraphStyle()
            paragraphStyle.alignment = .center

            let attributes: [NSAttributedString.Key: Any] = [
                .font: UIFont.systemFont(ofSize: size * 0.8),
                .paragraphStyle: paragraphStyle
            ]

            let text = NSString(string: emoji)
            let textRect = CGRect(x: 0, y: 0, width: size, height: size)

            text.draw(in: textRect, withAttributes: attributes)
        }
    }

    private func createColorSquare(colorHex: String) -> UIImage? {
        guard let color = UIColor(hex: colorHex) else { return nil }
        
        let size: CGFloat = 64
        let padding: CGFloat = 4 // 稍微留白模拟边框
        let scale = mapView?.traitCollection.displayScale ?? 2.0
        
        let format = UIGraphicsImageRendererFormat()
        format.scale = scale
        format.opaque = false

        let renderer = UIGraphicsImageRenderer(size: CGSize(width: size, height: size), format: format)
        
        return renderer.image { context in

            let cgContext = context.cgContext
            cgContext.clear(CGRect(x: 0, y: 0, width: size, height: size))

            // 绘制白色边框背景
            cgContext.setFillColor(UIColor.white.withAlphaComponent(0.8).cgColor)
            cgContext.fill(CGRect(x: 0, y: 0, width: size, height: size))

            // 绘制颜色主体
            cgContext.setFillColor(color.cgColor)
            cgContext.fill(
                CGRect(
                    x: padding,
                    y: padding,
                    width: size - 2 * padding,
                    height: size - 2 * padding
                )
            )
        }
    }

    // MARK: - Public Methods

    /// 临时存储当前的联盟ID
    private var currentAllianceId: Int?

    /// 开始GPS绘制模式
    func startGPSDrawing(allianceId: Int? = nil) async throws {
        Logger.debug("🎨 GPSDrawingService: startGPSDrawing called with allianceId: \(allianceId?.description ?? "nil")")
        
        guard AuthManager.shared.isAuthenticated else {
            throw GPSError.notAuthenticated
        }

        guard locationManager.isAuthorized else {
            throw GPSError.locationNotAuthorized
        }

        // 同步用户像素状态
        do {
            _ = try await pixelDrawService.validateUserState()
            Logger.info("✅ Pixel state synced: \(totalPoints) total points")
        } catch {
            Logger.warning("⚠️ Failed to sync pixel state, continuing anyway: \(error.localizedDescription)")
        }

        self.currentAllianceId = allianceId

        // 加载绘制图案（根据旗帜选择判断）
        Logger.debug("🎨 GPSDrawingService: About to set drawing pattern, allianceId: \(allianceId?.description ?? "nil")")
        if let choice = DrawingStateManager.shared.currentFlagChoice, choice.allianceId == nil {
            patternProvider.setPatternFromFlagChoice(choice)
        } else {
            await patternProvider.loadDrawingPattern(allianceId: allianceId)
        }
        Logger.debug("🎨 GPSDrawingService: Finished setting drawing pattern")

        // 🔧 预加载sprite（如果pattern有imageUrl）
        if let pattern = patternProvider.currentDrawingPattern,
           let imageUrl = pattern.imageUrl,
           let patternId = pattern.patternId {
            await preloadSpriteFromURL(imageUrl, patternId: patternId)
        }

        isGPSDrawingMode = true
        drawnPixelsCount = 0
        drawnGridIds.removeAll()
        lastDrawnCoordinate = nil
        lastSuccessfulDrawnCoordinate = nil  // ✅ 重置距离追踪
        currentSessionPixels.removeAll() // 清空记录
        drawingStartTime = Date()

        // ✅ 初始化专注模式统计
        drawingState.focusModeDistance = 0
        drawingState.focusModeStartTime = Date()

        // 切换到高精度模式（支持后台运行 + CLBackgroundActivitySession）
        locationManager.enableHighPrecisionMode()
        locationManager.startUpdating()

        // 启动heading更新（用于低功耗模式的指南针）
        locationManager.startHeadingUpdates()

        // 🆕 启动GPS跟随模式（导航风格）
        MapController.shared.startGPSFollowing()

        // 🆕 启动 GPS Drawing Live Activity（灵动岛 + 锁屏）
        let flagChoice = drawingState.currentFlagChoice
        let activityName = flagChoice?.displayName ?? ""
        let activityColor = flagChoice?.colorHex ?? "#4ECDC4"
        LiveActivityManager.shared.startGPSDrawingActivity(
            allianceName: activityName,
            allianceColorHex: activityColor,
            initialPoints: totalPoints
        )

        Logger.info("🎨 GPS绘制模式已启动（使用联盟ID: \(allianceId ?? -1)，Live Activity 已激活）")

        // 启动用户交互监控（5秒后自动进入低功耗模式）
        UserInteractionMonitor.shared.startMonitoring()

        // 监听空闲状态变化
        UserInteractionMonitor.shared.$isIdle
            .sink { [weak self] isIdle in
                guard let self = self else { return }
                if isIdle && self.isGPSDrawingMode {
                    self.enterFocusMode()
                }
            }
            .store(in: &cancellables)

        // 请求初始位置
        locationManager.requestLocation()
    }

    /// 停止GPS绘制模式
    func stopGPSDrawing() async {
        isGPSDrawingMode = false
        isDrawing = false
        isInBackground = false
        drawingQueue.removeAll()

        // 清理所有Combine订阅（防止累积）
        cancellables.removeAll()

        // 停止用户交互监控
        UserInteractionMonitor.shared.stopMonitoring()

        // 退出专注模式
        if isFocusMode {
            exitFocusMode()
        }

        // 切换回标准模式（省电，释放 CLBackgroundActivitySession）
        locationManager.enableStandardMode()
        locationManager.stopUpdating()
        locationManager.stopHeadingUpdates()  // 停止heading更新（低功耗模式使用）

        // 停止GPS跟随模式
        MapController.shared.stopGPSFollowing()

        // 🆕 结束 GPS Drawing Live Activity
        LiveActivityManager.shared.endGPSDrawingActivity(finalPixelsDrawn: drawnPixelsCount)

        // 🆕 结束后台任务（如果有）
        endBackgroundTaskIfNeeded()

        // 确保绘制状态管理器也停止（这会结束后端会话和心跳）
        if drawingState.isDrawingMode && drawingState.currentMode == .gps {
            await drawingState.stopDrawing()
        }

        drawingStartTime = nil

        // 🆕 刷新漂流瓶配额（画像素可能获得奖励）
        await DriftBottleManager.shared.refreshQuota()

        Logger.info("🛑 GPS绘制模式已停止，共绘制 \(drawnPixelsCount) 个像素")
    }

    // MARK: - Focus Mode (专注模式)

    /// 进入专注模式（防误触 + 性能优化）
    func enterFocusMode() {
        guard !isFocusMode else { return }

        isFocusMode = true
        DrawingStateManager.shared.isFocusMode = true
        DrawingStateManager.shared.focusModeActivationTime = Date()

        // 启动优化（屏幕亮度、地图渲染、GPS定位）
        LowPowerOptimizationManager.shared.enterOptimizationMode()

        // ✅ GPS定位优化（降低频率和精度，省电30-40%）
        optimizeGPSForFocusMode()

        Logger.info("🎯 GPS Drawing entered focus mode (anti-mistouch + optimized)")
    }

    /// 退出专注模式
    func exitFocusMode() {
        guard isFocusMode else { return }

        isFocusMode = false
        DrawingStateManager.shared.isFocusMode = false
        DrawingStateManager.shared.focusModeActivationTime = nil

        // 退出优化
        LowPowerOptimizationManager.shared.exitOptimizationMode()

        // ✅ 恢复GPS正常参数
        restoreGPSNormalMode()

        // 重置交互监控（重新开始5秒倒计时）
        UserInteractionMonitor.shared.recordInteraction()

        Logger.info("🎯 GPS Drawing exited focus mode")
    }

    // MARK: - GPS Optimization for Focus Mode

    /// 优化GPS定位参数（专注模式）
    private func optimizeGPSForFocusMode() {
        locationManager.optimizeForFocusMode()
    }

    /// 恢复GPS正常参数
    private func restoreGPSNormalMode() {
        locationManager.restoreFromFocusMode()
    }

    /// 设置最小绘制距离（米）
    func setMinimumDistance(_ distance: Double) {
        minimumDistance = max(1, distance) // 至少1米
    }
    
    /// 生成本次会话的地图快照
    func generateSessionSnapshot() async -> UIImage? {
        // Capture data on MainActor to avoid isolation issues in callbacks
        let pixelsToDraw = self.currentSessionPixels

        guard let mapView = self.mapView, !pixelsToDraw.isEmpty else {
            Logger.warning("Cannot generate snapshot: MapView is nil or no pixels")
            return nil
        }

        // 根据联盟旗帜类型加载对应的 sprite 图片
        // - complex: 从 /sprites/icon/2/complex/{patternId}.png 加载旗帜图片
        // - emoji:   从 /sprites/icon/2/emoji/{unicode}.png 加载，或本地生成 emoji 图片
        // - color:   不需要 sprite，由色块渲染路径处理
        var flagImage: UIImage? = nil
        let currentPattern = AllianceDrawingPatternProvider.shared.currentDrawingPattern
        let renderType = currentPattern?.type ?? .color
        let baseUrl = APIEndpoint.baseURL.trimmingCharacters(in: CharacterSet(charactersIn: "/"))

        switch renderType {
        case .complex:
            // 1. 从 sprite 端点加载 complex 旗帜图片
            if let patternId = currentPattern?.patternId, !patternId.isEmpty {
                do {
                    if let url = URL(string: "\(baseUrl)/sprites/icon/2/complex/\(patternId).png") {
                        var request = URLRequest(url: url)
                        if patternId.hasPrefix("user_avatar_") {
                            request.cachePolicy = .reloadIgnoringLocalCacheData
                        }
                        let (data, _) = try await URLSession.shared.data(for: request)
                        flagImage = UIImage(data: data)
                    }
                } catch {
                    Logger.warning("⚠️ Failed to load complex sprite: \(error)")
                }
            }
            // 2. 本地 fallback：base64 payload 或 imageUrl
            if flagImage == nil, let pattern = currentPattern {
                if let payload = pattern.payload {
                    let cleaned = payload.replacingOccurrences(of: "data:image/png;base64,", with: "")
                    if let data = Data(base64Encoded: cleaned, options: .ignoreUnknownCharacters),
                       let img = UIImage(data: data) {
                        flagImage = img
                    }
                }
                if flagImage == nil, let urlStr = pattern.imageUrl, let url = URL(string: urlStr),
                   let data = try? Data(contentsOf: url),
                   let img = UIImage(data: data) {
                    flagImage = img
                }
            }

        case .emoji:
            // 1. 从 sprite 端点加载 emoji sprite（与地图渲染一致）
            if let emoji = currentPattern?.emoji, !emoji.isEmpty {
                let encoded = emoji.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? emoji
                do {
                    if let url = URL(string: "\(baseUrl)/sprites/icon/2/emoji/\(encoded).png") {
                        let (data, _) = try await URLSession.shared.data(from: url)
                        flagImage = UIImage(data: data)
                    }
                } catch {
                    Logger.warning("⚠️ Failed to load emoji sprite: \(error)")
                }
            }
            // 2. 本地 fallback：生成 emoji 图片
            if flagImage == nil, let emoji = currentPattern?.emoji, !emoji.isEmpty {
                flagImage = Self.createEmojiImage(emoji, size: 64)
            }

        case .color, .none, .gps:
            // 色块类型不需要 sprite，由后续的 color block 渲染路径处理
            break
        }
        
        // 1. 计算边界
        var minLat = 90.0, maxLat = -90.0
        var minLon = 180.0, maxLon = -180.0
        for pixel in pixelsToDraw {
            minLat = min(minLat, pixel.latitude)
            maxLat = max(maxLat, pixel.latitude)
            minLon = min(minLon, pixel.longitude)
            maxLon = max(maxLon, pixel.longitude)
        }
        
        // 2. Manual Zoom Calculation (Robust)
        // Convert Coordinate Span to Zoom Level explicitly to avoid Camera Altitude ambiguity
        let spanLat = maxLat - minLat
        let spanLon = maxLon - minLon
        let center = CLLocationCoordinate2D(
            latitude: (minLat + maxLat) / 2,
            longitude: (minLon + maxLon) / 2
        )
        
        let maxSpan = max(spanLat, spanLon)
        var zoomLevel: Double
        
        // Threshold: 0.001 degrees is approx 111 meters
        if maxSpan < 0.001 {
            // Case A: Small area (Single point test)
            // Force Zoom 17.5 (High Detail Close-up)
            zoomLevel = 17.5
            Logger.info("📸 Snapshot: Small area/Point detected (Span: \(String(format: "%.6f", maxSpan))). Forcing Zoom 17.5.")
        } else {
            // Case B: Route
            // Calculate Zoom based on Span
            // Formula: fraction = span / 360
            // zoom = log2(1 / fraction) (+ adjustment for screen size)
            // Simpler formula for MapLibre/Mapbox:
            // zoom = log2(360 * screenWidth / (span * 256))
            
            // We use effective width to account for padding
            // Snapshot size 600, padding 100 each side -> effective 400
            let effectiveWidth = 400.0
            
            // Use maxSpan to fit the largest dimension
            let zoom = log2(360.0 * effectiveWidth / (maxSpan * 256.0))
            
            // Clamp to valid range (0-19)
            zoomLevel = max(0, min(zoom, 19.0))
            Logger.info("📸 Snapshot: Route detected (Span: \(String(format: "%.6f", maxSpan))). Calculated Zoom: \(String(format: "%.2f", zoomLevel))")
        }
        
        // 3. Configure Options
        // IMPORTANT: We must set zoomLevel explicitly on options, as it takes precedence over camera altitude
        let camera = MLNMapCamera(lookingAtCenter: center, altitude: 1000, pitch: 0, heading: 0)
        
        let options = MLNMapSnapshotOptions(
            styleURL: mapView.styleURL,
            camera: camera,
            size: CGSize(width: 600, height: 600)
        )
        options.zoomLevel = zoomLevel // Explicitly set Zoom Level to override altitude defaults

        
        // 4. 执行快照
        return await withCheckedContinuation { continuation in
            let snapshotter = MLNMapSnapshotter(options: options)
            snapshotter.start { image, error in
                if let error = error {
                    Logger.error("Map Snapshot failed: \(error.localizedDescription)")
                    continuation.resume(returning: nil)
                } else if let snapshot = image {
                    // Manually render AUTHENTIC pixels on top of the snapshot
                    let renderer = UIGraphicsImageRenderer(size: snapshot.image.size)
                    let finalImage = renderer.image { context in
                        // 1. Draw base map
                        snapshot.image.draw(at: .zero)
                        
                        // 2. Draw Pixels (Emojis or Blocks)
                        // Use a specific font size suitable for 600x600 image
                        let emojiAttributes: [NSAttributedString.Key: Any] = [
                            .font: UIFont.systemFont(ofSize: 24)
                        ]
                        
                        let flagSize: CGFloat = 14.0
                        let borderWidth: CGFloat = 2.0

                        for pixel in pixelsToDraw {
                            let coordinate = CLLocationCoordinate2D(latitude: pixel.latitude, longitude: pixel.longitude)
                            let point = snapshot.point(for: coordinate)

                            if let img = flagImage {
                                // Draw alliance flag in circular frame with white border
                                let totalSize = flagSize + borderWidth * 2

                                context.cgContext.setFillColor(UIColor.white.cgColor)
                                context.cgContext.fillEllipse(in: CGRect(
                                    x: point.x - totalSize / 2,
                                    y: point.y - totalSize / 2,
                                    width: totalSize,
                                    height: totalSize
                                ))

                                let flagRect = CGRect(
                                    x: point.x - flagSize / 2,
                                    y: point.y - flagSize / 2,
                                    width: flagSize,
                                    height: flagSize
                                )
                                context.cgContext.saveGState()
                                context.cgContext.addEllipse(in: flagRect)
                                context.cgContext.clip()
                                img.draw(in: flagRect)
                                context.cgContext.restoreGState()

                            } else if let emoji = pixel.emoji, !emoji.isEmpty {
                                // Fallback: Draw Emoji
                                let nsEmoji = NSString(string: emoji)
                                let size = nsEmoji.size(withAttributes: emojiAttributes)
                                let drawRect = CGRect(
                                    x: point.x - size.width/2,
                                    y: point.y - size.height/2,
                                    width: size.width,
                                    height: size.height
                                )
                                nsEmoji.draw(in: drawRect, withAttributes: emojiAttributes)

                            } else if let colorHex = pixel.color, let color = UIColor(hex: colorHex) {
                                // Fallback: Draw Colored Block
                                let blockSize: CGFloat = 12.0
                                let rect = CGRect(
                                    x: point.x - blockSize/2,
                                    y: point.y - blockSize/2,
                                    width: blockSize,
                                    height: blockSize
                                )

                                color.setFill()
                                context.cgContext.fill(rect)

                                UIColor.white.setStroke()
                                context.cgContext.setLineWidth(1.0)
                                context.cgContext.stroke(rect)
                            }
                        }
                    }
                    continuation.resume(returning: finalImage)
                } else {
                    continuation.resume(returning: nil)
                }
            }
        }
    }

    // MARK: - Snapshot Helpers

    /// 将 emoji 字符渲染为 UIImage（用于快照中 flagImage 的本地 fallback）
    private static func createEmojiImage(_ emoji: String, size: CGFloat) -> UIImage? {
        let renderer = UIGraphicsImageRenderer(size: CGSize(width: size, height: size))
        return renderer.image { _ in
            let fontSize = size * 0.75
            let attributes: [NSAttributedString.Key: Any] = [
                .font: UIFont.systemFont(ofSize: fontSize)
            ]
            let nsEmoji = NSString(string: emoji)
            let emojiSize = nsEmoji.size(withAttributes: attributes)
            let rect = CGRect(
                x: (size - emojiSize.width) / 2,
                y: (size - emojiSize.height) / 2,
                width: emojiSize.width,
                height: emojiSize.height
            )
            nsEmoji.draw(in: rect, withAttributes: attributes)
        }
    }

    // MARK: - Private Methods

    /// 预加载sprite图像到MapLibre（用于用户头像等复杂图案）
    private func preloadSpriteFromURL(_ urlString: String, patternId: String) async {
        Logger.debug("🖼️ Preloading sprite from URL: \(urlString) for pattern: \(patternId)")

        // 检查sprite是否已经加载
        guard let style = mapView?.style else {
            Logger.warning("⚠️ Cannot preload sprite: MapView style not available")
            return
        }

        // 如果已经存在，不需要重新加载
        if style.image(forName: patternId) != nil {
            Logger.debug("✅ Sprite already loaded: \(patternId)")
            return
        }

        // 下载sprite图像
        guard let url = URL(string: urlString) else {
            Logger.error("❌ Invalid sprite URL: \(urlString)")
            return
        }

        do {
            let (data, response) = try await URLSession.shared.data(from: url)

            // 验证HTTP响应
            if let httpResponse = response as? HTTPURLResponse {
                guard (200...299).contains(httpResponse.statusCode) else {
                    Logger.error("❌ Failed to download sprite: HTTP \(httpResponse.statusCode)")
                    return
                }
            }

            // 创建UIImage
            guard let image = UIImage(data: data) else {
                Logger.error("❌ Failed to create image from downloaded data")
                return
            }

            // 添加到MapLibre style
            await MainActor.run {
                style.setImage(image, forName: patternId)
                Logger.info("✅ Sprite preloaded successfully: \(patternId)")
            }

        } catch {
            Logger.error("❌ Failed to preload sprite: \(error.localizedDescription)")
        }
    }

    private func handleLocationUpdate(_ location: CLLocation) {
        // 如果正在运行随机测试，忽略系统层面的位置更新，防止双重数据源导致请求风暴
        if isRunningRandomTest { return }

        guard isGPSDrawingMode else { return }

        // 🛡️ 性能优化：过滤精度过低的点（避免GPS漂移导致乱画）
        // 精度 > 40米 视为不可靠
        if location.horizontalAccuracy < 0 || location.horizontalAccuracy > 40 {
             Logger.debug("Skipping GPS update: Poor accuracy (\(location.horizontalAccuracy)m)")
             return
        }

        let coordinate = location.coordinate
        currentCoordinate = coordinate

        // 🆕 提取并转换GPS速度（m/s -> km/h），用于Live Activity动态图标
        // location.speed在无效时会返回负值，需要过滤
        if location.speed >= 0 {
            currentSpeedKmH = location.speed * 3.6  // 1 m/s = 3.6 km/h
        } else {
            currentSpeedKmH = 0.0
        }

        Logger.info("🎯 [Real GPS] Received location: \(coordinate.latitude), \(coordinate.longitude), accuracy: \(location.horizontalAccuracy)m, speed: \(String(format: "%.1f", currentSpeedKmH)) km/h")

        // 🆕 GPS绘制模式下，使用导航风格的地图跟随（根据速度动态调整缩放）
        MapController.shared.updateForGPSFollowing(location: location)

        // 🔧 FIX: GPS模式下检测赛事区域，以便实时更新赛事贡献
        EventManager.shared.checkGeofence(location: coordinate)

        // 检查是否达到最小绘制距离
        if let lastCoord = lastDrawnCoordinate {
            let distance = calculateDistance(from: lastCoord, to: coordinate)
            if distance < minimumDistance {
                return
            }
        }

        // 🔧 Fix: 立即更新 lastDrawnCoordinate，防止后续 GPS 更新在 API 响应前
        // 对同一个旧坐标做距离比较，导致过多位置通过距离检查并入队
        lastDrawnCoordinate = coordinate

        // 加入绘制队列（串行处理，避免并发请求风暴）
        drawingQueue.append((coordinate, Date()))
        processNextInQueue()
    }
    
    /// 处理队列中的下一个点
    private func processNextInQueue() {
        // 如果正在绘制，或队列为空，则等待
        guard !isDrawing, !drawingQueue.isEmpty else { return }

        // 检查是否有点数
        guard pixelDrawService.canDraw else {
            // 如果没点数了，清空队列防止堆积？或者保留等待恢复？
            // 暂时由于无法绘制，直接返回。等待下一次触发。
             if !drawingQueue.isEmpty {
                 Logger.debug("🎨 GPS绘制：跳过处理队列，因无法绘制 (canDraw=false). 队列长度: \(drawingQueue.count)")
             }
            return
        }

        guard let first = drawingQueue.first else { return }
        drawingQueue.removeFirst()
        let coordinate = first.0

        // 🔧 Fix: 在创建 Task 之前同步设置 isDrawing = true
        // 防止在 Task 启动前又有新的 processNextInQueue 调用导致并发绘制
        isDrawing = true

        Task {
            await drawPixelAtLocation(coordinate)
        }
    }

    private func drawPixelAtLocation(_ coordinate: CLLocationCoordinate2D) async {
        // 检查是否可以绘制（从PixelDrawService获取最新状态）
        guard pixelDrawService.canDraw else {
            Logger.warning("GPS绘制：当前无法绘制（\(isFrozen ? "冻结中" : "点数不足")）")
            errorMessage = isFrozen ? "绘制冷却中" : "绘制点数不足"
            isDrawing = false
            processNextInQueue()
            return
        }

        // isDrawing 已在 processNextInQueue 中设置为 true
        errorMessage = nil

        do {
            let zoom = 15 // GPS绘制使用固定zoom级别
            let snappedCoordinate = drawingService.snapToGrid(coordinate: coordinate, zoom: zoom)

            // 🔧 Fix: 在调用API之前，使用本地计算的gridId检查是否已绘制过
            // 避免对同一个网格重复调用API消耗像素点数
            let gridSize = 0.0001
            let gridX = Int(floor((snappedCoordinate.longitude + 180.0) / gridSize))
            let gridY = Int(floor((snappedCoordinate.latitude + 90.0) / gridSize))
            let expectedGridId = "grid_\(gridX)_\(gridY)"

            if drawnGridIds.contains(expectedGridId) {
                Logger.debug("🎨 GPS绘制：跳过重复网格 \(expectedGridId)")
                isDrawing = false
                processNextInQueue()
                return
            }

            Logger.info("🎯 [GPS Draw] Original coordinate: \(coordinate.latitude), \(coordinate.longitude)")
            Logger.info("🎯 [GPS Draw] Snapped coordinate: \(snappedCoordinate.latitude), \(snappedCoordinate.longitude)")

            // 使用联盟旗帜图案进行绘制
            let (type, color, emoji, patternId) = patternProvider.getDrawingParameters()

            // 获取当前图案用于预览
            let currentPattern = patternProvider.currentDrawingPattern
            Logger.debug("🎨 [Debug] currentPattern: \(currentPattern?.type.rawValue ?? "nil"), color: \(currentPattern?.color ?? "nil"), emoji: \(currentPattern?.emoji ?? "nil")")

            // 立即在地图上显示预览（乐观更新）
            if let pattern = currentPattern {
                if mapView == nil { Logger.warning("⚠️ [Debug] mapView is nil during preview attempt") }
                await MainActor.run {
                    addPixelPreview(at: snappedCoordinate, pattern: pattern)
                }
            } else {
                 Logger.warning("⚠️ [Debug] currentPattern is nil, skipping addPixelPreview")
            }

            // 异步调用后端API，使用GPS模式
            // 使用后端会话ID，确保像素关联到正确的会话
            let sessionId = drawingState.backendSessionId ?? drawingState.currentSessionId
            Logger.info("[TRACKER] 3. Sending Pixel Request: Lat=\(snappedCoordinate.latitude), Lng=\(snappedCoordinate.longitude), AllianceID=\(currentAllianceId?.description ?? "nil"), PatternID=\(patternId ?? "nil")")

            // 4. 调用API
            let response = try await drawingService.drawPixel(
                latitude: snappedCoordinate.latitude,
                longitude: snappedCoordinate.longitude,
                type: type,
                color: color,
                emoji: emoji,
                patternId: patternId,
                sessionId: sessionId,
                allianceId: currentAllianceId, // 🆕 Pass alliance_id explicitly
                drawMode: .gps
            )

            if response.success, let pixel = response.data?.pixel {
                // 仅当网格ID从未被绘制过时，才计入统计
                // 这与后端活动榜单的统计逻辑一致（统计独立网格数）
                let gridId = pixel.gridId ?? ""
                if !drawnGridIds.contains(gridId) {
                    drawnPixelsCount += 1
                    drawnGridIds.insert(gridId)
                    // ✅ 仅统计独立网格
                    drawingState.recordGPSDrawnPixel()

                    // ✅ 累加绘制距离
                    if let prevCoord = lastSuccessfulDrawnCoordinate {
                        let distance = calculateDistance(from: prevCoord, to: snappedCoordinate)
                        drawingState.focusModeDistance += distance
                    }
                    lastSuccessfulDrawnCoordinate = snappedCoordinate
                }

                if let consumptionResult = response.data?.consumptionResult {
                    // 更新本地状态以反映API返回的最新值
                    await updatePixelStateFromConsumption(consumptionResult)
                }
                
                // 保存最后绘制的像素信息
                // 优先使用本地联盟颜色（color），后端可能因 pattern_assets/alliance 表字段缺失返回 #000000
                let pixelInfo = DrawnPixelInfo(
                    id: pixel.id,
                    gridId: pixel.gridId ?? "",
                    latitude: pixel.latitude,
                    longitude: pixel.longitude,
                    color: color ?? pixel.color,
                    emoji: emoji,        // Use local variable
                    type: type.rawValue, // Use local variable
                    patternId: patternId ?? pixel.patternId,
                    timestamp: Date()
                )
                lastDrawnPixel = pixelInfo
                currentSessionPixels.append(pixelInfo) // 记录真实像素信息

                // 🆕 更新 Live Activity（灵动岛 + 锁屏）
                LiveActivityManager.shared.updateGPSDrawingActivity(
                    pixelsDrawn: drawnPixelsCount,
                    remainingPoints: remainingPoints,
                    isFrozen: isFrozen,
                    freezeSecondsLeft: freezeTimeLeft,
                    currentSpeed: currentSpeedKmH
                )

                Logger.info("🎨 GPS绘制成功 (\(drawnPixelsCount)): 剩余 \(remainingPoints) 点")

                // ⚡ 播放绘制音效 + 触觉反馈
                SoundManager.shared.playPixelDraw()
                HapticManager.shared.impact(style: .light)

                // 🆕 Handle new achievements from backend
                if let newAchievements = response.data?.newAchievements, !newAchievements.isEmpty {
                    Logger.info("🏆 GPS绘制解锁了 \(newAchievements.count) 个成就")
                    for newAchievement in newAchievements {
                        // 转换为完整的Achievement对象并发送通知
                        let achievement = AchievementService.Achievement(
                            id: newAchievement.id,
                            key: newAchievement.key,
                            name: newAchievement.name,
                            description: newAchievement.description,
                            iconUrl: newAchievement.iconUrl,
                            rewardPoints: newAchievement.rewardPoints,
                            type: "drawing",
                            requirement: nil,
                            repeatCycle: nil,
                            category: newAchievement.category,
                            displayPriority: nil,
                            isActive: true,
                            metadata: nil,
                            rewardItems: nil,
                            rewardDetails: nil,
                            createdAt: nil,
                            updatedAt: nil
                        )

                        NotificationCenter.default.post(
                            name: .achievementUnlocked,
                            object: achievement
                        )
                        Logger.info("🏆 发送成就解锁通知: \(achievement.name) (+\(achievement.rewardPoints) 点)")
                    }
                }

                // 触觉反馈
                #if os(iOS) && !targetEnvironment(simulator)
                let generator = UIImpactFeedbackGenerator(style: .light)
                generator.impactOccurred()
                #endif

                // 发送通知更新地图（优先使用本地联盟颜色/图案）
                let userInfo: [String: Any] = [
                    "pixelId": pixel.id,
                    "latitude": pixel.latitude,
                    "longitude": pixel.longitude,
                    "color": color ?? pixel.color ?? "",
                    "patternId": patternId ?? pixel.patternId ?? "",
                    "emoji": emoji ?? "",
                    "type": type.rawValue,
                    "payload": currentPattern?.payload ?? "",
                    "imageUrl": pixel.imageUrl ?? currentPattern?.imageUrl ?? ""  // 用户头像 URL（API返回优先，本地 pattern 兜底）
                ]
                Logger.info("📢 [GPSDrawingService] Posting .gpsPixelDidDraw with userInfo: \(userInfo)")
                NotificationCenter.default.post(
                    name: .gpsPixelDidDraw,
                    object: nil,
                    userInfo: userInfo
                )

                // 🔧 FIX: 如果在赛事区域内绘制，同步更新赛事贡献
                if let eventId = EventManager.shared.currentWarEvent?.id {
                    Logger.info("⚔️ GPS绘制在赛事区域内，更新赛事贡献: \(eventId)")
                    EventManager.shared.onPixelDrawnInEvent(eventId: eventId)
                }
            } else {
                // API返回失败，记录错误
                errorMessage = response.error ?? "绘制失败"
                Logger.error("GPS绘制API返回失败: \(errorMessage ?? "Unknown error")")
            }
        } catch {
            errorMessage = error.localizedDescription
            Logger.error("GPS绘制异常: \(error.localizedDescription)")

            // 同步最新状态（可能点数已变化）
            try? await pixelDrawService.refresh()

            // 移除预览显示（因为绘制失败）
            // TODO: 实现预览移除逻辑
        }

        // 统一重置绘制状态（确保所有路径都会执行）
        isDrawing = false

        // 增加 100ms 的防抖延迟，防止请求风暴触发后端限流 (429)
        // 特别是在网络恢复或队列积压时，这能将最大频率锁定在 ~10次/秒
        try? await Task.sleep(nanoseconds: 100_000_000)

        // 处理队列下一个
        processNextInQueue()
    }

    /// 从消耗结果更新像素状态
    private func updatePixelStateFromConsumption(_ result: DrawingService.DrawPixelResponse.ResponseData.ConsumptionResult) async {
        // 更新PixelDrawService的状态
        pixelDrawService.itemPoints = result.itemPoints
        pixelDrawService.naturalPoints = result.naturalPoints
        pixelDrawService.freezeUntil = result.freezeUntil
        pixelDrawService.canDraw = !result.isFrozen
        pixelDrawService.isFrozen = result.isFrozen
        pixelDrawService.lastUpdateTime = Date()

        Logger.debug("📊 Pixel state updated: \(result.remainingPoints) remaining, frozen: \(result.isFrozen)")
    }

    private func calculateDistance(from: CLLocationCoordinate2D, to: CLLocationCoordinate2D) -> Double {
        let fromLoc = CLLocation(latitude: from.latitude, longitude: from.longitude)
        let toLoc = CLLocation(latitude: to.latitude, longitude: to.longitude)
        return fromLoc.distance(from: toLoc)
    }

    // MARK: - Background Lifecycle

    /// App 进入后台时调用
    func handleAppDidEnterBackground() {
        guard isGPSDrawingMode else { return }
        isInBackground = true

        // 1. 申请后台执行时间（保护正在进行的像素提交完成）
        backgroundTaskID = UIApplication.shared.beginBackgroundTask(
            withName: "GPSDrawingPixelSubmit"
        ) { [weak self] in
            // 过期回调：清理
            self?.endBackgroundTaskIfNeeded()
        }

        // 2. 后台增大距离过滤以减少回调频率（省电）
        locationManager.setBackgroundDistanceFilter(true)

        // 3. 暂停 heading 更新（后台无意义，省电）
        locationManager.stopHeadingUpdates()

        Logger.info("🔄 GPS Drawing 进入后台模式（后台任务已申请，距离过滤增至 8m）")
    }

    /// App 回到前台时调用
    func handleAppWillEnterForeground() {
        guard isGPSDrawingMode else { return }
        isInBackground = false

        // 1. 结束后台任务
        endBackgroundTaskIfNeeded()

        // 2. 恢复前台距离过滤
        locationManager.setBackgroundDistanceFilter(false)

        // 3. 恢复 heading 更新
        locationManager.startHeadingUpdates()

        // 4. 同步服务器状态（后台期间可能有状态变化）
        Task {
            try? await pixelDrawService.refresh()

            // 更新 Live Activity 为最新状态
            LiveActivityManager.shared.updateGPSDrawingActivity(
                pixelsDrawn: drawnPixelsCount,
                remainingPoints: remainingPoints,
                isFrozen: isFrozen,
                freezeSecondsLeft: freezeTimeLeft,
                currentSpeed: currentSpeedKmH
            )
        }

        Logger.info("🔄 GPS Drawing 回到前台模式（距离过滤恢复 5m，状态同步中）")
    }

    /// 安全结束后台任务
    private func endBackgroundTaskIfNeeded() {
        if backgroundTaskID != .invalid {
            UIApplication.shared.endBackgroundTask(backgroundTaskID)
            backgroundTaskID = .invalid
        }
    }

    // MARK: - Errors

    enum GPSError: LocalizedError {
        case notAuthenticated
        case locationNotAuthorized
        case locationUnavailable

        var errorDescription: String? {
            switch self {
            case .notAuthenticated:
                return "请先登录"
            case .locationNotAuthorized:
                return "请授权位置访问"
            case .locationUnavailable:
                return "无法获取当前位置"
            }
        }
    }
}

// MARK: - Supporting Types

/// 已绘制的像素信息
struct DrawnPixelInfo {
    let id: String
    let gridId: String
    let latitude: Double
    let longitude: Double
    let color: String?
    let emoji: String?
    let type: String?
    let patternId: String?
    let timestamp: Date
}

// MARK: - Notifications

extension Notification.Name {
    /// GPS绘制了新像素
    static let gpsPixelDidDraw = Notification.Name("gpsPixelDidDraw")
    /// 像素更新（来自WebSocket）
    static let pixelDidUpdate = Notification.Name("pixelDidUpdate")
}

// MARK: - UIColor Extensions

extension UIColor {
    convenience init?(hex: String) {
        var hexSanitized = hex.trimmingCharacters(in: .whitespacesAndNewlines)
        hexSanitized = hexSanitized.replacingOccurrences(of: "#", with: "")

        var rgb: UInt64 = 0
        guard Scanner(string: hexSanitized).scanHexInt64(&rgb) else { return nil }

        let red = CGFloat((rgb & 0xFF0000) >> 16) / 255.0
        let green = CGFloat((rgb & 0x00FF00) >> 8) / 255.0
        let blue = CGFloat(rgb & 0x0000FF) / 255.0

        self.init(red: red, green: green, blue: blue, alpha: 1.0)
    }

    var hexString: String {
        var red: CGFloat = 0
        var green: CGFloat = 0
        var blue: CGFloat = 0
        var alpha: CGFloat = 0

        getRed(&red, green: &green, blue: &blue, alpha: &alpha)

        let rgb: Int = (Int)(red * 255) << 16 | (Int)(green * 255) << 8 | (Int)(blue * 255) << 0
        return String(format: "#%06x", rgb)
    }
}
