/**
 * 调试像素 MVT 渲染问题
 */

const { db } = require('../src/config/database');

const GRID_ID = 'grid_2932936_1131327';

async function debugPixel() {
  console.log(`🔍 检查像素数据: ${GRID_ID}\n`);

  // 1. 查询像素基本信息
  const pixel = await db('pixels')
    .where('grid_id', GRID_ID)
    .select('*')
    .first();

  if (!pixel) {
    console.log('❌ 像素不存在');
    process.exit(1);
  }

  console.log('📊 像素基本信息:');
  console.log('  grid_id:', pixel.grid_id);
  console.log('  user_id:', pixel.user_id);
  console.log('  pattern_id:', pixel.pattern_id);
  console.log('  color:', pixel.color);
  console.log('  pixel_type:', pixel.pixel_type);
  console.log('  alliance_id:', pixel.alliance_id);
  console.log('  lat:', pixel.lat_quantized);
  console.log('  lng:', pixel.lng_quantized);
  console.log('  created_at:', pixel.created_at);
  console.log('');

  // 2. 检查 pattern_assets
  if (pixel.pattern_id) {
    const pattern = await db('pattern_assets')
      .where('key', pixel.pattern_id)
      .select('key', 'render_type', 'color', 'file_url', 'unicode_char')
      .first();

    console.log('📦 Pattern Assets:');
    if (pattern) {
      console.log('  ✅ 找到 pattern_assets 记录');
      console.log('  render_type:', pattern.render_type);
      console.log('  color:', pattern.color);
      console.log('  file_url:', pattern.file_url);
    } else {
      console.log('  ⚠️ pattern_assets 中不存在（可能是动态查询类型）');

      // 检查是否是 user_avatar_
      if (pixel.pattern_id.startsWith('user_avatar_')) {
        const userId = pixel.pattern_id.replace('user_avatar_', '');
        const user = await db('users')
          .where('id', userId)
          .select('username', 'avatar_url')
          .first();

        if (user) {
          console.log('  ✅ 用户头像（动态查询）');
          console.log('  username:', user.username);
          console.log('  avatar_url:', user.avatar_url);
        }
      }
    }
    console.log('');
  }

  // 3. 模拟 MVT 查询（完整版）
  console.log('🗺️ MVT 查询模拟（完整逻辑）:');
  const mvtResult = await db.raw(`
    SELECT
      p.id,
      p.grid_id,
      p.pattern_id,
      p.color,
      p.pixel_type,
      p.alliance_id,
      -- 像素分类逻辑（决定渲染到哪个 layer）
      CASE
        WHEN p.pixel_type = 'ad' THEN 'ad'
        WHEN p.pixel_type = 'emoji' THEN 'emoji'
        WHEN p.pixel_type = 'alliance' THEN
          CASE
            WHEN a.flag_unicode_char IS NOT NULL AND a.flag_unicode_char != '' THEN 'emoji'
            WHEN a.flag_render_type = 'complex' THEN 'complex'
            ELSE 'color'
          END
        WHEN p.pixel_type = 'event' THEN 'event'
        WHEN p.pixel_type = 'bomb' THEN
          CASE
            WHEN pa.render_type = 'emoji' THEN 'emoji'
            WHEN pa.render_type = 'complex' THEN 'complex'
            ELSE 'color'
          END
        WHEN (p.pixel_type = 'basic' OR p.pixel_type = 'complex' OR p.pixel_type IS NULL) THEN
          CASE
            -- 字段组合识别用户头像：color='custom_pattern' AND alliance_id IS NULL
            WHEN p.color = 'custom_pattern' AND p.alliance_id IS NULL THEN 'complex'
            WHEN pa.render_type = 'emoji' THEN 'emoji'
            WHEN pa.render_type = 'complex' THEN 'complex'
            WHEN pa.render_type = 'color' THEN 'color'
            WHEN pa.render_type = 'default' THEN 'color'
            ELSE 'color'
          END
        WHEN p.pattern_id IS NULL OR p.pattern_id = '' THEN 'color'
        ELSE 'color'
      END AS mvt_pixel_type,
      -- 图片 URL（通过字段组合识别用户头像）
      CASE
        WHEN p.color = 'custom_pattern' AND p.alliance_id IS NULL THEN u.avatar_url
        WHEN pa.render_type = 'complex' THEN
          CASE
            WHEN pa.file_url IS NOT NULL THEN pa.file_url
            WHEN pa.file_path IS NOT NULL THEN pa.file_path
            ELSE NULL
          END
        ELSE NULL
      END AS image_url,
      -- 显示颜色
      CASE
        WHEN pa.render_type = 'color' THEN COALESCE(pa.color, p.color)
        WHEN p.pixel_type = 'alliance' AND a.flag_render_type = 'color' THEN COALESCE(a.color, p.color)
        ELSE p.color
      END AS display_color,
      -- pattern_assets 信息
      pa.render_type,
      pa.file_url,
      -- 用户头像 URL
      u.avatar_url
    FROM pixels p
    LEFT JOIN pattern_assets pa ON p.pattern_id = pa.key AND pa.deleted_at IS NULL
    LEFT JOIN users u ON p.user_id = u.id
    LEFT JOIN alliances a ON p.alliance_id = a.id
    WHERE p.grid_id = ?
  `, [GRID_ID]);

  const mvt = mvtResult.rows[0];
  console.log('  pixel_type (存储):', mvt.pixel_type);
  console.log('  mvt_pixel_type (MVT分类):', mvt.mvt_pixel_type);
  console.log('  pattern_assets.render_type:', mvt.render_type || 'NULL');
  console.log('  image_url:', mvt.image_url || 'NULL');
  console.log('  display_color:', mvt.display_color);
  console.log('  users.avatar_url:', mvt.avatar_url || 'NULL');
  console.log('');

  // 4. 检查问题
  console.log('🔍 问题诊断:');

  if (mvt.color === 'custom_pattern' && !mvt.alliance_id) {
    // 通过字段组合识别用户头像
    if (!mvt.avatar_url) {
      console.log('  ❌ 问题1: color="custom_pattern" 但用户没有 avatar_url');
    } else if (mvt.mvt_pixel_type !== 'complex') {
      console.log(`  ❌ 问题2: 用户头像应该分类为 complex，但实际是 ${mvt.mvt_pixel_type}`);
      console.log('      检测条件: color="custom_pattern" AND alliance_id IS NULL');
      console.log(`      当前值: color="${mvt.color}", alliance_id=${mvt.alliance_id}`);
    } else if (!mvt.image_url) {
      console.log('  ❌ 问题3: image_url 为 NULL');
    } else {
      console.log('  ✅ 用户头像数据正常（通过字段组合识别）');
    }
  }

  // 5. 缓存检查
  console.log('');
  console.log('🗂️ 缓存检查建议:');
  console.log('  清理 MVT 缓存: POST /api/tiles/pixels/cache/all');
  console.log('  清理 Sprite 缓存: POST /api/tiles/pixels/cache/clear');

  // 6. 瓦片位置
  const lat = parseFloat(pixel.lat_quantized);
  const lng = parseFloat(pixel.lng_quantized);

  console.log('');
  console.log('📍 瓦片位置:');
  console.log(`  坐标: ${lat}, ${lng}`);

  // 计算 zoom 17 的瓦片坐标
  const zoom = 17;
  const n = Math.pow(2, zoom);
  const tileX = Math.floor((lng + 180) / 360 * n);
  const latRad = lat * Math.PI / 180;
  const tileY = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n);

  console.log(`  Zoom ${zoom} 瓦片: ${zoom}/${tileX}/${tileY}`);
  console.log(`  MVT URL: /api/tiles/pixels/${zoom}/${tileX}/${tileY}.pbf`);
}

debugPixel()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ 错误:', err);
    process.exit(1);
  });
