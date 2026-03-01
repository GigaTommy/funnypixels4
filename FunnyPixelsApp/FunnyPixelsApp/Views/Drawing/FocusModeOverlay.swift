//
//  FocusModeOverlay.swift
//  FunnyPixelsApp
//
//  Created by Claude Code
//  Copyright © 2026 FunnyPixels. All rights reserved.
//

import SwiftUI
import CoreLocation
import Combine

/// 专注模式覆盖层 - 防误触 + 显示核心信息
/// 黑色背景全屏覆盖，只显示必要的绘制统计，避免口袋误触
struct FocusModeOverlay: View {
    @ObservedObject private var gpsService = GPSDrawingService.shared
    @ObservedObject private var pixelDrawService = PixelDrawService.shared
    @ObservedObject private var locationManager = LocationManager.shared
    @ObservedObject private var interactionMonitor = UserInteractionMonitor.shared

    @State private var showGuidance = false
    @State private var currentHeading: Double = 0

    var body: some View {
        ZStack {
            // 黑色背景（完全覆盖）
            Color.black
                .ignoresSafeArea()

            VStack(spacing: 40) {
                Spacer()

                // 指南针
                CompassView(heading: currentHeading, size: 120)
                    .padding(.top, 40)

                Spacer()

                // 核心信息
                VStack(spacing: 24) {
                    // 速度
                    infoRow(
                        icon: "speedometer",
                        value: formattedSpeed,
                        unit: NSLocalizedString("focus_mode.unit.speed", value: "km/h", comment: "Speed unit"),
                        label: NSLocalizedString("focus_mode.label.speed", value: "速度", comment: "Speed label")
                    )

                    // 绘制数量
                    infoRow(
                        icon: "map.fill",
                        value: "\(pixelDrawCount)",
                        unit: NSLocalizedString("focus_mode.unit.pixels", value: "像素", comment: "Pixels unit"),
                        label: NSLocalizedString("focus_mode.label.drawn", value: "已绘制", comment: "Drawn label")
                    )

                    // 剩余点数
                    infoRow(
                        icon: "drop.fill",
                        value: "\(remainingPoints)",
                        unit: NSLocalizedString("focus_mode.unit.points", value: "点", comment: "Points unit"),
                        label: NSLocalizedString("focus_mode.label.remaining", value: "剩余", comment: "Remaining label")
                    )

                    // ✅ 绘制距离
                    infoRow(
                        icon: "figure.walk",
                        value: formattedDistance,
                        unit: NSLocalizedString("focus_mode.unit.distance", value: "km", comment: "Distance unit"),
                        label: NSLocalizedString("focus_mode.label.distance", value: "距离", comment: "Distance label")
                    )

                    // ✅ 绘制用时
                    infoRow(
                        icon: "timer",
                        value: formattedDuration,
                        unit: "",
                        label: NSLocalizedString("focus_mode.label.duration", value: "用时", comment: "Duration label")
                    )
                }
                .padding(.horizontal, 32)

                Spacer()

                // 退出提示
                Text(NSLocalizedString("focus_mode.tap_to_exit", value: "轻触退出专注模式", comment: "Tap to exit focus mode"))
                    .font(.system(size: 14, weight: .regular, design: .rounded))
                    .foregroundColor(.white.opacity(0.5))
                    .padding(.bottom, 60)
            }

            // 首次使用引导Toast
            if showGuidance {
                VStack {
                    Spacer()
                    guidanceToast
                        .padding(.bottom, 100)
                        .transition(.move(edge: .bottom).combined(with: .opacity))
                }
            }
        }
        .onAppear {
            showFirstTimeGuidance()
        }
        .onReceive(locationManager.$currentHeading) { heading in
            currentHeading = heading
        }
        .onTapGesture {
            exitFocusMode()
        }
        .onLongPressGesture(minimumDuration: 0.5) {
            // 长按备用退出方式
            exitFocusMode()
        }
    }

    // MARK: - Subviews

    /// 信息行（图标 + 数值 + 单位 + 标签）
    private func infoRow(icon: String, value: String, unit: String, label: String) -> some View {
        HStack(spacing: 16) {
            // 图标
            Image(systemName: icon)
                .font(.system(size: 24))
                .foregroundColor(.white.opacity(0.7))
                .frame(width: 40)

            // 数值和单位
            HStack(alignment: .firstTextBaseline, spacing: 4) {
                Text(value)
                    .font(.system(size: 42, weight: .medium, design: .rounded))
                    .monospacedDigit()  // 防止数字跳动
                    .foregroundColor(.white)

                Text(unit)
                    .font(.system(size: 18, weight: .regular, design: .rounded))
                    .foregroundColor(.white.opacity(0.6))
            }

            Spacer()

            // 标签
            Text(label)
                .font(.system(size: 14, weight: .regular, design: .rounded))
                .foregroundColor(.white.opacity(0.5))
                .frame(width: 60, alignment: .trailing)
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 16)
        .background(
            RoundedRectangle(cornerRadius: 16)
                .fill(Color.white.opacity(0.05))
        )
    }

