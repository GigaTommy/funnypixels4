import Foundation
import CoreLocation

/// 热门区域服务
/// 提供热门绘制区域数据，用于漫游功能
class HotspotService {
    static let shared = HotspotService()

    private init() {}

    // MARK: - 数据模型

    /// 热门区域模型
    struct Hotspot: Codable, Identifiable, Equatable {
        let id: String
        let name: String
        let coordinate: CLLocationCoordinate2D
        let pixelCount: Int
        let regionName: String?
        let rank: Int?
        let uniqueUsers: Int?
        let province: String?
        let isFixed: Bool?

        var displayName: String { name }

        private enum CodingKeys: String, CodingKey {
            case id, name, coordinate, pixelCount, regionName, rank, uniqueUsers, province, isFixed
        }

        // 自定义编码/解码以支持 CLLocationCoordinate2D
        init(id: String, name: String, coordinate: CLLocationCoordinate2D, pixelCount: Int, regionName: String? = nil, rank: Int? = nil, uniqueUsers: Int? = nil, province: String? = nil, isFixed: Bool? = nil) {
            self.id = id
            self.name = name
            self.coordinate = coordinate
            self.pixelCount = pixelCount
            self.regionName = regionName
            self.rank = rank
            self.uniqueUsers = uniqueUsers
            self.province = province
            self.isFixed = isFixed
        }

        init(from decoder: Decoder) throws {
            let container = try decoder.container(keyedBy: CodingKeys.self)
            id = try container.decode(String.self, forKey: .id)
            name = try container.decode(String.self, forKey: .name)
            pixelCount = try container.decode(Int.self, forKey: .pixelCount)
            regionName = try container.decodeIfPresent(String.self, forKey: .regionName)
            rank = try container.decodeIfPresent(Int.self, forKey: .rank)
            uniqueUsers = try container.decodeIfPresent(Int.self, forKey: .uniqueUsers)
            province = try container.decodeIfPresent(String.self, forKey: .province)
            isFixed = try container.decodeIfPresent(Bool.self, forKey: .isFixed)

            // 解码坐标
            if let coordContainer = try? container.nestedContainer(keyedBy: CoordinateKeys.self, forKey: .coordinate) {
                let latitude = try coordContainer.decode(Double.self, forKey: .latitude)
                let longitude = try coordContainer.decode(Double.self, forKey: .longitude)
                coordinate = CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
            } else {
                coordinate = CLLocationCoordinate2D(latitude: 0, longitude: 0)
            }
        }

        func encode(to encoder: Encoder) throws {
            var container = encoder.container(keyedBy: CodingKeys.self)
            try container.encode(id, forKey: .id)
            try container.encode(name, forKey: .name)
            try container.encode(pixelCount, forKey: .pixelCount)
            try container.encodeIfPresent(regionName, forKey: .regionName)
            try container.encodeIfPresent(rank, forKey: .rank)
            try container.encodeIfPresent(uniqueUsers, forKey: .uniqueUsers)
            try container.encodeIfPresent(province, forKey: .province)
            try container.encodeIfPresent(isFixed, forKey: .isFixed)

            // 编码坐标
            var coordContainer = container.nestedContainer(keyedBy: CoordinateKeys.self, forKey: .coordinate)
            try coordContainer.encode(coordinate.latitude, forKey: .latitude)
            try coordContainer.encode(coordinate.longitude, forKey: .longitude)
        }

        private enum CoordinateKeys: String, CodingKey {
            case latitude, longitude
        }

        static func == (lhs: Hotspot, rhs: Hotspot) -> Bool {
            lhs.id == rhs.id
        }
    }

    /// API响应模型（后端 /api/geographic/roaming/cities 格式）
    private struct RoamingCitiesResponse: Codable {
        let success: Bool
        let data: [RoamingCityData]?
        let period: String?
        let total: Int?

        struct RoamingCityData: Codable {
            let rank: Int?
            let city: String?
            let province: String?
            let center: CenterCoordinate?
            let pixelCount: Int?
            let uniqueUsers: Int?
            let isFixed: Bool?
            let period: String?
            let hotspotDate: String?

