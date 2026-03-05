import SwiftUI

// MARK: - Onboarding Step Enum

/// Defines the 5 interactive onboarding steps
enum LegacyOnboardingStep: Int, CaseIterable {
    case tapPixel = 0      // Step 1: Tap to place your first pixel
    case pickColor = 1     // Step 2: Pick a color
    case placePixel = 2    // Step 3: Place the pixel (triggers celebration)
    case seeOthers = 3     // Step 4: See what others have drawn
    case allianceTeaser = 4 // Step 5: Alliance teaser (skippable)

    var progressIndex: Int { rawValue }

    static var totalSteps: Int { allCases.count }
}

// MARK: - Interactive Onboarding Overlay

/// Interactive onboarding overlay that sits on top of the map.
/// Users learn by doing: they place their first pixel within the first minute.
struct OnboardingOverlayView: View {
    @Binding var isPresented: Bool
    @State private var currentStep: LegacyOnboardingStep = .tapPixel
    @State private var animateSpotlight = false
    @State private var showStepContent = false
    @State private var pulseScale: CGFloat = 1.0
    @State private var showCelebration = false
    @State private var selectedColor: Color = .blue
    @State private var shimmerOffset: CGFloat = -200

    // Color palette for step 2
    private let colorPalette: [Color] = [
        .red, .orange, .yellow, .green,
        .blue, .purple, .pink, .cyan
    ]

    // Spotlight position (center of screen, slightly above middle)
    private var spotlightCenter: CGPoint {
        let screen = UIScreen.main.bounds
        return CGPoint(x: screen.width / 2, y: screen.height * 0.42)
    }

    private let spotlightRadius: CGFloat = 55

    var body: some View {
        GeometryReader { geometry in
            ZStack {
                // Layer 1: Semi-transparent overlay with spotlight cutout
                spotlightOverlay(in: geometry)

                // Layer 2: Step-specific content
                stepContent(in: geometry)

                // Layer 3: Skip button (top right)
                skipButton

                // Layer 4: Progress dots (bottom)
                progressDots

                // Layer 5: First pixel celebration overlay
                if showCelebration {
                    FirstPixelCelebration(isPresented: $showCelebration)
                        .zIndex(300)
                }
            }
        }
        .ignoresSafeArea()
        .onAppear {
            withAnimation(.easeOut(duration: 0.6)) {
                animateSpotlight = true
            }
            withAnimation(.easeOut(duration: 0.5).delay(0.3)) {
                showStepContent = true
            }
            startPulseAnimation()
        }
        .onChange(of: showCelebration) {
            if !showCelebration && currentStep == .placePixel {
                // After celebration dismisses, advance to step 4
                advanceStep()
            }
        }
    }

    // MARK: - Spotlight Overlay

    @ViewBuilder
    private func spotlightOverlay(in geometry: GeometryProxy) -> some View {
        let showSpotlight = currentStep == .tapPixel || currentStep == .pickColor || currentStep == .placePixel

        if showSpotlight {
            Canvas { context, size in
                // Fill the entire area with semi-transparent black
                context.fill(
                    Path(CGRect(origin: .zero, size: size)),
                    with: .color(.black.opacity(0.55))
                )

                // Cut out a circular spotlight
                let center = spotlightCenter
                let radius = spotlightRadius + (animateSpotlight ? 0 : -20)
                let spotlightRect = CGRect(
                    x: center.x - radius,
                    y: center.y - radius,
                    width: radius * 2,
                    height: radius * 2
                )
                context.blendMode = .destinationOut
                // Soft-edge spotlight with gradient
                context.fill(
                    Path(ellipseIn: spotlightRect.insetBy(dx: -15, dy: -15)),
                    with: .color(.white.opacity(0.3))
                )
                context.fill(
                    Path(ellipseIn: spotlightRect),
                    with: .color(.white)
                )
            }
            .allowsHitTesting(false)
            .animation(.easeOut(duration: 0.6), value: animateSpotlight)
        } else {
            // Steps 4 & 5: full semi-transparent overlay (no cutout)
            Color.black.opacity(0.55)
                .allowsHitTesting(false)
                .transition(.opacity)
        }
    }

