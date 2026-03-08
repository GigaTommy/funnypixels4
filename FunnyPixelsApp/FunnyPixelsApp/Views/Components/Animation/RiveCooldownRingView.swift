import SwiftUI

#if canImport(RiveRuntime)
import RiveRuntime
#endif

/// Rive冷却环动画视图
/// 显示像素放置的冷却倒计时，填充进度0% → 100%
/// 注意：这是Rive动画版本，与现有的CooldownRingView（显示像素点数）不同
struct RiveCooldownRingView: View {
    @Binding var remainingSeconds: Int
    let totalSeconds: Int
    let onReady: () -> Void

    @State private var riveViewModel: Any?
    @State private var lastProgress: Float = 0
    @StateObject private var animationManager = RiveAnimationManager.shared

    private var progress: Float {
        guard totalSeconds > 0 else { return 1.0 }
        let remaining = Float(remainingSeconds)
        let total = Float(totalSeconds)
        return max(0, min(1, 1.0 - (remaining / total)))
    }

    private var isReady: Bool {
        remainingSeconds <= 0
    }

    var body: some View {
        ZStack {
            if animationManager.isRiveAvailable {
                // Rive动画
                riveAnimationView
            } else {
                // 临时占位动画
                fallbackAnimationView
            }
        }
        .frame(width: 80, height: 80)
        .onChange(of: progress) { oldValue, newValue in
            updateAnimation()
        }
        .onChange(of: isReady) { oldValue, newValue in
            if newValue && !oldValue {
                onReadyTriggered()
            }
        }
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
                .frame(width: 80, height: 80)
        } else {
            fallbackAnimationView
        }
        #else
        fallbackAnimationView
        #endif
    }

    // MARK: - Fallback Animation (SwiftUI)

    private var fallbackAnimationView: some View {
        CooldownRingFallbackView(
            progress: progress,
            remainingSeconds: remainingSeconds,
            isReady: isReady
        )
    }

    // MARK: - Animation Control

    private func loadAnimation() async {
        #if canImport(RiveRuntime)
        riveViewModel = await animationManager.getViewModel(for: .cooldownRing)
        if let viewModel = riveViewModel as? RiveViewModel {
            configureRiveAnimation(viewModel)
        }
        #endif
    }

    private func updateAnimation() {
        #if canImport(RiveRuntime)
        guard let viewModel = riveViewModel as? RiveViewModel else { return }

        // 更新进度
        viewModel.setInputState("progress", value: progress)
        viewModel.setInputState("isReady", value: isReady)

        lastProgress = progress
        #endif
    }

    private func onReadyTriggered() {
        // 触觉反馈
        HapticManager.shared.notification(type: .success)

        // 触发ready动画
        #if canImport(RiveRuntime)
        if let viewModel = riveViewModel as? RiveViewModel {
            viewModel.triggerInput("readyPulse")
        }
        #endif

        onReady()
    }

    #if canImport(RiveRuntime)
    private func configureRiveAnimation(_ viewModel: RiveViewModel) {
        // 初始化状态
        viewModel.setInputState("progress", value: progress)
        viewModel.setInputState("isReady", value: isReady)
    }
    #endif
}

// MARK: - Fallback Animation (SwiftUI Native)

/// 临时占位动画 - 使用SwiftUI原生实现
private struct CooldownRingFallbackView: View {
    let progress: Float
    let remainingSeconds: Int
    let isReady: Bool

    @State private var pulseScale: CGFloat = 1.0

    var body: some View {
        ZStack {
            // 底层灰色圆环
            Circle()
                .stroke(Color.gray.opacity(0.2), lineWidth: 6)
                .frame(width: 60, height: 60)

            // 进度圆环
            Circle()
                .trim(from: 0, to: CGFloat(progress))
                .stroke(
                    isReady ? Color.green : Color.blue,
                    style: StrokeStyle(lineWidth: 6, lineCap: .round)
                )
                .frame(width: 60, height: 60)
                .rotationEffect(.degrees(-90)) // 从顶部开始
                .animation(.linear(duration: 0.1), value: progress)

            // 外发光（ready状态）
            if isReady {
                Circle()
                    .stroke(Color.green.opacity(0.3), lineWidth: 8)
                    .frame(width: 70, height: 70)
                    .scaleEffect(pulseScale)
                    .opacity(2.0 - Double(pulseScale))
            }

            // 中心内容
            centerContent
        }
        .onChange(of: isReady) { oldValue, newValue in
            if newValue {
                startPulseAnimation()
            }
        }
    }

    @ViewBuilder
    private var centerContent: some View {
        if isReady {
            // Ready状态 - 显示+图标
            Image(systemName: "plus.circle.fill")
                .font(.system(size: 28))
                .foregroundColor(.green)
                .symbolEffect(.bounce, value: isReady)
        } else {
            // 冷却中 - 显示剩余秒数
            Text("\(remainingSeconds)")
                .font(.system(size: 20, weight: .bold, design: .rounded))
                .foregroundColor(.white)
                .shadow(color: .black.opacity(0.3), radius: 2, x: 0, y: 1)
        }
    }

    private func startPulseAnimation() {
        withAnimation(
            .easeInOut(duration: 1.5)
            .repeatForever(autoreverses: true)
        ) {
            pulseScale = 1.3
        }
    }
}

// MARK: - Preview

#Preview("Cooldown - Active") {
    @Previewable @State var remaining = 15

    ZStack {
        Color.black.opacity(0.3)
            .ignoresSafeArea()

        VStack(spacing: 40) {
            RiveCooldownRingView(
                remainingSeconds: $remaining,
                totalSeconds: 30,
                onReady: {
                    print("Ready to draw!")
                }
            )

            // 测试控制按钮
            HStack {
                Button("Reset") {
                    remaining = 30
                }
                Button("-5s") {
                    remaining = max(0, remaining - 5)
                }
                Button("Ready") {
                    remaining = 0
                }
            }
            .buttonStyle(.borderedProminent)
        }
    }
    .onAppear {
        // 模拟倒计时
        Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { timer in
            if remaining > 0 {
                remaining -= 1
            }
        }
    }
}

#Preview("Cooldown - Ready") {
    @Previewable @State var remaining = 0

    ZStack {
        Color.gray.opacity(0.2)
            .ignoresSafeArea()

        RiveCooldownRingView(
            remainingSeconds: $remaining,
            totalSeconds: 30,
            onReady: {
                print("Ready!")
            }
        )
    }
}
