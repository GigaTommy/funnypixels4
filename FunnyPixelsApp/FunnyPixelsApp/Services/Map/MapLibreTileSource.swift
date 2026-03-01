import Foundation
import Combine
#if canImport(MapLibre)
import MapLibre
#endif

// MARK: - MapLibre Tile Source (仅 iOS)

#if canImport(MapLibre)

/// MVT 瓦片数据源
/// 从后端 API 加载 Mapbox Vector Tiles 格式的瓦片数据
public class MapLibreTileSource: NSObject {
    // MARK: - Properties

    /// 瓦片 ID
    public let identifier: String

    /// 瓦片 URL 模板
    private let urlTemplate: String

    /// 最小缩放级别
    public let minimumZoomLevel: UInt

    /// 最大缩放级别
    public let maximumZoomLevel: UInt

    /// API 基础 URL
    private let apiBaseURL: String

    // MARK: - Initialization

    public init(
        identifier: String = "pixels-tiles",
        urlTemplate: String? = nil,
        minimumZoomLevel: UInt = 0,
        maximumZoomLevel: UInt = 18
    ) {
        self.identifier = identifier
        self.minimumZoomLevel = minimumZoomLevel
        self.maximumZoomLevel = maximumZoomLevel
        self.apiBaseURL = AppEnvironment.current.apiBaseURL
        self.urlTemplate = urlTemplate ?? "\(apiBaseURL)/tiles/mvt/{z}/{x}/{y}"
        super.init()
    }

    // MARK: - Public Methods

    /// 创建 MLNSource
    public func makeSource() -> MLNSource {
        let source = MLNVectorTileSource(identifier: identifier, tileURLTemplates: [urlTemplate], options: [
            .minimumZoomLevel: minimumZoomLevel,
            .maximumZoomLevel: maximumZoomLevel,
            .tileSize: 512
        ] as [MLNTileSourceOption: Any])
        return source
    }
}

// MARK: - MapLibre Style Manager

/// MapLibre 样式管理器
/// 配置和管理地图的整体样式
@MainActor
public class MapLibreStyleManager {
    // MARK: - Properties

    /// 当前地图样式 URL
    public var currentStyleURL: URL {
        return styleURL(for: currentStyle)
    }

    /// 当前样式
    private var currentStyle: MapStyle = .darkMatter

    // MARK: - Map Styles

    public enum MapStyle {
        case darkMatter
        case positron
        case voyager
        case osm
        case custom(String)

        var styleURL: String {
            switch self {
            case .darkMatter:
                return "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
            case .positron:
                return "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"
            case .voyager:
                return "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json"
            case .osm:
                return "https://demotiles.maplibre.org/style.json"
            case .custom(let url):
                return url
            }
        }
    }

    // MARK: - Initialization

    public init(style: MapStyle = .darkMatter) {
        self.currentStyle = style
    }

    // MARK: - Public Methods

    /// 切换地图样式
    public func switchStyle(to style: MapStyle) {
        currentStyle = style
        Logger.info("Switched map style to: \(style)")
    }

    /// 获取样式 URL
    public func styleURL(for style: MapStyle) -> URL {
        return URL(string: style.styleURL)!
    }

    /// 配置地图样式
    public func configureMapView(_ mapView: MLNMapView) {
        mapView.styleURL = currentStyleURL

        // 配置地图属性
        mapView.zoomLevel = 12
        mapView.minimumZoomLevel = 2
        mapView.maximumZoomLevel = 18

        // 隐藏 UI 元素
        mapView.logoView.isHidden = true
        mapView.attributionButton.isHidden = true
        mapView.compassView.isHidden = false

        Logger.info("Configured map view with style: \(currentStyle)")
    }
}

// MARK: - Pixel Feature Builder

