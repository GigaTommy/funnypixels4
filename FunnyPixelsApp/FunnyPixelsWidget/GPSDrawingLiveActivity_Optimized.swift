import ActivityKit
import WidgetKit
import SwiftUI

/// GPS Drawing Live Activity 视图 - 优化版本
/// 突出 FunnyPixels 品牌，使用 SVG 图标，美观简约的设计
@available(iOS 16.1, *)
struct GPSDrawingLiveActivity_Optimized: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: GPSDrawingActivityAttributes.self) { context in
            // 锁屏/通知中心视图
            OptimizedLockScreenView(context: context)
        } dynamicIsland: { context in
            DynamicIsland {
                // 展开区域 - 长按灵动岛时显示
                DynamicIslandExpandedRegion(.leading) {
                    OptimizedExpandedLeadingView(context: context)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    OptimizedExpandedTrailingView(context: context)
                }
                DynamicIslandExpandedRegion(.center) {
                    OptimizedExpandedCenterView(context: context)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    OptimizedExpandedBottomView(context: context)
                }
            } compactLeading: {
                // 紧凑态左侧 - FunnyPixels Logo
                OptimizedCompactLeadingView(context: context)
            } compactTrailing: {
                // 紧凑态右侧 - 已绘像素数
                OptimizedCompactTrailingView(context: context)
            } minimal: {
                // 最小态 - 品牌化设计
                OptimizedMinimalView(context: context)
            }
        }
    }
}

// MARK: - 紧凑态视图 (Compact Views)

@available(iOS 16.1, *)
private struct OptimizedCompactLeadingView: View {
    let context: ActivityViewContext<GPSDrawingActivityAttributes>

    var body: some View {
        HStack(spacing: 3) {
            // FunnyPixels Logo
            FunnyPixelsLogoIcon(size: 16)

            // 状态指示器
            if context.state.isFrozen {
                Circle()
                    .fill(Color.cyan)
                    .frame(width: 6, height: 6)
            } else if context.state.isActive {
                Circle()
                    .fill(Color.green)
                    .frame(width: 6, height: 6)
                    .opacity(0.8)
            }
        }
    }
}

@available(iOS 16.1, *)
private struct OptimizedCompactTrailingView: View {
    let context: ActivityViewContext<GPSDrawingActivityAttributes>

    var body: some View {
        if context.state.isFrozen {
            // 冻结状态 - 显示倒计时
            HStack(spacing: 2) {
                FreezeIcon(size: 10, animated: false)
                Text("\(context.state.freezeSecondsLeft)")
                    .font(.system(size: 12, weight: .bold, design: .rounded))
                    .foregroundColor(.cyan)
            }
        } else {
            // 活跃状态 - 显示像素数
            Text("\(context.state.pixelsDrawn)")
                .font(.system(size: 13, weight: .bold, design: .rounded))
                .foregroundColor(.white)
        }
    }
}

// MARK: - 最小态视图 (Minimal View)

@available(iOS 16.1, *)
private struct OptimizedMinimalView: View {
    let context: ActivityViewContext<GPSDrawingActivityAttributes>

    var body: some View {
        ZStack {
            // 品牌色背景
            LinearGradient(
                colors: [
                    Color(hex: "#4ECDC4")?.opacity(0.3) ?? .cyan.opacity(0.3),
                    Color(hex: "#FFE66D")?.opacity(0.3) ?? .yellow.opacity(0.3)
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .clipShape(Circle())

            if context.state.isFrozen {
                FreezeIcon(size: 12, animated: false)
            } else {
                PixelBrushIcon(size: 12, color: .white)
            }
        }
    }
}

// MARK: - 展开态视图 (Expanded Views)

@available(iOS 16.1, *)
private struct OptimizedExpandedLeadingView: View {
    let context: ActivityViewContext<GPSDrawingActivityAttributes>

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            // FunnyPixels Logo
            FunnyPixelsLogoIcon(size: 32)

            // 品牌名称
            Text("FunnyPixels")
                .font(.system(size: 10, weight: .bold))
                .foregroundStyle(
                    LinearGradient(
                        colors: [Color(hex: "#4ECDC4") ?? .cyan, Color(hex: "#FFE66D") ?? .yellow],
                        startPoint: .leading,
                        endPoint: .trailing
                    )
                )
        }
        .padding(.top, 4)
    }
}

@available(iOS 16.1, *)
private struct OptimizedExpandedTrailingView: View {
    let context: ActivityViewContext<GPSDrawingActivityAttributes>

