/**
 * 检查地理编码回填进度
 */

const { db } = require('../src/config/database');
const logger = require('../src/utils/logger');

async function checkProgress() {
  try {
    // 统计总体情况
    const stats = await db('pixels')
      .select(
        db.raw('COUNT(*) as total'),
        db.raw('COUNT(CASE WHEN geocoded = true THEN 1 END) as encoded'),
        db.raw('COUNT(CASE WHEN geocoded IS NULL OR geocoded = false THEN 1 END) as unencoded')
      )
      .first();

    const encodedRate = ((stats.encoded / stats.total) * 100).toFixed(2);

    console.log('\n📊 地理编码进度:');
    console.log(`  总像素数: ${stats.total}`);
    console.log(`  已编码: ${stats.encoded} (${encodedRate}%)`);
    console.log(`  未编码: ${stats.unencoded} (${(100 - encodedRate).toFixed(2)}%)`);

    // 最近编码的像素
    const recentEncoded = await db('pixels')
      .where('geocoded', true)
      .orderBy('geocoded_at', 'desc')
      .limit(5)
      .select('id', 'city', 'province', 'district', 'geocoded_at');

    if (recentEncoded.length > 0) {
      console.log('\n📍 最近编码的5个像素:');
      recentEncoded.forEach(p => {
        const time = new Date(p.geocoded_at).toLocaleString('zh-CN');
        console.log(`  ID:${p.id} | ${p.province} ${p.city} ${p.district || ''} | ${time}`);
      });
    }

    // 检查最新的像素是否已编码
    const latestPixels = await db('pixels')
      .orderBy('created_at', 'desc')
      .limit(3)
      .select('id', 'city', 'geocoded', 'created_at');

    console.log('\n🆕 最新的3个像素:');
    latestPixels.forEach(p => {
      const status = p.geocoded ? '✅' : '❌';
      console.log(`  ${status} ID:${p.id} | City:${p.city || 'NULL'} | Geocoded:${p.geocoded}`);
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ 检查失败:', error);
    process.exit(1);
  }
}

checkProgress();
