/**
 * Migration: Extend user_daily_tasks for map-based tasks
 *
 * Purpose: Add location and difficulty fields to support hybrid daily task system
 * - Preserves existing basic tasks (draw_pixels, draw_sessions, checkin, etc.)
 * - Enables new map tasks (draw_at_location, draw_distance, explore_regions, etc.)
 *
 * Strategy: Extend, not replace
 */

exports.up = async function(knex) {
  await knex.schema.table('user_daily_tasks', (table) => {
    // Location fields for map-based tasks
    table.decimal('location_lat', 10, 8).nullable().comment('Target location latitude');
    table.decimal('location_lng', 11, 8).nullable().comment('Target location longitude');
    table.integer('location_radius').defaultTo(500).comment('Target location radius in meters');
    table.string('location_name', 200).nullable().comment('Human-readable location name');

    // Task classification
    table.string('difficulty', 20).defaultTo('normal').comment('Task difficulty: easy, normal, hard');
    table.string('task_category', 20).defaultTo('basic').comment('Task category: basic or map');

    // Additional metadata for map tasks
    table.jsonb('metadata').nullable().comment('Additional task data (regions, cooperation, etc.)');

    // Indexes for efficient queries
    table.index(['user_id', 'task_date', 'task_category'], 'idx_user_daily_tasks_category');
    table.index(['location_lat', 'location_lng'], 'idx_user_daily_tasks_location');
  });

  console.log('✅ Extended user_daily_tasks table for map-based tasks');
};

exports.down = async function(knex) {
  await knex.schema.table('user_daily_tasks', (table) => {
    table.dropIndex([], 'idx_user_daily_tasks_category');
    table.dropIndex([], 'idx_user_daily_tasks_location');

    table.dropColumn('location_lat');
    table.dropColumn('location_lng');
    table.dropColumn('location_radius');
    table.dropColumn('location_name');
    table.dropColumn('difficulty');
    table.dropColumn('task_category');
    table.dropColumn('metadata');
  });

  console.log('✅ Reverted user_daily_tasks table changes');
};
