//
//  UserInteractionMonitor.swift
//  FunnyPixelsApp
//
//  Created by Claude Code
//  Copyright © 2026 FunnyPixels. All rights reserved.
//

import Foundation
import Combine

/// 监控用户交互行为，检测空闲状态以触发低功耗模式
@MainActor
class UserInteractionMonitor: ObservableObject {
    static let shared = UserInteractionMonitor()

    // MARK: - Published Properties

    /// 是否处于空闲状态（5秒无操作）
    @Published var isIdle: Bool = false

    /// 当前空闲时长（秒）
    @Published var idleDuration: TimeInterval = 0

    // MARK: - Private Properties

    /// 空闲超时时间（5秒，快速进入专注绘制模式）
    private let idleTimeout: TimeInterval = 5.0

    /// 上次用户交互时间
    private var lastInteractionTime: Date = Date()

    /// 空闲检测定时器（每0.5秒检查一次）
    private var idleTimer: Timer?

    /// 是否正在监控
    private var isMonitoring: Bool = false

    /// 首次使用标记（用于显示引导）
    private let firstTimeKey = "hasShownLowPowerGuidance"

    // MARK: - Initialization

    private init() {
        Logger.info("📊 UserInteractionMonitor initialized")
    }

    // MARK: - Public Methods

    /// 记录用户交互（重置空闲计时器）
    func recordInteraction() {
        lastInteractionTime = Date()
        idleDuration = 0

        // 如果之前是空闲状态，现在变为活跃
        if isIdle {
            isIdle = false
            Logger.info("📊 User became active")
        }
    }

    /// 开始监控用户交互（GPS绘制启动时调用）
    func startMonitoring() {
        guard !isMonitoring else {
            Logger.warning("📊 Already monitoring user interactions")
            return
        }

        isMonitoring = true
        lastInteractionTime = Date()
        idleDuration = 0
        isIdle = false

        // 启动定时器，每0.5秒检查一次
        // 使用target-action模式确保在主线程调用
        idleTimer = Timer.scheduledTimer(
            timeInterval: 0.5,
            target: self,
            selector: #selector(timerFired),
            userInfo: nil,
            repeats: true
        )

        // 添加到主运行循环
        RunLoop.main.add(idleTimer!, forMode: .common)

        Logger.info("📊 Started monitoring user interactions (timeout: \(idleTimeout)s)")
    }

    /// 停止监控用户交互（GPS绘制结束时调用）
    func stopMonitoring() {
        guard isMonitoring else { return }

        isMonitoring = false
        idleTimer?.invalidate()
        idleTimer = nil
        idleDuration = 0
        isIdle = false

        Logger.info("📊 Stopped monitoring user interactions")
    }

    /// 检查是否是首次使用（用于显示引导）
    var isFirstTime: Bool {
        return !UserDefaults.standard.bool(forKey: firstTimeKey)
    }

    /// 标记已显示过引导
    func markGuidanceShown() {
        UserDefaults.standard.set(true, forKey: firstTimeKey)
        Logger.info("📊 First-time guidance marked as shown")
    }

    // MARK: - Private Methods

    /// Timer触发时调用（Objective-C兼容）
    @objc private func timerFired() {
        checkIdleStatus()
    }

    /// 检查空闲状态（每0.5秒调用一次）
    private func checkIdleStatus() {
        let currentIdleDuration = Date().timeIntervalSince(lastInteractionTime)
        idleDuration = currentIdleDuration

        // 超过5秒无操作，进入空闲状态
        if currentIdleDuration >= idleTimeout && !isIdle {
            isIdle = true
            Logger.info("📊 User became idle after \(String(format: "%.1f", currentIdleDuration))s")
        }
    }
}
