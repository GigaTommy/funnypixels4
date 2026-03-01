import SwiftUI

/// 通知中心 ViewModel
@MainActor
class NotificationViewModel: ObservableObject {
    // MARK: - Published Properties

    @Published var notifications: [AppNotification] = []
    @Published var unreadCount: Int = 0
    @Published var isLoading = false
    @Published var isLoadingMore = false
    @Published var error: String?

    // MARK: - Private Properties

    private var currentPage = 1
    private var hasMorePages = true
    private var totalPages = 1

    // MARK: - Public Methods

    /// 获取通知列表（首次加载）
    func fetchNotifications() async {
        guard !isLoading else { return }

        isLoading = true
        error = nil
        currentPage = 1
        hasMorePages = true

        defer { isLoading = false }

        do {
            let response = try await APIManager.shared.fetchNotifications(page: currentPage)
            notifications = response.data.notifications
            totalPages = response.data.pagination.totalPages
            hasMorePages = currentPage < totalPages

            await fetchUnreadCount()

        } catch {
            self.error = error.localizedDescription
            print("❌ Failed to fetch notifications: \(error)")
        }
    }

    /// 加载更多通知（分页）
    func loadMore() async {
        guard !isLoadingMore && !isLoading && hasMorePages else { return }

        isLoadingMore = true
        defer { isLoadingMore = false }

        currentPage += 1

        do {
            let response = try await APIManager.shared.fetchNotifications(page: currentPage)
            notifications.append(contentsOf: response.data.notifications)
            hasMorePages = currentPage < response.data.pagination.totalPages

        } catch {
            currentPage -= 1  // 回退页码
            print("❌ Failed to load more notifications: \(error)")
        }
    }

    /// 获取未读通知数量
    func fetchUnreadCount() async {
        do {
            unreadCount = try await APIManager.shared.getUnreadNotificationCount()
        } catch {
            print("❌ Failed to fetch unread count: \(error)")
        }
    }

    /// 标记通知为已读
    /// - Parameter notification: 要标记的通知
    func markAsRead(_ notification: AppNotification) async {
        guard !notification.isRead else { return }

        do {
            try await APIManager.shared.markNotificationAsRead(notification.id)

            // 更新本地状态
            if let index = notifications.firstIndex(where: { $0.id == notification.id }) {
                notifications[index].isRead = true
            }

            // 更新未读数量
            if unreadCount > 0 {
                unreadCount -= 1
            }

        } catch {
            print("❌ Failed to mark as read: \(error)")
            self.error = "标记已读失败"
        }
    }

    /// 标记所有通知为已读
    func markAllAsRead() async {
        do {
            try await APIManager.shared.markAllNotificationsAsRead()

            // 更新本地状态
            notifications = notifications.map { notification in
                var updated = notification
                updated.isRead = true
                return updated
            }

            unreadCount = 0

        } catch {
            self.error = "全部标记已读失败"
            print("❌ Failed to mark all as read: \(error)")
        }
    }

    /// 删除通知
    /// - Parameter notification: 要删除的通知
    func deleteNotification(_ notification: AppNotification) async {
        do {
            try await APIManager.shared.deleteNotification(notification.id)

            // 从本地列表中移除
            notifications.removeAll { $0.id == notification.id }

            // 如果是未读通知，更新未读数量
            if !notification.isRead && unreadCount > 0 {
                unreadCount -= 1
            }

        } catch {
            self.error = "删除通知失败"
            print("❌ Failed to delete notification: \(error)")
        }
    }

    /// 刷新通知列表
    func refresh() async {
        await fetchNotifications()
    }

    /// 清除错误信息
    func clearError() {
        error = nil
    }
}
