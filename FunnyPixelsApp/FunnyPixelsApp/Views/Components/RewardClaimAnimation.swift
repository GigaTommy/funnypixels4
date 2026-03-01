import SwiftUI

/// 奖励领取庆祝动画
struct RewardClaimAnimation: View {
    let points: Int
    @Binding var isPresented: Bool
    @State private var scale: CGFloat = 0.5
    @State private var opacity: Double = 0
    @State private var coinOffset: CGFloat = 0
    @State private var sparkleAngles: [Double] = (0..<8).map { _ in Double.random(in: 0...360) }

    var body: some View {
        if isPresented {
            ZStack {
                // Coins animation
                ForEach(0..<3, id: \.self) { index in
                    Image(systemName: "star.fill")
                        .font(.system(size: 30))
                        .foregroundColor(.yellow)
                        .offset(y: coinOffset - CGFloat(index * 20))
                        .opacity(1 - Double(coinOffset) / 200)
                        .rotationEffect(.degrees(Double(index * 120)))
                }

                // Sparkles
                ForEach(0..<8, id: \.self) { index in
                    Circle()
                        .fill(Color.yellow.opacity(0.8))
                        .frame(width: 4, height: 4)
                        .offset(x: cos(sparkleAngles[index] * .pi / 180) * scale * 40,
                               y: sin(sparkleAngles[index] * .pi / 180) * scale * 40)
                }

                // Points text
                VStack(spacing: 4) {
                    Text("+\(points)")
                        .font(.system(size: 36, weight: .bold))
                        .foregroundColor(.yellow)
                        .shadow(color: .black.opacity(0.3), radius: 2, x: 0, y: 2)

                    Text(NSLocalizedString("daily_task.points_earned", comment: "Points"))
                        .font(.system(size: 14, weight: .medium))
                        .foregroundColor(.white)
                }
                .scaleEffect(scale)
                .opacity(opacity)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(Color.black.opacity(0.3))
            .onAppear {
                withAnimation(.spring(response: 0.4, dampingFraction: 0.6)) {
                    scale = 1.2
                    opacity = 1
                }

                withAnimation(.easeOut(duration: 1.5)) {
                    coinOffset = 200
                }

                DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
                    withAnimation(.easeOut(duration: 0.3)) {
                        opacity = 0
                        scale = 0.8
                    }
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                        isPresented = false
                    }
                }
            }
        }
    }
}

// Preview
struct RewardClaimAnimation_Previews: PreviewProvider {
    static var previews: some View {
        RewardClaimAnimation(points: 50, isPresented: .constant(true))
            .background(Color.black.opacity(0.5))
    }
}
