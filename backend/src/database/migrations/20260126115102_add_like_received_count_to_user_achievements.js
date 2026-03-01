/**
 * 向 user_achievements 表添加缺失的统计字段
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
    const hasTable = await knex.schema.hasTable('user_achievements');
    if (!hasTable) return;

    const hasColumn = await knex.schema.hasColumn('user_achievements', 'like_received_count');
    if (hasColumn) return;

    return knex.schema.alterTable('user_achievements', function (table) {
        table.bigInteger('like_received_count').defaultTo(0).index();
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
    return knex.schema.alterTable('user_achievements', function (table) {
        table.dropColumn('like_received_count');
    });
};
