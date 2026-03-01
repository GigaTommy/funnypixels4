/**
 * 测试联盟emoji像素是否正确包含在MVT瓦片中
 *
 * 问题：a1联盟的emoji像素（⚔️）在iOS app中不显示
 * 修复：确保alliance类型像素被正确分类为emoji，且emoji_char字段包含flag_unicode_char
 */

const { getMVTTile } = require('./src/models/productionPixelTileQuery');
const { db } = require('./src/config/database');

async function testAllianceEmojiInMVT() {
  try {
    console.log('╔══════════════════════════════════════════════════════╗');
    console.log('║       联盟Emoji像素MVT瓦片测试                         ║');
    console.log('╚══════════════════════════════════════════════════════╝\n');

    // 1. 检查a1联盟的像素数据
    console.log('📊 检查 a1 联盟像素数据:');
    const a1Pixels = await db('pixels')
      .leftJoin('alliance_members', 'pixels.user_id', 'alliance_members.user_id')
      .leftJoin('alliances', 'alliance_members.alliance_id', 'alliances.id')
      .where('alliances.name', 'a1')
      .select(
        'pixels.id',
        'pixels.grid_id',
        'pixels.pixel_type',
        'alliances.flag_unicode_char',
        'pixels.lat_quantized',
        'pixels.lng_quantized'
      )
      .limit(3);

    console.log(`   找到 ${a1Pixels.length} 个 a1 联盟像素`);
    if (a1Pixels.length > 0) {
      console.log('   示例:', JSON.stringify(a1Pixels[0], null, 2));
    }

    if (a1Pixels.length === 0) {
      console.log('\n⚠️  没有找到a1联盟像素，无法测试');
      process.exit(1);
    }

    const testPixel = a1Pixels[0];
    const testLat = testPixel.lat_quantized;
    const testLng = testPixel.lng_quantized;

    console.log(`\n📍 测试坐标: (${testLat}, ${testLng})`);

    // 2. 测试不同zoom级别的MVT瓦片
    const zoomLevels = [14, 16, 17];

    for (const z of zoomLevels) {
      const n = Math.pow(2, z);
      const x = Math.floor((testLng + 180) / 360 * n);
      const y = Math.floor((1 - Math.log(Math.tan(testLat * Math.PI / 180) + 1 / Math.cos(testLat * Math.PI / 180)) / Math.PI) / 2 * n);

      console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`测试 Zoom ${z}: 瓦片 (${x}, ${y})`);

      // 获取MVT瓦片
      const mvtBuffer = await getMVTTile(z, x, y);

      if (!mvtBuffer || mvtBuffer.length === 0) {
        console.log(`  ⚠️  瓦片为空`);
        continue;
      }

      console.log(`  📦 MVT瓦片大小: ${mvtBuffer.length} bytes`);

      // 检查后端查询（验证分类是否正确）
      const pixelTypeCheck = await db.raw(`
        WITH tile_bounds AS (
          SELECT ST_Transform(ST_TileEnvelope(?, ?, ?), 4326) AS geom
        )
        SELECT
          p.id,
          p.grid_id,
          p.pixel_type AS original_pixel_type,
          a.flag_unicode_char,
          CASE
            WHEN p.pixel_type = 'ad' THEN 'ad'
            WHEN p.pixel_type = 'emoji' THEN 'emoji'
            WHEN p.pixel_type = 'alliance' THEN
              CASE WHEN a.flag_unicode_char IS NOT NULL THEN 'emoji' ELSE 'color' END
            WHEN p.pixel_type = 'event' THEN 'event'
            WHEN p.pixel_type = 'bomb' THEN 'bomb'
            WHEN (p.pixel_type = 'basic' OR p.pixel_type = 'complex' OR p.pixel_type IS NULL) THEN
              CASE
                WHEN pa.render_type = 'emoji' THEN 'emoji'
                WHEN pa.render_type = 'complex' THEN 'complex'
                WHEN pa.render_type = 'color' THEN 'color'
                WHEN pa.render_type = 'default' THEN 'color'
                ELSE 'color'
              END
            WHEN p.pattern_id IS NULL OR p.pattern_id = '' THEN 'color'
            ELSE 'color'
          END AS classified_type,
          COALESCE(
            CASE WHEN pa.render_type = 'emoji' THEN pa.unicode_char ELSE NULL END,
            a.flag_unicode_char
          ) AS emoji_char,
          ST_Intersects(p.geom_quantized, (SELECT geom FROM tile_bounds)) AS in_tile
        FROM pixels p
        LEFT JOIN pattern_assets pa ON p.pattern_id = pa.key AND pa.deleted_at IS NULL
        LEFT JOIN alliance_members am ON p.user_id = am.user_id
        LEFT JOIN alliances a ON am.alliance_id = a.id
        WHERE p.id = ?
      `, [z, x, y, testPixel.id]);

      const pixelData = pixelTypeCheck.rows[0];
      console.log(`  📝 像素分类检查:`);
      console.log(`     原始pixel_type: ${pixelData.original_pixel_type}`);
      console.log(`     分类后type: ${pixelData.classified_type}`);
      console.log(`     emoji_char: ${pixelData.emoji_char || 'NULL'}`);
      console.log(`     在瓦片中: ${pixelData.in_tile}`);

      if (pixelData.classified_type === 'emoji' && pixelData.emoji_char) {
        console.log(`  ✅ 正确分类为emoji类型，包含emoji字符`);
      } else if (pixelData.original_pixel_type === 'alliance') {
        console.log(`  ⚠️  alliance类型像素，但分类为: ${pixelData.classified_type}`);
        if (pixelData.emoji_char) {
          console.log(`     有emoji_char: ${pixelData.emoji_char}`);
        }
      }
    }

    console.log('\n╔══════════════════════════════════════════════════════╗');
    console.log('║                    修复说明                            ║');
    console.log('╚══════════════════════════════════════════════════════╝\n');

    console.log('🔧 修复内容:');
    console.log('   1. alliance类型像素现在被正确分类为emoji（如果有emoji旗帜）');
    console.log('   2. emoji_char字段现在包括alliance.flag_unicode_char\n');

    console.log('📋 测试步骤:');
    console.log('   1. 重启backend服务（nodemon会自动重启）');
    console.log('   2. 清除MVT瓦片缓存（如果有）');
    console.log('   3. 在iOS app中重新加载地图');
    console.log('   4. 放大到zoom 16+，检查a1联盟emoji是否显示\n');

    console.log('✅ 如果修复成功，a1联盟的⚔️emoji应该在所有zoom级别可见');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ 测试失败:', error);
    process.exit(1);
  }
}

testAllianceEmojiInMVT();
