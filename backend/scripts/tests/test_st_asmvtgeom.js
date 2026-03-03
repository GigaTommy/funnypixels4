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

const z = 17;
const x = 106785;
const y = 56873;

console.log('='.repeat(80));
console.log('测试 ST_AsMVTGeom 几何转换');
console.log('='.repeat(80));
console.log(`瓦片: ${z}/${x}/${y}\n`);

async function testGeomConversion() {
  try {
    const query = `
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
                WHEN a.flag_render_type = 'complex' THEN 'complex'
                ELSE 'other'
              END
            WHEN (p.pixel_type = 'basic' OR p.pixel_type = 'complex' OR p.pixel_type IS NULL) THEN
              CASE
                WHEN p.color = 'custom_pattern' AND p.alliance_id IS NULL THEN 'complex'
                WHEN pa.render_type = 'complex' THEN 'complex'
                ELSE 'other'
              END
            ELSE 'other'
          END AS pixel_type,
          p.geom_quantized,
          CASE
            WHEN p.color = 'custom_pattern' AND p.alliance_id IS NULL THEN u.avatar_url
            WHEN pa.render_type = 'complex' THEN pa.file_url
            ELSE NULL
          END AS image_url
        FROM pixels p
        LEFT JOIN pattern_assets pa ON p.pattern_id = pa.key AND pa.deleted_at IS NULL
        LEFT JOIN users u ON p.user_id = u.id
        LEFT JOIN alliances a ON p.alliance_id = a.id
        WHERE
          ST_Intersects(p.geom_quantized, (SELECT geom FROM tile_bounds))
          AND p.lng_quantized IS NOT NULL
          AND p.lat_quantized IS NOT NULL
          AND p.lng_quantized >= -180.0 AND p.lng_quantized <= 180.0
          AND p.lat_quantized >= -90.0 AND p.lat_quantized <= 90.0
          AND ST_IsValid(p.geom_quantized)
        LIMIT 100000
      )
      SELECT
        grid_id,
        pattern_id,
        color,
        alliance_id,
        pixel_type,
        image_url,
        geom_quantized IS NOT NULL AS has_geom,
        ST_AsMVTGeom(
          geom_quantized,
          (SELECT geom FROM tile_bounds),
          4096,
          8,
          true
        ) IS NOT NULL AS mvt_geom_success
      FROM pixels_in_tile
      WHERE pixel_type = 'complex'
        AND pattern_id IS NOT NULL
        AND geom_quantized IS NOT NULL
      ORDER BY grid_id
      LIMIT 10
    `;

    const result = await knex.raw(query, [z, x, y]);

    console.log(`找到 ${result.rows.length} 个 complex 像素\n`);

    let successCount = 0;
    let failCount = 0;

    result.rows.forEach((row, i) => {
      console.log(`[${i + 1}] ${row.grid_id}`);
      console.log(`    pattern_id: ${row.pattern_id}`);
      console.log(`    color: ${row.color}`);
      console.log(`    alliance_id: ${row.alliance_id}`);
      console.log(`    image_url: ${row.image_url || 'NULL'}`);
      console.log(`    has_geom: ${row.has_geom}`);
      console.log(`    ST_AsMVTGeom: ${row.mvt_geom_success ? '✅ 成功' : '❌ 失败 (返回NULL)'}`);
      console.log();

      if (row.mvt_geom_success) {
        successCount++;
      } else {
        failCount++;
      }
    });

    console.log('='.repeat(80));
    console.log('统计:');
    console.log(`  ST_AsMVTGeom 成功: ${successCount}`);
    console.log(`  ST_AsMVTGeom 失败: ${failCount}`);

    if (failCount > 0) {
      console.log('\n❌ 部分像素的几何转换失败！');
      console.log('   这些像素不会出现在 MVT 瓦片中');
    } else {
      console.log('\n✅ 所有像素的几何转换成功');
      console.log('   问题可能在 ST_AsMVT 或 MVT 编码过程');
    }
    console.log('='.repeat(80));

  } catch (error) {
    console.error('❌ 错误:', error.message);
    console.error(error.stack);
  } finally {
    await knex.destroy();
  }
}

testGeomConversion();
