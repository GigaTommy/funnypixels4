import Foundation
import Combine
import UIKit

/// 领土动态 Banner 管理器
/// 管理实时推送的覆盖事件队列、Banner 轮播和状态
@MainActor
class TerritoryBannerManager: ObservableObject {
    static let shared = TerritoryBannerManager()

    // MARK: - Published State

    /// 当前显示的 banner 事件
    @Published var currentBanner: TerritoryBattleEvent?

    /// 等待队列中的事件数
    @Published var pendingBattleCount: Int = 0

    /// 是否展示战斗 feed 半屏 sheet
    @Published var showBattleFeed: Bool = false

    // MARK: - Private

    private var queue: [TerritoryBattleEvent] = []
    private let maxQueueSize = 20
    private var rotationTimer: Timer?
    private let rotationInterval: TimeInterval = 4.0

    private init() {}

    // MARK: - Public API

    /// 添加一个新的领土战斗事件（由 WebSocket handler 调用）
    func addBattleEvent(_ event: TerritoryBattleEvent) {
        // 队列满时丢弃最旧的
        if queue.count >= maxQueueSize {
            queue.removeFirst()
        }
        queue.append(event)
        pendingBattleCount = queue.count

        // 触发触觉反馈
        HapticManager.shared.notification(type: .warning)

        // 如果当前没有显示 banner，立即显示
        if currentBanner == nil {
            showNext()
            startRotation()
        }
    }

    /// 切换到下一个事件
    func rotateToNext() {
        showNext()
    }

    /// 关闭 banner
    func dismiss() {
        currentBanner = nil
        queue.removeAll()
        pendingBattleCount = 0
        stopRotation()
    }

    // MARK: - Private

    private func showNext() {
        guard !queue.isEmpty else {
            currentBanner = nil
            pendingBattleCount = 0
            stopRotation()
            return
        }
        let event = queue.removeFirst()
        currentBanner = event
        pendingBattleCount = queue.count
    }

    private func startRotation() {
        stopRotation()
        rotationTimer = Timer.scheduledTimer(withTimeInterval: rotationInterval, repeats: true) { [weak self] _ in
            Task { @MainActor [weak self] in
                self?.showNext()
            }
        }
    }

    private func stopRotation() {
        rotationTimer?.invalidate()
        rotationTimer = nil
    }
}