            var displayName: String {
                city ?? "未知城市"
            }

            private enum CodingKeys: String, CodingKey {
                case rank, city, province, center, period
                case pixelCount = "pixel_count"
                case uniqueUsers = "unique_users"
                case isFixed = "is_fixed"
                case hotspotDate = "hotspot_date"
            }

            struct CenterCoordinate: Codable {
                let lat: Double?
                let lng: Double?
            }
        }
    }

    // MARK: - 预设热门区域（回退数据）

    /// 预设热门区域（著名地标）- 仅在API失败时使用
    private let presetHotspots: [Hotspot] = [
        Hotspot(
            id: "west-lake",
            name: "杭州西湖",
            coordinate: CLLocationCoordinate2D(latitude: 30.2591, longitude: 120.1302),
            pixelCount: 0,
            regionName: "浙江杭州",
            rank: 1,
            province: "浙江省",
            isFixed: true
        ),
        Hotspot(
            id: "tiananmen",
            name: "北京天安门",
            coordinate: CLLocationCoordinate2D(latitude: 39.9075, longitude: 116.3972),
            pixelCount: 0,
            regionName: "北京",
            rank: 2,
            province: "北京市",
            isFixed: true
        ),
        Hotspot(
            id: "the-bund",
            name: "上海外滩",
            coordinate: CLLocationCoordinate2D(latitude: 31.2397, longitude: 121.4999),
            pixelCount: 0,
            regionName: "上海",
            rank: 3,
            province: "上海市",
            isFixed: true
        ),
        Hotspot(
            id: "canton-tower",
            name: "广州塔",
            coordinate: CLLocationCoordinate2D(latitude: 23.1084, longitude: 113.3194),
            pixelCount: 0,
            regionName: "广东广州",
            rank: 4,
            province: "广东省",
            isFixed: true
        ),
        Hotspot(
            id: "victoria-harbour",
            name: "香港维多利亚港",
            coordinate: CLLocationCoordinate2D(latitude: 22.2944, longitude: 114.1718),
            pixelCount: 0,
            regionName: "香港",
            rank: 5,
            province: "香港特别行政区",
            isFixed: true
        ),
        Hotspot(
            id: "taipei-101",
            name: "台北101",
            coordinate: CLLocationCoordinate2D(latitude: 25.0340, longitude: 121.5645),
            pixelCount: 0,
            regionName: "台湾台北",
            rank: 6,
            province: "台湾省",
            isFixed: true
        ),
        Hotspot(
            id: "forbidden-city",
            name: "故宫博物院",
            coordinate: CLLocationCoordinate2D(latitude: 39.9163, longitude: 116.3972),
            pixelCount: 0,
            regionName: "北京",
            rank: 7,
            province: "北京市",
            isFixed: true
        ),
        Hotspot(
            id: "oriental-pearl",
            name: "东方明珠",
            coordinate: CLLocationCoordinate2D(latitude: 31.2397, longitude: 121.4999),
            pixelCount: 0,
            regionName: "上海",
            rank: 8,
            province: "上海市",
            isFixed: true
        ),
        Hotspot(
            id: "terracotta-warriors",
            name: "兵马俑",
            coordinate: CLLocationCoordinate2D(latitude: 34.3841, longitude: 109.2785),
            pixelCount: 0,
            regionName: "陕西西安",
            rank: 9,
            province: "陕西省",
            isFixed: true
        ),
        Hotspot(
            id: "li-jiang",
            name: "丽江古城",
            coordinate: CLLocationCoordinate2D(latitude: 26.8756, longitude: 100.2319),
            pixelCount: 0,
            regionName: "云南丽江",
            rank: 10,
            province: "云南省",
            isFixed: true
        )
    ]

    // MARK: - 缓存管理

    private var cachedHotspots: [Hotspot]?
    private var cacheTimestamp: Date?
    private let cacheValidDuration: TimeInterval = 600 // 10分钟缓存

