import Foundation
import SwiftUI

/// 段位/军衔模型
/// 基于累计总像素数的段位体系
struct RankTier: Codable {
    let id: String
    let name: String
    let nameEn: String
    let icon: String
    let color: String
    let currentPixels: Int
    let nextTierPixels: Int
    let progress: Double

    /// SwiftUI 颜色
    var swiftUIColor: Color {
        Color(hex: color) ?? .gray
    }

    /// 距下一段位还差多少像素
    var gapToNext: Int {
        max(0, nextTierPixels - currentPixels)
    }

    /// 是否为最高段位
    var isMaxTier: Bool {
        progress >= 1.0
    }
}
