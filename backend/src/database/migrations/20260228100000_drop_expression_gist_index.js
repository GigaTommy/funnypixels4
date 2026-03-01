/**
 * Drop expression-based GiST index on pixels
 *
 * The GiST index (idx_pixels_geom_expr) causes severe write regression:
 * every INSERT/UPDATE must maintain the GiST tree, increasing Write P50
 * from 124ms to 490ms and Write P95 from 1506ms to 4450ms.
 *
 * BBOX spatial queries are now handled by Redis GEOSEARCH (primary)
 * with B-Tree BETWEEN fallback. MVT queries also use B-Tree pre-filter.
 * The GiST index is no longer needed.
 */

// Disable transaction — DROP/CREATE INDEX CONCURRENTLY cannot run inside a transaction
exports.config = { transaction: false };

exports.up = async function(knex) {
  console.log('Dropping expression-based GiST index idx_pixels_geom_expr...');
  await knex.raw('DROP INDEX CONCURRENTLY IF EXISTS idx_pixels_geom_expr');
  console.log('✅ idx_pixels_geom_expr dropped — write performance restored');
};

exports.down = async function(knex) {
  console.log('Recreating expression-based GiST index idx_pixels_geom_expr...');
  await knex.raw(`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pixels_geom_expr
    ON pixels USING gist(ST_SetSRID(ST_MakePoint(longitude, latitude), 4326))
  `);
  console.log('✅ idx_pixels_geom_expr recreated');
};
