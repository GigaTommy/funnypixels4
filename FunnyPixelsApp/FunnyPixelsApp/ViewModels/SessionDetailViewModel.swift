import Foundation
import MapKit
import Combine
import SwiftUI

/// 会话详情ViewModel
@MainActor
class SessionDetailViewModel: ObservableObject {
    @Published var session: DrawingSession?
    @Published var pixels: [SessionPixel] = []
    @Published var isLoading = false
    @Published var errorMessage: String?
    
    private let service = DrawingHistoryService.shared
    
    /// 地图位置
    var mapPosition: MapCameraPosition {
        guard !pixels.isEmpty else {
            return .automatic
        }
        
        // 计算所有像素的边界
        let coordinates = pixels.map { CLLocationCoordinate2D(latitude: $0.latitude, longitude: $0.longitude) }
        
        let minLat = coordinates.map { $0.latitude }.min() ?? 0
        let maxLat = coordinates.map { $0.latitude }.max() ?? 0
        let minLon = coordinates.map { $0.longitude }.min() ?? 0
        let maxLon = coordinates.map { $0.longitude }.max() ?? 0
        
        let center = CLLocationCoordinate2D(
            latitude: (minLat + maxLat) / 2,
            longitude: (minLon + maxLon) / 2
        )
        
        let span = MKCoordinateSpan(
            latitudeDelta: max(maxLat - minLat, 0.001) * 1.5,
            longitudeDelta: max(maxLon - minLon, 0.001) * 1.5
        )
        
        return .region(MKCoordinateRegion(center: center, span: span))
    }
    
    /// 像素坐标数组（用于绘制路径）
    var pixelCoordinates: [CLLocationCoordinate2D] {
        pixels.map { CLLocationCoordinate2D(latitude: $0.latitude, longitude: $0.longitude) }
    }
    
    /// 加载会话详情
    func loadSessionDetail(id: String) async {
        isLoading = true
        errorMessage = nil

        do {
            let detail = try await service.getSessionDetail(id: id)
            session = detail.session

            // 🐛 Debug: Log received data
            Logger.info("📊 SessionDetailViewModel: Received session=\(detail.session.id), pixels count=\(detail.pixels.count)")
            if detail.pixels.count > 0 {
                let firstPixel = detail.pixels[0]
                Logger.info("📊 First pixel: gridId=\(firstPixel.gridId), patternId=\(firstPixel.patternId ?? "nil"), color=\(firstPixel.color ?? "nil")")
            } else {
                Logger.warning("⚠️ SessionDetailViewModel: No pixels received from API")
            }

            // 🔧 Fix: 按 gridId 去重，保留每个网格最后一次绘制的像素
            // 后端 pixels_history 表包含所有绘制记录（含重复网格），需要在客户端去重
            var seenGridIds = Set<String>()
            var uniquePixels: [SessionPixel] = []
            for pixel in detail.pixels {
                if !seenGridIds.contains(pixel.gridId) {
                    seenGridIds.insert(pixel.gridId)
                    uniquePixels.append(pixel)
                }
            }

            if uniquePixels.count != detail.pixels.count {
                Logger.info("🔧 像素去重: \(detail.pixels.count) → \(uniquePixels.count)（移除 \(detail.pixels.count - uniquePixels.count) 个重复网格）")
            }

            pixels = uniquePixels

            Logger.info("✅ 会话详情加载成功: \(pixels.count) 个唯一像素")

            // 🐛 Debug: Sample pattern IDs
            let samplePatternIds = uniquePixels.prefix(3).map { $0.patternId ?? "nil" }.joined(separator: ", ")
            Logger.info("📊 Sample pattern IDs: [\(samplePatternIds)]")
        } catch {
            errorMessage = "加载失败: \(error.localizedDescription)"
            Logger.error("❌ 加载会话详情失败: \(error)")
        }

        isLoading = false
    }
}
