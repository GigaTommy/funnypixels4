/**
 * Migration: Ensure quantized geometry SP-GIST index exists
 *
 * Replaces the .sql file (20260213_create_quantized_geom_index.sql) which Knex
 * silently ignores. The actual column is `geom_quantized` (not `geom`).
 *
 * CREATE INDEX CONCURRENTLY cannot run inside a transaction, so we disable
 * the Knex transaction wrapper.
 */

exports.config = { transaction: false };

exports.up = async function (knex) {
  // Check if either known index name already exists
  const existing = await knex.raw(`
    SELECT indexname FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'pixels'
      AND (indexname = 'idx_pixels_geom_quantized' OR indexname = 'idx_pixels_geom_spgist')
  `);

  if (existing.rows.length > 0) {
    console.log(`  ℹ️ Spatial index already exists: ${existing.rows[0].indexname}, skipping`);
    return;
  }

  // Check if geom_quantized column exists
  const colExists = await knex.raw(`
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pixels' AND column_name = 'geom_quantized'
  `);

  if (colExists.rows.length === 0) {
    console.log('  ⚠️ geom_quantized column does not exist on pixels, skipping index creation');
    return;
  }

  await knex.raw(`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pixels_geom_spgist
    ON pixels USING SPGIST (geom_quantized)
    WHERE geom_quantized IS NOT NULL
  `);

  await knex.raw('ANALYZE pixels');
  console.log('  ✅ idx_pixels_geom_spgist created');
};

exports.down = async function (knex) {
  await knex.raw('DROP INDEX CONCURRENTLY IF EXISTS idx_pixels_geom_spgist');
};
