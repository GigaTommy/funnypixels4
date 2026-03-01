import SwiftUI
import MapKit
import CoreLocation

/// A simple location picker using MapKit (Modern API)
struct TestLocationPickerView: View {
    @Environment(\.dismiss) var dismiss

    @State private var position: MapCameraPosition
    @State private var currentCenter: CLLocationCoordinate2D
    @State private var currentSpan = MKCoordinateSpan(latitudeDelta: 0.005, longitudeDelta: 0.005)
    @State private var locationName: String = "正在获取位置..."
    @State private var isGeocodingInProgress = false

    var onSelect: (CLLocationCoordinate2D) -> Void

    // Fallback: Xiamen Gulangyu
    private static let fallbackCenter = CLLocationCoordinate2D(latitude: 24.4439, longitude: 118.0655)

    init(onSelect: @escaping (CLLocationCoordinate2D) -> Void) {
        self.onSelect = onSelect
        let center = MapController.shared.cachedCenter ?? Self.fallbackCenter
        _position = State(initialValue: .region(MKCoordinateRegion(
            center: center,
            span: MKCoordinateSpan(latitudeDelta: 0.005, longitudeDelta: 0.005)
        )))
        _currentCenter = State(initialValue: center)
    }
    
    var body: some View {
        NavigationStack {
            ZStack {
                // Map View using iOS 17+ API
                Map(position: $position) {
                    UserAnnotation()
                }
                .onMapCameraChange(frequency: .continuous) { context in
                    currentCenter = context.camera.centerCoordinate
                    currentSpan = context.region.span
                }
                .onMapCameraChange(frequency: .onEnd) { context in
                    // 仅在停止拖动时触发地理编码，避免频繁请求
                    reverseGeocode(coordinate: context.camera.centerCoordinate)
                }
                .edgesIgnoringSafeArea(.all)
                
                // Center Target Pin
                ZStack {
                    Circle()
                        .fill(Color.white.opacity(0.8))
                        .frame(width: 20, height: 20)
                    
                    Image(systemName: "plus")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundColor(.black)
                    
                    Image(systemName: "mappin")
                        .font(.system(size: 40))
                        .foregroundColor(.red)
                        .offset(y: -20)
                        .shadow(radius: 2)
                }
                .padding(.bottom, 20) // Adjust visual center slightly if needed
                
                // Zoom Controls (Right Side)
                HStack {
                    Spacer()
                    VStack(spacing: 12) {
                        Spacer()
                        
                        Button(action: zoomIn) {
                            Image(systemName: "plus")
                                .font(.system(size: 20, weight: .semibold))
                                .foregroundColor(.blue)
                                .frame(width: 44, height: 44)
                                .background(Color.white)
                                .clipShape(Circle())
                                .shadow(color: .black.opacity(0.15), radius: 4, x: 0, y: 2)
                        }
                        
                        Button(action: zoomOut) {
                            Image(systemName: "minus")
                                .font(.system(size: 20, weight: .semibold))
                                .foregroundColor(.blue)
                                .frame(width: 44, height: 44)
                                .background(Color.white)
                                .clipShape(Circle())
                                .shadow(color: .black.opacity(0.15), radius: 4, x: 0, y: 2)
                        }
                        
                        // Spacer to lift above bottom sheet controls
                        Spacer().frame(height: 140)
                    }
                    .padding(.trailing, 16)
                }
                
                // Bottom Controls
                VStack {
                    Spacer()
                    
                    // Location Info Card
                    VStack(spacing: 4) {
                        // 地址名称
                        Text(locationName)
                            .font(.system(size: 14, weight: .medium))
                            .foregroundColor(.primary)
                            .multilineTextAlignment(.center)
                            .lineLimit(2)

                        // 坐标
                        Text(String(format: "%.6f, %.6f", currentCenter.latitude, currentCenter.longitude))
                            .font(.system(size: 11))
                            .foregroundColor(.secondary)
                    }
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                    .background(.regularMaterial)
                    .cornerRadius(12)
                    .shadow(color: .black.opacity(0.1), radius: 4, x: 0, y: 2)
                    .padding(.bottom, 8)
                    
                    Button(action: {
                        Logger.info("🎯 [LocationPicker] User selected coordinate: \(currentCenter.latitude), \(currentCenter.longitude)")
                        Logger.info("🎯 [LocationPicker] Location name: \(locationName)")
                        onSelect(currentCenter)
                        dismiss()
                    }) {
                        Text("Start Test Here")
                            .font(.headline)
                            .foregroundColor(.white)
                            .frame(maxWidth: .infinity)
                            .frame(height: 50)
                            .background(Color.blue)
                            .cornerRadius(12)
                            .shadow(radius: 4)
                    }
                    .padding(.horizontal, 32)
                    .padding(.bottom, 20)
                }
            }
            .navigationTitle("Select Test Location")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") {
                        dismiss()
                    }
                }
            }
        }
        .onAppear {
            // 初始加载时获取地址
            reverseGeocode(coordinate: currentCenter)
        }
    }
    
    // MARK: - Geocoding

    private func reverseGeocode(coordinate: CLLocationCoordinate2D) {
        guard !isGeocodingInProgress else { return }

        isGeocodingInProgress = true
        locationName = "正在获取位置..."

        let geocoder = CLGeocoder()
        let location = CLLocation(latitude: coordinate.latitude, longitude: coordinate.longitude)

        geocoder.reverseGeocodeLocation(location) { [self] placemarks, error in
            isGeocodingInProgress = false

            if let error = error {
                locationName = "未知位置"
                print("地理编码失败: \(error.localizedDescription)")
                return
            }

            if let placemark = placemarks?.first {
                // 构建详细地址
                var addressComponents: [String] = []

                // 优先显示地标或兴趣点
                if let name = placemark.name, !name.isEmpty {
                    addressComponents.append(name)
                }
                // 次优显示街道
                else if let thoroughfare = placemark.thoroughfare {
                    addressComponents.append(thoroughfare)
                }

                // 添加区域信息
                if let subLocality = placemark.subLocality {
                    addressComponents.append(subLocality)
                }

                // 添加城市
                if let locality = placemark.locality {
                    addressComponents.append(locality)
                }

                locationName = addressComponents.isEmpty ? "未知位置" : addressComponents.joined(separator: ", ")
            } else {
                locationName = "未知位置"
            }
        }
    }

    // MARK: - Actions

    private func zoomIn() {
        let newSpan = MKCoordinateSpan(
            latitudeDelta: currentSpan.latitudeDelta * 0.5,
            longitudeDelta: currentSpan.longitudeDelta * 0.5
        )
        withAnimation {
            position = .region(MKCoordinateRegion(center: currentCenter, span: newSpan))
        }
    }
    
    private func zoomOut() {
        let newSpan = MKCoordinateSpan(
            latitudeDelta: currentSpan.latitudeDelta * 2.0,
            longitudeDelta: currentSpan.longitudeDelta * 2.0
        )
        withAnimation {
            position = .region(MKCoordinateRegion(center: currentCenter, span: newSpan))
        }
    }
}
