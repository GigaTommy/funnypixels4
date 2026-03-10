//
//  PatternColorExtractor.swift
//  FunnyPixelsApp
//
//  Pattern颜色提取服务
//  从 pattern_id 运行时提取主颜色（用于3D塔渲染）
//

import UIKit

/// Pattern颜色提取器
/// 从pattern_id提取主颜色，用于3D塔渲染
enum PatternColorExtractor {

    // MARK: - Public API

    /// 从pattern_id提取主颜色
    /// - Parameter patternId: pattern_id (例如: "color_magenta", "emoji_cn", "user_avatar_xxx")
    /// - Returns: UIColor 主颜色
    static func color(from patternId: String?) -> UIColor {
        guard let patternId = patternId, !patternId.isEmpty else {
            return .gray  // 默认颜色
        }

        // 1. 纯色类型: "color_magenta"
        if patternId.hasPrefix("color_") {
            return extractColorType(patternId)
        }

        // 2. Emoji类型: "emoji_cn"
        if patternId.hasPrefix("emoji_") {
            return extractEmojiColor(patternId)
        }

        // 3. 用户头像: "user_avatar_xxx"
        if patternId.hasPrefix("user_avatar_") {
            return extractAvatarColor(patternId)
        }

        // 4. 复杂旗帜: "complex_flag_xxx"
        if patternId.hasPrefix("complex_flag_") {
            return extractFlagColor(patternId)
        }

        // 5. 个人颜色: "personal_color_ff00ff"
        if patternId.hasPrefix("personal_color_") {
            return extractPersonalColor(patternId)
        }

        return .gray  // 默认颜色
    }

    // MARK: - Private Extractors

    /// 纯色提取: "color_magenta" → #FF00FF
    private static func extractColorType(_ patternId: String) -> UIColor {
        let colorName = patternId.replacingOccurrences(of: "color_", with: "")
        return ColorPalette.color(for: colorName) ?? .gray
    }

    /// Emoji颜色映射: "emoji_cn" → 红色（中国红）
    private static func extractEmojiColor(_ patternId: String) -> UIColor {
        // 国旗emoji颜色映射（使用国旗主色调）
        let emojiColorMap: [String: String] = [
            "emoji_cn": "#FF0000",      // 中国红
            "emoji_us": "#0066FF",      // 美国蓝
            "emoji_jp": "#FF0000",      // 日本红（日之丸）
            "emoji_kr": "#003478",      // 韩国蓝
            "emoji_de": "#000000",      // 德国黑
            "emoji_fr": "#0055A4",      // 法国蓝
            "emoji_gb": "#00247D",      // 英国蓝
            "emoji_es": "#AA151B",      // 西班牙红
            "emoji_it": "#009246",      // 意大利绿
            "emoji_br": "#009C3B",      // 巴西绿
            "emoji_ru": "#FFFFFF",      // 俄罗斯白
            "emoji_ca": "#FF0000",      // 加拿大红（枫叶）
            "emoji_au": "#00008B",      // 澳大利亚蓝
            "emoji_in": "#FF9933",      // 印度橙
            "emoji_mx": "#006847",      // 墨西哥绿
            "emoji_ar": "#75AADB",      // 阿根廷蓝
        ]

        if let hexString = emojiColorMap[patternId] {
            return UIColor(hex: hexString) ?? .blue
        }

        return .blue  // 默认蓝色（emoji）
    }

    /// 头像主色调提取（从缓存）
    private static func extractAvatarColor(_ patternId: String) -> UIColor {
        // 尝试从缓存读取
        if let cachedColor = AvatarColorCache.shared.color(for: patternId) {
            return cachedColor
        }

        // 如果缓存未命中，后台异步加载真实颜色
        Task {
            await loadAvatarColorAsync(patternId)
        }

        // 返回默认灰色（加载完成后会更新）
        return UIColor(hex: "#808080") ?? .gray
    }

    /// 旗帜主色调提取（从缓存）
    private static func extractFlagColor(_ patternId: String) -> UIColor {
        // 尝试从FlagPatternCache读取
        if let flagPattern = FlagPatternCache.shared.getPattern(for: patternId),
           let dominantColor = extractDominantColorFromPattern(flagPattern) {
            return dominantColor
        }

        return UIColor(hex: "#0066FF") ?? .blue  // 默认蓝色（旗帜）
    }

    /// 个人颜色提取: "personal_color_ff00ff" → #ff00ff
    private static func extractPersonalColor(_ patternId: String) -> UIColor {
        let hexString = patternId.replacingOccurrences(of: "personal_color_", with: "")
        return UIColor(hex: "#\(hexString)") ?? .gray
    }

    // MARK: - Helper Methods

    /// 从FlagPattern提取主色调
    private static func extractDominantColorFromPattern(_ pattern: AllianceService.FlagPattern) -> UIColor? {
        // 如果是纯色图案
        if pattern.renderType == "color", let hexColor = pattern.color {
            return UIColor(hex: hexColor)
        }

        // 如果是复杂图案，尝试从payload提取主色调
        if pattern.renderType == "complex", let payloadString = pattern.payload,
           let payloadData = payloadString.data(using: .utf8),
           let payload = try? JSONDecoder().decode([[String]].self, from: payloadData) {
            // 解析16x16 payload，统计颜色出现次数
            return extractDominantColorFromPayload(payload)
        }

        return nil
    }

