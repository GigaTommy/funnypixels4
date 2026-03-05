import SwiftUI

/// Activity/Event notification banner for map screen
/// Displays notifications in a priority queue with auto-rotation
struct ActivityBanner: View {
    @StateObject private var notificationService = MapNotificationService.shared
    @State private var currentIndex = 0
    @State private var rotationTimer: Timer?
    @State private var showBanner = true
    @ObservedObject private var fontManager = FontSizeManager.shared

    let onNavigate: (MapNotification.Location) -> Void

    var body: some View {
        if showBanner, !notificationService.activeNotifications.isEmpty {
            VStack(spacing: 0) {
                notificationCard
                    .transition(.move(edge: .top).combined(with: .opacity))
            }
            .onAppear {
                startRotation()
            }
            .onDisappear {
                stopRotation()
            }
        }
    }

    private var currentNotification: MapNotification? {
        guard !notificationService.activeNotifications.isEmpty,
              currentIndex < notificationService.activeNotifications.count else {
            return nil
        }
        return notificationService.activeNotifications[currentIndex]
    }

    private var notificationCard: some View {
        Group {
            if let notification = currentNotification {
                HStack(spacing: 12) {
                    // Icon
                    Image(systemName: notification.type.iconName)
                        .responsiveFont(.headline, weight: .semibold)
                        .foregroundColor(.white)
                        .frame(width: 24, height: 24)

                    // Content
                    VStack(alignment: .leading, spacing: 2) {
                        HStack(spacing: 6) {
                            Text(notification.title)
                                .responsiveFont(.subheadline, weight: .semibold)
                                .foregroundColor(.white)

                            if let timeString = notification.formattedTime {
                                Text("剩余 \(timeString)")
                                    .responsiveFont(.caption2, weight: .medium)
                                    .foregroundColor(.white.opacity(0.9))
                            }
                        }

                        Text(notification.message)
                            .responsiveFont(.caption)
                            .foregroundColor(.white.opacity(0.95))
                            .lineLimit(1)
                    }

                    Spacer()

                    // Action buttons
                    HStack(spacing: 8) {
                        if notification.targetLocation != nil {
                            Button(action: {
                                if let location = notification.targetLocation {
                                    onNavigate(location)
                                }
                            }) {
                                Text("查看")
                                    .responsiveFont(.caption, weight: .medium)
                                    .foregroundColor(.white)
                                    .padding(.horizontal, 12)
                                    .padding(.vertical, 6)
                                    .background(Color.white.opacity(0.2))
                                    .cornerRadius(12)
                            }
                        }

                        Button(action: {
                            dismissCurrentNotification()
                        }) {
                            Image(systemName: "xmark")
                                .responsiveFont(.caption2, weight: .semibold)
                                .foregroundColor(.white.opacity(0.8))
                                .frame(width: 24, height: 24)
                        }
                    }
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 12)
                .frame(height: 56)
                .background(
                    LinearGradient(
                        colors: notification.type.gradientColors,
                        startPoint: .leading,
                        endPoint: .trailing
                    )
                )
                .cornerRadius(0) // Full width banner
                .shadow(color: .black.opacity(0.1), radius: 4, y: 2)
            }
        }
    }

    // MARK: - Rotation Logic

    private func startRotation() {
        guard notificationService.activeNotifications.count > 1 else { return }

        rotationTimer = Timer.scheduledTimer(withTimeInterval: 5.0, repeats: true) { [weak notificationService] _ in
            guard let notificationService = notificationService else { return }
            Task { @MainActor in
                withAnimation(.easeInOut(duration: 0.3)) {
                    currentIndex = (currentIndex + 1) % notificationService.activeNotifications.count
                }
            }
        }
    }

    private func stopRotation() {
        rotationTimer?.invalidate()
        rotationTimer = nil
    }

    private func dismissCurrentNotification() {
        guard let notification = currentNotification else { return }

        Task {
            await notificationService.dismiss(notification)

            // Update index if needed
            if currentIndex >= notificationService.activeNotifications.count {
                currentIndex = max(0, notificationService.activeNotifications.count - 1)
            }

            // Hide banner if no more notifications
            if notificationService.activeNotifications.isEmpty {
                withAnimation {
                    showBanner = false
                }
            }
        }
    }
}

// MARK: - Preview

struct ActivityBanner_Previews: PreviewProvider {
    static var previews: some View {
        VStack {
            ActivityBanner(onNavigate: { _ in })

            Spacer()
        }
        .onAppear {
            // Mock notifications for preview
            Task { @MainActor in
                MapNotificationService.shared.activeNotifications = [
                    MapNotification(
                        id: 1,
                        type: .regionChallenge,
                        title: "限时活动",
                        message: "「春节争霸」进行中",
                        priority: 3,
                        remainingSeconds: 155,
                        targetLocation: MapNotification.Location(lat: 39.9042, lng: 116.4074),
                    ),
                    MapNotification(
                        id: 2,
                        type: .allianceWar,
                        title: "领地警报",
                        message: "XX联盟正在入侵「朝阳区」",
                        priority: 4,
                        remainingSeconds: nil,
                        targetLocation: MapNotification.Location(lat: 39.9042, lng: 116.4074),
                    ),
                    MapNotification(
                        id: 3,
                        type: .treasureRefresh,
                        title: "宝箱刷新",
                        message: "朝阳区出现了5个宝箱",
                        priority: 2,
                        remainingSeconds: 3600,
                        targetLocation: MapNotification.Location(lat: 39.9042, lng: 116.4074),
                    )
                ]
            }
        }
    }
}
