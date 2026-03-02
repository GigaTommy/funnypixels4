import SwiftUI
import CoreLocation
import Combine

/// Treasure chest annotation with distance-based styling
struct TreasureChestAnnotation: View {
    let chest: TreasureChest
    @State private var isAnimating = false

    var body: some View {
        ZStack {
            // Glow effect for rare chests
            if chest.rarity != .normal {
                Circle()
                    .fill(rarityColor.opacity(0.3))
                    .frame(width: glowSize, height: glowSize)
                    .scaleEffect(isAnimating ? 1.2 : 1.0)
                    .opacity(isAnimating ? 0.3 : 0.6)
                    .animation(
                        Animation.easeInOut(duration: 1.5).repeatForever(autoreverses: true),
                        value: isAnimating
                    )
            }

            // Chest icon with rarity color
            ZStack {
                // Background circle
                Circle()
                    .fill(rarityColor)
                    .frame(width: iconSize, height: iconSize)
                    .shadow(color: rarityColor.opacity(0.5), radius: 8, y: 4)

                // Chest icon
                Image(systemName: chestIcon)
                    .font(.system(size: iconSize * 0.5, weight: .bold))
                    .foregroundColor(.white)

                // Sparkle overlay for epic/limited
                if chest.rarity == .epic || chest.rarity == .limited {
                    Image(systemName: "sparkles")
                        .font(.system(size: iconSize * 0.3))
                        .foregroundColor(.white.opacity(0.8))
                        .offset(x: iconSize * 0.3, y: -iconSize * 0.3)
                }
            }

            // Distance indicator (only for nearby chests)
            if chest.distance <= 500 {
                VStack(spacing: 0) {
                    Spacer()
                    Text(chest.formattedDistance)
                        .font(.system(size: 9, weight: .bold).monospacedDigit())
                        .foregroundColor(.white)
                        .padding(.horizontal, 4)
                        .padding(.vertical, 2)
                        .background(Color.black.opacity(0.7))
                        .cornerRadius(4)
                }
                .offset(y: iconSize * 0.6)
            }
        }
        .frame(width: iconSize + 20, height: iconSize + 30)
        .onAppear {
            if chest.rarity != .normal {
                isAnimating = true
            }
        }
    }

    // MARK: - Computed Properties

    private var rarityColor: Color {
        switch chest.rarity {
        case .normal:
            return Color(hex: "4CAF50") ?? .green
        case .rare:
            return Color(hex: "2196F3") ?? .blue
        case .epic:
            return Color(hex: "9C27B0") ?? .purple
        case .limited:
            return Color(hex: "FF9800") ?? .orange
        }
    }

    private var chestIcon: String {
        switch chest.rarity {
        case .normal:
            return "gift.fill"
        case .rare:
            return "giftcard.fill"
        case .epic:
            return "crown.fill"
        case .limited:
            return "star.fill"
        }
    }

    private var iconSize: CGFloat {
        // Size based on distance
        if chest.distance <= 500 {
            return 40 // Near
        } else if chest.distance <= 2000 {
            return 32 // Medium
        } else {
            return 24 // Far
        }
    }

    private var glowSize: CGFloat {
        iconSize * 2.5
    }
}

/// Treasure chest model
struct TreasureChest: Identifiable, Codable {
    let id: Int
    let latitude: Double
    let longitude: Double
    let rarity: TreasureRarity
    let distance: Double
    let canPickup: Bool?
    let cooldownRemaining: Int
    let expiresAt: Date

    enum CodingKeys: String, CodingKey {
        case id, latitude, longitude, rarity, distance
        case canPickup = "can_pickup"
        case cooldownRemaining = "cooldown_remaining"
        case expiresAt = "expires_at"
    }

    var formattedDistance: String {
        if distance < 1000 {
            return "\(Int(distance))m"
        } else {
            let km = distance / 1000
            return String(format: "%.1fkm", km)
        }
    }

    var canPickupNow: Bool {
        canPickup == true && distance <= 50
    }

    var cooldownFormatted: String {
        guard cooldownRemaining > 0 else { return "" }

        let minutes = cooldownRemaining / 60
        let seconds = cooldownRemaining % 60
        return String(format: "%02d:%02d", minutes, seconds)
    }
}

