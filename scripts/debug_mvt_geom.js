const { db } = require('./backend/src/config/database');

async function debugMVTGeom() {
  try {
    const z = 14, x = 13348, y = 7109;

    console.log(`🔍 Debugging ST_AsMVTGeom for tile ${z}/${x}/${y}:`);

    // Get sample pixels and test ST_AsMVTGeom transformation
    const pixels = await db.raw(`
      SELECT
        p.id,
        p.grid_id,
        p.lng_quantized,
        p.lat_quantized,
        p.geom_quantized,
        ST_AsText(p.geom_quantized) as geom_wkt,
        pa.render_type,
        pa.unicode_char,
        ST_AsMVTGeom(
          p.geom_quantized,
          ST_Transform(ST_TileEnvelope(?, ?, ?), 4326),
          4096,
          64,
          true
        ) AS mvt_geom,
        ST_AsText(ST_AsMVTGeom(
          p.geom_quantized,
          ST_Transform(ST_TileEnvelope(?, ?, ?), 4326),
          4096,
          64,
          true
        )) AS mvt_geom_wkt
      FROM pixels p
      LEFT JOIN pattern_assets pa ON p.pattern_id = pa.key AND pa.deleted_at IS NULL
      WHERE
        ST_Intersects(
          p.geom_quantized,
          ST_Transform(ST_TileEnvelope(?, ?, ?), 4326)
        )
        AND p.lng_quantized IS NOT NULL
        AND p.lat_quantized IS NOT NULL
        AND p.geom_quantized IS NOT NULL
        AND ST_IsValid(p.geom_quantized)
      LIMIT 5
    `, [z, x, y, z, x, y, z, x, y]);

    console.log(`\n📍 Testing ST_AsMVTGeom transformation:`);
    pixels.rows.forEach((row, index) => {
      console.log(`\n${index + 1}. Pixel ID: ${row.id}`);
      console.log(`   Original coords: [${row.lng_quantized}, ${row.lat_quantized}]`);
      console.log(`   Original geometry: ${row.geom_wkt}`);
      console.log(`   Render type: ${row.render_type}`);
      console.log(`   Unicode char: ${row.unicode_char}`);
      console.log(`   MVT geometry: ${row.mvt_geom_wkt}`);
      console.log(`   MVT geometry is null: ${row.mvt_geom === null}`);
    });

    // Test tile bounds
    console.log(`\n🗺️ Tile bounds info:`);
    const tileBounds = await db.raw(`
      SELECT
        ST_TileEnvelope(?, ?, ?) as tile_geom,
        ST_AsText(ST_TileEnvelope(?, ?, ?)) as tile_wkt,
        ST_Transform(ST_TileEnvelope(?, ?, ?), 4326) as tile_geom_4326,
        ST_AsText(ST_Transform(ST_TileEnvelope(?, ?, ?), 4326)) as tile_wkt_4326
    `, [z, x, y, z, x, y, z, x, y, z, x, y]);

    console.log(`Tile bounds (3857): ${tileBounds.rows[0].tile_wkt}`);
    console.log(`Tile bounds (4326): ${tileBounds.rows[0].tile_wkt_4326}`);

    // Test SRID of geometries
    console.log(`\n🔍 Geometry SRID info:`);
    const sridInfo = await db.raw(`
      SELECT
        ST_SRID(geom_quantized) as pixel_srid,
        ST_SRID(ST_TileEnvelope(?, ?, ?)) as tile_srid,
        ST_SRID(ST_Transform(ST_TileEnvelope(?, ?, ?), 4326)) as tile_srid_4326
      FROM pixels
      WHERE geom_quantized IS NOT NULL
      LIMIT 1
    `, [z, x, y, z, x, y]);

    console.log(`Pixel geometry SRID: ${sridInfo.rows[0].pixel_srid}`);
    console.log(`Tile geometry SRID (3857): ${sridInfo.rows[0].tile_srid}`);
    console.log(`Tile geometry SRID (4326): ${sridInfo.rows[0].tile_srid_4326}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

debugMVTGeom();