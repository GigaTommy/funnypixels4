/**
 * Create alliance_activity_log table for tracking alliance events
 */
exports.up = function(knex) {
  return knex.schema.createTable('alliance_activity_log', (table) => {
    table.increments('id').primary();
    table.integer('alliance_id').unsigned().notNullable()
      .references('id').inTable('alliances').onDelete('CASCADE');
    table.uuid('user_id').nullable()
      .references('id').inTable('users').onDelete('SET NULL');
    table.string('username', 100).nullable();
    table.string('action_type', 50).notNullable();
    table.text('detail').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.index(['alliance_id', 'created_at']);
    table.index('action_type');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('alliance_activity_log');
};
