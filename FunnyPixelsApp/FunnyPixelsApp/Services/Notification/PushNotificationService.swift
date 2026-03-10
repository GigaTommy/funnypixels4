import Foundation
import Combine
import UserNotifications
import UIKit

/// Manages push notification registration and handling
class PushNotificationService: NSObject, ObservableObject {
    static let shared = PushNotificationService()

    @Published var isRegistered = false
    @Published var deviceToken: String?

    private override init() {
        super.init()
    }

    // MARK: - Registration

    /// Request notification permission and register for remote notifications
    func requestPermissionAndRegister() {
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .badge, .sound]) { granted, error in
            if let error = error {
                Logger.error("Push notification permission error: \(error)")
                return
            }

            if granted {
                DispatchQueue.main.async {
                    UIApplication.shared.registerForRemoteNotifications()
                }
                Logger.info("Push notification permission granted")
            } else {
                Logger.info("Push notification permission denied")
            }
        }
    }

    /// Called when APNs returns a device token
    func didRegisterForRemoteNotifications(deviceToken data: Data) {
        // ✅ FIXED: Changed from "%02.2hhx" to "%02x" (2026-03-10)
        let token = data.map { String(format: "%02x", $0) }.joined()
        self.deviceToken = token
        self.isRegistered = true
        Logger.info("✅ [NEW CODE] Device token (\(token.count) chars): \(token)")

        // Send to backend
        Task {
            await registerTokenWithBackend(token: token)
        }
    }

    /// Called when APNs registration fails
    func didFailToRegisterForRemoteNotifications(error: Error) {
        Logger.error("Failed to register for push notifications: \(error)")
    }

    // MARK: - Backend Registration

    private func registerTokenWithBackend(token: String) async {
        do {
            let _: TokenResponse = try await APIManager.shared.post(
                "/push-notifications/register",
                parameters: ["deviceToken": token, "platform": "ios"]
            )
            Logger.info("Device token registered with backend")
        } catch {
            Logger.error("Failed to register device token with backend: \(error)")
        }
    }

    /// Unregister token when user signs out
    func unregisterToken() async {
        guard let token = deviceToken else { return }
        do {
            let _: TokenResponse = try await APIManager.shared.delete(
                "/push-notifications/unregister",
                parameters: ["deviceToken": token]
            )
            Logger.info("Device token unregistered from backend")
        } catch {
            Logger.error("Failed to unregister device token: \(error)")
        }
        deviceToken = nil
        isRegistered = false
    }

    // MARK: - Notification Handling

    /// Handle received notification when app is in foreground
    func handleForegroundNotification(_ notification: UNNotification) {
        let userInfo = notification.request.content.userInfo
        Logger.info("Foreground notification: \(userInfo)")
    }

    /// Handle notification tap (app opened from notification)
    func handleNotificationTap(_ response: UNNotificationResponse) {
        let userInfo = response.notification.request.content.userInfo

        if let type = userInfo["type"] as? String {
            switch type {
            case "streak_reminder":
                NotificationCenter.default.post(name: .openCheckinSheet, object: nil)
            case "challenge_reminder":
                NotificationCenter.default.post(name: .openChallengeView, object: nil)
            case "event_reminder":
                if let eventId = userInfo["eventId"] as? String {
                    NotificationCenter.default.post(name: .openEventDetail, object: eventId)
                }
            case "bottle_sunk":
                Task { @MainActor in
                    DriftBottleManager.shared.handleBottleSunk(data: userInfo as? [String: Any] ?? [:])
                }
            case "bottle_earned":
                Task { @MainActor in
                    await DriftBottleManager.shared.refreshQuota()
                }
            default:
                break
            }
        }
    }

    private struct TokenResponse: Codable {
        let success: Bool
        let message: String?
    }
}

// MARK: - UNUserNotificationCenterDelegate
extension PushNotificationService: UNUserNotificationCenterDelegate {
    func userNotificationCenter(_ center: UNUserNotificationCenter,
                                willPresent notification: UNNotification,
                                withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
        handleForegroundNotification(notification)
        completionHandler([.banner, .badge, .sound])
    }

    func userNotificationCenter(_ center: UNUserNotificationCenter,
                                didReceive response: UNNotificationResponse,
                                withCompletionHandler completionHandler: @escaping () -> Void) {
        handleNotificationTap(response)
        completionHandler()
    }
}

// MARK: - Notification Names
extension Notification.Name {
    static let openCheckinSheet = Notification.Name("openCheckinSheet")
    static let openChallengeView = Notification.Name("openChallengeView")
    static let openEventDetail = Notification.Name("openEventDetail")
}
