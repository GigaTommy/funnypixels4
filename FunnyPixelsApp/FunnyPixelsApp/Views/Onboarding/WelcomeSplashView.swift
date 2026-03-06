import SwiftUI

/// 欢迎闪屏 - 2秒动画建立期待感
/// 设计原则：最小化文本，最大化视觉冲击
struct WelcomeSplashView: View {
    @Binding var isPresented: Bool
    @State private var scale: CGFloat = 0.8
    @State private var opacity: Double = 0.0

    var body: some View {
        ZStack {
            // 渐变背景 — 与 LaunchLoadingView 保持一致
            LinearGradient(
                colors: [
                    Color(hex: "EEF4FF") ?? AppColors.background,
                    AppColors.background,
                    Color.white
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .ignoresSafeArea()

            VStack(spacing: 32) {
                // App Logo
                Image("WelcomeLogo")
                    .resizable()
                    .scaledToFit()
                    .frame(width: 140, height: 140)
                    .shadow(color: AppColors.primary.opacity(0.15), radius: 16, x: 0, y: 8)

                // 核心价值主张
                Text(NSLocalizedString(
                    "welcome.tagline",
                    value: "在真实世界的地图上留下你的印记",
                    comment: "Welcome tagline"
                ))
                .responsiveFont(.title2, weight: .bold)
                .foregroundColor(.black)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 40)

                // 社会证明（数据驱动）
                HStack(spacing: 24) {
                    statPill(
                        image: "WelcomePin",
                        value: "60+",
                        label: NSLocalizedString("welcome.countries", value: "国家", comment: "Countries count")
                    )
                    statPill(
                        image: "WelcomeEarth",
                        value: "300万",
                        label: NSLocalizedString("welcome.pixels", value: "像素", comment: "Pixels count")
                    )
                }
            }
            .scaleEffect(scale)
            .opacity(opacity)
        }
        .onAppear {
            // 入场动画
            withAnimation(.spring(response: 0.6, dampingFraction: 0.75)) {
                scale = 1.0
                opacity = 1.0
            }

            // 2秒后自动消失
            DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) {
                withAnimation(.easeOut(duration: 0.3)) {
                    opacity = 0.0
                }
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                    isPresented = false
                }
            }
        }
    }

    private func statPill(image: String, value: String, label: String) -> some View {
        VStack(spacing: 4) {
            HStack(spacing: 6) {
                Image(image)
                    .resizable()
                    .scaledToFit()
                    .frame(width: 20, height: 20)
                Text(value)
                    .responsiveFont(.headline, weight: .bold)
            }
            .foregroundColor(.black)

            Text(label)
                .responsiveFont(.caption2)
                .foregroundColor(.gray)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .background(
            Capsule()
                .fill(Color.black.opacity(0.05))
        )
    }
}

// MARK: - Preview

#Preview {
    WelcomeSplashView(isPresented: .constant(true))
}
