import Foundation
import Combine

/// 像素柱分层视图模型 - 用于 3D 模式下查看某个格子的历史分层
/// Column Layer ViewModel - For viewing historical layers of a pixel in 3D mode
@MainActor
class ColumnLayerViewModel: ObservableObject {
    // MARK: - Published Properties

    @Published var layers: [PixelLayer] = []
    @Published var isLoading = false
    @Published var hasMore = false
    @Published var errorMessage: String?

    // MARK: - Private Properties

    private let apiManager = APIManager.shared
    private var currentOffset = 0
    private let pageSize = 100

    // MARK: - Public Methods

    /// 加载指定格子的分层数据
    /// Load layers for a specific grid
    func loadLayers(gridId: String) async {
        guard !isLoading else { return }

        isLoading = true
        errorMessage = nil
        currentOffset = 0

        defer { isLoading = false }

        do {
            let response: LayersResponse = try await apiManager.get(
                "/pixels-3d/column/\(gridId)/layers",
                parameters: [
                    "limit": pageSize,
                    "offset": currentOffset
                ]
            )

            if response.success, let data = response.data {
                layers = data.layers.map { layerData in
                    PixelLayer(
                        layerIndex: layerData.layer_index,
                        color: layerData.color,
                        timestamp: ISO8601DateFormatter().date(from: layerData.created_at) ?? Date(),
                        artist: PixelLayer.Artist(
                            id: layerData.artist.id,
                            name: layerData.artist.username ?? layerData.artist.display_name ?? "Unknown",
                            avatar: layerData.artist.avatar_url ?? layerData.artist.avatar
                        )
                    )
                }
                hasMore = data.has_more
                currentOffset = layers.count

                Logger.info("✅ Loaded \(layers.count) layers for grid \(gridId)")
            } else {
                errorMessage = response.message ?? "Failed to load layers"
                Logger.error("Failed to load layers: \(response.message ?? "Unknown error")")
            }
        } catch {
            errorMessage = "Failed to load layers: \(error.localizedDescription)"
            Logger.error("Failed to load layers for grid \(gridId): \(error)")
        }
    }

    /// 加载更多分层数据（分页）
    /// Load more layers (pagination)
    func loadMore(gridId: String) async {
        guard !isLoading, hasMore else { return }

        isLoading = true
        defer { isLoading = false }

        do {
            let response: LayersResponse = try await apiManager.get(
                "/pixels-3d/column/\(gridId)/layers",
                parameters: [
                    "limit": pageSize,
                    "offset": currentOffset
                ]
            )

            if response.success, let data = response.data {
                let newLayers = data.layers.map { layerData in
                    PixelLayer(
                        layerIndex: layerData.layer_index,
                        color: layerData.color,
                        timestamp: ISO8601DateFormatter().date(from: layerData.created_at) ?? Date(),
                        artist: PixelLayer.Artist(
                            id: layerData.artist.id,
                            name: layerData.artist.username ?? layerData.artist.display_name ?? "Unknown",
                            avatar: layerData.artist.avatar_url ?? layerData.artist.avatar
                        )
                    )
                }
                layers.append(contentsOf: newLayers)
                hasMore = data.has_more
                currentOffset = layers.count

                Logger.info("✅ Loaded \(newLayers.count) more layers, total: \(layers.count)")
            }
        } catch {
            Logger.error("Failed to load more layers: \(error)")
        }
    }

    /// 清空数据
    /// Clear all data
    func clear() {
        layers.removeAll()
        currentOffset = 0
        hasMore = false
        errorMessage = nil
    }
}

// MARK: - Response Models

private struct LayersResponse: Codable {
    let success: Bool
    let data: LayersData?
    let message: String?

    struct LayersData: Codable {
        let layers: [LayerData]
        let has_more: Bool

        struct LayerData: Codable {
            let layer_index: Int
            let color: String
            let created_at: String
            let artist: ArtistData

            struct ArtistData: Codable {
                let id: String
                let username: String?
                let display_name: String?
                let avatar_url: String?
                let avatar: String?
            }
        }
    }
}

// MARK: - Public Models

/// 像素层数据模型
/// Pixel layer data model
struct PixelLayer: Identifiable {
    let id = UUID()
    let layerIndex: Int
    let color: String
    let timestamp: Date
    let artist: Artist

    /// 艺术家信息
    /// Artist information
    struct Artist {
        let id: String
        let name: String
        let avatar: String?
    }

    /// 格式化时间（相对时间）
    /// Formatted time (relative)
    var timeAgo: String {
        let interval = Date().timeIntervalSince(timestamp)
        if interval < 60 { return NSLocalizedString("feed.time.just_now", comment: "Just now") }
        if interval < 3600 { return String(format: NSLocalizedString("feed.time.minutes_ago", comment: ""), Int(interval / 60)) }
        if interval < 86400 { return String(format: NSLocalizedString("feed.time.hours_ago", comment: ""), Int(interval / 3600)) }
        if interval < 604800 { return String(format: NSLocalizedString("feed.time.days_ago", comment: ""), Int(interval / 86400)) }

        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        return formatter.string(from: timestamp)
    }
}
