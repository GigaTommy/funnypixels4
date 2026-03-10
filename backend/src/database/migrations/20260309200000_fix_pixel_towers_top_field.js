/**
 * Fix pixel_towers.top_color field
 *
 * 问题：top_color VARCHAR(7) 只能存颜色码，无法表示 emoji/complex 类型像素
 *
 * 解决方案：
 * - 将 top_color 重命名为 top_pattern_id
 * - 扩展长度到 VARCHAR(100)，以支持所有 pattern_id
 *
 * pattern_id 示例：
 * - 颜色：color_magenta
 * - Emoji：emoji_cn
 * - 用户头像：user_avatar_xxx
 * - 联盟旗帜：complex_flag_xxx
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */

exports.up = async function(knex) {
  console.log('🔧 修复 pixel_towers.top_color 字段...\n');

  try {
    // 1. 检查列是否存在
    const hasTopColor = await knex.schema.hasColumn('pixel_towers', 'top_color');

    if (!hasTopColor) {
      console.log('⚠️  top_color 列不存在，跳过迁移');
      return;
    }

    console.log('1️⃣ 重命名 top_color -> top_pattern_id');
    await knex.schema.alterTable('pixel_towers', (table) => {
      table.renameColumn('top_color', 'top_pattern_id');
    });

    console.log('2️⃣ 扩展字段长度到 VARCHAR(100)');
    await knex.raw(`
      ALTER TABLE pixel_towers
      ALTER COLUMN top_pattern_id TYPE VARCHAR(100)
    `);

    console.log('3️⃣ 更新注释');
    await knex.raw(`
      COMMENT ON COLUMN pixel_towers.top_pattern_id IS
      '顶楼像素的 pattern_id（支持 color/emoji/complex 所有类型）'
    `);

    console.log('\n✅ 迁移完成！');
    console.log('   top_color VARCHAR(7) -> top_pattern_id VARCHAR(100)\n');

  } catch (error) {
    console.error('❌ 迁移失败:', error.message);
    throw error;
  }
};

/**
 * Rollback migration
 */
exports.down = async function(knex) {
  console.log('🔙 回滚 pixel_towers.top_pattern_id 字段...\n');

  try {
    const hasTopPatternId = await knex.schema.hasColumn('pixel_towers', 'top_pattern_id');

    if (!hasTopPatternId) {
      console.log('⚠️  top_pattern_id 列不存在，跳过回滚');
      return;
    }

    console.log('1️⃣ 缩短字段长度到 VARCHAR(7)');
    await knex.raw(`
      ALTER TABLE pixel_towers
      ALTER COLUMN top_pattern_id TYPE VARCHAR(7)
    `);

    console.log('2️⃣ 重命名 top_pattern_id -> top_color');
    await knex.schema.alterTable('pixel_towers', (table) => {
      table.renameColumn('top_pattern_id', 'top_color');
    });

    console.log('\n✅ 回滚完成');

  } catch (error) {
    console.error('❌ 回滚失败:', error.message);
    throw error;
  }
};
