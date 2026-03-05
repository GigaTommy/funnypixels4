import SwiftUI

/// 联盟绘制控制面板
/// 使用用户的联盟旗帜图案进行绘制，而非手动选择颜色/表情
struct AllianceDrawingControlPanel: View {
    @ObservedObject var patternProvider: AllianceDrawingPatternProvider
    @ObservedObject var drawingState: DrawingStateManager
    @ObservedObject private var fontManager = FontSizeManager.shared

    var body: some View {
        VStack(spacing: 8) {
            // 联盟旗帜图案显示（紧凑版）
            if let pattern = patternProvider.currentDrawingPattern {
                CompactAlliancePatternCard(pattern: pattern)
            } else {
                CompactLoadingPatternCard()
            }

            // GPS 绘制控制
            gpsDrawingControl

            // 会话信息（紧凑版）
            compactSessionInfo
        }
        .padding(16)
        .background(.regularMaterial)  // 恢复常规材质以增加对比度
        .cornerRadius(12)  // 恢复较大的圆角
        .shadow(color: .black.opacity(0.08), radius: 8, y: 4)  // 增加阴影
    }

    private var gpsDrawingControl: some View {
        Button(action: {
            Task {
                await toggleGPSDrawing()
            }
        }) {
            HStack(spacing: 6) {
                Image(systemName: drawingState.isGPSDrawingActive ? "location.fill" : "location")
                    .responsiveFont(.headline)
                    .foregroundStyle(drawingState.isGPSDrawingActive ? .white : .secondary)
                    .frame(width: 32, height: 32)

                Text(drawingState.isGPSDrawingActive
                     ? NSLocalizedString("drawing.gps.stop", comment: "Stop GPS drawing")
                     : NSLocalizedString("drawing.gps.start", comment: "Start GPS drawing"))
                    .responsiveFont(.subheadline)
                    .fontWeight(.medium)
                    .foregroundStyle(drawingState.isGPSDrawingActive ? .white : .secondary)
            }
            .frame(maxWidth: .infinity)
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .background(drawingState.isGPSDrawingActive ? Color.red : Color.gray.opacity(0.08))
            .cornerRadius(8)
        }
        .padding(.horizontal, 8)
        .padding(.horizontal, 10)
    }

    private var compactSessionInfo: some View {
        HStack(spacing: 8) {
            // 统计信息
            HStack(spacing: 4) {
                Image(systemName: "location.fill")
                    .font(.caption2)
                    .foregroundStyle(.red)
                Text("\(drawingState.gpsDrawingPixelCount)")
                    .font(.caption)
                    .fontWeight(.medium)
            }

            Spacer()

            // 联盟状态指示器
            if let pattern = patternProvider.currentDrawingPattern, pattern.isAlliancePattern {
                Circle()
                    .fill(.blue)
                    .frame(width: 6, height: 6)
            } else {
                Circle()
                    .fill(.orange)
                    .frame(width: 6, height: 6)
            }
        }
        .padding(.vertical, 4)
    }

    private func toggleGPSDrawing() async {
        let gpsService = GPSDrawingService.shared

        if drawingState.isGPSDrawingActive {
            // 停止GPS绘制
            await gpsService.stopGPSDrawing()
            await drawingState.stopDrawing()
        } else {
            // 开始GPS绘制
            await drawingState.requestStartGPSDrawing()
        }
    }
}

// MARK: - Alliance Pattern Card

/// 联盟图案卡片
struct AlliancePatternCard: View {
    let pattern: DrawingPattern

    var body: some View {
        VStack(spacing: 12) {
            // 图案预览
            patternPreview

            // 图案名称
            Text(pattern.patternName)
                .font(.headline)
                .multilineTextAlignment(.center)

            // 图案类型标签
            patternTypeTag
        }
        .padding()
        .frame(maxWidth: .infinity)
        .background(.ultraThinMaterial)
        .cornerRadius(12)
    }

