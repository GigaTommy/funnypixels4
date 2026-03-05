'use strict';

const { db } = require('../config/database');

/**
 * UserInbox — unified inbox model
 *
 * All reads go through this single table.
 * Writes are fan-out from notifications, system_messages, and announcements.
 * Broadcast messages (system_messages with receiver_id IS NULL, announcements)
 * are lazily materialized on first read via materializeBroadcasts().
 */
class UserInbox {
    /**
     * Insert a single inbox row (called by dual-write hooks)
     */
    static async insert(data) {
        const [row] = await db('user_inbox')
            .insert({
                user_id: data.user_id,
                source_table: data.source_table,
                source_id: data.source_id,
                sender_id: data.sender_id || null,
                title: data.title,
                content: data.content,
                attachments: data.attachments ? JSON.stringify(data.attachments) : null,
                type: data.type,
                is_read: data.is_read || false,
                read_at: data.read_at || null,
                created_at: data.created_at || new Date()
            })
            .onConflict(['user_id', 'source_table', 'source_id'])
            .ignore()
            .returning('*');

        return row || null;
    }

    /**
     * Bulk insert rows (used by backfill and lazy fan-out)
     */
    static async bulkInsert(rows) {
        if (!rows || rows.length === 0) return 0;

        const result = await db('user_inbox')
            .insert(rows.map(r => ({
                user_id: r.user_id,
                source_table: r.source_table,
                source_id: r.source_id,
                sender_id: r.sender_id || null,
                title: r.title,
                content: r.content,
                attachments: r.attachments ? JSON.stringify(r.attachments) : null,
                type: r.type,
                is_read: r.is_read || false,
                read_at: r.read_at || null,
                created_at: r.created_at || new Date()
            })))
            .onConflict(['user_id', 'source_table', 'source_id'])
            .ignore();

        return result.rowCount || 0;
    }

    /**
     * Paginated inbox query (replaces UNION ALL)
     */
    static async getMessages(userId, { page = 1, limit = 20, type } = {}) {
        const offset = (page - 1) * limit;

        let query = db('user_inbox')
            .where({ user_id: userId, is_deleted: false });

        if (type) {
            query = query.where('type', type);
        }

        // Count total
        const countQuery = query.clone().count('* as count').first();

        // Fetch page
        const messagesQuery = query.clone()
            .select(
                'id',
                'sender_id',
                db.raw('user_id as receiver_id'),
                'title',
                'content',
                'attachments',
                'type',
                'is_read',
                'created_at'
            )
            .orderBy('created_at', 'desc')
            .limit(limit)
            .offset(offset);

        const [countResult, messages] = await Promise.all([countQuery, messagesQuery]);
        const total = parseInt(countResult.count);

        return {
            messages: messages.map(m => ({
                ...m,
                attachments: typeof m.attachments === 'string' ? JSON.parse(m.attachments) : m.attachments
            })),
            total
        };
    }

    /**
     * Unread counts by category (single query with FILTER)
     */
    static async getUnreadCounts(userId) {
        const result = await db.raw(`
            SELECT
                COUNT(*) FILTER (WHERE source_table = 'system_messages' OR type = 'announcement') AS system_unread,
                COUNT(*) FILTER (WHERE source_table = 'notifications' AND type != 'announcement') AS notification_unread,
                COUNT(*) FILTER (WHERE type = 'announcement') AS announcement_unread,
                COUNT(*) AS total_unread
            FROM user_inbox
            WHERE user_id = ? AND is_read = false AND is_deleted = false
        `, [userId]);

        const row = result.rows[0];
        return {
            system_unread: parseInt(row.system_unread) || 0,
            notification_unread: parseInt(row.notification_unread) || 0,
            announcement_unread: parseInt(row.announcement_unread) || 0,
            total_unread: parseInt(row.total_unread) || 0
        };
    }

    /**
     * Mark a single message as read
     */
    static async markAsRead(userId, inboxId) {
        const updated = await db('user_inbox')
            .where({ id: inboxId, user_id: userId, is_deleted: false })
            .update({ is_read: true, read_at: new Date(), updated_at: new Date() });

        return updated;
    }

