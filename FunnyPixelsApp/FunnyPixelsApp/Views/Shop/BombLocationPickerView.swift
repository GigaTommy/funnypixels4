import SwiftUI
import MapKit
import CoreLocation

/// 炸弹道具使用 - 地图选点视图
struct BombLocationPickerView: View {
    let item: ShopService.StoreItem?
    @Binding var selectedLocation: CLLocationCoordinate2D?
    @Binding var locationName: String?
    let onConfirm: () -> Void

    @Environment(\.dismiss) private var dismiss

    @State private var position: MapCameraPosition
    @State private var currentCenter: CLLocationCoordinate2D
    @State private var currentAddress: String = NSLocalizedString("approval.location.loading", comment: "")
    @State private var geocodeTask: Task<Void, Never>?
    @State private var showConfirmAlert = false

    private let geocoder = CLGeocoder()
    private static let fallbackCenter = CLLocationCoordinate2D(latitude: 31.2304, longitude: 121.4737)

    init(item: ShopService.StoreItem?, selectedLocation: Binding<CLLocationCoordinate2D?>, locationName: Binding<String?>, onConfirm: @escaping () -> Void) {
        self.item = item
        self._selectedLocation = selectedLocation
        self._locationName = locationName
        self.onConfirm = onConfirm
        let center = MapController.shared.cachedCenter ?? Self.fallbackCenter
        _position = State(initialValue: .region(MKCoordinateRegion(
            center: center,
            span: MKCoordinateSpan(latitudeDelta: 0.01, longitudeDelta: 0.01)
        )))
        _currentCenter = State(initialValue: center)
    }

    var body: some View {
        NavigationStack {
            ZStack(alignment: .bottom) {
                Map(position: $position) {
                    UserAnnotation()
                }
                .onMapCameraChange(frequency: .continuous) { context in
                    currentCenter = context.camera.centerCoordinate
                    debounceGeocode(coordinate: currentCenter)
                }

                // Center pin
                Image(systemName: "mappin")
                    .font(.title)
                    .foregroundColor(.red)
                    .padding(.bottom, 20)
                    .frame(maxHeight: .infinity)

                // Bottom card with address and confirm button
                VStack(spacing: 12) {
                    // Address display
                    HStack {
                        Image(systemName: "mappin.circle.fill")
                            .foregroundColor(.red)
                        Text(currentAddress)
                            .font(.subheadline)
                            .lineLimit(2)
                        Spacer()
                    }

                    // Confirm placement button
                    Button(action: {
                        selectedLocation = currentCenter
                        locationName = currentAddress
                        showConfirmAlert = true
                    }) {
                        HStack {
                            Image(systemName: "bolt.fill")
                            Text(NSLocalizedString("bomb.place_here", comment: ""))
                        }
                        .font(.headline)
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                        .background(AppColors.primary)
                        .cornerRadius(AppRadius.l)
                    }
                }
                .padding(16)
                .background(.ultraThinMaterial)
                .clipShape(RoundedRectangle(cornerRadius: 16))
                .padding(.horizontal, 16)
                .padding(.bottom, 16)
            }
            .navigationTitle(NSLocalizedString("bomb.select_location", comment: ""))
            .navigationBarTitleDisplayMode(.inline)
            .hideTabBar()
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(NSLocalizedString("common.cancel", comment: "")) { dismiss() }
                }
            }
            .alert(
                NSLocalizedString("bomb.confirm_title", comment: ""),
                isPresented: $showConfirmAlert
            ) {
                Button(NSLocalizedString("bomb.confirm_use", comment: "")) {
                    dismiss()
                    onConfirm()
                }
                Button(NSLocalizedString("common.cancel", comment: ""), role: .cancel) { }
            } message: {
                Text(String(format: NSLocalizedString("bomb.confirm_message", comment: ""), item?.displayName ?? ""))
            }
        }
    }

    private func debounceGeocode(coordinate: CLLocationCoordinate2D) {
        geocodeTask?.cancel()
        currentAddress = NSLocalizedString("approval.location.loading", comment: "")
        geocodeTask = Task {
            try? await Task.sleep(nanoseconds: 300_000_000)
            guard !Task.isCancelled else { return }
            await reverseGeocode(coordinate: coordinate)
        }
    }

    private func reverseGeocode(coordinate: CLLocationCoordinate2D) async {
        let location = CLLocation(latitude: coordinate.latitude, longitude: coordinate.longitude)
        do {
            let placemarks = try await geocoder.reverseGeocodeLocation(location)
            guard !Task.isCancelled, let placemark = placemarks.first else { return }
            let bestName = placemark.name
                ?? placemark.thoroughfare
                ?? placemark.subLocality
                ?? placemark.locality

            await MainActor.run {
                if let bestName {
                    currentAddress = String(format: NSLocalizedString("approval.location.nearby", comment: ""), bestName)
                } else {
                    currentAddress = NSLocalizedString("approval.location.unknown", comment: "")
                }
            }
        } catch {
            guard !Task.isCancelled else { return }
            await MainActor.run {
                currentAddress = NSLocalizedString("approval.location.unknown", comment: "")
            }
        }
    }
}
