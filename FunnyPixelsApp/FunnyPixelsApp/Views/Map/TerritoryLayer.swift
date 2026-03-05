import SwiftUI
import Combine
import CoreLocation

// MARK: - Territory Data Models

struct TerritoryCell: Codable, Identifiable {
    @ObservedObject private var fontManager = FontSizeManager.shared
    var id: String { "\(lat),\(lng)" }
    let lat: Double
    let lng: Double
    let allianceId: String?
    let allianceName: String
    let flagColors: String?
    let pixelCount: Int
    let totalPixels: Int
    let control: Double

    enum CodingKeys: String, CodingKey {
        case lat, lng, control
        case allianceId = "alliance_id"
        case allianceName = "alliance_name"
        case flagColors = "flag_colors"
        case pixelCount = "pixel_count"
        case totalPixels = "total_pixels"
    }

    var primaryColor: Color {
        guard let colors = flagColors, !colors.isEmpty else { return .blue.opacity(0.3) }
        let first = colors.components(separatedBy: ",").first ?? ""
        return Color(hex: first.trimmingCharacters(in: .whitespaces)) ?? .blue.opacity(0.3)
    }
}

struct TerritoryResponse: Codable {
    let success: Bool
    let data: TerritoryData?
}

struct TerritoryData: Codable {
    let territories: [TerritoryCell]
    let gridSize: Double
    let count: Int

    enum CodingKeys: String, CodingKey {
        case territories, count
        case gridSize = "grid_size"
    }
}

struct TerritoryDetailResponse: Codable {
    let success: Bool
    let data: TerritoryDetailData?
}

struct TerritoryDetailData: Codable {
    let cellLat: Double
    let cellLng: Double
    let totalPixels: Int
    let alliances: [TerritoryAllianceBreakdown]

    enum CodingKeys: String, CodingKey {
        case alliances
        case cellLat = "cell_lat"
        case cellLng = "cell_lng"
        case totalPixels = "total_pixels"
    }
}

struct TerritoryAllianceBreakdown: Codable, Identifiable {
    var id: String { allianceId }
    let allianceId: String
    let allianceName: String
    let flagColors: String?
    let pixelCount: Int
    let percentage: String

    enum CodingKeys: String, CodingKey {
        case percentage
        case allianceId = "alliance_id"
        case allianceName = "alliance_name"
        case flagColors = "flag_colors"
        case pixelCount = "pixel_count"
    }
}

// MARK: - Territory Detail Card

struct TerritoryDetailCard: View {
    let detail: TerritoryDetailData
    var onDismiss: (() -> Void)?

    var body: some View {
        VStack(spacing: 12) {
            HStack {
                Image(systemName: "flag.2.crossed.fill")
                    .responsiveFont(.subheadline)
                    .foregroundColor(.purple)
                Text(NSLocalizedString("territory.detail_title", comment: "Territory Control"))
                    .responsiveFont(.subheadline, weight: .semibold)
                    .foregroundColor(AppColors.textPrimary)
                Spacer()
                Button { onDismiss?() } label: {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 18))
                        .foregroundColor(AppColors.textTertiary)
                }
            }

            // Total pixels
            HStack {
                Text(NSLocalizedString("territory.total_pixels", comment: "Total Pixels"))
                    .responsiveFont(.caption2)
                    .foregroundColor(AppColors.textSecondary)
                Spacer()
                Text("\(detail.totalPixels)")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundColor(AppColors.textPrimary)
            }

            Divider()

            // Alliance breakdown
            ForEach(detail.alliances) { alliance in
                HStack(spacing: 8) {
                    Circle()
                        .fill(allianceColor(alliance.flagColors))
                        .frame(width: 10, height: 10)

                    Text(alliance.allianceName)
                        .responsiveFont(.caption, weight: .medium)
                        .foregroundColor(AppColors.textPrimary)
                        .lineLimit(1)

                    Spacer()

                    Text("\(alliance.pixelCount) px")
                        .responsiveFont(.caption2)
                        .foregroundColor(AppColors.textSecondary)

                    Text("\(alliance.percentage)%")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundColor(AppColors.primary)
                        .frame(width: 45, alignment: .trailing)
                }
            }
        }
        .padding(16)
        .background(
            RoundedRectangle(cornerRadius: 16)
                .fill(DesignTokens.Colors.cardBackground)
                .shadow(color: .black.opacity(0.12), radius: 16, y: 4)
        )
        .padding(.horizontal, 16)
    }

    private func allianceColor(_ flagColors: String?) -> Color {
        guard let colors = flagColors, !colors.isEmpty else { return .blue }
        let first = colors.components(separatedBy: ",").first ?? ""
        return Color(hex: first.trimmingCharacters(in: .whitespaces)) ?? .blue
    }
}

// MARK: - Territory Service API

class TerritoryService {
    static let shared = TerritoryService()
    private init() {}

    func getTerritories(swLat: Double, swLng: Double, neLat: Double, neLng: Double) async throws -> [TerritoryCell] {
        let path = "/map-social/territories?swLat=\(swLat)&swLng=\(swLng)&neLat=\(neLat)&neLng=\(neLng)"
        let response: TerritoryResponse = try await APIManager.shared.get(path)
        return response.data?.territories ?? []
    }

    func getTerritoryDetail(lat: Double, lng: Double) async throws -> TerritoryDetailData? {
        let path = "/map-social/territory-detail?lat=\(lat)&lng=\(lng)"
        let response: TerritoryDetailResponse = try await APIManager.shared.get(path)
        return response.data
    }
}

// MARK: - ViewModel

@MainActor
class TerritoryViewModel: ObservableObject {
    @Published var territories: [TerritoryCell] = []
    @Published var selectedDetail: TerritoryDetailData?
    @Published var isLoading = false

    private var debounceTask: Task<Void, Never>?
    private let service = TerritoryService.shared

    func loadTerritories(swLat: Double, swLng: Double, neLat: Double, neLng: Double) {
        debounceTask?.cancel()
        debounceTask = Task {
            try? await Task.sleep(nanoseconds: 500_000_000) // 500ms debounce
            guard !Task.isCancelled else { return }
            await fetchTerritories(swLat: swLat, swLng: swLng, neLat: neLat, neLng: neLng)
        }
    }

    private func fetchTerritories(swLat: Double, swLng: Double, neLat: Double, neLng: Double) async {
        do {
            territories = try await service.getTerritories(
                swLat: swLat, swLng: swLng, neLat: neLat, neLng: neLng
            )
        } catch {
            Logger.error("Failed to load territories: \(error)")
        }
    }

    func loadDetail(lat: Double, lng: Double) async {
        do {
            selectedDetail = try await service.getTerritoryDetail(lat: lat, lng: lng)
        } catch {
            Logger.error("Failed to load territory detail: \(error)")
        }
    }

    func clearDetail() {
        selectedDetail = nil
    }
}
