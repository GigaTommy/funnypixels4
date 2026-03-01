/**
 * 修复 base256color pattern_assets 记录的 color 字段
 *
 * 问题：category='base256color' 且 render_type='color' 的记录 color 字段为空，
 *       导致 MVT 查询 display_color = NULL，广告像素无法渲染。
 *
 * 修复：直接从 payload 字段（存储了正确的 hex 值）回填 color 字段。
 */

exports.up = async function(knex) {
  const updated = await knex('pattern_assets')
    .where('category', 'base256color')
    .where('render_type', 'color')
    .whereNull('color')
    .update({ color: knex.raw('payload') });

  console.log(`✅ 已修复 ${updated} 条 base256color 记录的 color 字段（从 payload 回填）`);
};

exports.down = async function(knex) {
  // 回滚不操作
};
