import SwiftUI
import MapKit
import Combine

/// 会话详情地图视图 - 仅显示地图部分，用于动态流预览
struct SessionDetailMapView: View {
    @ObservedObject private var fontManager = FontSizeManager.shared
    let sessionId: String
    @StateObject private var viewModel = SessionMapViewModel()
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ZStack {
                if viewModel.isLoading {
                    ProgressView()
                } else if !viewModel.pixels.isEmpty {
                    // 地图显示轨迹
                    Map(position: .constant(viewModel.mapPosition)) {
                        // 绘制轨迹线
                        if viewModel.pixels.count > 1 {
                            MapPolyline(coordinates: viewModel.pixelCoordinates)
                                .stroke(.blue, lineWidth: 3)
                        }

                        // 显示像素点（使用联盟旗帜）
                        ForEach(viewModel.pixels) { pixel in
                            Annotation("", coordinate: CLLocationCoordinate2D(
                                latitude: pixel.latitude,
                                longitude: pixel.longitude
                            )) {
                                if let patternId = pixel.patternId, !patternId.isEmpty {
                                    AllianceBadge(patternId: patternId, size: 16)
                                } else {
                                    Circle()
                                        .fill(.red)
                                        .frame(width: 8, height: 8)
                                        .overlay(
                                            Circle()
                                                .stroke(.white, lineWidth: 2)
                                        )
                                }
                            }
                        }
                    }
                    .edgesIgnoringSafeArea(.all)
                } else {
                    // 空状态
                    VStack(spacing: 16) {
                        Image(systemName: "map")
                            .font(.system(size: 48))
                            .foregroundColor(.gray)
                        Text("无绘制数据")
                            .font(.body)
                            .foregroundColor(.secondary)
                    }
                }
            }
            .navigationTitle("绘制轨迹")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("完成") {
                        dismiss()
                    }
                }
            }
            .task {
                await viewModel.loadSession(id: sessionId)
            }
        }
    }
}

/// 会话地图ViewModel - 简化版，只加载地图所需数据
@MainActor
class SessionMapViewModel: ObservableObject {
    @Published var pixels: [SessionPixel] = []
    @Published var isLoading = false
    @Published var mapPosition: MapCameraPosition = .automatic

    func loadSession(id: String) async {
        guard !isLoading else { return }

        isLoading = true
        defer { isLoading = false }

        do {
            // 加载像素数据
            let pixels = try await DrawingHistoryService.shared.getSessionPixels(id: id)
            self.pixels = pixels

            // 计算地图范围
            if !pixels.isEmpty {
                let coordinates = pixels.map { CLLocationCoordinate2D(latitude: $0.latitude, longitude: $0.longitude) }
                let region = calculateRegion(for: coordinates)
                self.mapPosition = .region(region)
            }
        } catch {
            Logger.error("Failed to load session map: \(error)")
        }
    }

    var pixelCoordinates: [CLLocationCoordinate2D] {
        pixels.map { CLLocationCoordinate2D(latitude: $0.latitude, longitude: $0.longitude) }
    }

    private func calculateRegion(for coordinates: [CLLocationCoordinate2D]) -> MKCoordinateRegion {
        guard !coordinates.isEmpty else {
            return MKCoordinateRegion(
                center: CLLocationCoordinate2D(latitude: 0, longitude: 0),
                span: MKCoordinateSpan(latitudeDelta: 0.01, longitudeDelta: 0.01)
            )
        }

        let lats = coordinates.map { $0.latitude }
        let lons = coordinates.map { $0.longitude }

        let minLat = lats.min() ?? 0
        let maxLat = lats.max() ?? 0
        let minLon = lons.min() ?? 0
        let maxLon = lons.max() ?? 0

        let center = CLLocationCoordinate2D(
            latitude: (minLat + maxLat) / 2,
            longitude: (minLon + maxLon) / 2
        )

        let span = MKCoordinateSpan(
            latitudeDelta: max((maxLat - minLat) * 1.3, 0.01),
            longitudeDelta: max((maxLon - minLon) * 1.3, 0.01)
        )

        return MKCoordinateRegion(center: center, span: span)
    }
}
