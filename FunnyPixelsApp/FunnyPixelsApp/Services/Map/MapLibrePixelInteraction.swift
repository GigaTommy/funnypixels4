import Foundation
import Combine
#if canImport(MapLibre)
import MapLibre
import UIKit
import CoreGraphics
#endif

// MARK: - MapLibre Pixel Click Detector (仅 iOS)

#if canImport(MapLibre)

/// 像素点击检测器
/// 处理地图上的像素点击事件
public class MapLibrePixelClickDetector {
    // MARK: - Properties

    /// 地图视图
    private weak var mapView: MLNMapView?

    /// 像素图层标识符
    private let layerIdentifiers: [String]

    /// 点击容差（像素）
    private let touchTolerance: CGFloat = 10

    // MARK: - Initialization

    public init(
        mapView: MLNMapView,
        layerIdentifiers: [String] = ["pixels-color", "pixels-emoji", "pixels-complex", "pixels-ad"]
    ) {
        self.mapView = mapView
        self.layerIdentifiers = layerIdentifiers
    }

    // MARK: - Public Methods

    /// 检测点击位置的像素
    @MainActor
    public func detectPixel(at point: CGPoint) -> PixelClickResult? {
        guard let mapView = mapView else { return nil }

        // 获取点击位置的所有要素
        let features = mapView.visibleFeatures(
            at: point,
            styleLayerIdentifiers: Set(layerIdentifiers)
        )

        // 查找最近的像素要素
        var closestFeature: (any MLNFeature)?
        var minDistance: CGFloat = touchTolerance

        for feature in features {
            if let pointFeature = feature as? MLNPointFeature {
                let featureCoordinate = pointFeature.coordinate
                let screenPoint = mapView.convert(featureCoordinate, toPointTo: mapView)
                let distance = hypot(screenPoint.x - point.x, screenPoint.y - point.y)

                if distance < minDistance {
                    minDistance = distance
                    closestFeature = pointFeature
                }
            }
        }

        guard let feature = closestFeature as? MLNPointFeature else {
            return nil
        }

        return PixelClickResult(
            feature: feature,
            screenPoint: point,
            distance: minDistance
        )
    }

    /// 批量检测点击位置的像素
    @MainActor
    public func detectPixels(at point: CGPoint) -> [PixelClickResult] {
        guard let mapView = mapView else { return [] }

        let features = mapView.visibleFeatures(
            at: point,
            styleLayerIdentifiers: Set(layerIdentifiers)
        )

        var results: [PixelClickResult] = []

        for feature in features {
            if let pointFeature = feature as? MLNPointFeature {
                let featureCoordinate = pointFeature.coordinate
                let screenPoint = mapView.convert(featureCoordinate, toPointTo: mapView)
                let distance = hypot(screenPoint.x - point.x, screenPoint.y - point.y)

                if distance <= touchTolerance {
                    results.append(
                        PixelClickResult(
                            feature: pointFeature,
                            screenPoint: screenPoint,
                            distance: distance
                        )
                    )
                }
            }
        }

        return results.sorted { $0.distance < $1.distance }
    }
}

// MARK: - Pixel Click Result

/// 像素点击结果
public struct PixelClickResult {
    /// 像素要素
    public let feature: MLNPointFeature

    /// 屏幕坐标
    public let screenPoint: CGPoint

    /// 距离点击点的距离
    public let distance: CGFloat

    /// 像素 ID
    public var pixelId: String? {
        feature.identifier as? String
    }

    /// 像素坐标
    public var coordinate: CLLocationCoordinate2D? {
        feature.coordinate
    }

    /// 像素属性
    public var attributes: [String: Any] {
        feature.attributes
    }

    /// 像素颜色
    public var color: UIColor? {
        attributes["color"] as? UIColor
    }
}

// MARK: - Pixel Drawing Manager

/// 像素绘制管理器
/// 处理在地图上绘制新像素的逻辑
@MainActor
public class MapLibrePixelDrawingManager: ObservableObject {
    // MARK: - Properties

    /// 地图视图
    private weak var mapView: MLNMapView?

