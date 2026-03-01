/**
 * 验证城市排行榜功能
 *
 * 测试内容：
 * 1. OSM数据填充是否完成
 * 2. 城市排行榜查询是否正常
 * 3. 定时任务生成的数据是否正确
 */

const knex = require('knex');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const db = knex({
  client: 'postgresql',
  connection: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME || 'funnypixels_postgres',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password'
  }
});

async function verifyAll() {
  try {
    console.log('🔍 开始验证城市排行榜功能...\n');

    // 1. 检查OSM数据填充情况
    await checkOSMDataFilling();

    // 2. 检查PostGIS函数
    await checkPostGISFunctions();

    // 3. 测试城市匹配
    await testCityMatching();

    // 4. 检查定时任务生成的排行榜数据
    await checkLeaderboardData();

    // 5. 比较两套逻辑的结果
    await compareLeaderboardLogic();

    console.log('\n🎉 所有验证完成！');
    await db.destroy();

  } catch (error) {
    console.error('\n❌ 验证失败:', error.message);
    console.error(error.stack);
    await db.destroy();
    process.exit(1);
  }
}

/**
 * 1. 检查OSM数据填充情况
 */
async function checkOSMDataFilling() {
  console.log('1️⃣  检查OSM数据填充情况\n');

  // 总像素数
  const totalPixels = await db('pixels_history').count('* as count').first();
  console.log(`   📊 总像素数: ${parseInt(totalPixels.count).toLocaleString()}`);

  // 已填充OSM数据的像素数
  const filledPixels = await db('pixels_history')
    .whereNotNull('osm_id')
    .whereNotNull('match_quality')
    .count('* as count')
    .first();
  console.log(`   ✅ 已填充OSM数据: ${parseInt(filledPixels.count).toLocaleString()}`);

  // 填充进度
  const fillRate = (parseInt(filledPixels.count) / parseInt(totalPixels.count) * 100).toFixed(2);
  console.log(`   📈 填充进度: ${fillRate}%`);

  // 匹配质量分布
  const qualityDist = await db('pixels_history')
    .select('match_quality')
    .count('* as count')
    .whereNotNull('match_quality')
    .groupBy('match_quality')
    .orderByRaw(`
      CASE match_quality
        WHEN 'perfect' THEN 1
        WHEN 'excellent' THEN 2
        WHEN 'good' THEN 3
        WHEN 'fair' THEN 4
        WHEN 'poor' THEN 5
        ELSE 6
      END
    `);

  console.log('\n   📊 匹配质量分布:');
  qualityDist.forEach(item => {
    const percentage = (parseInt(item.count) / parseInt(filledPixels.count) * 100).toFixed(2);
    console.log(`      ${item.match_quality.padEnd(10)}: ${item.count.toString().padStart(8)} (${percentage}%)`);
  });

  console.log('');
}

/**
 * 2. 检查PostGIS函数
 */
async function checkPostGISFunctions() {
  console.log('2️⃣  检查PostGIS函数\n');

  const functions = ['match_point_to_admin_contains', 'match_point_to_admin_distance', 'match_point_to_admin_smart'];

  for (const funcName of functions) {
    const result = await db.raw(`
      SELECT EXISTS (
        SELECT FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public' AND p.proname = ?
      ) as exists
    `, [funcName]);

    const status = result.rows[0].exists ? '✅' : '❌';
    console.log(`   ${status} ${funcName}`);
  }

  console.log('');
}

/**
 * 3. 测试城市匹配
 */
async function testCityMatching() {
  console.log('3️⃣  测试城市匹配功能\n');

  // 测试几个知名城市的坐标
  const testCases = [
    { name: '北京天安门', lat: 39.9042, lng: 116.4074 },
    { name: '上海外滩', lat: 31.2397, lng: 121.4912 },
    { name: '广州塔', lat: 23.1088, lng: 113.3241 },
    { name: '深圳市民中心', lat: 22.5455, lng: 114.0550 }
  ];

  for (const testCase of testCases) {
    try {
      const result = await db.raw(`
        SELECT * FROM match_point_to_admin_smart(?, ?, 20000) LIMIT 1
      `, [testCase.lat, testCase.lng]);

      if (result.rows.length > 0) {
        const match = result.rows[0];
        console.log(`   ✅ ${testCase.name}:`);
        console.log(`      城市: ${match.city || match.name}`);
        console.log(`      匹配方式: ${match.matched_method}`);
        console.log(`      匹配质量: ${match.match_quality}`);
        console.log(`      距离: ${Math.round(match.distance_m)}m\n`);
      } else {
        console.log(`   ⚠️  ${testCase.name}: 未匹配到城市\n`);
      }
    } catch (error) {
      console.log(`   ❌ ${testCase.name}: ${error.message}\n`);
    }
  }
}

/**
 * 4. 检查定时任务生成的排行榜数据
 */
async function checkLeaderboardData() {
  console.log('4️⃣  检查定时任务生成的排行榜数据\n');

  const periods = ['daily', 'weekly', 'monthly', 'yearly', 'allTime'];

  for (const period of periods) {
    // 个人榜
    const personalCount = await db('leaderboard_personal')
      .where('period', period)
      .count('* as count')
      .first();

    // 联盟榜
    const allianceCount = await db('leaderboard_alliance')
      .where('period', period)
      .count('* as count')
      .first();

    // 城市榜
    const regionCount = await db('leaderboard_region')
      .where('period', period)
      .count('* as count')
      .first();

    console.log(`   ${period.padEnd(10)}: 个人${personalCount.count}条 | 联盟${allianceCount.count}条 | 城市${regionCount.count}条`);
  }

  console.log('');
}

/**
 * 5. 比较两套逻辑的结果
 */
async function compareLeaderboardLogic() {
  console.log('5️⃣  比较定时任务数据与实时查询数据\n');

  // 查询定时任务生成的城市榜（从leaderboard_region表）
  const cachedData = await db('leaderboard_region')
    .where('period', 'daily')
    .orderBy('rank', 'asc')
    .limit(10);

  console.log('   📋 定时任务生成的Top 10城市（从 leaderboard_region 表）:');
  cachedData.forEach((city, index) => {
    console.log(`      ${(index + 1).toString().padStart(2)}. ${city.region_name.padEnd(20)} - ${city.total_pixels.toLocaleString()}像素`);
  });

  // 查询实时统计数据
  console.log('\n   🔄 实时查询城市排行（直接从 pixels_history 统计）:');

  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const periodEnd = new Date(periodStart);
  periodEnd.setDate(periodEnd.getDate() + 1);

  const liveData = await db.raw(`
    WITH latest_pixels AS (
      SELECT DISTINCT ON (grid_id)
        grid_id,
        user_id,
        city,
        osm_id
      FROM pixels_history
      WHERE created_at >= ? AND created_at < ?
        AND city IS NOT NULL
      ORDER BY grid_id, created_at DESC
    )
    SELECT
      city,
      COUNT(*) as pixel_count
    FROM latest_pixels
    GROUP BY city
    ORDER BY pixel_count DESC
    LIMIT 10
  `, [periodStart, periodEnd]);

  liveData.rows.forEach((city, index) => {
    console.log(`      ${(index + 1).toString().padStart(2)}. ${city.city.padEnd(20)} - ${parseInt(city.pixel_count).toLocaleString()}像素`);
  });

  console.log('');
}

// 运行验证
verifyAll();
