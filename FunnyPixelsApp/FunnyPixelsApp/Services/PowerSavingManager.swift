import Foundation
import UIKit
import Combine

/// P2-4: Power Saving Manager
/// Monitors battery level and manages power saving mode
class PowerSavingManager: ObservableObject {
    static let shared = PowerSavingManager()

    // User preference for power saving mode
    @Published var isPowerSavingEnabled: Bool {
        didSet {
            UserDefaults.standard.set(isPowerSavingEnabled, forKey: "eventPowerSavingMode")
            Logger.info("⚡ Power saving mode: \(isPowerSavingEnabled ? "enabled" : "disabled")")

            // Notify observers
            NotificationCenter.default.post(name: .powerSavingModeChanged, object: nil)
        }
    }

    // Auto power saving (triggered by low battery)
    @Published private(set) var isAutoPowerSavingActive: Bool = false

    // Current battery level (0.0 - 1.0)
    @Published private(set) var batteryLevel: Float = 1.0

    // Battery state
    @Published private(set) var batteryState: UIDevice.BatteryState = .unknown

    private var batteryLevelObserver: NSObjectProtocol?
    private var batteryStateObserver: NSObjectProtocol?

    private init() {
        // Load user preference
        self.isPowerSavingEnabled = UserDefaults.standard.bool(forKey: "eventPowerSavingMode")

        // Enable battery monitoring
        UIDevice.current.isBatteryMonitoringEnabled = true

        // Get initial battery state
        self.batteryLevel = UIDevice.current.batteryLevel
        self.batteryState = UIDevice.current.batteryState

        // Start monitoring
        startBatteryMonitoring()

        Logger.info("⚡ PowerSavingManager initialized - Battery: \(Int(batteryLevel * 100))%")
    }

    deinit {
        stopBatteryMonitoring()
    }

    // MARK: - Battery Monitoring

    private func startBatteryMonitoring() {
        // Monitor battery level changes
        batteryLevelObserver = NotificationCenter.default.addObserver(
            forName: UIDevice.batteryLevelDidChangeNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            self?.updateBatteryLevel()
        }

        // Monitor battery state changes
        batteryStateObserver = NotificationCenter.default.addObserver(
            forName: UIDevice.batteryStateDidChangeNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            self?.updateBatteryState()
        }
    }

    private func stopBatteryMonitoring() {
        if let observer = batteryLevelObserver {
            NotificationCenter.default.removeObserver(observer)
        }
        if let observer = batteryStateObserver {
            NotificationCenter.default.removeObserver(observer)
        }
    }

    private func updateBatteryLevel() {
        batteryLevel = UIDevice.current.batteryLevel

        Logger.info("🔋 Battery level: \(Int(batteryLevel * 100))%")

        // Auto-enable power saving if battery is low
        if batteryLevel > 0 && batteryLevel <= 0.20 && !isAutoPowerSavingActive {
            enableAutoPowerSaving()
        } else if batteryLevel > 0.30 && isAutoPowerSavingActive {
            // Disable auto power saving when battery is back to normal
            disableAutoPowerSaving()
        }
    }

    private func updateBatteryState() {
        batteryState = UIDevice.current.batteryState

        let stateText: String
        switch batteryState {
        case .unplugged:
            stateText = "unplugged"
        case .charging:
            stateText = "charging"
        case .full:
            stateText = "full"
        case .unknown:
            stateText = "unknown"
        @unknown default:
            stateText = "unknown"
        }

        Logger.info("🔌 Battery state: \(stateText)")
    }

    // MARK: - Auto Power Saving

    private func enableAutoPowerSaving() {
        isAutoPowerSavingActive = true

        Logger.info("⚡ Auto power saving enabled (battery low: \(Int(batteryLevel * 100))%)")

        // Show toast notification
        Task { @MainActor in
            // Post notification to show toast
            NotificationCenter.default.post(
                name: .showAutoPowerSavingToast,
                object: nil,
                userInfo: ["batteryLevel": Int(batteryLevel * 100)]
            )
        }

        // Also notify power saving mode change
        NotificationCenter.default.post(name: .powerSavingModeChanged, object: nil)
    }

    private func disableAutoPowerSaving() {
        isAutoPowerSavingActive = false

        Logger.info("⚡ Auto power saving disabled (battery recovered: \(Int(batteryLevel * 100))%)")

        NotificationCenter.default.post(name: .powerSavingModeChanged, object: nil)
    }

    // MARK: - Power Saving Status

    /// Check if power saving is currently active (either manual or auto)
    var isActive: Bool {
        return isPowerSavingEnabled || isAutoPowerSavingActive
    }

    /// Get polling interval based on power saving mode
    func getPollingInterval(defaultInterval: TimeInterval) -> TimeInterval {
        return isActive ? defaultInterval * 2 : defaultInterval
    }

    /// Get geofence check interval based on power saving mode
    func getGeofenceInterval(defaultInterval: TimeInterval) -> TimeInterval {
        return isActive ? defaultInterval * 2 : defaultInterval
    }

    /// Should reduce socket message frequency
    var shouldReduceSocketFrequency: Bool {
        return isActive
    }
}

// MARK: - Notifications

extension Notification.Name {
    static let powerSavingModeChanged = Notification.Name("powerSavingModeChanged")
    static let showAutoPowerSavingToast = Notification.Name("showAutoPowerSavingToast")
}
