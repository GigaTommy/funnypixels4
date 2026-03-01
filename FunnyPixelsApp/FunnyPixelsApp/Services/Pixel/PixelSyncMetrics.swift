import Foundation
import Combine

/// 像素同步性能指标收集器
/// 负责收集、统计和报告实时像素同步的性能指标
@MainActor
public class PixelSyncMetrics: ObservableObject {
    public static let shared = PixelSyncMetrics()

    // MARK: - Published Properties

    /// 当前端到端延迟（毫秒）
    @Published public private(set) var currentLatency: Double = 0

    /// 平均延迟（毫秒）
    @Published public private(set) var averageLatency: Double = 0

    /// 最大延迟（毫秒）
    @Published public private(set) var maxLatency: Double = 0

    /// 最小延迟（毫秒）
    @Published public private(set) var minLatency: Double = Double.infinity

    /// 当前吞吐量（像素/秒）
    @Published public private(set) var currentThroughput: Double = 0

    /// 丢包率（百分比）
    @Published public private(set) var packetLossRate: Double = 0

    /// 冲突率（百分比）
    @Published public private(set) var conflictRate: Double = 0

    /// 同步状态健康度（0-100）
    @Published public private(set) var syncHealth: Double = 100

    /// 是否正在收集指标
    @Published public private(set) var isCollecting: Bool = false

    // MARK: - Private Properties

    /// 延迟历史记录（最近100个样本）
    private var latencyHistory: [Double] = []
    private let maxHistorySize = 100

    /// 吞吐量计数器
    private var pixelsSentInWindow = 0
    private var pixelsReceivedInWindow = 0
    private var throughputWindowStart = Date()
    private let throughputWindowDuration: TimeInterval = 1.0 // 1秒窗口

    /// 丢包统计
    @Published public private(set) var totalPacketsSent = 0
    private var totalPacketsLost = 0

    /// 冲突统计
    @Published public private(set) var totalPixelUpdates = 0
    private var totalConflicts = 0

    /// 定时器
    private var metricsTimer: Timer?

    /// 指标历史记录（用于趋势分析）
    public struct MetricsSnapshot: Codable {
        public let timestamp: Date
        public let latency: Double
        public let throughput: Double
        public let packetLoss: Double
        public let conflictRate: Double
        public let syncHealth: Double
    }

    private var metricsHistory: [MetricsSnapshot] = []
    private let maxSnapshotHistory = 1000

    // MARK: - Initialization

    private init() {
        Logger.info("PixelSyncMetrics initialized")
    }

    // MARK: - Public Methods

    /// 开始收集指标
    public func startCollecting() {
        guard !isCollecting else { return }

        isCollecting = true
        resetMetrics()

        // 启动定时器，每秒更新一次吞吐量
        metricsTimer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { [weak self] _ in
            guard let self = self else { return }
            Task { @MainActor in
                self.updateThroughput()
                self.updateSyncHealth()
                self.captureSnapshot()
            }
        }

        Logger.info("Started collecting pixel sync metrics")
    }

    /// 停止收集指标
    public func stopCollecting() {
        guard isCollecting else { return }

        isCollecting = false
        metricsTimer?.invalidate()
        metricsTimer = nil

        Logger.info("Stopped collecting pixel sync metrics")
    }

    /// 重置所有指标
    public func resetMetrics() {
        latencyHistory.removeAll()
        metricsHistory.removeAll()

        currentLatency = 0
        averageLatency = 0
        maxLatency = 0
        minLatency = Double.infinity
        currentThroughput = 0
        packetLossRate = 0
        conflictRate = 0
        syncHealth = 100

        pixelsSentInWindow = 0
        pixelsReceivedInWindow = 0
        totalPacketsSent = 0
        totalPacketsLost = 0
        totalPixelUpdates = 0
        totalConflicts = 0

        throughputWindowStart = Date()

        Logger.info("Reset all pixel sync metrics")
    }

    // MARK: - Latency Tracking

    /// 记录延迟样本
    /// - Parameter latency: 延迟时间（毫秒）
    public func recordLatency(_ latency: Double) {
        guard isCollecting else { return }

        currentLatency = latency
        latencyHistory.append(latency)

        // 维护历史记录大小
        if latencyHistory.count > maxHistorySize {
            latencyHistory.removeFirst()
        }

        // 更新统计
        updateLatencyStats()
    }

    /// 记录往返时间（RTT）
    /// - Parameters:
    ///   - sendTime: 发送时间
    ///   - receiveTime: 接收时间（默认为当前时间）
    public func recordRoundTripTime(sendTime: Date, receiveTime: Date = Date()) {
        let rtt = receiveTime.timeIntervalSince(sendTime) * 1000 // 转换为毫秒
        recordLatency(rtt)
    }

