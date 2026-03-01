const { db } = require('./backend/src/config/database');

async function debugMVTQuery() {
  try {
    const z = 14, x = 13348, y = 7109;

    console.log(`🔍 Debugging MVT query for tile ${z}/${x}/${y}:`);

    // First, let's check what pixels SHOULD be in this tile
    const pixelsInTile = await db.raw(`
      SELECT
        p.id,
        p.grid_id,
        p.pattern_id,
        p.lng_quantized,
        p.lat_quantized,
        pa.render_type,
        pa.unicode_char,
        pa.color as pattern_color,
        p.color as pixel_color,
        ST_Intersects(
          p.geom_quantized,
          ST_Transform(ST_TileEnvelope(?, ?, ?), 4326)
        ) AS intersects_tile,
        ST_AsText(p.geom_quantized) as geom_wkt
      FROM pixels p
      LEFT JOIN pattern_assets pa ON p.pattern_id = pa.key AND pa.deleted_at IS NULL
      WHERE ST_Intersects(
        p.geom_quantized,
        ST_Transform(ST_TileEnvelope(?, ?, ?), 4326)
      )
      AND p.lng_quantized IS NOT NULL
      AND p.lat_quantized IS NOT NULL
      AND p.lng_quantized >= -180.0 AND p.lng_quantized <= 180.0
      AND p.lat_quantized >= -90.0 AND p.lat_quantized <= 90.0
      AND ST_IsValid(p.geom_quantized)
      ORDER BY p.id
      LIMIT 10
    `, [z, x, y, z, x, y]);

    console.log(`\n📍 Pixels found in tile bounds: ${pixelsInTile.rows.length}`);
    pixelsInTile.rows.forEach(row => {
      console.log(`- ID: ${row.id}, Grid: ${row.grid_id}, Pattern: ${row.pattern_id}, Type: ${row.render_type}`);
      console.log(`  Coords: [${row.lng_quantized}, ${row.lat_quantized}]`);
      console.log(`  Intersects: ${row.intersects_tile}`);
      console.log(`  Geometry: ${row.geom_wkt}`);
    });

    // Now let's test the sampling logic at zoom 14
    const samplingRate = 1.0; // At zoom >= 15, no sampling
    console.log(`\n🎲 Testing sampling logic (rate: ${samplingRate}):`);

    const pixelsAfterSampling = await db.raw(`
      SELECT
        p.id,
        p.grid_id,
        (hashtext(p.grid_id::text)::bigint % 100) as hash_mod_100,
        CASE
          WHEN ? >= 1.0 THEN 'passed'
          WHEN (hashtext(p.grid_id::text)::bigint % 100) < ? THEN 'passed'
          ELSE 'filtered_out'
        END as sampling_result
      FROM pixels p
      WHERE ST_Intersects(
        p.geom_quantized,
        ST_Transform(ST_TileEnvelope(?, ?, ?), 4326)
      )
      AND p.lng_quantized IS NOT NULL
      AND p.lat_quantized IS NOT NULL
      AND p.lng_quantized >= -180.0 AND p.lng_quantized <= 180.0
      AND p.lat_quantized >= -90.0 AND p.lat_quantized <= 90.0
      AND ST_IsValid(p.geom_quantized)
      ORDER BY p.id
      LIMIT 10
    `, [samplingRate, Math.floor(samplingRate * 100), z, x, y]);

    console.log(`\n🎲 Sampling results:`);
    pixelsAfterSampling.rows.forEach(row => {
      console.log(`- ID: ${row.id}, Grid: ${row.grid_id}, Hash%100: ${row.hash_mod_100}, Result: ${row.sampling_result}`);
    });

    // Now let's test the full MVT query step by step
    console.log(`\n🔨 Testing full MVT query generation:`);

    const pixelTypes = await db.raw(`
      SELECT
        CASE
          WHEN pa.render_type = 'emoji' THEN 'emoji'
          WHEN pa.render_type = 'complex' THEN 'complex'
          WHEN pa.render_type = 'color' THEN 'color'
          WHEN pa.render_type = 'default' THEN 'color'
          WHEN p.pattern_id IS NULL OR p.pattern_id = '' THEN 'color'
          ELSE 'color'
        END AS pixel_type,
        CASE
          WHEN pa.render_type = 'color' THEN pa.color
          ELSE p.color
        END AS display_color,
        p.pattern_id,
        p.lng_quantized,
        p.lat_quantized,
        p.geom_quantized,
        p.created_at,
        CASE WHEN pa.render_type = 'emoji' THEN pa.unicode_char ELSE NULL END AS emoji_char,
        CASE
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
      WHERE
        ST_Intersects(
          p.geom_quantized,
          ST_Transform(ST_TileEnvelope(?, ?, ?), 4326)
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
    `, [z, x, y, samplingRate, Math.floor(samplingRate * 100), 10000]);

    console.log(`\n📍 Pixels after full filtering: ${pixelTypes.rows.length}`);
    pixelTypes.rows.forEach(row => {
      console.log(`- Type: ${row.pixel_type}, Color: ${row.display_color}, Pattern: ${row.pattern_id}`);
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

debugMVTQuery();