#!/usr/bin/env node

/**
 * FunnyPixels Redis 内存压力测试
 *
 * 测试 Redis 在高内存使用率下的行为：
 * - 大量缓存写入吞吐量
 * - 内存接近上限时的淘汰策略
 * - Pub/Sub 在高压下的延迟
 * - 大 key 对性能的影响
 *
 * 使用方法:
 * node database/redis-memory-pressure.js --concurrency 50 --duration 30
 */

const { Command } = require('commander');
const { createClient } = require('redis');

const program = new Command();
program
  .option('-c, --concurrency <n>', '并发数', '50')
  .option('-d, --duration <sec>', '测试持续时间 (秒)', '30')
  .option('--host <host>', 'Redis 主机', 'localhost')
  .option('--port <port>', 'Redis 端口', '6379')
  .option('--prefix <prefix>', '测试 key 前缀', 'loadtest:')
  .parse(process.argv);

const opts = program.opts();
const CONCURRENCY = parseInt(opts.concurrency);
const DURATION = parseInt(opts.duration) * 1000;
const PREFIX = opts.prefix;

const stats = {
  ops_success: 0,
  ops_failed: 0,
  set_count: 0,
  get_count: 0,
  get_hits: 0,
  get_misses: 0,
  pubsub_published: 0,
  pubsub_received: 0,
  latencies: { set: [], get: [], pubsub: [] },
  start_time: null,
  memory_samples: [],
};

async function createRedisClient() {
  const client = createClient({
    socket: { host: opts.host, port: parseInt(opts.port) },
  });
  client.on('error', () => {});
  await client.connect();
  return client;
}

// 测试1: 大量 SET 操作（模拟瓦片缓存写入）
async function testCacheWrite(client) {
  const key = `${PREFIX}tile:${Math.floor(Math.random() * 100000)}`;
  // 模拟瓦片数据 (1KB - 50KB)
  const size = 1024 + Math.floor(Math.random() * 49 * 1024);
  const value = 'x'.repeat(size);

  const start = Date.now();
  try {
    await client.set(key, value, { EX: 300 }); // 5 分钟过期
    stats.set_count++;
    stats.ops_success++;
    stats.latencies.set.push(Date.now() - start);
  } catch {
    stats.ops_failed++;
  }
}

// 测试2: GET 操作（模拟缓存读取）
async function testCacheRead(client) {
  const key = `${PREFIX}tile:${Math.floor(Math.random() * 100000)}`;

  const start = Date.now();
  try {
    const result = await client.get(key);
    stats.get_count++;
    stats.ops_success++;
    if (result) stats.get_hits++;
    else stats.get_misses++;
    stats.latencies.get.push(Date.now() - start);
  } catch {
    stats.ops_failed++;
  }
}

// 测试3: Pub/Sub（模拟实时像素更新广播）
async function testPubSub(publisher) {
  const channel = `${PREFIX}pixel_update:${Math.floor(Math.random() * 100)}`;
  const message = JSON.stringify({
    x: Math.floor(Math.random() * 10000),
    y: Math.floor(Math.random() * 10000),
    color: '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0'),
    userId: Math.floor(Math.random() * 10000),
    timestamp: Date.now(),
  });

  const start = Date.now();
  try {
    await publisher.publish(channel, message);
    stats.pubsub_published++;
    stats.ops_success++;
    stats.latencies.pubsub.push(Date.now() - start);
  } catch {
    stats.ops_failed++;
  }
}

// 测试4: Pipeline 批量操作
async function testPipeline(client) {
  const start = Date.now();
  try {
    const pipeline = client.multi();
    for (let i = 0; i < 10; i++) {
      const key = `${PREFIX}batch:${Math.floor(Math.random() * 10000)}`;
      pipeline.set(key, `value_${i}`, { EX: 60 });
    }
    await pipeline.exec();
    stats.set_count += 10;
    stats.ops_success += 10;
    stats.latencies.set.push(Date.now() - start);
  } catch {
    stats.ops_failed += 10;
  }
}

async function collectMemoryInfo(client) {
  try {
    const info = await client.info('memory');
    const usedMatch = info.match(/used_memory:(\d+)/);
    const peakMatch = info.match(/used_memory_peak:(\d+)/);
    const fragMatch = info.match(/mem_fragmentation_ratio:([\d.]+)/);

    stats.memory_samples.push({
      timestamp: Date.now(),
      used: usedMatch ? parseInt(usedMatch[1]) : 0,
      peak: peakMatch ? parseInt(peakMatch[1]) : 0,
      fragRatio: fragMatch ? parseFloat(fragMatch[1]) : 0,
    });
  } catch {}
}

async function worker(client, publisher) {
  while (Date.now() - stats.start_time < DURATION) {
    const roll = Math.random();
    if (roll < 0.3) await testCacheWrite(client);
    else if (roll < 0.65) await testCacheRead(client);
    else if (roll < 0.85) await testPubSub(publisher);
    else await testPipeline(client);

    await new Promise(r => setTimeout(r, Math.random() * 5));
  }
}

