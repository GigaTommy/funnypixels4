/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
    const hasBanType = await knex.schema.hasColumn('users', 'ban_type');
    const hasBanReason = await knex.schema.hasColumn('users', 'ban_reason');
    const hasBanExpiresAt = await knex.schema.hasColumn('users', 'ban_expires_at');

    return knex.schema.table('users', table => {
        if (!hasBanType) table.enum('ban_type', ['none', 'login', 'chat', 'draw']).defaultTo('none');
        if (!hasBanReason) table.text('ban_reason');
        if (!hasBanExpiresAt) table.timestamp('ban_expires_at');
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
    const hasBanType = await knex.schema.hasColumn('users', 'ban_type');
    const hasBanReason = await knex.schema.hasColumn('users', 'ban_reason');
    const hasBanExpiresAt = await knex.schema.hasColumn('users', 'ban_expires_at');

    return knex.schema.table('users', table => {
        if (hasBanType) table.dropColumn('ban_type');
        if (hasBanReason) table.dropColumn('ban_reason');
        if (hasBanExpiresAt) table.dropColumn('ban_expires_at');
    });
};
