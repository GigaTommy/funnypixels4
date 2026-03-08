import SwiftUI

#if canImport(RiveRuntime)
import RiveRuntime
#endif

/// 像素放置动画视图
/// 使用Rive动画展示像素掉落、落地、涟漪效果
struct PixelDropAnimationView: View {
    let pixelColor: Color
    let position: CGPoint
    let onComplete: () -> Void

    @State private var showAnimation = false
    @State private var riveViewModel: Any?
    @StateObject private var animationManager = RiveAnimationManager.shared

    var body: some View {
        ZStack {
            if animationManager.isRiveAvailable {
                // Rive动画（当SDK可用时）
                riveAnimationView
            } else {
                // 临时占位动画（SwiftUI原生）
                fallbackAnimationView
            }
        }
        .position(position)
        .task {
            await loadAnimation()
        }
    }

    // MARK: - Rive Animation View

    @ViewBuilder
    private var riveAnimationView: some View {
        #if canImport(RiveRuntime)
        if let viewModel = riveViewModel as? RiveViewModel {
            RiveView(viewModel: viewModel)
                .frame(width: 120, height: 120)
                .opacity(showAnimation ? 1 : 0)
                .onAppear {
                    configureRiveAnimation(viewModel)
                }
        } else {
            fallbackAnimationView
        }
        #else
        fallbackAnimationView
        #endif
    }

    // MARK: - Fallback Animation (SwiftUI)

    private var fallbackAnimationView: some View {
        PixelDropFallbackView(
            pixelColor: pixelColor,
            onComplete: onComplete
        )
        .opacity(showAnimation ? 1 : 0)
    }

    // MARK: - Animation Configuration

    private func loadAnimation() async {
        showAnimation = true

        #if canImport(RiveRuntime)
        // 加载Rive动画
        riveViewModel = await animationManager.getViewModel(for: .pixelDrop)
        #else
        // 使用fallback
        #endif
    }

    #if canImport(RiveRuntime)
    private func configureRiveAnimation(_ viewModel: RiveViewModel) {
        // 设置像素颜色（如果Rive文件支持）
        let rgb = pixelColor.toRGB()
        viewModel.setInputState("pixelColor", value: rgb)

        // 触发drop动画
        viewModel.triggerInput("drop")

        // 监听动画完成事件
        // 注意：实际实现需要根据Rive文件的事件名称调整
        Task {
            // 假设动画时长0.6s
            try? await Task.sleep(nanoseconds: 600_000_000)
            onComplete()
        }
    }
    #endif
}

// MARK: - Fallback Animation (SwiftUI Native)

/// 临时占位动画 - 使用SwiftUI原生实现
/// 等待Rive文件准备好后可删除
private struct PixelDropFallbackView: View {
    let pixelColor: Color
    let onComplete: () -> Void

    @State private var offset: CGFloat = 0
    @State private var scale: CGFloat = 1.0
    @State private var showRipple = false
    @State private var rippleScale: CGFloat = 0.5
    @State private var rippleOpacity: Double = 0.8

    var body: some View {
        ZStack {
            // 涟漪效果
            if showRipple {
                ForEach(0..<3, id: \.self) { index in
                    Circle()
                        .stroke(pixelColor.opacity(0.3), lineWidth: 2)
                        .frame(width: 30, height: 30)
                        .scaleEffect(rippleScale + CGFloat(index) * 0.2)
                        .opacity(rippleOpacity - Double(index) * 0.2)
                }
            }

            // 像素方块
            RoundedRectangle(cornerRadius: 6, style: .continuous)
                .fill(pixelColor)
                .frame(width: 30, height: 30)
                .scaleEffect(scale)
                .offset(y: offset)
                .shadow(color: pixelColor.opacity(0.5), radius: 8, x: 0, y: 4)
        }
        .frame(width: 120, height: 120)
        .onAppear {
            playAnimation()
        }
    }

    private func playAnimation() {
        // 阶段1: Anticipation (0-0.1s)
        withAnimation(.easeOut(duration: 0.1)) {
            offset = -20
            scale = 1.1
        }

        // 阶段2: Drop (0.1-0.3s)
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
            withAnimation(.easeIn(duration: 0.2)) {
                offset = 30
                scale = 1.4
            }
        }

        // 阶段3: Impact (0.3-0.35s)
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
            withAnimation(.spring(response: 0.3, dampingFraction: 0.6)) {
                offset = 40
                scale = 0.7
                showRipple = true
            }

            // 触觉和音效反馈
            HapticManager.shared.notification(type: .success)
            SoundManager.shared.playPixelDraw()

            // 涟漪扩散
            withAnimation(.easeOut(duration: 0.4)) {
                rippleScale = 2.0
                rippleOpacity = 0.0
            }
        }

        // 阶段4: Settle (0.35-0.6s)
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) {
            withAnimation(.spring(response: 0.25, dampingFraction: 0.7)) {
                offset = 40
                scale = 1.0
            }
        }

        // 动画完成
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.6) {
            onComplete()
        }
    }
}

// MARK: - Color Extension

extension Color {
    /// 转换为RGB数组（供Rive使用）
    func toRGB() -> [Float] {
        #if canImport(UIKit)
        let uiColor = UIColor(self)
        var red: CGFloat = 0
        var green: CGFloat = 0
        var blue: CGFloat = 0
        var alpha: CGFloat = 0

        uiColor.getRed(&red, green: &green, blue: &blue, alpha: &alpha)
        return [Float(red), Float(green), Float(blue), Float(alpha)]
        #else
        return [1.0, 1.0, 1.0, 1.0]
        #endif
    }
}

// MARK: - Preview

#Preview("Pixel Drop - Blue") {
    ZStack {
        Color.black.opacity(0.3)
            .ignoresSafeArea()

        PixelDropAnimationView(
            pixelColor: .blue,
            position: CGPoint(x: 200, y: 400),
            onComplete: {
                print("Animation completed")
            }
        )
    }
}

#Preview("Pixel Drop - Red") {
    ZStack {
        Color.gray.opacity(0.2)
            .ignoresSafeArea()

        PixelDropAnimationView(
            pixelColor: .red,
            position: CGPoint(x: 200, y: 300),
            onComplete: {
                print("Animation completed")
            }
        )
    }
}
