import SwiftUI
import MapKit

/// 活动地点卡片 - 显示活动区域和地图预览
struct EventLocationCard: View {
    let event: EventService.Event
    @State private var region: MKCoordinateRegion?
    @State private var userDistance: Double?
    @ObservedObject private var fontManager = FontSizeManager.shared
    @StateObject private var locationManager = LocationManager.shared

    private var hasLocationInfo: Bool {
        event.config?.area?.center != nil
    }

    private var locationName: String {
        event.config?.area?.name ?? NSLocalizedString("event.location.unnamed", comment: "Event Location")
    }

    private var radiusText: String? {
        guard let radius = event.config?.area?.radius else { return nil }
        if radius >= 1000 {
            let km = Double(radius) / 1000.0
            return String(format: NSLocalizedString("event.location.radius_km", comment: "%.1f km radius"), km)
        } else {
            return String(format: NSLocalizedString("event.location.radius_m", comment: "%d m radius"), radius)
        }
    }

    private var distanceText: String? {
        guard let distance = userDistance else { return nil }
        if distance >= 1000 {
            let km = distance / 1000.0
            return String(format: NSLocalizedString("event.location.distance_km", comment: "%.1f km away"), km)
        } else {
            return String(format: NSLocalizedString("event.location.distance_m", comment: "%.0f m away"), distance)
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            // Header
            HStack(spacing: 8) {
                Image(systemName: "mappin.circle.fill")
                    .font(fontManager.scaledFont(.title3))
                    .foregroundColor(.red)

                Text(NSLocalizedString("event.location.title", comment: "Event Location"))
                    .font(fontManager.scaledFont(.headline))
                    .foregroundColor(AppColors.textPrimary)

                Spacer()
            }

            if hasLocationInfo {
                // Map Preview
                mapPreview
                    .frame(height: 180)
                    .cornerRadius(12)
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .stroke(Color.gray.opacity(0.2), lineWidth: 1)
                    )

                // Location Details
                VStack(spacing: 12) {
                    // Location Name
                    HStack(spacing: 8) {
                        Image(systemName: "location.fill")
                            .font(fontManager.scaledFont(.caption))
                            .foregroundColor(.blue)

                        Text(locationName)
                            .font(fontManager.scaledFont(.subheadline))
                            .foregroundColor(AppColors.textPrimary)

                        Spacer()
                    }

                    // Radius
                    if let radiusText = radiusText {
                        HStack(spacing: 8) {
                            Image(systemName: "circle.dashed")
                                .font(fontManager.scaledFont(.caption))
                                .foregroundColor(.orange)

                            Text(radiusText)
                                .font(fontManager.scaledFont(.caption))
                                .foregroundColor(AppColors.textSecondary)

                            Spacer()
                        }
                    }

                    // User Distance
                    if let distanceText = distanceText {
                        HStack(spacing: 8) {
                            Image(systemName: "figure.walk")
                                .font(fontManager.scaledFont(.caption))
                                .foregroundColor(.green)

                            Text(distanceText)
                                .font(fontManager.scaledFont(.caption))
                                .foregroundColor(AppColors.textSecondary)

                            Spacer()
                        }
                    }

                    // Coordinates (for reference)
                    if let center = event.config?.area?.center {
                        HStack(spacing: 8) {
                            Image(systemName: "location.north.line.fill")
                                .font(fontManager.scaledFont(.caption))
                                .foregroundColor(.gray)

                            Text(String(format: "%.4f°, %.4f°", center.lat, center.lng))
                                .font(fontManager.scaledFont(.caption2))
                                .foregroundColor(AppColors.textTertiary)

                            Spacer()
                        }
                    }
                }
            } else {
                // No location info
                HStack {
                    Spacer()
                    VStack(spacing: 8) {
                        Image(systemName: "map.fill")
                            .font(fontManager.scaledFont(.largeTitle))
                            .foregroundColor(.gray.opacity(0.3))
                        Text(NSLocalizedString("event.location.no_data", comment: "Location information unavailable"))
                            .font(fontManager.scaledFont(.caption))
                            .foregroundColor(AppColors.textSecondary)
                    }
                    .padding(.vertical, 32)
                    Spacer()
                }
            }
        }
        .padding()
        .background(Color(uiColor: .secondarySystemGroupedBackground))
        .cornerRadius(12)
        .onAppear {
            setupRegion()
            calculateDistance()
        }
        .onChange(of: locationManager.currentLocation) { _, _ in
            calculateDistance()
        }
    }

    @ViewBuilder
    private var mapPreview: some View {
        if let region = region {
            Map(position: .constant(.region(region))) {
                // Event center marker
                if let center = event.config?.area?.center {
                    Annotation("", coordinate: CLLocationCoordinate2D(latitude: center.lat, longitude: center.lng)) {
                        ZStack {
                            Circle()
                                .fill(Color.red.opacity(0.3))
                                .frame(width: 20, height: 20)
                            Circle()
                                .fill(Color.red)
                                .frame(width: 10, height: 10)
                        }
                    }

                    // Event area circle overlay (approximate with polygon)
                    if let radius = event.config?.area?.radius {
                        MapCircle(center: CLLocationCoordinate2D(latitude: center.lat, longitude: center.lng), radius: CLLocationDistance(radius))
                            .foregroundStyle(Color.blue.opacity(0.2))
                            .stroke(Color.blue, lineWidth: 2)
                    }
                }

                // User location marker
                if let userLocation = locationManager.currentLocation {
                    Annotation("", coordinate: userLocation.coordinate) {
                        ZStack {
                            Circle()
                                .fill(Color.blue.opacity(0.3))
                                .frame(width: 20, height: 20)
                            Circle()
                                .fill(Color.blue)
                                .frame(width: 10, height: 10)
                        }
                    }
                }
            }
            .mapStyle(.standard(elevation: .realistic))
            .mapControls {
                MapCompass()
                MapScaleView()
            }
            .disabled(true) // Preview only, not interactive
        } else {
            Rectangle()
                .fill(Color.gray.opacity(0.1))
                .overlay(
                    ProgressView()
                )
        }
    }

    private func setupRegion() {
        guard let center = event.config?.area?.center else { return }

        // Calculate appropriate region span based on radius
        let radius = event.config?.area?.radius ?? 800
        let radiusInKm = Double(radius) / 1000.0

        // Rule of thumb: 1 degree ≈ 111 km
        // Add 50% padding to show context
        let span = (radiusInKm * 2.5) / 111.0

        region = MKCoordinateRegion(
            center: CLLocationCoordinate2D(latitude: center.lat, longitude: center.lng),
            span: MKCoordinateSpan(latitudeDelta: span, longitudeDelta: span)
        )
    }

    private func calculateDistance() {
        guard let center = event.config?.area?.center,
              let userLocation = locationManager.currentLocation else {
            userDistance = nil
            return
        }

        let eventLocation = CLLocation(latitude: center.lat, longitude: center.lng)
        userDistance = userLocation.distance(from: eventLocation)
    }
}

