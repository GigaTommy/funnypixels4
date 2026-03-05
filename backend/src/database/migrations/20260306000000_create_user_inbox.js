'use strict';

/**
 * Create user_inbox table
 * Unified inbox: fan-out from notifications, system_messages, announcements into a single table
 * for efficient single-table reads, pagination, and consistent read/delete semantics.
 */
exports.up = function(knex) {
    return knex.schema.createTable('user_inbox', (table) => {
        table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
        table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
        table.string('source_table', 20).notNullable(); // 'notifications' | 'system_messages' | 'announcements'
        table.uuid('source_id').notNullable();
        table.uuid('sender_id').references('id').inTable('users').onDelete('SET NULL');
        table.string('title', 255).notNullable();
        table.text('content').notNullable();
        table.jsonb('attachments');
        table.string('type', 50).notNullable();
        table.boolean('is_read').defaultTo(false);
        table.timestamp('read_at');
        table.boolean('is_deleted').defaultTo(false);
        table.timestamps(true, true); // created_at, updated_at

        // Core query index: user's inbox sorted by time
        table.index(['user_id', 'is_deleted', 'created_at'], 'idx_user_inbox_main');

        // Unread count index (partial)
        table.index(['user_id', 'is_read', 'is_deleted'], 'idx_user_inbox_unread');

        // Source lookup (for dedup and back-reference)
        table.index(['source_table', 'source_id'], 'idx_user_inbox_source');

        // Unique constraint to prevent duplicate fan-out
        table.unique(['user_id', 'source_table', 'source_id'], { indexName: 'idx_user_inbox_unique' });
    });
};

exports.down = function(knex) {
    return knex.schema.dropTableIfExists('user_inbox');
};
