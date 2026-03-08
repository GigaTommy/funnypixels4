import SwiftUI
import MapLibre

/// 足迹地图视图 - 显示所有绘制会话的地理分布
struct FootprintMapView: View {
    let sessions: [DrawingSession]
    let onSessionTap: ((String) -> Void)?

    @State private var selectedCity: String?
    @State private var showCitySheet = false

    // 城市分组的会话
    private var sessionsByCity: [String: [DrawingSession]] {
        Dictionary(grouping: sessions) { session in
            session.startCity ?? "Unknown"
        }
    }

    // 城市标记点
    private var cityMarkers: [CityMarker] {
        sessionsByCity.compactMap { city, citySessions in
            guard let coordinate = CityCoordinates.coordinate(for: city) else {
                return nil
            }
            return CityMarker(
                city: city,
                coordinate: coordinate,
                sessionCount: citySessions.count,
                totalPixels: citySessions.compactMap { $0.statistics?.pixelCount }.reduce(0, +)
            )
        }
    }

    var body: some View {
        ZStack(alignment: .top) {
            // 地图视图
            FootprintMapWrapper(
                markers: cityMarkers,
                onMarkerTap: { marker in
                    selectedCity = marker.city
                    showCitySheet = true
                }
            )
            .ignoresSafeArea()

            // 顶部统计卡片
            if !sessions.isEmpty {
                footprintSummaryCard
                    .padding()
            }

            // 空状态提示
            if sessions.isEmpty {
                emptyStateView
            }
        }
        .sheet(isPresented: $showCitySheet) {
            if let city = selectedCity {
                CitySessionsSheet(
                    city: city,
                    sessions: sessionsByCity[city] ?? [],
                    onSessionTap: { sessionId in
                        showCitySheet = false
                        onSessionTap?(sessionId)
                    }
                )
                .presentationDetents([.medium, .large])
            }
        }
    }

    // MARK: - 足迹统计卡片

    private var footprintSummaryCard: some View {
        HStack(spacing: 16) {
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 6) {
                    Image(systemName: "map.fill")
                        .foregroundColor(.blue)
                    Text("我的足迹")
                        .font(.subheadline)
                        .fontWeight(.semibold)
                }

                HStack(spacing: 12) {
                    StatBadge(
                        icon: "location.fill",
                        value: "\(sessionsByCity.count)",
                        label: "城市"
                    )

                    StatBadge(
                        icon: "paintbrush.fill",
                        value: "\(sessions.count)",
                        label: "会话"
                    )
                }
                .font(.caption)
            }

            Spacer()
        }
        .padding()
        .background(.ultraThinMaterial)
        .cornerRadius(12)
        .shadow(radius: 4)
    }

    // MARK: - 空状态

    private var emptyStateView: some View {
        VStack(spacing: 16) {
            Image(systemName: "map")
                .font(.system(size: 60))
                .foregroundColor(.secondary)

            Text("还没有足迹记录")
                .font(.title3)
                .fontWeight(.semibold)

            Text("开始你的第一次创作吧")
                .font(.caption)
                .foregroundColor(.secondary)
        }
    }
}

// MARK: - 统计徽章

struct StatBadge: View {
    let icon: String
    let value: String
    let label: String

    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: icon)
                .font(.caption2)
            Text(value)
                .fontWeight(.semibold)
            Text(label)
                .foregroundColor(.secondary)
        }
    }
}

// MARK: - 城市标记

struct CityMarker: Identifiable {
    let id = UUID()
    let city: String
    let coordinate: CLLocationCoordinate2D
    let sessionCount: Int
    let totalPixels: Int
}

// MARK: - MapView封装（UIViewRepresentable）

struct FootprintMapWrapper: UIViewRepresentable {
    let markers: [CityMarker]
    let onMarkerTap: ((CityMarker) -> Void)?

    func makeUIView(context: Context) -> MLNMapView {
        let mapView = MLNMapView(frame: .zero)
        mapView.delegate = context.coordinator
        mapView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        mapView.logoView.isHidden = true
        mapView.attributionButton.isHidden = true

        // 基本配置
        mapView.isZoomEnabled = true
        mapView.isScrollEnabled = true
        mapView.isRotateEnabled = false
        mapView.isPitchEnabled = false

        // 使用项目的地图样式
        mapView.styleURL = URL(string: AppConfig.mapTileURL)

        // 设置初始视图
        if let firstMarker = markers.first {
            mapView.setCenter(
                firstMarker.coordinate,
                zoomLevel: 4,
                animated: false
            )
        } else {
            // 默认中国中心点
            mapView.setCenter(
                CLLocationCoordinate2D(latitude: 35.0, longitude: 105.0),
                zoomLevel: 3,
                animated: false
            )
        }

        return mapView
    }

    func updateUIView(_ mapView: MLNMapView, context: Context) {
        // 更新标记
        context.coordinator.updateMarkers(on: mapView, markers: markers)

        // 如果有多个标记，调整视图以显示所有标记
        if markers.count > 1 {
            let annotations = mapView.annotations ?? []
            if !annotations.isEmpty {
                mapView.showAnnotations(
                    annotations,
                    edgePadding: UIEdgeInsets(top: 150, left: 50, bottom: 200, right: 50),
                    animated: true,
                    completionHandler: nil
                )
            }
        }
    }

    func makeCoordinator() -> Coordinator {
        Coordinator(onMarkerTap: onMarkerTap)
    }

    // MARK: - Coordinator

    class Coordinator: NSObject, MLNMapViewDelegate {
        let onMarkerTap: ((CityMarker) -> Void)?
        var markerMapping: [String: CityMarker] = [:]

        init(onMarkerTap: ((CityMarker) -> Void)?) {
            self.onMarkerTap = onMarkerTap
        }

