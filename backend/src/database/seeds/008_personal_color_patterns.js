/**
 * Seed: Personal Color Palette Patterns
 * 为用户默认头像创建对应的 pattern_assets 记录
 * 这些 patterns 必须存在以确保地图渲染正常工作
 * Date: 2026-02-13
 */

exports.seed = async function(knex) {
  // Personal Color Palette - 16色运动调色板
  // 与 iOS PersonalColorPalette.swift 保持一致
  const personalColors = [
    { hex: '#E53E3E', name: '个人颜色 - 红色' },
    { hex: '#DD6B20', name: '个人颜色 - 橙色' },
    { hex: '#D69E2E', name: '个人颜色 - 黄色' },
    { hex: '#38A169', name: '个人颜色 - 绿色' },
    { hex: '#319795', name: '个人颜色 - 青色' },
    { hex: '#3182CE', name: '个人颜色 - 蓝色' },
    { hex: '#5A67D8', name: '个人颜色 - 靛蓝' },
    { hex: '#805AD5', name: '个人颜色 - 紫色' },
    { hex: '#D53F8C', name: '个人颜色 - 粉色' },
    { hex: '#C53030', name: '个人颜色 - 深红' },
    { hex: '#2D3748', name: '个人颜色 - 灰色' },
    { hex: '#744210', name: '个人颜色 - 棕色' },
    { hex: '#276749', name: '个人颜色 - 深绿' },
    { hex: '#2A4365', name: '个人颜色 - 深蓝' },
    { hex: '#553C9A', name: '个人颜色 - 深紫' },
    { hex: '#97266D', name: '个人颜色 - 深粉' }
  ];

  const patterns = personalColors.map(color => {
    // 生成 key：personal_color_{hex_without_hash}
    const key = `personal_color_${color.hex.replace('#', '').toLowerCase()}`;

    return {
      key: key,
      name: color.name,
      description: `用户默认头像颜色 - ${color.hex}`,
      category: 'personal_color',
      tags: ['个人颜色', '默认头像', color.hex],
      is_public: false, // 个人颜色不公开显示
      created_by: null,
      download_count: 0,
      rating: 0,
      review_count: 0,
      created_at: new Date(),
      updated_at: new Date(),
      width: 1,
      height: 1,
      verified: true,
      // ✅ render_type: 'color' 只需要 color 字段
      render_type: 'color',
      color: color.hex,
      // ❌ 不需要 unicode_char (只有 emoji 类型需要)
      // ❌ 不需要 payload (只有某些类型需要)
      // ❌ 不需要 encoding
      // ❌ 不需要 image_url/file_url
      material_id: null,
      material_version: 1,
      material_metadata: {
        purpose: 'personal_default_avatar',
        palette: 'PersonalColorPalette'
      }
    };
  });

  // 使用 onConflict 避免重复插入（如果 key 已存在则更新）
  await knex('pattern_assets')
    .insert(patterns)
    .onConflict('key')
    .merge(['name', 'description', 'color', 'render_type', 'width', 'height', 'updated_at']);

  console.log(`✅ Personal Color Palette: ${patterns.length} patterns inserted/updated`);
};
