exports.up = function(knex) {
  return knex.schema.createTableIfNotExists('user_feedback', function(table) {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').notNullable();
    table.string('type', 50).notNullable();
    table.string('title', 255).notNullable();
    table.text('content').notNullable();
    table.jsonb('screenshots').defaultTo('[]');
    table.string('app_version', 50);
    table.string('device_info', 255);
    table.string('status', 20).defaultTo('pending');
    table.string('priority', 20).defaultTo('normal');
    table.uuid('assigned_to');
    table.text('admin_reply');
    table.timestamp('replied_at');
    table.timestamp('resolved_at');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    table.index('user_id', 'idx_feedback_user_id');
    table.index('status', 'idx_feedback_status');
    table.index('type', 'idx_feedback_type');
    table.index('priority', 'idx_feedback_priority');
    table.index('created_at', 'idx_feedback_created_at');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('user_feedback');
};
