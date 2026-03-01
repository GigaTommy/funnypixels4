import SwiftUI

/// 漂流瓶SVG图标
/// 自定义绘制的漂流瓶图标，避免使用emoji
struct BottleSVGIcon: View {
    var size: CGFloat = 32
    var color: Color = .cyan
    var isInRange: Bool = false  // 是否在拾取范围内

    var body: some View {
        ZStack {
            // 外发光效果（范围内时）
            if isInRange {
                Circle()
                    .fill(color.opacity(0.3))
                    .frame(width: size * 1.5, height: size * 1.5)
                    .blur(radius: 8)
            }

            // 漂流瓶主体
            bottleShape
                .fill(color)
                .frame(width: size, height: size)
                .shadow(color: .black.opacity(0.3), radius: 2, x: 0, y: 2)

            // 高光效果
            bottleHighlight
                .fill(
                    LinearGradient(
                        gradient: Gradient(colors: [.white.opacity(0.6), .clear]),
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                .frame(width: size * 0.8, height: size * 0.8)
                .offset(x: -size * 0.1, y: -size * 0.1)
        }
    }

    // MARK: - 漂流瓶形状

    private var bottleShape: some Shape {
        BottleShape()
    }

    private var bottleHighlight: some Shape {
        BottleHighlightShape()
    }
}

// MARK: - Custom Shapes

/// 漂流瓶主体形状
struct BottleShape: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        let width = rect.width
        let height = rect.height

        // 瓶口
        let neckHeight = height * 0.2
        path.move(to: CGPoint(x: width * 0.35, y: 0))
        path.addLine(to: CGPoint(x: width * 0.65, y: 0))
        path.addLine(to: CGPoint(x: width * 0.65, y: neckHeight))

        // 瓶肩（右侧）
        path.addQuadCurve(
            to: CGPoint(x: width * 0.85, y: height * 0.35),
            control: CGPoint(x: width * 0.75, y: neckHeight)
        )

        // 瓶身（右侧）
        path.addLine(to: CGPoint(x: width * 0.85, y: height * 0.85))

        // 瓶底（右侧圆角）
        path.addQuadCurve(
            to: CGPoint(x: width * 0.7, y: height),
            control: CGPoint(x: width * 0.85, y: height)
        )

        // 瓶底（中心）
        path.addLine(to: CGPoint(x: width * 0.3, y: height))

        // 瓶底（左侧圆角）
        path.addQuadCurve(
            to: CGPoint(x: width * 0.15, y: height * 0.85),
            control: CGPoint(x: width * 0.15, y: height)
        )

        // 瓶身（左侧）
        path.addLine(to: CGPoint(x: width * 0.15, y: height * 0.35))

        // 瓶肩（左侧）
        path.addQuadCurve(
            to: CGPoint(x: width * 0.35, y: neckHeight),
            control: CGPoint(x: width * 0.25, y: neckHeight)
        )

        path.closeSubpath()

        return path
    }
}

/// 漂流瓶高光形状
struct BottleHighlightShape: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        let width = rect.width
        let height = rect.height

        // 左侧高光
        path.move(to: CGPoint(x: width * 0.25, y: height * 0.3))
        path.addQuadCurve(
            to: CGPoint(x: width * 0.3, y: height * 0.6),
            control: CGPoint(x: width * 0.2, y: height * 0.45)
        )
        path.addLine(to: CGPoint(x: width * 0.25, y: height * 0.6))
        path.addQuadCurve(
            to: CGPoint(x: width * 0.2, y: height * 0.3),
            control: CGPoint(x: width * 0.15, y: height * 0.45)
        )
        path.closeSubpath()

        return path
    }
}

// MARK: - 预览

struct BottleSVGIcon_Previews: PreviewProvider {
    static var previews: some View {
        VStack(spacing: 30) {
            // 不同大小
            HStack(spacing: 20) {
                BottleSVGIcon(size: 24)
                BottleSVGIcon(size: 32)
                BottleSVGIcon(size: 48)
                BottleSVGIcon(size: 64)
            }

            // 不同颜色
            HStack(spacing: 20) {
                BottleSVGIcon(size: 48, color: .cyan)
                BottleSVGIcon(size: 48, color: .blue)
                BottleSVGIcon(size: 48, color: .green)
                BottleSVGIcon(size: 48, color: .orange)
            }

            // 范围内外对比
            HStack(spacing: 40) {
                VStack {
                    BottleSVGIcon(size: 48, isInRange: false)
                    Text("范围外")
                        .font(.caption)
                }

                VStack {
                    BottleSVGIcon(size: 48, isInRange: true)
                    Text("范围内")
                        .font(.caption)
                }
            }
        }
        .padding()
        .background(Color.gray.opacity(0.1))
    }
}
