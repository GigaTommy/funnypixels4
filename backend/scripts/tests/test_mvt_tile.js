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

const GRID_ID = 'grid_2932939_1131364';

async function testMVTTile() {
  console.log('='.repeat(80));
  console.log('测试 MVT 瓦片生成 - 用户头像像素');
  console.log('='.repeat(80));

  try {
    // 1. 获取像素基本信息
    console.log('\n[1] 获取像素信息...');
    const pixels = await knex('pixels')
      .where('grid_id', GRID_ID)
      .select('*')
      .first();

    if (!pixels) {
      console.log('❌ 像素不存在！');
      process.exit(1);
    }

    console.log('✅ 像素存在');
    console.log('  - latitude:', pixels.latitude);
    console.log('  - longitude:', pixels.longitude);
    console.log('  - color:', pixels.color);
    console.log('  - pattern_id:', pixels.pattern_id);
    console.log('  - alliance_id:', pixels.alliance_id);

    // 2. 计算瓦片坐标
    console.log('\n[2] 计算瓦片坐标...');
    const lat = parseFloat(pixels.latitude);
    const lng = parseFloat(pixels.longitude);
    const zoom = 14;

    // 瓦片坐标计算（Web Mercator）
    const n = Math.pow(2, zoom);
    const x = Math.floor((lng + 180) / 360 * n);
    const y = Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * n);

    console.log(`✅ 瓦片坐标: zoom=${zoom}, x=${x}, y=${y}`);
    console.log(`   URL: /api/tiles/pixels/${zoom}/${x}/${y}.pbf`);

    // 3. 模拟 MVT 查询（简化版）
    console.log('\n[3] 测试像素是否会出现在 MVT 瓦片中...');

    const testQuery = `
      WITH tile_bounds AS (
        SELECT ST_Transform(ST_TileEnvelope(?, ?, ?), 4326) AS geom
      )
      SELECT
        p.id,
        p.grid_id,
        p.color,
        p.pattern_id,
        p.alliance_id,
        p.pixel_type,
        -- 判断像素类型
        CASE
          WHEN p.pixel_type = 'alliance' THEN
            CASE WHEN a.flag_render_type = 'complex' THEN 'complex'
                 WHEN a.flag_render_type = 'emoji' THEN 'emoji'
                 ELSE 'color'
            END
          WHEN (p.pixel_type = 'basic' OR p.pixel_type = 'complex' OR p.pixel_type IS NULL) THEN
            CASE
              -- 用户头像检测
              WHEN p.color = 'custom_pattern' AND p.alliance_id IS NULL THEN 'complex'
              WHEN pa.render_type = 'emoji' THEN 'emoji'
              WHEN pa.render_type = 'complex' THEN 'complex'
              WHEN pa.render_type = 'color' THEN 'color'
              WHEN pa.render_type = 'default' THEN 'color'
              ELSE 'color'
            END
          WHEN p.pattern_id IS NULL OR p.pattern_id = '' THEN 'color'
          ELSE 'color'
        END AS computed_pixel_type,
        -- image_url
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
        ST_Intersects(p.geom_quantized, (SELECT geom FROM tile_bounds)) AS in_tile_bounds
      FROM pixels p
      LEFT JOIN pattern_assets pa ON p.pattern_id = pa.key AND pa.deleted_at IS NULL
      LEFT JOIN users u ON p.user_id = u.id
      LEFT JOIN alliances a ON p.alliance_id = a.id
      WHERE p.grid_id = ?
    `;

    const result = await knex.raw(testQuery, [zoom, x, y, GRID_ID]);
    const row = result.rows[0];

    if (!row) {
      console.log('❌ 查询无结果（这不应该发生）');
      process.exit(1);
    }

    console.log('查询结果:');
    console.log('  - computed_pixel_type:', row.computed_pixel_type);
    console.log('  - image_url:', row.image_url);
    console.log('  - in_tile_bounds:', row.in_tile_bounds);

    if (row.computed_pixel_type !== 'complex') {
      console.log('\n❌ 问题: 像素未被识别为 complex 类型！');
      console.log('   实际类型:', row.computed_pixel_type);
      console.log('   这意味着它不会出现在 pixels-complex MVT 层中');
    }

    if (!row.image_url) {
      console.log('\n❌ 问题: image_url 为空！');
      console.log('   用户头像像素必须有 image_url 才能在地图上显示');
    }

    if (!row.in_tile_bounds) {
      console.log('\n❌ 问题: 像素不在瓦片边界内！');
      console.log('   geom_quantized 可能有问题');
    }

    if (row.computed_pixel_type === 'complex' && row.image_url && row.in_tile_bounds) {
      console.log('\n✅ 像素应该会出现在 MVT 瓦片中！');
    }

    // 4. 测试完整的 MVT 查询
    console.log('\n[4] 测试完整 MVT 查询...');

    const fullMVTQuery = `
      WITH tile_bounds AS (
        SELECT ST_Transform(ST_TileEnvelope(?, ?, ?), 4326) AS geom
      ),
      pixels_in_tile AS (
        SELECT
          p.id,
          p.grid_id,
          p.user_id,
          p.alliance_id,
          u.username,
          u.avatar AS avatar,
          u.avatar_url AS avatar_url,
          u.country,
          u.city,
          a.name AS alliance_name,
          a.flag_pattern_id AS alliance_flag,
          CASE
            WHEN p.pixel_type = 'alliance' THEN
              CASE WHEN a.flag_render_type = 'complex' THEN 'complex'
                   WHEN a.flag_render_type = 'emoji' THEN 'emoji'
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
          AND p.grid_id = ?
      )
      SELECT
        COUNT(*) FILTER (WHERE pixel_type = 'complex') AS complex_count,
        COUNT(*) AS total_count,
        json_agg(json_build_object(
          'grid_id', grid_id,
          'pixel_type', pixel_type,
          'pattern_id', pattern_id,
          'image_url', image_url
        )) AS pixels
      FROM pixels_in_tile;
    `;

    const mvtResult = await knex.raw(fullMVTQuery, [zoom, x, y, GRID_ID]);
    const mvtRow = mvtResult.rows[0];

    console.log('MVT 查询统计:');
    console.log('  - total_count:', mvtRow.total_count);
    console.log('  - complex_count:', mvtRow.complex_count);

    if (mvtRow.total_count > 0 && mvtRow.pixels) {
      console.log('\n像素详情:');
      mvtRow.pixels.forEach((p, i) => {
        if (p) {
          console.log(`  [${i + 1}]`);
          console.log('    - grid_id:', p.grid_id);
          console.log('    - pixel_type:', p.pixel_type);
          console.log('    - pattern_id:', p.pattern_id);
          console.log('    - image_url:', p.image_url);
        }
      });
    }

    if (mvtRow.complex_count === 0) {
      console.log('\n❌ 关键问题: 该像素在 MVT 查询中未被识别为 complex 类型！');
      console.log('   这就是为什么地图上看不到它的原因。');
    } else {
      console.log('\n✅ 像素正确识别为 complex 类型！');
    }

    console.log('\n' + '='.repeat(80));
    console.log('诊断完成');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('❌ 错误:', error.message);
    console.error(error.stack);
  } finally {
    await knex.destroy();
  }
}

testMVTTile();
