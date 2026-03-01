import Foundation
import UIKit
import CoreGraphics
import CoreLocation
import Combine
import MapLibre

/// 自定义像素渲染器
/// 用于绕过 MapLibre Native iOS SDK 的动态 iconImageName 限制
/// 直接在 CALayer 上渲染 emoji 和 complex 像素
@MainActor
public class CustomPixelRenderer: NSObject {

    // MARK: - Properties

    /// 渲染层容器（覆盖在地图上）
    public let containerLayer: CALayer = {
        let layer = CALayer()
        layer.name = "CustomPixelRenderer"
        return layer
    }()

    /// Emoji 像素字典 [pixelId: layer]
    private var emojiLayers: [String: CATextLayer] = [:]

    /// Complex 像素字典 [pixelId: layer]
    private var complexLayers: [String: CALayer] = [:]

    /// 地图引用（用于坐标转换）
    private weak var mapView: MLNMapView?

    /// 图片缓存
    private let imageCache: NSCache<NSString, UIImage> = {
        let cache = NSCache<NSString, UIImage>()
        cache.countLimit = 100
        cache.totalCostLimit = 50 * 1024 * 1024 // 50 MB
        return cache
    }()

    /// 当前地图状态
    private var currentCenter: CLLocationCoordinate2D?
    private var currentZoom: Double = 12

    // MARK: - Initialization

    public init(mapView: MLNMapView) {
        self.mapView = mapView
        super.init()

        // 设置容器层
        containerLayer.frame = mapView.bounds
        containerLayer.backgroundColor = UIColor.clear.cgColor
    }

    // MARK: - Public Methods

    /// 更新地图状态
    public func updateMapState(center: CLLocationCoordinate2D, zoom: Double) {
        currentCenter = center
        currentZoom = zoom

        // 重新布局所有像素
        layoutAllPixels()
    }

    /// 添加 emoji 像素
    public func addEmojiPixel(_ pixel: EmojiPixel) {
        guard let mapView = mapView else { return }

        // 创建文本层
        let textLayer = CATextLayer()
        textLayer.string = pixel.emoji
        textLayer.font = UIFont.systemFont(ofSize: 20)
        textLayer.fontSize = 20
        textLayer.foregroundColor = UIColor.black.cgColor
        textLayer.alignmentMode = .center
        // Use trait collection scale instead of deprecated UIScreen.main.scale
        textLayer.contentsScale = mapView.traitCollection.displayScale

        // 计算位置
        let point = mapView.convert(pixel.coordinate, toPointTo: mapView)
        textLayer.position = point

        // 根据 zoom 调整大小
        let scale = calculateScale(forZoom: currentZoom)
        textLayer.transform = CATransform3DMakeScale(scale, scale, 1)

        // 添加到容器
        containerLayer.addSublayer(textLayer)
        emojiLayers[pixel.id] = textLayer
    }

    /// 添加 complex 像素
    public func addComplexPixel(_ pixel: ComplexPixel) {
        guard let mapView = mapView else { return }

        // 创建图片层
        let imageLayer = CALayer()

        // 检查缓存
        let cacheKey = pixel.imageUrl as NSString
        if let cachedImage = imageCache.object(forKey: cacheKey) {
            imageLayer.contents = cachedImage.cgImage
        } else {
            // 异步加载图片
            loadComplexImage(for: pixel, layer: imageLayer)
        }

        // 设置尺寸
        let size: CGFloat = 32
        imageLayer.bounds = CGRect(x: -size/2, y: -size/2, width: size, height: size)

        // 计算位置
        let point = mapView.convert(pixel.coordinate, toPointTo: mapView)
        imageLayer.position = point

        // 根据 zoom 调整大小
        let scale = calculateScale(forZoom: currentZoom)
        imageLayer.transform = CATransform3DMakeScale(scale, scale, 1)

        // 添加到容器
        containerLayer.addSublayer(imageLayer)
        complexLayers[pixel.id] = imageLayer
    }