    /**
     * Mark a message as read by source_id (fallback for in-flight old IDs)
     */
    static async markAsReadBySourceId(userId, sourceId) {
        const updated = await db('user_inbox')
            .where({ user_id: userId, source_id: sourceId, is_deleted: false })
            .update({ is_read: true, read_at: new Date(), updated_at: new Date() });

        return updated;
    }

    /**
     * Batch mark as read
     */
    static async batchMarkAsRead(userId, inboxIds) {
        if (!inboxIds || inboxIds.length === 0) return 0;

        const updated = await db('user_inbox')
            .whereIn('id', inboxIds)
            .where({ user_id: userId, is_deleted: false })
            .update({ is_read: true, read_at: new Date(), updated_at: new Date() });

        return updated;
    }

    /**
     * Soft delete messages (including announcements)
     */
    static async softDelete(userId, inboxIds) {
        if (!inboxIds || inboxIds.length === 0) return 0;

        const deleted = await db('user_inbox')
            .whereIn('id', inboxIds)
            .where({ user_id: userId })
            .update({ is_deleted: true, updated_at: new Date() });

        return deleted;
    }

    /**
     * Lazy fan-out: materialize broadcast system_messages and system announcements
     * into user_inbox for the given user. Uses Redis cooldown to avoid re-running
     * on every request.
     */
    static async materializeBroadcasts(userId) {
        // --- Redis cooldown check ---
        try {
            const { redisUtils } = require('../config/redis');

            const userFanoutTs = await redisUtils.get(`inbox:fanout:${userId}`);
            const globalBroadcastTs = await redisUtils.get('inbox:last_broadcast_at');

            // If user has been fanned out and no new broadcasts since, skip
            if (userFanoutTs && (!globalBroadcastTs || parseInt(userFanoutTs) >= parseInt(globalBroadcastTs))) {
                return;
            }
        } catch (_) {
            // Redis unavailable — fall through and do the fan-out
        }

        // --- 4a. Broadcast system_messages (receiver_id IS NULL) ---
        await db.raw(`
            INSERT INTO user_inbox (user_id, source_table, source_id, sender_id, title, content, attachments, type, created_at)
            SELECT ?::uuid, 'system_messages', sm.id, sm.sender_id, sm.title, sm.content, sm.attachments, sm.type, sm.created_at
            FROM system_messages sm
            WHERE sm.receiver_id IS NULL
              AND (sm.expires_at IS NULL OR sm.expires_at > NOW())
              AND NOT EXISTS (
                  SELECT 1 FROM user_inbox ui
                  WHERE ui.user_id = ?::uuid AND ui.source_table = 'system_messages' AND ui.source_id = sm.id
              )
            ON CONFLICT DO NOTHING
        `, [userId, userId]);

        // --- 4b. System announcements (type='system', active, not expired) ---
        await db.raw(`
            INSERT INTO user_inbox (user_id, source_table, source_id, sender_id, title, content, type, created_at)
            SELECT ?::uuid, 'announcements', a.id, a.author_id, a.title, a.content, 'announcement', a.publish_at
            FROM announcements a
            WHERE a.type = 'system' AND a.is_active = true AND a.publish_at <= NOW()
              AND (a.expire_at IS NULL OR a.expire_at > NOW())
              AND NOT EXISTS (
                  SELECT 1 FROM user_inbox ui
                  WHERE ui.user_id = ?::uuid AND ui.source_table = 'announcements' AND ui.source_id = a.id
              )
            ON CONFLICT DO NOTHING
        `, [userId, userId]);

        // --- 4c. Restore read status from user_announcement_reads ---
        await db.raw(`
            UPDATE user_inbox
            SET is_read = true, read_at = uar.read_at
            FROM user_announcement_reads uar
            WHERE user_inbox.user_id = uar.user_id
              AND user_inbox.source_table = 'announcements'
              AND user_inbox.source_id = uar.announcement_id
              AND user_inbox.user_id = ?::uuid
              AND user_inbox.is_read = false
        `, [userId]);

        // --- 4d. Update Redis cooldown ---
        try {
            const { redisUtils } = require('../config/redis');
            await redisUtils.setex(`inbox:fanout:${userId}`, 300, Date.now().toString());
        } catch (_) {
            // ignore Redis errors
        }
    }
}

module.exports = UserInbox;