        func updateMarkers(on mapView: MLNMapView, markers: [CityMarker]) {
            // 移除旧标记
            if let existingAnnotations = mapView.annotations {
                mapView.removeAnnotations(existingAnnotations)
            }

            // 添加新标记
            markerMapping.removeAll()
            for marker in markers {
                let annotation = MLNPointAnnotation()
                annotation.coordinate = marker.coordinate
                annotation.title = marker.city
                annotation.subtitle = "\(marker.sessionCount)个会话 • \(marker.totalPixels)像素"
                mapView.addAnnotation(annotation)

                markerMapping[marker.city] = marker
            }
        }

        func mapView(_ mapView: MLNMapView, didSelect annotation: MLNAnnotation) {
            guard let title = annotation.title as? String,
                  let marker = markerMapping[title] else {
                return
            }
            onMarkerTap?(marker)
        }

        func mapView(_ mapView: MLNMapView, imageFor annotation: MLNAnnotation) -> MLNAnnotationImage? {
            let reuseIdentifier = "city-marker"

            if let existingImage = mapView.dequeueReusableAnnotationImage(withIdentifier: reuseIdentifier) {
                return existingImage
            }

            // 创建自定义标记图标
            let size = CGSize(width: 40, height: 40)
            let renderer = UIGraphicsImageRenderer(size: size)
            let image = renderer.image { context in
                // 绘制圆形背景
                UIColor.systemBlue.setFill()
                context.cgContext.fillEllipse(in: CGRect(origin: .zero, size: size))

                // 绘制白色边框
                UIColor.white.setStroke()
                context.cgContext.setLineWidth(3)
                context.cgContext.strokeEllipse(in: CGRect(origin: .zero, size: size).insetBy(dx: 1.5, dy: 1.5))
            }

            return MLNAnnotationImage(image: image, reuseIdentifier: reuseIdentifier)
        }

        // 地图样式加载失败时的回退处理
        func mapViewDidFailLoadingMap(_ mapView: MLNMapView, withError error: Error) {
            Logger.error("❌ 足迹地图加载失败: \(error.localizedDescription)")
            // 可以尝试加载备用地图样式
        }
    }
}

// MARK: - 城市坐标映射

struct CityCoordinates {
    private static let coordinates: [String: CLLocationCoordinate2D] = [
        // 中国主要城市
        "北京": CLLocationCoordinate2D(latitude: 39.9042, longitude: 116.4074),
        "上海": CLLocationCoordinate2D(latitude: 31.2304, longitude: 121.4737),
        "广州": CLLocationCoordinate2D(latitude: 23.1291, longitude: 113.2644),
        "深圳": CLLocationCoordinate2D(latitude: 22.5431, longitude: 114.0579),
        "成都": CLLocationCoordinate2D(latitude: 30.5728, longitude: 104.0668),
        "杭州": CLLocationCoordinate2D(latitude: 30.2741, longitude: 120.1551),
        "重庆": CLLocationCoordinate2D(latitude: 29.4316, longitude: 106.9123),
        "西安": CLLocationCoordinate2D(latitude: 34.3416, longitude: 108.9398),
        "武汉": CLLocationCoordinate2D(latitude: 30.5928, longitude: 114.3055),
        "南京": CLLocationCoordinate2D(latitude: 32.0603, longitude: 118.7969),
        "天津": CLLocationCoordinate2D(latitude: 39.3434, longitude: 117.3616),
        "苏州": CLLocationCoordinate2D(latitude: 31.2989, longitude: 120.5853),
        "郑州": CLLocationCoordinate2D(latitude: 34.7466, longitude: 113.6253),
        "长沙": CLLocationCoordinate2D(latitude: 28.2282, longitude: 112.9388),
        "沈阳": CLLocationCoordinate2D(latitude: 41.8057, longitude: 123.4315),

        // 国际主要城市
        "New York": CLLocationCoordinate2D(latitude: 40.7128, longitude: -74.0060),
        "London": CLLocationCoordinate2D(latitude: 51.5074, longitude: -0.1278),
        "Paris": CLLocationCoordinate2D(latitude: 48.8566, longitude: 2.3522),
        "Tokyo": CLLocationCoordinate2D(latitude: 35.6762, longitude: 139.6503),
        "Singapore": CLLocationCoordinate2D(latitude: 1.3521, longitude: 103.8198),
        "Sydney": CLLocationCoordinate2D(latitude: -33.8688, longitude: 151.2093),
        "San Francisco": CLLocationCoordinate2D(latitude: 37.7749, longitude: -122.4194),
        "Los Angeles": CLLocationCoordinate2D(latitude: 34.0522, longitude: -118.2437),
        "Seoul": CLLocationCoordinate2D(latitude: 37.5665, longitude: 126.9780),
        "Hong Kong": CLLocationCoordinate2D(latitude: 22.3193, longitude: 114.1694),
    ]

    static func coordinate(for city: String) -> CLLocationCoordinate2D? {
        return coordinates[city]
    }
}

// MARK: - 城市会话列表Sheet

struct CitySessionsSheet: View {
    let city: String
    let sessions: [DrawingSession]
    let onSessionTap: ((String) -> Void)?

    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                LazyVStack(spacing: 12) {
                    ForEach(sessions) { session in
                        NavigationLink(destination: SessionDetailView(sessionId: session.id)) {
                            ArtworkListRow(session: session)
                        }
                        .buttonStyle(PlainButtonStyle())
                        .simultaneousGesture(TapGesture().onEnded {
                            dismiss()
                        })
                    }
                }
                .padding()
            }
            .navigationTitle(city)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("关闭") {
                        dismiss()
                    }
                }
            }
        }
    }
}

#Preview {
    FootprintMapView(
        sessions: [],
        onSessionTap: nil
    )
}
