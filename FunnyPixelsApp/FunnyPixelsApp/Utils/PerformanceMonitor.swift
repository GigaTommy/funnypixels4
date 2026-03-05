//
//  PerformanceMonitor.swift
//  FunnyPixelsApp
//
//  Performance monitoring for app startup and critical operations
//  Tracks milestones and reports performance metrics
//

import Foundation
import UIKit

/// Performance monitoring for app startup and critical operations
@MainActor
class PerformanceMonitor {
    static let shared = PerformanceMonitor()

    private var startupTimestamp: Date?
    private var milestones: [String: TimeInterval] = [:]
    private var customMetrics: [String: Double] = [:]

    private init() {}

    // MARK: - Startup Performance

    /// Mark the beginning of app startup
    func markAppStartup() {
        startupTimestamp = Date()
        Logger.info("📊 [Performance] App startup marked at \(startupTimestamp!)")
    }

    /// Mark a milestone in the startup process
    func markMilestone(_ name: String) {
        guard let start = startupTimestamp else {
            Logger.warning("📊 [Performance] Cannot mark milestone '\(name)' - startup not marked")
            return
        }

        let elapsed = Date().timeIntervalSince(start)
        milestones[name] = elapsed

        let elapsedMs = Int(elapsed * 1000)
        Logger.info("📊 [Performance] \(name): \(elapsedMs)ms")
    }

    /// Report complete startup performance metrics
    func reportStartupPerformance() {
        guard let start = startupTimestamp else {
            Logger.warning("📊 [Performance] Cannot report - startup not marked")
            return
        }

        let total = Date().timeIntervalSince(start)
        let totalMs = Int(total * 1000)

        var report = """
        📊 [Performance] Startup Report (Total: \(totalMs)ms)
        ================================================
        """

        // Sort milestones by time
        let sortedMilestones = milestones.sorted { $0.value < $1.value }

        for (name, elapsed) in sortedMilestones {
            let ms = Int(elapsed * 1000)
            report += "\n  • \(name): \(ms)ms"
        }

        // Add custom metrics if any
        if !customMetrics.isEmpty {
            report += "\n\nCustom Metrics:"
            for (name, value) in customMetrics.sorted(by: { $0.key < $1.key }) {
                report += "\n  • \(name): \(value)"
            }
        }

        report += "\n================================================"
        Logger.info(report)

        // ⚡ Upload to backend (if user enabled)
        uploadStartupMetrics(milestones: sortedMilestones, total: total)
    }

    /// Reset all performance tracking
    func reset() {
        startupTimestamp = nil
        milestones.removeAll()
        customMetrics.removeAll()
        Logger.info("📊 [Performance] Monitor reset")
    }

    // MARK: - Custom Metrics

    /// Record a custom metric
    func recordMetric(_ name: String, value: Double) {
        customMetrics[name] = value
        Logger.info("📊 [Performance] Metric '\(name)': \(value)")
    }

    /// Get the elapsed time since a milestone
    func getElapsedTime(since milestone: String) -> TimeInterval? {
        return milestones[milestone]
    }

    // MARK: - Network Performance

    /// Track network request performance
    func trackNetworkRequest(
        endpoint: String,
        method: String,
        duration: TimeInterval,
        statusCode: Int,
        success: Bool
    ) {
        let durationMs = Int(duration * 1000)
        Logger.info("""
        📊 [Performance] Network Request:
          Endpoint: \(endpoint)
          Method: \(method)
          Duration: \(durationMs)ms
          Status: \(statusCode)
          Success: \(success)
        """)

        // TODO: Send to analytics platform
    }

    // MARK: - View Performance

    /// Track view rendering performance
    func trackViewRender(viewName: String, duration: TimeInterval) {
        let durationMs = Int(duration * 1000)
        Logger.info("📊 [Performance] View '\(viewName)' rendered in \(durationMs)ms")

        // TODO: Send to analytics platform
    }

    // MARK: - Memory Performance

    /// Get current memory usage
    func getCurrentMemoryUsage() -> UInt64 {
        var taskInfo = mach_task_basic_info()
        var count = mach_msg_type_number_t(MemoryLayout<mach_task_basic_info>.size) / 4
        let kerr: kern_return_t = withUnsafeMutablePointer(to: &taskInfo) {
            $0.withMemoryRebound(to: integer_t.self, capacity: 1) {
                task_info(
                    mach_task_self_,
                    task_flavor_t(MACH_TASK_BASIC_INFO),
                    $0,
                    &count
                )
            }
        }

        guard kerr == KERN_SUCCESS else {
            return 0
        }

        return taskInfo.resident_size
    }

    /// Log current memory usage
    func logMemoryUsage(label: String = "") {
        let memoryMB = Double(getCurrentMemoryUsage()) / 1024.0 / 1024.0
        let labelText = label.isEmpty ? "" : " [\(label)]"
        Logger.info("📊 [Performance] Memory Usage\(labelText): \(String(format: "%.2f", memoryMB)) MB")
    }
}

// MARK: - Convenience Extensions

extension PerformanceMonitor {
    /// Measure the execution time of an async operation
    func measure<T>(
        _ operationName: String,
        operation: () async throws -> T
    ) async rethrows -> T {
        let start = Date()
        let result = try await operation()
        let duration = Date().timeIntervalSince(start)
        let durationMs = Int(duration * 1000)

        Logger.info("📊 [Performance] '\(operationName)' completed in \(durationMs)ms")

        return result
    }