    /// 联盟图案提供者
    private let patternProvider = AllianceDrawingPatternProvider.shared

    /// 绘制状态管理器（单一数据源）
    private let drawingStateManager = DrawingStateManager.shared

    /// 是否处于绘制模式（直接从 DrawingStateManager 读取）
    public var isDrawingMode: Bool {
        drawingStateManager.isDrawingMode
    }

    /// 绘制状态
    public enum DrawingState {
        case idle
        case placing
        case confirming
    }

    @Published public var drawingState: DrawingState = .idle

    /// 当前放置的像素坐标
    private var pendingPixelCoordinate: CLLocationCoordinate2D?

    /// 临时要素 ID
    private let tempFeatureId = "temp-pixel-preview"

    // MARK: - Initialization

    public init(mapView: MLNMapView) {
        self.mapView = mapView
    }

    // MARK: - Public Methods

    /// 开始绘制模式
    public func startDrawingMode() {
        // 状态由 DrawingStateManager 管理，这里不需要做任何事
        drawingState = .placing
        Logger.userAction("start_drawing_mode")
    }

    /// 停止绘制模式
    public func stopDrawingMode() {
        // 状态由 DrawingStateManager 管理，这里只需要清理 UI
        drawingState = .idle
        removeTempPixel()
        Logger.userAction("stop_drawing_mode")
    }

    /// 处理地图点击
    public func handleMapTap(at point: CGPoint) -> CLLocationCoordinate2D {
        guard isDrawingMode,
              let mapView = mapView else {
            Logger.debug("handleMapTap: isDrawingMode=\(isDrawingMode), mapView=\(mapView != nil)")
            return CLLocationCoordinate2D()
        }

        let coordinate = mapView.convert(point, toCoordinateFrom: mapView)

        switch drawingState {
        case .idle:
            return CLLocationCoordinate2D()

        case .placing:
            // 显示预览
            pendingPixelCoordinate = coordinate
            showTempPixel(at: coordinate)
            drawingState = .confirming
            return coordinate

        case .confirming:
            // 确认放置
            let result = pendingPixelCoordinate ?? coordinate
            pendingPixelCoordinate = nil
            removeTempPixel()
            drawingState = .placing
            return result
        }
    }

    /// 取消当前绘制
    public func cancelCurrentDrawing() {
        pendingPixelCoordinate = nil
        removeTempPixel()
        drawingState = .placing
    }

    // MARK: - Private Methods

    private func showTempPixel(at coordinate: CLLocationCoordinate2D) {
        guard let mapView = mapView,
              let style = mapView.style else { return }

        // 移除旧的临时像素
        removeTempPixel()

        // 获取当前联盟图案
        guard let pattern = patternProvider.currentDrawingPattern else {
            Logger.error("无法显示预览：未加载联盟图案")
            return
        }

        // 根据图案类型创建预览
        let feature = MLNPointFeature()
        feature.coordinate = coordinate

        switch pattern.type {
        case .color:
            if let color = pattern.color {
                feature.attributes = ["color": UIColor(hexString: color) ?? UIColor.blue]
            } else {
                feature.attributes = ["color": UIColor.blue]
            }

        case .emoji:
            if let emoji = pattern.emoji {
                feature.attributes = ["emoji": emoji]
            } else {
                feature.attributes = ["emoji": "?"]
            }

        case .complex:
            // 复杂图案显示为默认圆圈
            feature.attributes = ["type": "complex"]

        case .none, .gps:
            feature.attributes = ["color": UIColor.blue]
        }

        // 创建临时数据源
        let source = MLNShapeSource(identifier: "temp-pixels", shape: feature)
        style.addSource(source)

        // 创建临时图层
        let circleLayer = MLNCircleStyleLayer(identifier: "temp-pixels-circles", source: source)
        circleLayer.circleRadius = NSExpression(forConstantValue: 10)
        circleLayer.circleOpacity = NSExpression(forConstantValue: 0.6)
        circleLayer.circleStrokeWidth = NSExpression(forConstantValue: 2)
        circleLayer.circleStrokeColor = NSExpression(forConstantValue: UIColor.white)
        circleLayer.circleStrokeOpacity = NSExpression(forConstantValue: 0.8)

        // 根据图案类型设置预览颜色
        if let color = patternProvider.currentDrawingPattern?.color {
            circleLayer.circleColor = NSExpression(forConstantValue: UIColor(hexString: color) ?? .blue)
        }

        style.addLayer(circleLayer)

        // 添加脉冲动画
        addPulseAnimation(to: circleLayer, in: mapView)
    }