    /// 从payload提取主色调（统计出现最多的颜色）
    private static func extractDominantColorFromPayload(_ payload: [[String]]) -> UIColor? {
        var colorCounts: [String: Int] = [:]

        // 统计每个颜色出现的次数
        for row in payload {
            for hexColor in row {
                // 忽略透明色
                if hexColor.lowercased() == "#00000000" || hexColor.lowercased() == "transparent" {
                    continue
                }
                colorCounts[hexColor, default: 0] += 1
            }
        }

        // 找到出现最多的颜色
        if let dominantHex = colorCounts.max(by: { $0.value < $1.value })?.key {
            return UIColor(hex: dominantHex)
        }

        return nil
    }

    /// 异步加载头像主色调
    private static func loadAvatarColorAsync(_ patternId: String) async {
        // TODO: 实现头像下载和主色调提取
        // 1. 从API下载头像图片
        // 2. 使用图像处理算法提取主色调
        // 3. 缓存到 AvatarColorCache

        // 暂时不实现，使用默认颜色
    }
}

// MARK: - Color Palette

/// 颜色调色板（纯色映射）
struct ColorPalette {
    /// 从颜色名获取UIColor
    static func color(for name: String) -> UIColor? {
        let colorMap: [String: String] = [
            // 基础颜色
            "red": "#FF0000",
            "orange": "#FFA500",
            "yellow": "#FFFF00",
            "green": "#00FF00",
            "cyan": "#00FFFF",
            "blue": "#0000FF",
            "purple": "#800080",
            "magenta": "#FF00FF",
            "pink": "#FFC0CB",
            "brown": "#A52A2A",
            "black": "#000000",
            "white": "#FFFFFF",
            "gray": "#808080",
            "grey": "#808080",

            // 扩展颜色
            "lime": "#00FF00",
            "navy": "#000080",
            "teal": "#008080",
            "maroon": "#800000",
            "olive": "#808000",
            "aqua": "#00FFFF",
            "silver": "#C0C0C0",
            "fuchsia": "#FF00FF",

            // 淡色系
            "lightred": "#FF6666",
            "lightorange": "#FFB366",
            "lightyellow": "#FFFF66",
            "lightgreen": "#66FF66",
            "lightcyan": "#66FFFF",
            "lightblue": "#6666FF",
            "lightpurple": "#B366FF",
            "lightmagenta": "#FF66FF",
            "lightpink": "#FFB3D9",

            // 深色系
            "darkred": "#8B0000",
            "darkorange": "#FF8C00",
            "darkyellow": "#CCCC00",
            "darkgreen": "#006400",
            "darkcyan": "#008B8B",
            "darkblue": "#00008B",
            "darkpurple": "#4B0082",
            "darkmagenta": "#8B008B",
        ]

        guard let hexString = colorMap[name.lowercased()] else {
            return nil
        }

        return UIColor(hex: hexString)
    }
}

// MARK: - Avatar Color Cache

/// 头像颜色缓存
class AvatarColorCache {
    static let shared = AvatarColorCache()

    private var cache: [String: UIColor] = [:]
    private let cacheQueue = DispatchQueue(label: "com.funnypixels.avatarcolorcache")

    private init() {}

    /// 获取缓存的头像主色调
    func color(for patternId: String) -> UIColor? {
        return cacheQueue.sync {
            return cache[patternId]
        }
    }

    /// 设置头像主色调缓存
    func setColor(_ color: UIColor, for patternId: String) {
        cacheQueue.async {
            self.cache[patternId] = color
        }
    }

    /// 清除缓存
    func clearCache() {
        cacheQueue.async {
            self.cache.removeAll()
        }
    }
}

// MARK: - UIColor Extension

extension UIColor {
    /// 从hex字符串创建UIColor
    /// - Parameter hex: hex字符串（支持 "#FF00FF" 或 "FF00FF"）
    /// - Returns: UIColor 或 nil
    convenience init?(hex: String) {
        var hexSanitized = hex.trimmingCharacters(in: .whitespacesAndNewlines)
        hexSanitized = hexSanitized.replacingOccurrences(of: "#", with: "")

        var rgb: UInt64 = 0

        guard Scanner(string: hexSanitized).scanHexInt64(&rgb) else {
            return nil
        }

        let length = hexSanitized.count
        let r, g, b, a: CGFloat

        if length == 6 {
            r = CGFloat((rgb & 0xFF0000) >> 16) / 255.0
            g = CGFloat((rgb & 0x00FF00) >> 8) / 255.0
            b = CGFloat(rgb & 0x0000FF) / 255.0
            a = 1.0
        } else if length == 8 {
            r = CGFloat((rgb & 0xFF000000) >> 24) / 255.0
            g = CGFloat((rgb & 0x00FF0000) >> 16) / 255.0
            b = CGFloat((rgb & 0x0000FF00) >> 8) / 255.0
            a = CGFloat(rgb & 0x000000FF) / 255.0
        } else {
            return nil
        }

        self.init(red: r, green: g, blue: b, alpha: a)
    }

    /// 转换为hex字符串
    var hexString: String? {
        guard let components = cgColor.components, components.count >= 3 else {
            return nil
        }

        let r = Float(components[0])
        let g = Float(components[1])
        let b = Float(components[2])

        return String(format: "#%02lX%02lX%02lX",
                      lroundf(r * 255),
                      lroundf(g * 255),
                      lroundf(b * 255))
    }
}
