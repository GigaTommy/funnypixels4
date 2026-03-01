import Foundation
import MapLibre
import Alamofire

/// 绘制服务
/// 负责处理绘制像素的API调用
class DrawingService {
    static let shared = DrawingService()
    private let apiManager = APIManager.shared

    private init() {}

    // MARK: - Draw Pixel Request

    struct DrawPixelRequest: Codable {
        let lat: Double
        let lng: Double
        let color: String?
        let patternId: String?
        let sessionId: String?
        let drawType: String?  // 'manual' 或 'gps'
    }

    // MARK: - Draw Pixel Response

    struct DrawPixelResponse: Codable {
        let success: Bool
        let data: ResponseData?
        let error: String?

        struct ResponseData: Codable {
            let pixel: PixelData?
            let consumptionResult: ConsumptionResult?
            let processingTime: Int?
            let newAchievements: [NewAchievement]?  // 🆕 新解锁的成就

            struct PixelData: Codable {
                let id: String
                let gridId: String?
                let latitude: Double
                let longitude: Double
                let color: String?
                let patternId: String?
                let userId: String
                let geocodingStatus: String?
                let payload: String?
                let imageUrl: String?  // 🆕 用户头像 URL（用于动态加载 sprite）

                enum CodingKeys: String, CodingKey {
                    case id
                    case gridId = "grid_id"
                    case latitude
                    case longitude
                    case color
                    case patternId = "pattern_id"
                    case userId = "user_id"
                    case geocodingStatus = "geocoding_status"
                    case payload
                    case imageUrl = "image_url"  // 🆕 用户头像 URL
                }
            }

            struct ConsumptionResult: Codable {
                let consumed: Int
                let remainingPoints: Int
                let itemPoints: Int
                let naturalPoints: Int
                let freezeUntil: Int

                var isFrozen: Bool {
                    return freezeUntil > 0
                }
            }

            // 🆕 新解锁的成就模型（简化版，用于通知）
            struct NewAchievement: Codable {
                let id: Int
                let key: String?
                let name: String
                let description: String
                let iconUrl: String?
                let rewardPoints: Int
                let category: String?

                private enum CodingKeys: String, CodingKey {
                    case id, key, name, description, category
                    case iconUrl = "icon_url"
                    case rewardPoints = "reward_points"
                }
            }
        }
    }

    // MARK: - Draw Pixel

    /// 绘制模式枚举
    enum DrawMode {
        case manual
        case gps
    }

    /// 绘制像素
    func drawPixel(
        latitude: Double,
        longitude: Double,
        type: DrawingMode,
        color: String? = nil,
        emoji: String? = nil,
        patternId: String? = nil,
        sessionId: String? = nil,
        allianceId: Int? = nil,
        drawMode: DrawMode = .manual
    ) async throws -> DrawPixelResponse {
        // 根据绘制模式选择正确的API端点
        let baseURLString = AppEnvironment.current.apiBaseURL
        let endpoint = drawMode == .gps ? "/pixel-draw/gps" : "/pixel-draw/manual"
        let url = URL(string: "\(baseURLString)\(endpoint)")!

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        // 添加认证token
        if let token = AuthManager.shared.getAccessToken() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            Logger.debug("Using access token: \(token.prefix(20))...")
        } else {
            Logger.warning("No access token available")
        }

        // 构建请求体 - 与web端保持一致
        // web端发送: {lat, lng, color, pattern_id, session_id, draw_type, alliance_id}
        var parameters: [String: Any?] = [
            "lat": latitude,
            "lng": longitude,
            "session_id": sessionId,
            "draw_type": drawMode == .gps ? "gps" : "manual"
        ]
        
        if let allianceId = allianceId {
            parameters["alliance_id"] = allianceId
            // 当存在 allianceId 时，不发送 pattern_id/color/emoji，完全依赖后端根据联盟ID确定旗帜
            // 这样可以避免客户端缓存的 pattern_id (如 "color_red") 与后端期望不一致导致的回退(emoji_water)
            Logger.debug("🎨 Drawing with Alliance ID \(allianceId). Omitting explicit pattern/color params to use backend alliance config.")
        } else {
            // 根据绘制类型添加相应参数 (仅在非联盟模式下)
            if type == .color, let color = color {
                parameters["color"] = color
                // 🎨 Fix: Also include patternId for color type (e.g. Alliance specific color patterns)
                if let pid = patternId {
                    parameters["pattern_id"] = pid
                }
            } else if type == .emoji, let emoji = emoji {
                // emoji类型：使用color字段发送emoji unicode
                parameters["color"] = emoji
            } else if type == .complex, let patternId = patternId {
                // complex类型：使用patternId
                parameters["pattern_id"] = patternId
            }
        }

