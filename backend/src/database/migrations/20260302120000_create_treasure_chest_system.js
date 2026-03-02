/**
 * Migration: Create treasure chest system
 *
 * Purpose: Auto-spawning treasure chests on map
 * - System-driven (not user-created like QR treasures)
 * - 4 rarity levels with different spawn rates
 * - Pickup tracking with cooldowns
 * - Distance-based visibility
 */

exports.up = async function(knex) {
  // Main treasure chests table
  await knex.schema.createTable('treasure_chests', (table) => {
    table.increments('id').primary();

    // Location
    table.decimal('latitude', 10, 8).notNullable();
    table.decimal('longitude', 11, 8).notNullable();
    table.geography('location', 'POINT').notNullable();

    // Rarity and rewards
    table.string('rarity', 20).notNullable()
      .comment('normal, rare, epic, limited');
    table.integer('points_min').notNullable().defaultTo(10);
    table.integer('points_max').notNullable().defaultTo(50);

    // Spawn and expiry
    table.timestamp('spawned_at').defaultTo(knex.fn.now());
    table.timestamp('expires_at').notNullable();
    table.boolean('is_active').defaultTo(true);

    // Region info
    table.string('region_name', 200).nullable();
    table.string('city', 100).nullable();

    // Metadata
    table.jsonb('metadata').nullable()
      .comment('Additional data like special events, bonus multipliers');

    // Indexes
    table.index(['is_active', 'expires_at'], 'idx_active_chests');
    table.index('rarity', 'idx_chest_rarity');
  });

  // Create spatial index using raw SQL
  await knex.raw('CREATE INDEX idx_chest_location ON treasure_chests USING GIST (location)');

  // User pickups tracking
  await knex.schema.createTable('treasure_chest_pickups', (table) => {
    table.increments('id').primary();

    table.integer('chest_id').unsigned().notNullable()
      .references('id').inTable('treasure_chests').onDelete('CASCADE');
    table.uuid('user_id').notNullable()
      .references('id').inTable('users').onDelete('CASCADE');

    table.integer('points_awarded').notNullable();
    table.timestamp('picked_up_at').defaultTo(knex.fn.now());

    // Cooldown tracking
    table.string('chest_key', 200).nullable()
      .comment('Unique key for cooldown (location-based)');

    // Indexes
    table.index('user_id', 'idx_pickups_user');
    table.index('chest_id', 'idx_pickups_chest');
    table.index(['user_id', 'picked_up_at'], 'idx_user_pickup_time');
    table.index(['user_id', 'chest_key', 'picked_up_at'], 'idx_cooldown_check');
  });

  // Treasure spawn configuration
  await knex.schema.createTable('treasure_spawn_config', (table) => {
    table.increments('id').primary();

    table.string('city', 100).notNullable();
    table.string('rarity', 20).notNullable();

    // Spawn settings
    table.integer('quantity_per_spawn').notNullable();
    table.integer('spawn_interval_minutes').notNullable();
    table.integer('duration_minutes').notNullable();

    // Reward ranges
    table.integer('points_min').notNullable();
    table.integer('points_max').notNullable();

    table.boolean('is_enabled').defaultTo(true);
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.unique(['city', 'rarity']);
  });

  // Insert default configurations
  await knex('treasure_spawn_config').insert([
    // Normal chests - 100 per hour per city
    {
      city: 'global',
      rarity: 'normal',
      quantity_per_spawn: 100,
      spawn_interval_minutes: 60,
      duration_minutes: 60,
      points_min: 10,
      points_max: 30
    },
    // Rare chests - 10 every 6 hours per city
    {
      city: 'global',
      rarity: 'rare',
      quantity_per_spawn: 10,
      spawn_interval_minutes: 360,
      duration_minutes: 360,
      points_min: 50,
      points_max: 100
    },
    // Epic chests - 1 per day per city
    {
      city: 'global',
      rarity: 'epic',
      quantity_per_spawn: 1,
      spawn_interval_minutes: 1440,
      duration_minutes: 1440,
      points_min: 200,
      points_max: 500
    },
    // Limited chests - event-based (manual trigger)
    {
      city: 'global',
      rarity: 'limited',
      quantity_per_spawn: 5,
      spawn_interval_minutes: 0, // Manual spawn
      duration_minutes: 120,
      points_min: 100,
      points_max: 300
    }
  ]);

  console.log('✅ Created treasure chest system tables');
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('treasure_spawn_config');
  await knex.schema.dropTableIfExists('treasure_chest_pickups');
  await knex.schema.dropTableIfExists('treasure_chests');
  console.log('✅ Dropped treasure chest system tables');
};
