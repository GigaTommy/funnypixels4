/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
    return knex.schema.createTableIfNotExists('alliance_invites', function (table) {
        table.uuid('id').primary();
        table.integer('alliance_id').notNullable().references('id').inTable('alliances').onDelete('CASCADE');
        table.string('invite_code', 10).notNullable().unique();
        table.uuid('created_by').notNullable().references('id').inTable('users').onDelete('CASCADE');
        table.timestamp('expires_at').notNullable();
        table.boolean('is_active').defaultTo(true);
        table.uuid('used_by').nullable().references('id').inTable('users');
        table.timestamp('used_at').nullable();
        table.timestamps(true, true); // created_at, updated_at

        // 索引
        table.index(['alliance_id']);
        table.index(['invite_code']);
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
    return knex.schema.dropTableIfExists('alliance_invites');
};
