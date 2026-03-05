import Foundation

/// 绘制会话数据模型
struct DrawingSession: Codable, Identifiable, Equatable {
    let id: String
    let userId: String
    let sessionName: String
    let drawingType: String // "gps" | "manual"
    let startTime: Date
    let endTime: Date?
    let status: String
    let startCity: String?
    let startCountry: String?
    let endCity: String?
    let endCountry: String?
    let metadata: SessionMetadata?
    let createdAt: Date
    let updatedAt: Date

    // 🔧 FIX: Add alliance flag information for share view
    let allianceFlagPatternId: String?
    let allianceName: String?

    // 性能优化：Equatable实现
    static func == (lhs: DrawingSession, rhs: DrawingSession) -> Bool {
        lhs.id == rhs.id &&
        lhs.startTime == rhs.startTime &&
        lhs.status == rhs.status
    }

    struct SessionMetadata: Codable, Equatable {
        let statistics: SessionStatistics?
        let calculatedAt: Date?
    }
    
    struct SessionStatistics: Codable, Equatable {
        let pixelCount: Int
        let uniqueGrids: Int
        let patternsUsed: Int
        let distance: Double? // 米（可选，兼容旧数据）
        let duration: Int? // 秒（可选，兼容旧数据）
        let avgSpeed: Double? // m/s（可选，兼容旧数据）
        let efficiency: Double? // 像素/分钟（可选，兼容旧数据）
        let firstPixelTime: Date?
        let lastPixelTime: Date?
    }
    
    // 计算属性
    var statistics: SessionStatistics? {
        metadata?.statistics
    }
    
    var isCompleted: Bool {
        status == "completed"
    }
    
    var isActive: Bool {
        status == "active"
    }
    
    var durationMinutes: Int {
        guard let stats = statistics, let duration = stats.duration else { return 0 }
        return duration / 60
    }

    var formattedDistance: String {
        guard let stats = statistics, let distance = stats.distance else { return "0m" }
        if distance >= 1000 {
            return String(format: "%.1fkm", distance / 1000)
        }
        return String(format: "%.0fm", distance)
    }

    var formattedDuration: String {
        guard let stats = statistics, let duration = stats.duration else { return "0秒" }
        let minutes = duration / 60
        let seconds = duration % 60
        if minutes > 0 {
            return "\(minutes)分\(seconds)秒"
        }
        return "\(seconds)秒"
    }
    
    var typeIcon: String {
        drawingType == "gps" ? "location.fill" : "hand.draw.fill"
    }
    
    var typeLabel: String {
        drawingType == "gps" ? "GPS绘制" : "手动绘制"
    }
}

/// 会话像素数据
struct SessionPixel: Codable, Identifiable {
    let id: String
    let gridId: String
    let latitude: Double
    let longitude: Double
    let color: String?
    let patternId: String?
    let createdAt: Date
    
    var coordinate: (latitude: Double, longitude: Double) {
        (latitude, longitude)
    }
}

/// 会话详情（包含像素列表）
struct SessionDetail: Codable {
    let session: DrawingSession
    let pixels: [SessionPixel]
}

/// 会话列表响应
struct SessionsResponse: Codable {
    let sessions: [DrawingSession]
    let pagination: Pagination
    
    struct Pagination: Codable {
        let page: Int
        let limit: Int
        let total: Int
        let totalPages: Int
        let hasNext: Bool
        let hasPrev: Bool
    }
}
