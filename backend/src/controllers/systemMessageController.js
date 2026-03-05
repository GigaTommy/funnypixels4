const UserInbox = require('../models/UserInbox');

class SystemMessageController {
    /**
     * Get user messages (paginated) — single-table query via user_inbox
     */
    static async getUserMessages(req, res) {
        try {
            const userId = req.user.id;
            const { page = 1, limit = 20, type } = req.query;

            // Lazy fan-out broadcasts & announcements into user_inbox
            await UserInbox.materializeBroadcasts(userId);

            const { messages, total } = await UserInbox.getMessages(userId, {
                page: parseInt(page),
                limit: parseInt(limit),
                type
            });

            res.json({
                success: true,
                data: {
                    messages,
                    pagination: {
                        page: parseInt(page),
                        limit: parseInt(limit),
                        total,
                        total_pages: Math.ceil(total / parseInt(limit))
                    }
                }
            });
        } catch (error) {
            console.error('Failed to get user messages:', error);
            res.status(500).json({ success: false, message: '获取系统消息失败' });
        }
    }

    /**
     * Get aggregate unread count
     */
    static async getUnreadCount(req, res) {
        try {
            const userId = req.user.id;

            // Lazy fan-out broadcasts & announcements
            await UserInbox.materializeBroadcasts(userId);

            const counts = await UserInbox.getUnreadCounts(userId);

            res.json({
                success: true,
                data: counts
            });
        } catch (error) {
            console.error('Failed to get unread count:', error);
            res.status(500).json({ success: false, message: '获取未读数失败' });
        }
    }

    /**
     * Mark a single message as read
     */
    static async markAsRead(req, res) {
        try {
            const userId = req.user.id;
            const { messageId } = req.params;

            let updated = await UserInbox.markAsRead(userId, messageId);

            // Fallback: try by source_id (for in-flight old IDs from WebSocket)
            if (updated === 0) {
                updated = await UserInbox.markAsReadBySourceId(userId, messageId);
            }

            if (updated === 0) {
                return res.status(404).json({ success: false, message: '消息不存在或无权访问' });
            }

            res.json({ success: true, message: '已标记为已读' });
        } catch (error) {
            console.error('Failed to mark message as read:', error);
            res.status(500).json({ success: false, message: '操作失败' });
        }
    }

    /**
     * Batch mark messages as read
     */
    static async batchMarkAsRead(req, res) {
        try {
            const userId = req.user.id;
            const { messageIds } = req.body;

            if (!Array.isArray(messageIds) || messageIds.length === 0) {
                return res.status(400).json({ success: false, message: '消息ID列表不能为空' });
            }

            const totalUpdated = await UserInbox.batchMarkAsRead(userId, messageIds);

            res.json({
                success: true,
                message: `已标记 ${totalUpdated} 条消息为已读`,
                data: { updated: totalUpdated }
            });
        } catch (error) {
            console.error('Failed to batch mark messages as read:', error);
            res.status(500).json({ success: false, message: '批量标记失败' });
        }
    }

    /**
     * Batch delete messages (soft delete — works for announcements too)
     */
    static async batchDeleteMessages(req, res) {
        try {
            const userId = req.user.id;
            const { messageIds } = req.body;

            if (!Array.isArray(messageIds) || messageIds.length === 0) {
                return res.status(400).json({ success: false, message: '消息ID列表不能为空' });
            }

            const totalDeleted = await UserInbox.softDelete(userId, messageIds);

            res.json({
                success: true,
                message: `已删除 ${totalDeleted} 条消息`,
                data: { deleted: totalDeleted }
            });
        } catch (error) {
            console.error('Failed to batch delete messages:', error);
            res.status(500).json({ success: false, message: '批量删除失败' });
        }
    }
}

module.exports = SystemMessageController;