    /// 批量更新像素
    /// Note: Uses new Pixel model from Models/Pixel.swift
    public func updatePixels(pixels: [Pixel]) {
        for pixel in pixels {
            // Check pixel type based on emoji and type fields
            if let emoji = pixel.emoji, !emoji.isEmpty {
                // Emoji pixel
                let emojiPixel = EmojiPixel(
                    id: pixel.id,
                    coordinate: CLLocationCoordinate2D(
                        latitude: pixel.latitude,
                        longitude: pixel.longitude
                    ),
                    emoji: emoji
                )
                addOrUpdateEmojiPixel(emojiPixel)
            } else if pixel.type == "complex" || pixel.type == "pattern" {
                // Complex/pattern pixel - would need image URL from another source
                // For now, skip as MapLibre MVT handles this
                continue
            } else {
                // Color pixel - handled by MapLibre MVT
                continue
            }
        }
    }

    /// 移除像素
    public func removePixel(_ id: String) {
        // 移除 emoji
        if let emojiLayer = emojiLayers[id] {
            emojiLayer.removeFromSuperlayer()
            emojiLayers.removeValue(forKey: id)
        }

        // 移除 complex
        if let complexLayer = complexLayers[id] {
            complexLayer.removeFromSuperlayer()
            complexLayers.removeValue(forKey: id)
        }
    }

    /// 清空所有像素
    public func clearAll() {
        emojiLayers.values.forEach { $0.removeFromSuperlayer() }
        emojiLayers.removeAll()

        complexLayers.values.forEach { $0.removeFromSuperlayer() }
        complexLayers.removeAll()
    }

    // MARK: - Private Methods

    private func addOrUpdateEmojiPixel(_ pixel: EmojiPixel) {
        if let existingLayer = emojiLayers[pixel.id] {
            // 更新位置
            updatePixelPosition(existingLayer, coordinate: pixel.coordinate)
        } else {
            // 添加新像素
            addEmojiPixel(pixel)
        }
    }

    private func addOrUpdateComplexPixel(_ pixel: ComplexPixel) {
        if let existingLayer = complexLayers[pixel.id] {
            // 更新位置
            updatePixelPosition(existingLayer, coordinate: pixel.coordinate)
        } else {
            // 添加新像素
            addComplexPixel(pixel)
        }
    }

    private func updatePixelPosition(_ layer: CALayer, coordinate: CLLocationCoordinate2D) {
        guard let mapView = mapView else { return }

        let point = mapView.convert(coordinate, toPointTo: mapView)
        layer.position = point
    }

    private func layoutAllPixels() {
        // 重新布局所有 emoji
        for (_, _) in emojiLayers {
            // 需要从某个地方获取坐标信息
            // 这里简化处理，实际需要维护坐标字典
        }

        // 重新布局所有 complex
        for (_, _) in complexLayers {
            // 同上
        }
    }

    private func loadComplexImage(for pixel: ComplexPixel, layer: CALayer) {
        guard let url = URL(string: pixel.imageUrl) else { return }

        // Capture image for use in closure
        Task { @MainActor in
            do {
                let (data, _) = try await URLSession.shared.data(from: url)
                guard let image = UIImage(data: data) else { return }

                // 缓存图片
                let cacheKey = pixel.imageUrl as NSString
                imageCache.setObject(image, forKey: cacheKey)

                // 更新 layer
                layer.contents = image.cgImage
            } catch {
                Logger.error("Failed to load complex image: \(error)")
            }
        }
    }

    /// 根据 zoom 级别计算缩放比例
    /// 使用 base-2 指数插值，与 Web 端保持一致
    private func calculateScale(forZoom zoom: Double) -> CGFloat {
        // Web 端的 icon-size 配置：
        // zoom 12: 0.0104
        // zoom 13: 0.0208
        // zoom 14: 0.0417
        // zoom 15: 0.0833
        // zoom 16: 0.1667
        // zoom 17: 0.3333
        // zoom 18: 0.5

        let baseScale: CGFloat = 0.0104
        let zoomDelta = zoom - 12
        let exponentialScale = baseScale * pow(2, zoomDelta)

        // 转换为 layer 缩放比例（基础大小为 20pt）
        let baseSize: CGFloat = 20.0
        return CGFloat(exponentialScale) * baseSize
    }
}

// MARK: - Supporting Types

public struct EmojiPixel {
    public let id: String
    public let coordinate: CLLocationCoordinate2D
    public let emoji: String
}

public struct ComplexPixel {
    public let id: String
    public let coordinate: CLLocationCoordinate2D
    public let imageUrl: String
}

// Note: PixelType and Pixel are defined in Models/Pixel.swift
// The CustomPixelRenderer uses those models instead of local definitions
