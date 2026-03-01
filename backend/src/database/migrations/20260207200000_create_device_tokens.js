/**
 * Push Notification Infrastructure
 * Creates device_tokens and push_notifications tables
 */

exports.up = function(knex) {
  return knex.schema
    // 1. Device tokens table - stores APNs/FCM device tokens per user
    .createTableIfNotExists('device_tokens', function(table) {
      table.increments('id').primary();
      table.uuid('user_id').notNullable()
        .references('id').inTable('users').onDelete('CASCADE');
      table.varchar('device_token', 255).unique().notNullable();
      table.varchar('platform', 20).defaultTo('ios');
      table.boolean('is_active').defaultTo(true);
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());

      // Indexes
      table.index('user_id', 'idx_device_tokens_user_id');
      table.index('is_active', 'idx_device_tokens_is_active');
    })

    // 2. Push notifications log table - records all sent push notifications
    .createTableIfNotExists('push_notifications', function(table) {
      table.increments('id').primary();
      table.uuid('user_id').nullable()
        .references('id').inTable('users').onDelete('SET NULL');
      table.varchar('title', 255).notNullable();
      table.text('body').notNullable();
      table.varchar('type', 50).notNullable();
      table.jsonb('data').nullable();
      table.timestamp('sent_at').defaultTo(knex.fn.now());
      table.timestamp('read_at').nullable();

      // Indexes
      table.index('user_id', 'idx_push_notifications_user_id');
      table.index('type', 'idx_push_notifications_type');
      table.index('sent_at', 'idx_push_notifications_sent_at');
    });
};

exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('push_notifications')
    .dropTableIfExists('device_tokens');
};
