import SwiftUI

#if canImport(RiveRuntime)
import RiveRuntime
#endif

/// 成就解锁动画视图
/// 展示多阶段的成就解锁庆祝动画
struct AchievementUnlockView: View {
    let achievement: AchievementData
    @Binding var isPresented: Bool

    @State private var riveViewModel: Any?
    @State private var showContent = false
    @StateObject private var animationManager = RiveAnimationManager.shared
    @ObservedObject private var fontManager = FontSizeManager.shared

    var body: some View {
        ZStack {
            // 半透明背景
            Color.black.opacity(0.7)
                .ignoresSafeArea()
                .onTapGesture {
                    dismiss()
                }

            // 动画内容
            if animationManager.isRiveAvailable {
                riveAnimationView
            } else {
                fallbackAnimationView
            }

            // 成就信息（叠加层）
            if showContent {
                achievementInfo
                    .transition(.scale.combined(with: .opacity))
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
                .frame(height: 400)
        } else {
            fallbackAnimationView
        }
        #else
        fallbackAnimationView
        #endif
    }

    // MARK: - Fallback Animation

    private var fallbackAnimationView: some View {
        AchievementUnlockFallbackView(
            achievement: achievement,
            showContent: $showContent
        )
    }

    // MARK: - Achievement Info Overlay

    private var achievementInfo: some View {
        VStack(spacing: 24) {
            Spacer()
                .frame(height: 200) // 为动画留空间

            VStack(spacing: 12) {
                // 成就标题
                Text(achievement.title)
                    .responsiveFont(.title2, weight: .bold)
                    .foregroundColor(.white)
                    .multilineTextAlignment(.center)

                // 成就描述
                Text(achievement.description)
                    .responsiveFont(.body)
                    .foregroundColor(.white.opacity(0.8))
                    .multilineTextAlignment(.center)
                    .lineLimit(3)

                // 奖励信息
                rewardInfo
            }
            .padding(.horizontal, 32)

            Spacer()

            // 关闭按钮
            Button {
                dismiss()
            } label: {
                Text(NSLocalizedString("achievement.unlock.dismiss", value: "Awesome!", comment: ""))
                    .responsiveFont(.headline, weight: .semibold)
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 16)
                    .background(
                        Capsule()
                            .fill(achievement.rarity.color)
                    )
                    .shadow(color: achievement.rarity.color.opacity(0.4), radius: 8, x: 0, y: 4)
            }
            .buttonStyle(FluidButtonStyle())
            .padding(.horizontal, 32)
            .padding(.bottom, 40)
        }
    }

    @ViewBuilder
    private var rewardInfo: some View {
        HStack(spacing: 16) {
            // XP奖励
            if achievement.xpReward > 0 {
                Label("\(achievement.xpReward) XP", systemImage: "star.fill")
                    .responsiveFont(.subheadline, weight: .semibold)
                    .foregroundColor(.yellow)
            }

            // 金币奖励（如果有）
            if let coins = achievement.coinReward, coins > 0 {
                Label("\(coins)", systemImage: "dollarsign.circle.fill")
                    .responsiveFont(.subheadline, weight: .semibold)
                    .foregroundColor(.yellow)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
        .background(
            Capsule()
                .fill(Color.black.opacity(0.3))
        )
    }

    // MARK: - Animation Control

    private func loadAnimation() async {
        #if canImport(RiveRuntime)
        riveViewModel = await animationManager.getViewModel(for: .achievementUnlock)
        if let viewModel = riveViewModel as? RiveViewModel {
            configureRiveAnimation(viewModel)
        }
        #else
        // 使用fallback
        #endif

        // 延迟显示内容（等待intro动画）
        try? await Task.sleep(nanoseconds: 500_000_000) // 0.5s
        withAnimation(.spring(response: 0.4, dampingFraction: 0.7)) {
            showContent = true
        }
    }

    #if canImport(RiveRuntime)
    private func configureRiveAnimation(_ viewModel: RiveViewModel) {
        // 设置成就稀有度（影响颜色和特效强度）
        viewModel.setInputState("achievementRarity", value: achievement.rarity.rawValue)

        // 触发解锁动画
        viewModel.triggerInput("triggerUnlock")

        // 音效和震动
        SoundManager.shared.playSuccess()
        HapticManager.shared.notification(type: .success)
    }
    #endif

    private func dismiss() {
        #if canImport(RiveRuntime)
        if let viewModel = riveViewModel as? RiveViewModel {
            viewModel.triggerInput("triggerOutro")
        }
        #endif

        // 等待outro动画
        withAnimation(.easeOut(duration: 0.3)) {
            showContent = false
        }

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            isPresented = false
        }
    }
}

// MARK: - Fallback Animation (SwiftUI Native)

/// 临时占位动画 - 基于现有FirstPixelCelebration改进
private struct AchievementUnlockFallbackView: View {
    let achievement: AchievementData
    @Binding var showContent: Bool

    @State private var particles: [AchievementParticle] = []
    @State private var chestScale: CGFloat = 0.1
    @State private var chestRotation: Double = -10