    @ViewBuilder
    private var patternPreview: some View {
        switch pattern.type {
        case .color:
            colorCircleView

        case .emoji:
            if let emoji = pattern.emoji {
                Text(emoji)
                    .responsiveFont(.largeTitle)
            } else {
                Text("❓")
                    .responsiveFont(.largeTitle)
            }

        case .complex:
            VStack(spacing: 4) {
                Image(systemName: "square.grid.3x3.fill")
                    .font(.title)
                    .foregroundStyle(.secondary)
                Text(NSLocalizedString("drawing.complex_pattern", comment: ""))
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

        case .none, .gps:
            Circle()
                .fill(.blue)
                .frame(width: 60, height: 60)
        }
    }

    private var colorCircleView: some View {
        let color = pattern.color.flatMap { Color(hex: $0) } ?? .blue
        return Circle()
            .fill(color)
            .frame(width: 60, height: 60)
            .shadow(color: color.opacity(0.3), radius: 8)
    }

    private var patternTypeTag: some View {
        HStack(spacing: 6) {
            if pattern.isAlliancePattern {
                Label("联盟旗帜", systemImage: "flag.fill")
                    .font(.caption)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(.blue.opacity(0.1))
                    .foregroundStyle(.blue)
                    .cornerRadius(8)
            } else {
                Label("默认颜色", systemImage: "paintpalette")
                    .font(.caption)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(.orange.opacity(0.1))
                    .foregroundStyle(.orange)
                    .cornerRadius(8)
            }

            switch pattern.type {
            case .color:
                Label("颜色", systemImage: "paintbrush.fill")
                    .font(.caption)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(.gray.opacity(0.1))
                    .cornerRadius(8)

            case .emoji:
                Label("表情", systemImage: "face.smiling.fill")
                    .font(.caption)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(.gray.opacity(0.1))
                    .cornerRadius(8)

            case .complex:
                Label("图案", systemImage: "square.grid.3x3.fill")
                    .font(.caption)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(.gray.opacity(0.1))
                    .cornerRadius(8)

            case .none, .gps:
                EmptyView()
            }
        }
    }
}

// MARK: - Loading Pattern Card

/// 加载中图案卡片
struct LoadingPatternCard: View {
    var body: some View {
        VStack(spacing: 12) {
            ProgressView()
                .scaleEffect(0.8)

            Text(NSLocalizedString("drawing.loading_alliance_flag", comment: ""))
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .padding()
        .frame(maxWidth: .infinity)
        .background(.ultraThinMaterial)
        .cornerRadius(12)
    }
}

// MARK: - Alliance Drawing Mode Picker

// MARK: - Compact Alliance Pattern Card

/// 紧凑版联盟图案卡片
struct CompactAlliancePatternCard: View {
    let pattern: DrawingPattern

    var body: some View {
        HStack(spacing: 10) {
            // 紧凑的图案预览
            compactPatternPreview

            // 图案信息
            VStack(alignment: .leading, spacing: 2) {
                Text(pattern.patternName)
                    .font(.subheadline)
                    .fontWeight(.medium)
                    .lineLimit(1)

                // 类型标签
                patternTypeLabel
            }

            Spacer()

            // 联盟/默认指示器
            if pattern.isAlliancePattern {
                Image(systemName: "flag.fill")
                    .font(.caption)
                    .foregroundStyle(.blue)
            } else {
                Image(systemName: "paintpalette")
                    .font(.caption)
                    .foregroundStyle(.orange)
            }
        }
        .padding(10)
        .background(.ultraThinMaterial)
        .cornerRadius(10)
    }

    @ViewBuilder
    private var compactPatternPreview: some View {
        switch pattern.type {
        case .color:
            let color = pattern.color.flatMap { Color(hex: $0) } ?? .blue
            Circle()
                .fill(color)
                .frame(width: 36, height: 36)
                .shadow(color: color.opacity(0.3), radius: 4)

        case .emoji:
            if let emoji = pattern.emoji {
                Text(emoji)
                    .responsiveFont(.title2)
            } else {
                Text("❓")
                    .responsiveFont(.title2)
            }

        case .complex:
            Image(systemName: "square.grid.3x3.fill")
                .font(.title3)
                .foregroundStyle(.secondary)
                .frame(width: 36, height: 36)

        case .none, .gps:
            Circle()
                .fill(.blue)
                .frame(width: 36, height: 36)
        }
    }

    private var patternTypeLabel: some View {
        Group {
            switch pattern.type {
            case .color:
                Text(NSLocalizedString("pattern.type.color", comment: "Color pattern"))
                    .font(.caption2)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(.gray.opacity(0.1))
                    .cornerRadius(4)
            case .emoji:
                Text(NSLocalizedString("pattern.type.emoji", comment: "Emoji pattern"))
                    .font(.caption2)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(.gray.opacity(0.1))
                    .cornerRadius(4)
            case .complex:
                Text(NSLocalizedString("pattern.type.complex", comment: "Complex pattern"))
                    .font(.caption2)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(.gray.opacity(0.1))
                    .cornerRadius(4)
            case .none, .gps:
                EmptyView()
            }
        }
        .foregroundStyle(.secondary)
    }
}

// MARK: - Compact Loading Pattern Card

/// 紧凑版加载中图案卡片
struct CompactLoadingPatternCard: View {
    var body: some View {
        HStack(spacing: 10) {
            ProgressView()
                .scaleEffect(0.7)

            Text(NSLocalizedString("pattern.loading_alliance_flag", comment: "Loading alliance flag"))
                .font(.caption)
                .foregroundStyle(.secondary)

            Spacer()
        }
        .padding(10)
        .background(.ultraThinMaterial)
        .cornerRadius(10)
    }
}
