
/**
 * Create events table for Event Operations System
 */
exports.up = async function (knex) {
    // 1. Check if table exists
    const hasEvents = await knex.schema.hasTable('events');
    if (!hasEvents) {
        await knex.schema.createTable('events', table => {
            table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
            table.string('title').notNullable();
            table.text('description');
            table.string('type').notNullable(); // 'leaderboard', 'territory_control', 'cooperation'
            table.timestamp('start_time').notNullable();
            table.timestamp('end_time').notNullable();
            table.string('status').defaultTo('draft'); // 'draft', 'published', 'active', 'ended'
            table.jsonb('config').defaultTo('{}'); // Stores rewards, rules, target_region_ids
            table.string('banner_url');
            table.timestamps(true, true);
        });
    }

    // 2. Add event_id to leaderboards if not exists logic?
    // Existing leaderboard tables are: leaderboard_global, leaderboard_region
    // We might want a generic event_leaderboard table or just use Redis for events.
    // For MVP, let's keep it simple. Events might use specific Redis keys.
};

exports.down = async function (knex) {
    await knex.schema.dropTableIfExists('events');
};
