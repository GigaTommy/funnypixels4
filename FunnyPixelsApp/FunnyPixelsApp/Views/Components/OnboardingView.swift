import SwiftUI

/// Onboarding slides shown on first launch
struct OnboardingView: View {
    @Binding var isPresented: Bool
    @State private var currentPage = 0

    struct OnboardingPage {
        let image: String
        let title: String
        let description: String
    }

    let pages = [
        OnboardingPage(
            image: "onboarding_map_explore",
            title: NSLocalizedString("onboarding.title.explore", comment: ""),
            description: NSLocalizedString("onboarding.desc.explore", comment: "")
        ),
        OnboardingPage(
            image: "onboarding_drawing_mode",
            title: NSLocalizedString("onboarding.title.gps", comment: ""),
            description: NSLocalizedString("onboarding.desc.gps", comment: "")
        ),
        OnboardingPage(
            image: "onboarding_alliance_war",
            title: NSLocalizedString("onboarding.title.alliance", comment: ""),
            description: NSLocalizedString("onboarding.desc.alliance", comment: "")
        )
    ]

    var body: some View {
        ZStack {
            // Background — consistent with app theme
            AppColors.background.ignoresSafeArea()

            VStack {
                // Skip button
                HStack {
                    Spacer()
                    Button(NSLocalizedString("onboarding.skip", comment: "")) {
                        completeOnboarding()
                    }
                    .font(AppTypography.subheadline())
                    .foregroundColor(AppColors.textSecondary)
                    .padding()
                }

                // Paged content
                TabView(selection: $currentPage) {
                    ForEach(0..<pages.count, id: \.self) { index in
                        VStack(spacing: 30) {
                            Image(pages[index].image)
                                .resizable()
                                .scaledToFit()
                                .frame(height: 400)
                                .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
                                .shadow(color: .black.opacity(0.08), radius: 10, x: 0, y: 5)
                                .padding(.horizontal)
                                .padding(.top, 20)

                            VStack(spacing: AppSpacing.l) {
                                Text(pages[index].title)
                                    .font(AppTypography.title1(28))
                                    .foregroundColor(AppColors.textPrimary)

                                Text(pages[index].description)
                                    .font(AppTypography.body())
                                    .multilineTextAlignment(.center)
                                    .foregroundColor(AppColors.textSecondary)
                                    .padding(.horizontal, AppSpacing.xxl)
                                    .lineSpacing(4)
                            }

                            Spacer()
                        }
                        .tag(index)
                    }
                }
                .tabViewStyle(.page(indexDisplayMode: .always))
                .indexViewStyle(.page(backgroundDisplayMode: .always))

                // Bottom button — consistent brand blue
                VStack(spacing: 20) {
                    Button(action: {
                        if currentPage < pages.count - 1 {
                            withAnimation {
                                currentPage += 1
                            }
                        } else {
                            completeOnboarding()
                        }
                    }) {
                        Text(currentPage == pages.count - 1
                             ? NSLocalizedString("onboarding.start", comment: "")
                             : NSLocalizedString("onboarding.next", comment: ""))
                            .font(AppTypography.headline())
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
                }
                .padding(.bottom, 50)
            }
        }
    }

    private func completeOnboarding() {
        withAnimation {
            isPresented = false
        }
    }
}

/// Consistent press feedback
private struct OnboardingButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.97 : 1.0)
            .opacity(configuration.isPressed ? 0.9 : 1.0)
            .animation(.spring(response: 0.3, dampingFraction: 0.7), value: configuration.isPressed)
    }
}

#Preview {
    OnboardingView(isPresented: .constant(true))
}
