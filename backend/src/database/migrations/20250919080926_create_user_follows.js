/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTableIfNotExists('user_follows', function(table) {
    table.uuid('id').defaultTo(knex.raw('gen_random_uuid()')).primary();
    table.uuid('follower_id').notNullable();
    table.uuid('following_id').notNullable();
    table.timestamps(true, true);

    // Foreign key constraints
    table.foreign('follower_id').references('id').inTable('users').onDelete('CASCADE');
    table.foreign('following_id').references('id').inTable('users').onDelete('CASCADE');

    // Unique constraint to prevent duplicate follows
    table.unique(['follower_id', 'following_id']);

    // Indexes for performance
    table.index('follower_id');
    table.index('following_id');
    table.index('created_at');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTableIfExists('user_follows');
};
