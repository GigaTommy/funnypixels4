import SwiftUI

/// Live Activity SVG 图标库 - 更新版本
/// 使用项目实际Logo和品牌元素

// MARK: - FunnyPixels Logo (实际风格)

struct FunnyPixelsLogoIcon: View {
    var size: CGFloat = 24

    init(size: CGFloat = 24) {
        self.size = size
    }

    var body: some View {
        GeometryReader { geometry in
            let s = min(geometry.size.width, geometry.size.height)

            ZStack {
                // 方案1：像素地图定位标记（推荐）
                PixelMapPinLogoStyle(size: s)
            }
        }
        .frame(width: size, height: size)
    }
}

// MARK: - Logo Style 1: 像素地图定位标记（主推荐）

private struct PixelMapPinLogoStyle: View {
    let size: CGFloat

    var body: some View {
        ZStack {
            // 外圈渐变圆环
            Circle()
                .strokeBorder(
                    LinearGradient(
                        colors: [
                            Color(hex: "#4ECDC4") ?? .cyan,
                            Color(hex: "#FFE66D") ?? .yellow
                        ],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    ),
                    lineWidth: size * 0.1
                )

            // 地图定位标记形状
            Path { path in
                let center = size * 0.5
                let markerWidth = size * 0.5
                let markerHeight = size * 0.65

                // 定位标记的圆形顶部
                let topY = size * 0.2
                path.addArc(
                    center: CGPoint(x: center, y: topY + markerWidth * 0.3),
                    radius: markerWidth * 0.3,
                    startAngle: .degrees(0),
                    endAngle: .degrees(360),
                    clockwise: false
                )

                // 定位标记的尖端
                path.move(to: CGPoint(x: center - markerWidth * 0.25, y: topY + markerWidth * 0.5))
                path.addLine(to: CGPoint(x: center, y: topY + markerHeight))
                path.addLine(to: CGPoint(x: center + markerWidth * 0.25, y: topY + markerWidth * 0.5))
            }
            .fill(
                LinearGradient(
                    colors: [Color(hex: "#4ECDC4") ?? .cyan, Color(hex: "#FFE66D") ?? .yellow],
                    startPoint: .top,
                    endPoint: .bottom
                )
            )

            // 中心像素点（代表绘画）
            Path { path in
                let pixelSize = size * 0.15
                let centerX = size * 0.5
                let centerY = size * 0.32

                // 绘制一个小像素方块
                path.addRoundedRect(
                    in: CGRect(
                        x: centerX - pixelSize * 0.5,
                        y: centerY - pixelSize * 0.5,
                        width: pixelSize,
                        height: pixelSize
                    ),
                    cornerSize: CGSize(width: 1, height: 1)
                )
            }
            .fill(Color.white)
        }
    }
}

// MARK: - Logo Style 2: 像素风格字母 "F"（备选）

struct PixelLetterFLogoStyle: View {
    let size: CGFloat

    var body: some View {
        ZStack {
            // 外圈渐变
            RoundedRectangle(cornerRadius: size * 0.2)
                .strokeBorder(
                    LinearGradient(
                        colors: [
                            Color(hex: "#4ECDC4") ?? .cyan,
                            Color(hex: "#FFE66D") ?? .yellow
                        ],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    ),
                    lineWidth: size * 0.08
                )

            // 像素风格的 "F"
            Path { path in
                let pixelSize = size * 0.08
                let startX = size * 0.3
                let startY = size * 0.2

                // F 的垂直部分（5个像素高）
                for i in 0..<5 {
                    let rect = CGRect(
                        x: startX,
                        y: startY + CGFloat(i) * pixelSize * 1.2,
                        width: pixelSize,
                        height: pixelSize
                    )
                    path.addRoundedRect(in: rect, cornerSize: CGSize(width: 1, height: 1))
                }

                // F 的顶部横线（3个像素宽）
                for i in 1..<4 {
                    let rect = CGRect(
                        x: startX + CGFloat(i) * pixelSize * 1.2,
                        y: startY,
                        width: pixelSize,
                        height: pixelSize
                    )
                    path.addRoundedRect(in: rect, cornerSize: CGSize(width: 1, height: 1))
                }

                // F 的中部横线（2个像素宽）
                for i in 1..<3 {
                    let rect = CGRect(
                        x: startX + CGFloat(i) * pixelSize * 1.2,
                        y: startY + 2 * pixelSize * 1.2,
                        width: pixelSize,
                        height: pixelSize
                    )
                    path.addRoundedRect(in: rect, cornerSize: CGSize(width: 1, height: 1))
                }
            }
            .fill(
                LinearGradient(
                    colors: [Color.white, Color(hex: "#4ECDC4") ?? .cyan],
                    startPoint: .top,
                    endPoint: .bottom
                )
            )
        }
    }
}

