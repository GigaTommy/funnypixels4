/**
 * 测试 MVT 瓦片坐标转换
 *
 * 用于调试高缩放级别（16-18）下的坐标偏移问题
 * 对比存储的坐标、MVT 瓦片坐标、以及预期位置
 */

const { db } = require('./src/config/database');

async function testMVTCoordinateTransform() {
  try {
    console.log('╔════════════════════════════════════════╗');
    console.log('║       MVT 瓦片坐标转换测试              ║');
    console.log('╚════════════════════════════════════════╝\n');

    // 测试坐标：广州塔附近（珠江区域）
    // 广州塔: 113.324520, 23.109702
    const testLat = 23.109702;
    const testLng = 113.324520;

    console.log('📍 测试坐标（广州塔）:', { lat: testLat, lng: testLng });
    console.log('');

    // 1. 检查该区域的像素数据
    console.log('1️⃣ 检查数据库中的像素坐标...');
    const pixels = await db('pixels')
      .select('id', 'grid_id', 'latitude', 'longitude', 'lng_quantized', 'lat_quantized', 'color', 'pattern_id')
      .whereBetween('latitude', [testLat - 0.01, testLat + 0.01])
      .whereBetween('longitude', [testLng - 0.01, testLng + 0.01])
      .limit(5);

    console.log(`✅ 找到 ${pixels.length} 个像素`);
    if (pixels.length > 0) {
      for (const p of pixels) {
        console.log(`  📌 像素 ${p.grid_id}:`);
        console.log(`     原始坐标: (${p.latitude}, ${p.longitude})`);
        console.log(`     量化坐标: (${p.lng_quantized}, ${p.lat_quantized})`);

        // 计算偏移量
        const latDiff = Math.abs(p.latitude - p.lat_quantized);
        const lngDiff = Math.abs(p.longitude - p.lng_quantized);
        if (latDiff > 0.000001 || lngDiff > 0.000001) {
          console.log(`     ⚠️ 量化误差: ${latDiff.toFixed(9)}, ${lngDiff.toFixed(9)}`);
        }
      }
    }
    console.log('');

    // 2. 检查 geom_quantized 的实际值
    console.log('2️⃣ 检查 geom_quantized 几何值...');
    const geomResult = await db.raw(`
      SELECT
        id,
        grid_id,
        latitude,
        longitude,
        lng_quantized,
        lat_quantized,
        ST_AsText(geom_quantized) as geom_text,
        ST_X(geom_quantized) as geom_x,
        ST_Y(geom_quantized) as geom_y
      FROM pixels
      WHERE latitude BETWEEN ${testLat} - 0.01 AND ${testLat} + 0.01
        AND longitude BETWEEN ${testLng} - 0.01 AND ${testLng} + 0.01
      LIMIT 5
    `);

    for (const row of geomResult.rows) {
      console.log(`  📐 像素 ${row.grid_id}:`);
      console.log(`     geom_x: ${row.geom_x}, geom_y: ${row.geom_y}`);
      console.log(`     lng_quantized: ${row.lng_quantized}, lat_quantized: ${row.lat_quantized}`);

      // 检查 geom 值与量化值是否一致
      const geomX = parseFloat(row.geom_x);
      const geomY = parseFloat(row.geom_y);
      const lngQ = parseFloat(row.lng_quantized);
      const latQ = parseFloat(row.lat_quantized);

      if (Math.abs(geomX - lngQ) > 0.000001 || Math.abs(geomY - latQ) > 0.000001) {
        console.log(`     ❌ 不匹配! geom 与 quantized 值不同`);
      }
    }
    console.log('');

    // 3. 测试不同缩放级别的瓦片坐标转换
    console.log('3️⃣ 测试 ST_AsMVTGeom 在不同缩放级别的转换...');
    const zoomLevels = [12, 14, 16, 17, 18];

    for (const z of zoomLevels) {
      // 计算瓦片坐标
      const n = Math.pow(2, z);
      const x = Math.floor((testLng + 180) / 360 * n);
      const y = Math.floor((1 - Math.log(Math.tan(testLat * Math.PI / 180) + 1 / Math.cos(testLat * Math.PI / 180)) / Math.PI) / 2 * n);

      console.log(`  Zoom ${z}: 瓦片坐标 (${x}, ${y})`);

      // 测试 ST_AsMVTGeom 转换
      const mvtResult = await db.raw(`
        WITH tile_bounds AS (
          SELECT ST_Transform(ST_TileEnvelope(${z}, ${x}, ${y}), 4326) AS geom
        ),
        mvt_geom AS (
          SELECT
            ST_AsMVTGeom(
              ST_SetSRID(ST_MakePoint(${testLng}, ${testLat}), 4326),
              (SELECT geom FROM tile_bounds),
              4096,
              8,
              true
            ) AS geom
          FROM tile_bounds
        )
        SELECT
          ST_X(mvt_geom.geom) as mvt_x,
          ST_Y(mvt_geom.geom) as mvt_y,
          ST_AsText(mvt_geom.geom) as mvt_text
        FROM mvt_geom
      `);

      const row = mvtResult.rows[0];
      console.log(`     MVT 坐标: (${row.mvt_x.toFixed(2)}, ${row.mvt_y.toFixed(2)})`);
      console.log(`     范围: 0-4096`);
    }
    console.log('');

    // 4. 检查是否存在 GCJ-02 偏移
    console.log('4️⃣ 检查可能的 GCJ-02 偏移...');
    console.log('     GCJ-02 是中国使用的加密坐标系统，会导致约 50-500 米的偏移');
    console.log('');
    console.log('     WGS-84 (GPS):', { lat: testLat, lng: testLng });

    // 简单的 GCJ-02 转换测试（仅用于检测）
    // 如果实际使用的是 GCJ-02，转换为 WGS-84 后会有约 100-200 米偏移
    const gcjOffsetLat = 0.0005; // 约 50 米
    const gcjOffsetLng = 0.0005;

    console.log(`     如果存在 GCJ-02 偏移，坐标可能显示为:`);
    console.log(`     偏移后: (${testLat + gcjOffsetLat}, ${testLng + gcjOffsetLng})`);
    console.log('');

    // 5. 检查 base map source 的坐标系统
    console.log('5️⃣ Base Map 坐标系统检查...');
    console.log('     Web 前端使用: OpenFreeMap (https://tiles.openfreemap.org/styles/liberty)');
    console.log('     iOS 使用: CartoDB (https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json)');
    console.log('');
    console.log('     两者都应该使用 Web Mercator (EPSG:3857) 投影');
    console.log('     但在某些区域可能有细微差异');
    console.log('');

    // 6. 诊断建议
    console.log('╔════════════════════════════════════════╗');
    console.log('║              诊断建议                   ║');
    console.log('╚════════════════════════════════════════╝');
    console.log('');
    console.log('🔍 可能的原因:');
    console.log('');
    console.log('1. Base Map 投影不一致');
    console.log('   - OpenFreeMap 可能在高 zoom 时使用不同的投影精度');
    console.log('   - 建议尝试换成 CartoDB 或 MapTiler');
    console.log('');
    console.log('2. MVT 瓦片缓冲区问题');
    console.log('   - ST_AsMVTGeom 的 buffer 参数在不同 zoom 可能有不同表现');
    console.log('   - 当前设置: buffer=8 (color), buffer=64 (emoji/complex)');
    console.log('');
    console.log('3. Web Mercator 精度问题');
    console.log('   - 高 zoom 时，float32 精度可能不足');
    console.log('   - MapLibre GL 内部使用 float32 表示坐标');
    console.log('');
    console.log('📋 建议的测试步骤:');
    console.log('');
    console.log('1. 在 web 前端将 base map 换成 CartoDB:');
    console.log('   styleUrl = "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"');
    console.log('');
    console.log('2. 对比 iOS 和 web 的实际像素位置');
    console.log('3. 检查浏览器控制台是否有 tile 加载错误');
    console.log('');
    console.log('✅ 测试完成');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ 测试失败:', error);
    process.exit(1);
  }
}

testMVTCoordinateTransform();
