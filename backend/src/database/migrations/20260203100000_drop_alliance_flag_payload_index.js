/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
    return knex.schema.alterTable('alliances', function (table) {
        // Drop the index on flag_payload because it is too large for postgres index btree
        table.dropIndex(['flag_payload'], 'alliances_flag_payload_idx');
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
    return knex.schema.alterTable('alliances', function (table) {
        table.index(['flag_payload'], 'alliances_flag_payload_idx');
    });
};
