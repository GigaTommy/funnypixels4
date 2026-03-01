# iOS Map & Pixel Renderer Skill

**描述**: 实现基于MapKit的地图容器和像素渲染系统

**使用场景**:
- 设置MapKit地图容器
- 实现像素Chunk/Tile数据结构
- 实现基础像素渲染（低密度场景）
- 实现LOD缩放策略
- 地图平移/缩放与像素同步

**参数**:
- `map_type`: apple/custom（默认apple/MapKit）
- `tile_size`: Chunk大小（默认1000x1000米）
- `max_pixels_per_tile`: 每个tile最大像素数（默认1000）

**实现步骤**:

## 1. 创建像素数据结构

```swift
// Sources/FunnyPixels/Models/PixelTile.swift

import Foundation
import MapKit

/// 像素Tile（区块）数据结构
public struct PixelTile: Identifiable, Codable {
    public let id: String
    public let bounds: TileBounds
    public let zoomLevel: Int
    public let pixels: [Pixel]
    public let lastUpdated: Date

    public init(
        id: String = UUID().uuidString,
        bounds: TileBounds,
        zoomLevel: Int,
        pixels: [Pixel],
        lastUpdated: Date = Date()
    ) {
        self.id = id
        self.bounds = bounds
        self.zoomLevel = zoomLevel
        self.pixels = pixels
        self.lastUpdated = lastUpdated
    }
}

/// Tile边界
public struct TileBounds: Codable, Hashable {
    public let minLatitude: Double
    public let maxLatitude: Double
    public let minLongitude: Double
    public let maxLongitude: Double

    /// 转换为MKMapRect
    public var mapRect: MKMapRect {
        let topLeft = MKMapPoint(CLLocationCoordinate2D(
            latitude: maxLatitude,
            longitude: minLongitude
        ))
        let bottomRight = MKMapPoint(CLLocationCoordinate2D(
            latitude: minLatitude,
            longitude: maxLongitude
        ))

        return MKMapRect(
            x: topLeft.x,
            y: topLeft.y,
            width: bottomRight.x - topLeft.x,
            height: bottomRight.y - topLeft.y
        )
    }

    /// 检查是否包含坐标
    public func contains(_ coordinate: CLLocationCoordinate2D) -> Bool {
        return coordinate.latitude >= minLatitude &&
               coordinate.latitude <= maxLatitude &&
               coordinate.longitude >= minLongitude &&
               coordinate.longitude <= maxLongitude
    }
}
```

## 2. 实现Tile管理器

