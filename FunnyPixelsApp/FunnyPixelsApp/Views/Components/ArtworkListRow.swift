import Combine
import SwiftUI

/// 作品列表行 - 列表视图模式下的单行展示组件
struct ArtworkListRow: View {
    @ObservedObject private var fontManager = FontSizeManager.shared
    let session: DrawingSession
    @StateObject private var thumbnailLoader: ArtworkThumbnailLoader
    
    init(session: DrawingSession) {
        self.session = session
        _thumbnailLoader = StateObject(wrappedValue: ArtworkThumbnailLoader(sessionId: session.id))
    }
    
    var body: some View {
        HStack(spacing: 12) {
            // 1. 缩略图（正方形）
            thumbnailView
            
            // 2. 信息区域
            infoSection
            
            Spacer()
            
            // 3. 指示箭头
            Image(systemName: "chevron.right")
                .font(DesignTokens.Typography.caption)
                .foregroundColor(DesignTokens.Colors.textTertiary)
        }
        .padding(12)
        .background(Color(.systemBackground))
        .cornerRadius(12)
        .shadow(color: Color.black.opacity(0.04), radius: 2, x: 0, y: 1)
        .task {
            await thumbnailLoader.loadPixels()
        }
    }
    
    // MARK: - Subviews
    
    private var thumbnailView: some View {
        ZStack(alignment: .topTrailing) {
            if let pixels = thumbnailLoader.pixels, !pixels.isEmpty {
                // 显示路径预览
                PathArtworkView(
                    pixels: pixels,
                    sessionTime: session.startTime,
                    drawingType: session.drawingType,
                    showPixelDots: false
                )
                .clipShape(RoundedRectangle(cornerRadius: 8))
            } else {
                // 加载占位
                ZStack {
                    Color(.systemGray6)
                    if thumbnailLoader.isLoading {
                        ProgressView()
                    } else {
                        Image(systemName: "scribble")
                            .font(.title2)
                            .foregroundColor(.secondary.opacity(0.3))
                    }
                }
                .cornerRadius(8)
            }
            
            // 联盟徽章
            if let patternId = primaryPatternId {
                AllianceBadge(patternId: patternId, size: 20)
                    .offset(x: 4, y: -4)
            }
        }
        .frame(width: 80, height: 80)
        .background(Color(.systemGray6))
        .cornerRadius(8)
    }
    
    private var infoSection: some View {
        VStack(alignment: .leading, spacing: 6) {
            // 描述/标题
            Text(artworkDescription)
                .font(DesignTokens.Typography.subheadline.weight(.medium))
                .foregroundColor(DesignTokens.Colors.textPrimary)
                .lineLimit(2)
            
            // 数据统计行
            if let stats = session.statistics {
                HStack(spacing: 12) {
                    // 像素数
                    HStack(spacing: 4) {
                        Image(systemName: "paintbrush.fill")
                            .font(DesignTokens.Typography.caption)
                        Text("\(stats.uniqueGrids)")
                            .font(DesignTokens.Typography.caption)
                    }
                    .foregroundColor(DesignTokens.Colors.textSecondary)

                    // 距离 (如果有)
                    if let distance = stats.distance, distance > 0 {
                        HStack(spacing: 4) {
                            Image(systemName: "figure.walk")
                                .font(DesignTokens.Typography.caption)
                            Text(session.formattedDistance)
                                .font(DesignTokens.Typography.caption)
                        }
                        .foregroundColor(DesignTokens.Colors.textSecondary)
                    }
                    
                    // 状态标记 (简单圆点)
                    if session.status == "completed" {
                        Circle()
                            .fill(Color.green)
                            .frame(width: 6, height: 6)
                        Circle()
                            .fill(Color.orange)
                            .frame(width: 6, height: 6)
                    }
                    
                    // Date
                    HStack(spacing: 4) {
                        Image(systemName: "calendar")
                            .font(DesignTokens.Typography.caption)
                        Text(formatSimpleDate(session.startTime))
                            .font(DesignTokens.Typography.caption)
                    }
                    .foregroundColor(DesignTokens.Colors.textSecondary)
                }
                .fixedSize(horizontal: true, vertical: false)
            }
        }
        .layoutPriority(1)
    }
    
    // MARK: - Helpers
    
    private var artworkDescription: String {
        ArtworkDescriptionGenerator.generate(for: session, pixels: thumbnailLoader.pixels)
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
    
    private func formatSimpleDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale.current
        formatter.dateStyle = .medium
        return formatter.string(from: date)
    }
}
