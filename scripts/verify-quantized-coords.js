/**
 * Verify quantized coordinates in pixels table
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });
const knex = require('knex');

const db = knex({
  client: 'pg',
  connection: {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'funny_pixels'
  }
});

async function verifyQuantizedCoords() {
  console.log('🔍 检查量化坐标字段...\n');

  try {
    // 1. Check if columns exist
    const columnsQuery = await db.raw(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'pixels'
      AND column_name IN ('lat_quantized', 'lng_quantized', 'geom_quantized')
      ORDER BY column_name
    `);

    console.log('📊 字段信息：');
    console.table(columnsQuery.rows);

    // 2. Check for null values
    const nullCountQuery = await db.raw(`
      SELECT
        COUNT(*) AS total_pixels,
        COUNT(lat_quantized) AS lat_quantized_count,
        COUNT(lng_quantized) AS lng_quantized_count,
        COUNT(geom_quantized) AS geom_quantized_count,
        COUNT(*) - COUNT(lat_quantized) AS lat_quantized_nulls,
        COUNT(*) - COUNT(lng_quantized) AS lng_quantized_nulls,
        COUNT(*) - COUNT(geom_quantized) AS geom_quantized_nulls
      FROM pixels
    `);

    console.log('\n📈 Null值统计：');
    console.table(nullCountQuery.rows);

    // 3. Sample some data
    const sampleQuery = await db.raw(`
      SELECT
        id,
        latitude,
        longitude,
        lat_quantized,
        lng_quantized,
        ST_AsText(geom_quantized) as geom_text,
        color,
        pattern_id
      FROM pixels
      LIMIT 10
    `);

    console.log('\n📝 数据样本：');
    console.table(sampleQuery.rows);

    // 4. If there are nulls, fix them
    const nullCount = nullCountQuery.rows[0].lat_quantized_nulls;
    if (nullCount > 0) {
      console.log(`\n⚠️ 发现 ${nullCount} 条记录缺少量化坐标，正在修复...`);

      await db.raw(`
        UPDATE pixels
        SET
          lng_quantized = ROUND(longitude::numeric / 0.0001) * 0.0001,
          lat_quantized = ROUND(latitude::numeric / 0.0001) * 0.0001,
          geom_quantized = ST_SetSRID(ST_MakePoint(
            ROUND(longitude::numeric / 0.0001) * 0.0001,
            ROUND(latitude::numeric / 0.0001) * 0.0001
          ), 4326)
        WHERE lat_quantized IS NULL OR lng_quantized IS NULL OR geom_quantized IS NULL
      `);

      console.log('✅ 量化坐标已修复！');

      // Re-check
      const recheck = await db.raw(`
        SELECT
          COUNT(*) AS total_pixels,
          COUNT(*) - COUNT(lat_quantized) AS remaining_nulls
        FROM pixels
      `);

      console.log('\n🔍 修复后检查：');
      console.table(recheck.rows);
    } else {
      console.log('\n✅ 所有像素都有量化坐标！');
    }

  } catch (error) {
    console.error('❌ 错误:', error);
  } finally {
    await db.destroy();
  }
}

verifyQuantizedCoords();
