import Foundation

/// 作品描述生成器 - 基于会话数据生成一句话作品描述
class ArtworkDescriptionGenerator {
    
    /// 生成作品描述
    static func generate(for session: DrawingSession, pixels: [SessionPixel]? = nil) -> String {
        let locale = Locale.current.language.languageCode?.identifier ?? "en"
        let isChinese = locale == "zh"
        
        // 获取统计数据
        guard let stats = session.statistics else {
            return isChinese ? "一次像素创作" : "A pixel creation"
        }
        
        // 识别路径形态
        let shape = pixels != nil ? identifyPathShape(pixels: pixels!) : nil
        
        // 获取时间段
        let timeOfDay = getTimeOfDay(from: session.startTime)
        
        // 获取城市
        let city = session.startCity ?? (isChinese ? "未知地点" : "Unknown location")
        
        // 生成描述（多种模板随机选择）
        let templates = isChinese ? chineseTemplates : englishTemplates
        let template = selectTemplate(
            templates: templates,
            hasShape: shape != nil,
            hasCity: !city.isEmpty,
            hasTimeOfDay: timeOfDay != nil,
            stats: stats
        )
        
        return formatDescription(
            template: template,
            city: city,
            shape: shape,
            timeOfDay: timeOfDay,
            stats: stats,
            isChinese: isChinese
        )
    }
    
    // MARK: - Path Shape Recognition
    
    enum PathShape: String {
        case linear = "linear"
        case curved = "curved"
        case circular = "circular"
        case scattered = "scattered"
        
        func localizedName(isChinese: Bool) -> String {
            if isChinese {
                switch self {
                case .linear: return "笔直"
                case .curved: return "曲线"
                case .circular: return "环形"
                case .scattered: return "散点"
                }
            } else {
                switch self {
                case .linear: return "straight"
                case .curved: return "curved"
                case .circular: return "circular"
                case .scattered: return "scattered"
                }
            }
        }
    }
    
    private static func identifyPathShape(pixels: [SessionPixel]) -> PathShape? {
        guard pixels.count > 3 else { return nil }
        
        let coordinates = pixels.map { ($0.latitude, $0.longitude) }
        
        // Check if circular (start and end close)
        guard let first = coordinates.first, let last = coordinates.last else { return nil }
        let distance = sqrt(pow(first.0 - last.0, 2) + pow(first.1 - last.1, 2))
        if distance < 0.001 && pixels.count > 10 {
            return .circular
        }
        
        // Calculate linearity (variance from straight line)
        let linearity = calculateLinearity(coordinates: coordinates)
        if linearity > 0.9 {
            return .linear
        } else if linearity > 0.5 {
            return .curved
        } else {
            return .scattered
        }
    }
    
    private static func calculateLinearity(coordinates: [(Double, Double)]) -> Double {
        guard coordinates.count > 2 else { return 1.0 }
        
        guard let first = coordinates.first, let last = coordinates.last else { return 1.0 }

        // Calculate expected line
        let totalDistance = sqrt(pow(last.0 - first.0, 2) + pow(last.1 - first.1, 2))
        
        // Calculate actual path length
        var actualLength = 0.0
        for i in 0..<coordinates.count - 1 {
            let curr = coordinates[i]
            let next = coordinates[i + 1]
            actualLength += sqrt(pow(next.0 - curr.0, 2) + pow(next.1 - curr.1, 2))
        }
        
        // Linearity = straight distance / actual path length
        return totalDistance / max(actualLength, 0.0001)
    }
    
    // MARK: - Time of Day
    
    private static func getTimeOfDay(from date: Date) -> String? {
        let hour = Calendar.current.component(.hour, from: date)
        let locale = Locale.current.language.languageCode?.identifier ?? "en"
        let isChinese = locale == "zh"
        
        if isChinese {
            switch hour {
            case 5..<9: return "清晨"
            case 9..<12: return "上午"
            case 12..<14: return "午后"
            case 14..<18: return "下午"
            case 18..<22: return "夜晚"
            case 22..<24, 0..<5: return "深夜"
            default: return nil
            }
        } else {
            switch hour {
            case 5..<9: return "morning"
            case 9..<12: return "late morning"
            case 12..<14: return "afternoon"
            case 14..<18: return "late afternoon"
            case 18..<22: return "evening"
            case 22..<24, 0..<5: return "night"
            default: return nil
            }
        }
    }
    
    // MARK: - Templates
    
    private static let chineseTemplates = [
        "在{city}绘制了一条{shape}的轨迹",
        "用{duration}完成了{pixels}个像素的创作",
        "{timeOfDay}的{city}漫步",
        "探索了{grids}个新区域",
        "{timeOfDay}在{city}留下了{pixels}个像素",
        "一次{shape}的像素之旅"
    ]
    
    private static let englishTemplates = [
        "Drew a {shape} path in {city}",
        "Created {pixels} pixels in {duration}",
        "A {timeOfDay} walk in {city}",
        "Explored {grids} new areas",
        "Left {pixels} pixels in {city} during {timeOfDay}",
        "A {shape} pixel journey"
    ]
    
    private static func selectTemplate(
        templates: [String],
        hasShape: Bool,
        hasCity: Bool,
        hasTimeOfDay: Bool,
        stats: DrawingSession.SessionStatistics
    ) -> String {
        // Filter templates based on available data
        var validTemplates = templates.filter { template in
            if template.contains("{shape}") && !hasShape { return false }
            if template.contains("{city}") && !hasCity { return false }
            if template.contains("{timeOfDay}") && !hasTimeOfDay { return false }
            return true
        }
        
        if validTemplates.isEmpty {
            validTemplates = templates
        }
        
        return validTemplates.randomElement() ?? templates[0]
    }
    
    private static func formatDescription(
        template: String,
        city: String,
        shape: PathShape?,
        timeOfDay: String?,
        stats: DrawingSession.SessionStatistics,
        isChinese: Bool
    ) -> String {
        var result = template
        
        result = result.replacingOccurrences(of: "{city}", with: city)
        
        if let shape = shape {
            result = result.replacingOccurrences(of: "{shape}", with: shape.localizedName(isChinese: isChinese))
        }
        
        if let timeOfDay = timeOfDay {
            result = result.replacingOccurrences(of: "{timeOfDay}", with: timeOfDay)
        }
        
        result = result.replacingOccurrences(of: "{pixels}", with: "\(stats.pixelCount)")
        result = result.replacingOccurrences(of: "{grids}", with: "\(stats.uniqueGrids)")

        // Format duration
        let minutes = (stats.duration ?? 0) / 60
        let durationStr = isChinese ? "\(minutes)分钟" : "\(minutes) minutes"
        result = result.replacingOccurrences(of: "{duration}", with: durationStr)
        
        return result
    }
}
