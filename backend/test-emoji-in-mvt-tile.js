/**
 * 测试a1联盟emoji像素是否在MVT瓦片中
 */

const { getMVTTile } = require('./src/models/productionPixelTileQuery');
const { db } = require('./src/config/database');

async function testEmojiPixelInMVT() {
  try {
    console.log('╔══════════════════════════════════════════════════════╗');
    console.log('║       测试a1联盟emoji像素在MVT瓦片中                ║');
    console.log('╚══════════════════════════════════════════════════════╝\n');

    // 使用测试发现的emoji像素坐标
    const testLat = 23.1102321;
    const testLng = 113.3280227;

    console.log(`📍 测试坐标: (${testLat}, ${testLng})`);
    console.log('   这是a1联盟的一个emoji像素（⚔️）\n');

    const zoomLevels = [14, 15, 16, 17];

    for (const z of zoomLevels) {
      const n = Math.pow(2, z);
      const x = Math.floor((testLng + 180) / 360 * n);
      const y = Math.floor((1 - Math.log(Math.tan(testLat * Math.PI / 180) + 1 / Math.cos(testLat * Math.PI / 180)) / Math.PI) / 2 * n);

      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`Zoom ${z}: 瓦片 (${x}, ${y})`);

      // 直接查询数据库，检查emoji像素是否在这个瓦片中
      const emojiInTile = await db.raw(`
        WITH tile_bounds AS (
          SELECT ST_Transform(ST_TileEnvelope(?, ?, ?), 4326) AS geom
        )
        SELECT
          p.id,
          p.grid_id,
          p.pixel_type,
          pa.unicode_char,
          pa.render_type,
          ST_Intersects(p.geom_quantized, (SELECT geom FROM tile_bounds)) AS in_tile
        FROM pixels p
        LEFT JOIN pattern_assets pa ON p.pattern_id = pa.key AND pa.deleted_at IS NULL
        WHERE p.grid_id IN (
          SELECT grid_id FROM pixels WHERE lat_quantized = ? AND lng_quantized = ?
        )
        AND pa.render_type = 'emoji'
      `, [z, x, y, testLat, testLng]);

      const emojiCount = emojiInTile.rows.filter(r => r.in_tile).length;
      console.log(`   📊 emoji像素在瓦片中: ${emojiCount} 个`);
      if (emojiCount > 0) {
        console.log(`   ✅ emoji字符: ${emojiInTile.rows.filter(r => r.in_tile).map(r => r.unicode_char).join(', ')}`);
      }

      // 获取MVT瓦片
      const mvtBuffer = await getMVTTile(z, x, y);
      if (mvtBuffer && mvtBuffer.length > 0) {
        console.log(`   📦 MVT瓦片大小: ${mvtBuffer.length} bytes`);

        // 检查MVT瓦片中是否有emoji数据（通过查询验证）
        const checkEmoji = await db.raw(`
          WITH tile_bounds AS (
            SELECT ST_Transform(ST_TileEnvelope(?, ?, ?), 4326) AS geom
          ),
          pixels_in_tile AS (
            SELECT
              p.id,
              p.grid_id,
              COALESCE(
                CASE WHEN pa.render_type = 'emoji' THEN pa.unicode_char ELSE NULL END,
                a.flag_unicode_char
              ) AS emoji_char,
              CASE
                WHEN p.pixel_type = 'emoji' THEN 'emoji'
                WHEN p.pixel_type = 'alliance' THEN
                  CASE WHEN a.flag_unicode_char IS NOT NULL THEN 'emoji' ELSE 'color' END
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
              END AS pixel_type
            FROM pixels p
            LEFT JOIN pattern_assets pa ON p.pattern_id = pa.key AND pa.deleted_at IS NULL
            LEFT JOIN alliance_members am ON p.user_id = am.user_id
            LEFT JOIN alliances a ON am.alliance_id = a.id
            WHERE ST_Intersects(p.geom_quantized, (SELECT geom FROM tile_bounds))
              AND p.lng_quantized IS NOT NULL
              AND p.lat_quantized IS NOT NULL
              AND ST_IsValid(p.geom_quantized)
              AND (1.0 >= 1.0 OR (hashtext(p.grid_id::text)::bigint % 100) < 100)
          )
          SELECT COUNT(*) as emoji_count
          FROM pixels_in_tile
          WHERE pixel_type = 'emoji' AND emoji_char IS NOT NULL
        `, [z, x, y]);

        const mvtEmojiCount = parseInt(checkEmoji.rows[0].emoji_count);
        console.log(`   📊 MVT中emoji像素: ${mvtEmojiCount} 个`);

        if (mvtEmojiCount > 0) {
          console.log(`   ✅ MVT瓦片包含emoji数据`);
        } else {
          console.log(`   ❌ MVT瓦片不包含emoji数据`);
        }
      } else {
        console.log(`   ⚠️  MVT瓦片为空`);
      }
    }

    console.log('\n╔══════════════════════════════════════════════════════╗');
    console.log('║                    分析结论                          ║');
    console.log('╚══════════════════════════════════════════════════════╝\n');

    console.log('📋 如果MVT瓦片包含emoji数据，但iOS不显示:');
    console.log('   1. 检查iOS是否成功注册emoji图标');
    console.log('   2. 检查iOS emoji图层是否正确添加');
    console.log('   3. 检查iOS emoji图层的iconImageName是否正确');
    console.log('   4. 检查iOS emoji图层的sourceLayerIdentifier是否正确\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ 测试失败:', error);
    process.exit(1);
  }
}

testEmojiPixelInMVT();
