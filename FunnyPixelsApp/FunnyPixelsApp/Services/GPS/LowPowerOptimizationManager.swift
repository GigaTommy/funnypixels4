//
//  LowPowerOptimizationManager.swift
//  FunnyPixelsApp
//
//  Created by Claude Code
//  Copyright © 2026 FunnyPixels. All rights reserved.
//

import UIKit
import Foundation

/// 低功耗优化管理器
/// 负责屏幕亮度控制、防止锁屏、地图渲染降级等优化
class LowPowerOptimizationManager {
    static let shared = LowPowerOptimizationManager()

    // MARK: - Private Properties

    /// 原始屏幕亮度（进入前保存，退出时恢复）
    private var originalBrightness: CGFloat = 1.0

    /// 原始防锁屏设置
    private var originalIdleTimerDisabled: Bool = false

    /// 是否处于低功耗模式
    private var isInLowPowerMode: Bool = false

    // MARK: - Initialization

    private init() {
        Logger.info("⚡️ LowPowerOptimizationManager initialized")
    }

    // MARK: - Public Methods

    /// 进入优化模式（专注模式）
    @MainActor
    func enterOptimizationMode() {
        guard !isInLowPowerMode else {
            Logger.warning("⚡️ Already in optimization mode")
            return
        }

        isInLowPowerMode = true

        // 1. 降低屏幕亮度
        originalBrightness = UIScreen.main.brightness
        let targetBrightness = max(0.2, originalBrightness * 0.4)  // 降至40%，最低0.2
        UIScreen.main.brightness = targetBrightness
        Logger.info("⚡️ Screen brightness reduced: \(String(format: "%.2f", originalBrightness)) → \(String(format: "%.2f", targetBrightness))")

        // 2. ✅ 允许屏幕锁定（省电优化）
        // 用户可以手动锁屏，GPS继续在后台运行
        originalIdleTimerDisabled = UIApplication.shared.isIdleTimerDisabled
        // ✅ 不再防止锁屏，真正省电
        // UIApplication.shared.isIdleTimerDisabled = true  // ❌ 已移除
        Logger.info("⚡️ Screen lock allowed (power saving)")

        // 3. 通知地图渲染器降低渲染复杂度
        NotificationCenter.default.post(
            name: .reducedRenderingMode,
            object: true
        )
        Logger.info("⚡️ Reduced rendering mode enabled")

        Logger.info("🎯 Focus mode optimizations activated (screen dim + rendering reduced + GPS optimized)")
    }

    /// 退出优化模式
    @MainActor
    func exitOptimizationMode() {
        guard isInLowPowerMode else {
            Logger.warning("⚡️ Not in optimization mode")
            return
        }

        isInLowPowerMode = false

        // 1. 恢复屏幕亮度（平滑过渡）
        UIView.animate(withDuration: 0.3) {
            UIScreen.main.brightness = self.originalBrightness
        }
        Logger.info("⚡️ Screen brightness restored: \(String(format: "%.2f", originalBrightness))")

        // 2. 恢复屏幕锁定设置
        UIApplication.shared.isIdleTimerDisabled = originalIdleTimerDisabled
        Logger.info("⚡️ Screen lock setting restored")

        // 3. 通知地图渲染器恢复正常渲染
        NotificationCenter.default.post(
            name: .reducedRenderingMode,
            object: false
        )
        Logger.info("⚡️ Normal rendering mode restored")

        Logger.info("🎯 Focus mode optimizations deactivated")
    }
}

// MARK: - Notification Extension

extension Notification.Name {
    /// 降低渲染模式通知（object为Bool，true=降低，false=恢复）
    static let reducedRenderingMode = Notification.Name("reducedRenderingMode")
}
