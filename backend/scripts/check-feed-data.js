#!/usr/bin/env node

/**
 * Feed 数据诊断脚本
 * 检查 feed_items、drawing_sessions、alliance_members 的数据状态
 */

const knex = require('knex')(require('../knexfile').development);

async function checkFeedData() {
  console.log('=== Feed 数据诊断 ===\n');

  try {
    // 1. 检查 feed_items 总数
    const feedItemsCount = await knex('feed_items').count('* as count').first();
    console.log(`📊 Feed Items 总数: ${feedItemsCount.count}`);

    // 2. 检查最近的 feed_items
    const recentFeed = await knex('feed_items')
      .select('id', 'user_id', 'type', 'content', 'drawing_session_id', 'created_at')
      .orderBy('created_at', 'desc')
      .limit(5);
    console.log('\n📝 最近的 5 条 Feed Items:');
    recentFeed.forEach(item => {
      console.log(`  - ${item.id}: type=${item.type}, user=${item.user_id}, session=${item.drawing_session_id}`);
    });

    // 3. 检查洋红色联盟成员
    const magentaAlliance = await knex('alliances')
      .where('color', '#FF1493')  // 洋红色
      .orWhere('name', 'like', '%洋红%')
      .orWhere('color', 'magenta')
      .first();

    if (magentaAlliance) {
      console.log(`\n🏴 洋红色联盟: ${magentaAlliance.name} (ID: ${magentaAlliance.id})`);

      const members = await knex('alliance_members')
        .join('users', 'alliance_members.user_id', 'users.id')
        .where('alliance_id', magentaAlliance.id)
        .select('users.id', 'users.username', 'users.display_name');

      console.log(`   成员数: ${members.length}`);
      members.forEach(m => {
        console.log(`   - ${m.username} (${m.display_name || 'N/A'})`);
      });

      // 4. 检查这些成员的 drawing_sessions
      const memberIds = members.map(m => m.id);
      const sessions = await knex('drawing_sessions')
        .whereIn('user_id', memberIds)
        .where('status', 'completed')
        .select('id', 'user_id', 'metadata', 'status', 'created_at')
        .orderBy('created_at', 'desc')
        .limit(10);

      console.log(`\n✏️  联盟成员的绘画会话 (最近 10 条):`);
      sessions.forEach(s => {
        const pixelCount = s.metadata?.statistics?.pixelCount || 0;
        console.log(`   - Session ${s.id}: user=${s.user_id}, pixels=${pixelCount}, status=${s.status}`);
      });

      // 5. 检查这些成员的 feed_items
      const memberFeedItems = await knex('feed_items')
        .whereIn('user_id', memberIds)
        .select('id', 'user_id', 'type', 'drawing_session_id', 'created_at')
        .orderBy('created_at', 'desc')
        .limit(10);

      console.log(`\n📰 联盟成员的 Feed Items (最近 10 条):`);
      if (memberFeedItems.length === 0) {
        console.log('   ⚠️  没有找到任何 feed items！');
        console.log('   💡 可能原因:');
        console.log('      1. 成员还没有完成任何绘画会话');
        console.log('      2. 会话的 pixel_count = 0 (代码只为 pixel_count > 0 创建 feed)');
        console.log('      3. feed item 创建逻辑出错');
      } else {
        memberFeedItems.forEach(f => {
          console.log(`   - ${f.id}: user=${f.user_id}, type=${f.type}, session=${f.drawing_session_id}`);
        });
      }
    } else {
      console.log('\n⚠️  未找到洋红色联盟！');

      // 列出所有联盟
      const allAlliances = await knex('alliances')
        .select('id', 'name', 'color')
        .orderBy('created_at', 'desc');

      console.log('\n🏴 所有联盟:');
      allAlliances.forEach(a => {
        console.log(`   - ${a.name} (color: ${a.color})`);
      });
    }

    // 6. 检查所有用户的 feed_items 统计
    const userFeedStats = await knex('feed_items')
      .join('users', 'feed_items.user_id', 'users.id')
      .select('users.username', knex.raw('COUNT(*) as feed_count'))
      .groupBy('users.username')
      .orderBy('feed_count', 'desc')
      .limit(10);

    console.log('\n👥 用户 Feed Items 统计 (Top 10):');
    if (userFeedStats.length === 0) {
      console.log('   ⚠️  数据库中没有任何 feed items！');
    } else {
      userFeedStats.forEach(stat => {
        console.log(`   - ${stat.username}: ${stat.feed_count} items`);
      });
    }

  } catch (error) {
    console.error('❌ 检查失败:', error.message);
  } finally {
    await knex.destroy();
  }
}

checkFeedData();
