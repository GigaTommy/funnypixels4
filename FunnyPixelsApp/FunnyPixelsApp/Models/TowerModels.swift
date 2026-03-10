//
//  TowerModels.swift
//  FunnyPixelsApp
//
//  Task: #37 - Week 2 iOS 数据模型
//  用于 3D 像素塔功能的数据模型
//

import Foundation

// MARK: - Tower Summary (轻量级，用于视口加载)

/// 塔摘要信息（用于视口查询）
struct TowerSummary: Codable, Identifiable {
    let tileId: String
    let lat: Double
    let lng: Double
    let pixelCount: Int
    let height: Double
    let topPatternId: String  // ← 修复：改为 pattern_id（匹配后端）
    let uniqueUsers: Int

    var id: String { tileId }

    enum CodingKeys: String, CodingKey {
        case tileId = "tile_id"
        case lat, lng
        case pixelCount = "pixel_count"
        case height
        case topPatternId = "top_pattern_id"  // ← 修复：匹配后端字段名
        case uniqueUsers = "unique_users"
    }
}

/// 视口查询响应
struct TowerViewportResponse: Codable {
    let success: Bool
    let data: TowerViewportData
}

struct TowerViewportData: Codable {
    let towers: [TowerSummary]
    let count: Int
    let bounds: ViewportBounds
}

// MARK: - Tower Details (详细数据，按需加载)

/// 楼层数据（单个楼层）
struct FloorData: Codable, Identifiable {
    let floorIndex: Int
    let patternId: String  // ← 修复：改为 pattern_id
    let userId: String?
    let timestamp: Date
    let username: String?
    let avatarUrl: String?

    var id: Int { floorIndex }

    enum CodingKeys: String, CodingKey {
        case floorIndex = "floor_index"
        case patternId = "pattern_id"  // ← 修复：匹配后端字段名
        case userId = "user_id"
        case timestamp
        case username
        case avatarUrl = "avatar_url"
    }
}

/// 用户楼层信息
struct UserFloorsInfo: Codable {
    let floorCount: Int
    let contributionPct: Double
    let firstFloorIndex: Int
    let lastFloorIndex: Int

    enum CodingKeys: String, CodingKey {
        case floorCount = "floor_count"
        case contributionPct = "contribution_pct"
        case firstFloorIndex = "first_floor_index"
        case lastFloorIndex = "last_floor_index"
    }
}

// PaginationInfo is defined in APIResponseModels.swift

/// 塔详情数据
struct TowerDetailsData: Codable {
    let tileId: String
    let floors: [FloorData]
    let totalFloors: Int
    let userFloors: UserFloorsInfo?
    let pagination: PaginationInfo?

    enum CodingKeys: String, CodingKey {
        case tileId = "tile_id"
        case floors
        case totalFloors = "total_floors"
        case userFloors = "user_floors"
        case pagination
    }
}

/// 塔详情响应
struct TowerDetailsResponse: Codable {
    let success: Bool
    let data: TowerDetailsData
}

// MARK: - My Towers (我的塔列表)

/// 我的塔数据
struct MyTowerData: Codable, Identifiable {
    let tileId: String
    let lat: Double
    let lng: Double
    let height: Double
    let pixelCount: Int
    let floorCount: Int
    let contributionPct: Double
    let firstFloorIndex: Int
    let lastFloorIndex: Int

    var id: String { tileId }

    enum CodingKeys: String, CodingKey {
        case tileId = "tile_id"
        case lat, lng, height
        case pixelCount = "pixel_count"
        case floorCount = "floor_count"
        case contributionPct = "contribution_pct"
        case firstFloorIndex = "first_floor_index"
        case lastFloorIndex = "last_floor_index"
    }
}

/// 我的塔响应
struct MyTowersResponse: Codable {
    let success: Bool
    let data: MyTowersData
}

struct MyTowersData: Codable {
    let towers: [MyTowerData]
    let count: Int
}

// MARK: - Helper Extensions

extension TowerSummary {
    /// 获取塔的中心坐标（用于 SceneKit 定位）
    var coordinate: (latitude: Double, longitude: Double) {
        return (lat, lng)
    }

    /// 是否是高塔（高度 > 20）
    var isTallTower: Bool {
        return height > 20.0
    }

    /// 是否是热门塔（参与者 > 10）
    var isPopularTower: Bool {
        return uniqueUsers > 10
    }
}

extension FloorData {
    /// 格式化时间戳
    var formattedTimestamp: String {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return formatter.string(from: timestamp)
    }
}

extension UserFloorsInfo {
    /// 格式化贡献百分比
    var formattedContribution: String {
        return String(format: "%.1f%%", contributionPct)
    }

    /// 楼层范围描述
    var floorRangeDescription: String {
        if firstFloorIndex == lastFloorIndex {
            return "Floor \(firstFloorIndex)"
        } else {
            return "Floors \(firstFloorIndex) - \(lastFloorIndex)"
        }
    }
}

// MARK: - Shared Models

// Note: The following models are defined in other files and reused here:
// - ViewportBounds (defined in Pixel3DModels.swift)
// - PaginationInfo (defined in APIResponseModels.swift)
