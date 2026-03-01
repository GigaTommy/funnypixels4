
const { Knex } = require('knex');

/**
 * @param {Knex} knex
 */
exports.up = async function (knex) {
    // 1. Ensure announcements table has display_style
    const hasDisplayStyle = await knex.schema.hasColumn('announcements', 'display_style');
    if (!hasDisplayStyle) {
        await knex.schema.table('announcements', function (table) {
            table.enum('display_style', ['none', 'marquee', 'popup']).defaultTo('none');
        });
    }

    // 2. Ensure system_messages table exists
    const hasSystemMessages = await knex.schema.hasTable('system_messages');
    if (!hasSystemMessages) {
        await knex.schema.createTable('system_messages', function (table) {
            table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
            table.uuid('sender_id').references('id').inTable('users').onDelete('SET NULL').nullable(); // 管理员ID
            table.uuid('receiver_id').references('id').inTable('users').onDelete('CASCADE').nullable(); // 接收者，NULL表示广播
            table.string('title', 255).notNullable();
            table.text('content').notNullable();
            table.jsonb('attachments').nullable(); // {"coins": 100, "items": [...]}
            table.enum('type', ['notification', 'reward', 'activity']).defaultTo('notification');
            table.boolean('is_read').defaultTo(false);
            table.timestamp('read_at').nullable();
            table.timestamp('expires_at').nullable();
            table.timestamps(true, true);

            // 索引
            table.index(['receiver_id', 'is_read', 'created_at']);
            table.index(['type', 'created_at']);
        });
    }
};

/**
 * @param {Knex} knex
 */
exports.down = async function (knex) {
    // We don't want to drop table if it existed before, but for revert symmetry:
    // This is a fix migration, usually safe to leave empty or revert strictly what was added.
    // Logic is conditional, so down logic is tricky.
    // For now, leave empty to prevent accidental data loss on rollback of this fix.
};
