#!/usr/bin/env node
/**
 * 测试会话API（绕过Redis缓存）
 */

const { db } = require('../src/config/database');

async function testAPI() {
  try {
    const userId = 'a79a1fbe-0f97-4303-b922-52b35e6948d5';

    console.log('🧪 测试会话查询API (直接查询数据库)...\n');

    // 模拟getUserSessions的查询逻辑（不使用缓存）
    const page = 1;
    const limit = 20;
    const status = 'all';
    const offset = (page - 1) * limit;

    let query = db('drawing_sessions').where({ user_id: userId });

    // 添加状态过滤
    if (status !== 'all') {
      query = query.where({ status });
    }

    // 只返回pixelCount > 0的会话
    query = query.whereRaw(`
      CASE
        WHEN metadata IS NULL THEN FALSE
        WHEN metadata->'statistics' IS NULL THEN FALSE
        WHEN metadata->'statistics'->>'pixelCount' IS NULL THEN FALSE
        WHEN metadata->'statistics'->>'pixelCount' = '' THEN FALSE
        ELSE (metadata->'statistics'->>'pixelCount')::int > 0
      END
    `);

    // 获取会话列表
    const sessions = await query
      .clone()
      .select(
        'id',
        'user_id',
        'status',
        'start_time',
        'end_time',
        'metadata',
        'created_at'
      )
      .orderBy('created_at', 'desc')
      .limit(limit)
      .offset(offset);

    // 获取总数
    const [{ count: totalCount }] = await query.clone().count('* as count');

    console.log('📊 查询结果:');
    console.log(`  总会话数: ${totalCount}`);
    console.log(`  当前页会话数: ${sessions.length}\n`);

    if (sessions.length > 0) {
      console.log('会话详情:');
      sessions.forEach((s, i) => {
        const pixelCount = s.metadata?.statistics?.pixelCount || 0;
        console.log(`\n  ${i+1}. 会话 ${s.id.substring(0, 8)}...`);
        console.log(`     - 状态: ${s.status}`);
        console.log(`     - 像素数: ${pixelCount}`);
        console.log(`     - 开始时间: ${s.start_time || '未设置'}`);
        console.log(`     - 城市: ${s.start_city || '未知'}`);
      });

      console.log('\n✅ 数据正常！iOS app应该能看到这些会话');
      console.log('\n💡 如果iOS还看不到，请：');
      console.log('   1. 在iOS app中下拉刷新"足迹"页面');
      console.log('   2. 或完全退出app重新打开');
      console.log('   3. 或检查iOS的离线缓存');
    } else {
      console.log('⚠️  没有找到符合条件的会话 (pixelCount > 0)');
    }

  } catch (error) {
    console.error('❌ 测试失败:', error);
    console.error(error.stack);
  } finally {
    await db.destroy();
  }
}

testAPI();
