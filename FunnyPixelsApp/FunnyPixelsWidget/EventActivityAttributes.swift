import ActivityKit
import SwiftUI

/// 赛事 Live Activity 属性定义
/// 用于灵动岛和锁屏实时显示赛事状态
public struct EventActivityAttributes: ActivityAttributes {

    /// 静态内容 - 创建 Activity 时设置，不可更改
    public var eventId: String
    public var eventTitle: String
    public var userAllianceName: String
    public var userAllianceColor: String

    /// 动态内容 - 可通过 update 实时更新
    public struct ContentState: Codable, Hashable {
        /// 联盟排名数据
        public var rankings: [AllianceRanking]
        /// 用户联盟当前排名
        public var userRank: Int
        /// 总像素数
        public var totalPixels: Int
        /// 距离结束的秒数
        public var secondsRemaining: Int
        /// 赛事是否已结束
        public var isEnded: Bool

        public init(rankings: [AllianceRanking], userRank: Int, totalPixels: Int, secondsRemaining: Int, isEnded: Bool = false) {
            self.rankings = rankings
            self.userRank = userRank
            self.totalPixels = totalPixels
            self.secondsRemaining = secondsRemaining
            self.isEnded = isEnded
        }
    }

    /// 联盟排名数据结构
    public struct AllianceRanking: Codable, Hashable, Identifiable {
        public var id: String
        public var name: String
        public var colorHex: String
        public var score: Double // percentage
        public var pixelCount: Int

        public init(id: String, name: String, colorHex: String, score: Double, pixelCount: Int) {
            self.id = id
            self.name = name
            self.colorHex = colorHex
            self.score = score
            self.pixelCount = pixelCount
        }

        public var color: Color {
            Color(hex: colorHex) ?? .gray
        }
    }

    public init(eventId: String, eventTitle: String, userAllianceName: String, userAllianceColor: String) {
        self.eventId = eventId
        self.eventTitle = eventTitle
        self.userAllianceName = userAllianceName
        self.userAllianceColor = userAllianceColor
    }
}

// MARK: - Color Extension for Hex Support
extension Color {
    init?(hex: String) {
        var hexSanitized = hex.trimmingCharacters(in: .whitespacesAndNewlines)
        hexSanitized = hexSanitized.replacingOccurrences(of: "#", with: "")

        var rgb: UInt64 = 0
        guard Scanner(string: hexSanitized).scanHexInt64(&rgb) else { return nil }

        let r = Double((rgb & 0xFF0000) >> 16) / 255.0
        let g = Double((rgb & 0x00FF00) >> 8) / 255.0
        let b = Double(rgb & 0x0000FF) / 255.0

        self.init(red: r, green: g, blue: b)
    }
}
