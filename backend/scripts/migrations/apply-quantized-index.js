/**
 * 应用量化几何索引迁移
 *
 * 功能：
 * 1. 创建缺失的 idx_pixels_geom_quantized 索引
 * 2. 分析表以更新统计信息
 * 3. 验证索引创建成功
 */

const { db } = require('../../src/config/database');
const logger = require('../../src/utils/logger');

async function applyQuantizedIndexMigration() {
  console.log('╔═══════════════════════════════════════════════════════════════════╗');
  console.log('║           创建量化几何索引                                         ║');
  console.log('╚═══════════════════════════════════════════════════════════════════╝\n');

  try {
    // 检查索引是否已存在
    console.log('🔍 检查索引是否已存在...');
    const existingIndex = await db.raw(`
      SELECT indexname
      FROM pg_indexes
      WHERE tablename = 'pixels'
        AND indexname = 'idx_pixels_geom_quantized'
    `);

    if (existingIndex.rows.length > 0) {
      console.log('✅ 索引 idx_pixels_geom_quantized 已存在，无需创建\n');
      await db.destroy();
      return;
    }

    console.log('📝 索引不存在，开始创建...\n');

    // 创建索引 (使用 CONCURRENTLY 避免锁表)
    console.log('⏳ 创建索引: idx_pixels_geom_quantized');
    console.log('   这可能需要几分钟时间，请耐心等待...\n');

    const startTime = Date.now();

    try {
      // 注意: CONCURRENTLY 不能在事务中使用，需要单独执行
      await db.raw(`
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pixels_geom_quantized
        ON pixels
        USING SPGIST (ST_SnapToGrid(geom, 0.00001))
      `);

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`✅ 索引创建成功 (耗时: ${elapsed}秒)\n`);

    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('✅ 索引已存在 (并发创建)\n');
      } else {
        throw error;
      }
    }

    // 分析表以更新统计信息
    console.log('📊 更新表统计信息...');
    await db.raw('ANALYZE pixels');
    console.log('✅ 表统计信息已更新\n');

    // 验证索引创建
    console.log('🔍 验证索引创建...');
    const verification = await db.raw(`
      SELECT
        indexname,
        tablename,
        indexdef
      FROM pg_indexes
      WHERE tablename = 'pixels'
        AND indexname = 'idx_pixels_geom_quantized'
    `);

    if (verification.rows.length > 0) {
      console.log('✅ 索引验证成功\n');
      console.log('索引定义:');
      console.log(verification.rows[0].indexdef);
      console.log('');
    } else {
      console.log('❌ 索引验证失败\n');
    }

    // 显示所有几何相关索引
    console.log('═'.repeat(70));
    console.log('📋 pixels表上的所有几何索引:');
    console.log('═'.repeat(70) + '\n');

    const allIndexes = await db.raw(`
      SELECT
        indexname,
        indexdef
      FROM pg_indexes
      WHERE tablename = 'pixels'
        AND (indexname LIKE '%geom%' OR indexname LIKE '%grid%')
      ORDER BY indexname
    `);

    allIndexes.rows.forEach(idx => {
      const status = idx.indexname === 'idx_pixels_geom_quantized' ? '🆕' : '✅';
      console.log(`${status} ${idx.indexname}`);
    });
    console.log('');

    console.log('═'.repeat(70));
    console.log('✅ 迁移完成');
    console.log('═'.repeat(70));
    console.log('\n建议: 重新运行性能测试以验证优化效果');
    console.log('命令: node backend/scripts/diagnostics/direct-mvt-test.js\n');

  } catch (error) {
    console.error('❌ 迁移失败:', error.message);
    console.error('详细错误:', error);
    process.exit(1);
  } finally {
    await db.destroy();
  }
}

// 运行迁移
applyQuantizedIndexMigration().catch(console.error);
