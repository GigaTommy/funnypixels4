# iOS 消息中心集成指南

**最后更新：** 2026-02-24
**适用版本：** FunnyPixels iOS App

---

## 📋 概述

本指南将帮助您将消息中心功能集成到 FunnyPixels iOS App 中。

**已完成的文件：**
- ✅ `Models/NotificationModels.swift` - 数据模型
- ✅ `ViewModels/NotificationViewModel.swift` - 业务逻辑
- ✅ `Views/NotificationListView.swift` - UI 组件
- ✅ `Services/APIManager.swift` - API 方法

**需要集成：**
- 🔜 主 TabView 添加消息入口
- 🔜 导航链接配置
- 🔜 Badge 未读数量显示

---

## 🎯 集成步骤

### 步骤 1: 在主 TabView 添加消息中心入口

假设您的主界面使用 `TabView`，需要添加一个新的 Tab 用于消息中心。

**文件位置：** `app/FunnyPixels/Sources/FunnyPixels/Views/MainTabView.swift` (或类似文件)

#### 1.1 添加未读数量 State

```swift
import SwiftUI

struct MainTabView: View {
    @State private var selectedTab = 0
    @StateObject private var notificationViewModel = NotificationViewModel()  // ✅ 新增

    var body: some View {
        TabView(selection: $selectedTab) {
            // ... 其他 tabs ...

            // ✅ 新增消息中心 Tab
            NotificationListView()
                .tabItem {
                    Label("消息", systemImage: "bell.fill")
                }
                .badge(notificationViewModel.unreadCount)  // ✅ 显示未读数量
                .tag(3)
        }
        .task {
            // ✅ 启动时获取未读数量
            await notificationViewModel.fetchUnreadCount()
        }
    }
}
```

#### 1.2 完整示例（如果还没有 TabView）

```swift
import SwiftUI

struct MainTabView: View {
    @State private var selectedTab = 0
    @StateObject private var notificationViewModel = NotificationViewModel()

    var body: some View {
        TabView(selection: $selectedTab) {
            // Tab 1: 地图
            MapView()
                .tabItem {
                    Label("地图", systemImage: "map.fill")
                }
                .tag(0)

            // Tab 2: 活动
            EventListView()
                .tabItem {
                    Label("活动", systemImage: "flag.fill")
                }
                .tag(1)

            // Tab 3: 联盟
            AllianceView()
                .tabItem {
                    Label("联盟", systemImage: "person.3.fill")
                }
                .tag(2)

            // Tab 4: 消息中心 ✅ 新增
            NotificationListView()
                .tabItem {
                    Label("消息", systemImage: "bell.fill")
                }
                .badge(notificationViewModel.unreadCount)
                .tag(3)

            // Tab 5: 我的
            ProfileView()
                .tabItem {
                    Label("我的", systemImage: "person.fill")
                }
                .tag(4)
        }
        .task {
            await notificationViewModel.fetchUnreadCount()
        }
    }
}
```

---

### 步骤 2: 添加消息中心导航链接（可选）

如果您想在"我的"页面或其他地方添加快捷入口：

```swift
NavigationLink(destination: NotificationListView()) {
    HStack {
        Image(systemName: "bell.fill")
            .foregroundColor(.blue)

        Text("消息中心")

        Spacer()

        // 显示未读数量
        if notificationViewModel.unreadCount > 0 {
            Text("\(notificationViewModel.unreadCount)")
                .font(.caption)
                .foregroundColor(.white)
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(Color.red)
                .clipShape(Capsule())
        }

        Image(systemName: "chevron.right")
            .foregroundColor(.gray)
    }
    .padding()
}
```

---

### 步骤 3: 定期刷新未读数量（可选）

如果您希望在用户使用 App 时定期更新未读数量：

```swift
struct MainTabView: View {
    @StateObject private var notificationViewModel = NotificationViewModel()
    @State private var refreshTimer: Timer?

    var body: some View {
        TabView {
            // ... tabs ...
        }
        .onAppear {
            // 每 30 秒刷新一次未读数量
            refreshTimer = Timer.scheduledTimer(withTimeInterval: 30, repeats: true) { _ in
                Task {
                    await notificationViewModel.fetchUnreadCount()
                }
            }
        }
        .onDisappear {
            refreshTimer?.invalidate()
        }
    }
}
```

---

### 步骤 4: 添加推送通知支持（可选，长期计划）

#### 4.1 在 App Delegate 中请求权限

```swift
import UserNotifications

class AppDelegate: NSObject, UIApplicationDelegate {
    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
    ) -> Bool {
        // 请求通知权限
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .badge, .sound]) { granted, error in
            if granted {
                print("✅ 通知权限已授予")
                DispatchQueue.main.async {
                    application.registerForRemoteNotifications()
                }
            } else {
                print("⚠️ 通知权限被拒绝")
            }
        }

        return true
    }

    func application(
        _ application: UIApplication,
        didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
    ) {
        let token = deviceToken.map { String(format: "%02.2hhx", $0) }.joined()
        print("📱 Device Token: \(token)")

        // ✅ 将 token 发送到后端
        Task {
            try? await APIManager.shared.updateDeviceToken(token)
        }
    }
}
```

#### 4.2 在主 App 结构中配置 Delegate

```swift
@main
struct FunnyPixelsApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) var appDelegate

    var body: some Scene {
        WindowGroup {
            MainTabView()
        }
    }
}
```

---

## 🎨 UI 定制

### 自定义通知行样式

如果您想自定义通知列表的样式，可以修改 `NotificationRowView`：

