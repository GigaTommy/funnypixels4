import Combine
import SwiftUI

/// A clean, professional background with a frosted glass effect.
/// Inspired by Google Maps' minimalist aesthetic.
struct FrostedMapBackground: View, Equatable {
    @ObservedObject private var fontManager = FontSizeManager.shared
    static func == (lhs: FrostedMapBackground, rhs: FrostedMapBackground) -> Bool {
        return true
    }

    var body: some View {
        ZStack {
            // Light Background Base
            Color(hex: "F8F9FA")
                .ignoresSafeArea()
            
            // Abstract Map-like organic shapes
            GeometryReader { geometry in
                ZStack {
                    Circle()
                        .fill(Color.blue.opacity(0.05))
                        .frame(width: 400, height: 400)
                        .offset(x: -100, y: -100)
                    
                    Circle()
                        .fill(Color.green.opacity(0.03))
                        .frame(width: 300, height: 300)
                        .offset(x: geometry.size.width - 150, y: 100)
                    
                    Circle()
                        .fill(Color.yellow.opacity(0.02))
                        .frame(width: 250, height: 250)
                        .offset(x: 50, y: geometry.size.height - 200)
                }
                .blur(radius: 60)
                .drawingGroup() // Offload to GPU
            }
            .allowsHitTesting(false) // Optimize hit testing
            
            // The Frost
            Rectangle()
                .fill(.ultraThinMaterial)
                .ignoresSafeArea()
                .allowsHitTesting(false)

            // 移除 Canvas 点阵渲染以优化性能 (原先渲染 ~4000 个点)
        }
    }
}
