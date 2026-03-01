/**
 * Add status column to alliance_members table
 * This column is needed by incrementalLeaderboardService.js and pixelInfo.js
 */

exports.up = async function(knex) {
  // Add status column with default value 'active'
  await knex.schema.table('alliance_members', (table) => {
    table.string('status', 20).defaultTo('active').nullable();
  });

  // Create index for better query performance
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_alliance_members_status ON alliance_members(status)');

  // Update existing records to have 'active' status
  await knex.raw("UPDATE alliance_members SET status = 'active' WHERE status IS NULL");
};

exports.down = async function(knex) {
  // Drop index
  await knex.raw('DROP INDEX IF EXISTS idx_alliance_members_status');

  // Remove column
  await knex.schema.table('alliance_members', (table) => {
    table.dropColumn('status');
  });
};