/// Treasure rarity enum
enum TreasureRarity: String, Codable, CaseIterable {
    case normal
    case rare
    case epic
    case limited

    var displayName: String {
        switch self {
        case .normal: return "普通"
        case .rare: return "稀有"
        case .epic: return "史诗"
        case .limited: return "限时"
        }
    }

    var color: Color {
        switch self {
        case .normal: return Color(hex: "4CAF50") ?? .blue
        case .rare: return Color(hex: "2196F3") ?? .blue
        case .epic: return Color(hex: "9C27B0") ?? .blue
        case .limited: return Color(hex: "FF9800") ?? .blue
        }
    }
}

/// Treasure chest service
@MainActor
class TreasureChestService: ObservableObject {
    @Published var nearbyChests: [TreasureChest] = []
    @Published var isLoading = false
    @Published var error: Error?

    private var refreshTimer: Timer?

    func startMonitoring(userLocation: CLLocationCoordinate2D) {
        stopMonitoring()

        // Initial fetch
        Task {
            await fetchNearbyChests(lat: userLocation.latitude, lng: userLocation.longitude)
        }

        // Refresh every 60 seconds
        refreshTimer = Timer.scheduledTimer(withTimeInterval: 60, repeats: true) { [weak self] _ in
            Task { @MainActor in
                await self?.fetchNearbyChests(lat: userLocation.latitude, lng: userLocation.longitude)
            }
        }
    }

    func stopMonitoring() {
        refreshTimer?.invalidate()
        refreshTimer = nil
    }

    func fetchNearbyChests(lat: Double, lng: Double, radius: Int = 5000) async {
        isLoading = true
        defer { isLoading = false }

        do {
            let response: TreasureChestsResponse = try await APIManager.shared.get(
                "/treasure-chests/nearby?lat=\(lat)&lng=\(lng)&radius=\(radius)"
            )

            if response.success, let data = response.data {
                nearbyChests = data.chests
            }

            error = nil
        } catch {
            print("❌ Failed to fetch treasure chests: \(error)")
            self.error = error
        }
    }

    func pickupChest(_ chest: TreasureChest, userLat: Double, userLng: Double) async -> PickupResult {
        do {
            let response: PickupResponse = try await APIManager.shared.post(
                "/treasure-chests/\(chest.id)/pickup"
            )

            if response.success, let data = response.data {
                // Remove from list
                nearbyChests.removeAll { $0.id == chest.id }

                return PickupResult(
                    success: true,
                    pointsAwarded: data.pointsAwarded,
                    message: response.message ?? "拾取成功！"
                )
            } else {
                return PickupResult(success: false, pointsAwarded: 0, message: response.message ?? "拾取失败")
            }
        } catch {
            print("❌ Failed to pickup chest: \(error)")
            return PickupResult(success: false, pointsAwarded: 0, message: "拾取失败")
        }
    }
}

/// Response models
struct TreasureChestsResponse: Codable {
    let success: Bool
    let data: ChestsData?

    struct ChestsData: Codable {
        let chests: [TreasureChest]
        let total: Int
    }
}

struct PickupResponse: Codable {
    let success: Bool
    let data: PickupData?
    let message: String?

    struct PickupData: Codable {
        let pointsAwarded: Int

        enum CodingKeys: String, CodingKey {
            case pointsAwarded = "points_awarded"
        }
    }
}

struct PickupResult {
    let success: Bool
    let pointsAwarded: Int
    let message: String
}

// MARK: - Preview

struct TreasureChestAnnotation_Previews: PreviewProvider {
    static var previews: some View {
        VStack(spacing: 30) {
            // Different rarities
            ForEach(TreasureRarity.allCases, id: \.self) { rarity in
                TreasureChestAnnotation(chest: TreasureChest(
                    id: Int(rarity.rawValue.hashValue),
                    latitude: 39.9042,
                    longitude: 116.4074,
                    rarity: rarity,
                    distance: 234,
                    canPickup: true,
                    cooldownRemaining: 0,
                    expiresAt: Date().addingTimeInterval(3600)
                ))
            }
        }
        .padding()
        .previewLayout(.sizeThatFits)
    }
}
