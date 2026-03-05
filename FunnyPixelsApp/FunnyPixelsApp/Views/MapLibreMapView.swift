import SwiftUI
#if canImport(MapLibre)
import MapLibre
#endif
#if canImport(MapKit)
import MapKit
#endif

/// MapLibre GL 地图视图
/// 使用 MapLibre Native 渲染地图和 MVT 瓦片
/// 在 macOS 上回退到 MapKit
///
/// 这是一个纯地图组件，UI 控件由 MainMapView 管理
public struct MapLibreMapView: View {
    @EnvironmentObject var authViewModel: AuthViewModel
    @StateObject private var drawingState = DrawingStateManager.shared
    @StateObject private var patternProvider = AllianceDrawingPatternProvider.shared
    @StateObject private var eventManager = EventManager.shared
    @StateObject private var driftBottleManager = DriftBottleManager.shared
    @ObservedObject private var locationManager = LocationManager.shared
    @State private var selectedPixel: Pixel?
    @State private var mapViewRef: MLNMapView?

    public init() {}

    public var body: some View {
        ZStack {
            #if canImport(MapLibre)
            // MapLibre 地图 (iOS)
            MapLibreMapWrapper(
                locationManager: locationManager,
                drawingState: drawingState,
                patternProvider: patternProvider,
                onMapViewCreated: { mapView in
                    DispatchQueue.main.async {
                        self.mapViewRef = mapView
                        // 共享地图引用给 MapController
                        MapController.shared.setMapView(mapView)
                    }
                },
                onPixelTapped: { pixel in
                    handlePixelTapped(pixel)
                },
                onPixelDraw: { coordinate, pattern in
                    handlePixelDraw(at: coordinate, pattern: pattern)
                },
                onMapPanned: { isPanned in
                    // Update state in MainMapView to show/hide recenter button
                    NotificationCenter.default.post(name: .mapTrackingStateChanged, object: isPanned)
                },
                activeEvents: eventManager.activeEvents
            )
            .edgesIgnoringSafeArea(.all)
            .onChange(of: drawingState.isDrawingMode) { oldValue, newValue in
                Logger.debug("🔄 Drawing state changed: \(oldValue) -> \(newValue)")
                // 这里只需要记录状态变化，MapLibrePixelDrawingManager.isDrawingMode 会自动读取 DrawingStateManager.shared.isDrawingMode
            }
            .onChange(of: drawingState.currentMode) { oldValue, newValue in
                Logger.debug("🔄 Drawing mode changed: \(oldValue.rawValue) -> \(newValue.rawValue)")
            }
            #elseif canImport(MapKit)
            // MapKit 地图 (回退)
            SimpleMapView()
                .edgesIgnoringSafeArea(.all)
            #else
            Text(NSLocalizedString("map.unavailable_platform", comment: ""))
                .foregroundStyle(.secondary)
            #endif

            // Pixel Animations Overlay
            ForEach(pixelAnimations) { anim in
                 if let mapView = mapViewRef {
                     let point = mapView.convert(anim.coordinate, toPointTo: mapView)
                     PixelAnimationView(animation: anim, point: point)
                         .id(anim.id)
                 }
            }

            // Selection Highlight Overlay
            if let pixel = selectedPixel, let mapView = mapViewRef {
                let point = mapView.convert(pixel.coordinate, toPointTo: mapView)
                let color = Color(hex: pixel.color)
                SelectionHighlightView(point: point, color: color)
            }

            // 像素详情卡片已替换为 InteractivePixelBottomSheet (.sheet)
        }
        .sheet(item: $selectedPixel) { pixel in
            InteractivePixelBottomSheet(
                pixel: pixel,
                onClose: {
                    selectedPixel = nil
                }
            )
        }
    }

    // MARK: - Handlers

    @State private var pixelAnimations: [PixelAnimation] = []

    // MARK: - Handlers

    private func handlePixelTapped(_ pixel: Pixel) {
        withAnimation(.spring()) {
            selectedPixel = pixel
        }
        Logger.userAction("pixel_tapped", details: ["pixel_id": pixel.id])
    }

    /// 处理像素绘制
    private func handlePixelDraw(at coordinate: CLLocationCoordinate2D, pattern: DrawingPattern) {
        Task {
            guard drawingState.isDrawingMode else {
                Logger.warning("绘制未激活，跳过像素绘制")
                return
            }

            // ⚠️ GPS模式下禁止手动绘制
            if drawingState.currentMode == .gps {
                Logger.info("⚠️ GPS模式下禁止手动绘制")
                // 这里可以添加 UI 反馈，例如 toast
                return
            }

            // 获取绘制参数
            let (type, color, emoji, patternId) = patternProvider.getDrawingParameters()

            // 立即触发反馈 (乐观UI)
            triggerFeedback(pattern: pattern)
            triggerAnimation(at: coordinate, pattern: pattern)

            // 调用绘制服务
            let drawingService = DrawingService.shared
            do {
                let response = try await drawingService.drawPixel(
                    latitude: coordinate.latitude,
                    longitude: coordinate.longitude,
                    type: type,
                    color: color,
                    emoji: emoji,
                    patternId: patternId,
                    sessionId: drawingState.currentSessionId
                )

                if response.success, let pixel = response.data?.pixel {
                    Logger.info("✅ 像素绘制成功: \(pixel.id)")
                    drawingState.recordDrawnPixel()
                    // 再次确认成功反馈 (可选，防止乐观失败)

                    // 🆕 Handle new achievements from backend
                    if let newAchievements = response.data?.newAchievements, !newAchievements.isEmpty {
                        Logger.info("🏆 手动绘制解锁了 \(newAchievements.count) 个成就")
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
                } else {
                    Logger.error("❌ 像素绘制失败: \(response.error ?? "Unknown error")")
                    SoundManager.shared.playFailure()
                }
            } catch {
                Logger.error("❌ 像素绘制异常: \(error.localizedDescription)")
                SoundManager.shared.playFailure()
            }
        }
    }
    
    private func triggerFeedback(pattern: DrawingPattern? = nil) {
        // Sound - ⚡ 使用高性能音效播放
        SoundManager.shared.playPixelDraw()
        
        // Haptics
        #if os(iOS) && !targetEnvironment(simulator)
        if let pattern = pattern {
            switch pattern.type {
            case .emoji:
                // Emoji uses a softer or more "successful" notification feel
                let generator = UINotificationFeedbackGenerator()
                generator.notificationOccurred(.success)
            case .color:
                // Color uses a standard medium impact
                let generator = UIImpactFeedbackGenerator(style: .medium)
                generator.impactOccurred()
            case .complex:
                // Complex patterns use heavy impact for "weight"
                let generator = UIImpactFeedbackGenerator(style: .heavy)
                generator.impactOccurred()
            default:
                let generator = UIImpactFeedbackGenerator(style: .light)
                generator.impactOccurred()
            }
        } else {
            let generator = UIImpactFeedbackGenerator(style: .light)
            generator.impactOccurred()
        }
        #endif
    }
    
    private func triggerAnimation(at coordinate: CLLocationCoordinate2D, pattern: DrawingPattern) {
        let anim = PixelAnimation(coordinate: coordinate, pattern: pattern)
        withAnimation {
            pixelAnimations.append(anim)
        }
        
        // Remove after 1s
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
            withAnimation {
                pixelAnimations.removeAll { $0.id == anim.id }
            }
        }
    }
}

