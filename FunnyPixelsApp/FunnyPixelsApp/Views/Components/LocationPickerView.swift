import SwiftUI
import Combine
import CoreLocation

/// 位置选择器（Feed模块） - 遵循简约设计原则
struct FeedLocationPickerView: View {
    @Binding var selectedLocation: FeedService.LocationInfo?

    @StateObject private var locationManager = SimpleLocationManager()
    @State private var locationName: String = ""
    @State private var isUsingCurrentLocation = false
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        VStack(spacing: 0) {
            // 当前位置选项
            currentLocationButton
                .overlay(
                    Rectangle()
                        .frame(height: FeedDesign.Layout.borderWidth)
                        .foregroundColor(FeedDesign.Colors.line),
                    alignment: .bottom
                )

            // 手动输入位置
            VStack(alignment: .leading, spacing: FeedDesign.Spacing.s) {
                Text(NSLocalizedString("feed.create.location.manual", comment: ""))
                    .font(FeedDesign.Typography.caption)
                    .foregroundColor(FeedDesign.Colors.textSecondary)

                TextField(NSLocalizedString("feed.create.location.placeholder", comment: ""), text: $locationName)
                    .font(FeedDesign.Typography.body)
                    .foregroundColor(FeedDesign.Colors.text)
                    .padding(FeedDesign.Spacing.s)
                    .overlay(
                        Rectangle()
                            .stroke(FeedDesign.Colors.line, lineWidth: FeedDesign.Layout.borderWidth)
                    )

                if !locationName.isEmpty {
                    Button {
                        selectManualLocation()
                    } label: {
                        Text(NSLocalizedString("feed.create.location.confirm", comment: ""))
                            .font(FeedDesign.Typography.body)
                            .foregroundColor(FeedDesign.Colors.text)
                            .frame(maxWidth: .infinity)
                            .padding(FeedDesign.Spacing.s)
                            .overlay(
                                Rectangle()
                                    .stroke(FeedDesign.Colors.text, lineWidth: FeedDesign.Layout.borderWidth)
                            )
                    }
                }
            }
            .padding(FeedDesign.Spacing.m)

            Spacer()

            // 已选位置预览
            if let location = selectedLocation {
                selectedLocationPreview(location)
                    .overlay(
                        Rectangle()
                            .frame(height: FeedDesign.Layout.borderWidth)
                            .foregroundColor(FeedDesign.Colors.line),
                        alignment: .top
                    )
            }
        }
        .background(FeedDesign.Colors.background)
        .onAppear {
            locationManager.requestPermission()
        }
    }

    // MARK: - Current Location Button

    private var currentLocationButton: some View {
        Button {
            selectCurrentLocation()
        } label: {
            HStack(spacing: FeedDesign.Spacing.s) {
                Image(systemName: "location.fill")
                    .font(.system(size: 16))
                    .foregroundColor(isUsingCurrentLocation ? FeedDesign.Colors.text : FeedDesign.Colors.textSecondary)

                VStack(alignment: .leading, spacing: 2) {
                    Text(NSLocalizedString("feed.create.location.current", comment: ""))
                        .font(FeedDesign.Typography.body)
                        .foregroundColor(FeedDesign.Colors.text)

                    if let location = locationManager.currentLocation {
                        Text(String(format: "%.4f, %.4f", location.coordinate.latitude, location.coordinate.longitude))
                            .font(FeedDesign.Typography.caption)
                            .foregroundColor(FeedDesign.Colors.textTertiary)
                    } else if locationManager.isLoading {
                        ProgressView()
                            .progressViewStyle(CircularProgressViewStyle())
                            .scaleEffect(0.8)
                    } else {
                        Text(NSLocalizedString("feed.create.location.unavailable", comment: ""))
                            .font(FeedDesign.Typography.caption)
                            .foregroundColor(FeedDesign.Colors.textTertiary)
                    }
                }

                Spacer()

                if isUsingCurrentLocation {
                    Image(systemName: "checkmark")
                        .font(.system(size: 14))
                        .foregroundColor(FeedDesign.Colors.text)
                }
            }
            .padding(FeedDesign.Spacing.m)
            .contentShape(Rectangle())
        }
        .disabled(locationManager.currentLocation == nil)
    }

    // MARK: - Selected Location Preview

    private func selectedLocationPreview(_ location: FeedService.LocationInfo) -> some View {
        VStack(alignment: .leading, spacing: FeedDesign.Spacing.xs) {
            Text(NSLocalizedString("feed.create.location.selected", comment: ""))
                .font(FeedDesign.Typography.caption)
                .foregroundColor(FeedDesign.Colors.textSecondary)

            HStack(spacing: FeedDesign.Spacing.s) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(location.name ?? NSLocalizedString("feed.create.location", comment: ""))
                        .font(FeedDesign.Typography.body)
                        .foregroundColor(FeedDesign.Colors.text)

                    Text(String(format: "%.4f, %.4f", location.lat, location.lng))
                        .font(FeedDesign.Typography.caption)
                        .foregroundColor(FeedDesign.Colors.textTertiary)
                }

                Spacer()

                Button {
                    selectedLocation = nil
                    isUsingCurrentLocation = false
                } label: {
                    Image(systemName: "xmark.circle")
                        .font(.system(size: 18))
                        .foregroundColor(FeedDesign.Colors.textTertiary)
                }
            }
        }
        .padding(FeedDesign.Spacing.m)
    }

    // MARK: - Actions

    private func selectCurrentLocation() {
        guard let location = locationManager.currentLocation else { return }

        selectedLocation = FeedService.LocationInfo(
            name: NSLocalizedString("feed.create.location.current", comment: ""),
            lat: location.coordinate.latitude,
            lng: location.coordinate.longitude
        )
        isUsingCurrentLocation = true
        dismiss()
    }

    private func selectManualLocation() {
        guard !locationName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }

        // 使用默认坐标（实际项目中应该进行地理编码）
        selectedLocation = FeedService.LocationInfo(
            name: locationName.trimmingCharacters(in: .whitespacesAndNewlines),
            lat: 0.0,
            lng: 0.0
        )
        isUsingCurrentLocation = false
        dismiss()
    }
}

// MARK: - Simple Location Manager

class SimpleLocationManager: NSObject, ObservableObject, CLLocationManagerDelegate {
    @Published var currentLocation: CLLocation?
    @Published var isLoading = false

    private let locationManager = CLLocationManager()

    override init() {
        super.init()
        locationManager.delegate = self
        locationManager.desiredAccuracy = kCLLocationAccuracyBest
    }

    func requestPermission() {
        switch locationManager.authorizationStatus {
        case .notDetermined:
            locationManager.requestWhenInUseAuthorization()
        case .authorizedWhenInUse, .authorizedAlways:
            startUpdatingLocation()
        default:
            break
        }
    }

    func startUpdatingLocation() {
        isLoading = true
        locationManager.startUpdatingLocation()
    }

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        if let location = locations.last {
            currentLocation = location
            isLoading = false
            locationManager.stopUpdatingLocation()
        }
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        isLoading = false
        Logger.error("Location error: \(error)")
    }

    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        switch manager.authorizationStatus {
        case .authorizedWhenInUse, .authorizedAlways:
            startUpdatingLocation()
        default:
            break
        }
    }
}
