#!/usr/bin/env node

/**
 * 为已完成的绘画会话补充创建 Feed Items
 * 用于修复历史数据
 */

const knex = require('knex')(require('../knexfile').development);
const logger = require('../src/utils/logger');

async function backfillFeedItems() {
  console.log('=== 开始补充 Feed Items ===\n');

  try {
    // 1. 获取所有已完成的、有像素的、但没有 feed_item 的会话
    const sessions = await knex('drawing_sessions')
      .leftJoin('feed_items', 'drawing_sessions.id', 'feed_items.drawing_session_id')
      .whereNull('feed_items.id')  // 没有对应的 feed_item
      .where('drawing_sessions.status', 'completed')
      .whereRaw("(metadata->'statistics'->>'pixelCount')::int > 0")  // 有像素数据
      .select(
        'drawing_sessions.id',
        'drawing_sessions.user_id',
        'drawing_sessions.metadata',
        'drawing_sessions.start_lat',
        'drawing_sessions.start_lng',
        'drawing_sessions.start_city',
        'drawing_sessions.created_at'
      )
      .orderBy('drawing_sessions.created_at', 'desc');

    console.log(`📊 找到 ${sessions.length} 个需要补充 Feed Item 的会话\n`);

    if (sessions.length === 0) {
      console.log('✅ 没有需要补充的会话');
      return;
    }

    let successCount = 0;
    let failCount = 0;

    for (const session of sessions) {
      try {
        const pixelCount = session.metadata?.statistics?.pixelCount || 0;
        const durationSeconds = session.metadata?.statistics?.durationSeconds || 0;
        const city = session.start_city;

        const content = {
          pixel_count: pixelCount,
          city,
          duration_seconds: durationSeconds
        };

        const insertData = {
          user_id: session.user_id,
          type: 'drawing_complete',
          content: JSON.stringify(content),
          drawing_session_id: session.id,
          created_at: session.created_at  // 保持原始创建时间
        };

        // 添加地理位置（用于 nearby 筛选）
        if (session.start_lat && session.start_lng) {
          insertData.location = knex.raw(
            'ST_SetSRID(ST_MakePoint(?, ?), 4326)::geography',
            [session.start_lng, session.start_lat]
          );
        }

        await knex('feed_items').insert(insertData);

        console.log(`✅ Session ${session.id.substring(0, 8)}: ${pixelCount} pixels, ${city || 'Unknown'}`);
        successCount++;

      } catch (error) {
        console.error(`❌ Session ${session.id}: ${error.message}`);
        failCount++;
      }
    }

    console.log(`\n=== 补充完成 ===`);
    console.log(`✅ 成功: ${successCount}`);
    console.log(`❌ 失败: ${failCount}`);

  } catch (error) {
    console.error('❌ 补充失败:', error);
  } finally {
    await knex.destroy();
  }
}

backfillFeedItems();
