const { Knex } = require('knex');

/**
 * @param {Knex} knex
 */
exports.up = function(knex) {
  return knex.schema
    // 广告商品表
    .createTableIfNotExists('ad_products', function(table) {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.string('name', 100).notNullable(); // 广告商品名称
      table.string('size_type', 20).notNullable(); // 'rectangle' 或 'square'
      table.integer('width').notNullable(); // 宽度
      table.integer('height').notNullable(); // 高度
      table.integer('price').notNullable().defaultTo(5000); // 价格（积分）
      table.text('description'); // 商品描述
      table.boolean('active').defaultTo(true); // 是否上架
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
      
      // 索引
      table.index(['size_type', 'active']);
    })
    
    // 广告订单表
    .createTableIfNotExists('ad_orders', function(table) {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
      table.uuid('ad_product_id').notNullable().references('id').inTable('ad_products').onDelete('CASCADE');
      table.string('ad_title', 100).notNullable(); // 广告标题
      table.text('ad_description'); // 广告描述
      table.text('original_image_url').notNullable(); // 用户上传的原始图片
      table.text('processed_image_data'); // 处理后的像素数据
      table.string('status', 20).defaultTo('pending'); // pending, approved, rejected
      table.integer('price').notNullable(); // 订单价格
      table.text('admin_notes'); // 管理员备注
      table.uuid('processed_by').references('id').inTable('users').onDelete('SET NULL');
      table.timestamp('processed_at');
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
      
      // 索引
      table.index(['user_id', 'status']);
      table.index(['status', 'created_at']);
      table.index(['ad_product_id']);
    })
    
    // 用户广告库存表
    .createTableIfNotExists('user_ad_inventory', function(table) {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
      table.uuid('ad_order_id').notNullable().references('id').inTable('ad_orders').onDelete('CASCADE');
      table.uuid('ad_product_id').notNullable().references('id').inTable('ad_products').onDelete('CASCADE');
      table.string('ad_title', 100).notNullable();
      table.text('processed_image_data').notNullable(); // 处理后的像素数据
      table.integer('width').notNullable();
      table.integer('height').notNullable();
      table.boolean('is_used').defaultTo(false); // 是否已使用
      table.timestamp('used_at'); // 使用时间
      table.timestamp('created_at').defaultTo(knex.fn.now());
      
      // 索引
      table.index(['user_id', 'is_used']);
      table.index(['ad_order_id']);
    })
    
    // 广告放置记录表
    .createTableIfNotExists('ad_placements', function(table) {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
      table.uuid('ad_inventory_id').notNullable().references('id').inTable('user_ad_inventory').onDelete('CASCADE');
      table.decimal('center_lat', 10, 7).notNullable(); // 广告中心纬度
      table.decimal('center_lng', 11, 7).notNullable(); // 广告中心经度
      table.integer('width').notNullable(); // 广告宽度
      table.integer('height').notNullable(); // 广告高度
      table.text('pixel_data').notNullable(); // 像素数据JSON
      table.integer('pixel_count').notNullable(); // 像素点总数
      table.boolean('is_active').defaultTo(true); // 是否激活
      table.timestamp('expires_at'); // 过期时间（可选）
      table.timestamp('created_at').defaultTo(knex.fn.now());
      
      // 索引
      table.index(['user_id']);
      table.index(['center_lat', 'center_lng']);
      table.index(['is_active', 'expires_at']);
    });
};

/**
 * @param {Knex} knex
 */
exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('ad_placements')
    .dropTableIfExists('user_ad_inventory')
    .dropTableIfExists('ad_orders')
    .dropTableIfExists('ad_products');
};