    var body: some View {
        VStack(alignment: .trailing, spacing: 6) {
            // 像素数 - 大字号展示
            HStack(spacing: 4) {
                Text("\(context.state.pixelsDrawn)")
                    .font(.system(size: 32, weight: .bold, design: .rounded))
                    .foregroundStyle(
                        LinearGradient(
                            colors: [.white, Color(hex: context.attributes.allianceColorHex) ?? .green],
                            startPoint: .top,
                            endPoint: .bottom
                        )
                    )

                PixelGridIcon(size: 20, color: Color(hex: context.attributes.allianceColorHex) ?? .green, animated: false)
            }

            // 联盟信息
            if !context.attributes.allianceName.isEmpty {
                Text(context.attributes.allianceName)
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundColor(Color(hex: context.attributes.allianceColorHex) ?? .white)
                    .lineLimit(1)
            } else {
                Text("Drawing")
                    .font(.system(size: 11, weight: .medium))
                    .foregroundColor(.secondary)
            }
        }
        .padding(.top, 4)
    }
}

@available(iOS 16.1, *)
private struct OptimizedExpandedCenterView: View {
    let context: ActivityViewContext<GPSDrawingActivityAttributes>

    var body: some View {
        VStack(spacing: 4) {
            if context.state.isFrozen {
                // 冻结状态 - 醒目提示
                VStack(spacing: 6) {
                    FreezeIcon(size: 24, animated: true)

                    Text("Cooldown")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundColor(.cyan)

                    if context.state.freezeSecondsLeft > 0 {
                        Text(formatTime(context.state.freezeSecondsLeft))
                            .font(.system(size: 16, weight: .bold, design: .rounded))
                            .foregroundColor(.cyan)
                    }
                }
            } else if context.state.isActive {
                // 活跃绘制中 - 动态效果
                VStack(spacing: 6) {
                    GPSSignalIcon(size: 24, isActive: true)

                    HStack(spacing: 4) {
                        Text("Drawing")
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundColor(.green)

                        Circle()
                            .fill(.green)
                            .frame(width: 6, height: 6)
                            .opacity(0.8)
                    }

                    // 用时显示
                    Text(formatTime(context.state.elapsedSeconds))
                        .font(.system(size: 14, weight: .medium, design: .rounded))
                        .foregroundColor(.white)
                }
            } else {
                VStack(spacing: 4) {
                    PixelBrushIcon(size: 24, color: .secondary)

                    Text("Stopped")
                        .font(.system(size: 12, weight: .medium))
                        .foregroundColor(.secondary)
                }
            }
        }
    }

    private func formatTime(_ seconds: Int) -> String {
        let hours = seconds / 3600
        let minutes = (seconds % 3600) / 60
        let secs = seconds % 60
        if hours > 0 {
            return String(format: "%d:%02d:%02d", hours, minutes, secs)
        }
        return String(format: "%02d:%02d", minutes, secs)
    }
}

@available(iOS 16.1, *)
private struct OptimizedExpandedBottomView: View {
    let context: ActivityViewContext<GPSDrawingActivityAttributes>

    var body: some View {
        VStack(spacing: 8) {
            // 点数进度条 - 优化设计
            OptimizedProgressBar(
                remaining: context.state.remainingPoints,
                isFrozen: context.state.isFrozen,
                allianceColorHex: context.attributes.allianceColorHex
            )
            .frame(height: 8)

            // 底部信息行
            HStack(spacing: 12) {
                // 剩余点数
                HStack(spacing: 4) {
                    DiamondPointsIcon(size: 12, color: pointsColor(context.state.remainingPoints))
                    Text("\(context.state.remainingPoints)")
                        .font(.system(size: 13, weight: .bold, design: .rounded))
                        .foregroundColor(pointsColor(context.state.remainingPoints))
                    Text("pts")
                        .font(.system(size: 10, weight: .medium))
                        .foregroundColor(.secondary)
                }

                Spacer()

                // 绘制速率
                if context.state.elapsedSeconds > 0 {
                    let rate = Double(context.state.pixelsDrawn) / (Double(context.state.elapsedSeconds) / 60.0)

                    HStack(spacing: 4) {
                        SpeedIcon(size: 12, color: .white.opacity(0.7))
                        Text(String(format: "%.0f", rate))
                            .font(.system(size: 13, weight: .semibold, design: .rounded))
                            .foregroundColor(.white)
                        Text("px/min")
                            .font(.system(size: 9, weight: .medium))
                            .foregroundColor(.secondary)
                    }
                }
            }
        }
    }

    private func pointsColor(_ points: Int) -> Color {
        if points <= 5 { return .red }
        if points <= 15 { return .orange }
        return .yellow
    }
}

// MARK: - 优化的进度条

@available(iOS 16.1, *)
private struct OptimizedProgressBar: View {
    let remaining: Int
    let isFrozen: Bool
    let allianceColorHex: String

    private var progress: Double {
        min(1.0, Double(remaining) / 64.0)
    }

