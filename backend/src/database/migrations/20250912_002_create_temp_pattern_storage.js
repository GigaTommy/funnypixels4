/**
 * 创建临时图案存储表
 * 用于存储用户上传的自定义像素图案，等待审批后转换为正式图案
 */

exports.up = function(knex) {
  return knex.schema.createTableIfNotExists('temp_pattern_storage', function(table) {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('order_id').notNullable().references('id').inTable('custom_flag_orders').onDelete('CASCADE');
    table.string('pattern_name').notNullable();
    table.text('rle_payload').notNullable(); // 存储RLE格式的像素数据
    table.integer('width').notNullable().defaultTo(64);
    table.integer('height').notNullable().defaultTo(64);
    table.json('color_features'); // 存储颜色特征信息
    table.text('original_image_data'); // 存储原始base64图像数据（可选）
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    table.timestamp('expires_at'); // 设置过期时间，自动清理

    // 索引
    table.index(['order_id']);
    table.index(['expires_at']);
    table.index(['created_at']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('temp_pattern_storage');
};