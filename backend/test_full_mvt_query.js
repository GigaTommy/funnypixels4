const knex = require('knex')({
  client: 'pg',
  connection: {
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'password',
    database: 'funnypixels_postgres'
  }
});

// 新大新坐标
const lat = 23.13645;
const lng = 113.29395;
const z = 17;

// 计算瓦片坐标
const n = Math.pow(2, z);
const x = Math.floor((lng + 180) / 360 * n);
const y = Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * n);

console.log('='.repeat(80));
console.log('测试完整 MVT SQL 查询');
console.log('='.repeat(80));
console.log(`瓦片: ${z}/${x}/${y}`);
console.log();

// 采样率设置（和实际代码一致）
const samplingRate = 1.0;
const maxFeatures = 100000;

async function testMVTQuery() {
  try {
    // 1. 先测试 pixels_in_tile CTE，看看有多少像素被选中
    console.log('[1] 测试 pixels_in_tile CTE...\n');

    const pixelsQuery = `
      WITH tile_bounds AS (
        SELECT ST_Transform(ST_TileEnvelope(?, ?, ?), 4326) AS geom
      )
      SELECT
        pixel_type,
        COUNT(*) as count
      FROM (
        SELECT
          CASE
            WHEN p.pixel_type = 'alliance' THEN
              CASE
                WHEN a.flag_unicode_char IS NOT NULL AND a.flag_unicode_char != '' THEN 'emoji'
                WHEN a.flag_render_type = 'complex' THEN 'complex'
                ELSE 'color'
              END
            WHEN (p.pixel_type = 'basic' OR p.pixel_type = 'complex' OR p.pixel_type IS NULL) THEN
              CASE
                WHEN p.color = 'custom_pattern' AND p.alliance_id IS NULL THEN 'complex'
                WHEN pa.render_type = 'emoji' THEN 'emoji'
                WHEN pa.render_type = 'complex' THEN 'complex'
                WHEN pa.render_type = 'color' THEN 'color'
                WHEN pa.render_type = 'default' THEN 'color'
                ELSE 'color'
              END
            WHEN p.pattern_id IS NULL OR p.pattern_id = '' THEN 'color'
            ELSE 'color'
          END AS pixel_type,
          p.pattern_id,
          p.geom_quantized
        FROM pixels p
        LEFT JOIN pattern_assets pa ON p.pattern_id = pa.key AND pa.deleted_at IS NULL
        LEFT JOIN users u ON p.user_id = u.id
        LEFT JOIN alliances a ON p.alliance_id = a.id
        WHERE
          ST_Intersects(
            p.geom_quantized,
            (SELECT geom FROM tile_bounds)
          )
          AND p.lng_quantized IS NOT NULL
          AND p.lat_quantized IS NOT NULL
          AND p.lng_quantized >= -180.0 AND p.lng_quantized <= 180.0
          AND p.lat_quantized >= -90.0 AND p.lat_quantized <= 90.0
          AND ST_IsValid(p.geom_quantized)
          AND (
            ? >= 1.0 OR
            (hashtext(p.grid_id::text)::bigint % 100) < ?
          )
      ) AS classified
      GROUP BY pixel_type
      ORDER BY pixel_type
    `;

    const pixelsResult = await knex.raw(pixelsQuery, [
      z, x, y,
      samplingRate,
      Math.floor(samplingRate * 100)
    ]);

    console.log('pixels_in_tile 分类统计:');
    pixelsResult.rows.forEach(row => {
      console.log(`  ${row.pixel_type}: ${row.count}`);
    });
    console.log();

    // 2. 测试 complex 层的 WHERE 过滤
    console.log('[2] 测试 complex 层的 WHERE 过滤...\n');

    const complexFilterQuery = `
      WITH tile_bounds AS (
        SELECT ST_Transform(ST_TileEnvelope(?, ?, ?), 4326) AS geom
      ),
      pixels_in_tile AS (
        SELECT
          p.id,
          p.grid_id,
          p.pattern_id,
          CASE
            WHEN p.pixel_type = 'alliance' THEN
              CASE
                WHEN a.flag_unicode_char IS NOT NULL AND a.flag_unicode_char != '' THEN 'emoji'
                WHEN a.flag_render_type = 'complex' THEN 'complex'
                ELSE 'color'
              END
            WHEN (p.pixel_type = 'basic' OR p.pixel_type = 'complex' OR p.pixel_type IS NULL) THEN
              CASE
                WHEN p.color = 'custom_pattern' AND p.alliance_id IS NULL THEN 'complex'
                WHEN pa.render_type = 'emoji' THEN 'emoji'
                WHEN pa.render_type = 'complex' THEN 'complex'
                WHEN pa.render_type = 'color' THEN 'color'
                WHEN pa.render_type = 'default' THEN 'color'
                ELSE 'color'
              END
            WHEN p.pattern_id IS NULL OR p.pattern_id = '' THEN 'color'
            ELSE 'color'
          END AS pixel_type,
          p.geom_quantized,
          CASE
            WHEN p.color = 'custom_pattern' AND p.alliance_id IS NULL THEN u.avatar_url
            WHEN pa.render_type = 'complex' THEN
              CASE
                WHEN pa.file_url IS NOT NULL THEN pa.file_url
                WHEN pa.file_path IS NOT NULL THEN pa.file_path
                ELSE NULL
              END
            ELSE NULL
          END AS image_url
        FROM pixels p
        LEFT JOIN pattern_assets pa ON p.pattern_id = pa.key AND pa.deleted_at IS NULL
        LEFT JOIN users u ON p.user_id = u.id
        LEFT JOIN alliances a ON p.alliance_id = a.id
        WHERE
          ST_Intersects(
            p.geom_quantized,
            (SELECT geom FROM tile_bounds)
          )
          AND p.lng_quantized IS NOT NULL
          AND p.lat_quantized IS NOT NULL
          AND p.lng_quantized >= -180.0 AND p.lng_quantized <= 180.0
          AND p.lat_quantized >= -90.0 AND p.lat_quantized <= 90.0
          AND ST_IsValid(p.geom_quantized)
          AND (
            ? >= 1.0 OR
            (hashtext(p.grid_id::text)::bigint % 100) < ?
          )
        LIMIT ?
      )
      SELECT
        COUNT(*) FILTER (WHERE pixel_type = 'complex') as total_complex,
        COUNT(*) FILTER (WHERE pixel_type = 'complex' AND pattern_id IS NOT NULL) as complex_with_pattern,
        COUNT(*) FILTER (WHERE pixel_type = 'complex' AND pattern_id IS NOT NULL AND geom_quantized IS NOT NULL) as complex_passthrough,
        COUNT(*) FILTER (WHERE pixel_type = 'complex' AND image_url IS NOT NULL) as complex_with_image_url,
        COUNT(*) as total
      FROM pixels_in_tile
    `;

    const filterResult = await knex.raw(complexFilterQuery, [
      z, x, y,
      samplingRate,
      Math.floor(samplingRate * 100),
      maxFeatures
    ]);

    const stats = filterResult.rows[0];
    console.log('Complex 层过滤统计:');
    console.log(`  瓦片内总像素: ${stats.total}`);
    console.log(`  计算为 complex 类型: ${stats.total_complex}`);
    console.log(`  complex + pattern_id NOT NULL: ${stats.complex_with_pattern}`);
    console.log(`  complex + pattern_id NOT NULL + geom_quantized NOT NULL: ${stats.complex_passthrough}`);
    console.log(`  complex + image_url NOT NULL: ${stats.complex_with_image_url}`);
    console.log();

    // 3. 显示几个 complex 像素的详情
    if (stats.total_complex > 0) {
      console.log('[3] Complex 像素详情（前 5 个）:\n');

      const detailQuery = `
        WITH tile_bounds AS (
          SELECT ST_Transform(ST_TileEnvelope(?, ?, ?), 4326) AS geom
        ),
        pixels_in_tile AS (
          SELECT
            p.id,
            p.grid_id,
            p.pattern_id,
            p.color,
            p.alliance_id,
            CASE
              WHEN p.pixel_type = 'alliance' THEN
                CASE
                  WHEN a.flag_unicode_char IS NOT NULL AND a.flag_unicode_char != '' THEN 'emoji'
                  WHEN a.flag_render_type = 'complex' THEN 'complex'
                  ELSE 'color'
                END
              WHEN (p.pixel_type = 'basic' OR p.pixel_type = 'complex' OR p.pixel_type IS NULL) THEN
                CASE
                  WHEN p.color = 'custom_pattern' AND p.alliance_id IS NULL THEN 'complex'
                  WHEN pa.render_type = 'emoji' THEN 'emoji'
                  WHEN pa.render_type = 'complex' THEN 'complex'
                  WHEN pa.render_type = 'color' THEN 'color'
                  WHEN pa.render_type = 'default' THEN 'color'
                  ELSE 'color'
                END
              WHEN p.pattern_id IS NULL OR p.pattern_id = '' THEN 'color'
              ELSE 'color'
            END AS pixel_type,
            p.geom_quantized IS NOT NULL AS has_geom,
            CASE
              WHEN p.color = 'custom_pattern' AND p.alliance_id IS NULL THEN u.avatar_url
              WHEN pa.render_type = 'complex' THEN
                CASE
                  WHEN pa.file_url IS NOT NULL THEN pa.file_url
                  WHEN pa.file_path IS NOT NULL THEN pa.file_path
                  ELSE NULL
                END
              ELSE NULL
            END AS image_url
          FROM pixels p
          LEFT JOIN pattern_assets pa ON p.pattern_id = pa.key AND pa.deleted_at IS NULL
          LEFT JOIN users u ON p.user_id = u.id
          LEFT JOIN alliances a ON p.alliance_id = a.id
          WHERE
            ST_Intersects(
              p.geom_quantized,
              (SELECT geom FROM tile_bounds)
            )
            AND p.lng_quantized IS NOT NULL
            AND p.lat_quantized IS NOT NULL
            AND p.lng_quantized >= -180.0 AND p.lng_quantized <= 180.0
            AND p.lat_quantized >= -90.0 AND p.lat_quantized <= 90.0
            AND ST_IsValid(p.geom_quantized)
            AND (
              ? >= 1.0 OR
              (hashtext(p.grid_id::text)::bigint % 100) < ?
            )
          LIMIT ?
        )
        SELECT *
        FROM pixels_in_tile
        WHERE pixel_type = 'complex'
        LIMIT 5
      `;

      const detailResult = await knex.raw(detailQuery, [
        z, x, y,
        samplingRate,
        Math.floor(samplingRate * 100),
        maxFeatures
      ]);

      detailResult.rows.forEach((row, i) => {
        console.log(`  [${i + 1}]`);
        console.log(`    grid_id: ${row.grid_id}`);
        console.log(`    pattern_id: ${row.pattern_id}`);
        console.log(`    color: ${row.color}`);
        console.log(`    alliance_id: ${row.alliance_id}`);
        console.log(`    has_geom: ${row.has_geom}`);
        console.log(`    image_url: ${row.image_url}`);
        console.log(`    满足WHERE条件: ${row.pattern_id !== null && row.has_geom ? '✅' : '❌'}`);
        console.log();
      });
    }

    console.log('='.repeat(80));
    console.log('结论:');
    if (stats.complex_passthrough > 0) {
      console.log(`✅ 有 ${stats.complex_passthrough} 个 complex 像素应该出现在 MVT 瓦片中`);
      console.log('   问题可能在 ST_AsMVTGeom 或 ST_AsMVT 函数');
    } else if (stats.total_complex > 0 && stats.complex_passthrough === 0) {
      console.log(`❌ ${stats.total_complex} 个 complex 像素被 WHERE 过滤掉了`);
      if (stats.complex_with_pattern < stats.total_complex) {
        console.log(`   - ${stats.total_complex - stats.complex_with_pattern} 个缺少 pattern_id`);
      }
      if (stats.complex_passthrough < stats.complex_with_pattern) {
        console.log(`   - ${stats.complex_with_pattern - stats.complex_passthrough} 个缺少 geom_quantized`);
      }
    } else {
      console.log('❌ 瓦片内没有任何 complex 像素');
    }
    console.log('='.repeat(80));

  } catch (error) {
    console.error('❌ 错误:', error.message);
    console.error(error.stack);
  } finally {
    await knex.destroy();
  }
}

testMVTQuery();
