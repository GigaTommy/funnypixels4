import UIKit
import SwiftUI
import UserNotifications
import GoogleSignIn

class AppDelegate: NSObject, UIApplicationDelegate {
    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey : Any]? = nil) -> Bool {
        // Set push notification delegate
        UNUserNotificationCenter.current().delegate = PushNotificationService.shared

        // Request notification permissions and register
        PushNotificationService.shared.requestPermissionAndRegister()

        // ✅ 初始化音效管理器（配置音频会话 + 预加载音效）
        _ = SoundManager.shared

        // Configure TabBar appearance - 参考淘宝、美团设计风格
        configureTabBarAppearance()

        return true
    }

    // MARK: - TabBar Appearance Configuration
    /// 配置TabBar外观 - 线条图标 + 灰色未选中状态
    private func configureTabBarAppearance() {
        let appearance = UITabBarAppearance()
        appearance.configureWithDefaultBackground()

        // 背景设置
        appearance.backgroundColor = UIColor.systemBackground
        appearance.shadowColor = UIColor.separator.withAlphaComponent(0.3)

        // Tab项外观配置
        let itemAppearance = UITabBarItemAppearance()

        // 未选中状态 - 灰色线条图标
        itemAppearance.normal.iconColor = UIColor.systemGray
        itemAppearance.normal.titleTextAttributes = [
            .foregroundColor: UIColor.systemGray,
            .font: UIFont.systemFont(ofSize: 10, weight: .regular)
        ]

        // 选中状态 - 主题色线条图标（不自动填充）
        itemAppearance.selected.iconColor = UIColor(AppColors.primary)
        itemAppearance.selected.titleTextAttributes = [
            .foregroundColor: UIColor(AppColors.primary),
            .font: UIFont.systemFont(ofSize: 10, weight: .medium)
        ]

        // 应用到所有布局
        appearance.stackedLayoutAppearance = itemAppearance
        appearance.inlineLayoutAppearance = itemAppearance
        appearance.compactInlineLayoutAppearance = itemAppearance

        // 全局应用外观
        UITabBar.appearance().standardAppearance = appearance
        if #available(iOS 15.0, *) {
            UITabBar.appearance().scrollEdgeAppearance = appearance
        }

        // 🔑 关键：配置UITabBar使用统一渲染模式
        UITabBar.appearance().unselectedItemTintColor = UIColor.systemGray
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey : Any] = [:]) -> Bool {
        // Handle Google Sign-In callback
        if GIDSignIn.sharedInstance.handle(url) {
            return true
        }
        // Handle custom URL scheme deep links
        DeepLinkHandler.shared.handleURL(url)
        return true
    }

    // MARK: - Universal Links
    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        guard userActivity.activityType == NSUserActivityTypeBrowsingWeb,
              let url = userActivity.webpageURL else {
            return false
        }
        DeepLinkHandler.shared.handleURL(url)
        return true
    }

    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        PushNotificationService.shared.didRegisterForRemoteNotifications(deviceToken: deviceToken)
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        PushNotificationService.shared.didFailToRegisterForRemoteNotifications(error: error)
    }
}
