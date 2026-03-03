import Foundation

/// Feed模块格式化工具集
enum FeedFormatters {

    // MARK: - Time Formatting

    /// 格式化相对时间（本地化）
    /// - Parameter dateString: ISO8601格式的日期字符串
    /// - Returns: 本地化的相对时间字符串（如 "2h", "3d", "1w"）
    static func formatRelativeTime(_ dateString: String) -> String {
        guard let date = parseDate(dateString) else {
            return dateString
        }

        let interval = Date().timeIntervalSince(date)

        // 刚刚
        if interval < 60 {
            return NSLocalizedString("feed.time.just_now", comment: "")
        }

        // 分钟前
        if interval < 3600 {
            let minutes = Int(interval / 60)
            return String(format: NSLocalizedString("feed.time.minute", comment: ""), minutes)
        }

        // 小时前
        if interval < 86400 {
            let hours = Int(interval / 3600)
            return String(format: NSLocalizedString("feed.time.hour", comment: ""), hours)
        }

        // 天前
        if interval < 604800 {
            let days = Int(interval / 86400)
            return String(format: NSLocalizedString("feed.time.day", comment: ""), days)
        }

        // 周前
        if interval < 2592000 {
            let weeks = Int(interval / 604800)
            return String(format: NSLocalizedString("feed.time.week", comment: ""), weeks)
        }

        // 月前
        if interval < 31536000 {
            let months = Int(interval / 2592000)
            return String(format: NSLocalizedString("feed.time.month", comment: ""), months)
        }

        // 年前
        let years = Int(interval / 31536000)
        return String(format: NSLocalizedString("feed.time.year", comment: ""), years)
    }

    /// 解析日期字符串（支持多种格式）
    private static func parseDate(_ dateString: String) -> Date? {
        // 尝试ISO8601格式
        if let date = ISO8601DateFormatter().date(from: dateString) {
            return date
        }

        // 尝试自定义格式
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd'T'HH:mm:ss.SSSZ"
        if let date = formatter.date(from: dateString) {
            return date
        }

        formatter.dateFormat = "yyyy-MM-dd'T'HH:mm:ssZ"
        return formatter.date(from: dateString)
    }

    // MARK: - Number Formatting

    /// 格式化数字（本地化，大数字缩写）
    /// - Parameter number: 数字
    /// - Returns: 格式化后的字符串（如 "1.2K", "3.5M"）
    static func formatNumber(_ number: Int) -> String {
        // 万以上显示K
        if number >= 10000 {
            let value = Double(number) / 1000.0
            return String(format: "%.1fK", value)
        }

        // 百万以上显示M
        if number >= 1000000 {
            let value = Double(number) / 1000000.0
            return String(format: "%.1fM", value)
        }

        // 小数字直接显示
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        formatter.locale = Locale.current
        return formatter.string(from: NSNumber(value: number)) ?? "\(number)"
    }

    /// 格式化点赞数（紧凑格式）
    static func formatLikeCount(_ count: Int) -> String {
        if count == 0 {
            return ""
        }
        return formatNumber(count)
    }

    /// 格式化评论数（紧凑格式）
    static func formatCommentCount(_ count: Int) -> String {
        if count == 0 {
            return ""
        }
        return formatNumber(count)
    }

    // MARK: - Duration Formatting

    /// 格式化时长（秒 -> 时分秒）
    /// - Parameter seconds: 秒数
    /// - Returns: 格式化后的字符串（如 "1h 25m", "45m", "30s"）
    static func formatDuration(_ seconds: Int) -> String {
        if seconds < 60 {
            return "\(seconds)s"
        }

        let minutes = seconds / 60
        if minutes < 60 {
            return "\(minutes)m"
        }

        let hours = minutes / 60
        let remainingMinutes = minutes % 60

        if remainingMinutes == 0 {
            return "\(hours)h"
        }

        return "\(hours)h \(remainingMinutes)m"
    }
}

// MARK: - Int Extension

extension Int {
    /// 格式化为Feed显示格式
    var feedFormatted: String {
        FeedFormatters.formatNumber(self)
    }
}
