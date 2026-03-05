import SwiftUI
import AuthenticationServices

/// Auth View — Fluid droplet-style login with Google as default.
struct AuthView: View {
    @EnvironmentObject var authViewModel: AuthViewModel
    @ObservedObject private var fontManager = FontSizeManager.shared
    @Environment(\.dismiss) private var dismiss
    @State private var showingAgreement = false
    @State private var showingPrivacy = false
    @State private var hasAgreedToTerms = false
    @State private var animateBlobs = false

    var body: some View {
        ZStack {
            // MARK: - Fluid Background
            FluidBackground(animateBlobs: animateBlobs)

            GeometryReader { geometry in
                ScrollView(showsIndicators: false) {
                    VStack(spacing: 0) {
                        Spacer(minLength: geometry.size.height * 0.06)

                        VStack(spacing: AppSpacing.xl) {
                            // MARK: - Brand Area
                            brandSection

                            // MARK: - Social Login (Primary)
                            socialLoginSection

                            // MARK: - Divider
                            orDivider

                            // MARK: - Form Card
                            formCard

                            // MARK: - Terms
                            termsSection
                        }
                        .frame(maxWidth: 400)
                        .frame(maxWidth: .infinity)

                        Spacer(minLength: AppSpacing.xxl)
                    }
                    .frame(minWidth: geometry.size.width)
                    .frame(minHeight: geometry.size.height)
                }
            }
        }
        .preferredColorScheme(.light)
        .onAppear {
            // ⚡ Performance: Mark AuthView rendered
            PerformanceMonitor.shared.markMilestone("AuthView rendered")
            PerformanceMonitor.shared.reportStartupPerformance()

            // Animate background blobs
            withAnimation(.easeInOut(duration: 6).repeatForever(autoreverses: true)) {
                animateBlobs = true
            }
        }
        .sheet(isPresented: $showingAgreement) { PolicyViewerSheet(title: NSLocalizedString("policy.terms.title", comment: ""), url: AppConfig.userAgreementURL) }
        .sheet(isPresented: $showingPrivacy) { PolicyViewerSheet(title: NSLocalizedString("policy.privacy.title", comment: ""), url: AppConfig.privacyPolicyURL) }
    }

    // MARK: - Brand Section

    private var brandSection: some View {
        VStack(spacing: AppSpacing.m) {
            Image("AppLogo")
                .resizable()
                .scaledToFit()
                .frame(width: 72, height: 72)
                .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
                .shadow(color: AppColors.primary.opacity(0.15), radius: 12, x: 0, y: 6)

            Text("auth.title")
                .responsiveFont(.title2)
                .foregroundColor(AppColors.textPrimary)

            Text("auth.slogan")
                .responsiveFont(.subheadline)
                .foregroundColor(AppColors.textSecondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, AppSpacing.xl)
        }
    }

    // MARK: - Social Login Section

