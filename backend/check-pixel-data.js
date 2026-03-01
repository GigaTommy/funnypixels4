/**
 * 检查数据库中的像素数据
 */

const { db } = require('./src/config/database');

async function checkPixelData() {
  try {
    console.log('📊 检查数据库中的像素数据...\n');

    // 1. 检查总像素数量
    const totalCount = await db('pixels').count('* as count').first();
    console.log(`总像素数量: ${totalCount.count}`);

    if (totalCount.count === '0') {
      console.log('❌ 数据库中没有像素数据！');
      process.exit(0);
    }

    // 2. 按类型统计
    const countByType = await db('pixels')
      .select('pixel_type')
      .count('* as count')
      .groupBy('pixel_type');

    console.log('\n按类型统计:');
    countByType.forEach(row => {
      console.log(`  ${row.pixel_type || '(null)'}: ${row.count}`);
    });

    // 3. 检查有quantized坐标的像素
    const quantizedCount = await db('pixels')
      .whereNotNull('lng_quantized')
      .whereNotNull('lat_quantized')
      .count('* as count')
      .first();
    console.log(`\n有量化坐标的像素: ${quantizedCount.count}`);

    // 4. 获取一些示例像素的位置
    const samplePixels = await db('pixels')
      .select('id', 'lng_quantized', 'lat_quantized', 'pixel_type', 'color', 'pattern_id')
      .whereNotNull('lng_quantized')
      .whereNotNull('lat_quantized')
      .limit(10);

    console.log('\n示例像素位置:');
    samplePixels.forEach(p => {
      // 计算zoom 14的瓦片坐标
      const z = 14;
      const lng = parseFloat(p.lng_quantized);
      const lat = parseFloat(p.lat_quantized);
      const n = Math.pow(2, z);
      const x = Math.floor((lng + 180) / 360 * n);
      const latRad = lat * Math.PI / 180;
      const y = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n);

      console.log(`  ID ${p.id}: (${lng.toFixed(4)}, ${lat.toFixed(4)}) type=${p.pixel_type}, color=${p.color || 'null'}`);
      console.log(`    -> zoom 14 tile: x=${x}, y=${y}`);
    });

    // 5. 检查emoji类型的像素
    const emojiPixels = await db.raw(`
      SELECT
        p.id,
        p.lng_quantized,
        p.lat_quantized,
        p.pixel_type,
        a.flag_unicode_char,
        pa.unicode_char as pattern_emoji
      FROM pixels p
      LEFT JOIN alliance_members am ON p.user_id = am.user_id
      LEFT JOIN alliances a ON am.alliance_id = a.id
      LEFT JOIN pattern_assets pa ON p.pattern_id = pa.key AND pa.deleted_at IS NULL
      WHERE p.lng_quantized IS NOT NULL
        AND p.lat_quantized IS NOT NULL
        AND (
          p.pixel_type = 'emoji'
          OR a.flag_unicode_char IS NOT NULL
          OR pa.render_type = 'emoji'
        )
      LIMIT 10
    `);

    console.log('\nemoji类型像素:');
    if (emojiPixels.rows.length > 0) {
      emojiPixels.rows.forEach(p => {
        const emoji = p.flag_unicode_char || p.pattern_emoji || '(none)';
        console.log(`  ID ${p.id}: emoji="${emoji}", type=${p.pixel_type}`);
      });
    } else {
      console.log('  (没有emoji像素)');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ 错误:', error);
    process.exit(1);
  }
}

checkPixelData();
