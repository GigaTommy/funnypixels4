exports.up = function(knex) {
  return knex.schema.alterTable('user_checkins', function(table) {
    table.boolean('is_recovery').defaultTo(false);
  });
};

exports.down = function(knex) {
  return knex.schema.alterTable('user_checkins', function(table) {
    table.dropColumn('is_recovery');
  });
};
