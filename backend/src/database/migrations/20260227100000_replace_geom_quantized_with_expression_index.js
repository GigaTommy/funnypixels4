/**
 * Replace geom_quantized materialized column with expression-based GiST index
 *
 * Problem: geom_quantized column relied on a trigger (BEFORE INSERT OR UPDATE OF longitude, latitude)
 * to auto-populate. But batch UPSERT (ON CONFLICT DO UPDATE) didn't include longitude/latitude
 * in the merge clause, so the trigger never fired on updates → geom_quantized stayed NULL for
 * many rows, making the SP-GiST index incomplete and spatial queries slower than B-Tree.
 *
 * Solution: Expression index directly on ST_SetSRID(ST_MakePoint(longitude, latitude), 4326).
 * No extra column, no trigger, no NULL issues — always in sync with longitude/latitude.
 */

// Disable transaction — CREATE/DROP INDEX CONCURRENTLY cannot run inside a transaction
exports.config = { transaction: false };

exports.up = async function(knex) {
  // 1. Create expression-based GiST index (covers BBOX and MVT spatial queries)
  console.log('Creating expression-based GiST index on pixels(longitude, latitude)...');
  await knex.raw(`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pixels_geom_expr
    ON pixels USING gist(ST_SetSRID(ST_MakePoint(longitude, latitude), 4326))
  `);
  console.log('✅ idx_pixels_geom_expr created');

  // 2. Drop old SP-GiST index on geom_quantized
  console.log('Dropping old SP-GiST index...');
  await knex.raw(`DROP INDEX CONCURRENTLY IF EXISTS idx_pixels_geom_spgist`);
  await knex.raw(`DROP INDEX CONCURRENTLY IF EXISTS idx_pixels_geom_quantized`);
  console.log('✅ Old spatial indexes dropped');

  // 3. Drop trigger and function
  console.log('Dropping trigger and function...');
  await knex.raw(`DROP TRIGGER IF EXISTS pixels_update_geom_quantized ON pixels`);
  await knex.raw(`DROP FUNCTION IF EXISTS pixels_update_geom_trigger()`);
  console.log('✅ Trigger and function dropped');

  // 4. Drop the three redundant columns
  console.log('Dropping geom_quantized, lng_quantized, lat_quantized columns...');
  await knex.raw(`
    ALTER TABLE pixels
    DROP COLUMN IF EXISTS geom_quantized,
    DROP COLUMN IF EXISTS lng_quantized,
    DROP COLUMN IF EXISTS lat_quantized
  `);
  console.log('✅ Columns dropped');

  console.log('🎉 Migration complete: expression index replaces geom_quantized');
};

exports.down = async function(knex) {
  // Restore columns
  await knex.raw(`
    ALTER TABLE pixels
    ADD COLUMN IF NOT EXISTS lng_quantized numeric(10,7),
    ADD COLUMN IF NOT EXISTS lat_quantized numeric(10,7),
    ADD COLUMN IF NOT EXISTS geom_quantized geometry(Point,4326)
  `);

  // Restore trigger function
  await knex.raw(`
    CREATE OR REPLACE FUNCTION pixels_update_geom_trigger()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.lng_quantized := CAST(NEW.longitude AS numeric(10,7));
      NEW.lat_quantized := CAST(NEW.latitude AS numeric(10,7));
      NEW.geom_quantized := ST_SetSRID(ST_MakePoint(NEW.lng_quantized, NEW.lat_quantized), 4326);
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql
  `);

  await knex.raw(`
    CREATE TRIGGER pixels_update_geom_quantized
    BEFORE INSERT OR UPDATE OF longitude, latitude
    ON pixels
    FOR EACH ROW
    EXECUTE FUNCTION pixels_update_geom_trigger()
  `);

  // Backfill
  await knex.raw(`
    UPDATE pixels SET
      lng_quantized = CAST(longitude AS numeric(10,7)),
      lat_quantized = CAST(latitude AS numeric(10,7)),
      geom_quantized = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
    WHERE geom_quantized IS NULL AND longitude IS NOT NULL AND latitude IS NOT NULL
  `);

  // Restore SP-GiST index
  await knex.raw(`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pixels_geom_spgist
    ON pixels USING spgist(geom_quantized)
  `);

  // Drop expression index
  await knex.raw(`DROP INDEX CONCURRENTLY IF EXISTS idx_pixels_geom_expr`);
};
