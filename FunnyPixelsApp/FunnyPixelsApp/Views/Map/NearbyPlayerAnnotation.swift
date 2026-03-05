import SwiftUI
import MapLibre
import Combine

/// Nearby player annotation with pulse animation
struct NearbyPlayerAnnotation: View {
    @ObservedObject private var fontManager = FontSizeManager.shared
    let player: NearbyPlayer
    @State private var isPulsing = false

    var body: some View {
        ZStack {
            // Pulse animation
            Circle()
                .fill(allianceColor.opacity(0.3))
                .frame(width: 40, height: 40)
                .scaleEffect(isPulsing ? 1.8 : 1.0)
                .opacity(isPulsing ? 0 : 0.3)
                .animation(
                    Animation.easeInOut(duration: 2.0).repeatForever(autoreverses: false),
                    value: isPulsing
                )

            // Player dot
            Circle()
                .fill(allianceColor)
                .frame(width: 16, height: 16)
                .overlay(
                    Circle()
                        .stroke(Color.white, lineWidth: 2)
                )
                .shadow(color: .black.opacity(0.2), radius: 4, y: 2)
        }
        .onAppear {
            isPulsing = true
        }
    }

    private var allianceColor: Color {
        // Use alliance color if available, otherwise default blue
        if let colorHex = player.allianceColor {
            return Color(hex: colorHex) ?? .blue
        }
        return .blue
    }
}

/// Nearby player model
struct NearbyPlayer: Identifiable, Codable {
    let id: String
    let username: String
    let distance: Double
    let lastActive: Date?
    let allianceId: String?
    let allianceName: String?
    let allianceColor: String?
    let rank: String?
    let avatarUrl: String?
    let latitude: Double
    let longitude: Double

    enum CodingKeys: String, CodingKey {
        case id = "user_id"
        case username
        case distance
        case lastActive = "last_active"
        case allianceId = "alliance_id"
        case allianceName = "alliance_name"
        case allianceColor = "alliance_color"
        case rank
        case avatarUrl = "avatar_url"
        case latitude
        case longitude
    }

    var formattedDistance: String {
        if distance < 1000 {
            return "\(Int(distance))m"
        } else {
            let km = distance / 1000
            return String(format: "%.1fkm", km)
        }
    }

    var lastActiveText: String {
        guard let lastActive = lastActive else { return "刚刚" }

        let interval = Date().timeIntervalSince(lastActive)

        if interval < 60 {
            return "刚刚"
        } else if interval < 3600 {
            let minutes = Int(interval / 60)
            return "\(minutes)分钟前"
        } else if interval < 86400 {
            let hours = Int(interval / 3600)
            return "\(hours)小时前"
        } else {
            let days = Int(interval / 86400)
            return "\(days)天前"
        }
    }
}

/// Nearby player detail card
/// Nearby players service
@MainActor
class NearbyPlayersService: ObservableObject {
    @Published var players: [NearbyPlayer] = []
    @Published var isLoading = false
    @Published var error: Error?

    private var refreshTimer: Timer?

    func startMonitoring(userLocation: CLLocationCoordinate2D) {
        stopMonitoring()

        // Initial fetch
        Task {
            await fetchNearbyPlayers(lat: userLocation.latitude, lng: userLocation.longitude)
        }

        // Refresh every 30 seconds
        refreshTimer = Timer.scheduledTimer(withTimeInterval: 30, repeats: true) { [weak self] _ in
            Task { @MainActor in
                await self?.fetchNearbyPlayers(lat: userLocation.latitude, lng: userLocation.longitude)
            }
        }
    }

    func stopMonitoring() {
        refreshTimer?.invalidate()
        refreshTimer = nil
    }

    func fetchNearbyPlayers(lat: Double, lng: Double, radius: Int = 5000) async {
        isLoading = true
        defer { isLoading = false }

        do {
            let response: NearbyPlayersResponse = try await APIManager.shared.get(
                "/map-social/nearby-players?lat=\(lat)&lng=\(lng)&radius=\(radius)"
            )

            if response.success, let data = response.data {
                players = data.players
            }

            error = nil
        } catch {
            print("❌ Failed to fetch nearby players: \(error)")
            self.error = error
        }
    }
}

/// Response model
struct NearbyPlayersResponse: Codable {
    let success: Bool
    let data: PlayersData?

    struct PlayersData: Codable {
        let players: [NearbyPlayer]
    }
}

// MARK: - Preview

#if false
// // Type mismatch - preview disabled
// struct NearbyPlayerAnnotation_Previews: PreviewProvider {
//     static var previews: some View {
//         VStack(spacing: 30) {
//             NearbyPlayerAnnotation(player: NearbyPlayer(
//                 id: "user1",
//                 username: "Player1",
//                 distance: 234,
//                 lastActive: Date().addingTimeInterval(-120),
//                 allianceId: "alliance1",
//                 allianceName: "红队",
//                 allianceColor: "FF0000",
//                 rank: "中士",
//                 avatarUrl: nil,
//                 latitude: 39.9042,
//                 longitude: 116.4074
//             ))
// 
//             NearbyPlayerCard(
//                 player: NearbyPlayer(
//                     id: "user1",
//                     username: "Player1",
//                     distance: 234,
//                     lastActive: Date().addingTimeInterval(-120),
//                     allianceId: "alliance1",
//                     allianceName: "红队",
//                     allianceColor: "FF0000",
//                     rank: "中士",
//                     avatarUrl: nil,
//                     latitude: 39.9042,
//                     longitude: 116.4074
//                 ),
//                 onFollow: {},
//                 onDismiss: {}
//             )
//         }
//         .padding()
//         .previewLayout(.sizeThatFits)
//     }
// }
#endif
