/**
 * 测试MVT中emoji字段的实际值
 */

const { db } = require('./src/config/database');

async function testEmojiField() {
  console.log('Testing emoji field value in MVT query...\n');

  try {
    // 模拟MVT查询中的emoji_char计算逻辑
    const result = await db.raw(`
      WITH tile_bounds AS (
        SELECT ST_Transform(ST_TileEnvelope(14, 13349, 7110), 4326) AS geom
      )
      SELECT
        p.id,
        p.pattern_id,
        p.pixel_type as orig_pixel_type,
        pa.render_type,
        pa.unicode_char,
        -- 这是MVT查询中的emoji_char计算逻辑
        COALESCE(
          CASE WHEN pa.render_type = 'emoji' THEN pa.unicode_char ELSE NULL END,
          NULL
        ) AS emoji_char,
        -- 判断最终的pixel_type
        CASE
          WHEN p.pixel_type = 'emoji' THEN 'emoji'
          WHEN (p.pixel_type = 'basic' OR p.pixel_type = 'complex' OR p.pixel_type IS NULL) THEN
            CASE
              WHEN pa.render_type = 'emoji' THEN 'emoji'
              WHEN pa.render_type = 'complex' THEN 'complex'
              WHEN pa.render_type = 'color' THEN 'color'
              ELSE 'color'
            END
          ELSE 'color'
        END AS final_pixel_type
      FROM pixels p
      LEFT JOIN pattern_assets pa ON p.pattern_id = pa.key AND pa.deleted_at IS NULL
      WHERE
        ST_Intersects(
          p.geom_quantized,
          (SELECT geom FROM tile_bounds)
        )
        AND p.lng_quantized IS NOT NULL
        AND p.lat_quantized IS NOT NULL
        AND p.id IN (313, 312, 311, 310, 302)
      ORDER BY p.id
    `);

    console.log('Found', result.rows.length, 'emoji pixels:\n');

    result.rows.forEach(row => {
      console.log(`ID ${row.id}:`);
      console.log(`  pattern_id: ${row.pattern_id}`);
      console.log(`  orig_pixel_type: ${row.orig_pixel_type}`);
      console.log(`  render_type: ${row.render_type}`);
      console.log(`  unicode_char: ${row.unicode_char}`);
      console.log(`  emoji_char (computed): ${row.emoji_char}`);
      console.log(`  final_pixel_type: ${row.final_pixel_type}`);
      console.log('');
    });

    // 检查是否会进入pixels-emoji图层
    const emojiLayerPixels = result.rows.filter(r =>
      r.final_pixel_type === 'emoji' && r.emoji_char !== null
    );

    console.log(`\n✅ ${emojiLayerPixels.length} pixels will be in pixels-emoji layer`);
    console.log(`❌ ${result.rows.length - emojiLayerPixels.length} pixels will be filtered out (emoji_char is null or wrong type)`);

    if (emojiLayerPixels.length > 0) {
      console.log('\nEmoji values that will appear in MVT:');
      emojiLayerPixels.forEach(r => {
        console.log(`  "${r.emoji_char}" (from pixel ${r.id})`);
      });
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

testEmojiField();
