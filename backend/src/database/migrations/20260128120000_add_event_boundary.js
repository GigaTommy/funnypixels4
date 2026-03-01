/**
 * Add boundary column to events table for Territory War (GeoJSON)
 */
exports.up = async function (knex) {
    const hasBoundary = await knex.schema.hasColumn('events', 'boundary');
    if (!hasBoundary) {
        await knex.schema.alterTable('events', table => {
            // Store GeoJSON Polygon for the event area
            table.jsonb('boundary');
            // Ensure we have indexes for performance if needed (jsonb_path_ops but standard is fine for small amount of events)
        });
    }
};

exports.down = async function (knex) {
    const hasBoundary = await knex.schema.hasColumn('events', 'boundary');
    if (hasBoundary) {
        await knex.schema.alterTable('events', table => {
            table.dropColumn('boundary');
        });
    }
};
