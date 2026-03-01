import ActivityKit
import WidgetKit
import SwiftUI

/// GPS Drawing Live Activity 视图
/// 支持灵动岛（紧凑/展开）和锁屏小部件，展示 GPS 绘制进度
@available(iOS 16.1, *)
struct GPSDrawingLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: GPSDrawingActivityAttributes.self) { context in
            // 锁屏/通知中心视图
            GPSDrawingLockScreenView(context: context)
        } dynamicIsland: { context in
            DynamicIsland {
                // 展开区域 - 长按灵动岛时显示
                DynamicIslandExpandedRegion(.leading) {
                    GPSExpandedLeadingView(context: context)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    GPSExpandedTrailingView(context: context)
                }
                DynamicIslandExpandedRegion(.center) {
                    GPSExpandedCenterView(context: context)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    GPSExpandedBottomView(context: context)
                }
            } compactLeading: {
                // 紧凑态左侧 - 联盟色圆点 + 绘制图标
                GPSCompactLeadingView(context: context)
            } compactTrailing: {
                // 紧凑态右侧 - 已绘像素数
                GPSCompactTrailingView(context: context)
            } minimal: {
                // 最小态 - 与其他 Activity 共存时
                GPSMinimalView(context: context)
            }
        }
    }
}

// MARK: - 紧凑态视图 (Compact Views)

@available(iOS 16.1, *)
private struct GPSCompactLeadingView: View {
    let context: ActivityViewContext<GPSDrawingActivityAttributes>

    var body: some View {
        HStack(spacing: 4) {
            Circle()
                .fill(Color(hex: context.attributes.allianceColorHex) ?? .green)
                .frame(width: 10, height: 10)

            Image(systemName: "paintbrush.pointed.fill")
                .font(.system(size: 12, weight: .bold))
                .foregroundColor(.green)
        }
    }
}

@available(iOS 16.1, *)
private struct GPSCompactTrailingView: View {
    let context: ActivityViewContext<GPSDrawingActivityAttributes>

    var body: some View {
        if context.state.isFrozen {
            // 冻结状态显示冰冻图标
            Image(systemName: "snowflake")
                .font(.system(size: 12))
                .foregroundColor(.cyan)
        } else {
            Text("\(context.state.pixelsDrawn)px")
                .font(.system(size: 14, weight: .bold, design: .rounded))
                .foregroundColor(.white)
        }
    }
}

// MARK: - 最小态视图 (Minimal View)

@available(iOS 16.1, *)
private struct GPSMinimalView: View {
    let context: ActivityViewContext<GPSDrawingActivityAttributes>

    var body: some View {
        ZStack {
            Circle()
                .fill(Color(hex: context.attributes.allianceColorHex)?.opacity(0.3) ?? .clear)

            if context.state.isFrozen {
                Image(systemName: "snowflake")
                    .font(.system(size: 12))
                    .foregroundColor(.cyan)
            } else {
                Text("\(context.state.pixelsDrawn)")
                    .font(.system(size: 12, weight: .bold, design: .rounded))
                    .foregroundColor(.white)
            }
        }
    }
}

// MARK: - 展开态视图 (Expanded Views)

@available(iOS 16.1, *)
private struct GPSExpandedLeadingView: View {
    let context: ActivityViewContext<GPSDrawingActivityAttributes>

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Image(systemName: "paintbrush.pointed.fill")
                .font(.title2)
                .foregroundColor(.green)

            Text("GPS Drawing")
                .font(.caption2)
                .foregroundColor(.secondary)
        }
    }
}

@available(iOS 16.1, *)
private struct GPSExpandedTrailingView: View {
    let context: ActivityViewContext<GPSDrawingActivityAttributes>

