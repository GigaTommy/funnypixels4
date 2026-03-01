/**
 * 为pixels表添加统一的像素类型字段
 * 使用pixel_type枚举替代多个布尔字段，提高可扩展性
 * @param {Knex} knex
 */
exports.up = async function(knex) {
  // 检查列是否已存在
  const columnExists = await knex.raw(`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_name = 'pixels'
      AND column_name = 'pixel_type'
    );
  `);

  const hasPixelType = columnExists.rows[0].exists;

  if (!hasPixelType) {
    // 添加字段
    await knex.schema.alterTable('pixels', function(table) {
      // 添加统一的像素类型字段
      table.string('pixel_type', 20).defaultTo('basic').comment('像素类型: basic/bomb/ad/alliance/event');
      table.uuid('related_id').nullable().comment('关联的ID（如广告放置ID、炸弹ID等）');

      // 添加索引
      table.index(['pixel_type']);
      table.index(['pixel_type', 'related_id']);
    });

    // 添加约束
    await knex.raw('ALTER TABLE pixels ADD CONSTRAINT chk_pixels_pixel_type_enum CHECK (pixel_type IN (\'basic\', \'bomb\', \'ad\', \'alliance\', \'event\'));');

    console.log('✅ 成功添加 pixel_type 和 related_id 列');
  } else {
    console.log('ℹ️  pixel_type 列已存在，跳过迁移');
  }
};

/**
 * 回滚迁移
 * @param {Knex} knex
 */
exports.down = async function(knex) {
  // 删除约束
  await knex.raw('ALTER TABLE pixels DROP CONSTRAINT IF EXISTS chk_pixels_pixel_type_enum;');
  
  // 删除字段和索引
  return knex.schema.alterTable('pixels', function(table) {
    // 删除索引
    table.dropIndex(['pixel_type']);
    table.dropIndex(['pixel_type', 'related_id']);
    
    // 删除字段
    table.dropColumn('pixel_type');
    table.dropColumn('related_id');
  });
};