    private func removeTempPixel() {
        guard let mapView = mapView,
              let style = mapView.style else { return }

        // 移除临时图层
        if let layer = style.layer(withIdentifier: "temp-pixels-circles") {
            style.removeLayer(layer)
        }

        // 移除临时数据源
        if let source = style.source(withIdentifier: "temp-pixels") {
            style.removeSource(source)
        }
    }

    private func addPulseAnimation(to layer: MLNStyleLayer, in mapView: MLNMapView) {
        // 添加脉冲动画效果
        let animation = CABasicAnimation(keyPath: "opacity")
        animation.fromValue = 1.0
        animation.toValue = 0.3
        animation.duration = 1.0
        animation.autoreverses = true
        animation.repeatCount = .infinity

        mapView.layer.add(animation, forKey: "pulse")
    }
}

// MARK: - Pixel Selection Manager

/// 像素选择管理器
/// 管理选中的像素状态
@MainActor
public class MapLibrePixelSelectionManager: ObservableObject {
    // MARK: - Properties

    /// 地图视图
    private weak var mapView: MLNMapView?

    /// 当前选中的像素
    @Published public var selectedPixel: Pixel?

    /// 选中要素的图层标识符
    private let selectedLayerId = "selected-pixel-highlight"

    // MARK: - Initialization

    public init(mapView: MLNMapView) {
        self.mapView = mapView
    }

    // MARK: - Public Methods

    /// 选中像素
    public func selectPixel(_ pixel: Pixel) {
        selectedPixel = pixel
        showSelectionHighlight(for: pixel)
        Logger.userAction("select_pixel", details: ["pixel_id": pixel.id])
    }

    /// 取消选中
    public func deselectPixel() {
        selectedPixel = nil
        removeSelectionHighlight()
        Logger.userAction("deselect_pixel")
    }

    /// 切换选中状态
    public func togglePixel(_ pixel: Pixel) {
        if selectedPixel?.id == pixel.id {
            deselectPixel()
        } else {
            selectPixel(pixel)
        }
    }

    // MARK: - Private Methods

    private func showSelectionHighlight(for pixel: Pixel) {
        guard let mapView = mapView,
              let style = mapView.style else { return }

        // 移除旧的高亮
        removeSelectionHighlight()

        // 创建高亮要素
        let coordinate = CLLocationCoordinate2D(
            latitude: pixel.latitude,
            longitude: pixel.longitude
        )

        let feature = MLNPointFeature()
        feature.coordinate = coordinate

        // 创建高亮数据源
        let source = MLNShapeSource(identifier: "selected-pixel-source", shape: feature)
        style.addSource(source)

        // 创建外圈高亮
        let outerCircle = MLNCircleStyleLayer(identifier: "\(selectedLayerId)-outer", source: source)
        outerCircle.circleRadius = NSExpression(forConstantValue: 20)
        outerCircle.circleColor = NSExpression(forConstantValue: UIColor.white)
        outerCircle.circleOpacity = NSExpression(forConstantValue: 0.3)
        outerCircle.circleStrokeWidth = NSExpression(forConstantValue: 2)
        outerCircle.circleStrokeColor = NSExpression(forConstantValue: UIColor.blue)

        // 创建内圈高亮
        let innerCircle = MLNCircleStyleLayer(identifier: "\(selectedLayerId)-inner", source: source)
        innerCircle.circleRadius = NSExpression(forConstantValue: 12)
        innerCircle.circleColor = NSExpression(forKeyPath: "color")
        innerCircle.circleOpacity = NSExpression(forConstantValue: 1.0)
        innerCircle.circleStrokeWidth = NSExpression(forConstantValue: 3)
        innerCircle.circleStrokeColor = NSExpression(forConstantValue: UIColor.white)

        style.addLayer(outerCircle)
        style.addLayer(innerCircle)
    }

