//
//  FunnyPixelsAppApp.swift
//  FunnyPixelsApp
//
//  Created by Gino Chow on 2026/1/7.
//

import SwiftUI

@main
struct FunnyPixelsAppApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) var appDelegate
    @ObservedObject private var localizationManager = LocalizationManager.shared
    @Environment(\.scenePhase) private var scenePhase

    /// 记录进入后台的时间，用于判断是否需要重新验证会话
    @State private var backgroundedAt: Date?

    var body: some Scene {
        WindowGroup {
            ContentView()
                .id(localizationManager.currentLanguage)
                .onOpenURL { url in
                    DeepLinkHandler.shared.handleURL(url)
                }
        }
        .onChange(of: scenePhase) { _, newPhase in
            handleScenePhaseChange(newPhase)
        }
    }

    /// 处理 App 生命周期切换
    private func handleScenePhaseChange(_ phase: ScenePhase) {
        switch phase {
        case .background:
            backgroundedAt = Date()
            // GPS Drawing 后台处理：保护当前操作、调整定位精度
            GPSDrawingService.shared.handleAppDidEnterBackground()

        case .active:
            // GPS Drawing 前台恢复：恢复精度、同步状态
            GPSDrawingService.shared.handleAppWillEnterForeground()

            // 会话重验：后台超过 5 分钟且已认证时，后台静默验证 token
            if let backgroundedAt,
               Date().timeIntervalSince(backgroundedAt) > 300,
               AuthManager.shared.isAuthenticated {
                Task {
                    await AuthManager.shared.validateSessionInBackground()
                }
            }

        case .inactive:
            break

        @unknown default:
            break
        }
    }
}
