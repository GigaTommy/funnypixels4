/**
 * P2-1: Event Sharing & Invites Migration
 * Creates tables for tracking event shares and invites
 */

exports.up = async function(knex) {
  // Create event_invites table
  await knex.schema.createTable('event_invites', (table) => {
    table.increments('id').primary();
    table.uuid('event_id').notNullable();
    table.uuid('inviter_id').notNullable();
    table.string('invite_code', 100).notNullable().unique();
    table.timestamp('created_at').defaultTo(knex.fn.now());

    // Foreign keys
    table.foreign('event_id').references('events.id').onDelete('CASCADE');
    table.foreign('inviter_id').references('users.id').onDelete('CASCADE');

    // Indexes
    table.index('event_id');
    table.index('inviter_id');
    table.index('invite_code');
  });

  // Create event_shares table
  await knex.schema.createTable('event_shares', (table) => {
    table.increments('id').primary();
    table.uuid('event_id').notNullable();
    table.uuid('user_id').notNullable();
    table.string('platform', 50).defaultTo('unknown'); // 'wechat', 'twitter', 'copy', etc.
    table.timestamp('created_at').defaultTo(knex.fn.now());

    // Foreign keys
    table.foreign('event_id').references('events.id').onDelete('CASCADE');
    table.foreign('user_id').references('users.id').onDelete('CASCADE');

    // Indexes
    table.index('event_id');
    table.index('user_id');
    table.index('created_at');
  });

  console.log('✅ Created event_invites and event_shares tables');
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('event_shares');
  await knex.schema.dropTableIfExists('event_invites');
  console.log('✅ Dropped event_invites and event_shares tables');
};
