/**
 * 简单的并发测试脚本
 */

const http = require('http');
const { performance } = require('perf_hooks');

// 测试配置
const API_HOST = 'http://localhost:3001';
const CONCURRENT_REQUESTS = 100;
const TOTAL_REQUESTS = 1000;
const ENDPOINT = '/api/health';

// 统计数据
const stats = {
  total: 0,
  success: 0,
  failed: 0,
  latencies: [],
  startTime: null,
  endTime: null
};

// 发送单个请求
function sendRequest() {
  return new Promise((resolve) => {
    const startTime = performance.now();

    const req = http.get(`${API_HOST}${ENDPOINT}`, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        const endTime = performance.now();
        const latency = endTime - startTime;

        stats.total++;
        stats.latencies.push(latency);

        if (res.statusCode === 200) {
          stats.success++;
        } else {
          stats.failed++;
        }

        resolve();
      });
    });

    req.on('error', () => {
      stats.total++;
      stats.failed++;
      resolve();
    });

    req.setTimeout(5000, () => {
      req.destroy();
      stats.total++;
      stats.failed++;
      resolve();
    });
  });
}

// 执行并发测试
async function runConcurrencyTest() {
  console.log(`🚀 开始并发测试...`);
  console.log(`📊 配置:`);
  console.log(`   - 并发数: ${CONCURRENT_REQUESTS}`);
  console.log(`   - 总请求数: ${TOTAL_REQUESTS}`);
  console.log(`   - 端点: ${ENDPOINT}\n`);

  stats.startTime = performance.now();

  // 分批执行请求
  for (let i = 0; i < TOTAL_REQUESTS; i += CONCURRENT_REQUESTS) {
    const batch = Math.min(CONCURRENT_REQUESTS, TOTAL_REQUESTS - i);
    const promises = [];

    for (let j = 0; j < batch; j++) {
      promises.push(sendRequest());
    }

    await Promise.all(promises);

    const progress = Math.min(i + batch, TOTAL_REQUESTS);
    const percent = ((progress / TOTAL_REQUESTS) * 100).toFixed(1);
    console.log(`进度: ${percent}% (${progress}/${TOTAL_REQUESTS})`);
  }

  stats.endTime = performance.now();

  // 计算结果
  const totalTime = stats.endTime - stats.startTime;
  const qps = (stats.total / (totalTime / 1000)).toFixed(2);
  const latencies = stats.latencies.sort((a, b) => a - b);
  const avgLatency = (latencies.reduce((a, b) => a + b, 0) / latencies.length).toFixed(2);
  const p95Latency = latencies[Math.floor(latencies.length * 0.95)].toFixed(2);
  const p99Latency = latencies[Math.floor(latencies.length * 0.99)].toFixed(2);

  console.log('\n📊 测试结果:');
  console.log('=====================================');
  console.log(`总请求数: ${stats.total}`);
  console.log(`成功请求: ${stats.success} (${((stats.success/stats.total)*100).toFixed(2)}%)`);
  console.log(`失败请求: ${stats.failed} (${((stats.failed/stats.total)*100).toFixed(2)}%)`);
  console.log(`测试时长: ${(totalTime/1000).toFixed(2)}秒`);
  console.log(`QPS: ${qps} 请求/秒\n`);

  console.log('延迟统计:');
  console.log(`  平均延迟: ${avgLatency}ms`);
  console.log(`  P95延迟: ${p95Latency}ms`);
  console.log(`  P99延迟: ${p99Latency}ms`);
  console.log(`  最小延迟: ${Math.min(...latencies).toFixed(2)}ms`);
  console.log(`  最大延迟: ${Math.max(...latencies).toFixed(2)}ms\n`);

  // 评估性能
  const successRate = (stats.success / stats.total) * 100;
  if (successRate >= 99 && parseFloat(p95Latency) < 100) {
    console.log('✅ 性能评级: 优秀 ⭐⭐⭐⭐⭐');
  } else if (successRate >= 95 && parseFloat(p95Latency) < 200) {
    console.log('⭐ 性能评级: 良好 ⭐⭐⭐⭐');
  } else if (successRate >= 90 && parseFloat(p95Latency) < 500) {
    console.log('⭐ 性能评级: 一般 ⭐⭐⭐');
  } else {
    console.log('⚠️ 性能评级: 需要优化 ⭐⭐');
  }
}

// 运行测试
runConcurrencyTest().catch(console.error);