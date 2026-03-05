'use strict';

/**
 * Create user_announcement_reads table
 * Tracks per-user read status for broadcast announcements (type='system')
 */
exports.up = function(knex) {
    return knex.schema.createTable('user_announcement_reads', (table) => {
        table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
        table.uuid('announcement_id').notNullable().references('id').inTable('announcements').onDelete('CASCADE');
        table.timestamp('read_at').defaultTo(knex.fn.now());
        table.primary(['user_id', 'announcement_id']);
    });
};

exports.down = function(knex) {
    return knex.schema.dropTableIfExists('user_announcement_reads');
};
