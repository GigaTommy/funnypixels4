const { db } = require('./backend/src/config/database');

async function debugMVTEncoding() {
  try {
    const z = 14, x = 13348, y = 7109;
    const samplingRate = 1.0;

    console.log(`🔨 Debugging MVT encoding for tile ${z}/${x}/${y}:`);

    // Test the emoji layer MVT generation
    console.log(`\n🔥 Testing emoji layer MVT generation:`);
    const emojiMVT = await db.raw(`
      WITH tile_bounds AS (
        SELECT ST_TileEnvelope(?, ?, ?) AS geom
      ),
      pixels_in_tile AS (
        SELECT
          p.id,
          p.grid_id,
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
            ST_Transform((SELECT geom FROM tile_bounds), 4326)
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
      ),
      mvt_emoji AS (
        SELECT ST_AsMVT(tile, 'pixels-emoji', 4096, 'mvt_geom') AS mvt
        FROM (
          SELECT
            id,
            grid_id,
            emoji_char AS emoji,
            ST_AsMVTGeom(
              geom_quantized,
              (SELECT geom FROM tile_bounds),
              4096,
              64,
              true
            ) AS mvt_geom
          FROM pixels_in_tile
          WHERE pixel_type = 'emoji'
            AND geom_quantized IS NOT NULL
            AND emoji_char IS NOT NULL
        ) AS tile
      )
      SELECT mvt FROM mvt_emoji
    `, [z, x, y, samplingRate, Math.floor(samplingRate * 100), 10000]);

    console.log(`Emoji MVT result:`, emojiMVT.rows[0]);

    // Test the complex layer MVT generation
    console.log(`\n🖼️ Testing complex layer MVT generation:`);
    const complexMVT = await db.raw(`
      WITH tile_bounds AS (
        SELECT ST_TileEnvelope(?, ?, ?) AS geom
      ),
      pixels_in_tile AS (
        SELECT
          p.id,
          p.grid_id,
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
            ST_Transform((SELECT geom FROM tile_bounds), 4326)
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
      ),
      mvt_complex AS (
        SELECT ST_AsMVT(tile, 'pixels-complex', 4096, 'mvt_geom') AS mvt
        FROM (
          SELECT
            id,
            grid_id,
            pattern_id,
            image_url,
            ST_AsMVTGeom(
              geom_quantized,
              (SELECT geom FROM tile_bounds),
              4096,
              64,
              true
            ) AS mvt_geom
          FROM pixels_in_tile
          WHERE pixel_type = 'complex'
            AND pattern_id IS NOT NULL
            AND geom_quantized IS NOT NULL
        ) AS tile
      )
      SELECT mvt FROM mvt_complex
    `, [z, x, y, samplingRate, Math.floor(samplingRate * 100), 10000]);

    console.log(`Complex MVT result:`, complexMVT.rows[0]);

    // Test the color layer MVT generation
    console.log(`\n🎨 Testing color layer MVT generation:`);
    const colorMVT = await db.raw(`
      WITH tile_bounds AS (
        SELECT ST_TileEnvelope(?, ?, ?) AS geom
      ),
      pixels_in_tile AS (
        SELECT
          p.id,
          p.grid_id,
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
            ST_Transform((SELECT geom FROM tile_bounds), 4326)
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
      ),
      mvt_color AS (
        SELECT ST_AsMVT(tile, 'pixels-color', 4096, 'mvt_geom') AS mvt
        FROM (
          SELECT
            id,
            grid_id,
            COALESCE(display_color, '#000000') AS color,
            ST_AsMVTGeom(
              geom_quantized,
              (SELECT geom FROM tile_bounds),
              4096,
              8,
              true
            ) AS mvt_geom
          FROM pixels_in_tile
          WHERE pixel_type = 'color'
            AND display_color IS NOT NULL
            AND geom_quantized IS NOT NULL
        ) AS tile
      )
      SELECT mvt FROM mvt_color
    `, [z, x, y, samplingRate, Math.floor(samplingRate * 100), 10000]);

    console.log(`Color MVT result:`, colorMVT.rows[0]);

    // Test the combined MVT
    console.log(`\n🔗 Testing combined MVT generation:`);
    const combinedMVT = await db.raw(`
      WITH tile_bounds AS (
        SELECT ST_TileEnvelope(?, ?, ?) AS geom
      ),
      pixels_in_tile AS (
        SELECT
          p.id,
          p.grid_id,
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
            ST_Transform((SELECT geom FROM tile_bounds), 4326)
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
      ),
      mvt_color AS (
        SELECT ST_AsMVT(tile, 'pixels-color', 4096, 'mvt_geom') AS mvt
        FROM (
          SELECT
            id,
            grid_id,
            COALESCE(display_color, '#000000') AS color,
            ST_AsMVTGeom(
              geom_quantized,
              (SELECT geom FROM tile_bounds),
              4096,
              8,
              true
            ) AS mvt_geom
          FROM pixels_in_tile
          WHERE pixel_type = 'color'
            AND display_color IS NOT NULL
            AND geom_quantized IS NOT NULL
        ) AS tile
      ),
      mvt_emoji AS (
        SELECT ST_AsMVT(tile, 'pixels-emoji', 4096, 'mvt_geom') AS mvt
        FROM (
          SELECT
            id,
            grid_id,
            emoji_char AS emoji,
            ST_AsMVTGeom(
              geom_quantized,
              (SELECT geom FROM tile_bounds),
              4096,
              64,
              true
            ) AS mvt_geom
          FROM pixels_in_tile
          WHERE pixel_type = 'emoji'
            AND geom_quantized IS NOT NULL
            AND emoji_char IS NOT NULL
        ) AS tile
      ),
      mvt_complex AS (
        SELECT ST_AsMVT(tile, 'pixels-complex', 4096, 'mvt_geom') AS mvt
        FROM (
          SELECT
            id,
            grid_id,
            pattern_id,
            image_url,
            ST_AsMVTGeom(
              geom_quantized,
              (SELECT geom FROM tile_bounds),
              4096,
              64,
              true
            ) AS mvt_geom
          FROM pixels_in_tile
          WHERE pixel_type = 'complex'
            AND pattern_id IS NOT NULL
            AND geom_quantized IS NOT NULL
        ) AS tile
      )
      SELECT
        (SELECT mvt FROM mvt_color) ||
        (SELECT mvt FROM mvt_emoji) ||
        (SELECT mvt FROM mvt_complex)
      AS mvt
    `, [z, x, y, samplingRate, Math.floor(samplingRate * 100), 10000]);

    const result = combinedMVT.rows[0];
    console.log(`\n🎯 Combined MVT result:`, result);
    console.log(`MVT buffer length: ${result.mvt ? result.mvt.length : 0} bytes`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

debugMVTEncoding();