// 选中高亮视图 (Pulsing Selection)
struct SelectionHighlightView: View {
    @ObservedObject private var fontManager = FontSizeManager.shared
    let point: CGPoint
    let color: Color?
    
    @State private var isPulsing = false
    
    var body: some View {
        ZStack {
            // Shadow Circle (Floating look)
            Circle()
                .fill(.black.opacity(0.15))
                .frame(width: 44, height: 44)
                .blur(radius: 6)
                .offset(y: 4)
            
            // Outer Pulse
            Circle()
                .stroke(color ?? .blue, lineWidth: 2)
                .frame(width: isPulsing ? 54 : 34, height: isPulsing ? 54 : 34)
                .opacity(isPulsing ? 0 : 0.8)
            
            // Inner Core
            Circle()
                .fill(color ?? .blue)
                .frame(width: 22, height: 22)
                .overlay(Circle().stroke(.white, lineWidth: 2.5))
                .shadow(color: .black.opacity(0.2), radius: 3, y: 2)
        }
        .position(x: point.x, y: point.y)
        .onAppear {
            withAnimation(.easeInOut(duration: 1.2).repeatForever(autoreverses: false)) {
                isPulsing = true
            }
        }
    }
}

// 动画模型
struct PixelAnimation: Identifiable {
    let id = UUID()
    let coordinate: CLLocationCoordinate2D
    let pattern: DrawingPattern
    var startTime: Date = Date()
}

// 动画视图
struct PixelAnimationView: View {
    let animation: PixelAnimation
    let point: CGPoint
    
    @State private var scale: CGFloat = 0.1
    @State private var opacity: Double = 1.0
    
    var body: some View {
        Group {
            if let emoji = animation.pattern.emoji {
                Text(emoji)
                    .font(.system(size: 32))
            } else {
                Rectangle()
                    .fill(Color(hex: animation.pattern.color ?? "#4ECDC4") ?? Color(hex: "#4ECDC4")!)
                    .frame(width: 32, height: 32)
            }
        }
        .position(x: point.x, y: point.y)
        .scaleEffect(scale)
        .opacity(opacity)
        .onAppear {
            withAnimation(.spring(response: 0.3, dampingFraction: 0.6)) {
                scale = 1.2
            }
            withAnimation(.easeOut(duration: 0.5).delay(0.5)) {
                opacity = 0
                scale = 1.5
            }
        }
    }
}

// MARK: - MapLibre Map Wrapper (仅 iOS)

#if canImport(MapLibre)

import UIKit

/// MapLibre 地图包装器
@MainActor
struct MapLibreMapWrapper: UIViewRepresentable {
    let locationManager: LocationManager
    let drawingState: DrawingStateManager
    let patternProvider: AllianceDrawingPatternProvider
    let onMapViewCreated: (MLNMapView) -> Void
    let onPixelTapped: (Pixel) -> Void
    let onPixelDraw: ((CLLocationCoordinate2D, DrawingPattern) -> Void)?
    var onMapPanned: ((Bool) -> Void)? = nil // Notify parent when map is panned/detached

    

    // Active Events for War Layer
    var activeEvents: [EventService.Event]

