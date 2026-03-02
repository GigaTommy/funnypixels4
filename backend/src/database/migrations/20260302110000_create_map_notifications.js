/**
 * Migration: Create map notifications system
 *
 * Purpose: Universal notification banner for map events
 * - Territory alerts
 * - Treasure refreshes
 * - Region challenges
 * - System announcements
 */

exports.up = async function(knex) {
  // Main notifications table
  await knex.schema.createTable('map_notifications', (table) => {
    table.increments('id').primary();

    // Notification type and content
    table.string('type', 30).notNullable()
      .comment('region_challenge, alliance_war, treasure_refresh, season_reminder, system_announcement');
    table.string('title', 100).notNullable();
    table.text('message').notNullable();

    // Priority and duration
    table.integer('priority').defaultTo(2).comment('1=low, 2=medium, 3=high, 4=urgent');
    table.integer('duration_seconds').nullable().comment('Display duration in seconds');
    table.timestamp('end_time').nullable().comment('Notification expiry time');

    // Target location (for fly-to functionality)
    table.decimal('target_lat', 10, 8).nullable();
    table.decimal('target_lng', 11, 8).nullable();

    // Additional data
    table.jsonb('metadata').nullable().comment('Type-specific data');

    // Status
    table.boolean('is_active').defaultTo(true);
    table.timestamp('created_at').defaultTo(knex.fn.now());

    // Indexes
    table.index(['is_active', 'priority', 'created_at'], 'idx_active_notifications');
    table.index('type', 'idx_notification_type');
    table.index('end_time', 'idx_notification_end_time');
  });

  // User dismissals tracking
  await knex.schema.createTable('map_notification_dismissals', (table) => {
    table.increments('id').primary();
    table.integer('notification_id').unsigned().notNullable()
      .references('id').inTable('map_notifications').onDelete('CASCADE');
    table.uuid('user_id').notNullable()
      .references('id').inTable('users').onDelete('CASCADE');
    table.timestamp('dismissed_at').defaultTo(knex.fn.now());

    // Unique constraint: user can only dismiss once
    table.unique(['notification_id', 'user_id']);
    table.index('user_id', 'idx_dismissals_user');
  });

  console.log('✅ Created map_notifications and map_notification_dismissals tables');
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('map_notification_dismissals');
  await knex.schema.dropTableIfExists('map_notifications');
  console.log('✅ Dropped map notifications tables');
};
