import SwiftUI

/// 路径艺术作品视图 - 纯路径渲染，带时间段渐变色
struct PathArtworkView: View {
    let pixels: [SessionPixel]
    let sessionTime: Date
    let showPixelDots: Bool
    let drawingType: String
    
    init(
        pixels: [SessionPixel],
        sessionTime: Date,
        drawingType: String = "gps",
        showPixelDots: Bool = false
    ) {
        self.pixels = pixels
        self.sessionTime = sessionTime
        self.drawingType = drawingType
        self.showPixelDots = showPixelDots
    }
    
    var body: some View {
        GeometryReader { geometry in
            ZStack {
                // 氛围背景渐变
                atmosphericBackground
                
                if !pixels.isEmpty {
                    Canvas { context, size in
                        drawPath(in: context, size: size)
                    }
                } else {
                    // Empty state
                    VStack(spacing: 8) {
                        Image(systemName: "scribble")
                            .font(.system(size: 24))
                            .foregroundColor(.secondary.opacity(0.5))
                        Text("No path data")
                            .font(.caption2)
                            .foregroundColor(.secondary.opacity(0.5))
                    }
                }
            }
        }
        .aspectRatio(4/3, contentMode: .fit)
    }
    
    // MARK: - Atmospheric Background
    
    private var atmosphericBackground: some View {
        LinearGradient(
            colors: pathGradientColors.map { $0.opacity(0.08) },
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
    }
    
    // MARK: - Path Drawing
    
    private func drawPath(in context: GraphicsContext, size: CGSize) {
        guard pixels.count > 1 else { return }
        
        // Calculate bounds
        let coordinates = pixels.map { ($0.latitude, $0.longitude) }
        let bounds = calculateBounds(from: coordinates)
        
        // Normalize coordinates to canvas
        let normalizedPoints = coordinates.map { coord in
            normalizePoint(
                lat: coord.0,
                lon: coord.1,
                bounds: bounds,
                canvasSize: size
            )
        }
        
        // Draw path with gradient
        var path = Path()
        if let first = normalizedPoints.first {
            path.move(to: first)
            for point in normalizedPoints.dropFirst() {
                path.addLine(to: point)
            }
        }
        
        // Create gradient shader
        let gradient = Gradient(colors: pathGradientColors)
        let startPoint = normalizedPoints.first ?? .zero
        let endPoint = normalizedPoints.last ?? CGPoint(x: size.width, y: size.height)
        
        context.stroke(
            path,
            with: .linearGradient(
                gradient,
                startPoint: startPoint,
                endPoint: endPoint
            ),
            style: StrokeStyle(lineWidth: 3.5, lineCap: .round, lineJoin: .round)
        )
        
        // Draw pixel dots if enabled
        if showPixelDots {
            for point in normalizedPoints {
                let dotPath = Path(ellipseIn: CGRect(
                    x: point.x - 2.5,
                    y: point.y - 2.5,
                    width: 5,
                    height: 5
                ))
                context.fill(dotPath, with: .color(pathGradientColors.last?.opacity(0.8) ?? .blue))
            }
        }
    }
    
    // MARK: - Time-based Gradient Colors
    
    private var pathGradientColors: [Color] {
        let hour = Calendar.current.component(.hour, from: sessionTime)

        if drawingType == "manual" {
            // 手动绘制：暖色系（Apple HIG 风格）
            switch hour {
            case 5..<9:   // 日出金橙
                return [.orange, Color(red: 1.0, green: 0.6, blue: 0.35)]
            case 9..<17:  // 白天青绿
                return [.teal, Color(red: 0.2, green: 0.78, blue: 0.35)]
            case 17..<20: // 傍晚暖霞
                return [Color(red: 1.0, green: 0.58, blue: 0.0), .pink]
            default:      // 夜晚靛蓝
                return [.indigo, Color(red: 0.35, green: 0.34, blue: 0.84)]
            }
        } else {
            // GPS 绘制：冷色系（Apple HIG 风格）
            switch hour {
            case 5..<9:   // 日出暖金
                return [Color(red: 1.0, green: 0.8, blue: 0.0), .orange]
            case 9..<17:  // 白天天空蓝
                return [.blue, .cyan]
            case 17..<20: // 傍晚晚霞
                return [.orange, Color(red: 0.85, green: 0.35, blue: 0.35)]
            default:      // 夜晚深蓝
                return [Color(red: 0.25, green: 0.3, blue: 0.7), .indigo]
            }
        }
    }
    
    // MARK: - Coordinate Calculations
    
    private struct Bounds {
        let minLat: Double
        let maxLat: Double
        let minLon: Double
        let maxLon: Double
    }
    
    private func calculateBounds(from coordinates: [(Double, Double)]) -> Bounds {
        let lats = coordinates.map { $0.0 }
        let lons = coordinates.map { $0.1 }
        
        return Bounds(
            minLat: lats.min() ?? 0,
            maxLat: lats.max() ?? 0,
            minLon: lons.min() ?? 0,
            maxLon: lons.max() ?? 0
        )
    }
    
    private func normalizePoint(
        lat: Double,
        lon: Double,
        bounds: Bounds,
        canvasSize: CGSize
    ) -> CGPoint {
        let padding: CGFloat = 20
        let availableWidth = canvasSize.width - (padding * 2)
        let availableHeight = canvasSize.height - (padding * 2)
        
        let latRange = bounds.maxLat - bounds.minLat
        let lonRange = bounds.maxLon - bounds.minLon
        
        // Prevent division by zero
        let safeLatRange = max(latRange, 0.0001)
        let safeLonRange = max(lonRange, 0.0001)
        
        // Normalize to 0-1
        let normalizedLat = (lat - bounds.minLat) / safeLatRange
        let normalizedLon = (lon - bounds.minLon) / safeLonRange
        
        // Scale to canvas (flip Y axis for correct orientation)
        let x = padding + (normalizedLon * availableWidth)
        let y = padding + ((1 - normalizedLat) * availableHeight)
        
        return CGPoint(x: x, y: y)
    }
}

// MARK: - Preview

#Preview {
    VStack(spacing: 20) {
        PathArtworkView(
            pixels: [
                SessionPixel(id: "1", gridId: "g1", latitude: 39.9, longitude: 116.4, color: nil, patternId: nil, createdAt: Date()),
                SessionPixel(id: "2", gridId: "g2", latitude: 39.91, longitude: 116.41, color: nil, patternId: nil, createdAt: Date()),
                SessionPixel(id: "3", gridId: "g3", latitude: 39.92, longitude: 116.42, color: nil, patternId: nil, createdAt: Date()),
                SessionPixel(id: "4", gridId: "g4", latitude: 39.93, longitude: 116.43, color: nil, patternId: nil, createdAt: Date())
            ],
            sessionTime: Date(),
            showPixelDots: true
        )
        .frame(height: 200)
        .padding()
    }
}
