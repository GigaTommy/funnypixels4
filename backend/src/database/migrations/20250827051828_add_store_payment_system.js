/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema
  // 注意：users表中的points字段已经存在，不需要再次添加
    
    // 创建充值订单表
    .createTableIfNotExists('recharge_orders', function(table) {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
      table.decimal('amount_rmb', 10, 2).notNullable();
      table.integer('points').notNullable();
      table.enum('channel', ['wechat', 'alipay', 'mock']).notNullable();
      table.enum('status', ['pending', 'paid', 'failed']).notNullable().defaultTo('pending');
      table.string('idempotency_key', 255).notNullable().unique();
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('paid_at').nullable();
      
      // 索引
      table.index(['user_id']);
      table.index(['status']);
      table.index(['created_at']);
      table.index(['idempotency_key']);
    })
    
    // 创建钱包账本表
    .createTableIfNotExists('wallet_ledger', function(table) {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
      table.integer('delta_points').notNullable(); // 积分变动（正数为增加，负数为减少）
      table.string('reason', 100).notNullable(); // 变动原因
      table.string('ref_id', 255).nullable(); // 关联ID（如订单ID、商品ID等）
      table.timestamp('created_at').defaultTo(knex.fn.now());
      
      // 索引
      table.index(['user_id']);
      table.index(['created_at']);
      table.index(['ref_id']);
    })
    
    // 创建幂等键表（当没有Redis时使用）
    .createTableIfNotExists('idempotency_keys', function(table) {
      table.string('key', 255).primary();
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('expires_at').notNullable();
      
      // 索引
      table.index(['expires_at']);
    })
    
    // 修改 store_items 表，添加新的字段
    .alterTable('store_items', function(table) {
      table.integer('price_points').notNullable().defaultTo(0); // 积分价格
      table.boolean('require_cash').defaultTo(false); // 是否仅现金可购
      table.jsonb('metadata').nullable(); // 商品元数据
      table.boolean('active').defaultTo(true); // 是否激活
    })
    
    // 修改 user_inventory 表，添加消费状态字段
    .alterTable('user_inventory', function(table) {
      table.boolean('consumed').defaultTo(false); // 是否已消费
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('idempotency_keys')
    .dropTableIfExists('wallet_ledger')
    .dropTableIfExists('recharge_orders')
    .alterTable('user_inventory', function(table) {
      table.dropColumn('consumed');
    })
    .alterTable('store_items', function(table) {
      table.dropColumn('active');
      table.dropColumn('metadata');
      table.dropColumn('require_cash');
      table.dropColumn('price_points');
    });
  // 注意：不删除users表中的points字段，因为该字段可能被其他功能使用
};