    private func removeSelectionHighlight() {
        guard let mapView = mapView,
              let style = mapView.style else { return }

        let layers = [
            "\(selectedLayerId)-outer",
            "\(selectedLayerId)-inner",
            selectedLayerId
        ]

        for layerId in layers {
            if let layer = style.layer(withIdentifier: layerId) {
                style.removeLayer(layer)
            }
        }

        if let source = style.source(withIdentifier: "selected-pixel-source") {
            style.removeSource(source)
        }
    }
}

// MARK: - MapLibre Gesture Handler

/// MapLibre 手势处理器
/// 统一处理地图的各种手势交互，使用用户的联盟旗帜图案进行绘制
@MainActor
public class MapLibreGestureHandler: NSObject {
    // MARK: - Properties

    /// 地图视图
    private weak var mapView: MLNMapView?

    /// 点击检测器
    private let clickDetector: MapLibrePixelClickDetector

    /// 绘制管理器
    private let drawingManager: MapLibrePixelDrawingManager

    /// 选择管理器
    private let selectionManager: MapLibrePixelSelectionManager

    /// 像素点击回调
    private var onPixelClicked: ((PixelClickResult) -> Void)?

    /// 绘制像素回调（使用联盟旗帜图案）
    private var onPixelDraw: ((CLLocationCoordinate2D, DrawingPattern) -> Void)?

    /// 联盟图案提供者
    private let patternProvider = AllianceDrawingPatternProvider.shared

    // MARK: - Initialization

    public init(
        mapView: MLNMapView,
        clickDetector: MapLibrePixelClickDetector,
        drawingManager: MapLibrePixelDrawingManager,
        selectionManager: MapLibrePixelSelectionManager
    ) {
        self.mapView = mapView
        self.clickDetector = clickDetector
        self.drawingManager = drawingManager
        self.selectionManager = selectionManager
        super.init()
    }

    // MARK: - Public Methods

    /// 设置像素点击回调
    public func setPixelClickHandler(_ handler: @escaping (PixelClickResult) -> Void) {
        onPixelClicked = handler
    }

    /// 设置绘制像素回调（使用联盟旗帜图案）
    public func setPixelDrawHandler(_ handler: @escaping (CLLocationCoordinate2D, DrawingPattern) -> Void) {
        onPixelDraw = handler
    }

    /// 处理地图点击
    public func handleTap(at point: CGPoint) {
        // 首先检查是否在绘制模式
        if drawingManager.isDrawingMode {
            let coordinate = drawingManager.handleMapTap(at: point)
            if coordinate.latitude != 0 && coordinate.longitude != 0 {
                // 使用联盟旗帜图案进行绘制
                if let pattern = patternProvider.currentDrawingPattern {
                    onPixelDraw?(coordinate, pattern)
                }
            }
            return
        }

        // 检测点击的像素
        if let result = clickDetector.detectPixel(at: point) {
            // 选中像素
            onPixelClicked?(result)
        } else {
            // 取消选中
            selectionManager.deselectPixel()
        }
    }

    /// 处理长按事件
    public func handleLongPress(at point: CGPoint) {
        // 长按可以触发快速绘制
        guard let mapView = mapView else { return }

        let coordinate = mapView.convert(point, toCoordinateFrom: mapView)

        Logger.userAction("long_press_for_pixel", details: [
            "lat": coordinate.latitude,
            "lon": coordinate.longitude
        ])
    }

    /// 处理双击事件
    public func handleDoubleTap(at point: CGPoint) {
        // 可以用来快速缩放到像素位置
        guard let mapView = mapView else { return }

        let coordinate = mapView.convert(point, toCoordinateFrom: mapView)

        // 放大到高缩放级别
        mapView.setCenter(coordinate, zoomLevel: 17, animated: true)
    }
}