// MARK: - Logo Style 3: 像素画笔 + 地图标记（备选）

struct PixelBrushMapLogoStyle: View {
    let size: CGFloat

    var body: some View {
        ZStack {
            // 背景圆
            Circle()
                .fill(
                    LinearGradient(
                        colors: [
                            Color(hex: "#4ECDC4")?.opacity(0.2) ?? .cyan.opacity(0.2),
                            Color(hex: "#FFE66D")?.opacity(0.2) ?? .yellow.opacity(0.2)
                        ],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )

            // 边框
            Circle()
                .strokeBorder(
                    LinearGradient(
                        colors: [
                            Color(hex: "#4ECDC4") ?? .cyan,
                            Color(hex: "#FFE66D") ?? .yellow
                        ],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    ),
                    lineWidth: size * 0.08
                )

            // 画笔 + 像素点组合
            Path { path in
                // 画笔手柄
                let handleWidth = size * 0.12
                let handleHeight = size * 0.35
                let centerX = size * 0.45
                let startY = size * 0.25

                path.addRoundedRect(
                    in: CGRect(
                        x: centerX - handleWidth * 0.5,
                        y: startY,
                        width: handleWidth,
                        height: handleHeight
                    ),
                    cornerSize: CGSize(width: 2, height: 2)
                )

                // 画笔笔头（像素块）
                let pixelSize = size * 0.15
                path.move(to: CGPoint(x: centerX - pixelSize * 0.5, y: startY + handleHeight))
                path.addLine(to: CGPoint(x: centerX + pixelSize * 0.5, y: startY + handleHeight))
                path.addLine(to: CGPoint(x: centerX + pixelSize * 0.5, y: startY + handleHeight + pixelSize))
                path.addLine(to: CGPoint(x: centerX - pixelSize * 0.5, y: startY + handleHeight + pixelSize))
                path.closeSubpath()
            }
            .fill(Color.white)

            // 3个小像素点（代表绘制轨迹）
            ForEach(0..<3, id: \.self) { index in
                let pixelSize: CGFloat = size * 0.08
                let baseX = size * 0.55
                let baseY = size * 0.45

                RoundedRectangle(cornerRadius: 1)
                    .fill(Color(hex: "#4ECDC4") ?? .cyan)
                    .frame(width: pixelSize, height: pixelSize)
                    .offset(
                        x: baseX + CGFloat(index) * pixelSize * 0.7,
                        y: baseY + CGFloat(index) * pixelSize * 0.7
                    )
                    .opacity(1.0 - Double(index) * 0.25)
            }
        }
    }
}

// MARK: - 其他SVG图标保持不变

struct PixelBrushIcon: View {
    var size: CGFloat = 20
    var color: Color = .white

