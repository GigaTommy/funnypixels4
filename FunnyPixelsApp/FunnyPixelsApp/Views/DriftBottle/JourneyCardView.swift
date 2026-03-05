import SwiftUI

/// 完整旅途卡片视图(沉没后展示)
struct JourneyCardDetailView: View {
    @ObservedObject private var fontManager = FontSizeManager.shared
    let bottleId: String
    @Environment(\.dismiss) private var dismiss
    @State private var detail: JourneyCardDetail?
    @State private var isLoading = true

    private let api = DriftBottleAPIService.shared

    var body: some View {
        NavigationStack {
            ZStack {
                (Color(hex: "F8F9FA") ?? Color(.systemGroupedBackground))
                    .ignoresSafeArea()

                if isLoading {
                    ProgressView()
                        .scaleEffect(1.2)
                } else if let detail = detail {
                    ScrollView(showsIndicators: false) {
                        VStack(spacing: 20) {
                            headerSection(detail)
                            routeSection(detail)
                            messagesSection(detail)
                        }
                        .padding(16)
                        .padding(.bottom, 40)
                    }
                } else {
                    Text(NSLocalizedString("drift_bottle.journey.load_failed", comment: ""))
                        .foregroundColor(AppColors.textSecondary)
                }
            }
            .navigationTitle(NSLocalizedString("drift_bottle.journey.title", comment: ""))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button(action: { dismiss() }) {
                        Image(systemName: "xmark.circle.fill")
                            .foregroundColor(AppColors.textTertiary)
                    }
                }
            }
            .task {
                await loadDetail()
            }
        }
    }

    // MARK: - Header

    private func headerSection(_ detail: JourneyCardDetail) -> some View {
        VStack(spacing: 12) {
            Image("drift_bottle_icon")
                .resizable()
                .aspectRatio(contentMode: .fit)
                .frame(width: 72, height: 72)

            Text("\(detail.originCity ?? "?") → \(detail.stations.last?.city ?? "?")")
                .responsiveFont(.title3, weight: .bold)
                .foregroundColor(AppColors.textPrimary)

            HStack(spacing: 20) {
                statBadge(icon: "mappin.circle.fill", value: String(format: NSLocalizedString("drift_bottle.journey.stations", comment: ""), detail.totalStations), color: .blue)
                statBadge(icon: "arrow.triangle.swap", value: String(format: "%.1f km", detail.distanceKm), color: .green)
                statBadge(icon: "calendar", value: String(format: NSLocalizedString("drift_bottle.journey.days", comment: ""), detail.totalDays), color: .orange)
            }

            if detail.isSunk {
                HStack(spacing: 4) {
                    Image(systemName: "water.waves")
                        .font(.caption)
                    Text(NSLocalizedString("drift_bottle.journey.sunk", comment: ""))
                        .responsiveFont(.caption2, weight: .medium)
                }
                .foregroundColor(.blue.opacity(0.7))
                .padding(.horizontal, 12)
                .padding(.vertical, 4)
                .background(Capsule().fill(Color.blue.opacity(0.1)))
            }
        }
        .padding(16)
        .background(
            RoundedRectangle(cornerRadius: 16)
                .fill(Color.white)
                .shadow(color: .black.opacity(0.05), radius: 8, x: 0, y: 2)
        )
    }

    // MARK: - Route

    private func routeSection(_ detail: JourneyCardDetail) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(NSLocalizedString("drift_bottle.journey.route", comment: ""))
                .responsiveFont(.subheadline, weight: .semibold)
                .foregroundColor(AppColors.textPrimary)
                .padding(.bottom, 12)

            ForEach(detail.stations.indices, id: \.self) { index in
                let station = detail.stations[index]
                HStack(alignment: .top, spacing: 12) {
                    VStack(spacing: 0) {
                        Circle()
                            .fill(station.stationNumber == 0 ? Color.blue : Color.green)
                            .frame(width: 12, height: 12)

                        if index < detail.stations.count - 1 {
                            Rectangle()
                                .fill(Color.gray.opacity(0.3))
                                .frame(width: 2, height: 40)
                        }
                    }

                    VStack(alignment: .leading, spacing: 2) {
                        HStack {
                            Text(station.city ?? NSLocalizedString("drift_bottle.unknown", comment: ""))
                                .responsiveFont(.subheadline, weight: .semibold)
                                .foregroundColor(AppColors.textPrimary)

                            if station.stationNumber == 0 {
                                Text(NSLocalizedString("drift_bottle.journey.origin", comment: ""))
                                    .font(.system(size: 10, weight: .bold))
                                    .foregroundColor(.blue)
                                    .padding(.horizontal, 6)
                                    .padding(.vertical, 2)
                                    .background(Capsule().fill(Color.blue.opacity(0.1)))
                            }
                        }

                        if station.distanceFromPrev > 0 {
                            Text("+\(String(format: "%.1f", Double(station.distanceFromPrev) / 1000.0)) km")
                                .responsiveFont(.caption2)
                                .foregroundColor(AppColors.textTertiary)
                        }
                    }

                    Spacer()
                }
                .padding(.vertical, 4)
            }
        }
        .padding(16)
        .background(
            RoundedRectangle(cornerRadius: 16)
                .fill(Color.white)
                .shadow(color: .black.opacity(0.05), radius: 8, x: 0, y: 2)
        )
    }

    // MARK: - Messages

    private func messagesSection(_ detail: JourneyCardDetail) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(NSLocalizedString("drift_bottle.journey.messages", comment: ""))
                .responsiveFont(.subheadline, weight: .semibold)
                .foregroundColor(AppColors.textPrimary)

            ForEach(detail.messages.indices, id: \.self) { index in
                let msg = detail.messages[index]
                if let text = msg.message, !text.isEmpty {
                    HStack(alignment: .top, spacing: 10) {
                        Image(systemName: msg.stationNumber == 0 ? "house.fill" : "mappin")
                            .responsiveFont(.caption)
                            .foregroundColor(msg.stationNumber == 0 ? .blue : .green)

                        VStack(alignment: .leading, spacing: 4) {
                            Text(text)
                                .responsiveFont(.subheadline)
                                .foregroundColor(AppColors.textPrimary)

                            HStack {
                                Text(msg.authorName)
                                    .font(.system(size: 11, weight: .medium))
                                if let city = msg.city {
                                    Text("· \(city)")
                                        .responsiveFont(.caption2)
                                }
                            }
                            .foregroundColor(AppColors.textTertiary)
                        }
                    }
                    .padding(12)
                    .background(
                        RoundedRectangle(cornerRadius: 10)
                            .fill(Color.white)
                    )
                }
            }
        }
        .padding(16)
        .background(
            RoundedRectangle(cornerRadius: 16)
                .fill(Color(hex: "F0F2F5") ?? Color(.systemGray6))
        )
    }

    // MARK: - Helpers

    private func statBadge(icon: String, value: String, color: Color) -> some View {
        HStack(spacing: 4) {
            Image(systemName: icon)
                .responsiveFont(.caption2)
                .foregroundColor(color)
            Text(value)
                .responsiveFont(.caption, weight: .medium)
                .foregroundColor(AppColors.textPrimary)
        }
    }

    private func loadDetail() async {
        do {
            detail = try await api.getJourneyCardDetail(bottleId: bottleId)
        } catch {
            Logger.error("Load journey card failed: \(error.localizedDescription)")
        }
        isLoading = false
    }
}
