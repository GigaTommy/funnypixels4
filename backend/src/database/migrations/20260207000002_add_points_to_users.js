/**
 * Add points column to users table for check-in rewards and other point systems
 */
exports.up = function(knex) {
  return knex.schema.alterTable('users', function(table) {
    table.integer('points').defaultTo(0).comment('User reward points from check-ins, challenges, etc.');
  });
};

exports.down = function(knex) {
  return knex.schema.alterTable('users', function(table) {
    table.dropColumn('points');
  });
};
