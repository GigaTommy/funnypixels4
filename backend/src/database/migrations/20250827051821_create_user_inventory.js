/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTableIfNotExists('user_inventory', function(table) {
    table.increments('id').primary();
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.integer('item_id').notNullable().references('id').inTable('shop_skus').onDelete('CASCADE');
    table.integer('quantity').notNullable().defaultTo(1); // 物品数量
    table.boolean('is_equipped').defaultTo(false); // 是否已装备
    table.jsonb('metadata').nullable(); // 物品元数据（如装备位置、属性等）
    table.timestamp('acquired_at').defaultTo(knex.fn.now()); // 获得时间
    table.timestamp('expires_at').nullable(); // 过期时间（用于限时物品）
    table.timestamps(true, true); // created_at, updated_at
    
    // 索引
    table.index(['user_id']);
    table.index(['item_id']);
    table.index(['user_id', 'item_id']);
    table.index(['user_id', 'is_equipped']);
    table.unique(['user_id', 'item_id']); // 每个用户对每个物品只能有一条记录
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTableIfExists('user_inventory');
};
