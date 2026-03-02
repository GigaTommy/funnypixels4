import Foundation
import Combine

/// Service for fetching and managing map notifications
@MainActor
class MapNotificationService: ObservableObject {
    @Published var activeNotifications: [MapNotification] = []
    @Published var isLoading = false
    @Published var error: Error?

    private var refreshTimer: Timer?
    private var dismissedIds: Set<Int> = []

    static let shared = MapNotificationService()

    private init() {
        startAutoRefresh()
    }

    nonisolated deinit {
        Task { @MainActor [weak self] in
            self?.stopAutoRefresh()
        }
    }

    /// Fetch active notifications from server
    func fetchNotifications() async {
        isLoading = true
        defer { isLoading = false }

        do {
            let response: MapNotificationsResponse = try await APIManager.shared.get(
                "/map-notifications"
            )

            // Filter out dismissed notifications
            activeNotifications = response.data.notifications.filter { notification in
                !dismissedIds.contains(notification.id)
            }

            error = nil
        } catch {
            print("❌ Failed to fetch map notifications: \(error)")
            self.error = error
        }
    }

    /// Dismiss a notification
    func dismiss(_ notification: MapNotification) async {
        // Remove from local list immediately
        dismissedIds.insert(notification.id)
        activeNotifications.removeAll { $0.id == notification.id }

        // Notify server (fire and forget)
        do {
            let _: EmptyResponse = try await APIManager.shared.post(
                "/map-notifications/\(notification.id)/dismiss"
            )
        } catch {
            print("⚠️ Failed to dismiss notification on server: \(error)")
            // Don't revert local state - user intent is to dismiss
        }
    }

    /// Start auto-refresh timer (every 30 seconds)
    func startAutoRefresh() {
        stopAutoRefresh()

        // Initial fetch
        Task {
            await fetchNotifications()
        }

        // Refresh every 30 seconds
        refreshTimer = Timer.scheduledTimer(withTimeInterval: 30, repeats: true) { [weak self] _ in
            Task { @MainActor in
                await self?.fetchNotifications()
            }
        }
    }

    /// Stop auto-refresh timer
    func stopAutoRefresh() {
        refreshTimer?.invalidate()
        refreshTimer = nil
    }
}

/// Empty response for dismiss endpoint
struct EmptyResponse: Codable {
    let success: Bool
}
