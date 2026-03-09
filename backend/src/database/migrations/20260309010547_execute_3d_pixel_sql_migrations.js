const fs = require('fs');
const path = require('path');

/**
 * Execute 3D Pixel SQL Migrations
 * Creates materialized views for pixel layer statistics and LOD aggregations
 */

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  // Read and execute the SQL files in order
  const sqlFiles = [
    '20260309000001_create_pixel_layer_stats.sql',
    '20260309000002_create_lod_aggregates.sql'
  ];

  for (const sqlFile of sqlFiles) {
    const sqlPath = path.join(__dirname, sqlFile);
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log(`Executing ${sqlFile}...`);
    await knex.raw(sql);
    console.log(`✅ ${sqlFile} executed successfully`);
  }

  // Note: Views are created empty. To populate them, run:
  // SELECT refresh_all_pixel_layer_stats();
  // This can be done via scheduled job or manually after migration
  console.log('✅ Materialized views created successfully');
  console.log('💡 To populate views with data, run: SELECT refresh_all_pixel_layer_stats();');
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  // Drop in reverse order
  await knex.raw('DROP FUNCTION IF EXISTS refresh_all_pixel_layer_stats CASCADE');
  await knex.raw('DROP FUNCTION IF EXISTS refresh_pixel_layer_stats_block CASCADE');
  await knex.raw('DROP FUNCTION IF EXISTS refresh_pixel_layer_stats_city CASCADE');
  await knex.raw('DROP FUNCTION IF EXISTS refresh_pixel_layer_stats_incremental CASCADE');
  await knex.raw('DROP MATERIALIZED VIEW IF EXISTS pixel_layer_stats_block CASCADE');
  await knex.raw('DROP MATERIALIZED VIEW IF EXISTS pixel_layer_stats_city CASCADE');
  await knex.raw('DROP MATERIALIZED VIEW IF EXISTS pixel_layer_stats CASCADE');
};