    var body: some View {
        ZStack {
            // 粒子效果
            ForEach(particles) { particle in
                Circle()
                    .fill(particle.color)
                    .frame(width: particle.size, height: particle.size)
                    .position(particle.position)
                    .opacity(particle.opacity)
            }

            // 宝箱/奖杯图标
            VStack {
                Spacer()
                    .frame(height: 100)

                ZStack {
                    // 背景光晕
                    Circle()
                        .fill(
                            RadialGradient(
                                colors: [achievement.rarity.color.opacity(0.3), .clear],
                                center: .center,
                                startRadius: 0,
                                endRadius: 100
                            )
                        )
                        .frame(width: 200, height: 200)

                    // 成就图标
                    Image(systemName: "trophy.fill")
                        .font(.system(size: 80))
                        .foregroundColor(achievement.rarity.color)
                        .shadow(color: achievement.rarity.color.opacity(0.5), radius: 20, x: 0, y: 10)
                }
                .scaleEffect(chestScale)
                .rotationEffect(.degrees(chestRotation))

                Spacer()
            }
        }
        .onAppear {
            playAnimation()
        }
    }

    private func playAnimation() {
        // 阶段1: Intro - 宝箱入场
        withAnimation(.spring(response: 0.5, dampingFraction: 0.6)) {
            chestScale = 1.0
            chestRotation = 0
        }

        // 阶段2: Unlock - 粒子爆发
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            generateParticles()
            SoundManager.shared.playSuccess()
            HapticManager.shared.notification(type: .success)

            withAnimation(.spring(response: 0.4, dampingFraction: 0.7)) {
                chestScale = 1.2
            }
        }

        // 阶段3: Display - 稳定显示
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
            withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) {
                chestScale = 1.0
                showContent = true
            }
        }
    }

    private func generateParticles() {
        let center = CGPoint(x: UIScreen.main.bounds.width / 2, y: 200)
        let particleCount = achievement.rarity == .legendary ? 50 : 30

        for i in 0..<particleCount {
            let angle = (Double(i) / Double(particleCount)) * 360
            let distance = CGFloat.random(in: 50...150)
            let x = center.x + cos(angle * .pi / 180) * distance
            let y = center.y + sin(angle * .pi / 180) * distance

            let particle = AchievementParticle(
                color: achievement.rarity.color,
                position: CGPoint(x: x, y: y),
                size: CGFloat.random(in: 4...8),
                opacity: 0.8
            )
            particles.append(particle)
        }

        // 粒子逐渐消失
        withAnimation(.easeOut(duration: 1.0)) {
            particles = particles.map { particle in
                var p = particle
                p.opacity = 0
                return p
            }
        }
    }
}

// MARK: - Supporting Types

/// 成就数据结构（简化版）
struct AchievementData {
    let id: String
    let title: String
    let description: String
    let rarity: AchievementRarity
    let xpReward: Int
    let coinReward: Int?
    let iconName: String

    static let preview = AchievementData(
        id: "first_pixel",
        title: NSLocalizedString("achievement.first_pixel.title", value: "First Pixel!", comment: ""),
        description: NSLocalizedString("achievement.first_pixel.description", value: "You've drawn your first pixel on the global canvas", comment: ""),
        rarity: .common,
        xpReward: 100,
        coinReward: 10,
        iconName: "star.fill"
    )
}

/// 成就稀有度
enum AchievementRarity: String {
    case common
    case rare
    case epic
    case legendary

    var color: Color {
        switch self {
        case .common: return .blue
        case .rare: return .purple
        case .epic: return .orange
        case .legendary: return .yellow
        }
    }
}

/// 成就粒子数据（避免与FirstPixelCelebration的ConfettiParticle冲突）
private struct AchievementParticle: Identifiable {
    let id = UUID()
    var color: Color
    var position: CGPoint
    var size: CGFloat
    var opacity: Double
}

// MARK: - Button Style

private struct FluidButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.97 : 1.0)
            .opacity(configuration.isPressed ? 0.9 : 1.0)
            .animation(.spring(response: 0.3, dampingFraction: 0.7), value: configuration.isPressed)
    }
}

// MARK: - Preview

#Preview("Achievement - Common") {
    @Previewable @State var isPresented = true

    ZStack {
        Color.gray
            .ignoresSafeArea()

        if isPresented {
            AchievementUnlockView(
                achievement: .preview,
                isPresented: $isPresented
            )
        }
    }
}

#Preview("Achievement - Legendary") {
    @Previewable @State var isPresented = true

    let legendary = AchievementData(
        id: "legendary_artist",
        title: "Legendary Artist",
        description: "You've drawn 10,000 pixels!",
        rarity: .legendary,
        xpReward: 5000,
        coinReward: 500,
        iconName: "crown.fill"
    )

    ZStack {
        Color.black
            .ignoresSafeArea()

        if isPresented {
            AchievementUnlockView(
                achievement: legendary,
                isPresented: $isPresented
            )
        }
    }
}