    var body: some View {
        GeometryReader { geometry in
            let s = min(geometry.size.width, geometry.size.height)

            Path { path in
                // 笔刷手柄
                path.move(to: CGPoint(x: s * 0.425, y: s * 0.5))
                path.addLine(to: CGPoint(x: s * 0.425, y: s * 0.9))
                path.addLine(to: CGPoint(x: s * 0.575, y: s * 0.9))
                path.addLine(to: CGPoint(x: s * 0.575, y: s * 0.5))
                path.closeSubpath()

                // 笔头（像素块）
                let pixelSize = s * 0.35
                let pixelX = (s - pixelSize) / 2
                let pixelY = s * 0.1
                path.move(to: CGPoint(x: pixelX, y: pixelY))
                path.addLine(to: CGPoint(x: pixelX + pixelSize, y: pixelY))
                path.addLine(to: CGPoint(x: pixelX + pixelSize, y: pixelY + pixelSize))
                path.addLine(to: CGPoint(x: pixelX, y: pixelY + pixelSize))
                path.closeSubpath()
            }
            .fill(color)
        }
        .frame(width: size, height: size)
    }
}

struct GPSSignalIcon: View {
    var size: CGFloat = 20
    var isActive: Bool = true

    var body: some View {
        GeometryReader { geometry in
            let s = min(geometry.size.width, geometry.size.height)

            ZStack {
                // 中心点
                Circle()
                    .fill(isActive ? Color.green : Color.gray)
                    .frame(width: s * 0.2, height: s * 0.2)

                // 波纹圆环
                ForEach(1..<4) { index in
                    Circle()
                        .strokeBorder(
                            (isActive ? Color.green : Color.gray).opacity(0.6 - Double(index) * 0.15),
                            lineWidth: s * 0.06
                        )
                        .frame(
                            width: s * (0.35 + CGFloat(index) * 0.2),
                            height: s * (0.35 + CGFloat(index) * 0.2)
                        )
                }
            }
        }
        .frame(width: size, height: size)
    }
}

struct PixelGridIcon: View {
    var size: CGFloat = 20
    var color: Color = .white
    var animated: Bool = false

    @State private var highlightedPixel = 0

    var body: some View {
        GeometryReader { geometry in
            let s = min(geometry.size.width, geometry.size.height)
            let gridSize = 4
            let cellSize = s / CGFloat(gridSize)
            let gap = s * 0.05

            ZStack {
                ForEach(0..<gridSize, id: \.self) { row in
                    ForEach(0..<gridSize, id: \.self) { col in
                        let index = row * gridSize + col

                        RoundedRectangle(cornerRadius: 2)
                            .fill(animated && index == highlightedPixel ? Color.cyan : color.opacity(0.6))
                            .frame(
                                width: cellSize - gap,
                                height: cellSize - gap
                            )
                            .position(
                                x: CGFloat(col) * cellSize + cellSize / 2,
                                y: CGFloat(row) * cellSize + cellSize / 2
                            )
                    }
                }
            }
        }
        .frame(width: size, height: size)
        .onAppear {
            if animated {
                startAnimation()
            }
        }
    }

    private func startAnimation() {
        Timer.scheduledTimer(withTimeInterval: 0.3, repeats: true) { _ in
            withAnimation(.easeInOut(duration: 0.2)) {
                highlightedPixel = (highlightedPixel + 1) % 16
            }
        }
    }
}

struct DiamondPointsIcon: View {
    var size: CGFloat = 16
    var color: Color = .yellow

    var body: some View {
        GeometryReader { geometry in
            let s = min(geometry.size.width, geometry.size.height)

            Path { path in
                // 钻石形状
                path.move(to: CGPoint(x: s * 0.5, y: 0))
                path.addLine(to: CGPoint(x: s * 0.85, y: s * 0.35))
                path.addLine(to: CGPoint(x: s * 0.5, y: s))
                path.addLine(to: CGPoint(x: s * 0.15, y: s * 0.35))
                path.closeSubpath()

                // 内部高光
                path.move(to: CGPoint(x: s * 0.5, y: s * 0.15))
                path.addLine(to: CGPoint(x: s * 0.65, y: s * 0.35))
                path.addLine(to: CGPoint(x: s * 0.5, y: s * 0.5))
                path.addLine(to: CGPoint(x: s * 0.35, y: s * 0.35))
                path.closeSubpath()
            }
            .fill(
                LinearGradient(
                    colors: [color, color.opacity(0.6)],
                    startPoint: .top,
                    endPoint: .bottom
                )
            )
        }
        .frame(width: size, height: size)
    }
}

struct FreezeIcon: View {
    var size: CGFloat = 20
    var animated: Bool = true