    var body: some View {
        VStack(alignment: .trailing, spacing: 4) {
            Text("\(context.state.pixelsDrawn)")
                .font(.system(size: 28, weight: .bold, design: .rounded))
                .foregroundColor(.white)

            Text(context.attributes.allianceName.isEmpty ? "pixels" : context.attributes.allianceName)
                .font(.caption)
                .foregroundColor(Color(hex: context.attributes.allianceColorHex) ?? .white)
                .lineLimit(1)
        }
    }
}

@available(iOS 16.1, *)
private struct GPSExpandedCenterView: View {
    let context: ActivityViewContext<GPSDrawingActivityAttributes>

    var body: some View {
        VStack(spacing: 2) {
            if context.state.isFrozen {
                // 冻结状态
                HStack(spacing: 4) {
                    Image(systemName: "snowflake")
                        .font(.caption)
                        .foregroundColor(.cyan)
                    Text("Cooldown")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundColor(.cyan)
                }
                if context.state.freezeSecondsLeft > 0 {
                    Text(formatTime(context.state.freezeSecondsLeft))
                        .font(.system(size: 11, weight: .medium, design: .monospaced))
                        .foregroundColor(.secondary)
                }
            } else if context.state.isActive {
                // 活跃绘制中
                HStack(spacing: 4) {
                    Circle()
                        .fill(.green)
                        .frame(width: 6, height: 6)
                    Text("Drawing...")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundColor(.white)
                }
                HStack(spacing: 4) {
                    Image(systemName: "clock")
                        .font(.caption2)
                    Text(formatTime(context.state.elapsedSeconds))
                        .font(.system(size: 11, weight: .medium, design: .monospaced))
                }
                .foregroundColor(.secondary)
            } else {
                Text("Stopped")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundColor(.secondary)
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
private struct GPSExpandedBottomView: View {
    let context: ActivityViewContext<GPSDrawingActivityAttributes>

    var body: some View {
        VStack(spacing: 8) {
            // 点数进度条
            GPSPointsProgressBar(
                remaining: context.state.remainingPoints,
                isFrozen: context.state.isFrozen,
                allianceColorHex: context.attributes.allianceColorHex
            )
            .frame(height: 6)

            // 底部信息行
            HStack {
                // 剩余点数
                HStack(spacing: 4) {
                    Image(systemName: "diamond.fill")
                        .font(.system(size: 9))
                        .foregroundColor(.yellow)
                    Text("\(context.state.remainingPoints) pts")
                        .font(.system(size: 11, weight: .medium, design: .rounded))
                        .foregroundColor(.white)
                }

                Spacer()

                // 绘制速率
                if context.state.elapsedSeconds > 0 {
                    let rate = Double(context.state.pixelsDrawn) / (Double(context.state.elapsedSeconds) / 60.0)
                    Text(String(format: "%.0f px/min", rate))
                        .font(.system(size: 10, weight: .regular, design: .monospaced))
                        .foregroundColor(.secondary)
                }
            }
        }
    }
}

@available(iOS 16.1, *)
private struct GPSPointsProgressBar: View {
    let remaining: Int
    let isFrozen: Bool
    let allianceColorHex: String

    // 假设最大自然点数 64（与 PixelDrawService 一致）
    private var progress: Double {
        min(1.0, Double(remaining) / 64.0)
    }

    var body: some View {
        GeometryReader { geometry in
            ZStack(alignment: .leading) {
                // 背景
                RoundedRectangle(cornerRadius: 3)
                    .fill(Color.white.opacity(0.1))

                // 进度条
                RoundedRectangle(cornerRadius: 3)
                    .fill(barColor)
                    .frame(width: max(4, geometry.size.width * progress))
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: 3))
    }

    private var barColor: Color {
        if isFrozen {
            return .cyan.opacity(0.6)
        }
        if remaining <= 5 {
            return .red
        }
        if remaining <= 15 {
            return .orange
        }
        return Color(hex: allianceColorHex) ?? .green
    }
}

// MARK: - 锁屏视图 (Lock Screen View)

@available(iOS 16.1, *)
private struct GPSDrawingLockScreenView: View {
    let context: ActivityViewContext<GPSDrawingActivityAttributes>

    var body: some View {
        VStack(spacing: 12) {
            // 顶部：状态 + 用时
            HStack {
                HStack(spacing: 6) {
                    Image(systemName: "paintbrush.pointed.fill")
                        .foregroundColor(.green)

                    Text("GPS Drawing")
                        .font(.headline)
                        .foregroundColor(.white)

                    if !context.attributes.allianceName.isEmpty {
                        Text("- \(context.attributes.allianceName)")
                            .font(.subheadline)
                            .foregroundColor(Color(hex: context.attributes.allianceColorHex) ?? .white)
                            .lineLimit(1)
                    }
                }

                Spacer()

                // 用时
                HStack(spacing: 4) {
                    Image(systemName: "clock")
                        .font(.caption2)
                    Text(formatTime(context.state.elapsedSeconds))
                        .font(.system(size: 14, weight: .medium, design: .monospaced))
                }
                .foregroundColor(.secondary)
            }

            // 核心数据行
            HStack(spacing: 20) {
                // 已绘制像素
                VStack(spacing: 2) {
                    Text("\(context.state.pixelsDrawn)")
                        .font(.system(size: 32, weight: .bold, design: .rounded))
                        .foregroundColor(.white)
                    Text("pixels")
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }

                Spacer()

                // 状态指示器
                if context.state.isFrozen {
                    VStack(spacing: 4) {
                        Image(systemName: "snowflake")
                            .font(.title2)
                            .foregroundColor(.cyan)
                        Text("Cooldown \(formatTime(context.state.freezeSecondsLeft))")
                            .font(.system(size: 11, weight: .medium))
                            .foregroundColor(.cyan)
                    }
                } else if context.state.isActive {
                    VStack(spacing: 4) {
                        Image(systemName: "location.fill")
                            .font(.title2)
                            .foregroundColor(.green)
                        Text("Active")
                            .font(.system(size: 11, weight: .medium))
                            .foregroundColor(.green)
                    }
                }

                Spacer()

                // 剩余点数
                VStack(spacing: 2) {
                    Text("\(context.state.remainingPoints)")
                        .font(.system(size: 32, weight: .bold, design: .rounded))
                        .foregroundColor(pointsColor)
                    Text("points")
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }
            }

            // 点数进度条
            GPSPointsProgressBar(
                remaining: context.state.remainingPoints,
                isFrozen: context.state.isFrozen,
                allianceColorHex: context.attributes.allianceColorHex
            )
            .frame(height: 8)
        }
        .padding(16)
        .background(Color.black.opacity(0.8))
    }

    private var pointsColor: Color {
        if context.state.remainingPoints <= 5 {
            return .red
        }
        if context.state.remainingPoints <= 15 {
            return .orange
        }
        return .yellow
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

// MARK: - Preview

@available(iOS 16.1, *)
#Preview("GPS Drawing - Active", as: .content, using: GPSDrawingActivityAttributes(
    allianceName: "PixelKings",
    allianceColorHex: "#4ECDC4"
)) {
    GPSDrawingLiveActivity()
} contentStates: {
    GPSDrawingActivityAttributes.ContentState(
        pixelsDrawn: 42,
        remainingPoints: 38,
        elapsedSeconds: 754,
        isFrozen: false,
        freezeSecondsLeft: 0,
        isActive: true
    )
}

@available(iOS 16.1, *)
#Preview("GPS Drawing - Frozen", as: .content, using: GPSDrawingActivityAttributes(
    allianceName: "PixelKings",
    allianceColorHex: "#4ECDC4"
)) {
    GPSDrawingLiveActivity()
} contentStates: {
    GPSDrawingActivityAttributes.ContentState(
        pixelsDrawn: 87,
        remainingPoints: 0,
        elapsedSeconds: 1234,
        isFrozen: true,
        freezeSecondsLeft: 45,
        isActive: true
    )
}
