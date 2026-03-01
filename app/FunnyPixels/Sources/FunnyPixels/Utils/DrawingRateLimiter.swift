import Foundation

/// 绘制频率限制器
/// 使用 Actor 确保线程安全
public actor DrawingRateLimiter {
    /// 每秒最大绘制次数
    private let maxPerSecond: Int

    /// 时间窗口（秒）
    private let windowDuration: TimeInterval

    /// 绘制时间记录（滑动窗口）
    private var drawTimestamps: [Date] = []

    /// 最后一次绘制时间
    private var lastDrawTime: Date?

    /// 绘制计数器
    private var drawCount: Int = 0

    /// 初始化频率限制器
    /// - Parameters:
    ///   - maxPerSecond: 每秒最大绘制次数（默认 1 次/秒）
    ///   - windowDuration: 时间窗口大小（默认 1 秒）
    public init(maxPerSecond: Int = 1, windowDuration: TimeInterval = 1.0) {
        self.maxPerSecond = maxPerSecond
        self.windowDuration = windowDuration
    }

    /// 检查是否可以进行绘制
    /// - Returns: 如果未超过频率限制返回 true，否则返回 false
    public func canDraw() async -> Bool {
        let now = Date()

        // 清理过期的时间戳（超出时间窗口）
        removeExpiredTimestamps(before: now)

        // 检查是否超过限制
        if drawTimestamps.count >= maxPerSecond {
            return false
        }

        return true
    }

    /// 记录一次绘制操作
    public func recordDraw() async {
        let now = Date()
        drawTimestamps.append(now)
        lastDrawTime = now
        drawCount += 1

        // 保持数组大小合理
        if drawTimestamps.count > maxPerSecond * 2 {
            removeExpiredTimestamps(before: now)
        }
    }

    /// 尝试绘制（检查并记录）
    /// - Returns: 如果允许绘制返回 true，否则返回 false
    public func tryDraw() async -> Bool {
        guard await canDraw() else {
            return false
        }

        await recordDraw()
        return true
    }

    /// 重置计数器和时间戳
    public func reset() async {
        drawTimestamps.removeAll()
        lastDrawTime = nil
        drawCount = 0
    }

    /// 获取下次可以绘制的时间
    /// - Returns: 距离下次可以绘制的时间间隔（秒），如果当前可以绘制则返回 0
    public func nextAvailableTime() async -> TimeInterval {
        guard !drawTimestamps.isEmpty else {
            return 0
        }

        let now = Date()
        removeExpiredTimestamps(before: now)

        if drawTimestamps.count < maxPerSecond {
            return 0
        }

        // 找到最早的时间戳
        guard let earliestTimestamp = drawTimestamps.first else {
            return 0
        }

        // 计算需要等待的时间
        let elapsed = now.timeIntervalSince(earliestTimestamp)
        let waitTime = max(0, windowDuration - elapsed)

        return waitTime
    }

    /// 获取当前窗口内的绘制次数
    public func currentDrawCount() async -> Int {
        let now = Date()
        removeExpiredTimestamps(before: now)
        return drawTimestamps.count
    }

    /// 获取总绘制次数
    public func totalDrawCount() async -> Int {
        return drawCount
    }

    /// 获取最后一次绘制时间
    public func lastDraw() async -> Date? {
        return lastDrawTime
    }

    // MARK: - Private Methods

    /// 移除过期的时间戳
    /// - Parameter currentTime: 当前时间
    private func removeExpiredTimestamps(before currentTime: Date) {
        let cutoffTime = currentTime.addingTimeInterval(-windowDuration)
        drawTimestamps.removeAll { timestamp in
            timestamp < cutoffTime
        }
    }
}

// MARK: - Throttle Extension

extension DrawingRateLimiter {
    /// 节流执行（Throttle）
    /// 确保在指定时间窗口内只执行一次操作
    /// - Parameter action: 要执行的操作
    /// - Returns: 是否执行了操作
    @discardableResult
    public func throttle(_ action: () async -> Void) async -> Bool {
        guard await tryDraw() else {
            return false
        }

        await action()
        return true
    }

    /// 延迟执行（Debounce）
    /// 等待到允许绘制时再执行操作
    /// - Parameter action: 要执行的操作
    public func debounce(_ action: () async -> Void) async {
        let waitTime = await nextAvailableTime()

        if waitTime > 0 {
            try? await Task.sleep(nanoseconds: UInt64(waitTime * 1_000_000_000))
        }

        await recordDraw()
        await action()
    }
}

// MARK: - Statistics

/// 绘制统计信息
public struct DrawingStatistics {
    /// 当前窗口内的绘制次数
    public let currentCount: Int

    /// 总绘制次数
    public let totalCount: Int

    /// 最后一次绘制时间
    public let lastDrawTime: Date?

    /// 下次可绘制的等待时间（秒）
    public let nextAvailableIn: TimeInterval

    /// 是否可以立即绘制
    public var canDrawNow: Bool {
        return nextAvailableIn <= 0
    }

    /// 初始化统计信息
    public init(
        currentCount: Int,
        totalCount: Int,
        lastDrawTime: Date?,
        nextAvailableIn: TimeInterval
    ) {
        self.currentCount = currentCount
        self.totalCount = totalCount
        self.lastDrawTime = lastDrawTime
        self.nextAvailableIn = nextAvailableIn
    }
}

extension DrawingRateLimiter {
    /// 获取统计信息
    /// - Returns: 当前的绘制统计信息
    public func statistics() async -> DrawingStatistics {
        return DrawingStatistics(
            currentCount: await currentDrawCount(),
            totalCount: await totalDrawCount(),
            lastDrawTime: await lastDraw(),
            nextAvailableIn: await nextAvailableTime()
        )
    }
}

// MARK: - Testing Helpers

#if DEBUG
extension DrawingRateLimiter {
    /// 仅用于测试：注入时间戳
    public func injectTimestamp(_ timestamp: Date) async {
        drawTimestamps.append(timestamp)
        if lastDrawTime == nil || timestamp > lastDrawTime! {
            lastDrawTime = timestamp
        }
        drawCount += 1
    }

    /// 仅用于测试：获取所有时间戳
    public func allTimestamps() async -> [Date] {
        return drawTimestamps
    }
}
#endif