    private func updateLatencyStats() {
        guard !latencyHistory.isEmpty else { return }

        // 计算平均值
        averageLatency = latencyHistory.reduce(0, +) / Double(latencyHistory.count)

        // 更新最大值和最小值
        if let max = latencyHistory.max() {
            maxLatency = max
        }
        if let min = latencyHistory.min() {
            minLatency = min
        }
    }

    // MARK: - Throughput Tracking

    /// 记录发送的像素
    /// - Parameter count: 像素数量
    public func recordPixelsSent(_ count: Int = 1) {
        guard isCollecting else { return }

        pixelsSentInWindow += count
        totalPacketsSent += count
    }

    /// 记录接收的像素
    /// - Parameter count: 像素数量
    public func recordPixelsReceived(_ count: Int = 1) {
        guard isCollecting else { return }

        pixelsReceivedInWindow += count
    }

    private func updateThroughput() {
        let elapsed = Date().timeIntervalSince(throughputWindowStart)

        guard elapsed >= throughputWindowDuration else { return }

        // 计算吞吐量（像素/秒）
        currentThroughput = Double(pixelsReceivedInWindow) / elapsed

        // 重置窗口
        pixelsSentInWindow = 0
        pixelsReceivedInWindow = 0
        throughputWindowStart = Date()
    }

    // MARK: - Packet Loss Tracking

    /// 记录丢包
    /// - Parameter count: 丢包数量
    public func recordPacketLoss(_ count: Int = 1) {
        guard isCollecting else { return }

        totalPacketsLost += count
        updatePacketLossRate()
    }

    /// 记录ACK确认
    public func recordAcknowledgment() {
        guard isCollecting else { return }

        // ACK确认意味着成功送达，不增加丢包计数
        updatePacketLossRate()
    }

    private func updatePacketLossRate() {
        guard totalPacketsSent > 0 else {
            packetLossRate = 0
            return
        }

        packetLossRate = (Double(totalPacketsLost) / Double(totalPacketsSent)) * 100.0
    }

    // MARK: - Conflict Tracking

    /// 记录像素更新
    public func recordPixelUpdate() {
        guard isCollecting else { return }

        totalPixelUpdates += 1
        updateConflictRate()
    }

    /// 记录冲突
    public func recordConflict() {
        guard isCollecting else { return }

        totalConflicts += 1
        updateConflictRate()
    }

    private func updateConflictRate() {
        guard totalPixelUpdates > 0 else {
            conflictRate = 0
            return
        }

        conflictRate = (Double(totalConflicts) / Double(totalPixelUpdates)) * 100.0
    }

    // MARK: - Sync Health

    /// 更新同步健康度（综合评分）
    /// 基于延迟、丢包率、冲突率计算
    private func updateSyncHealth() {
        var health: Double = 100.0

        // 延迟影响（延迟越高，扣分越多）
        // 0-50ms: 不扣分
        // 50-200ms: 扣0-20分
        // >200ms: 扣20-40分
        if averageLatency > 50 {
            let latencyPenalty = min(40, (averageLatency - 50) / 10)
            health -= latencyPenalty
        }

        // 丢包率影响
        // 0-1%: 不扣分
        // 1-5%: 扣0-20分
        // >5%: 扣20-30分
        if packetLossRate > 1 {
            let lossPenalty = min(30, (packetLossRate - 1) * 5)
            health -= lossPenalty
        }

        // 冲突率影响
        // 0-5%: 不扣分
        // 5-20%: 扣0-15分
        // >20%: 扣15-30分
        if conflictRate > 5 {
            let conflictPenalty = min(30, (conflictRate - 5) * 1)
            health -= conflictPenalty
        }

        syncHealth = max(0, min(100, health))
    }

    // MARK: - Snapshot Management

    /// 捕获当前指标快照
    private func captureSnapshot() {
        let snapshot = MetricsSnapshot(
            timestamp: Date(),
            latency: averageLatency,
            throughput: currentThroughput,
            packetLoss: packetLossRate,
            conflictRate: conflictRate,
            syncHealth: syncHealth
        )

        metricsHistory.append(snapshot)

        // 维护历史记录大小
        if metricsHistory.count > maxSnapshotHistory {
            metricsHistory.removeFirst()
        }
    }

    /// 获取指标历史记录
    /// - Parameter duration: 时间范围（秒）
    /// - Returns: 指标快照数组
    public func getHistory(duration: TimeInterval = 60) -> [MetricsSnapshot] {
        let cutoffTime = Date().addingTimeInterval(-duration)
        return metricsHistory.filter { $0.timestamp > cutoffTime }
    }

    // MARK: - Reporting

