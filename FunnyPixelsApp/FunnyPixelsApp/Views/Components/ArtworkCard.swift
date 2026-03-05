import Combine
import SwiftUI

/// 作品卡片 - 画廊风格的会话展示卡片（带视觉增强）
struct ArtworkCard: View {
    // ✅ 响应式设计：监听字体设置变化
    @ObservedObject private var fontManager = FontSizeManager.shared

    let session: DrawingSession
    @StateObject private var thumbnailLoader: ArtworkThumbnailLoader
    
    init(session: DrawingSession) {
        self.session = session
        _thumbnailLoader = StateObject(wrappedValue: ArtworkThumbnailLoader(sessionId: session.id))
    }
    
    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // 1. 路径可视化区域
            pathArtworkSection
            
            // 2. 作品描述
            artworkDescriptionSection
            
            // 3. 核心指标
            coreMetricsSection
            
            // 4. 可选标签
            if !tags.isEmpty {
                tagsSection
            }
        }
        .background(Color(.systemBackground))
        .cornerRadius(16)
        .shadow(color: Color.black.opacity(0.06), radius: 4, x: 0, y: 2)
        .shadow(color: Color.black.opacity(0.04), radius: 12, x: 0, y: 4)
        .task {
            await thumbnailLoader.loadPixels()
        }
    }
    
    // MARK: - Path Artwork Section

    private var pathArtworkSection: some View {
        ZStack(alignment: .topTrailing) {
            // 🚀 优化：先显示时间渐变背景（立即可见，无需等待像素加载）
            LinearGradient(
                colors: timeBasedGradientColors.map { $0.opacity(0.15) },
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .aspectRatio(4/3, contentMode: .fit)
            .overlay {
                // 🚀 优化：像素加载完成后叠加显示路径（渐进增强）
                if let pixels = thumbnailLoader.pixels, !pixels.isEmpty {
                    PathArtworkView(
                        pixels: pixels,
                        sessionTime: session.startTime,
                        drawingType: session.drawingType,
                        showPixelDots: false
                    )
                    .transition(.opacity)  // ✅ 简化动画，避免scale导致的渲染问题
                } else if thumbnailLoader.isLoading {
                    // 加载中显示细微指示器
                    ProgressView()
                        .tint(.white.opacity(0.7))
                        .scaleEffect(0.8)
                }
            }
            
            // 联盟徽章（右上角）
            if let patternId = primaryPatternId {
                AllianceBadge(patternId: patternId, size: 28)
                    .padding(8)
            }
            
            // Date Stamp (Top-Left)
            Text(formatDate(session.startTime))
                .responsiveFont(.caption2, weight: .medium)
                .foregroundColor(.white)
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(Color.black.opacity(0.4))
                .cornerRadius(4)
                .padding(8)
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        }
        .clipped()
    }
    
    // MARK: - Description Section
    
    private var artworkDescriptionSection: some View {
        Text(artworkDescription)
            .responsiveFont(.subheadline)
            .foregroundColor(DesignTokens.Colors.textPrimary)
            .lineLimit(2)
            .padding(.horizontal, 12)
            .padding(.top, 12)
            .padding(.bottom, 8)
    }
    
    // MARK: - Core Metrics Section
    
    private var coreMetricsSection: some View {
        VStack(alignment: .leading, spacing: 6) {
            if let stats = session.statistics {
                // Pixels
                metricRow(
                    icon: "paintbrush.fill",
                    value: "\(stats.uniqueGrids)",
                    unit: "px",
                    color: .teal
                )

                // Distance (if available)
                if let distance = stats.distance, distance > 0 {
                    metricRow(
                        icon: "figure.walk",
                        value: session.formattedDistance,
                        unit: nil,
                        color: .green
                    )
                }

                // Duration
                metricRow(
                    icon: "clock.fill",
                    value: formatDuration(stats.duration ?? 0),
                    unit: nil,
                    color: .orange
                )
            }
        }
        .padding(.horizontal, 12)
        .padding(.bottom, 8)
    }
    
    private func metricRow(icon: String, value: String, unit: String?, color: Color) -> some View {
        HStack(spacing: 6) {
            Image(systemName: icon)
                .responsiveFont(.caption)
                .foregroundColor(color)
                .frame(width: ResponsiveSize.iconSmall(scale: fontManager.scale))

            Text(value)
                .responsiveFont(.footnote, weight: .medium)
                .foregroundColor(DesignTokens.Colors.textPrimary)

            if let unit = unit {
                Text(unit)
                    .responsiveFont(.caption)
                    .foregroundColor(DesignTokens.Colors.textSecondary)
            }
        }
    }
    
    // MARK: - Tags Section
    
    private var tagsSection: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 6) {
                ForEach(tags, id: \.self) { tag in
                    tagView(tag)
                }
            }
            .padding(.horizontal, 12)
            .padding(.bottom, 12)
        }
    }
    
    private func tagView(_ tag: ArtworkTag) -> some View {
        Text(tag.displayName)
            .responsiveFont(.caption2, weight: .medium)
            .foregroundColor(tag.color)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(tag.color.opacity(0.12))
            .cornerRadius(4)
    }
    
    // MARK: - Computed Properties
    
    private var artworkDescription: String {
        ArtworkDescriptionGenerator.generate(for: session, pixels: thumbnailLoader.pixels)
    }
    
    private var timeBasedGradientColors: [Color] {
        let hour = Calendar.current.component(.hour, from: session.startTime)

        if session.drawingType == "manual" {
            // 手动绘制：暖色系（Apple HIG 风格）
            switch hour {
            case 5..<9:   return [.orange, Color(red: 1.0, green: 0.6, blue: 0.35)]       // 日出金橙
            case 9..<17:  return [.teal, Color(red: 0.2, green: 0.78, blue: 0.35)]         // 白天青绿
            case 17..<20: return [Color(red: 1.0, green: 0.58, blue: 0.0), .pink]          // 傍晚暖霞
            default:      return [.indigo, Color(red: 0.35, green: 0.34, blue: 0.84)]      // 夜晚靛蓝
            }
        } else {
            // GPS 绘制：冷色系（Apple HIG 风格）
            switch hour {
            case 5..<9:   return [Color(red: 1.0, green: 0.8, blue: 0.0), .orange]         // 日出暖金
            case 9..<17:  return [.blue, .cyan]                                              // 白天天空蓝
            case 17..<20: return [.orange, Color(red: 0.85, green: 0.35, blue: 0.35)]      // 傍晚晚霞
            default:      return [Color(red: 0.25, green: 0.3, blue: 0.7), .indigo]        // 夜晚深蓝
            }
        }
    }
    
    /// 主要联盟图案ID（从像素中提取最常用的）
    private var primaryPatternId: String? {
        guard let pixels = thumbnailLoader.pixels, !pixels.isEmpty else { return nil }
        
        // 统计每个 patternId 的出现次数
        var patternCounts: [String: Int] = [:]
        for pixel in pixels {
            if let patternId = pixel.patternId, !patternId.isEmpty {
                patternCounts[patternId, default: 0] += 1
            }
        }
        
        // 返回出现次数最多的 patternId
        return patternCounts.max(by: { $0.value < $1.value })?.key
    }
    
    private var tags: [ArtworkTag] {
        var result: [ArtworkTag] = []
        
        guard let stats = session.statistics else { return result }

        // Fast completion (< 5 minutes)
        if let duration = stats.duration, duration < 300 {
            result.append(.fast)
        }

        // Long distance (> 5km)
        if let distance = stats.distance, distance > 5000 {
            result.append(.longDistance)
        }
        
        // High density (pixels per grid > 2.5)
        if stats.uniqueGrids > 0 {
            let density = Double(stats.pixelCount) / Double(stats.uniqueGrids)
            if density > 2.5 {
                result.append(.highDensity)
            }
        }
        
        return result
    }
    
    private func formatDuration(_ seconds: Int) -> String {
        let minutes = seconds / 60
        if minutes < 60 {
            return "\(minutes)min"
        } else {
            let hours = minutes / 60
            let remainingMinutes = minutes % 60
            return "\(hours)h\(remainingMinutes)m"
        }
    }
    
    private func formatDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale.current
        formatter.dateStyle = .medium
        return formatter.string(from: date)
    }
}