    func makeUIView(context: Context) -> MLNMapView {
        let mapView = MLNMapView()
        mapView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        mapView.delegate = context.coordinator
        mapView.logoView.isHidden = true
        mapView.attributionButton.isHidden = true

        // 🔧 Set minimum frame size to prevent CAMetalLayer warnings
        // This prevents "invalid setDrawableSize width=0 height=0" errors
        if mapView.frame.size.width == 0 || mapView.frame.size.height == 0 {
            mapView.frame = CGRect(x: 0, y: 0, width: 100, height: 100)
        }

        // 确保地图可见
        mapView.backgroundColor = .white
        mapView.isZoomEnabled = true
        mapView.isScrollEnabled = true
        mapView.isRotateEnabled = true
        mapView.isPitchEnabled = true

        // 🔧 限制最大缩放级别为 18
        mapView.maximumZoomLevel = 18

        // 设置初始位置 (3-tier fallback)
        // 1. MapController cached viewport (user's last panned position+zoom)
        // 2. LocationManager GPS cache (last GPS position, zoom 12)
        // 3. Beijing default (zoom 12)
        let center: CLLocationCoordinate2D
        let zoomLevel: Double
        let restoreFromMapCache: Bool
        if let cachedCenter = MapController.shared.cachedCenter,
           let cachedZoom = MapController.shared.cachedZoomLevel {
            center = cachedCenter
            zoomLevel = cachedZoom
            restoreFromMapCache = true
            Logger.info("📍 [Map] 使用MapController缓存视口: \(cachedCenter.latitude), \(cachedCenter.longitude), zoom=\(cachedZoom)")
        } else if let cached = LocationManager.shared.cachedCoordinate {
            center = cached
            zoomLevel = 12
            restoreFromMapCache = false
            Logger.info("📍 [Map] 使用GPS缓存位置初始化: \(cached.latitude), \(cached.longitude)")
        } else {
            center = CLLocationCoordinate2D(latitude: 39.9042, longitude: 116.4074)
            zoomLevel = 12
            restoreFromMapCache = false
            Logger.info("📍 [Map] 无缓存位置，使用默认位置(北京)")
        }

        mapView.setCenter(center, zoomLevel: zoomLevel, animated: false)

        // 使用配置中的地图样式，如果加载失败会触发 delegate 中的 fallback 逻辑
        mapView.styleURL = URL(string: AppConfig.mapTileURL)

        // 创建交互管理器并存储到 coordinator
        let interactionManager = MapLibreInteractionManager(mapView: mapView)
        context.coordinator.interactionManager = interactionManager
        
        // 设置像素点击回调
        interactionManager.onPixelClicked { result in
            context.coordinator.handleInteractionPixelClick(result)
        }

        // 设置绘制像素回调
        if let onPixelDraw = onPixelDraw {
            interactionManager.onPixelDraw { coordinate, pattern in
                onPixelDraw(coordinate, pattern)
            }
        }

        // 设置用户交互监控（用于低功耗模式）
        context.coordinator.setupInteractionMonitoring(mapView: mapView)

        // 通知父视图地图已创建
        onMapViewCreated(mapView)

        // 请求位置权限并开始更新
        locationManager.requestAuthorization()

        // 设置位置更新回调
        // Enable native user location tracking
        mapView.showsUserLocation = true
        // If restoring a cached viewport, don't follow GPS (it would snap back to GPS position)
        mapView.userTrackingMode = restoreFromMapCache ? .none : .follow
        
        // Remove manual locationManager.onUpdate centering to avoid "Map Lock".
        // Native userTrackingMode handles "Pan to detach" automatically.
        // Coordinator handles "Auto-resume" after delay.

        return mapView
    }

    func updateUIView(_ mapView: MLNMapView, context: Context) {
        // 同步绘制状态到 drawingState.drawingState
        if drawingState.isDrawingMode {
            if context.coordinator.interactionManager?.drawing.drawingState == .idle {
                context.coordinator.interactionManager?.drawing.startDrawingMode()
            }
        } else {
            if context.coordinator.interactionManager?.drawing.drawingState != .idle {
                context.coordinator.interactionManager?.drawing.stopDrawingMode()
            }
        }
        
        // Update Event Layer
        Logger.debug("🔄 [Map] Updating event layer with \(activeEvents.count) events")
        context.coordinator.updateEventSource(with: activeEvents)

        // Update Bottle Markers
        if let style = mapView.style {
            context.coordinator.updateBottleMarkers(style: style, markers: DriftBottleManager.shared.mapMarkers)
        }
    }

    func makeCoordinator() -> Coordinator {
        Coordinator(onPixelTapped: onPixelTapped, onMapPanned: onMapPanned)
    }

    class Coordinator: NSObject, MLNMapViewDelegate {
        let onPixelTapped: (Pixel) -> Void
        let onMapPanned: ((Bool) -> Void)?
        private var renderer: HighPerformanceMVTRenderer?
        weak var mapView: MLNMapView?
        var interactionManager: MapLibreInteractionManager?
        private var subscribedTileIds: Set<String> = []
        private var heatmapLayerManager: MapHeatmapLayerManager?

        init(onPixelTapped: @escaping (Pixel) -> Void, onMapPanned: ((Bool) -> Void)?) {
            self.onPixelTapped = onPixelTapped
            self.onMapPanned = onMapPanned
        }
        
        
        /// Handle pixel click from InteractionManager
        func handleInteractionPixelClick(_ result: PixelClickResult) {
            // attributes logic handled inside parsePixelFromFeature now if needed, but we pass feature
            if let pixel = parsePixelFromFeature(result.feature) {
                Logger.info("🎯 Pixel tapped via InteractionManager: \(pixel.id)")
                onPixelTapped(pixel)
            }
        }

        // MARK: - User Interaction Monitoring (Low Power Mode)

