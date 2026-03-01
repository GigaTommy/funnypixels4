import SwiftUI

/// P2-4: Power Saving Toast Notification
/// Shows when auto power saving is enabled due to low battery
struct PowerSavingToast: View {
    let batteryLevel: Int

    @ObservedObject private var fontManager = FontSizeManager.shared

    var body: some View {
        HStack(spacing: AppSpacing.s) {
            // Battery icon
            Image(systemName: "battery.25")
                .font(fontManager.scaledFont(.title3))
                .foregroundColor(.yellow)

            // Message
            VStack(alignment: .leading, spacing: 4) {
                Text(NSLocalizedString("power_saving.auto_enabled", comment: "Power Saving Enabled"))
                    .font(fontManager.scaledFont(.subheadline).weight(.semibold))
                    .foregroundColor(AppColors.textPrimary)

                Text(String(format: NSLocalizedString("power_saving.low_battery", comment: "Battery low: %d%%"), batteryLevel))
                    .font(fontManager.scaledFont(.caption))
                    .foregroundColor(AppColors.textSecondary)
            }

            Spacer()

            // Battery percentage
            Text("\(batteryLevel)%")
                .font(fontManager.scaledFont(.caption).weight(.bold))
                .foregroundColor(.yellow)
        }
        .padding()
        .background(
            RoundedRectangle(cornerRadius: AppRadius.l)
                .fill(Color(uiColor: .secondarySystemGroupedBackground))
                .shadow(color: .black.opacity(0.1), radius: 10, x: 0, y: 5)
        )
        .padding(.horizontal)
    }
}

/// Power Saving Status Indicator (small badge)
struct PowerSavingIndicator: View {
    @ObservedObject private var powerManager = PowerSavingManager.shared
    @ObservedObject private var fontManager = FontSizeManager.shared

    var body: some View {
        if powerManager.isActive {
            HStack(spacing: 4) {
                Image(systemName: "leaf.fill")
                    .font(fontManager.scaledFont(.caption2))
                Text(NSLocalizedString("power_saving.mode", comment: "Power Saving"))
                    .font(fontManager.scaledFont(.caption2).weight(.medium))
            }
            .foregroundColor(.green)
            .padding(.horizontal, AppSpacing.s)
            .padding(.vertical, 4)
            .background(Color.green.opacity(0.1))
            .cornerRadius(AppRadius.s)
        }
    }
}

/// View modifier to show power saving toast
struct PowerSavingToastModifier: ViewModifier {
    @State private var showToast = false
    @State private var batteryLevel = 20
    @State private var toastTask: Task<Void, Never>?

    func body(content: Content) -> some View {
        ZStack(alignment: .top) {
            content

            if showToast {
                PowerSavingToast(batteryLevel: batteryLevel)
                    .padding(.top, 50) // Below navigation bar
                    .transition(.move(edge: .top).combined(with: .opacity))
                    .zIndex(999)
            }
        }
        .onAppear {
            // Listen for auto power saving notifications
            NotificationCenter.default.addObserver(
                forName: .showAutoPowerSavingToast,
                object: nil,
                queue: .main
            ) { notification in
                if let level = notification.userInfo?["batteryLevel"] as? Int {
                    batteryLevel = level
                    withAnimation(.spring()) {
                        showToast = true
                    }

                    // Auto-dismiss after 4 seconds
                    toastTask?.cancel()
                    toastTask = Task { @MainActor in
                        try? await Task.sleep(nanoseconds: 4_000_000_000)
                        withAnimation {
                            showToast = false
                        }
                    }
                }
            }
        }
        .onDisappear {
            toastTask?.cancel()
        }
    }
}

extension View {
    /// Show power saving toast notifications
    func powerSavingToast() -> some View {
        modifier(PowerSavingToastModifier())
    }
}

// MARK: - Preview

#Preview("Toast") {
    VStack {
        Spacer()
        PowerSavingToast(batteryLevel: 18)
        Spacer()
    }
    .background(Color(uiColor: .systemGroupedBackground))
}

#Preview("Indicator") {
    VStack(spacing: 16) {
        PowerSavingIndicator()

        Text("Other content")
    }
    .padding()
    .onAppear {
        PowerSavingManager.shared.isPowerSavingEnabled = true
    }
}
