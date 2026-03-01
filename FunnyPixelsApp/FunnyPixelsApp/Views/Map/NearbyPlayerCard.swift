import SwiftUI
import Combine
import CoreLocation

// MARK: - Nearby Player Card (shown when tapping a player on the map)

struct NearbyPlayerCard: View {
    let player: MapSocialService.NearbyPlayer
    var onFollow: (() -> Void)?
    var onDismiss: (() -> Void)?

    var body: some View {
        VStack(spacing: 12) {
            // Header with avatar and close button
            HStack(spacing: 12) {
                AvatarView(
                    avatarUrl: player.avatarUrl,
                    avatar: player.avatar,
                    displayName: player.displayName,
                    size: 44
                )

                VStack(alignment: .leading, spacing: 3) {
                    HStack(spacing: 6) {
                        Text(player.displayName)
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundColor(AppColors.textPrimary)
                            .lineLimit(1)

                        if player.isDrawing {
                            HStack(spacing: 3) {
                                Circle()
                                    .fill(Color.green)
                                    .frame(width: 6, height: 6)
                                Text(NSLocalizedString("nearby.drawing", comment: "Drawing"))
                                    .font(.system(size: 10, weight: .medium))
                                    .foregroundColor(.green)
                            }
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(Color.green.opacity(0.1))
                            .clipShape(Capsule())
                        }
                    }

                    HStack(spacing: 8) {
                        if let alliance = player.allianceName, !alliance.isEmpty {
                            HStack(spacing: 3) {
                                Image(systemName: "shield.fill")
                                    .font(.system(size: 9))
                                    .foregroundColor(AppColors.primary)
                                Text(alliance)
                                    .font(.system(size: 11))
                                    .foregroundColor(AppColors.textSecondary)
                                    .lineLimit(1)
                            }
                        }

                        HStack(spacing: 3) {
                            Image(systemName: "square.grid.3x3.fill")
                                .font(.system(size: 9))
                                .foregroundColor(AppColors.textTertiary)
                            Text(formatPixels(player.totalPixels))
                                .font(.system(size: 11))
                                .foregroundColor(AppColors.textTertiary)
                        }
                    }
                }

                Spacer()

                // Distance
                VStack(spacing: 2) {
                    Text(formatDistance(player.distance))
                        .font(.system(size: 13, weight: .bold))
                        .foregroundColor(AppColors.primary)
                    Text(NSLocalizedString("nearby.away", comment: "away"))
                        .font(.system(size: 9))
                        .foregroundColor(AppColors.textTertiary)
                }
            }

            // Action buttons
            HStack(spacing: 12) {
                Button {
                    HapticManager.shared.impact(style: .light)
                    onFollow?()
                } label: {
                    HStack(spacing: 4) {
                        Image(systemName: "person.badge.plus")
                            .font(.system(size: 12))
                        Text(NSLocalizedString("nearby.follow", comment: "Follow"))
                            .font(.system(size: 13, weight: .medium))
                    }
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 8)
                    .background(AppColors.primary)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                }

                Button {
                    onDismiss?()
                } label: {
                    Text(NSLocalizedString("common.close", comment: "Close"))
                        .font(.system(size: 13, weight: .medium))
                        .foregroundColor(AppColors.textSecondary)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 8)
                        .background(Color(.systemGray6))
                        .clipShape(RoundedRectangle(cornerRadius: 8))
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

    private func formatDistance(_ meters: Double) -> String {
        if meters < 100 {
            return String(format: "%.0fm", meters)
        } else if meters < 1000 {
            return String(format: "%.0fm", meters)
        } else {
            return String(format: "%.1fkm", meters / 1000)
        }
    }

    private func formatPixels(_ count: Int) -> String {
        if count >= 10000 {
            return String(format: "%.1fK", Double(count) / 1000.0)
        }
        return "\(count)"
    }
}

// MARK: - Nearby Players Overlay (list of players near the map)

struct NearbyPlayersOverlay: View {
    @StateObject private var viewModel = NearbyPlayersViewModel()
    @Binding var selectedPlayer: MapSocialService.NearbyPlayer?

    var body: some View {
        VStack(spacing: 0) {
            if !viewModel.players.isEmpty {
                // Compact player list at bottom
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(viewModel.players) { player in
                            nearbyPlayerChip(player)
                                .onTapGesture {
                                    selectedPlayer = player
                                }
                        }
                    }
                    .padding(.horizontal, 16)
                    .padding(.vertical, 8)
                }
                .background(
                    Rectangle()
                        .fill(.ultraThinMaterial)
                )
            } else if !viewModel.isLoading {
                // Empty state pill
                HStack(spacing: 6) {
                    Image(systemName: "person.slash")
                        .font(.system(size: 11))
                        .foregroundColor(AppColors.textTertiary)
                    Text(NSLocalizedString("nearby.empty", comment: "No nearby players"))
                        .font(.system(size: 11))
                        .foregroundColor(AppColors.textTertiary)
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .background(.ultraThinMaterial)
                .clipShape(Capsule())
            }
        }
        .task {
            await viewModel.startTracking()
        }
        .onDisappear {
            viewModel.stopTracking()
        }
    }

    private func nearbyPlayerChip(_ player: MapSocialService.NearbyPlayer) -> some View {
        HStack(spacing: 6) {
            AvatarView(
                avatarUrl: player.avatarUrl,
                avatar: player.avatar,
                displayName: player.displayName,
                size: 28
            )

            VStack(alignment: .leading, spacing: 1) {
                Text(player.displayName)
                    .font(.system(size: 11, weight: .medium))
                    .foregroundColor(AppColors.textPrimary)
                    .lineLimit(1)
                Text(formatDistance(player.distance))
                    .font(.system(size: 9))
                    .foregroundColor(AppColors.textTertiary)
            }

            if player.isDrawing {
                Circle()
                    .fill(Color.green)
                    .frame(width: 6, height: 6)
            }
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(DesignTokens.Colors.cardBackground)
                .shadow(color: .black.opacity(0.05), radius: 4, y: 2)
        )
    }

    private func formatDistance(_ meters: Double) -> String {
        if meters < 1000 {
            return String(format: "%.0fm", meters)
        }
        return String(format: "%.1fkm", meters / 1000)
    }
}

// MARK: - ViewModel

@MainActor
class NearbyPlayersViewModel: ObservableObject {
    @Published var players: [MapSocialService.NearbyPlayer] = []
    @Published var isLoading = false

    private var timer: Timer?
    private let service = MapSocialService.shared

    func startTracking() async {
        await fetchNearby()

        // Refresh every 30 seconds
        timer = Timer.scheduledTimer(withTimeInterval: 30, repeats: true) { [weak self] _ in
            Task { @MainActor in
                await self?.fetchNearby()
            }
        }

        // Also update own location
        await updateOwnLocation()
    }

    func stopTracking() {
        timer?.invalidate()
        timer = nil
        Task {
            try? await service.leaveMap()
        }
    }

    private func fetchNearby() async {
        guard let location = LocationManager.shared.currentLocation else { return }

        do {
            players = try await service.getNearbyPlayers(
                lat: location.coordinate.latitude,
                lng: location.coordinate.longitude,
                radius: 1000
            )
        } catch {
            Logger.error("Failed to fetch nearby players: \(error)")
        }
    }

    private func updateOwnLocation() async {
        guard let location = LocationManager.shared.currentLocation else { return }

        do {
            try await service.updateLocation(
                lat: location.coordinate.latitude,
                lng: location.coordinate.longitude,
                isDrawing: DrawingStateManager.shared.isDrawingMode
            )
        } catch {
            Logger.error("Failed to update location: \(error)")
        }
    }
}