    // MARK: - Step Content

    @ViewBuilder
    private func stepContent(in geometry: GeometryProxy) -> some View {
        switch currentStep {
        case .tapPixel:
            tapPixelContent(in: geometry)
        case .pickColor:
            pickColorContent(in: geometry)
        case .placePixel:
            placePixelContent(in: geometry)
        case .seeOthers:
            seeOthersContent(in: geometry)
        case .allianceTeaser:
            allianceTeaserContent(in: geometry)
        }
    }

    // MARK: - Step 1: Tap to Place Pixel

    private func tapPixelContent(in geometry: GeometryProxy) -> some View {
        VStack(spacing: 0) {
            Spacer()
                .frame(height: spotlightCenter.y + spotlightRadius + 30)

            // Pulsing ring around spotlight area
            pulsingRing
                .position(spotlightCenter)
                .frame(width: geometry.size.width, height: 0)

            VStack(spacing: AppSpacing.m) {
                // Instruction card
                OnboardingInstructionCard(
                    icon: "hand.tap.fill",
                    title: NSLocalizedString("onboarding_v2.step1.title", comment: ""),
                    subtitle: NSLocalizedString("onboarding_v2.step1.subtitle", comment: "")
                )
            }
            .opacity(showStepContent ? 1 : 0)
            .offset(y: showStepContent ? 0 : 20)
            .padding(.top, 40)
            .padding(.horizontal, AppSpacing.xl)

            Spacer()
        }
        .contentShape(Rectangle())
        .onTapGesture {
            HapticManager.shared.impact(style: .medium)
            SoundManager.shared.play(.buttonClick)
            advanceStep()
        }
    }

    // MARK: - Step 2: Pick a Color

    private func pickColorContent(in geometry: GeometryProxy) -> some View {
        VStack(spacing: 0) {
            Spacer()
                .frame(height: spotlightCenter.y + spotlightRadius + 30)

            VStack(spacing: AppSpacing.l) {
                OnboardingInstructionCard(
                    icon: "paintpalette.fill",
                    title: NSLocalizedString("onboarding_v2.step2.title", comment: ""),
                    subtitle: NSLocalizedString("onboarding_v2.step2.subtitle", comment: "")
                )

                // Color picker grid
                colorPickerGrid
            }
            .opacity(showStepContent ? 1 : 0)
            .offset(y: showStepContent ? 0 : 20)
            .padding(.top, 40)
            .padding(.horizontal, AppSpacing.xl)

            Spacer()
        }
    }

    // MARK: - Step 3: Place Pixel (auto-advance after celebration)

    private func placePixelContent(in geometry: GeometryProxy) -> some View {
        VStack(spacing: 0) {
            Spacer()
                .frame(height: spotlightCenter.y + spotlightRadius + 30)

            VStack(spacing: AppSpacing.m) {
                OnboardingInstructionCard(
                    icon: "sparkles",
                    title: NSLocalizedString("onboarding_v2.step3.title", comment: ""),
                    subtitle: NSLocalizedString("onboarding_v2.step3.subtitle", comment: "")
                )

                // "Place it!" button
                Button(action: {
                    HapticManager.shared.notification(type: .success)
                    SoundManager.shared.playSuccess()
                    withAnimation(.spring(response: 0.4, dampingFraction: 0.7)) {
                        showCelebration = true
                    }
                }) {
                    HStack(spacing: 8) {
                        Image(systemName: "star.fill")
                            .font(.system(size: 16, weight: .semibold))
                        Text(NSLocalizedString("onboarding_v2.step3.button", comment: ""))
                            .responsiveFont(.headline, weight: .semibold)
                    }
                    .foregroundColor(.white)
                    .padding(.horizontal, 32)
                    .padding(.vertical, 14)
                    .background(
                        Capsule()
                            .fill(
                                LinearGradient(
                                    colors: [selectedColor, selectedColor.opacity(0.8)],
                                    startPoint: .leading,
                                    endPoint: .trailing
                                )
                            )
                    )
                    .shadow(color: selectedColor.opacity(0.4), radius: 8, x: 0, y: 4)
                }
                .buttonStyle(OnboardingButtonStyle())
            }
            .opacity(showStepContent ? 1 : 0)
            .offset(y: showStepContent ? 0 : 20)
            .padding(.top, 40)
            .padding(.horizontal, AppSpacing.xl)

            Spacer()
        }
    }

