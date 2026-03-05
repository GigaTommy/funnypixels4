//
//  MetricsManager.swift
//  FunnyPixelsApp
//
//  MetricKit integration for Apple-compliant performance monitoring
//  Automatically collects system-level metrics every 24 hours
//

import Foundation
import UIKit

#if !targetEnvironment(simulator)
import MetricKit
#endif

/// MetricKit管理器 - Apple官方推荐的性能监控方案
/// 自动收集启动时间、卡顿、内存、电池等系统级指标
@MainActor
@available(iOS 13.0, *)
class MetricsManager: NSObject {
    static let shared = MetricsManager()

    private override init() {
        super.init()
    }

    // MARK: - Lifecycle

    /// 开始收集指标
    func startCollecting() {
        #if !targetEnvironment(simulator)
        MXMetricManager.shared.add(self)
        Logger.info("📊 [MetricKit] Started collecting system metrics")
        #else
        Logger.info("📊 [MetricKit] Not available on simulator")
        #endif
    }

    /// 停止收集指标
    func stopCollecting() {
        #if !targetEnvironment(simulator)
        MXMetricManager.shared.remove(self)
        Logger.info("📊 [MetricKit] Stopped collecting system metrics")
        #endif
    }

    // MARK: - Upload

    /// 上传指标到后端（不依赖任何 MetricKit 具体类型）
    private func uploadPayload(type: String, jsonData: Data) {
        // 检查用户是否同意数据收集
        guard UserDefaults.standard.bool(forKey: "performance_monitoring_enabled") else {
            Logger.info("📊 [MetricKit] Upload skipped - user disabled performance monitoring")
            return
        }

        // 只在WiFi环境下上报
        guard NetworkMonitor.shared.connectionType == .wifi else {
            Logger.info("📊 [MetricKit] Upload skipped - not on WiFi")
            return
        }

        Task {
            do {
                // 将 MetricKit JSON 解析为字典
                let metricsDict = (try? JSONSerialization.jsonObject(with: jsonData)) as? [String: Any] ?? [:]

                let parameters: [String: Any] = [
                    "type": type,
                    "deviceModel": UIDevice.current.modelName,
                    "osVersion": UIDevice.current.systemVersion,
                    "appVersion": AppConfig.appVersion,
                    "buildNumber": AppConfig.buildNumber,
                    "metrics": metricsDict,
                    "timestamp": ISO8601DateFormatter().string(from: Date())
                ]

                let _: EmptyResponse = try await APIManager.shared.request(
                    endpoint: .clientPerformance,
                    parameters: parameters
                )

                Logger.info("📊 [MetricKit] Successfully uploaded \(type) to backend")
            } catch {
                Logger.error("📊 [MetricKit] Failed to upload \(type): \(error)")
            }
        }
    }
}

// MARK: - MXMetricManagerSubscriber (Device Only)

#if !targetEnvironment(simulator)
@available(iOS 13.0, *)
extension MetricsManager: MXMetricManagerSubscriber {

    /// 接收性能指标（每24小时自动回调一次）
    nonisolated func didReceive(_ payloads: [MXMetricPayload]) {
        Task { @MainActor in
            Logger.info("📊 [MetricKit] Received \(payloads.count) metric payload(s)")
            for payload in payloads {
                // 使用 Apple 提供的 jsonRepresentation() 导出完整指标
                // 无需手动引用 MXAppLaunchMetrics 等具体类型
                let jsonData = payload.jsonRepresentation()
                Logger.info("📊 [MetricKit] Metric payload size: \(jsonData.count) bytes")
                uploadPayload(type: "metric", jsonData: jsonData)
            }
        }
    }

    /// 接收诊断报告（崩溃、卡顿等异常事件）
    nonisolated func didReceive(_ payloads: [MXDiagnosticPayload]) {
        Task { @MainActor in
            Logger.info("📊 [MetricKit] Received \(payloads.count) diagnostic payload(s)")
            for payload in payloads {
                let jsonData = payload.jsonRepresentation()
                Logger.info("📊 [MetricKit] Diagnostic payload size: \(jsonData.count) bytes")
                uploadPayload(type: "diagnostic", jsonData: jsonData)
            }
        }
    }
}
#endif

// MARK: - Extensions

extension UIDevice {
    /// 设备型号（匿名标识符，如"iPhone14,2"）
    var modelName: String {
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
