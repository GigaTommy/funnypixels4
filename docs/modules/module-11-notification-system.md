# Module 11: 通知与Badge系统 - 技术方案

> **模块代号**: Module 11
> **模块名称**: 通知与Badge系统 (Notification & Badge System)
> **依赖模块**: Module 1 (Feed), Module 3 (评论)
> **预计工作量**: 1周 (约40小时)
> **优先级**: 高 (用户留存关键)

---

## 一、产品需求概要

### 核心功能
1. **Push通知**: APNs推送（点赞、评论、关注等）
2. **应用内通知**: 实时Badge更新、通知中心
3. **通知中心**: 查看历史通知、标记已读
4. **通知偏好**: 用户可自定义通知类型开关
5. **DeepLink跳转**: 点击通知跳转到对应页面

---

## 二、数据库设计

### notifications 表

```sql
CREATE TABLE notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,               -- 'like', 'comment', 'follow', 'alliance', 'task', 'rank'
  title VARCHAR(200) NOT NULL,
  body TEXT NOT NULL,

  -- 关联数据
  related_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  related_feed_id INTEGER REFERENCES feed_items(id) ON DELETE SET NULL,
  related_comment_id INTEGER REFERENCES feed_comments(id) ON DELETE SET NULL,

  -- 深链数据
  deep_link VARCHAR(500),                  -- 'funnypixels://feed/123', 'funnypixels://profile/456'

  is_read BOOLEAN DEFAULT FALSE,
  is_pushed BOOLEAN DEFAULT FALSE,         -- 是否已推送APNs

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id, created_at DESC);
CREATE INDEX idx_notifications_unread ON notifications(user_id, is_read) WHERE is_read = FALSE;
```

### user_notification_settings 表

```sql
CREATE TABLE user_notification_settings (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,

  -- 推送开关
  push_enabled BOOLEAN DEFAULT TRUE,
  like_enabled BOOLEAN DEFAULT TRUE,
  comment_enabled BOOLEAN DEFAULT TRUE,
  follow_enabled BOOLEAN DEFAULT TRUE,
  alliance_enabled BOOLEAN DEFAULT TRUE,
  task_enabled BOOLEAN DEFAULT TRUE,
  rank_enabled BOOLEAN DEFAULT TRUE,

  -- 免打扰时段
  quiet_hours_start TIME,
  quiet_hours_end TIME,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

---

## 三、Backend API

### 3.1 获取通知列表

**Endpoint**: `GET /api/notifications?limit=20&offset=0&filter=unread`

**Response**:
```json
{
  "notifications": [
    {
      "id": 123,
      "type": "like",
      "title": "新点赞",
      "body": "张三 赞了你的动态",
      "related_user": {
        "id": 456,
        "username": "张三",
        "avatar_url": "https://..."
      },
      "deep_link": "funnypixels://feed/789",
      "is_read": false,
      "created_at": "2026-02-28T15:30:00Z"
    }
  ],
  "unread_count": 5
}
```

### 3.2 标记已读

**Endpoint**: `POST /api/notifications/:id/read`

**Response**:
```json
{
  "success": true
}
```

### 3.3 通知设置

**Endpoint**: `GET /api/notifications/settings`

**Response**:
```json
{
  "push_enabled": true,
  "like_enabled": true,
  "comment_enabled": false,
  "quiet_hours_start": "22:00",
  "quiet_hours_end": "08:00"
}
```

---

## 四、通知生成服务

### backend/src/services/notificationService.js

```javascript
const db = require('../config/database');
const { sendAPNs } = require('./apnsService');

/**
 * 创建通知
 */
async function createNotification(data) {
  const { userId, type, title, body, relatedUserId, relatedFeedId, relatedCommentId, deepLink } = data;

  // 检查用户通知设置
  const settings = await db('user_notification_settings').where({ user_id: userId }).first();
  if (!settings || !settings[`${type}_enabled`]) {
    console.log(`Notification ${type} disabled for user ${userId}`);
    return;
  }

  // 插入通知记录
  const [notification] = await db('notifications').insert({
    user_id: userId,
    type,
    title,
    body,
    related_user_id: relatedUserId,
    related_feed_id: relatedFeedId,
    related_comment_id: relatedCommentId,
    deep_link: deepLink
  }).returning('*');

  // 推送APNs（异步）
  if (settings.push_enabled) {
    sendAPNs(userId, {
      title,
      body,
      deepLink,
      badge: await getUnreadCount(userId)
    }).catch(err => console.error('APNs failed:', err));

    await db('notifications').where({ id: notification.id }).update({ is_pushed: true });
  }

  // 更新未读计数（Redis）
  await require('../utils/redis').hincrby('unread_notifications', userId, 1);

  return notification;
}