// MARK: - Artwork Tag

enum ArtworkTag: String, Hashable {
    case firstToday
    case newArea
    case fast
    case longDistance
    case highDensity
    
    var displayName: String {
        switch self {
        case .firstToday: return NSLocalizedString("artwork.tag.first_today", comment: "")
        case .newArea: return NSLocalizedString("artwork.tag.new_area", comment: "")
        case .fast: return NSLocalizedString("artwork.tag.fast", comment: "")
        case .longDistance: return NSLocalizedString("artwork.tag.long_distance", comment: "")
        case .highDensity: return NSLocalizedString("artwork.tag.high_density", comment: "")
        }
    }
    
    var color: Color {
        switch self {
        case .firstToday: return .orange
        case .newArea: return .mint
        case .fast: return .blue
        case .longDistance: return .teal
        case .highDensity: return .pink
        }
    }
}

// MARK: - Preview

#Preview {
    ScrollView {
        LazyVGrid(columns: [
            GridItem(.flexible(), spacing: 12),
            GridItem(.flexible(), spacing: 12)
        ], spacing: 12) {
            ForEach(0..<6) { index in
                ArtworkCard(
                    session: DrawingSession(
                        id: "test-\(index)",
                        userId: "user1",
                        sessionName: "Test Session",
                        drawingType: index % 2 == 0 ? "gps" : "manual",
                        startTime: Date().addingTimeInterval(Double(index * 3600 * 3)),
                        endTime: Date(),
                        status: "completed",
                        startCity: "北京",
                        startCountry: "中国",
                        endCity: nil,
                        endCountry: nil,
                        metadata: DrawingSession.SessionMetadata(
                            statistics: DrawingSession.SessionStatistics(
                                pixelCount: 128,
                                uniqueGrids: 45,
                                patternsUsed: 1,
                                distance: 1200,
                                duration: 900,
                                avgSpeed: 1.33,
                                efficiency: 8.5,
                                firstPixelTime: Date(),
                                lastPixelTime: Date()
                            ),
                            calculatedAt: Date()
                        ),
                        createdAt: Date(),
                        updatedAt: Date(),
                        allianceFlagPatternId: index % 3 == 0 ? "flag_dragon" : nil,
                        allianceName: index % 3 == 0 ? "Dragon Alliance" : nil
                    )
                )
            }
        }
        .padding()
    }
}
