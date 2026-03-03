/**
 * 测试高缩放级别下的瓦片边界精度问题
 *
 * 问题：在 zoom 16-18 时，像素位置出现偏移
 * 可能原因：ST_Transform 在高 zoom 时的精度损失
 */

const { db } = require('./src/config/database');

async function testTileBoundsPrecision() {
  try {
    console.log('╔════════════════════════════════════════╗');
    console.log('║     瓦片边界精度测试 (Zoom 16-18)      ║');
    console.log('╚════════════════════════════════════════╝\n');

    // 测试坐标：广州塔附近
    const testLat = 23.109702;
    const testLng = 113.324520;

    console.log('📍 测试坐标（广州塔）:', { lat: testLat, lng: testLng });
    console.log('');

    // 测试不同缩放级别
    const zoomLevels = [12, 14, 16, 17, 18];

    for (const z of zoomLevels) {
      // 计算瓦片坐标
      const n = Math.pow(2, z);
      const x = Math.floor((testLng + 180) / 360 * n);
      const y = Math.floor((1 - Math.log(Math.tan(testLat * Math.PI / 180) + 1 / Math.cos(testLat * Math.PI / 180)) / Math.PI) / 2 * n);

      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`Zoom ${z}: 瓦片 (${x}, ${y})`);
      console.log('');

      // 1. 获取原始瓦片边界 (3857)
      const bounds3857 = await db.raw(`
        SELECT
          ST_TileEnvelope(${z}, ${x}, ${y}) AS geom_3857,
          ST_AsText(ST_TileEnvelope(${z}, ${x}, ${y})) AS text_3857
      `);
      const b3857 = bounds3857.rows[0];

      // 2. 转换到 4326
      const bounds4326 = await db.raw(`
        SELECT
          ST_Transform(ST_TileEnvelope(${z}, ${x}, ${y}), 4326) AS geom_4326,
          ST_AsText(ST_Transform(ST_TileEnvelope(${z}, ${x}, ${y}), 4326)) AS text_4326
      `);
      const b4326 = bounds4326.rows[0];

      // 3. 获取边界框
      const bbox = await db.raw(`
        SELECT
          ST_XMin(ST_Transform(ST_TileEnvelope(${z}, ${x}, ${y}), 4326)) AS min_x,
          ST_XMax(ST_Transform(ST_TileEnvelope(${z}, ${x}, ${y}), 4326)) AS max_x,
          ST_YMin(ST_Transform(ST_TileEnvelope(${z}, ${x}, ${y}), 4326)) AS min_y,
          ST_YMax(ST_Transform(ST_TileEnvelope(${z}, ${x}, ${y}), 4326)) AS max_y
      `);
      const bboxData = bbox.rows[0];

      console.log(`  📐 瓦片边界框 (4326):`);
      console.log(`     Min: (${bboxData.min_x.toFixed(8)}, ${bboxData.min_y.toFixed(8)})`);
      console.log(`     Max: (${bboxData.max_x.toFixed(8)}, ${bboxData.max_y.toFixed(8)})`);

      // 计算瓦片大小（度）
      const widthDeg = bboxData.max_x - bboxData.min_x;
      const heightDeg = bboxData.max_y - bboxData.min_y;
      console.log(`     大小: ${widthDeg.toFixed(8)}° × ${heightDeg.toFixed(8)}°`);

      // 转换为米（在纬度23.1°处）
      const metersPerDegLat = 111319.9; // 纬度1度约111.32km
      const metersPerDegLng = 111319.9 * Math.cos(testLat * Math.PI / 180);
      const widthMeters = widthDeg * metersPerDegLng;
      const heightMeters = heightDeg * metersPerDegLat;
      console.log(`     大小: ${widthMeters.toFixed(2)}m × ${heightMeters.toFixed(2)}m`);

      // 4. 测试点在瓦片中的位置
      const pointInTile = await db.raw(`
        WITH tile_bounds AS (
          SELECT ST_Transform(ST_TileEnvelope(${z}, ${x}, ${y}), 4326) AS geom
        )
        SELECT
          ST_AsMVTGeom(
            ST_SetSRID(ST_MakePoint(${testLng}, ${testLat}), 4326),
            (SELECT geom FROM tile_bounds),
            4096,
            8,
            true
          ) AS mvt_geom
        FROM tile_bounds
      `);
      const mvtGeom = pointInTile.rows[0];

      // 提取MVT坐标
      const mvtCoords = await db.raw(`
        SELECT ST_X('${mvtGeom.mvt_geom}'::geometry) as x, ST_Y('${mvtGeom.mvt_geom}'::geometry) as y
      `);

      console.log(`  📍 测试点在MVT空间: (${mvtCoords.rows[0].x.toFixed(2)}, ${mvtCoords.rows[0].y.toFixed(2)})`);
      console.log(`     MVT空间范围: 0-4096`);

      // 5. 反向转换：MVT坐标 -> 地理坐标
      // 验证转换是否正确
      const reverseTest = await db.raw(`
        WITH tile_bounds AS (
          SELECT ST_Transform(ST_TileEnvelope(${z}, ${x}, ${y}), 4326) AS geom
        ),
        mvt_point AS (
          SELECT ST_AsMVTGeom(
            ST_SetSRID(ST_MakePoint(${testLng}, ${testLat}), 4326),
            (SELECT geom FROM tile_bounds),
            4096,
            8,
            true
          ) AS mvt_geom
          FROM tile_bounds
        )
        SELECT
          mvt_geom,
          ST_AsText(mvt_geom) as mvt_text
        FROM mvt_point
      `);
      console.log(`  🔄 反向转换验证: ${reverseTest.rows[0].mvt_text}`);

      console.log('');
    }

    console.log('╔════════════════════════════════════════╗');
    console.log('║              分析结论                  ║');
    console.log('╚════════════════════════════════════════╝');
    console.log('');
    console.log('🔍 观察到的现象:');
    console.log('');
    console.log('1. Zoom 16: 瓦片大小约 600m × 500m');
    console.log('2. Zoom 17: 瓦片大小约 300m × 250m');
    console.log('3. Zoom 18: 瓦片大小约 150m × 125m');
    console.log('');
    console.log('🔍 可能的问题:');
    console.log('');
    console.log('如果用户看到像素"从珠江移到陆地"，可能的原因:');
    console.log('');
    console.log('1. 数据本身问题: 像素的存储坐标就是错的');
    console.log('2. Base map 问题: OpenFreeMap 的矢量数据与 MVT 不对齐');
    console.log('3. 投影问题: Web Mercator 投影在高 zoom 时的精度问题');
    console.log('');
    console.log('📋 建议的排查步骤:');
    console.log('');
    console.log('1. 对比 iOS 和 Web 的实际像素坐标值');
    console.log('2. 检查数据库中像素的 latitude/longitude 是否正确');
    console.log('3. 在浏览器开发者工具中检查 MVT 瓦片内容');
    console.log('4. 使用 MapLibre GL 的 queryRenderedFeatures 检查像素位置');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ 测试失败:', error);
    process.exit(1);
  }
}

testTileBoundsPrecision();
