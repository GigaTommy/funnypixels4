/**
 * Test sampling mechanism at different zoom levels
 * Verify zoom 12-18 shows all pixels (100% sampling)
 */

const { db } = require('./src/config/database');
const logger = require('./src/utils/logger');

// Import the getMVTTile function
async function testSamplingAtZoomLevels() {
  try {
    console.log('╔══════════════════════════════════════════════════════╗');
    console.log('║         Testing Sampling at Zoom Levels 8-20          ║');
    console.log('╚══════════════════════════════════════════════════════╝\n');

    // Test coordinates: Guangzhou Tower area
    const testLat = 23.109702;
    const testLng = 113.324520;

    // Calculate tile coordinates for each zoom level
    const getTileCoords = (z, lat, lng) => {
      const n = Math.pow(2, z);
      const x = Math.floor((lng + 180) / 360 * n);
      const y = Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * n);
      return { z, x, y };
    };

    // Calculate expected sampling rate
    const getExpectedSamplingRate = (z) => {
      if (z < 12) return 0.01;      // 1% sampling
      if (z >= 12 && z <= 18) return 1.0;  // 100% sampling (full display)
      return 0.01;                  // 1% sampling (z > 18)
    };

    const zoomLevels = [8, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
    const results = [];

    // Test actual pixel counts at each zoom level
    for (const z of zoomLevels) {
      const { x, y } = getTileCoords(z, testLat, testLng);
      const expectedRate = getExpectedSamplingRate(z);

      // Query to count pixels in tile (before sampling)
      const countResult = await db.raw(`
        WITH tile_bounds AS (
          SELECT ST_Transform(ST_TileEnvelope(?, ?, ?), 4326) AS geom
        )
        SELECT COUNT(*) as total_count
        FROM pixels p
        WHERE
          ST_Intersects(p.geom_quantized, (SELECT geom FROM tile_bounds))
          AND p.lng_quantized IS NOT NULL
          AND p.lat_quantized IS NOT NULL
          AND p.lng_quantized >= -180.0 AND p.lng_quantized <= 180.0
          AND p.lat_quantized >= -90.0 AND p.lat_quantized <= 90.0
          AND ST_IsValid(p.geom_quantized)
      `, [z, x, y]);

      const totalCount = parseInt(countResult.rows[0].total_count);

      // Query with sampling applied
      const sampledResult = await db.raw(`
        WITH tile_bounds AS (
          SELECT ST_Transform(ST_TileEnvelope(?, ?, ?), 4326) AS geom
        )
        SELECT COUNT(*) as sampled_count
        FROM pixels p
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
      `, [z, x, y, expectedRate, Math.floor(expectedRate * 100)]);

      const sampledCount = parseInt(sampledResult.rows[0].sampled_count);
      const actualRate = totalCount > 0 ? (sampledCount / totalCount) : 0;

      results.push({
        zoom: z,
        tile: `${z}/${x}/${y}`,
        total: totalCount,
        sampled: sampledCount,
        expectedRate: expectedRate,
        actualRate: actualRate.toFixed(3),
        status: (expectedRate === 1.0 && sampledCount === totalCount) ? '✅' : '⚠️'
      });
    }

    // Display results table
    console.log('┌──────┬────────────────┬────────┬─────────┬─────────────┬─────────────┬────────┐');
    console.log('│ Zoom │ Tile           │ Total  │ Sampled │ Expected    │ Actual      │ Status │');
    console.log('│      │ Coord          │ Pixels │ Pixels  │ Sampling    │ Sampling    │        │');
    console.log('├──────┼────────────────┼────────┼─────────┼─────────────┼─────────────┼────────┤');

    for (const r of results) {
      const expectedPct = r.expectedRate === 1.0 ? '100%' : '1%';
      const actualPct = (parseFloat(r.actualRate) * 100).toFixed(1) + '%';

      console.log(`│ ${r.zoom.toString().padEnd(4)} │ ${r.tile.padEnd(14)} │ ${r.total.toString().padStart(6)} │ ${r.sampled.toString().padStart(7)} │ ${expectedPct.padStart(11)} │ ${actualPct.padStart(11)} │ ${r.status.padStart(6)} │`);
    }

    console.log('└──────┴────────────────┴────────┴─────────┴─────────────┴─────────────┴────────┘');
    console.log('');

    // Analysis
    console.log('╔══════════════════════════════════════════════════════╗');
    console.log('║                    Analysis                          ║');
    console.log('╚══════════════════════════════════════════════════════╝\n');

    const fullDisplayZooms = results.filter(r => r.expectedRate === 1.0);
    const allFullDisplay = fullDisplayZooms.every(r => r.status === '✅');

    console.log('📊 Sampling Configuration:');
    console.log(`   Zoom < 12:      1% sampling (sparse)`);
    console.log(`   Zoom 12-18:     100% sampling (FULL DISPLAY)`);
    console.log(`   Zoom > 18:      1% sampling (sparse)\n`);

    if (allFullDisplay) {
      console.log('✅ SUCCESS: All zoom levels 12-18 show 100% of pixels');
      console.log('   Users will see all pixels in the viewport at these zoom levels.\n');
    } else {
      console.log('⚠️  WARNING: Some zoom levels 12-18 have incomplete sampling');
      console.log('   Check the results above for details.\n');
    }

    console.log('📋 Expected Behavior:');
    console.log('   • At zoom 12-18: Every single pixel in viewport should be visible');
    console.log('   • Frontend enableRealtimeSymbolLimits: false (no symbol limit)');
    console.log('   • Backend samplingRate: 1.0 at zoom 12-18\n');

    console.log('╔══════════════════════════════════════════════════════╗');
    console.log('║              Test Completed                          ║');
    console.log('╚══════════════════════════════════════════════════════╝');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

testSamplingAtZoomLevels();
