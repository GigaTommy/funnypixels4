'use strict';

/**
 * Backfill user_inbox from existing notifications and directed system_messages.
 * Broadcast system_messages and announcements are NOT backfilled here — they use
 * lazy fan-out (materializeBroadcasts) at read time.
 *
 * Uses batched raw INSERT ... SELECT ... ON CONFLICT DO NOTHING for efficiency.
 */
exports.up = async function(knex) {
    const BATCH_SIZE = 5000;

    // 2a. notifications → user_inbox (each notification already has a user_id)
    let offset = 0;
    while (true) {
        const result = await knex.raw(`
            INSERT INTO user_inbox (user_id, source_table, source_id, title, content, attachments, type, is_read, read_at, created_at)
            SELECT n.user_id, 'notifications', n.id::uuid, n.title, n.message, n.data, n.type, n.is_read, n.read_at, n.created_at
            FROM notifications n
            ORDER BY n.id
            LIMIT ?
            OFFSET ?
            ON CONFLICT DO NOTHING
        `, [BATCH_SIZE, offset]);

        const inserted = result.rowCount || 0;
        if (inserted < BATCH_SIZE) break;
        offset += BATCH_SIZE;
    }

    // 2b. system_messages WHERE receiver_id IS NOT NULL → user_inbox (directed messages)
    offset = 0;
    while (true) {
        const result = await knex.raw(`
            INSERT INTO user_inbox (user_id, source_table, source_id, sender_id, title, content, attachments, type, is_read, read_at, created_at)
            SELECT sm.receiver_id, 'system_messages', sm.id, sm.sender_id, sm.title, sm.content, sm.attachments, sm.type, sm.is_read, sm.read_at, sm.created_at
            FROM system_messages sm
            WHERE sm.receiver_id IS NOT NULL
            ORDER BY sm.id
            LIMIT ?
            OFFSET ?
            ON CONFLICT DO NOTHING
        `, [BATCH_SIZE, offset]);

        const inserted = result.rowCount || 0;
        if (inserted < BATCH_SIZE) break;
        offset += BATCH_SIZE;
    }
};

exports.down = async function(knex) {
    // Truncate the backfilled data (table itself is dropped by the previous migration's down)
    await knex('user_inbox').del();
};
