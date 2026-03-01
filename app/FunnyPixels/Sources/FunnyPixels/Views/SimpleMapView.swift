import SwiftUI
import MapKit

/// 简化的地图视图
struct SimpleMapView: View {
    @State private var region = MKCoordinateRegion(
        center: CLLocationCoordinate2D(latitude: 39.9042, longitude: 116.4074), // 北京
        span: MKCoordinateSpan(latitudeDelta: 0.1, longitudeDelta: 0.1)
    )

    var body: some View {
        Map(coordinateRegion: $region, showsUserLocation: true)
            .ignoresSafeArea(edges: .top)
    }
}

/// 像素标注视图（简化版）
struct SimplePixelAnnotationView: View {
    let pixel: Pixel
    let isSelected: Bool
    let onTap: () -> Void

    var body: some View {
        ZStack {
            Circle()
                .fill(pixelColor)
                .frame(width: 20, height: 20)

            if isSelected {
                Circle()
                    .stroke(Color.white, lineWidth: 2)
                    .frame(width: 26, height: 26)
                    .shadow(radius: 3)
            }
        }
        .onTapGesture(perform: onTap)
    }

    private var pixelColor: Color {
        if let color = Color(hex: pixel.color) {
            return color
        }
        return Color.red
    }
}
