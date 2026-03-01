import SwiftUI

/// 消息中心主视图
public struct NotificationListView: View {
    @EnvironmentObject var viewModel: NotificationViewModel  // ✅ 改为使用 EnvironmentObject
    @Environment(\.dismiss) private var dismiss

    public init() {}  // ✅ 添加 public init

    var body: some View {
        NavigationView {
            ZStack {
                if viewModel.isLoading && viewModel.notifications.isEmpty {
                    // 首次加载状态
                    ProgressView(L10n.Notification.loading)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if viewModel.notifications.isEmpty && !viewModel.isLoading {
                    // 空状态
                    EmptyNotificationsView()
                } else {
                    // 通知列表
                    notificationList
                }
            }
            .navigationTitle(L10n.Notification.title)
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button {
                        dismiss()
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .font(.title3)
                            .foregroundColor(.gray)
                    }
                }

                ToolbarItem(placement: .navigationBarTrailing) {
                    if viewModel.unreadCount > 0 {
                        Button(L10n.Notification.markAllRead) {
                            Task {
                                await viewModel.markAllAsRead()
                            }
                        }
                        .font(.subheadline)
                    }
                }
            }
            .task {
                await viewModel.fetchNotifications()
            }
            .alert(L10n.Notification.error, isPresented: .constant(viewModel.error != nil)) {
                Button(L10n.Notification.ok) {
                    viewModel.clearError()
                }
            } message: {
                if let error = viewModel.error {
                    Text(error)
                }
            }
        }
    }

    private var notificationList: some View {
        List {
            ForEach(viewModel.notifications) { notification in
                NotificationRowView(notification: notification) {
                    Task {
                        await viewModel.markAsRead(notification)
                    }
                }
                .swipeActions(edge: .trailing, allowsFullSwipe: true) {
                    Button(role: .destructive) {
                        Task {
                            await viewModel.deleteNotification(notification)
                        }
                    } label: {
                        Label(L10n.Notification.delete, systemImage: "trash")
                    }
                }
                .onAppear {
                    // 滚动到底部时加载更多
                    if notification.id == viewModel.notifications.last?.id {
                        Task {
                            await viewModel.loadMore()
                        }
                    }
                }
            }

            if viewModel.isLoadingMore {
                HStack {
                    Spacer()
                    ProgressView()
                    Spacer()
                }
                .listRowSeparator(.hidden)
            }
        }
        .listStyle(.plain)
        .refreshable {
            await viewModel.refresh()
        }
    }
}

/// 通知行视图
struct NotificationRowView: View {
    let notification: AppNotification
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(alignment: .top, spacing: 12) {
                // 图标
                iconView

                // 内容
                VStack(alignment: .leading, spacing: 6) {
                    // 标题
                    Text(notification.title)
                        .font(.headline)
                        .foregroundColor(notification.isRead ? .gray : .primary)

                    // 正文
                    Text(notification.content)
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                        .lineLimit(2)

                    // 时间
                    Text(notification.createdAt, style: .relative)
                        .font(.caption)
                        .foregroundColor(.gray)
                }

                Spacer()

                // 未读指示器
                if !notification.isRead {
                    Circle()
                        .fill(Color.blue)
                        .frame(width: 10, height: 10)
                }
            }
            .padding(.vertical, 8)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    private var iconView: some View {
        ZStack {
            Circle()
                .fill(Color(hex: notification.notificationType.color)?.opacity(0.15) ?? Color.gray.opacity(0.15))
                .frame(width: 44, height: 44)

            Image(systemName: notification.notificationType.icon)
                .font(.system(size: 20))
                .foregroundColor(Color(hex: notification.notificationType.color) ?? .gray)
        }
    }
}

/// 空状态视图
struct EmptyNotificationsView: View {
    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: "bell.slash")
                .font(.system(size: 60))
                .foregroundColor(.gray)

            Text(L10n.Notification.emptyTitle)
                .font(.headline)
                .foregroundColor(.gray)

            Text(L10n.Notification.emptyMessage)
                .font(.subheadline)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
        }
        .padding()
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

// MARK: - Previews

#Preview("Notification List") {
    NotificationListView()
        .environmentObject(NotificationViewModel())
}

#Preview("Notification Row - Unread") {
    NotificationRowView(
        notification: AppNotification(
            id: 1,  // ✅ 修复：使用 Int 类型
            userId: "user1",
            type: "achievement",
            title: "🏆 成就解锁",
            message: "恭喜！你解锁了成就「像素大师」，获得100积分",  // ✅ 修复：使用 message
            data: nil,
            isRead: false,
            createdAt: Date(),
            readAt: nil,  // ✅ 添加缺失字段
            updatedAt: nil  // ✅ 添加缺失字段
        ),
        onTap: {}
    )
    .padding()
}

#Preview("Notification Row - Read") {
    NotificationRowView(
        notification: AppNotification(
            id: 2,  // ✅ 修复：使用 Int 类型
            userId: "user1",
            type: "event_reward",
            title: "🎉 活动奖励",
            message: "恭喜！你在「春节赛事」活动中获得第3名，奖励：500积分、100像素点、专属旗帜",  // ✅ 修复：使用 message
            data: nil,
            isRead: true,
            createdAt: Date().addingTimeInterval(-3600),
            readAt: Date(),  // ✅ 添加缺失字段
            updatedAt: nil  // ✅ 添加缺失字段
        ),
        onTap: {}
    )
    .padding()
}

#Preview("Empty State") {
    EmptyNotificationsView()
}