/**
 * 获取未读数量
 */
async function getUnreadCount(userId) {
  const result = await db('notifications')
    .where({ user_id: userId, is_read: false })
    .count('id as count')
    .first();
  return parseInt(result.count);
}

/**
 * 通知类型快捷方法
 */
async function notifyLike(feedItem, liker) {
  await createNotification({
    userId: feedItem.user_id,
    type: 'like',
    title: '新点赞',
    body: `${liker.username} 赞了你的动态`,
    relatedUserId: liker.id,
    relatedFeedId: feedItem.id,
    deepLink: `funnypixels://feed/${feedItem.id}`
  });
}

async function notifyComment(feedItem, commenter, comment) {
  await createNotification({
    userId: feedItem.user_id,
    type: 'comment',
    title: '新评论',
    body: `${commenter.username}: ${comment.content.substring(0, 50)}...`,
    relatedUserId: commenter.id,
    relatedFeedId: feedItem.id,
    relatedCommentId: comment.id,
    deepLink: `funnypixels://feed/${feedItem.id}`
  });
}

async function notifyFollow(followedUserId, follower) {
  await createNotification({
    userId: followedUserId,
    type: 'follow',
    title: '新关注',
    body: `${follower.username} 关注了你`,
    relatedUserId: follower.id,
    deepLink: `funnypixels://profile/${follower.id}`
  });
}

module.exports = {
  createNotification,
  getUnreadCount,
  notifyLike,
  notifyComment,
  notifyFollow
};
```

---

## 五、APNs 推送服务

### backend/src/services/apnsService.js

```javascript
const apn = require('apn');
const db = require('../config/database');

// APNs Provider配置
const apnProvider = new apn.Provider({
  token: {
    key: process.env.APNS_KEY_PATH,
    keyId: process.env.APNS_KEY_ID,
    teamId: process.env.APNS_TEAM_ID
  },
  production: process.env.NODE_ENV === 'production'
});

/**
 * 发送APNs推送
 */
async function sendAPNs(userId, payload) {
  const { title, body, deepLink, badge } = payload;

  // 查询用户设备Token
  const devices = await db('user_devices')
    .where({ user_id: userId, platform: 'ios' })
    .pluck('push_token');

  if (devices.length === 0) {
    console.log(`No devices found for user ${userId}`);
    return;
  }

  // 构建通知
  const notification = new apn.Notification({
    alert: { title, body },
    badge: badge || 1,
    sound: 'default',
    topic: 'com.funnypixels.app',
    payload: { deepLink }
  });

  // 发送
  const result = await apnProvider.send(notification, devices);
  console.log(`APNs sent to ${devices.length} devices. Failed: ${result.failed.length}`);

  return result;
}

module.exports = { sendAPNs };
```

---

## 六、iOS Frontend

### 6.1 NotificationService.swift

```swift
import Foundation
import Combine
import UserNotifications

class NotificationService: ObservableObject {
    static let shared = NotificationService()

    @Published var unreadCount: Int = 0
    @Published var notifications: [Notification] = []

    private var cancellables = Set<AnyCancellable>()
    private let apiClient = APIClient.shared

    func requestPermission() {
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .badge, .sound]) { granted, error in
            if granted {
                DispatchQueue.main.async {
                    UIApplication.shared.registerForRemoteNotifications()
                }
            }
        }
    }

    func registerDeviceToken(_ token: Data) {
        let tokenString = token.map { String(format: "%02.2hhx", $0) }.joined()
        print("Device Token: \(tokenString)")

        // 发送到后端
        let endpoint = APIEndpoint.notifications.appendingPathComponent("device-token")
        apiClient.request(url: endpoint, method: "POST", body: ["token": tokenString])
            .sink { completion in } receiveValue: { _ in }
            .store(in: &cancellables)
    }

    func fetchNotifications(limit: Int = 20, offset: Int = 0) {
        let endpoint = APIEndpoint.notifications
        var components = URLComponents(url: endpoint, resolvingAgainstBaseURL: false)!
        components.queryItems = [
            URLQueryItem(name: "limit", value: "\(limit)"),
            URLQueryItem(name: "offset", value: "\(offset)")
        ]

        apiClient.request(url: components.url!, method: "GET", body: nil as String?)
            .decode(type: NotificationListResponse.self, decoder: JSONDecoder.snakeCase)
            .sink { completion in } receiveValue: { [weak self] response in
                self?.notifications = response.notifications
                self?.unreadCount = response.unreadCount
            }
            .store(in: &cancellables)
    }

    func markAsRead(notificationId: Int) {
        let endpoint = APIEndpoint.notifications.appendingPathComponent("\(notificationId)/read")

        apiClient.request(url: endpoint, method: "POST", body: nil as String?)
            .sink { completion in } receiveValue: { [weak self] _ in
                if let index = self?.notifications.firstIndex(where: { $0.id == notificationId }) {
                    self?.notifications[index].isRead = true
                    self?.unreadCount -= 1
                }
            }
            .store(in: &cancellables)
    }
}

