#!/usr/bin/env node

/**
 * FunnyPixels 数据库连接池压力测试
 *
 * 测试 PostgreSQL 连接池在高并发下的表现：
 * - 连接池饱和行为
 * - 连接等待超时
 * - 连接泄漏检测
 * - 池大小对吞吐量的影响
 *
 * 使用方法:
 * node database/db-connection-pool.js --concurrency 200 --duration 60
 */

const { Command } = require('commander');
const knex = require('knex');

const program = new Command();
program
  .option('-c, --concurrency <n>', '并发查询数', '100')
  .option('-d, --duration <sec>', '测试持续时间 (秒)', '60')
  .option('--pool-min <n>', '连接池最小值', '2')
  .option('--pool-max <n>', '连接池最大值', '20')
  .option('--host <host>', '数据库主机', 'localhost')
  .option('--port <port>', '数据库端口', '5432')
  .option('--database <db>', '数据库名称', 'funnypixels_postgres')
  .option('--user <user>', '数据库用户', 'postgres')
  .option('--password <pwd>', '数据库密码', 'postgres')
  .parse(process.argv);

const opts = program.opts();
const CONCURRENCY = parseInt(opts.concurrency);
const DURATION = parseInt(opts.duration) * 1000;
const POOL_MIN = parseInt(opts.poolMin);
const POOL_MAX = parseInt(opts.poolMax);

// 统计数据
const stats = {
  queries_success: 0,
  queries_failed: 0,
  queries_timeout: 0,
  latencies: [],
  pool_full_waits: 0,
  errors: {},
  start_time: null,
  end_time: null,
};

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
    pool: {
      min: POOL_MIN,
      max: POOL_MAX,
      acquireTimeoutMillis: 30000,
      createTimeoutMillis: 10000,
      idleTimeoutMillis: 10000,
    },
  });
}

// 模拟不同类型的查询负载
const QUERIES = [
  // 轻量级查询 (50%)
  { weight: 50, name: 'simple_select', fn: (db) => db.raw('SELECT 1 as alive') },

  // 中等查询 (30%) - 用户查询
  { weight: 30, name: 'user_query', fn: (db) =>
    db.raw("SELECT id, username FROM users LIMIT 10")
  },

  // 重量级查询 (15%) - 像素区域查询
  { weight: 15, name: 'pixel_area', fn: (db) =>
    db.raw("SELECT COUNT(*) FROM pixels WHERE x BETWEEN 0 AND 100 AND y BETWEEN 0 AND 100")
  },

  // 写入查询 (5%)
  { weight: 5, name: 'write_query', fn: (db) =>
    db.raw("SELECT pg_advisory_lock(floor(random() * 1000)::int), pg_advisory_unlock(floor(random() * 1000)::int)")
  },
];

function pickQuery() {
  const roll = Math.random() * 100;
  let cumulative = 0;
  for (const q of QUERIES) {
    cumulative += q.weight;
    if (roll < cumulative) return q;
  }
  return QUERIES[0];
}

async function runQuery(db) {
  const query = pickQuery();
  const start = Date.now();

  try {
    await query.fn(db);
    const latency = Date.now() - start;
    stats.queries_success++;
    stats.latencies.push(latency);
  } catch (err) {
    const latency = Date.now() - start;
    stats.latencies.push(latency);

    if (err.message.includes('timeout')) {
      stats.queries_timeout++;
    }
    stats.queries_failed++;

    const errKey = err.code || err.message.substring(0, 50);
    stats.errors[errKey] = (stats.errors[errKey] || 0) + 1;
  }
}

async function worker(db, id) {
  while (Date.now() - stats.start_time < DURATION) {
    await runQuery(db);
    // 小幅随机延迟模拟真实场景
    await new Promise(r => setTimeout(r, Math.random() * 10));
  }
}

function percentile(arr, p) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil(sorted.length * p / 100) - 1;
  return sorted[Math.max(0, idx)];
}

