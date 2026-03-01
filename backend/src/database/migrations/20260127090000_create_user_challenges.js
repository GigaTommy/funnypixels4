/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
    return knex.schema.createTable('user_challenges', table => {
        table.uuid('id').primary();
        table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
        table.date('date').notNullable();
        table.string('type').notNullable(); // draw_count, region_draw, pattern_draw
        table.integer('target_value').notNullable();
        table.integer('current_value').defaultTo(0);
        table.string('title').notNullable();
        table.string('description');
        table.boolean('is_completed').defaultTo(false);
        table.boolean('is_claimed').defaultTo(false);
        table.integer('reward_points').defaultTo(10);
        table.jsonb('data'); // 额外存储空间，如 region_id 等
        table.timestamps(true, true);

        table.unique(['user_id', 'date', 'type']);
        table.index(['user_id', 'date']);
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
    return knex.schema.dropTable('user_challenges');
};
