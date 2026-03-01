const { Knex } = require('knex');

/**
 * @param {Knex} knex
 */
exports.up = function(knex) {
  return knex.schema
    .createTableIfNotExists('users', function(table) {
      table.increments('id').primary();
      table.string('username', 50).notNullable().unique();
      table.string('email', 255).notNullable().unique();
      table.string('password_hash', 255).notNullable();
      table.string('display_name', 100);
      table.string('avatar_url', 500);
      table.text('bio');
      table.integer('level').defaultTo(1);
      table.integer('experience').defaultTo(0);
      table.integer('coins').defaultTo(100);
      table.integer('gems').defaultTo(10);
      table.boolean('is_guest').defaultTo(false);
      table.string('guest_id', 100);
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
      table.timestamp('last_login');
      table.boolean('is_online').defaultTo(false);
      table.boolean('is_banned').defaultTo(false);
      table.text('ban_reason');
      table.json('preferences');
    })
    .createTableIfNotExists('pixels', function(table) {
      table.increments('id').primary();
      table.decimal('latitude', 10, 8).notNullable();
      table.decimal('longitude', 11, 8).notNullable();
      table.string('color', 7).notNullable();
      table.integer('user_id').unsigned().references('id').inTable('users').onDelete('CASCADE');
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
      table.bigInteger('version').defaultTo(1);
      table.string('grid_id', 50);
      table.boolean('is_locked').defaultTo(false);
      table.timestamp('lock_expires_at');
    })
    .createTableIfNotExists('user_pixel_states', function(table) {
      table.increments('id').primary();
      table.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
      table.integer('pixel_points').defaultTo(64);
      table.bigInteger('last_accum_time').defaultTo(knex.raw('EXTRACT(EPOCH FROM NOW())'));
      table.bigInteger('freeze_until').defaultTo(0);
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
    })
    .createTableIfNotExists('chat_messages', function(table) {
      table.increments('id').primary();
      table.integer('user_id').unsigned().references('id').inTable('users').onDelete('CASCADE');
      table.text('message').notNullable();
      table.string('message_type', 20).defaultTo('text');
      table.decimal('latitude', 10, 8);
      table.decimal('longitude', 11, 8);
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.boolean('is_anonymous').defaultTo(false);
      table.string('guest_id', 100);
    })
    .createTableIfNotExists('alliances', function(table) {
      table.increments('id').primary();
      table.string('name', 100).notNullable().unique();
      table.text('description');
      table.integer('leader_id').unsigned().references('id').inTable('users').onDelete('CASCADE');
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
      table.integer('member_count').defaultTo(1);
      table.integer('max_members').defaultTo(50);
      table.boolean('is_public').defaultTo(true);
      table.string('color', 7);
      table.string('logo_url', 500);
    })
    .createTableIfNotExists('alliance_members', function(table) {
      table.increments('id').primary();
      table.integer('alliance_id').unsigned().notNullable().references('id').inTable('alliances').onDelete('CASCADE');
      table.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
      table.string('role', 20).defaultTo('member');
      table.timestamp('joined_at').defaultTo(knex.fn.now());
      table.integer('contribution_points').defaultTo(0);
    })
    .createTableIfNotExists('store_items', function(table) {
      table.increments('id').primary();
      table.string('name', 100).notNullable();
      table.text('description');
      table.integer('price').notNullable();
      table.string('currency_type', 10).defaultTo('coins');
      table.string('item_type', 20).notNullable();
      table.boolean('is_available').defaultTo(true);
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
      table.string('image_url', 500);
      table.string('category', 50);
    })
    .createTableIfNotExists('user_items', function(table) {
      table.increments('id').primary();
      table.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
      table.integer('item_id').unsigned().notNullable().references('id').inTable('store_items').onDelete('CASCADE');
      table.integer('quantity').defaultTo(1);
      table.timestamp('acquired_at').defaultTo(knex.fn.now());
      table.timestamp('expires_at');
    })
    .createTableIfNotExists('notifications', function(table) {
      table.increments('id').primary();
      table.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
      table.string('title', 200).notNullable();
      table.text('message').notNullable();
      table.string('type', 50).notNullable();
      table.boolean('is_read').defaultTo(false);
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.json('data');
    })
    .createTableIfNotExists('achievements', function(table) {
      table.increments('id').primary();
      table.string('name', 100).notNullable().unique();
      table.text('description').notNullable();
      table.string('icon_url', 500);
      table.integer('points').defaultTo(0);
      table.string('category', 50);
      table.timestamp('created_at').defaultTo(knex.fn.now());
    })
    .createTableIfNotExists('user_achievements', function(table) {
      table.increments('id').primary();
      table.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
      table.integer('achievement_id').unsigned().notNullable().references('id').inTable('achievements').onDelete('CASCADE');
      table.timestamp('unlocked_at').defaultTo(knex.fn.now());
      table.integer('progress').defaultTo(0);
    })
    .createTableIfNotExists('regions', function(table) {
      table.increments('id').primary();
      table.string('name', 200).notNullable();
      table.string('country', 100);
      table.decimal('latitude', 10, 8).notNullable();
      table.decimal('longitude', 11, 8).notNullable();
      table.integer('population');
      table.string('timezone', 50);
      table.timestamp('created_at').defaultTo(knex.fn.now());
    })
    .createTableIfNotExists('pattern_assets', function(table) {
      table.increments('id').primary();
      table.string('key', 100).notNullable().unique();
      table.string('name', 200).notNullable();
      table.text('description');
      table.string('image_url', 500).notNullable();
      table.string('category', 50);
      table.json('tags');
      table.boolean('is_public').defaultTo(true);
      table.integer('created_by').unsigned().references('id').inTable('users').onDelete('SET NULL');
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
      table.integer('download_count').defaultTo(0);
      table.decimal('rating', 3, 2).defaultTo(0);
      table.integer('review_count').defaultTo(0);
    })
    .createTableIfNotExists('shop_skus', function(table) {
      table.increments('id').primary();
      table.string('name', 100).notNullable();
      table.text('description');
      table.integer('price').notNullable();
      table.string('currency', 10).defaultTo('coins');
      table.string('item_type', 20).notNullable();
      table.integer('item_id');
      table.boolean('is_available').defaultTo(true);
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
      table.string('image_url', 500);
      table.string('category', 50);
      table.integer('sort_order').defaultTo(0);
    })
  ;
};

/**
 * @param {Knex} knex
 */
exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('shop_skus')
    .dropTableIfExists('pattern_assets')
    .dropTableIfExists('regions')
    .dropTableIfExists('user_achievements')
    .dropTableIfExists('achievements')
    .dropTableIfExists('notifications')
    .dropTableIfExists('user_items')
    .dropTableIfExists('store_items')
    .dropTableIfExists('alliance_members')
    .dropTableIfExists('alliances')
    .dropTableIfExists('chat_messages')
    .dropTableIfExists('user_pixel_states')
    .dropTableIfExists('pixels')
    .dropTableIfExists('users')
  ;
};
