/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
    const hasPMSent = await knex.schema.hasColumn('user_achievements', 'pm_sent_count');
    const hasTotalMessages = await knex.schema.hasColumn('user_achievements', 'total_messages_count');
    const hasTotalSpent = await knex.schema.hasColumn('user_achievements', 'total_spent_gold');
    const hasAllianceJoin = await knex.schema.hasColumn('user_achievements', 'alliance_join_count');
    const hasCreations = await knex.schema.hasColumn('user_achievements', 'creations_count');

    return knex.schema.alterTable('user_achievements', function (table) {
        if (!hasPMSent) table.bigint('pm_sent_count').defaultTo(0);
        if (!hasTotalMessages) table.bigint('total_messages_count').defaultTo(0);
        if (!hasTotalSpent) table.bigint('total_spent_gold').defaultTo(0);
        if (!hasAllianceJoin) table.bigint('alliance_join_count').defaultTo(0);
        if (!hasCreations) table.bigint('creations_count').defaultTo(0);
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
    const hasPMSent = await knex.schema.hasColumn('user_achievements', 'pm_sent_count');
    const hasTotalMessages = await knex.schema.hasColumn('user_achievements', 'total_messages_count');
    const hasTotalSpent = await knex.schema.hasColumn('user_achievements', 'total_spent_gold');
    const hasAllianceJoin = await knex.schema.hasColumn('user_achievements', 'alliance_join_count');
    const hasCreations = await knex.schema.hasColumn('user_achievements', 'creations_count');

    return knex.schema.alterTable('user_achievements', function (table) {
        if (hasPMSent) table.dropColumn('pm_sent_count');
        if (hasTotalMessages) table.dropColumn('total_messages_count');
        if (hasTotalSpent) table.dropColumn('total_spent_gold');
        if (hasAllianceJoin) table.dropColumn('alliance_join_count');
        if (hasCreations) table.dropColumn('creations_count');
    });
};
