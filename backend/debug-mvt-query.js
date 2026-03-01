/**
 * 调试MVT查询
 */

const { db } = require('./src/config/database');

async function debugMVT() {
  const z = 14;
  const x = 13349;
  const y = 7110;

  console.log(`Testing MVT tile: z=${z}, x=${x}, y=${y}\n`);

  try {
    // Step 1: 检查pixels_in_tile
    const pixelsInTile = await db.raw(`
      WITH tile_bounds AS (
        SELECT ST_Transform(ST_TileEnvelope(?, ?, ?), 4326) AS geom
      )
      SELECT
        p.id,
        p.pixel_type as orig_pixel_type,
        p.pattern_id,
        p.color as orig_color,
        pa.render_type,
        pa.unicode_char,
        pa.color as pa_color,
        CASE
          WHEN p.pixel_type = 'ad' THEN 'ad'
          WHEN p.pixel_type = 'emoji' THEN 'emoji'
          WHEN (p.pixel_type = 'basic' OR p.pixel_type = 'complex' OR p.pixel_type IS NULL) THEN
            CASE
              WHEN pa.render_type = 'emoji' THEN 'emoji'
              WHEN pa.render_type = 'complex' THEN 'complex'
              WHEN pa.render_type = 'color' THEN 'color'
              WHEN pa.render_type = 'default' THEN 'color'
              ELSE 'color'
            END
          ELSE 'color'
        END AS final_pixel_type,
        CASE
          WHEN pa.render_type = 'color' THEN pa.color
          ELSE p.color
        END AS display_color,
        COALESCE(
          CASE WHEN pa.render_type = 'emoji' THEN pa.unicode_char ELSE NULL END,
          NULL
        ) AS emoji_char
      FROM pixels p
      LEFT JOIN pattern_assets pa ON p.pattern_id = pa.key AND pa.deleted_at IS NULL
      WHERE
        ST_Intersects(
          p.geom_quantized,
          (SELECT geom FROM tile_bounds)
        )
        AND p.lng_quantized IS NOT NULL
        AND p.lat_quantized IS NOT NULL
      LIMIT 20
    `, [z, x, y]);

    console.log(`Found ${pixelsInTile.rows.length} pixels in tile:\n`);
    pixelsInTile.rows.forEach(p => {
      console.log(`ID ${p.id}:`);
      console.log(`  orig_pixel_type: ${p.orig_pixel_type}`);
      console.log(`  pattern_id: ${p.pattern_id}`);
      console.log(`  render_type: ${p.render_type}`);
      console.log(`  final_pixel_type: ${p.final_pixel_type}`);
      console.log(`  display_color: ${p.display_color}`);
      console.log(`  emoji_char: ${p.emoji_char}`);
      console.log('');
    });

    // Step 2: 统计每种类型的数量
    const colorCount = pixelsInTile.rows.filter(p => p.final_pixel_type === 'color').length;
    const emojiCount = pixelsInTile.rows.filter(p => p.final_pixel_type === 'emoji').length;
    const complexCount = pixelsInTile.rows.filter(p => p.final_pixel_type === 'complex').length;
    const adCount = pixelsInTile.rows.filter(p => p.final_pixel_type === 'ad').length;

    console.log(`Type distribution:`);
    console.log(`  color: ${colorCount}`);
    console.log(`  emoji: ${emojiCount}`);
    console.log(`  complex: ${complexCount}`);
    console.log(`  ad: ${adCount}`);

    // Step 3: 检查每个类型的WHERE条件
    console.log(`\n=== Checking WHERE conditions ===\n`);

    const colorFiltered = pixelsInTile.rows.filter(p =>
      p.final_pixel_type === 'color' && p.display_color !== null
    );
    console.log(`color after WHERE filter: ${colorFiltered.length}/${colorCount}`);
    if (colorFiltered.length < colorCount) {
      console.log(`  Filtered out: ${colorCount - colorFiltered.length} (display_color is null)`);
    }

    const emojiFiltered = pixelsInTile.rows.filter(p =>
      p.final_pixel_type === 'emoji' && p.emoji_char !== null
    );
    console.log(`emoji after WHERE filter: ${emojiFiltered.length}/${emojiCount}`);
    if (emojiFiltered.length < emojiCount) {
      console.log(`  Filtered out: ${emojiCount - emojiFiltered.length} (emoji_char is null)`);
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

debugMVT();
