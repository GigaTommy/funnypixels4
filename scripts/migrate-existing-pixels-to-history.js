#!/usr/bin/env node
'use strict';

/**
 * 将现有pixels表数据迁移到pixels_history表
 * 为所有现有像素创建历史记录
 */

// 设置环境变量
process.env.NODE_ENV = 'development';
process.env.LOCAL_VALIDATION = 'true';

const { db } = require('../backend/src/config/database');

async function migrateExistingPixelsToHistory() {
  try {
    console.log('🚀 开始将现有pixels数据迁移到pixels_history...\n');
    
    // 获取pixels表总记录数
    const totalCount = await db('pixels').count('* as count').first();
    console.log(`📊 需要迁移的记录数: ${totalCount.count}`);
    
    if (totalCount.count === '0') {
      console.log('✅ 没有需要迁移的数据');
      return;
    }
    
    // 分批处理，每批1000条
    const batchSize = 1000;
    let offset = 0;
    let migratedCount = 0;
    
    while (offset < parseInt(totalCount.count)) {
      console.log(`\n📦 处理第 ${Math.floor(offset / batchSize) + 1} 批 (${offset + 1}-${Math.min(offset + batchSize, parseInt(totalCount.count))})...`);
      
      // 获取当前批次的pixels数据
      const pixels = await db('pixels')
        .select('*')
        .limit(batchSize)
        .offset(offset);
      
      if (pixels.length === 0) {
        break;
      }
      
      // 准备历史记录数据
      const historyData = pixels.map(pixel => ({
        latitude: pixel.latitude,
        longitude: pixel.longitude,
        color: pixel.color,
        user_id: pixel.user_id,
        grid_id: pixel.grid_id,
        pattern_id: pixel.pattern_id,
        pattern_anchor_x: pixel.pattern_anchor_x || 0,
        pattern_anchor_y: pixel.pattern_anchor_y || 0,
        pattern_rotation: pixel.pattern_rotation || 0,
        pattern_mirror: pixel.pattern_mirror || false,
        pixel_type: pixel.pixel_type || 'basic',
        related_id: pixel.related_id || null,
        history_date: pixel.created_at ? new Date(pixel.created_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        action_type: 'migrated', // 标记为迁移数据
        original_pixel_id: pixel.id,
        version: 1,
        created_at: pixel.created_at || new Date()
      }));
      
      // 批量插入历史记录
      try {
        await db('pixels_history').insert(historyData);
        migratedCount += pixels.length;
        console.log(`✅ 成功迁移 ${pixels.length} 条记录`);
      } catch (error) {
        console.error(`❌ 迁移失败: ${error.message}`);
        // 继续处理下一批
      }
      
      offset += batchSize;
      
      // 添加延迟，避免数据库压力过大
      if (offset < parseInt(totalCount.count)) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    console.log(`\n🎉 迁移完成！总共迁移了 ${migratedCount} 条记录`);
    
    // 验证迁移结果
    const newHistoryCount = await db('pixels_history').count('* as count').first();
    console.log(`📊 迁移后pixels_history表记录数: ${newHistoryCount.count}`);
    
  } catch (error) {
    console.error('❌ 迁移过程中发生错误:', error.message);
  } finally {
    await db.destroy();
  }
}

// 运行迁移
migrateExistingPixelsToHistory();
