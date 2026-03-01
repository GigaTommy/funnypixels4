import SwiftUI

/// P1-2: Event Tutorial/Onboarding Flow
/// First-time user introduction to the event system
struct EventTutorialView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var currentPage = 0
    @ObservedObject private var fontManager = FontSizeManager.shared

    let pages: [TutorialPage] = [
        TutorialPage(
            icon: "flag.2.crossed.fill",
            iconColor: .purple,
            title: NSLocalizedString("tutorial.events.intro.title", comment: "Event System"),
            description: NSLocalizedString("tutorial.events.intro.description", comment: "Participate in location-based events...")
        ),
        TutorialPage(
            icon: "person.badge.plus.fill",
            iconColor: .green,
            title: NSLocalizedString("tutorial.events.signup.title", comment: "Join Events"),
            description: NSLocalizedString("tutorial.events.signup.description", comment: "Sign up for events...")
        ),
        TutorialPage(
            icon: "map.fill",
            iconColor: .blue,
            title: NSLocalizedString("tutorial.events.participate.title", comment: "How to Play"),
            description: NSLocalizedString("tutorial.events.participate.description", comment: "Draw pixels within event areas...")
        ),
        TutorialPage(
            icon: "trophy.fill",
            iconColor: .orange,
            title: NSLocalizedString("tutorial.events.rewards.title", comment: "Earn Rewards"),
            description: NSLocalizedString("tutorial.events.rewards.description", comment: "Compete for rankings and prizes...")
        )
    ]

    var body: some View {
        ZStack {
            // Background gradient
            LinearGradient(
                colors: [
                    Color(uiColor: .systemBackground),
                    AppColors.primary.opacity(0.05)
                ],
                startPoint: .top,
                endPoint: .bottom
            )
            .ignoresSafeArea()

            VStack(spacing: 0) {
                // Skip button
                HStack {
                    Spacer()
                    Button(action: {
                        dismiss()
                    }) {
                        Text(NSLocalizedString("tutorial.skip", comment: "Skip"))
                            .font(fontManager.scaledFont(.subheadline).weight(.medium))
                            .foregroundColor(AppColors.textSecondary)
                            .padding(.horizontal, 16)
                            .padding(.vertical, 8)
                    }
                }
                .padding(.horizontal)
                .padding(.top, 16)

                // Tutorial Pages
                TabView(selection: $currentPage) {
                    ForEach(Array(pages.enumerated()), id: \.offset) { index, page in
                        TutorialPageView(page: page)
                            .tag(index)
                    }
                }
                .tabViewStyle(.page(indexDisplayMode: .never))  // 隐藏系统分页指示器，使用下方自定义指示器

                // Bottom Action Button
                VStack(spacing: AppSpacing.m) {
                    // Page Indicator (manual, for customization)
                    HStack(spacing: 8) {
                        ForEach(0..<pages.count, id: \.self) { index in
                            Circle()
                                .fill(currentPage == index ? AppColors.primary : AppColors.textTertiary)
                                .frame(width: 8, height: 8)
                                .scaleEffect(currentPage == index ? 1.2 : 1.0)
                                .animation(.spring(response: 0.3, dampingFraction: 0.7), value: currentPage)
                        }
                    }
                    .padding(.bottom, 8)

                    // Action Button
                    if currentPage == pages.count - 1 {
                        // Last page: Get Started button
                        Button(action: {
                            dismiss()
                        }) {
                            HStack {
                                Text(NSLocalizedString("tutorial.get_started", comment: "Get Started"))
                                    .font(fontManager.scaledFont(.headline).weight(.semibold))
                                Image(systemName: "arrow.right")
                                    .font(fontManager.scaledFont(.headline).weight(.semibold))
                            }
                            .foregroundColor(.white)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 16)
                            .background(
                                LinearGradient(
                                    colors: [AppColors.primary, AppColors.primary.opacity(0.8)],
                                    startPoint: .leading,
                                    endPoint: .trailing
                                )
                            )
                            .cornerRadius(AppRadius.l)
                        }
                        .transition(.scale.combined(with: .opacity))
                    } else {
                        // Other pages: Next button
                        Button(action: {
                            withAnimation {
                                currentPage += 1
                            }
                        }) {
                            HStack {
                                Text(NSLocalizedString("tutorial.next", comment: "Next"))
                                    .font(fontManager.scaledFont(.headline).weight(.medium))
                                Image(systemName: "arrow.right")
                                    .font(fontManager.scaledFont(.headline).weight(.medium))
                            }
                            .foregroundColor(AppColors.primary)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 16)
                            .background(AppColors.primary.opacity(0.1))
                            .cornerRadius(AppRadius.l)
                        }
                    }
                }
                .padding(.horizontal, 24)
                .padding(.bottom, 32)
            }
        }
    }
}

// MARK: - Tutorial Page Model

struct TutorialPage {
    let icon: String
    let iconColor: Color
    let title: String
    let description: String
}

// MARK: - Single Page View

struct TutorialPageView: View {
    let page: TutorialPage
    @ObservedObject private var fontManager = FontSizeManager.shared

    var body: some View {
        VStack(spacing: AppSpacing.xl) {
            Spacer()

            // Icon
            ZStack {
                Circle()
                    .fill(
                        LinearGradient(
                            colors: [page.iconColor.opacity(0.2), page.iconColor.opacity(0.05)],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .frame(width: 140, height: 140)

                Image(systemName: page.icon)
                    .font(.system(size: 64, weight: .semibold))
                    .foregroundColor(page.iconColor)
            }
            .padding(.bottom, AppSpacing.l)

            // Title
            Text(page.title)
                .font(fontManager.scaledFont(.title).weight(.bold))
                .foregroundColor(AppColors.textPrimary)
                .multilineTextAlignment(.center)
                .padding(.horizontal)

            // Description
            Text(page.description)
                .font(fontManager.scaledFont(.body))
                .foregroundColor(AppColors.textSecondary)
                .multilineTextAlignment(.center)
                .lineSpacing(4)
                .padding(.horizontal, 32)
                .fixedSize(horizontal: false, vertical: true)

            Spacer()
        }
    }
}

// MARK: - Preview

#Preview {
    EventTutorialView()
}
