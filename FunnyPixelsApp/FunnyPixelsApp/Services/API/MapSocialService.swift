import Foundation

class MapSocialService {
    static let shared = MapSocialService()
    private init() {}

    // MARK: - Models

    struct NearbyPlayer: Codable, Identifiable {
        let userId: String
        let username: String
        let displayName: String
        let avatarUrl: String?
        let avatar: String?
        let allianceName: String?
        let totalPixels: Int
        let isDrawing: Bool
        let latitude: Double
        let longitude: Double
        let distance: Double

        var id: String { userId }

        enum CodingKeys: String, CodingKey {
            case userId, username, displayName, avatarUrl, avatar
            case allianceName, totalPixels, isDrawing, latitude, longitude, distance
        }
    }

    struct NearbyPlayersResponse: Codable {
        let success: Bool
        let data: NearbyPlayersData?
    }

    struct NearbyPlayersData: Codable {
        let players: [NearbyPlayer]
        let count: Int
    }

    struct SimpleResponse: Codable {
        let success: Bool
    }

    // MARK: - API Methods

    func getNearbyPlayers(lat: Double, lng: Double, radius: Int = 500) async throws -> [NearbyPlayer] {
        let path = "/map-social/nearby-players?lat=\(lat)&lng=\(lng)&radius=\(radius)"
        let response: NearbyPlayersResponse = try await APIManager.shared.get(path)
        guard response.success, let data = response.data else {
            return []
        }
        return data.players
    }

    func updateLocation(lat: Double, lng: Double, isDrawing: Bool = false) async throws {
        let params: [String: Any] = [
            "lat": lat,
            "lng": lng,
            "isDrawing": isDrawing
        ]
        let _: SimpleResponse = try await APIManager.shared.post("/map-social/update-location", parameters: params)
    }

    func leaveMap() async throws {
        let _: SimpleResponse = try await APIManager.shared.post("/map-social/leave")
    }
}
