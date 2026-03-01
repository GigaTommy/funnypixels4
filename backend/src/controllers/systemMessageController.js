const { db: knex } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

class SystemMessageController {
    /**
     * Get user system messages (paginated)
     * 合并 system_messages 和 notifications 两个表的数据
     */
    static async getUserMessages(req, res) {
        try {
            const userId = req.user.id;
            const { page = 1, limit = 20, type } = req.query;
            const offset = (page - 1) * limit;

            // 1. 获取 system_messages（广播消息）
            let sysQuery = knex('system_messages')
                .where(qb => {
                    qb.where('receiver_id', userId)
                        .orWhereNull('receiver_id'); // Broadcast messages
                })
                .select(
                    'id',  // ✅ UUID类型，与notifications统一
                    'sender_id',
                    'receiver_id',
                    'title',
                    'content',  // iOS期望的字段名
                    'attachments',
                    'type',
                    'is_read',
                    'created_at'
                );

            if (type) {
                sysQuery = sysQuery.where('type', type);
            }

            // 2. 获取 notifications（个人通知）
            let notifQuery = knex('notifications')
                .where('user_id', userId)
                .select(
                    'id',  // ✅ 已迁移为UUID，无需CAST
                    knex.raw('NULL as sender_id'),
                    knex.raw('user_id as receiver_id'),
                    'title',
                    knex.raw('message as content'),  // message -> content 映射
                    knex.raw('data as attachments'),  // data -> attachments 映射
                    'type',
                    'is_read',
                    'created_at'
                );

            if (type) {
                notifQuery = notifQuery.where('type', type);
            }

            // 3. 合并查询结果并按创建时间排序
            const allMessages = await knex.raw(`
                (${sysQuery.toString()})
                UNION ALL
                (${notifQuery.toString()})
                ORDER BY created_at DESC
                LIMIT ? OFFSET ?
            `, [limit, offset]);

            // 4. 统计总数
            const totalSys = await knex('system_messages')
                .where(qb => {
                    qb.where('receiver_id', userId).orWhereNull('receiver_id');
                })
                .modify(qb => { if (type) qb.where('type', type); })
                .count('* as count')
                .first();

            const totalNotif = await knex('notifications')
                .where('user_id', userId)
                .modify(qb => { if (type) qb.where('type', type); })
                .count('* as count')
                .first();

            const total = parseInt(totalSys.count) + parseInt(totalNotif.count);

            res.json({
                success: true,
                data: {
                    messages: allMessages.rows.map(m => ({
                        ...m,
                        attachments: typeof m.attachments === 'string' ? JSON.parse(m.attachments) : m.attachments
                    })),
                    pagination: {
                        page: parseInt(page),
                        limit: parseInt(limit),
                        total: total,
                        total_pages: Math.ceil(total / limit)
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
     * 支持标记 system_messages 或 notifications（两者ID均为UUID）
     */
    static async markAsRead(req, res) {
        try {
            const userId = req.user.id;
            const { messageId } = req.params;

            let updated = 0;

            // ✅ 两个表的ID均为UUID，统一处理
            // 先尝试 system_messages
            updated = await knex('system_messages')
                .where({ id: messageId })
                .andWhere(qb => {
                    qb.where('receiver_id', userId).orWhereNull('receiver_id');
                })
                .update({
                    is_read: true,
                    read_at: new Date()
                });

            // 如果没找到，再尝试 notifications
            if (updated === 0) {
                updated = await knex('notifications')
                    .where({
                        id: messageId,
                        user_id: userId
                    })
                    .update({
                        is_read: true,
                        read_at: new Date(),
                        updated_at: new Date()
                    });
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
     * 批量标记消息为已读
     */
    static async batchMarkAsRead(req, res) {
        try {
            const userId = req.user.id;
            const { messageIds } = req.body;

            if (!Array.isArray(messageIds) || messageIds.length === 0) {
                return res.status(400).json({ success: false, message: '消息ID列表不能为空' });
            }

            let totalUpdated = 0;

            // 批量更新 system_messages
            const sysUpdated = await knex('system_messages')
                .whereIn('id', messageIds)
                .andWhere(qb => {
                    qb.where('receiver_id', userId).orWhereNull('receiver_id');
                })
                .update({
                    is_read: true,
                    read_at: new Date()
                });

            totalUpdated += sysUpdated;

            // 批量更新 notifications
            const notifUpdated = await knex('notifications')
                .whereIn('id', messageIds)
                .where('user_id', userId)
                .update({
                    is_read: true,
                    read_at: new Date(),
                    updated_at: new Date()
                });

            totalUpdated += notifUpdated;

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
     * Batch delete messages
     * 批量删除消息
     */
    static async batchDeleteMessages(req, res) {
        try {
            const userId = req.user.id;
            const { messageIds } = req.body;

            if (!Array.isArray(messageIds) || messageIds.length === 0) {
                return res.status(400).json({ success: false, message: '消息ID列表不能为空' });
            }

            let totalDeleted = 0;

            // 批量删除 system_messages（只能删除属于自己的，不能删除广播消息）
            const sysDeleted = await knex('system_messages')
                .whereIn('id', messageIds)
                .where('receiver_id', userId)
                .del();

            totalDeleted += sysDeleted;

            // 批量删除 notifications
            const notifDeleted = await knex('notifications')
                .whereIn('id', messageIds)
                .where('user_id', userId)
                .del();

            totalDeleted += notifDeleted;

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
