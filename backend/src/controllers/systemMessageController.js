const { db: knex } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

class SystemMessageController {
    /**
     * Get user system messages (paginated)
     */
    static async getUserMessages(req, res) {
        try {
            const userId = req.user.id;
            const { page = 1, limit = 20, type } = req.query;
            const offset = (page - 1) * limit;

            let query = knex('system_messages')
                .where(qb => {
                    qb.where('receiver_id', userId)
                        .orWhereNull('receiver_id'); // Broadcast messages
                })
                .orderBy('created_at', 'desc');

            if (type) {
                query = query.where('type', type);
            }

            const messages = await query
                .limit(limit)
                .offset(offset)
                .select('*');

            const total = await knex('system_messages')
                .where(qb => {
                    qb.where('receiver_id', userId)
                        .orWhereNull('receiver_id');
                })
                .count('* as count')
                .first();

            res.json({
                success: true,
                data: {
                    messages: messages.map(m => ({
                        ...m,
                        attachments: typeof m.attachments === 'string' ? JSON.parse(m.attachments) : m.attachments
                    })),
                    pagination: {
                        page: parseInt(page),
                        limit: parseInt(limit),
                        total: parseInt(total.count),
                        total_pages: Math.ceil(total.count / limit)
                    }
                }
            });
        } catch (error) {
            console.error('Failed to get user messages:', error);
            res.status(500).json({ success: false, message: '获取系统消息失败' });
        }
    }

    /**
     * Get aggregate unread count (system messages + notifications)
     */
    static async getUnreadCount(req, res) {
        try {
            const userId = req.user.id;

            // 1. Unread system messages - 使用与消息列表相同的查询逻辑
            const sysUnread = await knex('system_messages')
                .where('is_read', false)
                .andWhere(qb => {
                    qb.where('receiver_id', userId)
                        .orWhereNull('receiver_id'); // 包括广播消息
                })
                .count('* as count')
                .first();

            // 2. Unread notifications
            const notiUnread = await knex('notifications')
                .where({ user_id: userId, is_read: false })
                .count('* as count')
                .first();

            res.json({
                success: true,
                data: {
                    system_unread: parseInt(sysUnread.count),
                    notification_unread: parseInt(notiUnread.count),
                    total_unread: parseInt(sysUnread.count) + parseInt(notiUnread.count)
                }
            });
        } catch (error) {
            console.error('Failed to get unread count:', error);
            res.status(500).json({ success: false, message: '获取未读数失败' });
        }
    }

    /**
     * Mark a system message as read
     */
    static async markAsRead(req, res) {
        try {
            const userId = req.user.id;
            const { messageId } = req.params;

            const updated = await knex('system_messages')
                .where({ id: messageId })
                .andWhere(qb => {
                    qb.where('receiver_id', userId).orWhereNull('receiver_id');
                })
                .update({
                    is_read: true,
                    read_at: new Date()
                });

            if (updated === 0) {
                return res.status(404).json({ success: false, message: '消息不存在或无权访问' });
            }

            res.json({ success: true, message: '已标记为已读' });
        } catch (error) {
            console.error('Failed to mark message as read:', error);
            res.status(500).json({ success: false, message: '操作失败' });
        }
    }
}

module.exports = SystemMessageController;
