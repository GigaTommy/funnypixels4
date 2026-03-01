import SwiftUI
import Combine
import CoreLocation

struct RegionInfoBar: View {
    @StateObject private var viewModel = RegionInfoViewModel()

    var body: some View {
        if viewModel.isLoading && !viewModel.hasData {
            // Shimmer loading placeholder
            HStack(spacing: 10) {
                RoundedRectangle(cornerRadius: 4)
                    .fill(Color(.systemGray5))
                    .frame(width: 80, height: 12)
                Spacer()
                RoundedRectangle(cornerRadius: 4)
                    .fill(Color(.systemGray5))
                    .frame(width: 40, height: 12)
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 8)
            .background(.ultraThinMaterial)
            .clipShape(RoundedRectangle(cornerRadius: 12))
            .shadow(color: .black.opacity(0.05), radius: 4, y: 2)
            .padding(.horizontal, 16)
            .transition(.opacity)
        } else if viewModel.hasData {
            HStack(spacing: 10) {
                // Region name
                if !viewModel.regionName.isEmpty {
                    HStack(spacing: 4) {
                        Image(systemName: "mappin.circle.fill")
                            .font(.system(size: 11))
                            .foregroundColor(AppColors.primary)
                        Text(viewModel.regionName)
                            .font(.system(size: 12, weight: .medium))
                            .foregroundColor(AppColors.textPrimary)
                            .lineLimit(1)
                    }
                }

                Spacer()

                // Active players
                if viewModel.activePlayers > 0 {
                    HStack(spacing: 3) {
                        Circle()
                            .fill(Color.green)
                            .frame(width: 5, height: 5)
                        Text("\(viewModel.activePlayers)")
                            .font(.system(size: 11, weight: .medium))
                            .foregroundColor(AppColors.textSecondary)
                    }
                }

                // Total pixels
                if viewModel.totalPixels > 0 {
                    HStack(spacing: 3) {
                        Image(systemName: "square.grid.3x3.fill")
                            .font(.system(size: 9))
                            .foregroundColor(AppColors.textTertiary)
                        Text(formatPixels(viewModel.totalPixels))
                            .font(.system(size: 11))
                            .foregroundColor(AppColors.textTertiary)
                    }
                }

                // Controlling alliance
                if let alliance = viewModel.controllingAlliance {
                    HStack(spacing: 3) {
                        Image(systemName: "flag.fill")
                            .font(.system(size: 9))
                            .foregroundColor(.orange)
                        Text(alliance.name)
                            .font(.system(size: 11, weight: .medium))
                            .foregroundColor(AppColors.textSecondary)
                            .lineLimit(1)
                    }
                }
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 8)
            .background(.ultraThinMaterial)
            .clipShape(RoundedRectangle(cornerRadius: 12))
            .shadow(color: .black.opacity(0.05), radius: 4, y: 2)
            .padding(.horizontal, 16)
            .transition(.opacity)
            .animation(.easeInOut(duration: 0.3), value: viewModel.hasData)
        }
    }

    private func formatPixels(_ count: Int) -> String {
        if count >= 10000 {
            return String(format: "%.1fK", Double(count) / 1000.0)
        }
        return "\(count)"
    }
}

// MARK: - Models

struct RegionInfoData: Codable {
    let regionName: String
    let city: String
    let country: String
    let totalPixels: Int
    let activePlayers: Int
    let controllingAlliance: ControllingAlliance?

    enum CodingKeys: String, CodingKey {
        case city, country
        case regionName = "region_name"
        case totalPixels = "total_pixels"
        case activePlayers = "active_players"
        case controllingAlliance = "controlling_alliance"
    }
}

struct ControllingAlliance: Codable {
    let id: String
    let name: String
    let flagPatternId: String?
    let flagColors: String?
    let pixelCount: Int

    enum CodingKeys: String, CodingKey {
        case id, name
        case flagPatternId = "flagPatternId"
        case flagColors = "flagColors"
        case pixelCount = "pixelCount"
    }
}

struct RegionInfoResponse: Codable {
    let success: Bool
    let data: RegionInfoData?
}

// MARK: - ViewModel

@MainActor
class RegionInfoViewModel: ObservableObject {
    @Published var regionName = ""
    @Published var totalPixels = 0
    @Published var activePlayers = 0
    @Published var controllingAlliance: ControllingAlliance?
    @Published var hasData = false
    @Published var isLoading = false

    private var debounceTask: Task<Void, Never>?
    private var cancellables = Set<AnyCancellable>()

    init() {
        // Listen for map center changes via notifications
        NotificationCenter.default.publisher(for: NSNotification.Name("MapCenterDidChange"))
            .compactMap { $0.userInfo?["coordinate"] as? CLLocationCoordinate2D }
            .sink { [weak self] coordinate in
                self?.debouncedFetch(lat: coordinate.latitude, lng: coordinate.longitude)
            }
            .store(in: &cancellables)

        // Initial load from current location
        if let location = LocationManager.shared.currentLocation {
            debouncedFetch(lat: location.coordinate.latitude, lng: location.coordinate.longitude)
        }
    }

    func debouncedFetch(lat: Double, lng: Double) {
        debounceTask?.cancel()
        debounceTask = Task {
            try? await Task.sleep(nanoseconds: 500_000_000) // 500ms debounce
            guard !Task.isCancelled else { return }
            await fetchRegionInfo(lat: lat, lng: lng)
        }
    }

    private func fetchRegionInfo(lat: Double, lng: Double) async {
        isLoading = true
        defer { isLoading = false }
        do {
            let path = "/map-social/region-info?lat=\(lat)&lng=\(lng)"
            let response: RegionInfoResponse = try await APIManager.shared.get(path)
            if response.success, let data = response.data {
                regionName = data.regionName
                totalPixels = data.totalPixels
                activePlayers = data.activePlayers
                controllingAlliance = data.controllingAlliance
                hasData = !data.regionName.isEmpty || data.totalPixels > 0 || data.activePlayers > 0
            }
        } catch {
            Logger.error("Failed to fetch region info: \(error)")
        }
    }
}