// MARK: - MapLibre Interaction Manager

/// MapLibre 交互管理器
/// 统一管理所有地图交互
@MainActor
public class MapLibreInteractionManager: NSObject {
    // MARK: - Properties

    /// 地图视图
    private weak var mapView: MLNMapView?

    /// 手势处理器
    private var gestureHandler: MapLibreGestureHandler?

    /// 点击检测器
    private let clickDetector: MapLibrePixelClickDetector

    /// 绘制管理器
    private let drawingManager: MapLibrePixelDrawingManager

    /// 选择管理器
    private let selectionManager: MapLibrePixelSelectionManager

    // MARK: - Initialization

    public init(mapView: MLNMapView) {
        self.mapView = mapView

        let clickDetector = MapLibrePixelClickDetector(mapView: mapView)
        let drawingManager = MapLibrePixelDrawingManager(mapView: mapView)
        let selectionManager = MapLibrePixelSelectionManager(mapView: mapView)

        self.clickDetector = clickDetector
        self.drawingManager = drawingManager
        self.selectionManager = selectionManager

        super.init()

        setupGestures()
    }

    // MARK: - Public Methods

    /// 设置像素点击回调
    public func onPixelClicked(_ handler: @escaping (PixelClickResult) -> Void) {
        gestureHandler?.setPixelClickHandler(handler)
    }

    /// 设置绘制像素回调
    public func onPixelDraw(_ handler: @escaping (CLLocationCoordinate2D, DrawingPattern) -> Void) {
        gestureHandler?.setPixelDrawHandler(handler)
    }

    /// 切换绘制模式
    public func toggleDrawingMode() {
        // 通过 DrawingStateManager 切换状态
        let drawingState = DrawingStateManager.shared

        if drawingState.isDrawingMode {
            Task {
                await drawingState.stopDrawing()
            }
            drawingManager.stopDrawingMode()
        } else {
            drawingState.openDrawingPanel()  // 只打开面板，不开始绘制
            drawingManager.startDrawingMode()
        }
    }

    /// 获取绘制管理器
    public var drawing: MapLibrePixelDrawingManager {
        return drawingManager
    }

    /// 获取选择管理器
    public var selection: MapLibrePixelSelectionManager {
        return selectionManager
    }

    // MARK: - Private Methods

    private func setupGestures() {
        guard let mapView = mapView else { return }

        let gestureHandler = MapLibreGestureHandler(
            mapView: mapView,
            clickDetector: clickDetector,
            drawingManager: drawingManager,
            selectionManager: selectionManager
        )
        self.gestureHandler = gestureHandler

        // 添加点击手势
        let tapGesture = UITapGestureRecognizer(target: self, action: #selector(handleTap(_:)))
        mapView.addGestureRecognizer(tapGesture)

        // 添加长按手势
        let longPressGesture = UILongPressGestureRecognizer(target: self, action: #selector(handleLongPress(_:)))
        mapView.addGestureRecognizer(longPressGesture)

        // 添加双击手势
        let doubleTapGesture = UITapGestureRecognizer(target: self, action: #selector(handleDoubleTap(_:)))
        doubleTapGesture.numberOfTapsRequired = 2
        mapView.addGestureRecognizer(doubleTapGesture)

        // 让双击手势优先于单击
        tapGesture.require(toFail: doubleTapGesture)
    }

    @objc private func handleTap(_ gesture: UITapGestureRecognizer) {
        let point = gesture.location(in: mapView)
        gestureHandler?.handleTap(at: point)
    }

    @objc private func handleLongPress(_ gesture: UILongPressGestureRecognizer) {
        guard gesture.state == .began else { return }
        let point = gesture.location(in: mapView)
        gestureHandler?.handleLongPress(at: point)
    }

    @objc private func handleDoubleTap(_ gesture: UITapGestureRecognizer) {
        let point = gesture.location(in: mapView)
        gestureHandler?.handleDoubleTap(at: point)
    }
}

#endif // canImport(MapLibre)