    // MARK: - Step 4: See What Others Drew

    private func seeOthersContent(in geometry: GeometryProxy) -> some View {
        VStack(spacing: AppSpacing.xl) {
            Spacer()

            // Large centered card
            VStack(spacing: AppSpacing.l) {
                Image(systemName: "map.fill")
                    .font(.system(size: 48))
                    .foregroundStyle(
                        LinearGradient(
                            colors: [AppColors.primary, AppColors.primary.opacity(0.6)],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )

                VStack(spacing: AppSpacing.s) {
                    Text(NSLocalizedString("onboarding_v2.step4.title", comment: ""))
                        .responsiveFont(.title2, weight: .bold)
                        .foregroundColor(AppColors.textPrimary)
                        .multilineTextAlignment(.center)

                    Text(NSLocalizedString("onboarding_v2.step4.subtitle", comment: ""))
                        .responsiveFont(.body)
                        .foregroundColor(AppColors.textSecondary)
                        .multilineTextAlignment(.center)
                        .lineSpacing(4)
                }

                // Simulated nearby pixels row
                nearbyPixelsPreview
            }
            .padding(AppSpacing.xxl)
            .background(
                RoundedRectangle(cornerRadius: UnifiedRadius.l, style: .continuous)
                    .fill(AppColors.surface)
                    .unifiedElevatedShadow()
            )
            .padding(.horizontal, AppSpacing.xl)

            // Continue button
            Button(action: {
                HapticManager.shared.impact(style: .light)
                advanceStep()
            }) {
                Text(NSLocalizedString("onboarding_v2.continue", comment: ""))
                    .responsiveFont(.headline, weight: .semibold)
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 16)
                    .background(
                        Capsule()
                            .fill(AppColors.primary)
                    )
                    .shadow(color: AppColors.primary.opacity(0.25), radius: 8, x: 0, y: 4)
            }
            .buttonStyle(OnboardingButtonStyle())
            .padding(.horizontal, AppSpacing.xl)

            Spacer()
        }
        .opacity(showStepContent ? 1 : 0)
        .offset(y: showStepContent ? 0 : 30)
    }

    // MARK: - Step 5: Alliance Teaser

    private func allianceTeaserContent(in geometry: GeometryProxy) -> some View {
        VStack(spacing: AppSpacing.xl) {
            Spacer()

            // Alliance teaser card
            VStack(spacing: AppSpacing.l) {
                Image(systemName: "flag.2.crossed.fill")
                    .font(.system(size: 48))
                    .foregroundStyle(
                        LinearGradient(
                            colors: [.orange, .red],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )

                VStack(spacing: AppSpacing.s) {
                    Text(NSLocalizedString("onboarding_v2.step5.title", comment: ""))
                        .responsiveFont(.title2, weight: .bold)
                        .foregroundColor(AppColors.textPrimary)
                        .multilineTextAlignment(.center)

                    Text(NSLocalizedString("onboarding_v2.step5.subtitle", comment: ""))
                        .responsiveFont(.body)
                        .foregroundColor(AppColors.textSecondary)
                        .multilineTextAlignment(.center)
                        .lineSpacing(4)
                }

                // Alliance benefit pills
                allianceBenefitPills
            }
            .padding(AppSpacing.xxl)
            .background(
                RoundedRectangle(cornerRadius: UnifiedRadius.l, style: .continuous)
                    .fill(AppColors.surface)
                    .unifiedElevatedShadow()
            )
            .padding(.horizontal, AppSpacing.xl)

            // Primary CTA
            Button(action: {
                HapticManager.shared.impact(style: .medium)
                SoundManager.shared.play(.buttonClick)
                completeOnboarding()
            }) {
                Text(NSLocalizedString("onboarding_v2.step5.button", comment: ""))
                    .responsiveFont(.headline, weight: .semibold)
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 16)
                    .background(
                        Capsule()
                            .fill(
                                LinearGradient(
                                    colors: [.orange, .red.opacity(0.85)],
                                    startPoint: .leading,
                                    endPoint: .trailing
                                )
                            )
                    )
                    .shadow(color: Color.orange.opacity(0.3), radius: 8, x: 0, y: 4)
            }
            .buttonStyle(OnboardingButtonStyle())
            .padding(.horizontal, AppSpacing.xl)

            // Skip text
            Button(action: {
                completeOnboarding()
            }) {
                Text(NSLocalizedString("onboarding_v2.step5.skip", comment: ""))
                    .responsiveFont(.subheadline)
                    .foregroundColor(AppColors.textTertiary)
            }
            .padding(.bottom, AppSpacing.s)

            Spacer()
        }
        .opacity(showStepContent ? 1 : 0)
        .offset(y: showStepContent ? 0 : 30)
    }

