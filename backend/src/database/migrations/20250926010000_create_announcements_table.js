const { Knex } = require('knex');

/**
 * @param {Knex} knex
 */
exports.up = function(knex) {
  return knex.schema.createTable('announcements', function(table) {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('author_id').references('id').inTable('users').onDelete('CASCADE').notNullable();
    table.string('title', 255).notNullable();
    table.text('content').notNullable();
    table.enum('type', ['global', 'system', 'alliance']).notNullable();
    table.integer('alliance_id').unsigned().references('id').inTable('alliances').onDelete('CASCADE').nullable();
    table.boolean('is_active').defaultTo(true);
    table.boolean('is_pinned').defaultTo(false);
    table.integer('priority').defaultTo(0);
    table.timestamp('publish_at').defaultTo(knex.fn.now());
    table.timestamp('expire_at').nullable();
    table.timestamps(true, true);

    // 索引
    table.index(['type', 'is_active', 'publish_at']);
    table.index(['alliance_id', 'is_active', 'publish_at']);
    table.index(['is_pinned', 'priority', 'publish_at']);
  });
};

/**
 * @param {Knex} knex
 */
exports.down = function(knex) {
  return knex.schema.dropTableIfExists('announcements');
};