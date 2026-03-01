import MapKit
import Foundation

/// MapKit 像素标注
public class PixelAnnotation: NSObject, MKAnnotation {
    /// 关联的像素数据
    public let pixel: Pixel

    /// 地图坐标（必须是 var 以符合 MKAnnotation 协议）
    public var coordinate: CLLocationCoordinate2D

    /// 标注标题
    public var title: String?

    /// 标注副标题
    public var subtitle: String?

    /// 初始化像素标注
    /// - Parameter pixel: 像素数据
    public init(pixel: Pixel) {
        self.pixel = pixel
        self.coordinate = pixel.coordinate
        self.title = "Pixel \(pixel.id.prefix(8))"

        // 格式化创建时间
        let formatter = DateFormatter()
        formatter.dateStyle = .short
        formatter.timeStyle = .short
        self.subtitle = "Created: \(formatter.string(from: pixel.createdAt))"

        super.init()
    }

    /// 更新坐标
    /// - Parameter coordinate: 新的坐标
    public func updateCoordinate(_ coordinate: CLLocationCoordinate2D) {
        self.coordinate = coordinate
    }
}

// MARK: - Annotation Clustering

/// 像素聚合标注
public class PixelClusterAnnotation: NSObject, MKAnnotation {
    /// 聚合的像素集合
    public let pixels: [Pixel]

    /// 聚合中心坐标
    public var coordinate: CLLocationCoordinate2D

    /// 聚合标题
    public var title: String?

    /// 聚合副标题
    public var subtitle: String?

    /// 初始化聚合标注
    /// - Parameter pixels: 像素数组
    public init(pixels: [Pixel]) {
        self.pixels = pixels

        // 计算聚合中心坐标
        let avgLat = pixels.map(\.latitude).reduce(0, +) / Double(pixels.count)
        let avgLng = pixels.map(\.longitude).reduce(0, +) / Double(pixels.count)
        self.coordinate = CLLocationCoordinate2D(latitude: avgLat, longitude: avgLng)

        self.title = "\(pixels.count) Pixels"
        self.subtitle = "Tap to zoom in"

        super.init()
    }

    /// 获取最常见的颜色
    public var dominantColor: String {
        var colorCounts: [String: Int] = [:]

        for pixel in pixels {
            colorCounts[pixel.color, default: 0] += 1
        }

        return colorCounts.max(by: { $0.value < $1.value })?.key ?? "#4ECDC4"
    }
}

// MARK: - Annotation View

#if os(iOS)
import UIKit

/// 像素标注视图（iOS）
public class PixelAnnotationMarkerView: MKMarkerAnnotationView {
    public override var annotation: (any MKAnnotation)? {
        willSet {
            if let pixelAnnotation = newValue as? PixelAnnotation {
                configureForPixel(pixelAnnotation.pixel)
            } else if let clusterAnnotation = newValue as? PixelClusterAnnotation {
                configureForCluster(clusterAnnotation)
            }
        }
    }

    /// 配置单个像素显示
    private func configureForPixel(_ pixel: Pixel) {
        clusteringIdentifier = "pixel"
        displayPriority = .defaultHigh

        // 设置标记颜色
        if let color = UIColor(hexString: pixel.color) {
            markerTintColor = color
        } else {
            markerTintColor = .systemGray
        }

        // 设置小尺寸
        glyphText = "•"
    }

    /// 配置聚合显示
    private func configureForCluster(_ cluster: PixelClusterAnnotation) {
        displayPriority = .defaultHigh

        // 设置聚合颜色
        if let color = UIColor(hexString: cluster.dominantColor) {
            markerTintColor = color
        } else {
            markerTintColor = .systemBlue
        }

        glyphText = "\(cluster.pixels.count)"
    }
}

// MARK: - UIColor Extension

extension UIColor {
    /// 从十六进制字符串创建颜色
    convenience init?(hexString: String) {
        let hex = hexString.trimmingCharacters(in: .whitespacesAndNewlines)
        let scanner = Scanner(string: hex)

        if hex.hasPrefix("#") {
            scanner.currentIndex = hex.index(after: hex.startIndex)
        }

        var rgbValue: UInt64 = 0
        guard scanner.scanHexInt64(&rgbValue) else {
            return nil
        }

        let red = CGFloat((rgbValue & 0xFF0000) >> 16) / 255.0
        let green = CGFloat((rgbValue & 0x00FF00) >> 8) / 255.0
        let blue = CGFloat(rgbValue & 0x0000FF) / 255.0

        self.init(red: red, green: green, blue: blue, alpha: 1.0)
    }
}

#endif

// MARK: - macOS Support

#if os(macOS)
import AppKit

/// 像素标注视图（macOS）
public class PixelAnnotationMarkerView: MKAnnotationView {
    public override var annotation: (any MKAnnotation)? {
        willSet {
            if let pixelAnnotation = newValue as? PixelAnnotation {
                configureForPixel(pixelAnnotation.pixel)
            } else if let clusterAnnotation = newValue as? PixelClusterAnnotation {
                configureForCluster(clusterAnnotation)
            }
        }
    }

    /// 配置单个像素显示
    private func configureForPixel(_ pixel: Pixel) {
        clusteringIdentifier = "pixel"

        // 创建自定义视图
        let size: CGFloat = 10
        let view = NSView(frame: NSRect(x: 0, y: 0, width: size, height: size))
        view.wantsLayer = true

        if let color = NSColor(hexString: pixel.color) {
            view.layer?.backgroundColor = color.cgColor
        } else {
            view.layer?.backgroundColor = NSColor.gray.cgColor
        }

        view.layer?.cornerRadius = size / 2
        self.addSubview(view)
    }

    /// 配置聚合显示
    private func configureForCluster(_ cluster: PixelClusterAnnotation) {
        let size: CGFloat = 30
        let view = NSView(frame: NSRect(x: 0, y: 0, width: size, height: size))
        view.wantsLayer = true

        if let color = NSColor(hexString: cluster.dominantColor) {
            view.layer?.backgroundColor = color.cgColor
        } else {
            view.layer?.backgroundColor = NSColor.systemBlue.cgColor
        }

        view.layer?.cornerRadius = size / 2

        // 添加文字
        let textField = NSTextField(labelWithString: "\(cluster.pixels.count)")
        textField.frame = NSRect(x: 0, y: 0, width: size, height: size)
        textField.alignment = .center
        textField.textColor = .white
        textField.font = .boldSystemFont(ofSize: 12)
        view.addSubview(textField)

        self.addSubview(view)
    }
}

// MARK: - NSColor Extension

extension NSColor {
    /// 从十六进制字符串创建颜色
    convenience init?(hexString: String) {
        let hex = hexString.trimmingCharacters(in: .whitespacesAndNewlines)
        let scanner = Scanner(string: hex)

        if hex.hasPrefix("#") {
            scanner.currentIndex = hex.index(after: hex.startIndex)
        }

        var rgbValue: UInt64 = 0
        guard scanner.scanHexInt64(&rgbValue) else {
            return nil
        }

        let red = CGFloat((rgbValue & 0xFF0000) >> 16) / 255.0
        let green = CGFloat((rgbValue & 0x00FF00) >> 8) / 255.0
        let blue = CGFloat(rgbValue & 0x0000FF) / 255.0

        self.init(red: red, green: green, blue: blue, alpha: 1.0)
    }
}

#endif