    // MARK: - Sub-Components

    /// Pulsing ring that draws attention to the spotlight area
    private var pulsingRing: some View {
        Circle()
            .stroke(Color.white.opacity(0.6), lineWidth: 2)
            .frame(width: spotlightRadius * 2 + 20, height: spotlightRadius * 2 + 20)
            .scaleEffect(pulseScale)
            .opacity(2.0 - Double(pulseScale))
    }

    /// Color picker grid for step 2
    private var colorPickerGrid: some View {
        LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 12), count: 4), spacing: 12) {
            ForEach(colorPalette, id: \.self) { color in
                Button(action: {
                    HapticManager.shared.selection()
                    withAnimation(.spring(response: 0.3, dampingFraction: 0.7)) {
                        selectedColor = color
                    }
                    // Auto-advance after color selection with a brief delay
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) {
                        advanceStep()
                    }
                }) {
                    Circle()
                        .fill(color)
                        .frame(width: 48, height: 48)
                        .overlay(
                            Circle()
                                .stroke(Color.white, lineWidth: selectedColor == color ? 3 : 0)
                        )
                        .shadow(color: color.opacity(0.4), radius: 4, x: 0, y: 2)
                        .scaleEffect(selectedColor == color ? 1.15 : 1.0)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, AppSpacing.m)
    }

    /// Simulated row of nearby pixels for step 4
    private var nearbyPixelsPreview: some View {
        HStack(spacing: 6) {
            ForEach(0..<8, id: \.self) { index in
                RoundedRectangle(cornerRadius: 3, style: .continuous)
                    .fill(colorPalette[index % colorPalette.count].opacity(0.8))
                    .frame(width: 28, height: 28)
                    .overlay(
                        RoundedRectangle(cornerRadius: 3, style: .continuous)
                            .stroke(Color.white.opacity(0.3), lineWidth: 0.5)
                    )
            }
        }
    }

    /// Benefit pills for the alliance teaser
    private var allianceBenefitPills: some View {
        VStack(spacing: AppSpacing.s) {
            allianceBenefitRow(
                icon: "person.3.fill",
                text: NSLocalizedString("onboarding_v2.step5.benefit1", comment: "")
            )
            allianceBenefitRow(
                icon: "flag.fill",
                text: NSLocalizedString("onboarding_v2.step5.benefit2", comment: "")
            )
            allianceBenefitRow(
                icon: "trophy.fill",
                text: NSLocalizedString("onboarding_v2.step5.benefit3", comment: "")
            )
        }
    }

    private func allianceBenefitRow(icon: String, text: String) -> some View {
        HStack(spacing: AppSpacing.m) {
            Image(systemName: icon)
                .font(.system(size: 14))
                .foregroundColor(AppColors.primary)
                .frame(width: 28, height: 28)
                .background(
                    Circle()
                        .fill(AppColors.primary.opacity(0.1))
                )

            Text(text)
                .responsiveFont(.subheadline)
                .foregroundColor(AppColors.textSecondary)

            Spacer()
        }
    }

    // MARK: - Skip Button

    private var skipButton: some View {
        VStack {
            HStack {
                Spacer()
                Button(action: {
                    HapticManager.shared.impact(style: .light)
                    completeOnboarding()
                }) {
                    Text(NSLocalizedString("onboarding_v2.skip", comment: ""))
                        .responsiveFont(.subheadline, weight: .medium)
                        .foregroundColor(.white.opacity(0.9))
                        .padding(.horizontal, 16)
                        .padding(.vertical, 8)
                        .background(
                            Capsule()
                                .fill(Color.white.opacity(0.2))
                        )
                }
                .padding(.top, 60)
                .padding(.trailing, 20)
            }
            Spacer()
        }
    }

    // MARK: - Progress Dots

    private var progressDots: some View {
        VStack {
            Spacer()
            HStack(spacing: 8) {
                ForEach(0..<LegacyOnboardingStep.totalSteps, id: \.self) { index in
                    Circle()
                        .fill(index == currentStep.progressIndex
                              ? Color.white
                              : Color.white.opacity(0.35))
                        .frame(
                            width: index == currentStep.progressIndex ? 10 : 7,
                            height: index == currentStep.progressIndex ? 10 : 7
                        )
                        .animation(.spring(response: 0.3, dampingFraction: 0.7), value: currentStep)
                }
            }
            .padding(.bottom, 50)
        }
    }

    // MARK: - Actions

    private func advanceStep() {
        guard let nextStepRaw = LegacyOnboardingStep(rawValue: currentStep.rawValue + 1) else {
            completeOnboarding()
            return
        }

        // Transition animation
        withAnimation(.easeOut(duration: 0.2)) {
            showStepContent = false
        }

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.25) {
            currentStep = nextStepRaw
            withAnimation(.easeOut(duration: 0.5)) {
                showStepContent = true
            }
        }
    }

    private func completeOnboarding() {
        HapticManager.shared.notification(type: .success)
        withAnimation(.easeOut(duration: 0.3)) {
            isPresented = false
        }
    }

    private func startPulseAnimation() {
        withAnimation(
            .easeInOut(duration: 1.5)
            .repeatForever(autoreverses: false)
        ) {
            pulseScale = 1.5
        }
    }
}

