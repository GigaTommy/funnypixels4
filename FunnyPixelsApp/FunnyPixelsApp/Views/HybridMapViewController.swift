import Foundation
import UIKit
import MapLibre

/// 混合地图视图控制器
/// 结合 MapLibre Native 底图和自定义像素渲染层
@MainActor
public class HybridMapViewController: UIViewController {

    // MARK: - Properties

    /// MapLibre 地图视图（用于底图和颜色像素）
    public let mapView: MLNMapView = {
        let map = MLNMapView()
        map.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        map.logoView.isHidden = true
        map.attributionButton.isHidden = true
        return map
    }()

    /// 自定义像素渲染器（用于 emoji 和 complex 像素）
    private var customRenderer: CustomPixelRenderer!

    /// 像素数据源
    private var pixelData: [Pixel] = []

    // MARK: - Initialization

    public init() {
        super.init(nibName: nil, bundle: nil)
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    // MARK: - Lifecycle

    public override func viewDidLoad() {
        super.viewDidLoad()

        setupMapView()
        setupCustomRenderer()
        setupMapStyle()
    }

    // MARK: - Setup

    private func setupMapView() {
        // 添加地图视图
        view.addSubview(mapView)

        // 配置地图
        let center = CLLocationCoordinate2D(latitude: 23.109702, longitude: 113.324520)
        mapView.setCenter(center, zoomLevel: 14, animated: false)
        mapView.delegate = self
    }

    private func setupCustomRenderer() {
        // 创建自定义渲染器
        customRenderer = CustomPixelRenderer(mapView: mapView)

        // 添加自定义渲染层到地图
        mapView.layer.addSublayer(customRenderer.containerLayer)
    }

    private func setupMapStyle() {
        // 加载底图样式
        let styleURL = URL(string: "https://tiles.openfreemap.org/styles/liberty")!
        mapView.styleURL = styleURL
    }

    // MARK: - Public Methods

    /// 更新像素数据
    public func updatePixels(_ pixels: [Pixel]) {
        pixelData = pixels

        // 等待地图加载完成后更新
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { [weak self] in
            self?.customRenderer.updatePixels(pixels: pixels)
        }
    }

    /// 从 API 加载像素数据
    public func loadPixelsFromAPI() async {
        // TODO: 实现从 API 加载像素的逻辑
        // 这里可以复用现有的 API 调用代码

        // 示例数据 - Using new Pixel model from Models/Pixel.swift
        let samplePixels: [Pixel] = [
            Pixel(
                id: "pixel-1",
                latitude: 23.109702,
                longitude: 113.324520,
                color: "#FF0000",
                emoji: "🔥",
                authorId: "test-user"
            ),
            Pixel(
                id: "pixel-2",
                latitude: 23.110702,
                longitude: 113.325520,
                color: "#00FF00",
                emoji: "🏰",
                authorId: "test-user"
            ),
            Pixel(
                id: "pixel-3",
                latitude: 23.108702,
                longitude: 113.323520,
                color: "#0000FF",
                type: "complex",
                authorId: "test-user"
            )
        ]

        updatePixels(samplePixels)
    }

    // MARK: - Helper Methods

    /// 同步自定义渲染层与地图状态
    private func syncCustomRenderer() {
        let center = mapView.centerCoordinate
        let zoom = mapView.zoomLevel

        customRenderer.updateMapState(center: center, zoom: zoom)
    }
}

// MARK: - MLNMapViewDelegate

extension HybridMapViewController: MLNMapViewDelegate {

    public func mapView(_ mapView: MLNMapView, didFinishLoading style: MLNStyle) {
        Logger.info("✅ Map style loaded, initializing MVT layers...")

        // 设置 MVT 瓦片源（只用于颜色像素）
        setupMVTSource(style: style)

        // 添加颜色像素图层
        addColorPixelLayer(style: style)

        // emoji 和 complex 像素由自定义渲染器处理
    }

    public func mapView(_ mapView: MLNMapView, regionDidChangeAnimated animated: Bool) {
        // 地图区域改变时，同步自定义渲染层
        syncCustomRenderer()
    }

    public func mapView(_ mapView: MLNMapView, regionWillChangeAnimated animated: Bool) {
        // 地图即将改变时，可以开始准备新的渲染
    }

    // MARK: - MVT Setup

    private func setupMVTSource(style: MLNStyle) {
        // 只配置颜色像素的 MVT 源
        let tileURL = "\(AppConfig.apiBaseURL)/tiles/pixels/{z}/{x}/{y}.pbf?v=2"

        let source = MLNVectorTileSource(
            identifier: "pixels-color-only",
            tileURLTemplates: [tileURL],
            options: [
                .minimumZoomLevel: NSNumber(value: 12),
                .maximumZoomLevel: NSNumber(value: 18),
                .tileSize: NSNumber(value: 512)
            ]
        )

        style.addSource(source)
    }

    private func addColorPixelLayer(style: MLNStyle) {
        // 找到标签图层作为参考
        let labelLayer = findLabelLayer(in: style)

        // 创建颜色像素图层
        guard let colorSource = style.source(withIdentifier: "pixels-color-only") else {
            Logger.error("❌ Cannot find 'pixels-color-only' source for color pixel layer")
            return
        }
        let layer = MLNSymbolStyleLayer(identifier: "pixels-color", source: colorSource)
        layer.sourceLayerIdentifier = "pixels-color"

        // 配置图层（与之前保持一致）
        layer.iconImageName = NSExpression(forConstantValue: "sdf-square")
        layer.iconScale = NSExpression(
            forMLNInterpolating: .zoomLevelVariable,
            curveType: .exponential,
            parameters: NSExpression(forConstantValue: 2),
            stops: NSExpression(forConstantValue: [
                12: 0.0156,
                13: 0.03125,
                14: 0.0625,
                15: 0.125,
                16: 0.25,
                17: 0.5,
                18: 0.75
            ] as [NSNumber: NSNumber])
        )

        layer.iconColor = NSExpression(mglJSONObject: ["get", "color"])
        layer.iconAllowsOverlap = NSExpression(forConstantValue: true)
        layer.iconIgnoresPlacement = NSExpression(forConstantValue: true)

        if let labelLayer = labelLayer {
            style.insertLayer(layer, below: labelLayer)
        } else {
            style.addLayer(layer)
        }
    }

    private func findLabelLayer(in style: MLNStyle) -> MLNStyleLayer? {
        return style.layers.first { $0 is MLNSymbolStyleLayer }
    }
}

// MARK: - SwiftUI Wrapper

import SwiftUI

@MainActor
public struct HybridMapView: UIViewControllerRepresentable {

    public func makeUIViewController(context: Context) -> HybridMapViewController {
        return HybridMapViewController()
    }

    public func updateUIViewController(_ viewController: HybridMapViewController, context: Context) {
        // 更新逻辑（如果需要）
    }
}
