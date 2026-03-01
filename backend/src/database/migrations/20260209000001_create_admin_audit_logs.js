exports.up = function(knex) {
  return knex.schema.createTableIfNotExists('admin_audit_logs', function(table) {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('admin_id').notNullable();
    table.string('admin_name', 255);
    table.string('action', 100).notNullable();
    table.string('module', 100).notNullable();
    table.string('target_type', 100);
    table.string('target_id', 255);
    table.text('description');
    table.string('request_method', 10);
    table.text('request_path');
    table.jsonb('request_body').defaultTo('{}');
    table.integer('response_status');
    table.string('ip_address', 45);
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.index('admin_id', 'idx_audit_admin_id');
    table.index('module', 'idx_audit_module');
    table.index('created_at', 'idx_audit_created_at');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('admin_audit_logs');
};
