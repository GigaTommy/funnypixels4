import Combine
import SwiftUI

/// P2-3: Offline Mode Banner
/// Displays when the app is showing cached data due to network issues
struct OfflineBanner: View {
    let onRetry: () -> Void

    @ObservedObject private var fontManager = FontSizeManager.shared
    @State private var isVisible = true

    var body: some View {
        if isVisible {
            HStack(spacing: AppSpacing.s) {
                // Warning icon
                Image(systemName: "wifi.slash")
                    .font(fontManager.scaledFont(.subheadline))
                    .foregroundColor(.white)

                // Message
                VStack(alignment: .leading, spacing: 2) {
                    Text(NSLocalizedString("offline.mode", comment: "Offline Mode"))
                        .font(fontManager.scaledFont(.caption).weight(.semibold))
                        .foregroundColor(.white)

                    Text(NSLocalizedString("offline.showing_cached_data", comment: "Showing cached data"))
                        .font(fontManager.scaledFont(.caption2))
                        .foregroundColor(.white.opacity(0.9))
                }

                Spacer()

                // Retry button
                Button(action: {
                    HapticManager.shared.impact(style: .light)
                    onRetry()
                }) {
                    HStack(spacing: 4) {
                        Image(systemName: "arrow.clockwise")
                            .font(fontManager.scaledFont(.caption2))
                        Text(NSLocalizedString("common.retry", comment: "Retry"))
                            .font(fontManager.scaledFont(.caption2).weight(.medium))
                    }
                    .foregroundColor(.white)
                    .padding(.horizontal, AppSpacing.s)
                    .padding(.vertical, 6)
                    .background(Color.white.opacity(0.2))
                    .cornerRadius(AppRadius.s)
                }

                // Dismiss button
                Button(action: {
                    withAnimation {
                        isVisible = false
                    }
                }) {
                    Image(systemName: "xmark")
                        .font(fontManager.scaledFont(.caption2))
                        .foregroundColor(.white.opacity(0.7))
                }
            }
            .padding(.horizontal, AppSpacing.m)
            .padding(.vertical, AppSpacing.s)
            .background(
                LinearGradient(
                    colors: [Color.orange, Color.orange.opacity(0.8)],
                    startPoint: .leading,
                    endPoint: .trailing
                )
            )
            .transition(.move(edge: .top).combined(with: .opacity))
        }
    }
}

/// View modifier to show offline banner
struct OfflineBannerModifier: ViewModifier {
    let isOffline: Bool
    let onRetry: () -> Void

    func body(content: Content) -> some View {
        VStack(spacing: 0) {
            if isOffline {
                OfflineBanner(onRetry: onRetry)
            }

            content
        }
    }
}

extension View {
    /// Show offline banner when in offline mode
    func offlineBanner(isOffline: Bool, onRetry: @escaping () -> Void) -> some View {
        modifier(OfflineBannerModifier(isOffline: isOffline, onRetry: onRetry))
    }
}

// MARK: - Preview

#Preview {
    VStack {
        OfflineBanner(onRetry: {
            print("Retry tapped")
        })

        Spacer()

        Text("Main Content")
            .font(.title)

        Spacer()
    }
    .background(Color(uiColor: .systemGroupedBackground))
}