async function main() {
  console.log('🗄️  FunnyPixels 数据库连接池压力测试\n');
  console.log(`   并发数: ${CONCURRENCY}`);
  console.log(`   持续时间: ${DURATION / 1000}s`);
  console.log(`   连接池: min=${POOL_MIN}, max=${POOL_MAX}`);
  console.log(`   数据库: ${opts.host}:${opts.port}/${opts.database}\n`);

  const db = createDb();

  // 验证连接
  try {
    await db.raw('SELECT 1');
    console.log('✅ 数据库连接成功\n');
  } catch (err) {
    console.error(`❌ 数据库连接失败: ${err.message}`);
    process.exit(1);
  }

  console.log(`🚀 启动 ${CONCURRENCY} 个并发 worker...\n`);
  stats.start_time = Date.now();

  // 进度报告
  const progressInterval = setInterval(() => {
    const elapsed = (Date.now() - stats.start_time) / 1000;
    const qps = stats.queries_success / elapsed;
    const pool = db.client.pool;
    const poolUsed = pool.numUsed ? pool.numUsed() : 'N/A';
    const poolFree = pool.numFree ? pool.numFree() : 'N/A';
    const poolPending = pool.numPendingAcquires ? pool.numPendingAcquires() : 'N/A';

    process.stdout.write(
      `\r  [${elapsed.toFixed(0)}s] QPS: ${qps.toFixed(0)} | ` +
      `成功: ${stats.queries_success} | 失败: ${stats.queries_failed} | ` +
      `池: used=${poolUsed} free=${poolFree} pending=${poolPending}`
    );
  }, 1000);

  // 启动并发 worker
  const workers = Array.from({ length: CONCURRENCY }, (_, i) => worker(db, i));
  await Promise.all(workers);

  stats.end_time = Date.now();
  clearInterval(progressInterval);
  console.log('\n');

  // 输出结果
  const duration = (stats.end_time - stats.start_time) / 1000;
  const totalQueries = stats.queries_success + stats.queries_failed;
  const qps = totalQueries / duration;

  console.log('=' .repeat(60));
  console.log('📊 测试结果');
  console.log('='.repeat(60));
  console.log(`\n  总查询数:      ${totalQueries.toLocaleString()}`);
  console.log(`  成功:          ${stats.queries_success.toLocaleString()}`);
  console.log(`  失败:          ${stats.queries_failed.toLocaleString()}`);
  console.log(`  超时:          ${stats.queries_timeout.toLocaleString()}`);
  console.log(`  QPS:           ${qps.toFixed(0)}`);
  console.log(`  成功率:        ${((stats.queries_success / totalQueries) * 100).toFixed(2)}%`);

  console.log(`\n  延迟分布:`);
  console.log(`    P50:         ${percentile(stats.latencies, 50).toFixed(1)}ms`);
  console.log(`    P95:         ${percentile(stats.latencies, 95).toFixed(1)}ms`);
  console.log(`    P99:         ${percentile(stats.latencies, 99).toFixed(1)}ms`);
  console.log(`    Max:         ${Math.max(...stats.latencies).toFixed(1)}ms`);

  if (Object.keys(stats.errors).length > 0) {
    console.log(`\n  错误分布:`);
    for (const [err, count] of Object.entries(stats.errors)) {
      console.log(`    ${err}: ${count}`);
    }
  }

  // 评级
  let grade = 'EXCELLENT';
  if (stats.queries_failed / totalQueries > 0.05) grade = 'POOR';
  else if (stats.queries_failed / totalQueries > 0.02) grade = 'FAIR';
  else if (percentile(stats.latencies, 95) > 1000) grade = 'FAIR';
  else if (percentile(stats.latencies, 95) > 500) grade = 'GOOD';

  console.log(`\n  评级: ${grade}`);
  console.log('='.repeat(60));

  await db.destroy();
  process.exit(grade === 'POOR' ? 1 : 0);
}

main().catch(err => {
  console.error('❌ 测试失败:', err);
  process.exit(1);
});
