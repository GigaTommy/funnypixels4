/**
 * Fix: DailyCheckin model expects columns that don't exist in user_checkins table.
 * Add: reward_points, reward_items, is_claimed, claimed_at
 * The model was referencing table "daily_checkins" but the actual table is "user_checkins".
 */

exports.up = function(knex) {
  return knex.schema.alterTable('user_checkins', function(table) {
    // reward_points = total points earned (base + bonus)
    table.integer('reward_points').defaultTo(10);

    // reward_items = JSON array of item IDs earned at milestones
    table.json('reward_items');

    // is_claimed = whether the reward has been claimed (alias for reward_claimed)
    table.boolean('is_claimed').defaultTo(false);

    // claimed_at = timestamp when reward was claimed
    table.timestamp('claimed_at');
  });
};

exports.down = function(knex) {
  return knex.schema.alterTable('user_checkins', function(table) {
    table.dropColumn('reward_points');
    table.dropColumn('reward_items');
    table.dropColumn('is_claimed');
    table.dropColumn('claimed_at');
  });
};
