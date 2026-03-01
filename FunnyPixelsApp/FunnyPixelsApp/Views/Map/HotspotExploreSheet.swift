import SwiftUI
import Combine
import CoreLocation

/// Sheet showing popular hotspot cities for deliberate exploration
struct HotspotExploreSheet: View {
    @Environment(\.dismiss) private var dismiss
    @State private var hotspots: [HotspotService.Hotspot] = []
    @State private var isLoading = true

    let onSelectCity: (HotspotService.Hotspot) -> Void

    var body: some View {
        NavigationView {
            Group {
                if isLoading {
                    ProgressView()
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if hotspots.isEmpty {
                    VStack(spacing: 16) {
                        Image(systemName: "map")
                            .font(.system(size: 48))
                            .foregroundColor(.secondary)
                        Text(NSLocalizedString("explore.empty", comment: "No hotspots yet"))
                            .font(.headline)
                            .foregroundColor(.secondary)
                        Text(NSLocalizedString("explore.empty.hint", comment: "Start drawing to create hotspots"))
                            .font(.subheadline)
                            .foregroundColor(.secondary.opacity(0.7))
                            .multilineTextAlignment(.center)
                    }
                    .padding()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else {
                    ScrollView {
                        LazyVStack(spacing: 12) {
                            ForEach(hotspots) { hotspot in
                                HotspotCityRow(hotspot: hotspot) {
                                    dismiss()
                                    onSelectCity(hotspot)
                                }
                            }
                        }
                        .padding(.horizontal, 16)
                        .padding(.top, 8)
                        .padding(.bottom, 20)
                    }
                }
            }
            .navigationTitle(NSLocalizedString("explore.title", comment: "Explore"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button(action: { dismiss() }) {
                        Image(systemName: "xmark.circle.fill")
                            .foregroundColor(.secondary)
                    }
                }
            }
        }
        .task {
            let data = await HotspotService.shared.getAllHotspots(period: "monthly", limit: 20)
            await MainActor.run {
                hotspots = data
                isLoading = false
            }
        }
    }
}

/// Single row in the hotspot city list
private struct HotspotCityRow: View {
    let hotspot: HotspotService.Hotspot
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 12) {
                // Rank badge
                if let rank = hotspot.rank {
                    ZStack {
                        Circle()
                            .fill(rankColor(rank))
                            .frame(width: 32, height: 32)
                        Text("\(rank)")
                            .font(.system(size: 14, weight: .bold))
                            .foregroundColor(.white)
                    }
                } else {
                    ZStack {
                        Circle()
                            .fill(Color.gray.opacity(0.3))
                            .frame(width: 32, height: 32)
                        Image(systemName: "mappin")
                            .font(.system(size: 14))
                            .foregroundColor(.gray)
                    }
                }

                VStack(alignment: .leading, spacing: 3) {
                    Text(hotspot.name)
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundColor(.primary)

                    HStack(spacing: 8) {
                        if let province = hotspot.province {
                            Text(province)
                                .font(.system(size: 12))
                                .foregroundColor(.secondary)
                        }

                        if hotspot.pixelCount > 0 {
                            Label("\(hotspot.pixelCount)", systemImage: "square.fill")
                                .font(.system(size: 11))
                                .foregroundColor(.blue.opacity(0.8))
                        }

                        if let users = hotspot.uniqueUsers, users > 0 {
                            Label("\(users)", systemImage: "person.fill")
                                .font(.system(size: 11))
                                .foregroundColor(.green.opacity(0.8))
                        }
                    }
                }

                Spacer()

                Image(systemName: "location.circle.fill")
                    .font(.system(size: 20))
                    .foregroundColor(.blue)
            }
            .padding(12)
            .background(
                RoundedRectangle(cornerRadius: 12)
                    .fill(Color(.systemBackground))
                    .shadow(color: .black.opacity(0.06), radius: 4, y: 2)
            )
        }
        .buttonStyle(ScaleButtonStyle())
    }

    private func rankColor(_ rank: Int) -> Color {
        switch rank {
        case 1: return .orange
        case 2: return .gray
        case 3: return Color(red: 0.7, green: 0.45, blue: 0.2)
        default: return .blue.opacity(0.7)
        }
    }
}