    @State private var rotation: Double = 0

    var body: some View {
        GeometryReader { geometry in
            let s = min(geometry.size.width, geometry.size.height)

            ZStack {
                // 雪花结晶
                ForEach(0..<6) { index in
                    Path { path in
                        path.move(to: CGPoint(x: s * 0.5, y: s * 0.5))
                        path.addLine(to: CGPoint(x: s * 0.5, y: s * 0.15))

                        // 左分支
                        path.move(to: CGPoint(x: s * 0.5, y: s * 0.25))
                        path.addLine(to: CGPoint(x: s * 0.4, y: s * 0.3))

                        // 右分支
                        path.move(to: CGPoint(x: s * 0.5, y: s * 0.25))
                        path.addLine(to: CGPoint(x: s * 0.6, y: s * 0.3))
                    }
                    .stroke(Color.cyan, lineWidth: s * 0.08)
                    .rotationEffect(.degrees(Double(index) * 60 + rotation))
                }

                // 中心点
                Circle()
                    .fill(Color.cyan)
                    .frame(width: s * 0.15, height: s * 0.15)
            }
        }
        .frame(width: size, height: size)
        .onAppear {
            if animated {
                withAnimation(.linear(duration: 4).repeatForever(autoreverses: false)) {
                    rotation = 360
                }
            }
        }
    }
}

struct SpeedIcon: View {
    var size: CGFloat = 16
    var color: Color = .white

    var body: some View {
        GeometryReader { geometry in
            let s = min(geometry.size.width, geometry.size.height)

            ZStack {
                // 速度仪表盘
                Path { path in
                    path.addArc(
                        center: CGPoint(x: s * 0.5, y: s * 0.6),
                        radius: s * 0.4,
                        startAngle: .degrees(180),
                        endAngle: .degrees(0),
                        clockwise: false
                    )
                }
                .stroke(color.opacity(0.3), lineWidth: s * 0.08)

                // 活跃弧线
                Path { path in
                    path.addArc(
                        center: CGPoint(x: s * 0.5, y: s * 0.6),
                        radius: s * 0.4,
                        startAngle: .degrees(180),
                        endAngle: .degrees(270),
                        clockwise: false
                    )
                }
                .stroke(color, lineWidth: s * 0.08)

                // 指针
                Path { path in
                    path.move(to: CGPoint(x: s * 0.5, y: s * 0.6))
                    path.addLine(to: CGPoint(x: s * 0.7, y: s * 0.35))
                }
                .stroke(color, lineWidth: s * 0.06)
            }
        }
        .frame(width: size, height: size)
    }
}

// MARK: - Preview

#Preview("Logo Styles") {
    VStack(spacing: 40) {
        Text("Logo 样式选择")
            .font(.title2.bold())
            .foregroundColor(.white)

        VStack(spacing: 20) {
            VStack {
                FunnyPixelsLogoIcon(size: 80)
                Text("方案1: 地图定位标记")
                    .font(.caption)
                    .foregroundColor(.white.opacity(0.8))
                Text("(推荐使用)")
                    .font(.caption2.bold())
                    .foregroundColor(.green)
            }

            VStack {
                PixelLetterFLogoStyle(size: 80)
                Text("方案2: 像素字母 F")
                    .font(.caption)
                    .foregroundColor(.white.opacity(0.8))
            }

            VStack {
                PixelBrushMapLogoStyle(size: 80)
                Text("方案3: 画笔轨迹")
                    .font(.caption)
                    .foregroundColor(.white.opacity(0.8))
            }
        }

        Divider()
            .background(Color.white.opacity(0.3))

        HStack(spacing: 30) {
            VStack {
                PixelBrushIcon(size: 40)
                Text("画笔").font(.caption2)
            }
            VStack {
                GPSSignalIcon(size: 40, isActive: true)
                Text("GPS").font(.caption2)
            }
            VStack {
                PixelGridIcon(size: 40, animated: true)
                Text("网格").font(.caption2)
            }
        }
        .foregroundColor(.white)
    }
    .padding(40)
    .background(Color.black)
}