    private var socialLoginSection: some View {
        VStack(spacing: AppSpacing.m) {
            // Google Sign In — PRIMARY action
            Button {
                guard hasAgreedToTerms else { return }
                Task { await authViewModel.signInWithGoogle() }
            } label: {
                HStack(spacing: AppSpacing.m) {
                    Image("google_logo")
                        .resizable()
                        .scaledToFit()
                        .frame(width: 22, height: 22)
                    Text(NSLocalizedString("auth.google.sign_in", comment: ""))
                        .responsiveFont(.body)
                        .foregroundColor(.white)
                }
                .frame(maxWidth: .infinity)
                .frame(height: 54)
                .background(
                    LinearGradient(
                        colors: [AppColors.primary, AppColors.primary.opacity(0.85)],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                .clipShape(Capsule())
                .shadow(color: AppColors.primary.opacity(0.3), radius: 8, x: 0, y: 4)
            }
            .buttonStyle(FluidButtonStyle())
            .disabled(!hasAgreedToTerms || authViewModel.isLoading)
            .opacity(hasAgreedToTerms ? 1.0 : 0.5)

            // Apple Sign In — secondary / outline style
            Button {
                guard hasAgreedToTerms else { return }
                Task { await authViewModel.signInWithApple() }
            } label: {
                HStack(spacing: AppSpacing.m) {
                    Image(systemName: "apple.logo")
                        .responsiveFont(.headline)
                        .foregroundColor(AppColors.textPrimary)
                    Text(NSLocalizedString("auth.apple.sign_in", comment: ""))
                        .responsiveFont(.callout)
                        .foregroundColor(AppColors.textPrimary)
                }
                .frame(maxWidth: .infinity)
                .frame(height: 54)
                .background(.ultraThinMaterial)
                .clipShape(Capsule())
                .overlay(
                    Capsule()
                        .stroke(AppColors.border, lineWidth: 1)
                )
            }
            .buttonStyle(FluidButtonStyle())
            .disabled(!hasAgreedToTerms || authViewModel.isLoading)
            .opacity(hasAgreedToTerms ? 1.0 : 0.5)
        }
        .padding(.horizontal, AppSpacing.xl)
    }

    // MARK: - Divider

    private var orDivider: some View {
        HStack(spacing: AppSpacing.m) {
            Capsule()
                .fill(AppColors.border)
                .frame(height: 1)
            Text(NSLocalizedString("auth.or_continue_with", comment: ""))
                .responsiveFont(.caption)
                .foregroundColor(AppColors.textTertiary)
                .layoutPriority(1)
            Capsule()
                .fill(AppColors.border)
                .frame(height: 1)
        }
        .padding(.horizontal, AppSpacing.xl)
    }

    // MARK: - Form Card

    private var formCard: some View {
        VStack(spacing: AppSpacing.l) {
            // Header toggle
            HStack(spacing: AppSpacing.xs) {
                Text(authViewModel.isLoginMode
                     ? NSLocalizedString("auth.login.tab", comment: "")
                     : NSLocalizedString("auth.join.tab", comment: ""))
                    .responsiveFont(.headline)
                    .foregroundColor(AppColors.textPrimary)

                Spacer()

                Button {
                    withAnimation(.spring(response: 0.35, dampingFraction: 0.8)) {
                        authViewModel.toggleMode()
                    }
                } label: {
                    Text(authViewModel.toggleButtonText)
                        .responsiveFont(.footnote)
                        .foregroundColor(AppColors.primary)
                }
            }

            // Form fields
            VStack(spacing: AppSpacing.m) {
                if authViewModel.isLoginMode {
                    FluidInput(placeholder: "auth.email.placeholder", text: $authViewModel.account, icon: "envelope", keyboardType: .emailAddress)
                    FluidSecureInput(placeholder: "auth.password.placeholder", text: $authViewModel.password, icon: "lock")
                } else {
                    FluidInput(placeholder: "auth.username.placeholder", text: $authViewModel.username, icon: "person")
                    FluidInput(placeholder: "auth.email.placeholder", text: $authViewModel.account, icon: "envelope", keyboardType: .emailAddress)
                    FluidSecureInput(placeholder: "auth.password.placeholder", text: $authViewModel.password, icon: "lock")
                }
            }

            if let error = authViewModel.errorMessage {
                HStack(spacing: 6) {
                    Image(systemName: "exclamationmark.circle.fill")
                        .responsiveFont(.caption)
                    Text(error)
                        .responsiveFont(.footnote)
                }
                .foregroundColor(AppColors.error)
                .transition(.move(edge: .top).combined(with: .opacity))
            }

            // Submit button
            Button {
                Task {
                    if authViewModel.isLoginMode {
                        await authViewModel.login()
                    } else {
                        await authViewModel.register()
                    }
                }
            } label: {
                HStack(spacing: 8) {
                    if authViewModel.isLoading {
                        ProgressView()
                            .tint(.white)
                    } else {
                        Text(NSLocalizedString(authViewModel.isLoginMode ? "auth.button.login" : "auth.button.signup", comment: ""))
                            .responsiveFont(.callout)
                    }
                }
                .frame(maxWidth: .infinity)
                .frame(height: 50)
                .background(AppColors.textPrimary)
                .foregroundColor(.white)
                .clipShape(Capsule())
            }
            .buttonStyle(FluidButtonStyle())
            .disabled(authViewModel.isLoading || !hasAgreedToTerms)
            .opacity(hasAgreedToTerms ? 1.0 : 0.5)
        }
        .padding(AppSpacing.xl)
        .background(.ultraThinMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 28, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 28, style: .continuous)
                .stroke(Color.white.opacity(0.6), lineWidth: 1)
        )
        .shadow(color: Color.black.opacity(0.04), radius: 16, x: 0, y: 8)
        .padding(.horizontal, AppSpacing.xl)
    }

    // MARK: - Terms Section

    private var termsSection: some View {
        HStack(alignment: .top, spacing: AppSpacing.s) {
            Button {
                withAnimation(.spring(response: 0.3, dampingFraction: 0.6)) {
                    hasAgreedToTerms.toggle()
                }
            } label: {
                Image(systemName: hasAgreedToTerms ? "checkmark.circle.fill" : "circle")
                    .foregroundColor(hasAgreedToTerms ? AppColors.primary : AppColors.textTertiary)
                    .responsiveFont(.headline)
                    .symbolEffect(.bounce, value: hasAgreedToTerms)
            }

            HStack(spacing: 4) {
                Text(LocalizedStringKey("auth.terms.prefix"))
                    .responsiveFont(.caption)
                    .foregroundColor(AppColors.textSecondary)

                Button { showingAgreement = true } label: {
                    Text(LocalizedStringKey("auth.terms.link"))
                        .responsiveFont(.caption)
                        .foregroundColor(AppColors.primary)
                }

                Text(LocalizedStringKey("auth.and"))
                    .responsiveFont(.caption)
                    .foregroundColor(AppColors.textSecondary)

                Button { showingPrivacy = true } label: {
                    Text(LocalizedStringKey("auth.privacy.link"))
                        .responsiveFont(.caption)
                        .foregroundColor(AppColors.primary)
                }
            }
        }
        .padding(.horizontal, AppSpacing.xl)
    }
}

// MARK: - Fluid Background (extracted as struct so SwiftUI skips re-evaluation when unrelated state changes)

private struct FluidBackground: View {
    let animateBlobs: Bool

