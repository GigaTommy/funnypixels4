import SwiftUI
import Combine
import MapKit

/// 像素渲染视图 (用于LOD渲染)
public struct PixelRenderView: View {
    let pixel: Pixel
    let renderMode: RenderingMode

    public init(pixel: Pixel, renderMode: RenderingMode = .full) {
        self.pixel = pixel
        self.renderMode = renderMode
    }

    public var body: some View {
        Group {
            switch renderMode {
            case .full:
                fullRenderView
            case .simplified:
                simplifiedRenderView
            case .clustered(_):
                clusteredRenderView
            }
        }
        .shadow(color: .black.opacity(0.2), radius: 1, x: 0, y: 1)
    }

    // MARK: - Full Render (10x10)

    private var fullRenderView: some View {
        Rectangle()
            .fill(Color(hex: pixel.color) ?? .gray)
            .frame(width: 10, height: 10)
            .cornerRadius(2)
            .overlay(
                RoundedRectangle(cornerRadius: 2)
                    .strokeBorder(Color.white.opacity(0.3), lineWidth: 0.5)
            )
    }

    // MARK: - Simplified Render (6x6)

    private var simplifiedRenderView: some View {
        Circle()
            .fill(Color(hex: pixel.color) ?? .gray)
            .frame(width: 6, height: 6)
            .overlay(
                Circle()
                    .strokeBorder(Color.white.opacity(0.4), lineWidth: 0.5)
            )
    }

    // MARK: - Clustered Render (4x4)

    private var clusteredRenderView: some View {
        Circle()
            .fill(Color(hex: pixel.color) ?? .gray)
            .frame(width: 4, height: 4)
            .opacity(0.7)
    }
}

// MARK: - Pixel Renderer Manager

/// 像素渲染器管理器
public class PixelRendererManager: ObservableObject {
    @Published public var currentRenderMode: RenderingMode = .full

    public init() {}

    /// 根据地图缩放级别自动选择渲染模式
    /// - Parameter zoomLevel: 地图缩放级别
    /// - Returns: 推荐的渲染模式
    public func recommendedRenderMode(for zoomLevel: Double) -> RenderingMode {
        if zoomLevel > 15 {
            return .full
        } else if zoomLevel > 12 {
            return .simplified
        } else {
            return .clustered(gridSize: 0.01)
        }
    }

    /// 根据可见像素数量自动选择渲染模式
    /// - Parameter pixelCount: 可见像素数量
    /// - Returns: 推荐的渲染模式
    public func recommendedRenderMode(for pixelCount: Int) -> RenderingMode {
        if pixelCount < 100 {
            return .full
        } else if pixelCount < 500 {
            return .simplified
        } else {
            return .clustered(gridSize: 0.01)
        }
    }

    /// 更新渲染模式
    /// - Parameter mode: 新的渲染模式
    public func updateRenderMode(_ mode: RenderingMode) {
        DispatchQueue.main.async {
            self.currentRenderMode = mode
        }
    }
}

// MARK: - Preview

#if DEBUG
struct PixelRenderView_Previews: PreviewProvider {
    static var previews: some View {
        VStack(spacing: 20) {
            HStack(spacing: 20) {
                VStack {
                    PixelRenderView(
                        pixel: Pixel(
                            latitude: 0,
                            longitude: 0,
                            color: "#FF6B6B",
                            authorId: "test"
                        ),
                        renderMode: .full
                    )
                    Text("Full (10x10)")
                        .font(.caption)
                }

                VStack {
                    PixelRenderView(
                        pixel: Pixel(
                            latitude: 0,
                            longitude: 0,
                            color: "#4ECDC4",
                            authorId: "test"
                        ),
                        renderMode: .simplified
                    )
                    Text("Simplified (6x6)")
                        .font(.caption)
                }

                VStack {
                    PixelRenderView(
                        pixel: Pixel(
                            latitude: 0,
                            longitude: 0,
                            color: "#FFE66D",
                            authorId: "test"
                        ),
                        renderMode: .clustered(gridSize: 0.01)
                    )
                    Text("Clustered (4x4)")
                        .font(.caption)
                }
            }

            Divider()

            // 颜色测试
            VStack(spacing: 10) {
                Text("Color Palette")
                    .font(.headline)

                LazyVGrid(columns: Array(repeating: GridItem(.fixed(30)), count: 5), spacing: 10) {
                    ForEach(PixelColors.defaultColors, id: \.self) { colorHex in
                        PixelRenderView(
                            pixel: Pixel(
                                latitude: 0,
                                longitude: 0,
                                color: colorHex,
                                authorId: "test"
                            ),
                            renderMode: .full
                        )
                    }
                }
            }
        }
        .padding()
        .previewLayout(.sizeThatFits)
    }
}
#endif
