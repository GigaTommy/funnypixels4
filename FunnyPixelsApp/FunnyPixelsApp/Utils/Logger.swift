import Foundation
import os.log

/// 日志管理器
/// All methods are nonisolated to allow calling from any context (actors, main actor, etc.)
struct Logger {
    // Swift 6: Logger 是 Sendable 类型，不需要 nonisolated(unsafe)
    private nonisolated static let osLogger = os.Logger(subsystem: "com.funnypixels.app", category: "general")

    /// 调试日志
    nonisolated static func debug(_ message: String, file: String = #file, function: String = #function, line: Int = #line) {
        #if DEBUG
        let filename = URL(fileURLWithPath: file).lastPathComponent
        let logMessage = "\(filename):\(line) \(function) - \(message)"
        osLogger.debug("\(logMessage)")
        #endif
    }

    /// 信息日志
    nonisolated static func info(_ message: String, file: String = #file, function: String = #function, line: Int = #line) {
        let filename = URL(fileURLWithPath: file).lastPathComponent
        let logMessage = "\(filename):\(line) \(function) - \(message)"
        osLogger.info("\(logMessage)")
    }

    /// 警告日志
    nonisolated static func warning(_ message: String, file: String = #file, function: String = #function, line: Int = #line) {
        let filename = URL(fileURLWithPath: file).lastPathComponent
        let logMessage = "\(filename):\(line) \(function) - \(message)"
        osLogger.warning("\(logMessage)")
    }

    /// 错误日志
    nonisolated static func error(_ message: String, file: String = #file, function: String = #function, line: Int = #line) {
        let filename = URL(fileURLWithPath: file).lastPathComponent
        let logMessage = "\(filename):\(line) \(function) - \(message)"
        osLogger.error("\(logMessage)")
    }

    /// 网络请求日志
    nonisolated static func network(_ request: String, response: String? = nil, error: Error? = nil, file: String = #file, function: String = #function, line: Int = #line) {
        let filename = URL(fileURLWithPath: file).lastPathComponent

        if let error = error {
            let logMessage = "\(filename):\(line) \(function) - Network Error: \(request) - Error: \(error)"
            osLogger.error("\(logMessage)")
        } else if let response = response {
            let logMessage = "\(filename):\(line) \(function) - Network: \(request) - Response: \(response)"
            osLogger.info("\(logMessage)")
        } else {
            let logMessage = "\(filename):\(line) \(function) - Network: \(request)"
            osLogger.info("\(logMessage)")
        }
    }

    /// 用户操作日志
    nonisolated static func userAction(_ action: String, details: [String: Any]? = nil, file: String = #file, function: String = #function, line: Int = #line) {
        let filename = URL(fileURLWithPath: file).lastPathComponent

        var logMessage = "User Action: \(action)"
        if let details = details {
            logMessage += " - Details: \(details)"
        }

        let fullMessage = "\(filename):\(line) \(function) - \(logMessage)"
        osLogger.info("\(fullMessage)")
    }

    /// 性能监控日志
    nonisolated static func performance(_ operation: String, duration: TimeInterval, file: String = #file, function: String = #function, line: Int = #line) {
        let filename = URL(fileURLWithPath: file).lastPathComponent
        let logMessage = "\(filename):\(line) \(function) - Performance: \(operation) took \(String(format: "%.3f", duration)) seconds"
        osLogger.info("\(logMessage)")
    }
}
