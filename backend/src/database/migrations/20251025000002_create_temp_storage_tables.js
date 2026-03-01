/**
 * 创建临时存储表，用于存储待审核的图案和广告数据
 */

exports.up = async function(knex) {
  // 创建临时图案存储表（如果不存在）
  const hasTempPatternStorage = await knex.schema.hasTable('temp_pattern_storage');
  if (!hasTempPatternStorage) {
    await knex.schema.createTable('temp_pattern_storage', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('order_id').notNullable().unique().comment('自定义旗帜订单ID');
      table.foreign('order_id').references('id').inTable('custom_flag_orders').onDelete('CASCADE');

      // 图案数据
      table.text('pattern_data').notNullable().comment('处理后的图案数据');
      table.string('preview_url', 512).comment('预览图URL');
      table.integer('width').notNullable().comment('图案宽度');
      table.integer('height').notNullable().comment('图案高度');
      table.string('encoding', 50).defaultTo('base64').comment('编码格式');

      // 元数据
      table.jsonb('metadata').comment('其他元数据');

      // 时间戳
      table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
      table.timestamp('expires_at').comment('过期时间');

      // 索引
      table.index('order_id');
      table.index('created_at');
    });
    console.log('✅ 临时图案存储表创建成功');
  }

  // 创建临时广告存储表（如果不存在）
  const hasTempAdStorage = await knex.schema.hasTable('temp_ad_storage');
  if (!hasTempAdStorage) {
    await knex.schema.createTable('temp_ad_storage', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('order_id').notNullable().unique().comment('广告订单ID');
      table.foreign('order_id').references('id').inTable('ad_orders').onDelete('CASCADE');

      // 广告数据
      table.text('ad_data').notNullable().comment('处理后的广告数据');
      table.string('preview_url', 512).comment('预览图URL');
      table.integer('width').notNullable().comment('广告宽度');
      table.integer('height').notNullable().comment('广告高度');

      // 元数据
      table.jsonb('metadata').comment('其他元数据');

      // 时间戳
      table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
      table.timestamp('expires_at').comment('过期时间');

      // 索引
      table.index('order_id');
      table.index('created_at');
    });
    console.log('✅ 临时广告存储表创建成功');
  }
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('temp_ad_storage');
  await knex.schema.dropTableIfExists('temp_pattern_storage');
  console.log('✅ 临时存储表已删除');
};
