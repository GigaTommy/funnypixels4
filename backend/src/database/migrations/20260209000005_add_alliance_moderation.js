exports.up = function(knex) {
  return knex.schema.alterTable('alliances', function(table) {
    table.string('ban_status', 20).defaultTo(null);
    table.text('ban_reason');
    table.uuid('banned_by');
    table.timestamp('banned_at');
    table.integer('warn_count').defaultTo(0);
  }).then(function() {
    return knex.schema.createTableIfNotExists('alliance_moderation_logs', function(table) {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.bigInteger('alliance_id').notNullable();
      table.uuid('admin_id').notNullable();
      table.string('admin_name', 255);
      table.string('action', 50).notNullable();
      table.uuid('target_user_id');
      table.text('reason');
      table.jsonb('metadata');
      table.timestamp('created_at').defaultTo(knex.fn.now());

      table.index('alliance_id', 'idx_mod_alliance_id');
      table.index('admin_id', 'idx_mod_admin_id');
      table.index('created_at', 'idx_mod_created_at');
    });
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('alliance_moderation_logs')
    .then(function() {
      return knex.schema.alterTable('alliances', function(table) {
        table.dropColumn('ban_status');
        table.dropColumn('ban_reason');
        table.dropColumn('banned_by');
        table.dropColumn('banned_at');
        table.dropColumn('warn_count');
      });
    });
};
