#!/usr/bin/env node
/**
 * 修复会话metadata - 从实际像素数据计算统计信息
 */

const { db } = require('../src/config/database');

async function fixSessionMetadata() {
  try {
    console.log('🔧 开始修复会话metadata...\n');

    // 查找所有metadata为空或statistics为空的completed会话
    const sessions = await db('drawing_sessions')
      .where('status', 'completed')
      .where(function() {
        this.whereNull('metadata')
          .orWhereRaw("metadata = '{}'::jsonb")
          .orWhereRaw("metadata->'statistics' IS NULL");
      })
      .select('id', 'user_id', 'start_time', 'end_time', 'metadata');

    console.log(`📋 找到 ${sessions.length} 个需要修复的会话\n`);

    if (sessions.length === 0) {
      console.log('✅ 所有会话metadata都是最新的！');
      return;
    }

    let fixed = 0;
    let skipped = 0;

    for (const session of sessions) {
      console.log(`处理会话 ${session.id}...`);

      // 从pixels表计算统计信息
      const pixelStats = await db('pixels')
        .where('session_id', session.id)
        .select(
          db.raw('COUNT(*) as pixel_count'),
          db.raw('MIN(created_at) as first_pixel_time'),
          db.raw('MAX(created_at) as last_pixel_time')
        )
        .first();

      const pixelCount = parseInt(pixelStats.pixel_count) || 0;

      if (pixelCount === 0) {
        console.log(`  ⏭️  跳过: 没有像素数据`);
        skipped++;
        continue;
      }

      // 计算持续时间
      let duration = 0;
      if (session.start_time && session.end_time) {
        duration = Math.floor(
          (new Date(session.end_time) - new Date(session.start_time)) / 1000
        );
      } else if (pixelStats.first_pixel_time && pixelStats.last_pixel_time) {
        duration = Math.floor(
          (new Date(pixelStats.last_pixel_time) - new Date(pixelStats.first_pixel_time)) / 1000
        );
      }

      // 构建metadata
      const metadata = {
        ...(session.metadata || {}),
        statistics: {
          pixelCount,
          duration,
          firstPixelTime: pixelStats.first_pixel_time,
          lastPixelTime: pixelStats.last_pixel_time,
          updatedAt: new Date().toISOString()
        }
      };

      // 更新数据库
      await db('drawing_sessions')
        .where('id', session.id)
        .update({
          metadata: JSON.stringify(metadata)
        });

      console.log(`  ✅ 已修复: pixelCount=${pixelCount}, duration=${duration}s`);
      fixed++;
    }

    console.log(`\n🎉 修复完成！`);
    console.log(`   ✅ 成功修复: ${fixed} 个会话`);
    console.log(`   ⏭️  跳过: ${skipped} 个会话 (无像素数据)`);

  } catch (error) {
    console.error('❌ 修复失败:', error);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await db.destroy();
  }
}

fixSessionMetadata();