    /// 首次使用引导Toast
    private var guidanceToast: some View {
        VStack(spacing: 12) {
            Image(systemName: "bolt.slash.fill")
                .font(.system(size: 32))
                .foregroundColor(.orange)

            Text(NSLocalizedString("focus_mode.title", value: "专注模式已启用", comment: "Focus mode enabled title"))
                .font(.system(size: 16, weight: .semibold, design: .rounded))
                .foregroundColor(.white)

            Text(NSLocalizedString("focus_mode.description", value: "防止误触，显示核心数据", comment: "Focus mode description"))
                .font(.system(size: 13, weight: .regular, design: .rounded))
                .foregroundColor(.white.opacity(0.7))
                .multilineTextAlignment(.center)
        }
        .padding(24)
        .background(
            RoundedRectangle(cornerRadius: 20)
                .fill(Color.white.opacity(0.15))
                .shadow(color: .black.opacity(0.3), radius: 20, x: 0, y: 10)
        )
        .padding(.horizontal, 40)
    }

    // MARK: - Computed Properties

    /// 格式化的速度（km/h）
    private var formattedSpeed: String {
        guard let location = locationManager.currentLocation,
              location.speed >= 0 else {
            return "0"
        }

        // CLLocation.speed 单位是 m/s，转换为 km/h
        let speedKmh = location.speed * 3.6
        return String(format: "%.0f", speedKmh)
    }

    /// 已绘制像素数量（本次会话）
    private var pixelDrawCount: Int {
        // 从DrawingStateManager获取GPS绘制的像素计数
        return DrawingStateManager.shared.gpsDrawingPixelCount
    }

    /// 剩余点数
    private var remainingPoints: Int {
        return pixelDrawService.totalPoints
    }

    /// 格式化的绘制距离（km）
    private var formattedDistance: String {
        let distanceMeters = DrawingStateManager.shared.focusModeDistance
        let distanceKm = distanceMeters / 1000.0

        if distanceKm < 1.0 {
            // 小于1km，显示2位小数
            return String(format: "%.2f", distanceKm)
        } else if distanceKm < 10 {
            // 小于10km，显示1位小数
            return String(format: "%.1f", distanceKm)
        } else {
            // 大于10km，显示整数
            return String(format: "%.0f", distanceKm)
        }
    }

    /// 格式化的绘制用时（HH:MM:SS 或 MM:SS）
    private var formattedDuration: String {
        guard let startTime = DrawingStateManager.shared.focusModeStartTime else {
            return "00:00"
        }

        let elapsed = Date().timeIntervalSince(startTime)
        let hours = Int(elapsed) / 3600
        let minutes = (Int(elapsed) % 3600) / 60
        let seconds = Int(elapsed) % 60

        if hours > 0 {
            return String(format: "%d:%02d:%02d", hours, minutes, seconds)
        } else {
            return String(format: "%02d:%02d", minutes, seconds)
        }
    }

    // MARK: - Methods

    /// 退出专注模式
    private func exitFocusMode() {
        withAnimation(.easeInOut(duration: 0.3)) {
            gpsService.exitFocusMode()
        }

        // 提供触觉反馈
        let generator = UIImpactFeedbackGenerator(style: .light)
        generator.impactOccurred()

        Logger.info("🎯 User exited focus mode")
    }

    /// 显示首次使用引导
    private func showFirstTimeGuidance() {
        if interactionMonitor.isFirstTime {
            withAnimation(.easeInOut(duration: 0.3)) {
                showGuidance = true
            }

            // 3秒后自动隐藏
            DispatchQueue.main.asyncAfter(deadline: .now() + 3.0) {
                withAnimation(.easeInOut(duration: 0.3)) {
                    showGuidance = false
                }
                interactionMonitor.markGuidanceShown()
            }
        }
    }
}

// MARK: - Preview

struct FocusModeOverlay_Previews: PreviewProvider {
    static var previews: some View {
        FocusModeOverlay()
    }
}
