const { Knex } = require('knex');

/**
 * @param {Knex} knex
 */
exports.up = async function (knex) {
    // 1. 更新 announcements 表，增加 display_style
    const hasDisplayStyle = await knex.schema.hasColumn('announcements', 'display_style');
    if (!hasDisplayStyle) {
        await knex.schema.table('announcements', function (table) {
            table.enum('display_style', ['none', 'marquee', 'popup']).defaultTo('none');
        });
    }

    // 2. 创建 system_messages 表
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
    await knex.schema.dropTableIfExists('system_messages');

    const hasDisplayStyle = await knex.schema.hasColumn('announcements', 'display_style');
    if (hasDisplayStyle) {
        await knex.schema.table('announcements', function (table) {
            table.dropColumn('display_style');
        });
    }
};
