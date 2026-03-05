import SwiftUI

/// P1-3: Pixel Draw Feedback - Floating "+1" animation
/// Shows instant visual feedback when user draws pixels in events
struct PixelDrawFeedback: View {
    @ObservedObject private var fontManager = FontSizeManager.shared
    let count: Int
    @State private var offset: CGFloat = 0
    @State private var opacity: Double = 1.0
    @State private var scale: CGFloat = 0.8

    var body: some View {
        Text("+\(count)")
            .font(.system(size: 28, weight: .bold, design: .rounded))
            .foregroundStyle(
                LinearGradient(
                    colors: [.green, .yellow],
                    startPoint: .leading,
                    endPoint: .trailing
                )
            )
            .shadow(color: .black.opacity(0.3), radius: 2, x: 0, y: 1)
            .scaleEffect(scale)
            .offset(y: offset)
            .opacity(opacity)
            .onAppear {
                withAnimation(.easeOut(duration: 1.0)) {
                    offset = -80  // Float upward
                    opacity = 0   // Fade out
                }
                withAnimation(.spring(response: 0.3, dampingFraction: 0.6)) {
                    scale = 1.2   // Bounce in
                }
            }
    }
}

// MARK: - Overlay Modifier

extension View {
    /// Show floating "+X" feedback at a specific position
    func pixelDrawFeedback(_ count: Int, at position: CGPoint, isVisible: Bool) -> some View {
        self.overlay(alignment: .center) {
            if isVisible {
                PixelDrawFeedback(count: count)
                    .position(position)
                    .allowsHitTesting(false)
            }
        }
    }
}

// MARK: - Preview

#Preview {
    ZStack {
        Color.black.opacity(0.8)
            .ignoresSafeArea()

        VStack(spacing: 40) {
            PixelDrawFeedback(count: 1)
            PixelDrawFeedback(count: 10)
            PixelDrawFeedback(count: 100)
        }
    }
}
