/**
 * 创建用户间互相点赞表
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
    return knex.schema.createTableIfNotExists('user_likes', function (table) {
        table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
        table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
        table.uuid('target_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
        table.string('target_type').defaultTo('user');
        table.timestamp('created_at').defaultTo(knex.fn.now());

        // 唯一约束：防止重复点赞
        table.unique(['user_id', 'target_id', 'target_type']);

        // 索引
        table.index(['target_id', 'target_type']);
        table.index(['user_id']);
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
    return knex.schema.dropTableIfExists('user_likes');
};
