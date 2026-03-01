/**
 * 添加256色调色板到 pattern_assets 表
 *
 * 注意：使用 category='base256color' 与联盟旗帜颜色板隔离
 * - 联盟旗帜颜色板：category 为其他值（如'flag', 'alliance'等）
 * - 256色基础调色板：category='base256color'
 *
 * 包含：
 * - 216个Web安全色（6×6×6 RGB立方体）
 * - 40个灰度级
 */

exports.up = async function(knex) {
  console.log('📦 开始添加 256 色调色板...');

  // 1. 生成 216 个 Web 安全色
  const rgbLevels = [0, 51, 102, 153, 204, 255];
  const webSafeColors = [];

  for (const r of rgbLevels) {
    for (const g of rgbLevels) {
      for (const b of rgbLevels) {
        const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`.toUpperCase();
        webSafeColors.push({
          key: `color_256_${hex}`,
          name: `256色-${hex}`,  // 添加name字段
          render_type: 'color',
          color: hex,  // ✅ 颜色存储在 color 字段
          payload: hex,
          category: 'base256color',  // ✅ 关键：与联盟旗帜颜色板隔离
          created_at: new Date(),
          updated_at: new Date()
        });
      }
    }
  }

  console.log(`✅ 生成了 ${webSafeColors.length} 个 Web 安全色`);

  // 2. 生成 40 个灰度级
  const grayscaleColors = [];
  for (let i = 0; i < 40; i++) {
    const gray = Math.floor((i / 39) * 255);
    const hex = `#${gray.toString(16).padStart(2, '0')}${gray.toString(16).padStart(2, '0')}${gray.toString(16).padStart(2, '0')}`.toUpperCase();
    grayscaleColors.push({
      key: `color_256_gray_${i}`,
      name: `256色灰度-${i}`,  // 添加name字段
      render_type: 'color',
      color: hex,  // ✅ 颜色存储在 color 字段
      payload: hex,
      category: 'base256color',  // ✅ 关键：与联盟旗帜颜色板隔离
      created_at: new Date(),
      updated_at: new Date()
    });
  }

  console.log(`✅ 生成了 ${grayscaleColors.length} 个灰度级`);

  // 3. 批量插入
  const allColors = [...webSafeColors, ...grayscaleColors];

  // 分批插入（每批100个，避免SQL过长）
  const batchSize = 100;
  for (let i = 0; i < allColors.length; i += batchSize) {
    const batch = allColors.slice(i, i + batchSize);
    await knex('pattern_assets').insert(batch);
    console.log(`📊 已插入 ${Math.min(i + batchSize, allColors.length)}/${allColors.length} 个颜色`);
  }

  console.log(`✅ 成功添加 ${allColors.length} 个颜色到调色板（category=base256color）`);
  console.log('');
  console.log('📋 颜色板分类说明：');
  console.log('  - category="base256color": 256色基础调色板（用于广告图片）');
  console.log('  - category=其他值: 联盟旗帜颜色板（不受影响）');
};

exports.down = async function(knex) {
  console.log('🗑️ 开始回滚：删除256色调色板...');

  const deletedCount = await knex('pattern_assets')
    .where('category', 'base256color')
    .delete();

  console.log(`✅ 已删除 ${deletedCount} 个颜色（category=base256color）`);
};