    var body: some View {
        GeometryReader { geometry in
            ZStack(alignment: .leading) {
                // 背景 - 渐变效果
                RoundedRectangle(cornerRadius: 4)
                    .fill(
                        LinearGradient(
                            colors: [Color.white.opacity(0.05), Color.white.opacity(0.15)],
                            startPoint: .leading,
                            endPoint: .trailing
                        )
                    )

                // 进度条 - 渐变填充
                RoundedRectangle(cornerRadius: 4)
                    .fill(barGradient)
                    .frame(width: max(8, geometry.size.width * progress))
                    .overlay(
                        // 高光效果
                        RoundedRectangle(cornerRadius: 4)
                            .fill(
                                LinearGradient(
                                    colors: [Color.white.opacity(0.3), Color.clear],
                                    startPoint: .top,
                                    endPoint: .bottom
                                )
                            )
                            .frame(width: max(8, geometry.size.width * progress))
                    )
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: 4))
    }

    private var barGradient: LinearGradient {
        let colors: [Color]
        if isFrozen {
            colors = [Color.cyan.opacity(0.8), Color.cyan]
        } else if remaining <= 5 {
            colors = [Color.red.opacity(0.8), Color.red]
        } else if remaining <= 15 {
            colors = [Color.orange.opacity(0.8), Color.orange]
        } else {
            let allianceColor = Color(hex: allianceColorHex) ?? .green
            colors = [allianceColor.opacity(0.8), allianceColor]
        }
        return LinearGradient(colors: colors, startPoint: .leading, endPoint: .trailing)
    }
}

// MARK: - 锁屏视图 (Lock Screen View) - 完全优化版

@available(iOS 16.1, *)
private struct OptimizedLockScreenView: View {
    let context: ActivityViewContext<GPSDrawingActivityAttributes>

    var body: some View {
        VStack(spacing: 0) {
            // 顶部品牌栏 - 突出 FunnyPixels
            brandHeader

            // 核心数据区域
            coreDataSection
                .padding(.vertical, 16)

            // 底部进度和信息
            bottomSection
        }
        .padding(16)
        .background(
            // 渐变背景
            LinearGradient(
                colors: [
                    Color.black.opacity(0.9),
                    Color(hex: context.attributes.allianceColorHex)?.opacity(0.1) ?? Color.black.opacity(0.85)
                ],
                startPoint: .top,
                endPoint: .bottom
            )
        )
        .overlay(
            // 品牌色边框
            RoundedRectangle(cornerRadius: 20)
                .strokeBorder(
                    LinearGradient(
                        colors: [
                            Color(hex: "#4ECDC4")?.opacity(0.5) ?? .cyan,
                            Color(hex: "#FFE66D")?.opacity(0.3) ?? .yellow
                        ],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    ),
                    lineWidth: 1.5
                )
        )
        .clipShape(RoundedRectangle(cornerRadius: 20))
    }

    // MARK: - 品牌头部
    private var brandHeader: some View {
        HStack(spacing: 8) {
            // Logo
            FunnyPixelsLogoIcon(size: 28)

            // 品牌名 + 副标题
            VStack(alignment: .leading, spacing: 2) {
                Text("FunnyPixels")
                    .font(.system(size: 16, weight: .bold))
                    .foregroundStyle(
                        LinearGradient(
                            colors: [Color(hex: "#4ECDC4") ?? .cyan, Color(hex: "#FFE66D") ?? .yellow],
                            startPoint: .leading,
                            endPoint: .trailing
                        )
                    )

                Text("GPS Drawing")
                    .font(.system(size: 11, weight: .medium))
                    .foregroundColor(.white.opacity(0.7))
            }

            Spacer()

            // 联盟标识
            if !context.attributes.allianceName.isEmpty {
                VStack(alignment: .trailing, spacing: 2) {
                    Circle()
                        .fill(Color(hex: context.attributes.allianceColorHex) ?? .green)
                        .frame(width: 8, height: 8)
                        .overlay(
                            Circle()
                                .strokeBorder(Color.white.opacity(0.3), lineWidth: 1)
                        )

                    Text(context.attributes.allianceName)
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundColor(Color(hex: context.attributes.allianceColorHex) ?? .white)
                        .lineLimit(1)
                }
            }
        }
        .padding(.bottom, 12)
    }

