import Foundation
import Combine
import MapKit

/// PNG瓦片叠加层 - 从后端加载预渲染的PNG瓦片
public class PixelTileOverlay: MKTileOverlay {
    /// 缓存管理器
    private let cache = TileCache.shared

    /// 初始化瓦片叠加层
    /// - Parameters:
    ///   - urlTemplate: 瓦片URL模板，默认使用后端API
    public override init(urlTemplate: String? = nil) {
        let template = urlTemplate ?? "\(AppEnvironment.current.apiBaseURL)/tiles/{z}/{x}/{y}.png"
        super.init(urlTemplate: template)

        // 配置瓦片属性
        self.canReplaceMapContent = false  // 不替换底图，只叠加
        self.tileSize = CGSize(width: 256, height: 256)
        self.minimumZ = 0
        self.maximumZ = 18
    }

    /// 加载瓦片
    public func loadTile(at path: MKTileOverlayPath) async -> Data? {
        // 使用父类的URL模板构造完整URL
        guard let template = self.urlTemplate else { return nil }
        guard let url = URL(string: template.replacingOccurrences(of: "{z}", with: "\(path.z)")
            .replacingOccurrences(of: "{x}", with: "\(path.x)")
            .replacingOccurrences(of: "{y}", with: "\(path.y)")) else {
            return nil
        }

        let tileURL = url.absoluteString

        // 检查缓存
        if let cachedData = await cache.data(for: tileURL) {
            return cachedData
        }

        // 从网络加载
        do {
            let data = try Data(contentsOf: url)

            // 缓存数据
            await cache.setData(data, for: tileURL)

            return data
        } catch {
            Logger.error("加载瓦片失败: \(tileURL), 错误: \(error)")
            return nil
        }
    }
}

// MARK: - Tile Cache

/// 瓦片缓存管理器
public actor TileCache {
    /// 单例
    public static let shared = TileCache()

    /// 内存缓存
    private var memoryCache = NSCache<NSString, NSData>()

    /// 缓存限制（字节）
    private let cacheLimit = 50 * 1024 * 1024  // 50MB

    private init() {
        memoryCache.totalCostLimit = cacheLimit
        memoryCache.countLimit = 100  // 最多缓存100个瓦片
    }

    /// 获取缓存数据
    public func data(for url: String) -> Data? {
        let key = url as NSString
        return memoryCache.object(forKey: key) as Data?
    }

    /// 设置缓存数据
    public func setData(_ data: Data, for url: String) {
        let key = url as NSString
        memoryCache.setObject(data as NSData, forKey: key, cost: data.count)
    }

    /// 清空缓存
    public func clear() {
        memoryCache.removeAllObjects()
    }

    /// 移除指定URL的缓存
    public func remove(for url: String) {
        let key = url as NSString
        memoryCache.removeObject(forKey: key)
    }
}

// MARK: - MKTileOverlayPath Extension

extension MKTileOverlayPath {
    /// 转换为瓦片ID字符串
    public var tileId: String {
        return "\(z)/\(x)/\(y)"
    }
}

// MARK: - Tile Overlay Renderer

/// 瓦片渲染器 - 用于在MapKit上显示瓦片
public class PixelTileOverlayRenderer: MKTileOverlayRenderer {
    public init(overlay: MKTileOverlay) {
        super.init(tileOverlay: overlay)
    }

    /// 重写绘制方法，支持透明度混合
    public override func draw(_ mapRect: MKMapRect, zoomScale: MKZoomScale, in context: CGContext) {
        // 绘制瓦片
        super.draw(mapRect, zoomScale: zoomScale, in: context)

        // 可以在这里添加自定义渲染逻辑，比如：
        // - 边框效果
        // - 高亮显示
        // - 水印等
    }
}
