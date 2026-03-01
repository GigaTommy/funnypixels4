import ActivityKit
import SwiftUI

/// GPS Drawing Live Activity 属性定义
/// 用于灵动岛和锁屏实时显示 GPS 绘制进度
public struct GPSDrawingActivityAttributes: ActivityAttributes {

    /// 静态内容 - 创建 Activity 时设置，不可更改
    public var allianceName: String
    public var allianceColorHex: String

    /// 动态内容 - 可通过 update 实时更新
    public struct ContentState: Codable, Hashable {
        /// 已绘制像素数
        public var pixelsDrawn: Int
        /// 剩余可用点数
        public var remainingPoints: Int
        /// 绘制用时（秒）
        public var elapsedSeconds: Int
        /// 是否处于冻结状态
        public var isFrozen: Bool
        /// 冻结剩余秒数
        public var freezeSecondsLeft: Int
        /// 是否仍在绘制中
        public var isActive: Bool

        public init(
            pixelsDrawn: Int = 0,
            remainingPoints: Int = 0,
            elapsedSeconds: Int = 0,
            isFrozen: Bool = false,
            freezeSecondsLeft: Int = 0,
            isActive: Bool = true
        ) {
            self.pixelsDrawn = pixelsDrawn
            self.remainingPoints = remainingPoints
            self.elapsedSeconds = elapsedSeconds
            self.isFrozen = isFrozen
            self.freezeSecondsLeft = freezeSecondsLeft
            self.isActive = isActive
        }
    }

    public init(allianceName: String, allianceColorHex: String) {
        self.allianceName = allianceName
        self.allianceColorHex = allianceColorHex
    }
}
