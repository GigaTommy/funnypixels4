import SwiftUI
import Combine

/// Full-screen celebration animation when the user draws their first pixel
struct FirstPixelCelebration: View {
    @Binding var isPresented: Bool
    @State private var particles: [ConfettiParticle] = []
    @State private var showText = false
    @State private var textScale: CGFloat = 0.3
    @ObservedObject private var fontManager = FontSizeManager.shared

    var body: some View {
        ZStack {
            // Semi-transparent backdrop
            Color.black.opacity(0.3)
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

            // Celebration text
            if showText {
                VStack(spacing: 16) {
                    Image(systemName: "party.popper.fill")
                        .font(.system(size: 56))
                        .foregroundColor(.yellow)

                    Text(NSLocalizedString("celebration.first_pixel.title", comment: "First Pixel!"))
                        .responsiveFont(.title2, weight: .bold)
                        .foregroundColor(.white)

                    Text(NSLocalizedString("celebration.first_pixel.subtitle", comment: "Your journey begins"))
                        .responsiveFont(.headline)
                        .foregroundColor(.white.opacity(0.8))
                }
                .scaleEffect(textScale)
                .shadow(color: .black.opacity(0.3), radius: 8)
            }
        }
        .onAppear {
            spawnConfetti()
            withAnimation(.spring(response: 0.5, dampingFraction: 0.6)) {
                showText = true
                textScale = 1.0
            }
            DispatchQueue.main.asyncAfter(deadline: .now() + 3.0) {
                dismiss()
            }
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
