/**
 * Fix leaderboard table schema inconsistencies
 * 1. Add updated_at column to all leaderboard tables
 * 2. Rename total_pixels to pixel_count for consistency
 */

exports.up = async function(knex) {
  // 1. Add updated_at column to leaderboard_personal
  await knex.schema.table('leaderboard_personal', (table) => {
    table.timestamp('updated_at').nullable().defaultTo(knex.fn.now());
  });

  // 2. Add updated_at column to leaderboard_alliance
  await knex.schema.table('leaderboard_alliance', (table) => {
    table.timestamp('updated_at').nullable().defaultTo(knex.fn.now());
  });

  // 3. Add updated_at column to leaderboard_region
  await knex.schema.table('leaderboard_region', (table) => {
    table.timestamp('updated_at').nullable().defaultTo(knex.fn.now());
  });

  // 4. Rename total_pixels to pixel_count in leaderboard_alliance
  await knex.raw(`
    ALTER TABLE leaderboard_alliance
    RENAME COLUMN total_pixels TO pixel_count
  `);

  // 5. Rename total_pixels to pixel_count in leaderboard_region
  await knex.raw(`
    ALTER TABLE leaderboard_region
    RENAME COLUMN total_pixels TO pixel_count
  `);

  // 6. Update data to set updated_at from last_updated for existing records
  await knex.raw(`
    UPDATE leaderboard_personal
    SET updated_at = COALESCE(last_updated, created_at)
    WHERE updated_at IS NULL
  `);

  await knex.raw(`
    UPDATE leaderboard_alliance
    SET updated_at = COALESCE(last_updated, created_at)
    WHERE updated_at IS NULL
  `);

  await knex.raw(`
    UPDATE leaderboard_region
    SET updated_at = COALESCE(last_updated, created_at)
    WHERE updated_at IS NULL
  `);

  // 7. Create indexes for updated_at
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_leaderboard_personal_updated ON leaderboard_personal(updated_at)');
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_leaderboard_alliance_updated ON leaderboard_alliance(updated_at)');
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_leaderboard_region_updated ON leaderboard_region(updated_at)');
};

exports.down = async function(knex) {
  // Drop indexes
  await knex.raw('DROP INDEX IF EXISTS idx_leaderboard_personal_updated');
  await knex.raw('DROP INDEX IF EXISTS idx_leaderboard_alliance_updated');
  await knex.raw('DROP INDEX IF EXISTS idx_leaderboard_region_updated');

  // Rename columns back
  await knex.raw(`
    ALTER TABLE leaderboard_alliance
    RENAME COLUMN pixel_count TO total_pixels
  `);

  await knex.raw(`
    ALTER TABLE leaderboard_region
    RENAME COLUMN pixel_count TO total_pixels
  `);

  // Remove updated_at columns
  await knex.schema.table('leaderboard_personal', (table) => {
    table.dropColumn('updated_at');
  });

  await knex.schema.table('leaderboard_alliance', (table) => {
    table.dropColumn('updated_at');
  });

  await knex.schema.table('leaderboard_region', (table) => {
    table.dropColumn('updated_at');
  });
};