    // MARK: - 公共方法

    /// 获取所有热门区域
    /// 只返回后端API的真实像素热点数据，不补充预设城市
    /// 预设数据仅在网络请求完全失败时作为紧急回退
    /// - Parameters:
    ///   - period: 时间周期 ('daily', 'weekly', 'monthly')
    ///   - limit: 返回数量限制
    /// - Returns: 热门区域数组
    func getAllHotspots(period: String = "monthly", limit: Int = 10) async -> [Hotspot] {
        // 检查缓存
        if let cached = cachedHotspots,
           let timestamp = cacheTimestamp,
           Date().timeIntervalSince(timestamp) < cacheValidDuration {
            Logger.debug("使用缓存的热门区域数据 (\(cached.count) 个)")
            return Array(cached.prefix(limit))
        }

        do {
            let hotspots = try await fetchHotspotsFromAPI(period: period, limit: limit)
            Logger.info("🌍 API返回 \(hotspots.count) 个真实热门区域")

            // API成功但无数据（DB为空或全部被过滤）→ 回退预设，但不缓存，下次仍尝试API
            if hotspots.isEmpty {
                Logger.warning("API返回空数据，使用预设热点（不缓存）")
                return Array(presetHotspots.prefix(limit))
            }

            let result = Array(hotspots.prefix(limit))
            cachedHotspots = result
            cacheTimestamp = Date()

            Logger.info("🌍 漫游热点列表: \(result.map { $0.name }.joined(separator: ", "))")
            return result
        } catch {
            Logger.warning("无法从API获取热门区域: \(error.localizedDescription)，使用紧急回退预设")
            return Array(presetHotspots.prefix(limit))
        }
    }

    /// 根据ID获取热门区域
    /// - Parameter id: 热门区域ID
    /// - Returns: 热门区域，如果未找到返回nil
    func getHotspot(byId id: String) async -> Hotspot? {
        let hotspots = await getAllHotspots()
        return hotspots.first { $0.id == id }
    }

    // MARK: - 私有方法

    /// 从后端API获取热门区域
    /// 调用 GET /api/geographic/roaming/cities?period=monthly
    private func fetchHotspotsFromAPI(period: String, limit: Int) async throws -> [Hotspot] {
        // 构建查询参数
        let path = "/geographic/roaming/cities?period=\(period)"

        Logger.debug("🌍 从API获取热门区域: \(path)")

        // 调用后端API
        let response: RoamingCitiesResponse = try await APIManager.shared.get(path)

        guard response.success, let cityDataList = response.data else {
            throw NetworkError.serverError("获取热门区域失败")
        }

        // 转换API响应为Hotspot模型，过滤掉坐标无效的记录
        let hotspots = cityDataList.prefix(limit).compactMap { cityData -> Hotspot? in
            let cityName = cityData.city ?? "未知城市"
            let lat = cityData.center?.lat ?? 0
            let lng = cityData.center?.lng ?? 0

            // 跳过坐标无效的记录
            let coordinate = CLLocationCoordinate2D(latitude: lat, longitude: lng)
            guard CLLocationCoordinate2DIsValid(coordinate), lat != 0 || lng != 0 else {
                Logger.warning("跳过无效坐标的热门区域: \(cityName)")
                return nil
            }

            return Hotspot(
                id: "api-\(cityName)-\(cityData.rank ?? 0)",
                name: cityName,
                coordinate: coordinate,
                pixelCount: cityData.pixelCount ?? 0,
                regionName: cityData.province,
                rank: cityData.rank,
                uniqueUsers: cityData.uniqueUsers,
                province: cityData.province,
                isFixed: cityData.isFixed
            )
        }

        Logger.info("✅ 成功获取 \(hotspots.count) 个热门区域")
        return Array(hotspots)
    }

    /// 清除缓存
    func clearCache() {
        cachedHotspots = nil
        cacheTimestamp = nil
        Logger.debug("热门区域缓存已清除")
    }
}
