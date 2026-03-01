#!/usr/bin/env node
/**
 * 清理负载测试数据
 *
 * 使用方式:
 * node cleanup-test-data.js --prefix load_test_ --dry-run
 */

const { program } = require('commander');
const knex = require('knex');
const path = require('path');

program
  .option('--prefix <string>', 'User ID prefix to clean up', 'load_test_')
  .option('--dry-run', 'Dry run - show what would be deleted without actually deleting', false)
  .option('--db-config <file>', 'Database config file', '../../../backend/knexfile.js')
  .option('--env <environment>', 'Environment (development|test|production)', 'test')
  .option('--confirm', 'Skip confirmation prompt (dangerous!)', false)
  .parse(process.argv);

const options = program.opts();

// ==================== 数据库连接 ====================

function getDatabase() {
  const knexfile = require(path.resolve(__dirname, options.dbConfig));
  const config = knexfile[options.env];

  if (!config) {
    throw new Error(`Database config not found for environment: ${options.env}`);
  }

  return knex(config);
}

// ==================== 清理函数 ====================

async function countTestData(db, prefix) {
  const counts = {};

  // 统计测试用户
  const usersCount = await db('users')
    .where('id', 'like', `${prefix}%`)
    .count('* as count')
    .first();
  counts.users = parseInt(usersCount.count);

  // 统计测试用户绘制的像素
  const pixelsCount = await db('pixels')
    .where('user_id', 'like', `${prefix}%`)
    .count('* as count')
    .first();
  counts.pixels = parseInt(pixelsCount.count);

  // 统计用户状态
  const statesCount = await db('user_pixel_states')
    .where('user_id', 'like', `${prefix}%`)
    .count('* as count')
    .first();
  counts.user_pixel_states = parseInt(statesCount.count);

  // 统计像素历史
  const historyCount = await db('pixels_history')
    .where('user_id', 'like', `${prefix}%`)
    .count('* as count')
    .first();
  counts.pixels_history = parseInt(historyCount.count);

  // 统计绘制会话
  const sessionsCount = await db('drawing_sessions')
    .where('user_id', 'like', `${prefix}%`)
    .count('* as count')
    .first();
  counts.drawing_sessions = parseInt(sessionsCount.count);

  return counts;
}

async function deleteTestData(db, prefix, dryRun = false) {
  const counts = await countTestData(db, prefix);
  let deletedCounts = { ...counts };

  if (dryRun) {
    console.log('\n🔍 DRY RUN MODE - No data will be deleted\n');
    return counts;
  }

  console.log('\n🗑️  Starting deletion...\n');

  try {
    // 按照依赖关系逆序删除

    // 1. 删除像素历史（外键依赖于pixels和users）
    if (counts.pixels_history > 0) {
      const deleted = await db('pixels_history')
        .where('user_id', 'like', `${prefix}%`)
        .del();
      deletedCounts.pixels_history = deleted;
      console.log(`  ✓ Deleted ${deleted} pixels_history records`);
    }

    // 2. 删除绘制会话
    if (counts.drawing_sessions > 0) {
      const deleted = await db('drawing_sessions')
        .where('user_id', 'like', `${prefix}%`)
        .del();
      deletedCounts.drawing_sessions = deleted;
      console.log(`  ✓ Deleted ${deleted} drawing_sessions records`);
    }

    // 3. 删除像素（外键依赖于users）
    if (counts.pixels > 0) {
      const deleted = await db('pixels')
        .where('user_id', 'like', `${prefix}%`)
        .del();
      deletedCounts.pixels = deleted;
      console.log(`  ✓ Deleted ${deleted} pixels records`);
    }

    // 4. 删除用户状态
    if (counts.user_pixel_states > 0) {
      const deleted = await db('user_pixel_states')
        .where('user_id', 'like', `${prefix}%`)
        .del();
      deletedCounts.user_pixel_states = deleted;
      console.log(`  ✓ Deleted ${deleted} user_pixel_states records`);
    }

    // 5. 删除用户（最后删除，因为其他表有外键引用）
    if (counts.users > 0) {
      const deleted = await db('users')
        .where('id', 'like', `${prefix}%`)
        .del();
      deletedCounts.users = deleted;
      console.log(`  ✓ Deleted ${deleted} users records`);
    }

    console.log('\n✅ Deletion completed successfully!\n');

  } catch (error) {
    console.error('\n❌ Error during deletion:', error.message);
    throw error;
  }

  return deletedCounts;
}

// ==================== 主程序 ====================

async function main() {
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║          FunnyPixels Test Data Cleanup Utility               ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`Configuration:`);
  console.log(`  Prefix:          ${options.prefix}`);
  console.log(`  Environment:     ${options.env}`);
  console.log(`  Dry Run:         ${options.dryRun}`);
  console.log('');

  let db;

  try {
    // 连接数据库
    console.log('Connecting to database...');
    db = getDatabase();

    // 统计测试数据
    console.log('Counting test data...');
    const counts = await countTestData(db, options.prefix);

    console.log('\n📊 Test Data Summary:');
    console.log('━'.repeat(60));
    console.log(`  Users:               ${counts.users}`);
    console.log(`  Pixels:              ${counts.pixels}`);
    console.log(`  User Pixel States:   ${counts.user_pixel_states}`);
    console.log(`  Pixels History:      ${counts.pixels_history}`);
    console.log(`  Drawing Sessions:    ${counts.drawing_sessions}`);
    console.log('━'.repeat(60));

    const totalRecords = Object.values(counts).reduce((sum, count) => sum + count, 0);
    console.log(`  Total Records:       ${totalRecords}\n`);

    if (totalRecords === 0) {
      console.log('✓ No test data found to clean up.');
      return;
    }

    // 确认删除
    if (!options.dryRun && !options.confirm) {
      console.log('⚠️  WARNING: This operation will permanently delete all test data!');
      console.log('   Use --dry-run to preview what will be deleted.');
      console.log('   Use --confirm to skip this confirmation.\n');

      const readline = require('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      const answer = await new Promise(resolve => {
        rl.question('Are you sure you want to continue? (yes/no): ', resolve);
      });
      rl.close();

      if (answer.toLowerCase() !== 'yes') {
        console.log('\n❌ Cleanup cancelled by user.');
        return;
      }
    }

    // 执行删除
    const deletedCounts = await deleteTestData(db, options.prefix, options.dryRun);

    if (options.dryRun) {
      console.log('\n📋 Would delete:');
      console.log('━'.repeat(60));
      Object.entries(deletedCounts).forEach(([table, count]) => {
        if (count > 0) {
          console.log(`  ${table}: ${count} records`);
        }
      });
      console.log('━'.repeat(60));
      console.log('\nRun without --dry-run to actually delete this data.\n');
    }

  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    if (db) {
      await db.destroy();
      console.log('Database connection closed.');
    }
  }
}

// 处理中断信号
process.on('SIGINT', async () => {
  console.log('\n\nReceived SIGINT, cleaning up...');
  process.exit(0);
});

// 运行主程序
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
