import SwiftUI
import Combine

/// Full-screen celebration animation when the user draws their first pixel
/// 优化版：添加成就卡片和社交分享提示
struct FirstPixelCelebration: View {
    @Binding var isPresented: Bool
    @State private var particles: [ConfettiParticle] = []
    @State private var showContent = false
    @State private var contentScale: CGFloat = 0.5
    @State private var showShareHint = false
    @ObservedObject private var fontManager = FontSizeManager.shared

    var body: some View {
        ZStack {
            // Semi-transparent backdrop
            Color.black.opacity(0.4)
                .ignoresSafeArea()
                .onTapGesture {
                    dismiss()
                }

            // Confetti particles
            ForEach(particles) { particle in
                Circle()
                    .fill(particle.color)
                    .frame(width: particle.size, height: particle.size)
                    .position(particle.position)
                    .opacity(particle.opacity)
            }

            // Celebration content
            if showContent {
                VStack(spacing: 24) {
                    // Main icon with gradient background
                    ZStack {
                        Circle()
                            .fill(
                                LinearGradient(
                                    colors: [.yellow, .orange],
                                    startPoint: .topLeading,
                                    endPoint: .bottomTrailing
                                )
                            )
                            .frame(width: 100, height: 100)

                        Image(systemName: "star.fill")
                            .font(.system(size: 48))
                            .foregroundColor(.white)
                    }
                    .shadow(color: .yellow.opacity(0.5), radius: 20, x: 0, y: 10)

                    // Title and subtitle
                    VStack(spacing: 8) {
                        Text(NSLocalizedString(
                            "celebration.first_pixel.title",
                            value: "恭喜！",
                            comment: "Congratulations title"
                        ))
                        .responsiveFont(.title1, weight: .bold)
                        .foregroundColor(.white)

                        Text(NSLocalizedString(
                            "celebration.first_pixel.subtitle",
                            value: "你已经是全球300万创作者之一了",
                            comment: "Creator community subtitle"
                        ))
                        .responsiveFont(.headline)
                        .foregroundColor(.white.opacity(0.9))
                        .multilineTextAlignment(.center)
                    }

                    // Achievement card
                    achievementCard

                    // Share hint (delayed appearance)
                    if showShareHint {
                        shareHintButton
                            .transition(.scale.combined(with: .opacity))
                    }
                }
                .scaleEffect(contentScale)
                .padding(.horizontal, 32)
            }
        }
        .onAppear {
            spawnConfetti()
            animateContent()
        }
    }

    // MARK: - Achievement Card

    private var achievementCard: some View {
        HStack(spacing: 12) {
            Image(systemName: "trophy.fill")
                .font(.system(size: 24))
                .foregroundColor(.yellow)

            VStack(alignment: .leading, spacing: 4) {
                Text(NSLocalizedString(
                    "celebration.achievement",
                    value: "成就解锁",
                    comment: "Achievement unlocked"
                ))
                .responsiveFont(.subheadline, weight: .bold)
                .foregroundColor(.white)

                Text(NSLocalizedString(
                    "celebration.first_timer",
                    value: "初试身手",
                    comment: "First timer achievement"
                ))
                .responsiveFont(.caption)
                .foregroundColor(.white.opacity(0.8))
            }

            Spacer()
        }
        .padding(16)
        .background(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(.white.opacity(0.2))
                .background(.ultraThinMaterial)
                .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        )
    }

    // MARK: - Share Hint Button

    private var shareHintButton: some View {
        HStack {
            Image(systemName: "square.and.arrow.up")
                .font(.system(size: 16, weight: .semibold))

            Text(NSLocalizedString(
                "celebration.share",
                value: "分享给朋友",
                comment: "Share with friends"
            ))
            .responsiveFont(.subheadline, weight: .semibold)
        }
        .foregroundColor(.white)
        .padding(.horizontal, 20)
        .padding(.vertical, 12)
        .background(
            Capsule()
                .fill(UnifiedColors.primary)
                .shadow(color: UnifiedColors.primary.opacity(0.4), radius: 8, x: 0, y: 4)
        )
    }

    // MARK: - Animation Logic

    private func animateContent() {
        // Main content animation
        withAnimation(.spring(response: 0.5, dampingFraction: 0.6)) {
            showContent = true
            contentScale = 1.0
        }

        // Share hint delayed appearance
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
            withAnimation(.spring(response: 0.4, dampingFraction: 0.7)) {
                showShareHint = true
            }
        }

        // Auto dismiss
        DispatchQueue.main.asyncAfter(deadline: .now() + 3.0) {
            dismiss()
        }
    }

    private func dismiss() {
        withAnimation(.easeOut(duration: 0.3)) {
            isPresented = false
        }
    }

    private func spawnConfetti() {
        let screenWidth = UIScreen.main.bounds.width
        let screenHeight = UIScreen.main.bounds.height
        let colors: [Color] = [.red, .orange, .yellow, .green, .blue, .purple, .pink]

        for i in 0..<30 {
            let particle = ConfettiParticle(
                id: i,
                color: colors.randomElement()!,
                size: CGFloat.random(in: 6...12),
                position: CGPoint(
                    x: CGFloat.random(in: 0...screenWidth),
                    y: -20
                ),
                opacity: 1.0
            )
            particles.append(particle)
        }

        // Animate particles falling
        for i in 0..<particles.count {
            let delay = Double.random(in: 0...0.5)
            let targetY = CGFloat.random(in: screenHeight * 0.3...screenHeight)
            let targetX = particles[i].position.x + CGFloat.random(in: -60...60)

            withAnimation(.easeOut(duration: Double.random(in: 1.5...2.5)).delay(delay)) {
                particles[i].position = CGPoint(x: targetX, y: targetY)
            }
            withAnimation(.easeIn(duration: 0.5).delay(delay + 2.0)) {
                particles[i].opacity = 0
            }
        }
    }
}

private struct ConfettiParticle: Identifiable {
    let id: Int
    let color: Color
    let size: CGFloat
    var position: CGPoint
    var opacity: Double
}
