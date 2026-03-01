/**
 * Update Event System for V1
 * 1. Add fields to 'events': publish_time, signup_end_time
 * 2. Create 'event_participants': Track signups
 * 3. Create 'event_pixel_logs': Immutable pixel log for events
 */
exports.up = async function (knex) {
    // 1. Modify 'events' table
    const hasPublishTime = await knex.schema.hasColumn('events', 'publish_time');
    if (!hasPublishTime) {
        await knex.schema.alterTable('events', table => {
            table.timestamp('publish_time');
            table.timestamp('signup_end_time');
            table.index('status');
            table.index('start_time');
            table.index('end_time');
        });
    }

    // 2. Create 'event_participants' table
    const hasParticipants = await knex.schema.hasTable('event_participants');
    if (!hasParticipants) {
        await knex.schema.createTable('event_participants', table => {
            table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
            table.uuid('event_id').notNullable().references('id').inTable('events').onDelete('CASCADE');

            // 'user' or 'alliance'
            table.string('participant_type').notNullable();
            // user_id or alliance_id
            table.string('participant_id').notNullable();

            // Snapshot of their state when joining (e.g. alliance rank/members count)
            table.jsonb('metadata').defaultTo('{}');

            table.timestamp('joined_at').defaultTo(knex.fn.now());

            // Prevent duplicate signup for same event
            table.unique(['event_id', 'participant_type', 'participant_id']);
            table.index(['event_id', 'participant_type']);
            table.index(['participant_id']);
        });
    }

    // 3. Create 'event_pixel_logs' table
    const hasPixelLogs = await knex.schema.hasTable('event_pixel_logs');
    if (!hasPixelLogs) {
        await knex.schema.createTable('event_pixel_logs', table => {
            // Use bigIncrements or uuid? UUID is safer for sharding but bigger. 
            // Using standard ID for now, PRD says "log".
            table.bigIncrements('id').primary();

            table.uuid('event_id').notNullable().references('id').inTable('events').onDelete('CASCADE');
            // Use grid_id (string) as pixel reference because batch processing might delay pixel insertion
            table.string('pixel_id').notNullable();

            table.uuid('user_id').notNullable();
            table.string('alliance_id'); // Nullable (individual participants)

            // Coordinates snapshot (to avoid lookups during settlement)
            table.integer('x'); // Optional: grid x
            table.integer('y'); // Optional: grid y

            table.timestamp('created_at').defaultTo(knex.fn.now());

            // Indexes for fast aggregation
            table.index(['event_id', 'user_id']);
            table.index(['event_id', 'alliance_id']);
            table.index('created_at');
        });
    }
};

exports.down = async function (knex) {
    await knex.schema.dropTableIfExists('event_pixel_logs');
    await knex.schema.dropTableIfExists('event_participants');

    const hasPublishTime = await knex.schema.hasColumn('events', 'publish_time');
    if (hasPublishTime) {
        await knex.schema.alterTable('events', table => {
            table.dropColumn('publish_time');
            table.dropColumn('signup_end_time');
            table.dropIndex('status');
            table.dropIndex('start_time');
            table.dropIndex('end_time');
        });
    }
};