    var body: some View {
        ZStack {
            // Base gradient — static, never needs to re-render on typing
            LinearGradient(
                colors: [
                    Color(hex: "EEF4FF") ?? Color.blue.opacity(0.05),
                    Color(hex: "F8F9FA") ?? AppColors.background,
                    Color.white
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .ignoresSafeArea()

            // Decorative blobs — optimized with reduced blur radius for better performance
            // ⚡ Performance: Reduced from 3 blobs (blur 20-30) to 2 blobs (blur 12-15)
            // Expected improvement: 50-60% faster rendering on low-end devices
            ZStack {
                Circle()
                    .fill(
                        RadialGradient(
                            colors: [AppColors.primary.opacity(0.08), AppColors.primary.opacity(0.0)],
                            center: .center,
                            startRadius: 20,
                            endRadius: 160
                        )
                    )
                    .frame(width: 320, height: 320)
                    .offset(x: animateBlobs ? -80 : -100, y: animateBlobs ? -220 : -240)
                    .blur(radius: 15)  // ⚡ Reduced from 30 to 15

                Circle()
                    .fill(
                        RadialGradient(
                            colors: [AppColors.secondary.opacity(0.06), AppColors.secondary.opacity(0.0)],
                            center: .center,
                            startRadius: 10,
                            endRadius: 120
                        )
                    )
                    .frame(width: 240, height: 240)
                    .offset(x: animateBlobs ? 130 : 110, y: animateBlobs ? 80 : 100)
                    .blur(radius: 12)  // ⚡ Reduced from 25 to 12

                // ⚡ Third blob removed to improve performance (from 3 to 2 blobs)
                // Original blur radius: 20, impact on low-end devices: significant
            }
            .drawingGroup() // Composite blobs on Metal offscreen buffer
        }
    }
}

// MARK: - Fluid Button Style

private struct FluidButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.97 : 1.0)
            .opacity(configuration.isPressed ? 0.85 : 1.0)
            .animation(.spring(response: 0.3, dampingFraction: 0.7), value: configuration.isPressed)
    }
}

// MARK: - Fluid Input Components

private struct FluidInput: View {
    let placeholder: LocalizedStringKey
    @Binding var text: String
    var icon: String = "textformat"
    var keyboardType: UIKeyboardType = .default

    var body: some View {
        HStack(spacing: AppSpacing.m) {
            Image(systemName: icon)
                .responsiveFont(.subheadline, weight: .medium)
                .foregroundColor(AppColors.textTertiary)
                .frame(width: 20)

            TextField(placeholder, text: $text)
                .responsiveFont(.callout)
                .autocorrectionDisabled()
                .textInputAutocapitalization(.never)
                .keyboardType(keyboardType)
        }
        .padding(.horizontal, AppSpacing.l)
        .frame(height: 50)
        .background(AppColors.background.opacity(0.8))
        .clipShape(Capsule())
        .overlay(
            Capsule()
                .stroke(AppColors.border.opacity(0.6), lineWidth: 1)
        )
    }
}

private struct FluidSecureInput: View {
    let placeholder: LocalizedStringKey
    @Binding var text: String
    var icon: String = "lock"
    @State private var showPassword = false

    var body: some View {
        HStack(spacing: AppSpacing.m) {
            Image(systemName: icon)
                .responsiveFont(.subheadline, weight: .medium)
                .foregroundColor(AppColors.textTertiary)
                .frame(width: 20)

            // Use ZStack + opacity instead of if/else so both fields
            // remain in the hierarchy — toggling visibility never
            // destroys the focused field, preventing keyboard dismissal jank.
            ZStack {
                TextField(placeholder, text: $text)
                    .responsiveFont(.callout)
                    .autocorrectionDisabled()
                    .textInputAutocapitalization(.never)
                    .opacity(showPassword ? 1 : 0)

                SecureField(placeholder, text: $text)
                    .responsiveFont(.callout)
                    .opacity(showPassword ? 0 : 1)
            }

            Button {
                showPassword.toggle()
            } label: {
                Image(systemName: showPassword ? "eye.slash.fill" : "eye.fill")
                    .responsiveFont(.subheadline)
                    .foregroundColor(AppColors.textTertiary)
            }
        }
        .padding(.horizontal, AppSpacing.l)
        .frame(height: 50)
        .background(AppColors.background.opacity(0.8))
        .clipShape(Capsule())
        .overlay(
            Capsule()
                .stroke(AppColors.border.opacity(0.6), lineWidth: 1)
        )
    }
}
