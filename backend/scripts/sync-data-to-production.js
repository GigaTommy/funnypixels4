/**
 * 将开发环境基础数据同步到生产环境
 * 用于将开发环境的基础数据（如pattern_assets、shop_skus等）同步到生产环境
 * 
 * 使用方法:
 * node scripts/sync-data-to-production.js
 * 
 * 前置条件:
 * 1. 先运行 export-development-data.js 导出开发环境数据
 * 2. 确保生产环境数据库表结构已修复
 */

const knex = require('knex')({
  client: 'pg',
  connection: {
    host: 'dpg-d2tfm0ndiees73879o80-a.singapore-postgres.render.com',
    port: 5432,
    user: 'funnypixels',
    password: 'QLpdpDGojmcxRNdMsoTmcuspnaQBls4y',
    database: 'funnypixels_postgres',
    ssl: true
  }
});

const fs = require('fs');

async function syncDataToProduction() {
  try {
    console.log('🔄 开始同步开发环境数据到生产环境...');
    
    // 读取开发环境数据
    let dataPath = '../data-export/development-base-data-latest.json';
    
    // 如果最新文件不存在，尝试使用其他可用的数据文件
    if (!fs.existsSync(dataPath)) {
      dataPath = '../data-export/dev-data-latest.json';
      if (!fs.existsSync(dataPath)) {
        console.error('❌ 开发环境数据文件不存在，请先运行 export-development-data.js');
        return;
      }
    }
    
    console.log(`📂 使用数据文件: ${dataPath}`);
    const developmentData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    
    // 处理不同格式的数据文件
    let dataToSync = developmentData;
    if (developmentData.exportInfo && developmentData.data) {
      dataToSync = developmentData.data;
    }
    
    // 按依赖关系排序的表（先插入被依赖的表）
    const syncOrder = [
      'regions',           // 地区数据
      'achievements',      // 成就系统
      'pattern_assets',    // 图案资源
      'shop_skus',         // 商店SKU
      'store_items',       // 商店物品
      'ad_products',       // 广告产品
      'advertisements'     // 广告数据
    ];
    
    const syncResults = {};
    
    let cachedUserIdSet = null;

    for (const tableName of syncOrder) {
      const data = dataToSync[tableName];
      
      if (!data || data.length === 0) {
        console.log(`\n⏭️ 跳过空表: ${tableName}`);
        syncResults[tableName] = { skipped: true, reason: 'no data' };
        continue;
      }
      
      console.log(`\n📝 同步表: ${tableName} (${data.length} 条记录)`);
      
      try {
        // 检查表是否存在
        const tableExists = await knex.raw(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name = ?
          );
        `, [tableName]);

        if (!tableExists.rows[0].exists) {
          console.log(`⚠️ 表 ${tableName} 不存在，跳过`);
          syncResults[tableName] = { skipped: true, reason: 'table not exists' };
          continue;
        }

        // 清空现有数据（可选，根据需要调整）
        const shouldClear = ['regions', 'achievements', 'pattern_assets', 'shop_skus', 'store_items', 'ad_products'];
        if (shouldClear.includes(tableName)) {
          await knex(tableName).del();
          console.log(`🗑️ 清空表 ${tableName} 的现有数据`);
        }

        if (tableName === 'pattern_assets' && !cachedUserIdSet) {
          const userIds = await knex('users').pluck('id');
          cachedUserIdSet = new Set(
            userIds
              .map(id => Number(id))
              .filter(id => !Number.isNaN(id))
          );
          console.log(`👥 预加载生产环境用户ID列表，共 ${cachedUserIdSet.size} 个`);
        }

        // 批量插入数据
        let insertedCount = 0;
        const batchSize = 50;
        let tableClearedCreatedByCount = 0;

        for (let i = 0; i < data.length; i += batchSize) {
          const batch = data.slice(i, i + batchSize);
          const previousClearedCount = tableClearedCreatedByCount;

          // 处理特殊字段
          const processedBatch = batch.map(record => {
            const processed = { ...record };

            if (tableName === 'pattern_assets' && cachedUserIdSet) {
              if (processed.created_by !== null && processed.created_by !== undefined) {
                const normalizedCreatedBy = Number(processed.created_by);
                const shouldClear = Number.isNaN(normalizedCreatedBy) || !cachedUserIdSet.has(normalizedCreatedBy);

                if (shouldClear) {
                  tableClearedCreatedByCount++;
                  processed.created_by = null;
                } else {
                  processed.created_by = normalizedCreatedBy;
                }
              }
            }

            // 移除可能冲突的ID字段，让数据库自动生成
            if (['pattern_assets', 'shop_skus', 'store_items', 'achievements', 'ad_products'].includes(tableName) && processed.id) {
              delete processed.id;
            }
            
            // 处理时间字段
            if (processed.created_at && typeof processed.created_at === 'string') {
              processed.created_at = new Date(processed.created_at);
            }
            if (processed.updated_at && typeof processed.updated_at === 'string') {
              processed.updated_at = new Date(processed.updated_at);
            }
            
            return processed;
          });

          const clearedInThisBatch = tableClearedCreatedByCount - previousClearedCount;

          try {
            await knex(tableName).insert(processedBatch);
            insertedCount += batch.length;
            console.log(`  ✅ 插入批次 ${Math.floor(i/batchSize) + 1}: ${batch.length} 条记录`);
            if (tableName === 'pattern_assets' && clearedInThisBatch > 0) {
              console.log(`    ℹ️ 本批次清理 created_by 引用 ${clearedInThisBatch} 条`);
            }
          } catch (insertError) {
            console.log(`  ⚠️ 批次插入失败: ${insertError.message}`);
            // 尝试逐条插入
            for (const record of processedBatch) {
              try {
                await knex(tableName).insert(record);
                insertedCount++;
              } catch (singleError) {
                console.log(`    ❌ 单条记录插入失败: ${singleError.message}`);
              }
            }
          }
        }

        const tableResult = {
          success: true,
          total: data.length,
          inserted: insertedCount,
          skipped: data.length - insertedCount
        };

        if (tableName === 'pattern_assets') {
          tableResult.clearedCreatedByReferences = tableClearedCreatedByCount;
          if (tableClearedCreatedByCount > 0) {
            console.log(`  📉 总计清理 created_by 引用: ${tableClearedCreatedByCount} 条`);
          }
        }

        syncResults[tableName] = tableResult;
        
        console.log(`✅ 表 ${tableName} 同步完成: ${insertedCount}/${data.length} 条记录`);
        
      } catch (error) {
        console.error(`❌ 同步表 ${tableName} 失败:`, error.message);
        syncResults[tableName] = { 
          success: false, 
          error: error.message,
          total: data.length,
          inserted: 0
        };
      }
    }
    
    // 显示同步结果汇总
    console.log('\n📊 同步结果汇总:');
    console.table(syncResults);
    
    // 保存同步报告
    const report = {
      timestamp: new Date().toISOString(),
      results: syncResults,
      summary: {
        totalTables: syncOrder.length,
        successful: Object.values(syncResults).filter(r => r.success).length,
        failed: Object.values(syncResults).filter(r => !r.success).length,
        skipped: Object.values(syncResults).filter(r => r.skipped).length
      }
    };
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `sync-report-${timestamp}.json`;
    const filepath = `../data-export/${filename}`;
    
    fs.writeFileSync(filepath, JSON.stringify(report, null, 2));
    console.log(`\n💾 同步报告已保存到 ${filepath}`);
    
    // 同时保存最新版本
    fs.writeFileSync('../data-export/sync-report-latest.json', JSON.stringify(report, null, 2));
    console.log('💾 同时保存为最新版本: data-export/sync-report-latest.json');
    
    console.log('\n🎉 数据同步完成！');
    
  } catch (error) {
    console.error('❌ 数据同步失败:', error.message);
  } finally {
    await knex.destroy();
    process.exit(0);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  syncDataToProduction();
}

module.exports = { syncDataToProduction };