        // 移除nil值
        parameters = parameters.compactMapValues { $0 }

        do {
            request.httpBody = try JSONSerialization.data(withJSONObject: parameters)
        } catch {
            Logger.error("❌ Failed to serialize draw pixel request body: \(error.localizedDescription)")
            throw error
        }

        Logger.debug("🎨 Drawing pixel at: \(latitude), \(longitude) - Type: \(type.rawValue), Mode: \(drawMode)")
        Logger.debug("📤 Request body: \(parameters)")
        Logger.info("[TRACKER] 3b. Request Body Payload: \(parameters)")

        do {
            let response: DrawPixelResponse = try await apiManager.performRequest(request)

            if response.success {
                Logger.info("✅ Pixel drawn successfully: \(response.data?.pixel?.id ?? "")")
            } else {
                Logger.error("Failed to draw pixel: \(response.error ?? "Unknown error")")
            }

            return response
        } catch let networkError as NetworkError {
            Logger.error("❌ 像素绘制失败: \(networkError.localizedDescription)")
            throw networkError
        } catch {
            Logger.error("❌ 像素绘制异常: \(error.localizedDescription)")
            throw NetworkError.unknown(error)
        }
    }

    // MARK: - Private Methods

    /// 错误响应格式
    private struct ErrorResponse: Codable {
        let error: String
    }

    // MARK: - Delete Pixel

    /// 删除像素
    func deletePixel(pixelId: String) async throws -> Bool {
        let baseURLString = "\(APIEndpoint.baseURL)/api/pixels/\(pixelId)"
        guard let url = URL(string: baseURLString) else {
            throw NetworkError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = "DELETE"

        if let token = AuthManager.shared.getAccessToken() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        struct DeleteResponse: Codable {
            let success: Bool
            let message: String?
        }

        let response: DeleteResponse = try await apiManager.performRequest(request)

        if response.success {
            Logger.info("✅ Pixel deleted: \(pixelId)")
        } else {
            Logger.error("Failed to delete pixel: \(response.message ?? "Unknown error")")
        }

        return response.success
    }

    // MARK: - Coordinate Conversion

    /// 将地图坐标转换为瓦片坐标（用于像素网格对齐）
    func coordinateToTileCoordinate(coordinate: CLLocationCoordinate2D, zoom: Int) -> (x: Int, y: Int) {
        let n = pow(2.0, Double(zoom))
        let x = Int((coordinate.longitude + 180.0) / 360.0 * n)
        let latRad = coordinate.latitude * .pi / 180.0
        let y = Int((1.0 - asinh(tan(latRad)) / .pi) / 2.0 * n)
        return (x, y)
    }

    /// 将瓦片坐标转换为地图坐标
    func tileCoordinateToCoordinate(tileX: Int, tileY: Int, zoom: Int) -> CLLocationCoordinate2D {
        let n = pow(2.0, Double(zoom))
        let lon = Double(tileX) / n * 360.0 - 180.0
        let latRad = atan(sinh(.pi * (1 - 2 * Double(tileY) / n)))
        let lat = latRad * 180.0 / .pi
        return CLLocationCoordinate2D(latitude: lat, longitude: lon)
    }

    /// 将坐标对齐到像素网格（使用与后端一致的固定网格大小）
    /// 🔧 修复：统一使用0.0001度的网格大小，与后端gridUtils.js保持一致
    func snapToGrid(coordinate: CLLocationCoordinate2D, zoom: Int) -> CLLocationCoordinate2D {
        // 使用固定的网格大小：0.0001度（约11米）
        // 与后端 shared/utils/gridUtils.js 的 GRID_CONFIG.GRID_SIZE 保持一致
        let gridSize = 0.0001

        // 计算网格索引（与后端算法完全一致）
        let gridX = floor((coordinate.longitude + 180.0) / gridSize)
        let gridY = floor((coordinate.latitude + 90.0) / gridSize)

        // 计算网格中心坐标（与后端算法完全一致）
        let snappedLat = (gridY * gridSize) - 90.0 + (gridSize / 2.0)
        let snappedLng = (gridX * gridSize) - 180.0 + (gridSize / 2.0)

        return CLLocationCoordinate2D(latitude: snappedLat, longitude: snappedLng)
    }
}