```swift
// 在 NotificationListView.swift 中修改

struct NotificationRowView: View {
    let notification: AppNotification
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(alignment: .top, spacing: 12) {
                // ✅ 自定义图标样式
                Image(systemName: notification.notificationType.icon)
                    .font(.title2)
                    .foregroundColor(Color(hex: notification.notificationType.color))
                    .frame(width: 40, height: 40)
                    .background(Color(hex: notification.notificationType.color).opacity(0.1))
                    .clipShape(Circle())

                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Text(notification.title)
                            .font(.headline)
                            .foregroundColor(.primary)

                        Spacer()

                        Text(notification.createdAt.relativeTimeString)
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }

                    Text(notification.message)
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                        .lineLimit(2)

                    // ✅ 未读标记
                    if !notification.isRead {
                        Circle()
                            .fill(Color.blue)
                            .frame(width: 8, height: 8)
                    }
                }
            }
            .padding()
            .background(notification.isRead ? Color.clear : Color.blue.opacity(0.05))
        }
        .buttonStyle(PlainButtonStyle())
    }
}

// ✅ 辅助扩展：时间格式化
extension Date {
    var relativeTimeString: String {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .short
        formatter.locale = Locale(identifier: "zh_CN")
        return formatter.localizedString(for: self, relativeTo: Date())
    }
}
```

---

## 🧪 测试集成

### 1. 验证 UI 显示

```bash
# 在 Xcode 中运行 App
# 1. 检查 TabView 是否显示"消息" Tab
# 2. 点击"消息" Tab，验证列表显示
# 3. 检查是否显示未读数量 Badge
```

### 2. 测试通知功能

```bash
# 在后端触发测试通知
cd backend
node test-achievement-notification.js

# 在 iOS App 中：
# 1. 下拉刷新消息列表
# 2. 验证新通知显示
# 3. 点击通知标记已读
# 4. 验证未读数量更新
```

### 3. 测试各种通知类型

后端已支持的通知类型：
- ✅ `achievement` - 成就解锁
- ✅ `event_reward` - 活动奖励
- ✅ `event_ended` - 活动结束
- ✅ `event_started` - 活动开始
- ✅ `alliance_application` - 联盟申请
- ✅ `alliance_application_result` - 申请结果
- ✅ `system` - 系统消息

---

## 📊 集成检查清单

- [ ] 已添加 `NotificationListView` 到 TabView
- [ ] TabView 显示未读数量 Badge
- [ ] 启动时自动获取未读数量
- [ ] 下拉刷新功能正常
- [ ] 点击通知标记已读
- [ ] 滑动删除通知功能正常
- [ ] 空状态显示正确
- [ ] 未读/已读样式区分明显
- [ ] 各种通知类型图标和颜色正确
- [ ] 时间显示格式正确（相对时间）

---

## 🐛 常见问题

### 问题 1: 未读数量不更新

**原因：** ViewModel 没有正确初始化或刷新

**解决：**
```swift
.task {
    await notificationViewModel.fetchUnreadCount()
}
```

### 问题 2: 列表显示为空

**原因：** API 认证失败或用户没有通知

**解决：**
1. 检查 `APIManager.shared.authToken` 是否正确设置
2. 在后端运行测试脚本创建测试通知
3. 检查网络请求日志

### 问题 3: Badge 不显示

**原因：** iOS 14+ TabView badge 需要非零值

**解决：**
```swift
.badge(notificationViewModel.unreadCount > 0 ? notificationViewModel.unreadCount : nil)
```

---

## 🚀 下一步优化

### 优先级 1: 通知点击跳转

```swift
// 点击通知跳转到相关页面
func handleNotificationTap(_ notification: AppNotification) {
    switch notification.notificationType {
    case .eventReward, .eventEnded, .eventStarted:
        if let eventId = notification.data?.value as? [String: Any],
           let id = eventId["event_id"] as? String {
            // 跳转到活动详情
            navigateToEvent(id: id)
        }

    case .achievement:
        // 跳转到成就页面
        navigateToAchievements()

    case .allianceApplication, .allianceApplicationResult:
        // 跳转到联盟页面
        navigateToAlliance()

    default:
        break
    }

    // 标记已读
    Task {
        await viewModel.markAsRead(notification)
    }
}
```

### 优先级 2: 推送通知

- 配置 APNs 证书
- 实现远程推送
- 处理后台通知

### 优先级 3: 通知设置

```swift
struct NotificationSettingsView: View {
    @State private var enableAchievements = true
    @State private var enableEvents = true
    @State private var enableAlliance = true

    var body: some View {
        Form {
            Section(header: Text("通知类型")) {
                Toggle("成就解锁", isOn: $enableAchievements)
                Toggle("活动消息", isOn: $enableEvents)
                Toggle("联盟消息", isOn: $enableAlliance)
            }

            Section(header: Text("推送设置")) {
                Toggle("启用推送通知", isOn: $enablePush)
                Toggle("声音", isOn: $enableSound)
                Toggle("震动", isOn: $enableHaptic)
            }
        }
        .navigationTitle("通知设置")
    }
}
```

---

## 📚 相关文档

- [通知系统测试报告](./notification-test-report.md)
- [通知系统集成报告](./notification-system-integration-report.md)
- [API 文档](./notification-integration-guide.md)

---

**集成完成后，您的用户将能够：**
- ✅ 在消息中心查看所有通知
- ✅ 查看未读通知数量
- ✅ 标记通知为已读
- ✅ 删除不需要的通知
- ✅ 下拉刷新获取最新通知
- ✅ 自动加载更多通知（分页）

**祝集成顺利！** 🎉