```swift
// Sources/FunnyPixels/Services/PixelTileManager.swift

import Foundation
import MapKit

public actor PixelTileManager {
    private var tileCache: [String: PixelTile] = [:]
    private let cacheLimit = 100 // 最多缓存100个tile
    private var accessOrder: [String] = [] // LRU

    public init() {}

    /// 获取指定区域的Tile
    public func fetchTile(for bounds: TileBounds, zoom: Int) async throws -> PixelTile {
        let tileKey = generateTileKey(bounds: bounds, zoom: zoom)

        // 检查缓存
        if let cached = tileCache[tileKey] {
            updateAccessOrder(tileKey)
            return cached
        }

        // 从API获取
        let tile = try await fetchFromAPI(bounds: bounds, zoom: zoom)

        // 存入缓存
        cacheTile(tile, key: tileKey)

        return tile
    }

    /// 根据地图可见区域获取所需的Tiles
    public func tilesForVisibleRegion(_ region: MKCoordinateRegion, zoom: Int) -> [TileBounds] {
        let tileSize = tileSizeForZoom(zoom)

        // 计算需要的tile数量
        let minLat = region.center.latitude - region.span.latitudeDelta / 2
        let maxLat = region.center.latitude + region.span.latitudeDelta / 2
        let minLon = region.center.longitude - region.span.longitudeDelta / 2
        let maxLon = region.center.longitude + region.span.longitudeDelta / 2

        var tiles: [TileBounds] = []

        var lat = minLat
        while lat < maxLat {
            var lon = minLon
            while lon < maxLon {
                tiles.append(TileBounds(
                    minLatitude: lat,
                    maxLatitude: min(lat + tileSize, maxLat),
                    minLongitude: lon,
                    maxLongitude: min(lon + tileSize, maxLon)
                ))
                lon += tileSize
            }
            lat += tileSize
        }

        return tiles
    }

    /// 清除缓存
    public func clearCache() {
        tileCache.removeAll()
        accessOrder.removeAll()
    }

    // MARK: - Private

    private func generateTileKey(bounds: TileBounds, zoom: Int) -> String {
        return "\(zoom)_\(bounds.minLatitude)_\(bounds.minLongitude)"
    }

    private func tileSizeForZoom(_ zoom: Int) -> Double {
        // Zoom级别越高，tile越小
        switch zoom {
        case 0...10:
            return 1.0 // 1度 ≈ 111km
        case 11...14:
            return 0.1 // 0.1度 ≈ 11km
        case 15...17:
            return 0.01 // 0.01度 ≈ 1.1km
        default:
            return 0.001 // 0.001度 ≈ 111m
        }
    }

    private func fetchFromAPI(bounds: TileBounds, zoom: Int) async throws -> PixelTile {
        // TODO: 调用实际API
        // let url = URL(string: "\(apiBase)/pixels/tile?...")
        // let data = try await URLSession.shared.data(from: url).0
        // return try JSONDecoder().decode(PixelTile.self, from: data)

        // 临时返回空tile
        return PixelTile(
            bounds: bounds,
            zoomLevel: zoom,
            pixels: []
        )
    }

    private func cacheTile(_ tile: PixelTile, key: String) {
        // LRU淘汰策略
        if tileCache.count >= cacheLimit, let oldestKey = accessOrder.first {
            tileCache.removeValue(forKey: oldestKey)
            accessOrder.removeFirst()
        }

        tileCache[key] = tile
        accessOrder.append(key)
    }

    private func updateAccessOrder(_ key: String) {
        accessOrder.removeAll { $0 == key }
        accessOrder.append(key)
    }
}
```

## 3. 实现LOD渲染策略

```swift
// Sources/FunnyPixels/Rendering/PixelLODStrategy.swift

import Foundation
import MapKit

/// LOD (Level of Detail) 渲染策略
public struct PixelLODStrategy {

    /// 根据缩放级别确定渲染策略
    public static func renderingMode(for zoomLevel: Int) -> RenderingMode {
        switch zoomLevel {
        case 0...10:
            return .clustered(gridSize: 10000) // 10km聚合
        case 11...14:
            return .clustered(gridSize: 1000)  // 1km聚合
        case 15...17:
            return .simplified                 // 简化渲染（降低分辨率）
        default:
            return .full                       // 完整渲染
        }
    }

    /// 计算地图缩放级别
    public static func zoomLevel(from region: MKCoordinateRegion) -> Int {
        let longitudeDelta = region.span.longitudeDelta

        // 基于经度跨度计算缩放级别
        if longitudeDelta > 180 {
            return 0
        } else if longitudeDelta > 90 {
            return 2
        } else if longitudeDelta > 45 {
            return 4
        } else if longitudeDelta > 20 {
            return 6
        } else if longitudeDelta > 10 {
            return 8
        } else if longitudeDelta > 5 {
            return 10
        } else if longitudeDelta > 2 {
            return 12
        } else if longitudeDelta > 1 {
            return 14
        } else if longitudeDelta > 0.5 {
            return 16
        } else {
            return 18
        }
    }
}

public enum RenderingMode {
    case clustered(gridSize: Double)  // 聚合显示（米）
    case simplified                   // 简化渲染
    case full                         // 完整渲染
}
```

## 4. 实现像素渲染器

