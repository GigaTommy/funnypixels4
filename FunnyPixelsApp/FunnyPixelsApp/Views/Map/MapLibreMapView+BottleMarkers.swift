#if canImport(MapLibre)
import MapLibre
import CoreLocation
import UIKit

extension MapLibreMapWrapper.Coordinator {
    /// 设置漂流瓶标记图层
    func setupBottleMarkersLayer(style: MLNStyle) {
        // 检查source是否已存在
        if style.source(withIdentifier: "bottle-markers-source") != nil {
            Logger.debug("🍾 [Bottle Markers] Source already exists, updating data")
            return
        }

        // 创建空的GeoJSON source
        let emptyFeatureCollection: [String: Any] = [
            "type": "FeatureCollection",
            "features": []
        ]

        guard let geoJSONData = try? JSONSerialization.data(withJSONObject: emptyFeatureCollection),
              let shape = try? MLNShape(data: geoJSONData, encoding: String.Encoding.utf8.rawValue) else {
            Logger.error("🍾 [Bottle Markers] Failed to create initial GeoJSON shape")
            return
        }

        let source = MLNShapeSource(identifier: "bottle-markers-source", shape: shape, options: nil)
        style.addSource(source)

        // 添加symbol layer
        let layer = MLNSymbolStyleLayer(identifier: "bottle-markers-layer", source: source)

        // 使用图片作为icon（需要先将图片添加到style）
        if let bottleImage = UIImage(named: "drift_bottle_icon") {
            style.setImage(bottleImage, forName: "drift-bottle-marker")
        }

        layer.iconImageName = NSExpression(forConstantValue: "drift-bottle-marker")
        layer.iconScale = NSExpression(forConstantValue: 0.8)  // 图标大小
        layer.iconAllowsOverlap = NSExpression(forConstantValue: true)  // 允许重叠
        layer.iconIgnoresPlacement = NSExpression(forConstantValue: true)
        layer.iconAnchor = NSExpression(forConstantValue: "bottom")  // 锚点在底部

        // 添加文本标签（显示距离）
        layer.text = NSExpression(format: "CAST(distance, 'NSString')")
        layer.textFontSize = NSExpression(forConstantValue: 10)
        layer.textColor = NSExpression(forConstantValue: UIColor.white)
        layer.textHaloColor = NSExpression(forConstantValue: UIColor.black.withAlphaComponent(0.5))
        layer.textHaloWidth = NSExpression(forConstantValue: 1)
        layer.textOffset = NSExpression(forConstantValue: NSValue(cgVector: CGVector(dx: 0, dy: -2)))
        layer.textAnchor = NSExpression(forConstantValue: "top")

        style.addLayer(layer)

        Logger.info("🍾 [Bottle Markers] Layer setup complete")
    }

    /// 更新漂流瓶标记
    func updateBottleMarkers(style: MLNStyle, markers: [BottleMapMarker]) {
        guard let source = style.source(withIdentifier: "bottle-markers-source") as? MLNShapeSource else {
            Logger.warning("🍾 [Bottle Markers] Source not found, setting up layer first")
            setupBottleMarkersLayer(style: style)
            return
        }

        // 将markers转换为GeoJSON features
        let features: [[String: Any]] = markers.map { marker in
            return [
                "type": "Feature",
                "geometry": [
                    "type": "Point",
                    "coordinates": [marker.coordinate.longitude, marker.coordinate.latitude]
                ],
                "properties": [
                    "bottleId": marker.id,
                    "distance": marker.distanceText,
                    "isInRange": marker.isInPickupRange
                ]
            ]
        }

        let featureCollection: [String: Any] = [
            "type": "FeatureCollection",
            "features": features
        ]

        guard let geoJSONData = try? JSONSerialization.data(withJSONObject: featureCollection),
              let shape = try? MLNShape(data: geoJSONData, encoding: String.Encoding.utf8.rawValue) else {
            Logger.error("🍾 [Bottle Markers] Failed to create GeoJSON shape")
            return
        }

        source.shape = shape
        Logger.debug("🍾 [Bottle Markers] Updated \(markers.count) markers")
    }
}
#endif