// MARK: - Preview
#if DEBUG
struct EventLocationCard_Previews: PreviewProvider {
    static var previews: some View {
        ScrollView {
            VStack(spacing: 16) {
                // With location info
                EventLocationCard(
                    event: EventService.Event(
                        id: "1",
                        title: "广工区庄像素大战",
                        type: "territory_control",
                        status: "active",
                        startTime: "2026-02-23T00:00:00Z",
                        endTime: "2026-03-02T00:00:00Z",
                        bannerUrl: nil,
                        boundary: nil,
                        config: EventService.EventConfig(
                            area: EventService.EventArea(
                                type: "circle",
                                center: EventService.EventCenter(lat: 23.1489, lng: 113.3376),
                                radius: 800,
                                name: "广东工业大学东风路校区"
                            ),
                            areaSize: nil,
                            requirements: nil,
                            rules: nil,
                            rewards: nil,
                            rewardsConfig: nil
                        ),
                        gameplay: nil,
                        isParticipant: false
                    )
                )

                // Without location info
                EventLocationCard(
                    event: EventService.Event(
                        id: "2",
                        title: "Test Event",
                        type: "territory_control",
                        status: "active",
                        startTime: "2026-02-23T00:00:00Z",
                        endTime: "2026-03-02T00:00:00Z",
                        bannerUrl: nil,
                        boundary: nil,
                        config: nil,
                        gameplay: nil,
                        isParticipant: false
                    )
                )
            }
            .padding()
        }
        .background(Color(uiColor: .systemGroupedBackground))
    }
}
#endif
