/**
 * 为pixels表添加统一的像素类型字段
 * 使用pixel_type枚举替代多个布尔字段，提高可扩展性
 * 注意：这个迁移现在与20250911000001_add_pixel_type_to_pixels.js重复
 * 该迁移已经添加了pixel_type和related_id列，所以这里只是做兼容性检查
 * @param {Knex} knex
 */
exports.up = async function(knex) {
  // 检查列是否已存在（由前面的迁移添加）
  const columnExists = await knex.raw(`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'pixels'
      AND column_name = 'pixel_type'
    )
  `);

  // 如果列不存在，则添加（向后兼容）
  if (!columnExists.rows[0].exists) {
    await knex.schema.alterTable('pixels', function(table) {
      table.string('pixel_type', 20).defaultTo('basic').comment('像素类型: basic/bomb/ad/alliance/event');
      table.uuid('related_id').nullable().comment('关联的ID（如广告放置ID、炸弹ID等）');
      table.index(['pixel_type']);
      table.index(['pixel_type', 'related_id']);
    });

    await knex.raw('ALTER TABLE pixels ADD CONSTRAINT chk_pixels_pixel_type_enum CHECK (pixel_type IN (\'basic\', \'bomb\', \'ad\', \'alliance\', \'event\'));');
  } else {
    console.log('✅ pixel_type和related_id列已存在，跳过迁移');
  }
};

/**
 * 回滚迁移
 * 注意：由于列可能由其他迁移添加，这里不做实际删除
 * @param {Knex} knex
 */
exports.down = async function(knex) {
  // 由于列可能由前面的迁移添加，这里不做实际回滚
  console.log('⚠️ 跳过回滚：列可能由其他迁移管理');
};
