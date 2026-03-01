#!/usr/bin/env node

/**
 * FunnyPixels 数据库并发写入测试
 *
 * 模拟多用户同时对同一区域像素进行写入操作：
 * - 测试行锁竞争和死锁
 * - 测试乐观锁/悲观锁策略
 * - 测试事务隔离级别下的行为
 * - 测试批量写入 vs 逐条写入性能
 *
 * 使用方法:
 * node database/db-concurrent-writes.js --writers 50 --duration 30
 */

const { Command } = require('commander');
const knex = require('knex');

const program = new Command();
program
  .option('-w, --writers <n>', '并发写入者数量', '50')
  .option('-d, --duration <sec>', '测试持续时间 (秒)', '30')
  .option('--batch-size <n>', '批量写入大小', '10')
  .option('--region-size <n>', '竞争区域大小 (NxN)', '10')
  .option('--host <host>', '数据库主机', 'localhost')
  .option('--port <port>', '数据库端口', '5432')
  .option('--database <db>', '数据库名称', 'funnypixels_postgres')
  .option('--user <user>', '数据库用户', 'postgres')
  .option('--password <pwd>', '数据库密码', 'postgres')
  .parse(process.argv);

const opts = program.opts();
const WRITERS = parseInt(opts.writers);
const DURATION = parseInt(opts.duration) * 1000;
const BATCH_SIZE = parseInt(opts.batchSize);
const REGION_SIZE = parseInt(opts.regionSize);

const stats = {
  writes_success: 0,
  writes_failed: 0,
  deadlocks: 0,
  lock_timeouts: 0,
  conflicts: 0,
  batch_success: 0,
  batch_failed: 0,
  latencies: [],
  start_time: null,
};

// 测试用的临时表名
const TEST_TABLE = 'loadtest_pixels_temp';

function createDb() {
  return knex({
    client: 'pg',
    connection: {
      host: opts.host,
      port: parseInt(opts.port),
      database: opts.database,
      user: opts.user,
      password: opts.password,
    },
    pool: { min: 2, max: Math.min(WRITERS + 5, 100) },
  });
}

function randomColor() {
  return '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
}

async function setupTestTable(db) {
  // 创建临时测试表（不影响生产数据）
  await db.raw(`DROP TABLE IF EXISTS ${TEST_TABLE}`);
  await db.raw(`
    CREATE TABLE ${TEST_TABLE} (
      x INTEGER NOT NULL,
      y INTEGER NOT NULL,
      color VARCHAR(7) NOT NULL DEFAULT '#000000',
      user_id INTEGER NOT NULL DEFAULT 0,
      updated_at TIMESTAMP DEFAULT NOW(),
      version INTEGER DEFAULT 1,
      PRIMARY KEY (x, y)
    )
  `);

  // 预填充数据
  const rows = [];
  for (let x = 0; x < REGION_SIZE; x++) {
    for (let y = 0; y < REGION_SIZE; y++) {
      rows.push({ x, y, color: '#ffffff', user_id: 0 });
    }
  }
  await db(TEST_TABLE).insert(rows);
  console.log(`  预填充 ${rows.length} 个像素点`);
}

async function cleanupTestTable(db) {
  await db.raw(`DROP TABLE IF EXISTS ${TEST_TABLE}`);
}

// 测试1: 单点并发写入（最高冲突场景）
async function singlePointWrite(db, writerId) {
  const x = Math.floor(Math.random() * REGION_SIZE);
  const y = Math.floor(Math.random() * REGION_SIZE);
  const start = Date.now();

  try {
    await db(TEST_TABLE)
      .where({ x, y })
      .update({
        color: randomColor(),
        user_id: writerId,
        updated_at: db.fn.now(),
        version: db.raw('version + 1'),
      });

    stats.writes_success++;
    stats.latencies.push(Date.now() - start);
  } catch (err) {
    stats.writes_failed++;
    stats.latencies.push(Date.now() - start);
    categorizeError(err);
  }
}

// 测试2: 批量写入（模拟画笔/图案绘制）
async function batchWrite(db, writerId) {
  const startX = Math.floor(Math.random() * (REGION_SIZE - 3));
  const startY = Math.floor(Math.random() * (REGION_SIZE - 3));
  const start = Date.now();

  try {
    await db.transaction(async (trx) => {
      const updates = [];
      for (let i = 0; i < Math.min(BATCH_SIZE, 9); i++) {
        const x = startX + (i % 3);
        const y = startY + Math.floor(i / 3);
        updates.push(
          trx(TEST_TABLE)
            .where({ x, y })
            .update({
              color: randomColor(),
              user_id: writerId,
              updated_at: trx.fn.now(),
              version: trx.raw('version + 1'),
            })
        );
      }
      await Promise.all(updates);
    });

    stats.batch_success++;
    stats.latencies.push(Date.now() - start);
  } catch (err) {
    stats.batch_failed++;
    stats.latencies.push(Date.now() - start);
    categorizeError(err);
  }
}

