const { db } = require('../src/config/database');

async function analyzePixelSessions() {
  try {
    console.log('🔍 分析pixels_history数据用于会话识别...');

    // 1. 检查地理位置字段使用情况
    const geoCheck = await db('pixels_history')
      .select(
        db.raw('COUNT(*) as total'),
        db.raw('COUNT(latitude) as has_lat'),
        db.raw('COUNT(longitude) as has_lng'),
        db.raw('COUNT(country) as has_country'),
        db.raw('COUNT(city) as has_city')
      )
      .first();

    console.log('📍 地理位置字段统计:');
    console.log(`  - 总记录: ${geoCheck.total}`);
    console.log(`  - 有纬度: ${geoCheck.has_lat}`);
    console.log(`  - 有经度: ${geoCheck.has_lng}`);
    console.log(`  - 有国家: ${geoCheck.has_country}`);
    console.log(`  - 有城市: ${geoCheck.has_city}`);

    // 2. 检查action_type分布
    console.log('\n🎯 action_type分布:');
    const actionTypes = await db('pixels_history')
      .select('action_type')
      .count('* as count')
      .whereNotNull('action_type')
      .groupBy('action_type')
      .orderBy('count', 'desc');

    actionTypes.forEach(row => {
      console.log(`  - ${row.action_type}: ${row.count}次`);
    });

    // 3. 检查用户bbb的绘制记录
    console.log('\n👤 用户bbb绘制记录分析:');
    const userRecords = await db('pixels_history')
      .where('user_id', '8102e0fb-920e-417e-ae40-171c7c2dbc15')
      .select('*')
      .orderBy('created_at', 'desc')
      .limit(10);

    console.log(`  - 总绘制记录: ${userRecords.length}`);

    userRecords.forEach((record, i) => {
      console.log(`  ${i + 1}. ${record.created_at} - ${record.grid_id} - ${record.action_type || 'draw'}`);
      if (record.pattern_id) {
        console.log(`     Pattern: ${record.pattern_id}`);
      }
      if (record.city) {
        console.log(`     位置: ${record.city}, ${record.country || ''}`);
      }
    });

    // 4. 分析会话时间间隔（用于确定会话分割的阈值）
    console.log('\n⏰ 绘制时间间隔分析:');
    const intervalAnalysis = await db.raw(`
      WITH user_gaps AS (
        SELECT
          user_id,
          created_at,
          LAG(created_at) OVER (PARTITION BY user_id ORDER BY created_at) as prev_time,
          EXTRACT(EPOCH FROM (created_at - LAG(created_at) OVER (PARTITION BY user_id ORDER BY created_at))) as gap_seconds
        FROM pixels_history
        WHERE user_id = '8102e0fb-920e-417e-ae40-171c7c2dbc15'
      )
      SELECT
        AVG(gap_seconds) as avg_gap,
        MIN(gap_seconds) as min_gap,
        MAX(gap_seconds) as max_gap,
        COUNT(gap_seconds) as sample_count,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY gap_seconds) as median_gap,
        PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY gap_seconds) as p90_gap
      FROM user_gaps
      WHERE gap_seconds IS NOT NULL
    `);

    const intervals = intervalAnalysis.rows[0];
    console.log(`  - 平均间隔: ${Math.round(intervals.avg_gap || 0)}秒`);
    console.log(`  - 中位数间隔: ${Math.round(intervals.median_gap || 0)}秒`);
    console.log(`  - 90%间隔: ${Math.round(intervals.p90_gap || 0)}秒`);
    console.log(`  - 最大间隔: ${Math.round(intervals.max_gap || 0)}秒`);

    // 5. 模拟会话分组（基于30分钟间隔阈值）
    console.log('\n📊 模拟会话分组 (30分钟阈值):');
    const sessionAnalysis = await db.raw(`
      WITH numbered_records AS (
        SELECT
          id,
          user_id,
          created_at,
          latitude,
          longitude,
          city,
          country,
          grid_id,
          pattern_id,
          action_type,
          -- 计算与前一条记录的时间差（分钟）
          EXTRACT(EPOCH FROM (created_at - LAG(created_at) OVER (PARTITION BY user_id ORDER BY created_at))) / 60 as minutes_from_prev,
          -- 如果间隔超过30分钟，标记为新会话开始
          CASE
            WHEN LAG(created_at) OVER (PARTITION BY user_id ORDER BY created_at) IS NULL THEN 1
            WHEN EXTRACT(EPOCH FROM (created_at - LAG(created_at) OVER (PARTITION BY user_id ORDER BY created_at))) / 60 > 30 THEN 1
            ELSE 0
          END as is_new_session
        FROM pixels_history
        WHERE user_id = '8102e0fb-920e-417e-ae40-171c7c2dbc15'
        ORDER BY created_at DESC
        LIMIT 50
      ),
      session_grouped AS (
        SELECT
          *,
          SUM(is_new_session) OVER (ORDER BY created_at DESC) as session_id
        FROM numbered_records
      )
      SELECT
        session_id,
        COUNT(*) as pixel_count,
        MIN(created_at) as session_start,
        MAX(created_at) as session_end,
        EXTRACT(EPOCH FROM (MAX(created_at) - MIN(created_at))) / 60 as duration_minutes,
        COUNT(DISTINCT city) as cities_visited,
        COUNT(DISTINCT pattern_id) as patterns_used,
        STRING_AGG(DISTINCT grid_id, ', ') as sample_grids
      FROM session_grouped
      GROUP BY session_id
      ORDER BY session_id DESC
    `);

    console.log(`  - 检测到会话数: ${sessionAnalysis.rows.length}`);
    sessionAnalysis.rows.forEach((session, i) => {
      console.log(`  会话${i + 1}:`);
      console.log(`    - 像素数量: ${session.pixel_count}`);
      console.log(`    - 持续时间: ${Math.round(session.duration_minutes || 0)}分钟`);
      console.log(`    - 开始时间: ${session.session_start}`);
      console.log(`    - 结束时间: ${session.session_end}`);
      console.log(`    - 涉及城市: ${session.cities_visited}个`);
      console.log(`    - 使用图案: ${session.patterns_used}种`);
    });

  } catch (error) {
    console.error('❌ 分析失败:', error);
  } finally {
    process.exit(0);
  }
}

analyzePixelSessions();