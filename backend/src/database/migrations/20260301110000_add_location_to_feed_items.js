/**
 * Migration: Add location field to feed_items for nearby filter
 * Purpose: Enable PostGIS geographic queries for nearby feed items
 */

exports.up = async function(knex) {
  // 1. Add location column (PostGIS GEOGRAPHY type)
  await knex.raw(`
    ALTER TABLE feed_items
    ADD COLUMN IF NOT EXISTS location GEOGRAPHY(POINT, 4326)
  `);

  // 2. Create spatial index for fast geographic queries
  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_feed_items_location
    ON feed_items USING GIST (location)
  `);

  // 3. Backfill location from existing drawing_sessions (using start point)
  // Note: drawing_sessions uses lat/lng columns, not PostGIS
  await knex.raw(`
    UPDATE feed_items
    SET location = ST_SetSRID(ST_MakePoint(ds.start_lng, ds.start_lat), 4326)::geography
    FROM drawing_sessions ds
    WHERE feed_items.drawing_session_id = ds.id
      AND feed_items.location IS NULL
      AND ds.start_lat IS NOT NULL
      AND ds.start_lng IS NOT NULL
  `);
};

exports.down = async function(knex) {
  await knex.raw('DROP INDEX IF EXISTS idx_feed_items_location');
  await knex.raw('ALTER TABLE feed_items DROP COLUMN IF EXISTS location');
};
