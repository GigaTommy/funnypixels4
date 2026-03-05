import Foundation
import CoreLocation

/// Map heatmap data service
/// Fetches aggregated drawing activity data from the backend for heatmap visualization
class MapHeatmapService {
    static let shared = MapHeatmapService()

    private init() {}

    // MARK: - Response Models

    /// Top-level API response
    struct HeatmapResponse: Codable {
        let success: Bool
        let data: GeoJSONFeatureCollection?
        let meta: HeatmapMeta?
    }

    /// GeoJSON FeatureCollection
    struct GeoJSONFeatureCollection: Codable {
        let type: String
        let features: [GeoJSONFeature]
    }

    /// GeoJSON Feature (Point with weight)
    struct GeoJSONFeature: Codable {
        let type: String
        let geometry: GeoJSONPointGeometry
        let properties: HeatmapProperties
    }

    /// GeoJSON Point geometry
    struct GeoJSONPointGeometry: Codable {
        let type: String
        let coordinates: [Double] // [lng, lat]
    }

    /// Heatmap point properties
    struct HeatmapProperties: Codable {
        let weight: Int
        let users: Int
    }

    /// Response metadata
    struct HeatmapMeta: Codable {
        let zoom: Int
        let period: String
        let gridSizeKm: Double
        let featureCount: Int
        let generatedAt: String
    }

    // MARK: - Local Cache

    private var cachedData: GeoJSONFeatureCollection?
    private var cacheKey: String?
    private var cacheTimestamp: Date?
    private let cacheTTL: TimeInterval = 120 // 2 minutes local cache

    // MARK: - Public API

    /// Fetch heatmap data for the given viewport
    /// - Parameters:
    ///   - zoom: Current map zoom level
    ///   - bounds: Visible map bounds (sw, ne)
    ///   - period: Time period for aggregation (default: "24h")
    /// - Returns: GeoJSON FeatureCollection with weighted points
    func fetchHeatmapData(
        zoom: Int,
        swLat: Double, swLng: Double,
        neLat: Double, neLng: Double,
        period: String = "24h"
    ) async throws -> GeoJSONFeatureCollection {
        // Build cache key from rounded params
        let roundedBounds = [swLat, swLng, neLat, neLng]
            .map { String(format: "%.2f", $0) }
            .joined(separator: ",")
        let key = "\(zoom):\(roundedBounds):\(period)"

        // Check local cache
        if let cached = cachedData,
           let cachedKey = cacheKey,
           cachedKey == key,
           let ts = cacheTimestamp,
           Date().timeIntervalSince(ts) < cacheTTL {
            Logger.debug("[Heatmap] Using cached data (\(cached.features.count) features)")
            return cached
        }

        // Build query path
        let boundsParam = "\(swLat),\(swLng),\(neLat),\(neLng)"
        let path = "/map/heatmap?zoom=\(zoom)&bounds=\(boundsParam)&period=\(period)"

        Logger.debug("[Heatmap] Fetching: \(path)")

        let response: HeatmapResponse = try await APIManager.shared.get(path)

        guard response.success, let data = response.data else {
            throw NetworkError.serverError(
                NSLocalizedString("map.heatmap.fetch_error", comment: "Failed to fetch heatmap data")
            )
        }

        // Update local cache
        cachedData = data
        cacheKey = key
        cacheTimestamp = Date()

        Logger.info("[Heatmap] Fetched \(data.features.count) features for zoom=\(zoom)")
        return data
    }

    /// Clear cached data
    func clearCache() {
        cachedData = nil
        cacheKey = nil
        cacheTimestamp = nil
    }
}
