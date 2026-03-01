const { db } = require('./backend/src/config/database');

async function debugTileCoords() {
  try {
    // Sample pixel coordinates from the previous query
    const testPixels = [
      { lng: 113.2965000, lat: 23.1324000 },  // emoji_fire
      { lng: 113.2963000, lat: 23.1324000 },  // emoji_fire
      { lng: 113.3000000, lat: 23.1330000 },  // emoji_fire
    ];

    for (const pixel of testPixels) {
      console.log(`\n📍 Pixel at [${pixel.lng}, ${pixel.lat}]:`);

      // Calculate tile coordinates for different zoom levels
      for (let z = 12; z <= 15; z++) {
        const n = Math.pow(2, z);
        const x = Math.floor((pixel.lng + 180) / 360 * n);
        const y = Math.floor((1 - Math.log(Math.tan(pixel.lat * Math.PI / 180) + 1 / Math.cos(pixel.lat * Math.PI / 180)) / Math.PI) / 2 * n);

        console.log(`  Zoom ${z}: Tile ${z}/${x}/${y}`);

        // Check if this pixel would be included in the MVT query
        const result = await db.raw(`
          SELECT
            p.id,
            p.pattern_id,
            pa.render_type,
            ST_Intersects(
              p.geom_quantized,
              ST_Transform(ST_TileEnvelope(?, ?, ?), 4326)
            ) AS intersects_tile,
            ST_AsText(ST_Transform(ST_TileEnvelope(?, ?, ?), 4326)) AS tile_bounds
          FROM pixels p
          LEFT JOIN pattern_assets pa ON p.pattern_id = pa.key AND pa.deleted_at IS NULL
          WHERE p.id = (
            SELECT id FROM pixels
            WHERE lng_quantized = ? AND lat_quantized = ?
            LIMIT 1
          )
        `, [z, x, y, z, x, y, pixel.lng, pixel.lat]);

        if (result.rows.length > 0) {
          const row = result.rows[0];
          console.log(`    ✅ Pixel found: pattern=${row.pattern_id}, type=${row.render_type}`);
          console.log(`    📍 Intersects tile: ${row.intersects_tile}`);
          console.log(`    📍 Tile bounds: ${row.tile_bounds}`);
        } else {
          console.log(`    ❌ Pixel not found in query`);
        }
      }
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

debugTileCoords();