    // MARK: - 核心数据区域
    private var coreDataSection: some View {
        HStack(spacing: 0) {
            // 左侧：已绘像素
            VStack(spacing: 8) {
                PixelGridIcon(size: 32, color: .white, animated: context.state.isActive)

                Text("\(context.state.pixelsDrawn)")
                    .font(.system(size: 36, weight: .bold, design: .rounded))
                    .foregroundStyle(
                        LinearGradient(
                            colors: [.white, Color(hex: context.attributes.allianceColorHex) ?? .green],
                            startPoint: .top,
                            endPoint: .bottom
                        )
                    )

                Text("pixels")
                    .font(.system(size: 11, weight: .medium))
                    .foregroundColor(.white.opacity(0.6))
            }
            .frame(maxWidth: .infinity)

            // 中间：状态指示器
            VStack(spacing: 8) {
                if context.state.isFrozen {
                    FreezeIcon(size: 40, animated: true)
                    Text("Cooldown")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundColor(.cyan)
                    Text(formatTime(context.state.freezeSecondsLeft))
                        .font(.system(size: 14, weight: .bold, design: .rounded))
                        .foregroundColor(.cyan)
                } else if context.state.isActive {
                    GPSSignalIcon(size: 40, isActive: true)
                    Text("Active")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundColor(.green)
                    Text(formatTime(context.state.elapsedSeconds))
                        .font(.system(size: 14, weight: .medium, design: .rounded))
                        .foregroundColor(.white.opacity(0.8))
                } else {
                    PixelBrushIcon(size: 40, color: .white.opacity(0.4))
                    Text("Paused")
                        .font(.system(size: 12, weight: .medium))
                        .foregroundColor(.white.opacity(0.5))
                }
            }
            .frame(maxWidth: .infinity)

            // 右侧：剩余点数
            VStack(spacing: 8) {
                DiamondPointsIcon(size: 32, color: pointsColor)

                Text("\(context.state.remainingPoints)")
                    .font(.system(size: 36, weight: .bold, design: .rounded))
                    .foregroundColor(pointsColor)

                Text("points")
                    .font(.system(size: 11, weight: .medium))
                    .foregroundColor(.white.opacity(0.6))
            }
            .frame(maxWidth: .infinity)
        }
    }

    // MARK: - 底部区域
    private var bottomSection: some View {
        VStack(spacing: 10) {
            // 点数进度条
            OptimizedProgressBar(
                remaining: context.state.remainingPoints,
                isFrozen: context.state.isFrozen,
                allianceColorHex: context.attributes.allianceColorHex
            )
            .frame(height: 10)

            // 绘制速率
            if context.state.elapsedSeconds > 0 {
                let rate = Double(context.state.pixelsDrawn) / (Double(context.state.elapsedSeconds) / 60.0)

                HStack {
                    SpeedIcon(size: 14, color: .white.opacity(0.7))

                    Text("Drawing Speed:")
                        .font(.system(size: 11, weight: .medium))
                        .foregroundColor(.white.opacity(0.6))

                    Spacer()

                    Text(String(format: "%.1f px/min", rate))
                        .font(.system(size: 13, weight: .bold, design: .rounded))
                        .foregroundColor(.white)
                }
            }
        }
    }

    private var pointsColor: Color {
        if context.state.remainingPoints <= 5 { return .red }
        if context.state.remainingPoints <= 15 { return .orange }
        return .yellow
    }

    private func formatTime(_ seconds: Int) -> String {
        let hours = seconds / 3600
        let minutes = (seconds % 3600) / 60
        let secs = seconds % 60
        if hours > 0 {
            return String(format: "%d:%02d:%02d", hours, minutes, secs)
        }
        return String(format: "%d:%02d", minutes, secs)
    }
}

// MARK: - Preview

@available(iOS 16.1, *)
#Preview("Optimized - Active", as: .content, using: GPSDrawingActivityAttributes(
    allianceName: "PixelWarriors",
    allianceColorHex: "#4ECDC4"
)) {
    GPSDrawingLiveActivity_Optimized()
} contentStates: {
    GPSDrawingActivityAttributes.ContentState(
        pixelsDrawn: 156,
        remainingPoints: 42,
        elapsedSeconds: 1234,
        isFrozen: false,
        freezeSecondsLeft: 0,
        isActive: true
    )
}

@available(iOS 16.1, *)
#Preview("Optimized - Frozen", as: .content, using: GPSDrawingActivityAttributes(
    allianceName: "PixelWarriors",
    allianceColorHex: "#FFE66D"
)) {
    GPSDrawingLiveActivity_Optimized()
} contentStates: {
    GPSDrawingActivityAttributes.ContentState(
        pixelsDrawn: 234,
        remainingPoints: 8,
        elapsedSeconds: 2567,
        isFrozen: true,
        freezeSecondsLeft: 38,
        isActive: true
    )
}

@available(iOS 16.1, *)
#Preview("Optimized - Low Points", as: .content, using: GPSDrawingActivityAttributes(
    allianceName: "",
    allianceColorHex: "#A8E6CF"
)) {
    GPSDrawingLiveActivity_Optimized()
} contentStates: {
    GPSDrawingActivityAttributes.ContentState(
        pixelsDrawn: 89,
        remainingPoints: 3,
        elapsedSeconds: 945,
        isFrozen: false,
        freezeSecondsLeft: 0,
        isActive: true
    )
}