/// 像素要素构建器
/// 将 Pixel 对象转换为 MapLibre 的 Feature
public struct PixelFeatureBuilder {
    /// 构建 MLNPointFeature
    public static func makeFeature(from pixel: Pixel) -> MLNPointFeature {
        let coordinate = CLLocationCoordinate2D(
            latitude: pixel.latitude,
            longitude: pixel.longitude
        )

        let feature = MLNPointFeature()
        feature.coordinate = coordinate
        feature.attributes = attributes(for: pixel)

        return feature
    }

    /// 批量构建要素
    public static func makeFeatures(from pixels: [Pixel]) -> [MLNPointFeature] {
        return pixels.map { makeFeature(from: $0) }
    }

    /// 构建属性字典
    private static func attributes(for pixel: Pixel) -> [String: Any] {
        var attrs: [String: Any] = [
            "id": pixel.id,
            "color": UIColor(hexString: pixel.color) ?? UIColor.red,
            "authorId": pixel.authorId
        ]

        attrs["createdAt"] = pixel.createdAt.timeIntervalSince1970

        return attrs
    }
}

// MARK: - MapLibre Coordinate Helpers

/// MapLibre 坐标辅助工具
public enum MapLibreCoordinateHelper {
    /// 计算两个坐标之间的距离（米）
    public static func distance(from: CLLocationCoordinate2D, to: CLLocationCoordinate2D) -> CLLocationDistance {
        let fromLocation = CLLocation(latitude: from.latitude, longitude: from.longitude)
        let toLocation = CLLocation(latitude: to.latitude, longitude: to.longitude)
        return fromLocation.distance(from: toLocation)
    }

    /// 计算边界
    public static func boundingBox(for coordinates: [CLLocationCoordinate2D]) -> (min: CLLocationCoordinate2D, max: CLLocationCoordinate2D) {
        guard let first = coordinates.first else {
            return (min: CLLocationCoordinate2D(), max: CLLocationCoordinate2D())
        }

        var minLat = first.latitude
        var maxLat = first.latitude
        var minLon = first.longitude
        var maxLon = first.longitude

        for coord in coordinates {
            minLat = min(minLat, coord.latitude)
            maxLat = max(maxLat, coord.latitude)
            minLon = min(minLon, coord.longitude)
            maxLon = max(maxLon, coord.longitude)
        }

        return (
            min: CLLocationCoordinate2D(latitude: minLat, longitude: minLon),
            max: CLLocationCoordinate2D(latitude: maxLat, longitude: maxLon)
        )
    }

    /// 将屏幕坐标转换为地图坐标
    @MainActor
    public static func screenPointToCoordinate(
        _ point: CGPoint,
        in mapView: MLNMapView
    ) -> CLLocationCoordinate2D? {
        return mapView.convert(point, toCoordinateFrom: mapView)
    }

    /// 将地图坐标转换为屏幕坐标
    @MainActor
    public static func coordinateToScreenPoint(
        _ coordinate: CLLocationCoordinate2D,
        in mapView: MLNMapView
    ) -> CGPoint {
        return mapView.convert(coordinate, toPointTo: mapView)
    }
}

// MARK: - MapLibre Camera Position

/// 地图相机位置
public struct MapLibreCameraPosition {
    /// 中心坐标
    public let center: CLLocationCoordinate2D

    /// 缩放级别
    public let zoomLevel: Double

    /// 方向（0-360度）
    public let direction: CLLocationDirection

    /// 俯视角度（0-45度）
    public let pitch: CGFloat

    public init(
        center: CLLocationCoordinate2D,
        zoomLevel: Double = 12,
        direction: CLLocationDirection = 0,
        pitch: CGFloat = 0
    ) {
        self.center = center
        self.zoomLevel = zoomLevel
        self.direction = direction
        self.pitch = pitch
    }

    /// 应用到地图视图
    @MainActor
    public func apply(to mapView: MLNMapView, animated: Bool = true) {
        mapView.setCenter(
            center,
            zoomLevel: zoomLevel,
            direction: direction,
            animated: animated
        )
        mapView.camera.pitch = pitch
    }
}

#endif // canImport(MapLibre)