```swift
// Sources/FunnyPixels/Rendering/PixelRenderer.swift

import SwiftUI
import MapKit

/// 像素渲染视图（MapKit Annotation）
public struct PixelAnnotationView: View {
    let pixel: Pixel
    let renderMode: RenderingMode

    public var body: some View {
        switch renderMode {
        case .full:
            fullRender
        case .simplified:
            simplifiedRender
        case .clustered:
            Circle()
                .fill(Color.blue)
                .frame(width: 4, height: 4)
        }
    }

    private var fullRender: some View {
        Rectangle()
            .fill(Color(hex: pixel.color) ?? .red)
            .frame(width: 10, height: 10)
            .overlay(
                Rectangle()
                    .stroke(Color.white.opacity(0.3), lineWidth: 0.5)
            )
    }

    private var simplifiedRender: some View {
        Rectangle()
            .fill(Color(hex: pixel.color) ?? .red)
            .frame(width: 6, height: 6)
    }
}

// Color hex extension
extension Color {
    init?(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch hex.count {
        case 6: // RGB
            (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8: // ARGB
            (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default:
            return nil
        }

        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue:  Double(b) / 255,
            opacity: Double(a) / 255
        )
    }
}
```

## 5. 集成到MapView

```swift
// Sources/FunnyPixels/Views/MapView.swift 扩展

extension MapViewModel {
    /// 地图区域变化时的处理
    func mapRegionDidChange(_ region: MKCoordinateRegion) {
        let zoomLevel = PixelLODStrategy.zoomLevel(from: region)
        let renderMode = PixelLODStrategy.renderingMode(for: zoomLevel)

        // 获取需要的tiles
        Task {
            let tileBounds = await tileManager.tilesForVisibleRegion(region, zoom: zoomLevel)

            for bounds in tileBounds {
                do {
                    let tile = try await tileManager.fetchTile(for: bounds, zoom: zoomLevel)
                    await MainActor.run {
                        // 更新显示的像素
                        updatePixels(from: tile, renderMode: renderMode)
                    }
                } catch {
                    print("Failed to fetch tile: \(error)")
                }
            }
        }
    }

    private func updatePixels(from tile: PixelTile, renderMode: RenderingMode) {
        // 根据渲染模式处理像素
        switch renderMode {
        case .clustered(let gridSize):
            // 聚合像素
            let clustered = clusterPixels(tile.pixels, gridSize: gridSize)
            visiblePixels = clustered
        case .simplified:
            // 降采样
            let sampled = samplePixels(tile.pixels, ratio: 0.5)
            visiblePixels = sampled
        case .full:
            // 完整显示
            visiblePixels = tile.pixels
        }
    }
}
```

## 验收标准

- ✅ PixelTile数据结构定义完成
- ✅ PixelTileManager实现缓存和LRU淘汰
- ✅ LOD策略根据缩放级别切换
- ✅ 地图区域变化时自动加载tiles
- ✅ 像素渲染性能良好（60fps）
- ✅ 缓存命中率 > 70%

## 性能优化建议

1. **分批渲染**: 超过1000个像素时分批渲染
2. **虚拟化**: 只渲染可见区域的像素
3. **降采样**: 高缩放级别使用降采样
4. **GPU加速**: 考虑使用Metal进行大规模渲染

## 测试方法

```swift
// Tests/FunnyPixelsTests/PixelTileTests.swift

import XCTest
@testable import FunnyPixels

class PixelTileTests: XCTestCase {
    func testTileBoundsContains() {
        let bounds = TileBounds(
            minLatitude: 39.0,
            maxLatitude: 40.0,
            minLongitude: 116.0,
            maxLongitude: 117.0
        )

        XCTAssertTrue(bounds.contains(CLLocationCoordinate2D(latitude: 39.5, longitude: 116.5)))
        XCTAssertFalse(bounds.contains(CLLocationCoordinate2D(latitude: 38.5, longitude: 116.5)))
    }

    func testZoomLevelCalculation() {
        let region = MKCoordinateRegion(
            center: CLLocationCoordinate2D(latitude: 39.9, longitude: 116.4),
            span: MKCoordinateSpan(latitudeDelta: 0.05, longitudeDelta: 0.05)
        )

        let zoom = PixelLODStrategy.zoomLevel(from: region)
        XCTAssertGreaterThan(zoom, 15)
    }
}
```

## 依赖工具

- MapKit
- CoreLocation
- Combine (for reactive updates)
