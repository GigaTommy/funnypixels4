const TABLE_TILE_SNAPSHOTS = 'tile_snapshots';
const TABLE_MATERIAL_ASSETS = 'material_assets';

/**
 * Add material_versions column to tile_snapshots table
 * This migration runs after tile_snapshots table creation
 * @param { import('knex').Knex } knex
 */
exports.up = async function up(knex) {
  // Check if tile_snapshots table exists
  const hasTileSnapshotsTable = await knex.schema.hasTable(TABLE_TILE_SNAPSHOTS);
  if (!hasTileSnapshotsTable) {
    console.log('⚠️ tile_snapshots table does not exist, skipping column addition');
    return;
  }

  // Check if material_versions column already exists
  const hasMaterialColumn = await knex.schema.hasColumn(TABLE_TILE_SNAPSHOTS, 'material_versions');
  if (!hasMaterialColumn) {
    await knex.schema.alterTable(TABLE_TILE_SNAPSHOTS, table => {
      table.jsonb('material_versions').notNullable().defaultTo(knex.raw("'{}'::jsonb"));
    });
    console.log('✅ Added material_versions column to tile_snapshots table');
  } else {
    console.log('✅ material_versions column already exists in tile_snapshots table');
  }
};

/**
 * Remove material_versions column from tile_snapshots table
 * @param { import('knex').Knex } knex
 */
exports.down = async function down(knex) {
  const hasTileSnapshotsTable = await knex.schema.hasTable(TABLE_TILE_SNAPSHOTS);
  if (!hasTileSnapshotsTable) {
    console.log('⚠️ tile_snapshots table does not exist, skipping column removal');
    return;
  }

  const hasMaterialColumn = await knex.schema.hasColumn(TABLE_TILE_SNAPSHOTS, 'material_versions');
  if (hasMaterialColumn) {
    await knex.schema.alterTable(TABLE_TILE_SNAPSHOTS, table => {
      table.dropColumn('material_versions');
    });
    console.log('✅ Removed material_versions column from tile_snapshots table');
  } else {
    console.log('✅ material_versions column does not exist in tile_snapshots table');
  }
};