// MARK: - Instruction Card Component

/// Reusable instruction card shown below the spotlight
private struct OnboardingInstructionCard: View {
    let icon: String
    let title: String
    let subtitle: String

    var body: some View {
        VStack(spacing: AppSpacing.m) {
            Image(systemName: icon)
                .font(.system(size: 28))
                .foregroundColor(.white)

            Text(title)
                .responsiveFont(.title3, weight: .bold)
                .foregroundColor(.white)
                .multilineTextAlignment(.center)

            Text(subtitle)
                .responsiveFont(.body)
                .foregroundColor(.white.opacity(0.8))
                .multilineTextAlignment(.center)
                .lineSpacing(3)
        }
        .padding(.vertical, AppSpacing.xl)
        .padding(.horizontal, AppSpacing.l)
        .frame(maxWidth: .infinity)
        .background(
            RoundedRectangle(cornerRadius: UnifiedRadius.l, style: .continuous)
                .fill(Color.black.opacity(0.5))
                .background(
                    RoundedRectangle(cornerRadius: UnifiedRadius.l, style: .continuous)
                        .fill(.ultraThinMaterial)
                )
                .clipShape(RoundedRectangle(cornerRadius: UnifiedRadius.l, style: .continuous))
        )
    }
}

// MARK: - Button Style (reused from old onboarding)

/// Consistent press feedback for onboarding buttons
private struct OnboardingButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.97 : 1.0)
            .opacity(configuration.isPressed ? 0.9 : 1.0)
            .animation(.spring(response: 0.3, dampingFraction: 0.7), value: configuration.isPressed)
    }
}

// MARK: - Legacy OnboardingView (kept for backward compatibility)

/// Legacy onboarding view - redirects to the new interactive overlay.
/// This struct is kept so that any remaining references compile,
/// but MainMapView now uses OnboardingOverlayView directly.
struct OnboardingView: View {
    @Binding var isPresented: Bool

    var body: some View {
        OnboardingOverlayView(isPresented: $isPresented)
    }
}

#Preview {
    ZStack {
        // Simulated map background
        LinearGradient(
            colors: [Color.green.opacity(0.3), Color.blue.opacity(0.2)],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
        .ignoresSafeArea()

        OnboardingOverlayView(isPresented: .constant(true))
    }
}
