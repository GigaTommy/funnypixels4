import Foundation
import CryptoKit

/// 个人颜色调色板
/// 16色运动主题调色板，用于未设置头像的用户默认颜色
struct PersonalColorPalette {

    /// 16色调色板（运动主题）
    private static let colors: [String] = [
        "#E53E3E",  // 红色
        "#DD6B20",  // 橙色
        "#D69E2E",  // 黄色
        "#38A169",  // 绿色
        "#319795",  // 青色
        "#3182CE",  // 蓝色
        "#5A67D8",  // 靛蓝
        "#805AD5",  // 紫色
        "#D53F8C",  // 粉色
        "#C53030",  // 深红
        "#2D3748",  // 灰色
        "#744210",  // 棕色
        "#276749",  // 深绿
        "#2A4365",  // 深蓝
        "#553C9A",  // 深紫
        "#97266D"   // 深粉
    ]

    /// 根据用户 ID 映射到固定颜色
    /// 使用 SHA256 哈希确保同一用户始终映射到相同颜色
    static func colorForUser(_ userId: String) -> String {
        guard !userId.isEmpty else {
            return colors[0]  // 默认返回第一个颜色
        }

        // 使用 SHA256 哈希用户 ID
        let data = Data(userId.utf8)
        let hash = SHA256.hash(data: data)

        // 取哈希值的第一个字节作为索引
        let hashBytes = [UInt8](hash)
        let index = Int(hashBytes[0]) % colors.count

        return colors[index]
    }
}