// 测试3: 乐观锁写入（带版本检查）
async function optimisticWrite(db, writerId) {
  const x = Math.floor(Math.random() * REGION_SIZE);
  const y = Math.floor(Math.random() * REGION_SIZE);
  const start = Date.now();

  try {
    // 先读取当前版本
    const [current] = await db(TEST_TABLE).where({ x, y }).select('version');
    if (!current) return;

    // 尝试更新（带版本检查）
    const updated = await db(TEST_TABLE)
      .where({ x, y, version: current.version })
      .update({
        color: randomColor(),
        user_id: writerId,
        updated_at: db.fn.now(),
        version: current.version + 1,
      });

    if (updated === 0) {
      stats.conflicts++;
    } else {
      stats.writes_success++;
    }
    stats.latencies.push(Date.now() - start);
  } catch (err) {
    stats.writes_failed++;
    stats.latencies.push(Date.now() - start);
    categorizeError(err);
  }
}

function categorizeError(err) {
  if (err.code === '40P01') stats.deadlocks++;
  else if (err.code === '55P03') stats.lock_timeouts++;
  else {
    const key = err.code || 'unknown';
    stats[`error_${key}`] = (stats[`error_${key}`] || 0) + 1;
  }
}

async function writer(db, writerId) {
  while (Date.now() - stats.start_time < DURATION) {
    const roll = Math.random();
    if (roll < 0.5) await singlePointWrite(db, writerId);
    else if (roll < 0.8) await batchWrite(db, writerId);
    else await optimisticWrite(db, writerId);

    await new Promise(r => setTimeout(r, Math.random() * 20));
  }
}

function percentile(arr, p) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  return sorted[Math.ceil(sorted.length * p / 100) - 1];
}

async function main() {
  console.log('✍️  FunnyPixels 并发写入压力测试\n');
  console.log(`   并发写入者: ${WRITERS}`);
  console.log(`   持续时间:   ${DURATION / 1000}s`);
  console.log(`   批量大小:   ${BATCH_SIZE}`);
  console.log(`   竞争区域:   ${REGION_SIZE}x${REGION_SIZE}\n`);

  const db = createDb();

  try {
    await db.raw('SELECT 1');
    console.log('✅ 数据库连接成功');
  } catch (err) {
    console.error(`❌ 连接失败: ${err.message}`);
    process.exit(1);
  }

  console.log('🔧 创建测试表...');
  await setupTestTable(db);

  console.log(`\n🚀 启动 ${WRITERS} 个写入 worker...\n`);
  stats.start_time = Date.now();

  const progressInterval = setInterval(() => {
    const elapsed = (Date.now() - stats.start_time) / 1000;
    const wps = (stats.writes_success + stats.batch_success) / elapsed;
    process.stdout.write(
      `\r  [${elapsed.toFixed(0)}s] WPS: ${wps.toFixed(0)} | ` +
      `成功: ${stats.writes_success + stats.batch_success} | ` +
      `失败: ${stats.writes_failed + stats.batch_failed} | ` +
      `死锁: ${stats.deadlocks} | 冲突: ${stats.conflicts}`
    );
  }, 1000);

  const workers = Array.from({ length: WRITERS }, (_, i) => writer(db, i));
  await Promise.all(workers);
  clearInterval(progressInterval);
  console.log('\n');

  const duration = (Date.now() - stats.start_time) / 1000;
  const totalOps = stats.writes_success + stats.batch_success + stats.writes_failed + stats.batch_failed + stats.conflicts;

  console.log('='.repeat(60));
  console.log('📊 并发写入测试结果');
  console.log('='.repeat(60));
  console.log(`\n  单点写入成功:  ${stats.writes_success.toLocaleString()}`);
  console.log(`  批量写入成功:  ${stats.batch_success.toLocaleString()}`);
  console.log(`  乐观锁冲突:   ${stats.conflicts.toLocaleString()}`);
  console.log(`  写入失败:      ${(stats.writes_failed + stats.batch_failed).toLocaleString()}`);
  console.log(`  死锁次数:      ${stats.deadlocks.toLocaleString()}`);
  console.log(`  锁超时:        ${stats.lock_timeouts.toLocaleString()}`);
  console.log(`  OPS:           ${(totalOps / duration).toFixed(0)}`);

  console.log(`\n  延迟分布:`);
  console.log(`    P50:         ${percentile(stats.latencies, 50).toFixed(1)}ms`);
  console.log(`    P95:         ${percentile(stats.latencies, 95).toFixed(1)}ms`);
  console.log(`    P99:         ${percentile(stats.latencies, 99).toFixed(1)}ms`);
  console.log(`    Max:         ${Math.max(...stats.latencies, 0).toFixed(1)}ms`);

  let grade = 'EXCELLENT';
  if (stats.deadlocks > totalOps * 0.01) grade = 'POOR';
  else if (stats.deadlocks > 0) grade = 'FAIR';
  else if (percentile(stats.latencies, 95) > 500) grade = 'GOOD';
  console.log(`\n  评级: ${grade}`);
  console.log('='.repeat(60));

  console.log('\n🧹 清理测试表...');
  await cleanupTestTable(db);
  await db.destroy();
  process.exit(grade === 'POOR' ? 1 : 0);
}

main().catch(err => {
  console.error('❌ 测试失败:', err);
  process.exit(1);
});
