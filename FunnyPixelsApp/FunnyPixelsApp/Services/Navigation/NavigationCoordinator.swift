import Foundation
import CoreLocation

/// Global navigation coordinator that provides type-safe cross-tab navigation
/// Uses NotificationCenter under the hood for decoupled communication
@MainActor
class NavigationCoordinator {
    static let shared = NavigationCoordinator()

    private init() {}

    // MARK: - Tab Navigation

    /// Switch to a specific tab by index
    func navigateToTab(_ index: Int) {
        NotificationCenter.default.post(name: .navigateToTab, object: index)
    }

    /// Switch to map tab
    func navigateToMap() {
        NotificationCenter.default.post(name: .switchToMapTab, object: nil)
    }

    /// Navigate to map and fly to a coordinate
    func navigateToMapLocation(lat: Double, lng: Double) {
        NotificationCenter.default.post(name: .switchToMapTab, object: nil)
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
            let coordinate = CLLocationCoordinate2D(latitude: lat, longitude: lng)
            NotificationCenter.default.post(name: .navigateToMapLocation, object: coordinate)
        }
    }

    /// Navigate to daily tasks page
    func navigateToDailyTasks() {
        NotificationCenter.default.post(name: .navigateToDailyTasks, object: nil)
    }

    /// Navigate to profile tab
    func navigateToProfile() {
        NotificationCenter.default.post(name: .navigateToTab, object: 4)
    }

    /// Navigate to alliance tab
    func navigateToAlliance() {
        NotificationCenter.default.post(name: .navigateToTab, object: 2)
    }

    /// Navigate to leaderboard
    func navigateToLeaderboard() {
        NotificationCenter.default.post(name: .navigateToTab, object: 3)
    }

    /// Open checkin sheet
    func openCheckin() {
        NotificationCenter.default.post(name: .openCheckinSheet, object: nil)
    }

    /// Start GPS drawing
    func startDrawing() {
        NotificationCenter.default.post(name: .requestStartDrawing, object: nil)
    }
}

// MARK: - Notification Names

extension Notification.Name {
    /// Navigate to a specific tab (object: Int tab index)
    static let navigateToTab = Notification.Name("navigateToTab")
    /// Navigate to daily tasks page
    static let navigateToDailyTasks = Notification.Name("navigateToDailyTasks")
    /// Request to start GPS drawing
    static let requestStartDrawing = Notification.Name("requestStartDrawing")
}
