/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
    const hasMaxMembers = await knex.schema.hasColumn('alliances', 'max_members');

    if (!hasMaxMembers) {
        await knex.schema.alterTable('alliances', function (table) {
            table.integer('max_members').defaultTo(50).comment('联盟最大成员数');
        });
    }
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
    const hasMaxMembers = await knex.schema.hasColumn('alliances', 'max_members');

    if (hasMaxMembers) {
        await knex.schema.alterTable('alliances', function (table) {
            table.dropColumn('max_members');
        });
    }
};
