import Foundation

/// 本地化字符串管理
/// 提供应用中所有文本的多语言支持
enum L10n {

    // MARK: - Notification Center

    enum Notification {
        /// 消息中心
        static let title = NSLocalizedString("notification.title", value: "消息中心", comment: "Notification center title")

        /// 加载中...
        static let loading = NSLocalizedString("notification.loading", value: "加载中...", comment: "Loading notifications")

        /// 全部已读
        static let markAllRead = NSLocalizedString("notification.markAllRead", value: "全部已读", comment: "Mark all as read button")

        /// 删除
        static let delete = NSLocalizedString("notification.delete", value: "删除", comment: "Delete button")

        /// 错误
        static let error = NSLocalizedString("notification.error", value: "错误", comment: "Error alert title")

        /// 确定
        static let ok = NSLocalizedString("notification.ok", value: "确定", comment: "OK button")

        // MARK: Empty State

        /// 暂无消息
        static let emptyTitle = NSLocalizedString("notification.empty.title", value: "暂无消息", comment: "Empty notification title")

        /// 成就、活动奖励等消息会在这里显示
        static let emptyMessage = NSLocalizedString("notification.empty.message", value: "成就、活动奖励等消息会在这里显示", comment: "Empty notification message")
    }

    // MARK: - Notification Types

    enum NotificationType {
        /// 成就
        static let achievement = NSLocalizedString("notification.type.achievement", value: "成就", comment: "Achievement notification type")

        /// 活动奖励
        static let eventReward = NSLocalizedString("notification.type.eventReward", value: "活动奖励", comment: "Event reward notification type")

        /// 活动结束
        static let eventEnded = NSLocalizedString("notification.type.eventEnded", value: "活动结束", comment: "Event ended notification type")

        /// 活动开始
        static let eventStarted = NSLocalizedString("notification.type.eventStarted", value: "活动开始", comment: "Event started notification type")

        /// 联盟申请
        static let allianceApplication = NSLocalizedString("notification.type.allianceApplication", value: "联盟申请", comment: "Alliance application notification type")

        /// 申请结果
        static let allianceResult = NSLocalizedString("notification.type.allianceResult", value: "申请结果", comment: "Alliance result notification type")

        /// 系统消息
        static let system = NSLocalizedString("notification.type.system", value: "系统消息", comment: "System notification type")
    }

    // MARK: - Common

    enum Common {
        /// 确定
        static let ok = NSLocalizedString("common.ok", value: "确定", comment: "OK button")

        /// 取消
        static let cancel = NSLocalizedString("common.cancel", value: "取消", comment: "Cancel button")

        /// 删除
        static let delete = NSLocalizedString("common.delete", value: "删除", comment: "Delete button")

        /// 错误
        static let error = NSLocalizedString("common.error", value: "错误", comment: "Error title")

        /// 加载中
        static let loading = NSLocalizedString("common.loading", value: "加载中", comment: "Loading indicator")
    }
}
