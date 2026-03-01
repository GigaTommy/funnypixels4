exports.up = function(knex) {
  return knex.schema.hasTable('recharge_orders').then(function(exists) {
    if (exists) {
      return knex.schema.alterTable('recharge_orders', function(table) {
        table.string('refund_status', 20).defaultTo(null);
        table.decimal('refund_amount', 10, 2);
        table.text('refund_reason');
        table.uuid('refunded_by');
        table.timestamp('refunded_at');
      });
    }
  }).then(function() {
    return knex.schema.createTableIfNotExists('admin_refund_logs', function(table) {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('order_id').notNullable();
      table.uuid('admin_id').notNullable();
      table.string('admin_name', 255);
      table.uuid('user_id').notNullable();
      table.integer('refund_points').notNullable();
      table.text('reason').notNullable();
      table.string('status', 20).defaultTo('completed');
      table.timestamp('created_at').defaultTo(knex.fn.now());

      table.index('order_id', 'idx_refund_order_id');
      table.index('admin_id', 'idx_refund_admin_id');
      table.index('user_id', 'idx_refund_user_id');
    });
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('admin_refund_logs')
    .then(function() {
      return knex.schema.hasTable('recharge_orders').then(function(exists) {
        if (exists) {
          return knex.schema.alterTable('recharge_orders', function(table) {
            table.dropColumn('refund_status');
            table.dropColumn('refund_amount');
            table.dropColumn('refund_reason');
            table.dropColumn('refunded_by');
            table.dropColumn('refunded_at');
          });
        }
      });
    });
};
