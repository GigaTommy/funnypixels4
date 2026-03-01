//
//  LaunchLoadingView.swift
//  FunnyPixelsApp
//
//  Launch loading screen — branded, consistent with app design system
//

import SwiftUI

/// Launch loading screen shown during session validation (max ~2s)
struct LaunchLoadingView: View {
    @State private var logoScale: CGFloat = 0.8
    @State private var logoOpacity: CGFloat = 0
    @State private var showContent = false
    @State private var currentTip = ""
    @State private var dotPhase: CGFloat = 0

    var tips: [String] {
        [
            NSLocalizedString("launch.tip.long_press", comment: ""),
            NSLocalizedString("launch.tip.color_palette", comment: ""),
            NSLocalizedString("launch.tip.zoom_out", comment: ""),
            NSLocalizedString("launch.tip.daily_tasks", comment: ""),
            NSLocalizedString("launch.tip.alliance", comment: ""),
            NSLocalizedString("launch.tip.consecutive_login", comment: ""),
            NSLocalizedString("launch.tip.gps_drawing", comment: ""),
            NSLocalizedString("launch.tip.like_pixels", comment: "")
        ]
    }

    var body: some View {
        ZStack {
            // Background — matches app's light theme
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

            // Subtle decorative blob (GPU-optimized)
            Circle()
                .fill(
                    RadialGradient(
                        colors: [AppColors.primary.opacity(0.06), AppColors.primary.opacity(0.0)],
                        center: .center,
                        startRadius: 20,
                        endRadius: 180
                    )
                )
                .frame(width: 360, height: 360)
                .offset(x: -60, y: -200)
                .blur(radius: 40)

            VStack(spacing: AppSpacing.xl) {
                Spacer()

                // App Logo with branded shadow
                Image("AppLogo")
                    .resizable()
                    .scaledToFit()
                    .frame(width: 88, height: 88)
                    .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
                    .shadow(color: AppColors.primary.opacity(0.15), radius: 16, x: 0, y: 8)
                    .scaleEffect(logoScale)
                    .opacity(logoOpacity)

                // Loading dots — brand blue
                BrandLoadingDots(phase: dotPhase)
                    .opacity(showContent ? 1 : 0)

                // Slogan
                Text(NSLocalizedString("launch.slogan", comment: "App slogan"))
                    .font(AppTypography.headline(18))
                    .foregroundColor(AppColors.textPrimary)
                    .opacity(showContent ? 1 : 0)

                // Daily tip
                if !currentTip.isEmpty {
                    HStack(spacing: 8) {
                        Image(systemName: "lightbulb.fill")
                            .font(.system(size: 13))
                            .foregroundColor(AppColors.primary.opacity(0.5))

                        Text(currentTip)
                            .font(AppTypography.caption())
                            .foregroundColor(AppColors.textSecondary)
                    }
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, AppSpacing.xl)
                    .transition(.opacity.combined(with: .move(edge: .bottom)))
                }

                Spacer()
                Spacer()
            }
        }
        .onAppear {
            // Logo entrance
            withAnimation(.spring(response: 0.6, dampingFraction: 0.7)) {
                logoScale = 1.0
                logoOpacity = 1.0
            }

            // Dot animation
            withAnimation(.linear(duration: 1.8).repeatForever(autoreverses: false)) {
                dotPhase = 1.0
            }

            // Show text
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                withAnimation(.easeIn(duration: 0.3)) {
                    showContent = true
                }
            }

            // Random daily tip
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.8) {
                withAnimation(.easeIn(duration: 0.4)) {
                    currentTip = tips.randomElement() ?? tips[0]
                }
            }
        }
    }
}

/// Loading dots using brand colors
private struct BrandLoadingDots: View {
    let phase: CGFloat
    private let dotCount = 3
    private let dotSize: CGFloat = 8

    var body: some View {
        HStack(spacing: 10) {
            ForEach(0..<dotCount, id: \.self) { index in
                let delay = CGFloat(index) / CGFloat(dotCount)
                let progress = (phase + delay).truncatingRemainder(dividingBy: 1.0)
                let scale = 0.6 + 0.4 * sin(progress * .pi)
                let opacity = 0.3 + 0.7 * sin(progress * .pi)

                Circle()
                    .fill(AppColors.primary)
                    .frame(width: dotSize, height: dotSize)
                    .scaleEffect(scale)
                    .opacity(opacity)
            }
        }
    }
}

#Preview {
    LaunchLoadingView()
}