function percentile(arr, p) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  return sorted[Math.ceil(sorted.length * p / 100) - 1];
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1048576).toFixed(1)}MB`;
}

async function cleanup(client) {
  console.log('🧹 清理测试数据...');
  let cursor = 0;
  let cleaned = 0;
  do {
    const result = await client.scan(cursor, { MATCH: `${PREFIX}*`, COUNT: 1000 });
    cursor = result.cursor;
    if (result.keys.length > 0) {
      await client.del(result.keys);
      cleaned += result.keys.length;
    }
  } while (cursor !== 0);
  console.log(`   清理了 ${cleaned} 个 key`);
}

async function main() {
  console.log('🔴 FunnyPixels Redis 内存压力测试\n');
  console.log(`   并发数:   ${CONCURRENCY}`);
  console.log(`   持续时间: ${DURATION / 1000}s`);
  console.log(`   Redis:    ${opts.host}:${opts.port}\n`);

  let mainClient;
  try {
    mainClient = await createRedisClient();
    console.log('✅ Redis 连接成功');
    await collectMemoryInfo(mainClient);
    const initial = stats.memory_samples[0];
    console.log(`   初始内存: ${formatBytes(initial.used)}\n`);
  } catch (err) {
    console.error(`❌ Redis 连接失败: ${err.message}`);
    process.exit(1);
  }

  // 创建多个客户端连接
  const clients = [];
  const publishers = [];
  for (let i = 0; i < Math.min(CONCURRENCY, 50); i++) {
    clients.push(await createRedisClient());
    publishers.push(await createRedisClient());
  }
  console.log(`🔗 创建了 ${clients.length} 个客户端连接`);

  // 创建 subscriber
  const subscriber = mainClient.duplicate();
  await subscriber.connect();
  await subscriber.pSubscribe(`${PREFIX}pixel_update:*`, () => {
    stats.pubsub_received++;
  });

  console.log(`\n🚀 启动 ${CONCURRENCY} 个 worker...\n`);
  stats.start_time = Date.now();

  // 内存采样
  const memInterval = setInterval(() => collectMemoryInfo(mainClient), 2000);

  const progressInterval = setInterval(() => {
    const elapsed = (Date.now() - stats.start_time) / 1000;
    const ops = stats.ops_success / elapsed;
    process.stdout.write(
      `\r  [${elapsed.toFixed(0)}s] OPS: ${ops.toFixed(0)} | ` +
      `SET: ${stats.set_count} | GET: ${stats.get_count} (${stats.get_hits} hits) | ` +
      `Pub: ${stats.pubsub_published} Sub: ${stats.pubsub_received}`
    );
  }, 1000);

  const workers = Array.from({ length: CONCURRENCY }, (_, i) =>
    worker(clients[i % clients.length], publishers[i % publishers.length])
  );
  await Promise.all(workers);

  clearInterval(progressInterval);
  clearInterval(memInterval);
  await collectMemoryInfo(mainClient);
  console.log('\n');

  // 结果
  const duration = (Date.now() - stats.start_time) / 1000;
  const finalMem = stats.memory_samples[stats.memory_samples.length - 1];
  const initialMem = stats.memory_samples[0];
  const memGrowth = finalMem.used - initialMem.used;

  console.log('='.repeat(60));
  console.log('📊 Redis 压力测试结果');
  console.log('='.repeat(60));
  console.log(`\n  总操作数:      ${(stats.ops_success + stats.ops_failed).toLocaleString()}`);
  console.log(`  OPS:           ${(stats.ops_success / duration).toFixed(0)}`);
  console.log(`  成功率:        ${((stats.ops_success / (stats.ops_success + stats.ops_failed)) * 100).toFixed(2)}%`);
  console.log(`\n  SET:           ${stats.set_count.toLocaleString()}`);
  console.log(`  GET:           ${stats.get_count.toLocaleString()} (命中率: ${stats.get_count > 0 ? ((stats.get_hits / stats.get_count) * 100).toFixed(1) : 0}%)`);
  console.log(`  Pub/Sub:       发布 ${stats.pubsub_published} / 接收 ${stats.pubsub_received}`);

  console.log(`\n  延迟 (SET): P50=${percentile(stats.latencies.set, 50).toFixed(1)}ms P95=${percentile(stats.latencies.set, 95).toFixed(1)}ms`);
  console.log(`  延迟 (GET): P50=${percentile(stats.latencies.get, 50).toFixed(1)}ms P95=${percentile(stats.latencies.get, 95).toFixed(1)}ms`);
  console.log(`  延迟 (Pub): P50=${percentile(stats.latencies.pubsub, 50).toFixed(1)}ms P95=${percentile(stats.latencies.pubsub, 95).toFixed(1)}ms`);

  console.log(`\n  内存变化:      ${formatBytes(initialMem.used)} → ${formatBytes(finalMem.used)} (+${formatBytes(memGrowth)})`);
  console.log(`  内存碎片率:    ${finalMem.fragRatio.toFixed(2)}`);
  console.log('='.repeat(60));

  // 清理
  await cleanup(mainClient);
  await subscriber.quit();
  for (const c of clients) await c.quit();
  for (const p of publishers) await p.quit();
  await mainClient.quit();
}

main().catch(err => {
  console.error('❌ 测试失败:', err);
  process.exit(1);
});