    /// Measure the execution time of a synchronous operation
    func measureSync<T>(
        _ operationName: String,
        operation: () throws -> T
    ) rethrows -> T {
        let start = Date()
        let result = try operation()
        let duration = Date().timeIntervalSince(start)
        let durationMs = Int(duration * 1000)

        Logger.info("📊 [Performance] '\(operationName)' completed in \(durationMs)ms")

        return result
    }
}

// MARK: - Performance Benchmarking

extension PerformanceMonitor {
    /// Benchmark a repeatable operation
    func benchmark(
        _ operationName: String,
        iterations: Int = 10,
        operation: () -> Void
    ) {
        var times: [TimeInterval] = []

        for _ in 0..<iterations {
            let start = Date()
            operation()
            let duration = Date().timeIntervalSince(start)
            times.append(duration)
        }

        let average = times.reduce(0, +) / Double(times.count)
        let min = times.min() ?? 0
        let max = times.max() ?? 0

        Logger.info("""
        📊 [Performance] Benchmark '\(operationName)' (\(iterations) iterations):
          Average: \(Int(average * 1000))ms
          Min: \(Int(min * 1000))ms
          Max: \(Int(max * 1000))ms
        """)
    }
}

// MARK: - Backend Reporting

extension PerformanceMonitor {
    /// Upload startup metrics to backend
    private func uploadStartupMetrics(milestones: [(key: String, value: TimeInterval)], total: TimeInterval) {
        // Check if user enabled performance monitoring
        guard UserDefaults.standard.bool(forKey: "performance_monitoring_enabled") else {
            Logger.info("📊 [Performance] Upload skipped - user disabled monitoring")
            return
        }

        // Only upload on WiFi to save data
        guard NetworkMonitor.shared.connectionType == .wifi else {
            Logger.info("📊 [Performance] Upload skipped - not on WiFi")
            return
        }

        Task {
            do {
                // Build anonymous report as dictionary
                let parameters: [String: Any] = [
                    "report_type": "startup",
                    "device_model": getDeviceModel(),
                    "os_version": UIDevice.current.systemVersion,
                    "app_version": AppConfig.appVersion,
                    "build_number": AppConfig.buildNumber,
                    "total_duration": total,
                    "milestones": Dictionary(uniqueKeysWithValues: milestones),
                    "custom_metrics": customMetrics,
                    "memory_usage": Double(getCurrentMemoryUsage()) / 1024.0 / 1024.0,
                    "timestamp": ISO8601DateFormatter().string(from: Date())
                ]

                // Upload to backend
                let _: EmptyResponse = try await APIManager.shared.request(
                    endpoint: .clientPerformance,
                    parameters: parameters
                )

                Logger.info("📊 [Performance] Successfully uploaded startup metrics")
            } catch {
                Logger.error("📊 [Performance] Failed to upload metrics: \(error)")
            }
        }
    }

    /// Upload custom event metrics to backend
    func uploadEventMetrics(eventType: String, metrics: [String: Double]) {
        // Check if user enabled performance monitoring
        guard UserDefaults.standard.bool(forKey: "performance_monitoring_enabled") else {
            return
        }

        // Only upload on WiFi
        guard NetworkMonitor.shared.connectionType == .wifi else {
            return
        }

        Task {
            do {
                let parameters: [String: Any] = [
                    "report_type": eventType,
                    "device_model": getDeviceModel(),
                    "os_version": UIDevice.current.systemVersion,
                    "app_version": AppConfig.appVersion,
                    "build_number": AppConfig.buildNumber,
                    "total_duration": 0,
                    "milestones": [:],
                    "custom_metrics": metrics,
                    "memory_usage": Double(getCurrentMemoryUsage()) / 1024.0 / 1024.0,
                    "timestamp": ISO8601DateFormatter().string(from: Date())
                ]

                let _: EmptyResponse = try await APIManager.shared.request(
                    endpoint: .clientPerformance,
                    parameters: parameters
                )

                Logger.info("📊 [Performance] Uploaded \(eventType) metrics")
            } catch {
                Logger.error("📊 [Performance] Failed to upload \(eventType) metrics: \(error)")
            }
        }
    }

    /// Get device model identifier
    private func getDeviceModel() -> String {
        var systemInfo = utsname()
        uname(&systemInfo)
        let machineMirror = Mirror(reflecting: systemInfo.machine)
        let identifier = machineMirror.children.reduce("") { identifier, element in
            guard let value = element.value as? Int8, value != 0 else { return identifier }
            return identifier + String(UnicodeScalar(UInt8(value)))
        }
        return identifier
    }
}

// MARK: - Supporting Types

/// Custom performance report structure
struct CustomPerformanceReport: Codable {
    let reportType: String              // "startup", "network", "view_render", etc.
    let deviceModel: String             // "iPhone14,2"
    let osVersion: String               // "17.0"
    let appVersion: String              // "1.0.0"
    let buildNumber: String             // "42"
    let totalDuration: TimeInterval     // Total duration in seconds
    let milestones: [String: TimeInterval] // Milestone timings
    let customMetrics: [String: Double]    // Custom metrics
    let memoryUsage: Double             // Memory usage in MB
    let timestamp: Date                 // Timestamp

    enum CodingKeys: String, CodingKey {
        case reportType = "report_type"
        case deviceModel = "device_model"
        case osVersion = "os_version"
        case appVersion = "app_version"
        case buildNumber = "build_number"
        case totalDuration = "total_duration"
        case milestones
        case customMetrics = "custom_metrics"
        case memoryUsage = "memory_usage"
        case timestamp
    }
}

/// Empty response for void API calls
struct EmptyResponse: Codable {}
