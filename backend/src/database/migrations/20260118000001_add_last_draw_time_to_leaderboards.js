/**
 * Add last_draw_time column to all leaderboard tables
 * This column is needed by incrementalLeaderboardService.js to track the last draw time
 */

exports.up = async function(knex) {
  // Add to leaderboard_personal
  await knex.schema.table('leaderboard_personal', (table) => {
    table.timestamp('last_draw_time').nullable();
  });

  // Add to leaderboard_alliance
  await knex.schema.table('leaderboard_alliance', (table) => {
    table.timestamp('last_draw_time').nullable();
  });

  // Add to leaderboard_region
  await knex.schema.table('leaderboard_region', (table) => {
    table.timestamp('last_draw_time').nullable();
  });

  // Create indexes for better query performance
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_leaderboard_personal_last_draw ON leaderboard_personal(last_draw_time)');
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_leaderboard_alliance_last_draw ON leaderboard_alliance(last_draw_time)');
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_leaderboard_region_last_draw ON leaderboard_region(last_draw_time)');
};

exports.down = async function(knex) {
  // Drop indexes
  await knex.raw('DROP INDEX IF EXISTS idx_leaderboard_personal_last_draw');
  await knex.raw('DROP INDEX IF EXISTS idx_leaderboard_alliance_last_draw');
  await knex.raw('DROP INDEX IF EXISTS idx_leaderboard_region_last_draw');

  // Remove columns
  await knex.schema.table('leaderboard_personal', (table) => {
    table.dropColumn('last_draw_time');
  });

  await knex.schema.table('leaderboard_alliance', (table) => {
    table.dropColumn('last_draw_time');
  });

  await knex.schema.table('leaderboard_region', (table) => {
    table.dropColumn('last_draw_time');
  });
};
