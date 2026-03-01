const knex = require('knex');
const path = require('path');

// 加载环境配置
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const config = {
  client: 'postgresql',
  connection: {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'funnypixels_dev',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
  },
  pool: {
    min: 2,
    max: 10
  },
  migrations: {
    tableName: 'knex_migrations'
  }
};

const db = knex(config);

async function migratePixelsToHistory() {
  try {
    console.log('🚀 开始迁移像素数据到pixels_history表...\n');
    
    // 1. 检查现有数据
    const pixelsCount = await db('pixels').count('* as count').first();
    const historyCount = await db('pixels_history').count('* as count').first();
    
    console.log(`📊 当前数据统计:`);
    console.log(`  pixels表: ${pixelsCount.count} 条记录`);
    console.log(`  pixels_history表: ${historyCount.count} 条记录`);
    
    // 2. 获取需要迁移的像素数据
    console.log('\n📋 获取需要迁移的像素数据...');
    const pixelsToMigrate = await db('pixels')
      .select('*')
      .orderBy('created_at', 'asc');
    
    console.log(`找到 ${pixelsToMigrate.length} 条像素记录需要迁移`);
    
    if (pixelsToMigrate.length === 0) {
      console.log('✅ 没有需要迁移的数据');
      return;
    }
    
    // 3. 批量迁移数据
    const BATCH_SIZE = 1000;
    let migratedCount = 0;
    let errorCount = 0;
    
    console.log(`\n🔄 开始批量迁移，批次大小: ${BATCH_SIZE}`);
    
    for (let i = 0; i < pixelsToMigrate.length; i += BATCH_SIZE) {
      const batch = pixelsToMigrate.slice(i, i + BATCH_SIZE);
      
      try {
        // 准备历史记录数据
        const historyRecords = batch.map(pixel => ({
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
          history_date: pixel.created_at.toISOString().split('T')[0], // 使用创建日期作为历史日期
          region_id: null,
          action_type: 'migration',
          original_pixel_id: pixel.id,
          version: 1,
          created_at: pixel.created_at,
          updated_at: new Date()
        }));
        
        // 批量插入到pixels_history表
        await db('pixels_history').insert(historyRecords);
        
        migratedCount += batch.length;
        console.log(`✅ 已迁移 ${migratedCount}/${pixelsToMigrate.length} 条记录`);
        
      } catch (batchError) {
        console.error(`❌ 批次 ${Math.floor(i/BATCH_SIZE) + 1} 迁移失败:`, batchError.message);
        errorCount += batch.length;
        
        // 尝试逐条插入
        console.log(`🔄 尝试逐条插入批次 ${Math.floor(i/BATCH_SIZE) + 1}...`);
        for (const pixel of batch) {
          try {
            const historyRecord = {
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
              history_date: pixel.created_at.toISOString().split('T')[0],
              region_id: null,
              action_type: 'migration',
              original_pixel_id: pixel.id,
              version: 1,
              created_at: pixel.created_at,
              updated_at: new Date()
            };
            
            await db('pixels_history').insert(historyRecord);
            migratedCount++;
            errorCount--;
          } catch (singleError) {
            console.error(`❌ 单条记录迁移失败 (ID: ${pixel.id}):`, singleError.message);
          }
        }
      }
    }
    
    // 4. 验证迁移结果
    console.log('\n📊 迁移完成统计:');
    console.log(`✅ 成功迁移: ${migratedCount} 条记录`);
    console.log(`❌ 迁移失败: ${errorCount} 条记录`);
    
    const finalHistoryCount = await db('pixels_history').count('* as count').first();
    console.log(`📈 pixels_history表最终记录数: ${finalHistoryCount.count}`);
    
    // 5. 检查数据完整性
    console.log('\n🔍 验证数据完整性...');
    const sampleHistory = await db('pixels_history')
      .where('action_type', 'migration')
      .orderBy('created_at', 'desc')
      .limit(5);
    
    console.log('最近迁移的5条记录:');
    console.table(sampleHistory.map(record => ({
      id: record.id,
      grid_id: record.grid_id,
      user_id: record.user_id.substring(0, 8) + '...',
      history_date: record.history_date,
      created_at: record.created_at
    })));
    
    console.log('\n✅ 像素数据迁移完成！');
    
  } catch (error) {
    console.error('❌ 迁移失败:', error.message);
    console.error('详细错误:', error);
  } finally {
    await db.destroy();
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  migratePixelsToHistory();
}

module.exports = migratePixelsToHistory;