    /// 获取当前指标摘要
    public func getMetricsSummary() -> String {
        """
        === Pixel Sync Metrics ===
        Latency:
          Current: \(String(format: "%.2f", currentLatency))ms
          Average: \(String(format: "%.2f", averageLatency))ms
          Min/Max: \(String(format: "%.2f", minLatency))ms / \(String(format: "%.2f", maxLatency))ms

        Throughput: \(String(format: "%.2f", currentThroughput)) pixels/sec

        Reliability:
          Packet Loss: \(String(format: "%.2f", packetLossRate))%
          Conflict Rate: \(String(format: "%.2f", conflictRate))%

        Sync Health: \(String(format: "%.1f", syncHealth))%

        Totals:
          Packets Sent: \(totalPacketsSent)
          Packets Lost: \(totalPacketsLost)
          Pixel Updates: \(totalPixelUpdates)
          Conflicts: \(totalConflicts)
        ===========================
        """
    }

    /// 打印当前指标
    public func printMetrics() {
        Logger.info(getMetricsSummary())
    }

    /// 导出指标数据（JSON格式）
    public func exportMetrics() -> Data? {
        let metricsData: [String: Any] = [
            "timestamp": ISO8601DateFormatter().string(from: Date()),
            "latency": [
                "current": currentLatency,
                "average": averageLatency,
                "min": minLatency,
                "max": maxLatency
            ],
            "throughput": currentThroughput,
            "packetLoss": packetLossRate,
            "conflictRate": conflictRate,
            "syncHealth": syncHealth,
            "totals": [
                "packetsSent": totalPacketsSent,
                "packetsLost": totalPacketsLost,
                "pixelUpdates": totalPixelUpdates,
                "conflicts": totalConflicts
            ],
            "history": metricsHistory.map { snapshot in
                [
                    "timestamp": ISO8601DateFormatter().string(from: snapshot.timestamp),
                    "latency": snapshot.latency,
                    "throughput": snapshot.throughput,
                    "packetLoss": snapshot.packetLoss,
                    "conflictRate": snapshot.conflictRate,
                    "syncHealth": snapshot.syncHealth
                ]
            }
        ]

        return try? JSONSerialization.data(withJSONObject: metricsData, options: .prettyPrinted)
    }

    // MARK: - Alerts

    /// 检查是否有性能警告
    public func checkForAlerts() -> [String] {
        var alerts: [String] = []

        if averageLatency > 200 {
            alerts.append("⚠️ 高延迟: \(String(format: "%.0f", averageLatency))ms")
        }

        if packetLossRate > 5 {
            alerts.append("⚠️ 高丢包率: \(String(format: "%.1f", packetLossRate))%")
        }

        if conflictRate > 10 {
            alerts.append("⚠️ 高冲突率: \(String(format: "%.1f", conflictRate))%")
        }

        if syncHealth < 70 {
            alerts.append("⚠️ 同步健康度低: \(String(format: "%.0f", syncHealth))%")
        }

        if currentThroughput < 1 && isCollecting {
            alerts.append("⚠️ 吞吐量过低")
        }

        return alerts
    }

    // MARK: - Statistics

    /// 获取延迟百分位数
    /// - Parameter percentile: 百分位（0-100）
    /// - Returns: 延迟值（毫秒）
    public func getLatencyPercentile(_ percentile: Double) -> Double? {
        guard !latencyHistory.isEmpty else { return nil }
        guard percentile >= 0 && percentile <= 100 else { return nil }

        let sorted = latencyHistory.sorted()
        let index = Int(Double(sorted.count - 1) * percentile / 100.0)
        return sorted[index]
    }

    /// 获取P50延迟（中位数）
    public var p50Latency: Double? {
        getLatencyPercentile(50)
    }

    /// 获取P95延迟
    public var p95Latency: Double? {
        getLatencyPercentile(95)
    }

    /// 获取P99延迟
    public var p99Latency: Double? {
        getLatencyPercentile(99)
    }
}

// MARK: - Debug Extensions

#if DEBUG
extension PixelSyncMetrics {
    /// 模拟指标数据（用于测试和UI预览）
    public func simulateMetrics() {
        startCollecting()

        // 模拟一些延迟数据
        for _ in 0..<20 {
            recordLatency(Double.random(in: 30...150))
        }

        // 模拟吞吐量
        recordPixelsSent(100)
        recordPixelsReceived(95)

        // 模拟一些丢包
        recordPacketLoss(5)

        // 模拟一些冲突
        for _ in 0..<50 {
            recordPixelUpdate()
        }
        for _ in 0..<5 {
            recordConflict()
        }

        updateThroughput()
        updateSyncHealth()
    }
}
#endif
