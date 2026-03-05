import SwiftUI
import CoreLocation

/// 创建者遇到自己瓶子的重逢视图
struct DriftBottleReunionView: View {
    @ObservedObject private var fontManager = FontSizeManager.shared
    let bottle: DriftBottle
    @Environment(\.dismiss) private var dismiss
    @State private var showDetail = false

    private let api = DriftBottleAPIService.shared
    private let locationManager = LocationManager.shared

    var body: some View {
        NavigationStack {
            ZStack {
                AppColors.background
                    .ignoresSafeArea()

                VStack(spacing: 24) {
                    Spacer(minLength: 40)

                    HStack(spacing: 4) {
                        Image(systemName: "sailboat.fill")
                        Image(systemName: "sparkles")
                    }
                    .font(.system(size: 50))
                    .foregroundColor(.blue)

                    Text(NSLocalizedString("drift_bottle.reunion.title", comment: ""))
                        .responsiveFont(.title2, weight: .bold)
                        .foregroundColor(AppColors.textPrimary)

                    Text(NSLocalizedString("drift_bottle.reunion.subtitle", comment: ""))
                        .responsiveFont(.headline)
                        .foregroundColor(AppColors.textSecondary)

                    VStack(spacing: 12) {
                        HStack(spacing: 20) {
                            statItem(value: "\(bottle.openCount)", label: NSLocalizedString("drift_bottle.reunion.opened", comment: ""))
                            statItem(value: String(format: "%.1f", bottle.distanceKm), label: NSLocalizedString("drift_bottle.reunion.km", comment: ""))
                            statItem(value: "\(bottle.daysAfloat)", label: NSLocalizedString("drift_bottle.reunion.days", comment: ""))
                        }

                        if let messages = bottle.messages?.filter({ $0.stationNumber > 0 && $0.message != nil }), !messages.isEmpty {
                            VStack(alignment: .leading, spacing: 8) {
                                Text(NSLocalizedString("drift_bottle.reunion.others_messages", comment: ""))
                                    .responsiveFont(.caption, weight: .semibold)
                                    .foregroundColor(AppColors.textTertiary)

                                ForEach(messages) { msg in
                                    HStack(alignment: .top, spacing: 8) {
                                        Image(systemName: "quote.bubble.fill")
                                            .responsiveFont(.caption2)
                                            .foregroundColor(AppColors.textTertiary)
                                        VStack(alignment: .leading, spacing: 2) {
                                            Text(msg.message ?? "")
                                                .responsiveFont(.subheadline)
                                                .foregroundColor(AppColors.textPrimary)
                                            Text("— \(msg.city ?? NSLocalizedString("drift_bottle.somewhere", comment: ""))")
                                                .responsiveFont(.caption2)
                                                .foregroundColor(AppColors.textTertiary)
                                        }
                                    }
                                }
                            }
                            .padding(12)
                            .background(
                                RoundedRectangle(cornerRadius: 12)
                                    .fill(Color.white)
                                    .shadow(color: .black.opacity(0.06), radius: 6, x: 0, y: 2)
                            )
                        }
                    }

                    Spacer()

                    VStack(spacing: 12) {
                        Button(action: readStory) {
                            Text(NSLocalizedString("drift_bottle.reunion.read_story", comment: ""))
                                .font(.system(size: 16, weight: .bold))
                                .foregroundColor(.white)
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 14)
                                .background(Capsule().fill(Color.blue))
                        }

                        Button(action: { dismiss() }) {
                            Text(NSLocalizedString("drift_bottle.reunion.let_drift", comment: ""))
                                .responsiveFont(.subheadline)
                                .foregroundColor(AppColors.textTertiary)
                        }
                    }
                    .padding(.bottom, 40)
                }
                .padding(24)
            }
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button(action: { dismiss() }) {
                        Image(systemName: "xmark.circle.fill")
                            .foregroundColor(AppColors.textTertiary)
                    }
                }
            }
            .sheet(isPresented: $showDetail) {
                JourneyCardDetailView(bottleId: bottle.bottleId)
            }
        }
    }

    private func statItem(value: String, label: String) -> some View {
        VStack(spacing: 2) {
            Text(value)
                .responsiveFont(.title2, weight: .bold)
                .foregroundColor(AppColors.textPrimary)
            Text(label)
                .responsiveFont(.caption2)
                .foregroundColor(AppColors.textTertiary)
        }
    }

    private func readStory() {
        Task {
            guard let location = locationManager.currentLocation else {
                Logger.warning("Cannot read drift bottle story: location unavailable")
                return
            }
            _ = try? await api.reunionBottle(
                bottleId: bottle.bottleId,
                lat: location.coordinate.latitude,
                lng: location.coordinate.longitude
            )
            showDetail = true
        }
    }
}
