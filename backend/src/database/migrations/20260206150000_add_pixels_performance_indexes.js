/**
 * Add performance indexes to pixels table for high-concurrency read/write
 * These indexes optimize:
 * - User pixel queries (user_id)
 * - Geographic queries (city)
 * - Pattern queries (pattern_id)
 * - Time-based queries (created_at)
 *
 * Note: For production with large tables, run these indexes manually with CONCURRENTLY
 * outside of a transaction to avoid table locks.
 */

exports.up = async function(knex) {
  // Create indexes one by one (cannot use CONCURRENTLY inside transaction)
  // Index for user pixel queries (user profile, user stats)
  await knex.schema.raw(`
    CREATE INDEX IF NOT EXISTS idx_pixels_user_id ON pixels(user_id);
  `);

  // Index for geographic/city queries (leaderboards, regional stats)
  await knex.schema.raw(`
    CREATE INDEX IF NOT EXISTS idx_pixels_city ON pixels(city) WHERE city IS NOT NULL;
  `);

  // Index for pattern queries (pattern usage stats)
  await knex.schema.raw(`
    CREATE INDEX IF NOT EXISTS idx_pixels_pattern_id ON pixels(pattern_id) WHERE pattern_id IS NOT NULL;
  `);

  // Index for time-based queries (recent pixels, history)
  await knex.schema.raw(`
    CREATE INDEX IF NOT EXISTS idx_pixels_created_at ON pixels(created_at DESC);
  `);

  // Composite index for user + time queries
  await knex.schema.raw(`
    CREATE INDEX IF NOT EXISTS idx_pixels_user_created ON pixels(user_id, created_at DESC);
  `);

  // Index for geocoding queue (pixels without geocoding)
  await knex.schema.raw(`
    CREATE INDEX IF NOT EXISTS idx_pixels_not_geocoded ON pixels(id) WHERE geocoded = false OR geocoded IS NULL;
  `);
};

exports.down = async function(knex) {
  await knex.schema.raw(`DROP INDEX IF EXISTS idx_pixels_user_id;`);
  await knex.schema.raw(`DROP INDEX IF EXISTS idx_pixels_city;`);
  await knex.schema.raw(`DROP INDEX IF EXISTS idx_pixels_pattern_id;`);
  await knex.schema.raw(`DROP INDEX IF EXISTS idx_pixels_created_at;`);
  await knex.schema.raw(`DROP INDEX IF EXISTS idx_pixels_user_created;`);
  await knex.schema.raw(`DROP INDEX IF EXISTS idx_pixels_not_geocoded;`);
};