struct NotificationListResponse: Codable {
    let notifications: [Notification]
    let unreadCount: Int
}

struct Notification: Codable, Identifiable {
    let id: Int
    let type: String
    let title: String
    let body: String
    let relatedUser: User?
    let deepLink: String?
    var isRead: Bool
    let createdAt: Date
}
```

### 6.2 NotificationCenterView.swift

```swift
struct NotificationCenterView: View {
    @StateObject private var service = NotificationService.shared

    var body: some View {
        List {
            ForEach(service.notifications) { notification in
                NotificationRow(notification: notification) {
                    service.markAsRead(notificationId: notification.id)
                    handleDeepLink(notification.deepLink)
                }
            }
        }
        .navigationTitle("通知")
        .onAppear {
            service.fetchNotifications()
        }
    }

    func handleDeepLink(_ deepLink: String?) {
        guard let deepLink = deepLink,
              let url = URL(string: deepLink) else { return }

        // DeepLink 路由处理
        DeepLinkHandler.shared.handle(url: url)
    }
}

struct NotificationRow: View {
    let notification: Notification
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 12) {
                if let user = notification.relatedUser {
                    AsyncImage(url: URL(string: user.avatarUrl ?? "")) { image in
                        image.resizable()
                    } placeholder: {
                        Circle().fill(Color.gray)
                    }
                    .frame(width: 50, height: 50)
                    .clipShape(Circle())
                }

                VStack(alignment: .leading, spacing: 4) {
                    Text(notification.title)
                        .font(.headline)
                        .foregroundColor(notification.isRead ? .secondary : .primary)

                    Text(notification.body)
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                        .lineLimit(2)

                    Text(formatDate(notification.createdAt))
                        .font(.caption)
                        .foregroundColor(.secondary)
                }

                Spacer()

                if !notification.isRead {
                    Circle()
                        .fill(Color.blue)
                        .frame(width: 8, height: 8)
                }
            }
        }
        .buttonStyle(PlainButtonStyle())
    }

    func formatDate(_ date: Date) -> String {
        let formatter = RelativeDateTimeFormatter()
        return formatter.localizedString(for: date, relativeTo: Date())
    }
}
```

### 6.3 AppDelegate 集成

```swift
// AppDelegate.swift
func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
    NotificationService.shared.registerDeviceToken(deviceToken)
}

func application(_ application: UIApplication, didReceiveRemoteNotification userInfo: [AnyHashable: Any]) {
    // 处理推送通知
    if let deepLink = userInfo["deepLink"] as? String,
       let url = URL(string: deepLink) {
        DeepLinkHandler.shared.handle(url: url)
    }

    // 刷新通知列表
    NotificationService.shared.fetchNotifications()
}
```

---

## 七、实施步骤

| 任务 | 时间 |
|------|------|
| 数据库设计 | 3h |
| 通知生成服务 | 6h |
| APNs推送集成 | 8h |
| iOS Push注册 | 4h |
| iOS NotificationService | 5h |
| iOS NotificationCenterView | 6h |
| DeepLink路由 | 5h |
| 测试（端到端） | 8h |

**总计**: 约45小时

---

## 八、验收标准

- [ ] 用户收到点赞/评论/关注推送通知
- [ ] 应用内Badge正确显示未读数量
- [ ] 通知中心正确显示历史通知
- [ ] 点击通知可跳转到对应页面
- [ ] 用户可自定义通知偏好
- [ ] 免打扰时段生效

---

**文档版本**: v1.0
**最后更新**: 2026-02-28