        /// 设置用户交互监控（用于低功耗模式）
        func setupInteractionMonitoring(mapView: MLNMapView) {
            // 添加平移手势识别器
            let panGesture = UIPanGestureRecognizer(target: self, action: #selector(handleMapInteraction(_:)))
            panGesture.delegate = self

            // 添加缩放手势识别器
            let pinchGesture = UIPinchGestureRecognizer(target: self, action: #selector(handleMapInteraction(_:)))
            pinchGesture.delegate = self

            // 添加点击手势识别器
            let tapGesture = UITapGestureRecognizer(target: self, action: #selector(handleMapInteraction(_:)))
            tapGesture.delegate = self

            mapView.addGestureRecognizer(panGesture)
            mapView.addGestureRecognizer(pinchGesture)
            mapView.addGestureRecognizer(tapGesture)

            Logger.info("📊 User interaction monitoring setup complete")
        }

        /// 处理地图交互（记录到UserInteractionMonitor）
        @objc private func handleMapInteraction(_ gesture: UIGestureRecognizer) {
            if gesture.state == .began || gesture.state == .changed || gesture.state == .ended {
                Task { @MainActor in
                    UserInteractionMonitor.shared.recordInteraction()
                }
            }
        }

        /// Setup renderer and layers after style load
        private func setupRenderer(mapView: MLNMapView, style: MLNStyle) {
            if renderer != nil {
                Logger.info("🔄 [Map] Renderer already exists, skipping re-init")
                return
            }
            
            Logger.info("🎨 [Map] Initializing renderer for new style...")
            renderer = HighPerformanceMVTRenderer(mapView: mapView)
            GPSDrawingService.shared.setHighPerformanceRenderer(renderer)
            Task { @MainActor in
                await renderer?.setupHighPerformanceLayers(style: style)
                renderer?.logPerformanceMetrics()

                // ⚔️ 设置活动战场图层
                self.setupEventLayers(style: style)
                self.loadActiveEvents()

                // 🍾 设置漂流瓶标记图层
                self.setupBottleMarkersLayer(style: style)

                // 🔥 设置热力图图层（由 MapLayerSettings.showHeatmap 控制可见性）
                self.heatmapLayerManager = MapHeatmapLayerManager(mapView: mapView)
            }
        }
        

        // MARK: - Event War Layer Logic
        
        /// 设置活动战场图层（数据驱动样式）
        private func setupEventLayers(style: MLNStyle) {
            // Source
            let source = MLNShapeSource(identifier: "event-war-source", shape: nil, options: nil)
            style.addSource(source)

            // Fill Layer - 使用数据驱动样式区分不同状态
            let fillLayer = MLNFillStyleLayer(identifier: "event-war-fill", source: source)

            // 根据参与状态和距离设置颜色
            fillLayer.fillColor = NSExpression(format:
                "TERNARY(isParticipant == YES, %@, " +
                "TERNARY(isNearby == YES, %@, %@))",
                UIColor(red: 0.2, green: 0.6, blue: 1.0, alpha: 0.3),  // 参与：蓝色
                UIColor(red: 1.0, green: 0.6, blue: 0.0, alpha: 0.25), // 附近：橙色
                UIColor(red: 0.5, green: 0.5, blue: 0.5, alpha: 0.15)  // 其他：灰色
            )
            fillLayer.fillOpacity = NSExpression(forConstantValue: 1.0)

            // Line Layer - 边框样式（根据状态变化）
            let lineLayer = MLNLineStyleLayer(identifier: "event-war-outline", source: source)
            lineLayer.lineColor = NSExpression(format:
                "TERNARY(isParticipant == YES, %@, " +
                "TERNARY(isEndingSoon == YES, %@, %@))",
                UIColor.systemBlue,   // 参与：蓝色边框
                UIColor.systemRed,    // 即将结束：红色边框
                UIColor.systemGray    // 其他：灰色边框
            )
            lineLayer.lineWidth = NSExpression(format:
                "TERNARY(isParticipant == YES, 3.0, 2.0)"
            )

            // Symbol Layer - 活动名称标注
            let symbolLayer = MLNSymbolStyleLayer(identifier: "event-labels", source: source)
            symbolLayer.text = NSExpression(forKeyPath: "title")
            symbolLayer.textColor = NSExpression(forConstantValue: UIColor.white)
            symbolLayer.textFontSize = NSExpression(forConstantValue: 14)
            symbolLayer.textHaloColor = NSExpression(forConstantValue: UIColor.black)
            symbolLayer.textHaloWidth = NSExpression(forConstantValue: 1.5)
            symbolLayer.textAllowsOverlap = NSExpression(forConstantValue: false)

            // Insert layers below existing labels but above base map
            if let existingSymbolLayer = style.layers.first(where: { $0 is MLNSymbolStyleLayer }) {
                style.insertLayer(fillLayer, below: existingSymbolLayer)
                style.insertLayer(lineLayer, above: fillLayer)
                style.insertLayer(symbolLayer, above: lineLayer)
            } else {
                style.addLayer(fillLayer)
                style.addLayer(lineLayer)
                style.addLayer(symbolLayer)
            }
        }
        
        /// 加载并渲染活动区域
        private func loadActiveEvents() {
            // Observe EventManager changes or fetch once
            let eventManager = EventManager.shared
            
            // Subscribe to updates (using poll from EventManager)
            // Ideally we'd store a Combine cancellable, but for simplicity we fetch now and let EventManager poll trigger updates via @ObservedObject in View? 
            // Better: EventManager posts a notification or we explicitly call update from View's .onChange
            
            // For initial load:
            updateEventSource(with: eventManager.activeEvents)
        }
        
        /// Update Event Source from Event models
        /// Shows all active events with data-driven styling based on participation and proximity
        func updateEventSource(with events: [EventService.Event]) {
            guard let style = mapView?.style else { return }

            var features: [MLNPolygonFeature] = []

            // Get user's current location for proximity calculation
            let userLocation = mapView?.userLocation?.coordinate

            // Show ALL events (removed filter)
            Logger.info("🎯 [Map] Displaying all events: \(events.count) total")

            for event in events {
                guard let boundary = event.boundary, let firstRing = boundary.coordinates.first else { continue }

                // Convert [[Double]] to [CLLocationCoordinate2D]
                // GeoJSON is [lng, lat]
                let coords = firstRing.map { CLLocationCoordinate2D(latitude: $0[1], longitude: $0[0]) }

                let polygon = MLNPolygonFeature(coordinates: coords, count: UInt(coords.count))

                // Calculate time remaining
                let minutesRemaining = calculateMinutesRemaining(endTime: event.endTime)

                // Calculate proximity (isNearby: within 5km)
                var isNearby = false
                if let userLoc = userLocation {
                    // Calculate event center from boundary coordinates
                    let eventCenter = calculateCentroid(from: coords)
                    let distanceKm = calculateDistance(from: userLoc, to: eventCenter) / 1000.0
                    isNearby = distanceKm <= 5.0
                }

                polygon.attributes = [
                    "id": event.id,
                    "title": event.title,
                    "type": event.type,
                    "status": event.status,
                    "isEndingSoon": minutesRemaining <= 10 && minutesRemaining > 0,
                    "isParticipant": event.isParticipant,  // ✅ For blue styling
                    "isNearby": isNearby  // ✅ For orange styling
                ]
                features.append(polygon)
            }

            let shapeCollection = MLNShapeCollection(shapes: features)

            if let source = style.source(withIdentifier: "event-war-source") as? MLNShapeSource {
                if features.isEmpty {
                    Logger.info("🧹 [Map] Clearing event source (no active events)")
                    source.shape = nil
                } else {
                    let participantCount = events.filter { $0.isParticipant }.count
                    Logger.info("🖍️ [Map] Updating event source: \(features.count) total (\(participantCount) participating)")
                    source.shape = shapeCollection
                }
            } else {
                Logger.warning("❌ [Map] Event source not found when updating")
            }
        }

        private func calculateMinutesRemaining(endTime: String) -> Int {
            let isoFormatter = ISO8601DateFormatter()
            isoFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            guard let endDate = isoFormatter.date(from: endTime) else { return 999 }
            return Int(endDate.timeIntervalSinceNow / 60)
        }

        /// Calculate distance between two coordinates (in meters) using Haversine formula
        private func calculateDistance(from: CLLocationCoordinate2D, to: CLLocationCoordinate2D) -> Double {
            let earthRadius = 6371000.0 // meters

            let lat1 = from.latitude * .pi / 180
            let lat2 = to.latitude * .pi / 180
            let deltaLat = (to.latitude - from.latitude) * .pi / 180
            let deltaLng = (to.longitude - from.longitude) * .pi / 180

            let a = sin(deltaLat / 2) * sin(deltaLat / 2) +
                    cos(lat1) * cos(lat2) *
                    sin(deltaLng / 2) * sin(deltaLng / 2)
            let c = 2 * atan2(sqrt(a), sqrt(1 - a))

            return earthRadius * c
        }

        /// Calculate centroid (center point) of a polygon from its coordinates
        private func calculateCentroid(from coords: [CLLocationCoordinate2D]) -> CLLocationCoordinate2D {
            guard !coords.isEmpty else { return CLLocationCoordinate2D(latitude: 0, longitude: 0) }

            var totalLat = 0.0
            var totalLng = 0.0

            for coord in coords {
                totalLat += coord.latitude
                totalLng += coord.longitude
            }

            return CLLocationCoordinate2D(
                latitude: totalLat / Double(coords.count),
                longitude: totalLng / Double(coords.count)
            )
        }

        /// 🔍 设置缩放监听（使用delegate方法，在mapView(_:regionDidChangeAnimated:)中调用）
        private func setupZoomMonitoring(mapView: MLNMapView, style: MLNStyle) {
            Logger.info("📊 [Zoom Monitor] 缩放监听已启用 (使用MLNMapViewDelegate)")
        }

        /// 🔍 MLNMapViewDelegate: 地图区域变化后调用

        
        // MARK: - Auto-Resume Tracking Logic
        
        private var autoCenterTimer: Timer?
        
        func mapView(_ mapView: MLNMapView, regionWillChangeAnimated animated: Bool) {
            // User interaction or animation started -> Cancel auto-resume timer
            autoCenterTimer?.invalidate()
            autoCenterTimer = nil
        }
        
        func mapView(_ mapView: MLNMapView, regionDidChangeAnimated animated: Bool) {
            let zoom = mapView.zoomLevel
            MapController.shared.cacheViewport(center: mapView.centerCoordinate, zoomLevel: zoom)
            // Existing log logic
            if zoom >= 15.5 && zoom <= 18.5 {
                logEmojiLayerStatus(mapView: mapView, zoom: zoom)
            }

            // Update tile subscriptions for real-time pixel updates
            updateTileSubscriptions(mapView: mapView)

            // GPS Following Logic (Refactored to Manual Only)
            // If user panned, notify parent but DO NOT start auto-resume timer
            if mapView.userTrackingMode == .none {
                Logger.debug("🖐️ Map detached (user panning).")
                onMapPanned?(true)
            } else {
                onMapPanned?(false)
            }
            
            // 触感反馈 (Zoom Recoil): 当达到最大/最小缩放级别时提供反馈
            #if os(iOS) && !targetEnvironment(simulator)
            if zoom >= mapView.maximumZoomLevel - 0.01 || zoom <= mapView.minimumZoomLevel + 0.01 {
                let generator = UIImpactFeedbackGenerator(style: .soft)
                generator.impactOccurred(intensity: 0.5)
            }
            #endif

            // 🔥 通知热力图图层视口变化（2秒防抖后刷新数据）
            heatmapLayerManager?.onViewportChanged()

            // 🔧 扫描可视区域的 complex 像素，动态加载缺失的 sprite（如用户头像）
            if zoom >= 12 {
                renderer?.scanAndLoadMissingComplexSprites()
            }
        }

        func mapViewWillStartLoadingMap(_ mapView: MLNMapView) {
            Logger.info("🕒 [Map] Started loading map style: \(mapView.styleURL?.absoluteString ?? "unknown")")
        }

        func mapViewDidFinishLoadingMap(_ mapView: MLNMapView) {
            Logger.info("✅ [Map] Finished loading map components")
            // 🔧 延迟扫描：首次加载完成后等待瓦片渲染，再扫描缺失的 complex sprite
            DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) { [weak self] in
                self?.renderer?.scanAndLoadMissingComplexSprites()
            }
        }

        func mapViewDidStopLocatingUser(_ mapView: MLNMapView) {
            Logger.info("📍 [Map] Stopped locating user")
        }
        
        func mapView(_ mapView: MLNMapView, didFinishLoading style: MLNStyle) {
            Logger.info("📍 [Map] Style loaded successfully, initializing renderer...")
            self.mapView = mapView
            setupRenderer(mapView: mapView, style: style)
        }
        
        func mapViewDidFailLoadingMap(_ mapView: MLNMapView, withError error: Error) {
            Logger.error("❌ [Map] Failed to load style: \(error.localizedDescription)")
            
            // 如果主要样式加载失败，尝试使用备用样式
            let currentStyleURL = mapView.styleURL?.absoluteString
            if currentStyleURL == AppConfig.mapTileURL {
                Logger.warning("⚠️ [Map] Primary style failed, switching to fallback style: \(AppConfig.fallbackMapTileURL)")
                mapView.styleURL = URL(string: AppConfig.fallbackMapTileURL)
            } else if currentStyleURL == AppConfig.fallbackMapTileURL {
                Logger.error("🚫 [Map] Fallback style also failed. Map may be blank.")
            }
        }


        // 用于避免重复日志的静态变量


        /// 🔍 打印 emoji 图层在当前 zoom 的状态
        private func logEmojiLayerStatus(mapView: MLNMapView, zoom: Double) {
            Logger.info("📊 [Zoom Monitor] ═════════════════════════════════════════════════════")
            Logger.info("📊 [Zoom Monitor] Zoom Level: \(String(format: "%.2f", zoom)) | 有效范围: 12-18")
            Logger.info("📊 [Zoom Monitor] ═════════════════════════════════════════════════════")

            // 1. 检查是否在有效显示范围内
            let isInValidRange = zoom >= 12.0 && zoom <= 18.0
            Logger.info("📊 [Zoom] 当前zoom在有效范围(12-18)内: \(isInValidRange ? "✅ 是" : "❌ 否")")

            if zoom > 18.0 {
                Logger.warning("📊 [Zoom] ⚠️ 超过maxZoom(18)，MVT将使用zoom=18的瓦片进行overscaling")
            }

            // 2. 计算当前zoom对应的瓦片坐标
            let center = mapView.centerCoordinate
            let tileZ = min(Int(floor(zoom)), 18) // 瓦片zoom最大为18
            let n = pow(2.0, Double(tileZ))
            let tileX = Int(floor((center.longitude + 180.0) / 360.0 * n))
            let latRad = center.latitude * .pi / 180.0
            let tileY = Int(floor((1.0 - log(tan(latRad) + 1.0 / cos(latRad)) / .pi) / 2.0 * n))

            Logger.info("📊 [Tile] 当前瓦片坐标: z=\(tileZ), x=\(tileX), y=\(tileY)")

            // 3. 计算瓦片边界（Web Mercator -> WGS84）
            let tileBounds = calculateTileBounds(z: tileZ, x: tileX, y: tileY)
            Logger.info("📊 [Tile] 瓦片边界: west=\(String(format: "%.6f", tileBounds.west)), east=\(String(format: "%.6f", tileBounds.east))")
            Logger.info("📊 [Tile] 瓦片边界: south=\(String(format: "%.6f", tileBounds.south)), north=\(String(format: "%.6f", tileBounds.north))")

            // 4. 检查emoji图层
            guard let emojiLayer = mapView.style?.layer(withIdentifier: "pixels-emoji") as? MLNSymbolStyleLayer else {
                Logger.warning("📊 [Layer] ❌ emoji图层未找到!")
                return
            }

            Logger.info("📊 [Layer] emoji图层可见性: \(emojiLayer.isVisible ? "✅ 可见" : "❌ 隐藏")")

            // 5. iconScale 分析
            let expectedStops: [Double: Double] = [
                12: 0.0104, 13: 0.0208, 14: 0.0417, 15: 0.0833,
                16: 0.1667, 17: 0.3333, 18: 0.5
            ]
            let expectedScale = calculateExpectedScale(for: zoom, stops: expectedStops)
            let spriteSize: Double = 64.0 // sprite原始大小
            let expectedPixelSize = spriteSize * expectedScale

            Logger.info("📊 [iconScale] 预期值: \(String(format: "%.4f", expectedScale))")
            Logger.info("📊 [iconScale] 预期渲染尺寸: \(String(format: "%.1f", expectedPixelSize))px (sprite=64px × scale=\(String(format: "%.4f", expectedScale)))")

            // 6. iconScale表达式
            if let iconScaleExpr = emojiLayer.iconScale {
                Logger.info("📊 [iconScale] 表达式类型: \(type(of: iconScaleExpr))")
                Logger.info("📊 [iconScale] 表达式内容: \(iconScaleExpr)")
            } else {
                Logger.warning("📊 [iconScale] ❌ 表达式为nil!")
            }

            // 7. 碰撞检测设置
            let allowsOverlap = emojiLayer.iconAllowsOverlap
            let ignoresPlacement = emojiLayer.iconIgnoresPlacement
            Logger.info("📊 [Collision] iconAllowsOverlap: \(allowsOverlap?.description ?? "nil")")
            Logger.info("📊 [Collision] iconIgnoresPlacement: \(ignoresPlacement?.description ?? "nil")")

            // 8. 查询可见的emoji features数量
            let visibleRect = mapView.bounds
            let emojiFeatures = mapView.visibleFeatures(in: visibleRect, styleLayerIdentifiers: ["pixels-emoji"])
            let colorFeatures = mapView.visibleFeatures(in: visibleRect, styleLayerIdentifiers: ["pixels-color"])
            let complexFeatures = mapView.visibleFeatures(in: visibleRect, styleLayerIdentifiers: ["pixels-complex"])

            let hotpatchEmoji = mapView.visibleFeatures(in: visibleRect, styleLayerIdentifiers: ["pixels-emoji-hotpatch"])
            let hotpatchColor = mapView.visibleFeatures(in: visibleRect, styleLayerIdentifiers: ["pixels-color-hotpatch"])
            let hotpatchComplex = mapView.visibleFeatures(in: visibleRect, styleLayerIdentifiers: ["pixels-complex-hotpatch"])

            Logger.info("📊 [Features] 可见emoji像素数量: MVT=\(emojiFeatures.count), Hotpatch=\(hotpatchEmoji.count)")
            Logger.info("📊 [Features] 可见color像素数量: MVT=\(colorFeatures.count), Hotpatch=\(hotpatchColor.count)")
            Logger.info("📊 [Features] 可见complex像素数量: MVT=\(complexFeatures.count), Hotpatch=\(hotpatchComplex.count)")
            Logger.info("📊 [Features] 可见complex像素数量: MVT=\(complexFeatures.count), Hotpatch=\(hotpatchComplex.count)")
            
            let totalMVT = emojiFeatures.count + colorFeatures.count + complexFeatures.count
            let totalHotpatch = hotpatchEmoji.count + hotpatchColor.count + hotpatchComplex.count
            let totalVisible = totalMVT + totalHotpatch
            Logger.info("📊 [Features] 总可见像素数量: \(totalVisible) (MVT: \(totalMVT), Hotpatch: \(totalHotpatch))")

            // 9. 打印部分emoji features详情（最多5个）
            if !emojiFeatures.isEmpty {
                Logger.info("📊 [Features] emoji features样本 (最多5个):")
                for (index, feature) in emojiFeatures.prefix(5).enumerated() {
                    let attributes = feature.attributes
                    let emoji = attributes["emoji"] as? String ?? "?"
                    let gridId = attributes["grid_id"] as? String ?? "?"
                    Logger.info("   [\(index+1)] emoji=\(emoji), grid_id=\(gridId)")
                }
            } else {
                Logger.warning("📊 [Features] ⚠️ 当前视口内没有emoji像素!")
            }

            // 10. 视口信息
            let bounds = mapView.visibleCoordinateBounds
            Logger.info("📊 [Viewport] 视口中心: (\(String(format: "%.6f", center.latitude)), \(String(format: "%.6f", center.longitude)))")
            Logger.info("📊 [Viewport] 视口范围: SW(\(String(format: "%.4f", bounds.sw.latitude)), \(String(format: "%.4f", bounds.sw.longitude))) - NE(\(String(format: "%.4f", bounds.ne.latitude)), \(String(format: "%.4f", bounds.ne.longitude)))")

            // 11. MVT source状态
            if let source = mapView.style?.source(withIdentifier: "pixels-mvt") as? MLNVectorTileSource {
                Logger.info("📊 [Source] MVT source存在: ✅")
                Logger.info("📊 [Source] identifier: \(source.identifier)")
            } else {
                Logger.warning("📊 [Source] ❌ MVT source未找到!")
            }

            if let hotpatchSource = mapView.style?.source(withIdentifier: "pixels-hotpatch") {
                Logger.info("📊 [Source] Hotpatch source存在: ✅")
                Logger.info("📊 [Source] identifier: \(hotpatchSource.identifier)")
            } else {
                Logger.warning("📊 [Source] ❌ Hotpatch source未找到!")
            }

            Logger.info("📊 [Zoom Monitor] ═════════════════════════════════════════════════════")
        }

        /// 计算瓦片边界（WGS84坐标）
        private func calculateTileBounds(z: Int, x: Int, y: Int) -> (west: Double, east: Double, south: Double, north: Double) {
            let n = pow(2.0, Double(z))
            let west = Double(x) / n * 360.0 - 180.0
            let east = Double(x + 1) / n * 360.0 - 180.0
            let north = atan(sinh(.pi * (1.0 - 2.0 * Double(y) / n))) * 180.0 / .pi
            let south = atan(sinh(.pi * (1.0 - 2.0 * Double(y + 1) / n))) * 180.0 / .pi
            return (west, east, south, north)
        }

        /// 计算预期 iconScale 值（base-2 指数插值）
        private func calculateExpectedScale(for zoom: Double, stops: [Double: Double]) -> Double {
            let sortedKeys = stops.keys.sorted()

            // 找到插值范围
            guard let lowerKey = sortedKeys.last(where: { $0 <= zoom }),
                  let lowerValue = stops[lowerKey] else {
                // zoom 小于最小 key，使用最小值
                return stops.first?.value ?? 0.01
            }

            guard let maxKey = sortedKeys.last, zoom <= maxKey,
                  let upperKey = sortedKeys.first(where: { $0 > zoom }),
                  let _ = stops[upperKey] else {
                // zoom 大于等于最大 key，使用最大值
                return sortedKeys.last.flatMap { stops[$0] } ?? 0.5
            }

            // Base-2 指数插值: value = lowerValue * 2^(zoom - lowerKey)
            let scale = lowerValue * pow(2.0, zoom - lowerKey)
            return scale
        }

        // MARK: - Tile Subscription Logic

        /// 更新瓦片订阅（实现实时像素更新）
        private func updateTileSubscriptions(mapView: MLNMapView) {
            let zoom = mapView.zoomLevel

            // 只在有效缩放级别订阅 (12-18)
            guard zoom >= 12.0 && zoom <= 18.0 else {
                return
            }

            // 计算当前可见区域的瓦片
            let visibleTileIds = calculateVisibleTileIds(mapView: mapView, zoom: Int(floor(zoom)))

            // 更新订阅（SocketIOManager 会自动处理新增和取消订阅）
            Task {
                await SocketIOManager.shared.updateTileSubscriptions(visibleTileIds)
            }

            Logger.debug("📡 [Tile Subscription] Visible tiles: \(visibleTileIds.count), zoom: \(String(format: "%.1f", zoom))")
        }

        /// 计算当前可见区域的瓦片ID列表
        private func calculateVisibleTileIds(mapView: MLNMapView, zoom: Int) -> Set<String> {
            let bounds = mapView.visibleCoordinateBounds
            let n = pow(2.0, Double(zoom))

            // 计算瓦片范围
            let minX = Int(floor((bounds.sw.longitude + 180.0) / 360.0 * n))
            let maxX = Int(floor((bounds.ne.longitude + 180.0) / 360.0 * n))

            let latRadSouth = bounds.sw.latitude * .pi / 180.0
            let maxY = Int(floor((1.0 - log(tan(latRadSouth) + 1.0 / cos(latRadSouth)) / .pi) / 2.0 * n))

            let latRadNorth = bounds.ne.latitude * .pi / 180.0
            let minY = Int(floor((1.0 - log(tan(latRadNorth) + 1.0 / cos(latRadNorth)) / .pi) / 2.0 * n))

            // 生成瓦片ID集合（格式: "z/x/y"）
            var tileIds: Set<String> = []
            for x in minX...maxX {
                for y in minY...maxY {
                    let tileId = "\(zoom)/\(x)/\(y)"
                    tileIds.insert(tileId)
                }
            }

            return tileIds
        }

        func mapView(_ mapView: MLNMapView, didTapAt coordinate: CLLocationCoordinate2D) {
            // Query pixel at tap location
            let point = mapView.convert(coordinate, toPointTo: mapView)
            queryAndHandlePixel(at: point, mapView: mapView)
        }

        /// Query pixel at point and handle tap
        private func queryAndHandlePixel(at point: CGPoint, mapView: MLNMapView) {
             guard let features = renderer?.queryPixels(at: point),
                  let firstFeature = features.first else {
                Logger.debug("No pixel found at tap location")
                return
            }

            // Parse feature to Pixel model
            if let pixel = parsePixelFromFeature(firstFeature) {
                Logger.info("🎯 Pixel tapped: \(pixel.id)")
                onPixelTapped(pixel)
            }
        }

        /// Parse MVT feature properties to Pixel model
        private func parsePixelFromFeature(_ feature: MLNFeature) -> Pixel? {
            let properties = feature.attributes
            guard let gridId = properties["grid_id"] as? String else { return nil }

            // Parse coordinates: Try attributes first, then fallback to feature geometry
            var latitude = properties["lat"] as? Double ?? 0
            var longitude = properties["lng"] as? Double ?? 0
            
            // If attributes are missing/zero, use feature coordinate
            if (latitude == 0 && longitude == 0) {
                 latitude = feature.coordinate.latitude
                 longitude = feature.coordinate.longitude
            }
            
            let color = properties["color"] as? String ?? "#4ECDC4"
            let emoji = properties["emoji"] as? String
            let pixelType = properties["pixel_type"] as? String
            let userId = properties["user_id"] as? String ?? ""
            let username = properties["username"] as? String
            
            var authorAvatarUrl = properties["avatar_url"] as? String
            Logger.debug("Parsing avatar for pixel \(gridId): raw value = \(authorAvatarUrl ?? "nil")")
            
            if let url = authorAvatarUrl, url.hasPrefix("/") {
                 var baseUrl = APIEndpoint.baseURL
                 // If baseURL ends with /api, remove it because static files are served from root
                 if baseUrl.hasSuffix("/api") {
                     baseUrl = String(baseUrl.dropLast(4))
                 }
                 
                 Logger.debug("Using adjusted baseURL for static asset: \(baseUrl)")
                 if baseUrl.hasSuffix("/") {
                    authorAvatarUrl = baseUrl + String(url.dropFirst())
                 } else {
                    authorAvatarUrl = baseUrl + url
                 }
                 Logger.debug("Final avatar URL: \(authorAvatarUrl ?? "nil")")
            } else if let url = authorAvatarUrl, url.contains("localhost"), let baseUrl = URL(string: APIEndpoint.baseURL), let host = baseUrl.host {
                 // Replace localhost with 127.0.0.1 (or actual API host) for iOS Simulator
                 authorAvatarUrl = url.replacingOccurrences(of: "localhost", with: host)
                 Logger.debug("Replaced localhost in avatar URL: \(authorAvatarUrl ?? "nil")")
            }
            
            var allianceIdString: String? = nil
            if let aid = properties["alliance_id"] as? Int {
                 allianceIdString = String(aid)
            } else {
                 allianceIdString = properties["alliance_id"] as? String
            }
            
            let allianceName = properties["alliance_name"] as? String
            let allianceFlag = properties["alliance_flag"] as? String
            let patternId = properties["pattern_id"] as? String
            let city = properties["city"] as? String
            let country = properties["country"] as? String

            return Pixel(
                id: gridId,
                latitude: latitude,
                longitude: longitude,
                color: color,
                emoji: emoji,
                type: pixelType,
                authorId: userId,
                authorName: username,
                authorAvatarUrl: authorAvatarUrl,
                allianceId: allianceIdString,
                allianceName: allianceName,
                allianceFlag: allianceFlag,
                city: city,
                country: country,
                patternId: patternId
            )
        }
    }
}

// MARK: - UIGestureRecognizerDelegate

extension MapLibreMapWrapper.Coordinator: UIGestureRecognizerDelegate {
    /// 允许多个手势同时识别（不干扰MapLibre原有手势）
    func gestureRecognizer(_ gestureRecognizer: UIGestureRecognizer,
                          shouldRecognizeSimultaneouslyWith otherGestureRecognizer: UIGestureRecognizer) -> Bool {
        return true
    }
}

#endif

// PixelDetailCard Removed (Replaced by InteractivePixelBottomSheet)

// Simple Share Sheet Wrapper
struct ShareSheet: UIViewControllerRepresentable {
    var activityItems: [Any]
    var applicationActivities: [UIActivity]? = nil

    func makeUIViewController(context: Context) -> UIActivityViewController {
        let controller = UIActivityViewController(activityItems: activityItems, applicationActivities: applicationActivities)
        return controller
    }

    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}


