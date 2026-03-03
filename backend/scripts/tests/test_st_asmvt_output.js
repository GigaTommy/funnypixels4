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
const samplingRate = 1.0;
const maxFeatures = 100000;

console.log('='.repeat(80));
console.log('测试 ST_AsMVT 输出');
console.log('='.repeat(80));
console.log(`瓦片: ${z}/${x}/${y}\n`);

async function testSTAsMVT() {
  try {
    // 测试 mvt_complex CTE 的输出
    const query = `
      WITH tile_bounds AS (
        SELECT ST_Transform(ST_TileEnvelope(?, ?, ?), 4326) AS geom
      ),
      pixels_in_tile AS (
        SELECT
          p.id,
          p.grid_id,
          p.user_id,
          COALESCE(u.username, '游客') AS username,
          u.avatar,
          u.avatar_url,
          p.alliance_id,
          a.name AS alliance_name,
          COALESCE(a.flag_unicode_char, a.flag_pattern_id) AS alliance_flag,
          CASE
            WHEN (p.pixel_type = 'basic' OR p.pixel_type = 'complex' OR p.pixel_type IS NULL) THEN
              CASE
                WHEN p.color = 'custom_pattern' AND p.alliance_id IS NULL THEN 'complex'
                WHEN pa.render_type = 'complex' THEN 'complex'
                ELSE 'other'
              END
            ELSE 'other'
          END AS pixel_type,
          COALESCE(p.pattern_id, a.flag_pattern_id) AS pattern_id,
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
          p.geom_quantized,
          ps.hide_nickname,
          ps.hide_alliance,
          ps.hide_alliance_flag
        FROM pixels p
        LEFT JOIN pattern_assets pa ON p.pattern_id = pa.key AND pa.deleted_at IS NULL
        LEFT JOIN users u ON p.user_id = u.id
        LEFT JOIN privacy_settings ps ON p.user_id = ps.user_id
        LEFT JOIN alliances a ON p.alliance_id = a.id
        WHERE
          ST_Intersects(p.geom_quantized, (SELECT geom FROM tile_bounds))
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
      ),
      mvt_complex AS (
        SELECT ST_AsMVT(tile, 'pixels-complex', 4096, 'mvt_geom') AS mvt
        FROM (
          SELECT
            id,
            grid_id,
            user_id,
            CASE WHEN hide_nickname = true THEN '匿名用户' ELSE COALESCE(username, '游客') END AS username,
            CASE WHEN hide_nickname = true THEN NULL ELSE avatar END AS avatar,
            CASE WHEN hide_nickname = true THEN NULL ELSE avatar_url END AS avatar_url,
            alliance_id,
            CASE WHEN hide_alliance = true THEN NULL ELSE alliance_name END AS alliance_name,
            CASE WHEN (hide_alliance = true OR hide_alliance_flag = true) THEN NULL ELSE alliance_flag END AS alliance_flag,
            pattern_id,
            image_url,
            ST_AsMVTGeom(
              geom_quantized,
              (SELECT geom FROM tile_bounds),
              4096,
              8,
              true
            ) AS mvt_geom
          FROM pixels_in_tile
          WHERE pixel_type = 'complex'
            AND pattern_id IS NOT NULL
            AND geom_quantized IS NOT NULL
        ) AS tile
      )
      SELECT
        LENGTH(mvt) as mvt_size,
        mvt IS NULL as is_null,
        (SELECT COUNT(*) FROM pixels_in_tile WHERE pixel_type = 'complex') as total_complex,
        (SELECT COUNT(*) FROM pixels_in_tile WHERE pixel_type = 'complex' AND pattern_id IS NOT NULL AND geom_quantized IS NOT NULL) as filtered_complex
      FROM mvt_complex
    `;

    const result = await knex.raw(query, [
      z, x, y,
      samplingRate,
      Math.floor(samplingRate * 100),
      maxFeatures
    ]);

    const row = result.rows[0];

    console.log('ST_AsMVT 结果:');
    console.log(`  mvt IS NULL: ${row.is_null ? '是' : '否'}`);
    console.log(`  mvt 大小: ${row.mvt_size || 0} bytes`);
    console.log(`  total_complex (pixels_in_tile): ${row.total_complex}`);
    console.log(`  filtered_complex (after WHERE): ${row.filtered_complex}`);
    console.log();

    if (row.is_null) {
      console.log('❌ ST_AsMVT 返回 NULL！');
      console.log('   可能原因:');
      console.log('   1. 所有 complex 像素的 mvt_geom 都是 NULL');
      console.log('   2. WHERE 过滤后没有任何行');
    } else if (row.mvt_size === 0) {
      console.log('⚠️  ST_AsMVT 返回空 bytea');
    } else {
      console.log(`✅ ST_AsMVT 成功生成 ${row.mvt_size} bytes 的 MVT 数据`);
    }

  } catch (error) {
    console.error('❌ 错误:', error.message);
    console.error(error.stack);
  } finally {
    await knex.destroy();
  }
}

testSTAsMVT();
