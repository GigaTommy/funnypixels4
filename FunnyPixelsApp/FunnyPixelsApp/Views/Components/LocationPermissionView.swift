import Combine
import SwiftUI
import CoreLocation

/// Pre-education screen explaining why location permission is needed
/// Shown before the system location permission dialog
struct LocationPermissionView: View {
    @Binding var isPresented: Bool
    @ObservedObject private var locationManager = LocationManager.shared

    var body: some View {
        ZStack {
            // Background gradient — aligned with app theme
            LinearGradient(
                colors: [
                    AppColors.primary.opacity(0.08),
                    AppColors.primary.opacity(0.03),
                    Color.white
                ],
                startPoint: .top,
                endPoint: .bottom
            )
            .ignoresSafeArea()

            VStack(spacing: AppSpacing.xxl) {
                Spacer()

                // Icon
                ZStack {
                    Circle()
                        .fill(AppColors.primary.opacity(0.1))
                        .frame(width: 120, height: 120)

                    Image(systemName: "location.circle.fill")
                        .font(.system(size: 64))
                        .foregroundStyle(
                            LinearGradient(
                                colors: [AppColors.primary, AppColors.primary.opacity(0.7)],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                }

                // Title & Description
                VStack(spacing: AppSpacing.m) {
                    Text(NSLocalizedString("location.pre_edu.title", comment: ""))
                        .font(AppTypography.title1(26))
                        .foregroundColor(AppColors.textPrimary)

                    Text(NSLocalizedString("location.pre_edu.subtitle", comment: ""))
                        .font(AppTypography.subheadline())
                        .foregroundColor(AppColors.textSecondary)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, AppSpacing.xxl)
                }

                // Feature cards
                VStack(spacing: AppSpacing.l) {
                    PermissionFeatureCard(
                        icon: "figure.walk",
                        title: NSLocalizedString("location.pre_edu.feature1.title", comment: ""),
                        description: NSLocalizedString("location.pre_edu.feature1.desc", comment: "")
                    )
                    PermissionFeatureCard(
                        icon: "mappin.and.ellipse",
                        title: NSLocalizedString("location.pre_edu.feature2.title", comment: ""),
                        description: NSLocalizedString("location.pre_edu.feature2.desc", comment: "")
                    )
                    PermissionFeatureCard(
                        icon: "shield.lefthalf.filled",
                        title: NSLocalizedString("location.pre_edu.feature3.title", comment: ""),
                        description: NSLocalizedString("location.pre_edu.feature3.desc", comment: "")
                    )
                }
                .padding(.horizontal, AppSpacing.xl)

                Spacer()

                // CTA Button
                Button(action: {
                    locationManager.requestAuthorization()
                    DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
                        isPresented = false
                    }
                }) {
                    Text(NSLocalizedString("location.pre_edu.enable", comment: ""))
                        .font(AppTypography.headline())
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, AppSpacing.l)
                        .background(
                            Capsule()
                                .fill(AppColors.primary)
                        )
                        .shadow(color: AppColors.primary.opacity(0.25), radius: 8, x: 0, y: 4)
                }
                .padding(.horizontal, AppSpacing.xl)

                // Skip button
                Button(action: {
                    isPresented = false
                }) {
                    Text(NSLocalizedString("location.pre_edu.skip", comment: ""))
                        .font(AppTypography.subheadline())
                        .foregroundColor(AppColors.textSecondary)
                }
                .padding(.bottom, AppSpacing.xxl)
            }
        }
    }
}

private struct PermissionFeatureCard: View {
    let icon: String
    let title: String
    let description: String

    var body: some View {
        HStack(spacing: 14) {
            Image(systemName: icon)
                .font(.system(size: 22))
                .foregroundColor(AppColors.primary)
                .frame(width: 40, height: 40)
                .background(AppColors.primary.opacity(0.1))
                .clipShape(RoundedRectangle(cornerRadius: 10))

            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(AppTypography.headline(15))
                    .foregroundColor(AppColors.textPrimary)
                Text(description)
                    .font(AppTypography.caption(13))
                    .foregroundColor(AppColors.textSecondary)
            }

            Spacer()
        }
    }
}
