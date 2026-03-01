/**
 * 负载测试脚本
 * 使用原生 Node.js HTTP 客户端进行负载测试
 */

const http = require('http');

/**
 * 配置
 */
const CONFIG = {
  host: process.env.TEST_HOST || 'localhost',
  port: process.env.TEST_PORT || 3001,
  concurrency: parseInt(process.env.CONCURRENCY) || 10,
  duration: parseInt(process.env.DURATION) || 30, // 秒
  endpoint: process.env.ENDPOINT || '/api/health'
};

/**
 * 统计信息
 */
const stats = {
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  totalResponseTime: 0,
  minResponseTime: Infinity,
  maxResponseTime: 0,
  responseTimes: [],
  statusCodes: {}
};

/**
 * 发送单个请求
 */
function sendRequest() {
  return new Promise((resolve) => {
    const startTime = Date.now();

    const options = {
      hostname: CONFIG.host,
      port: CONFIG.port,
      path: CONFIG.endpoint,
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      const duration = Date.now() - startTime;
      stats.totalRequests++;
      stats.totalResponseTime += duration;
      stats.responseTimes.push(duration);

      if (duration < stats.minResponseTime) {
        stats.minResponseTime = duration;
      }
      if (duration > stats.maxResponseTime) {
        stats.maxResponseTime = duration;
      }

      // 记录状态码
      const statusCode = res.statusCode;
      stats.statusCodes[statusCode] = (stats.statusCodes[statusCode] || 0) + 1;

      if (statusCode >= 200 && statusCode < 300) {
        stats.successfulRequests++;
      } else {
        stats.failedRequests++;
      }

      // 消费响应数据（避免内存泄漏）
      res.on('data', () => {});
      res.on('end', () => resolve());
    });

    req.on('error', (error) => {
      stats.totalRequests++;
      stats.failedRequests++;
      console.error('请求错误:', error.message);
      resolve();
    });

    req.end();
  });
}

/**
 * 并发执行请求
 */
async function runConcurrentRequests() {
  const promises = [];
  for (let i = 0; i < CONFIG.concurrency; i++) {
    promises.push(sendRequest());
  }
  await Promise.all(promises);
}

/**
 * 计算百分位数
 */
function calculatePercentile(arr, percentile) {
  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[index] || 0;
}

/**
 * 打印统计信息
 */
function printStats() {
  const avgResponseTime = stats.totalRequests > 0
    ? stats.totalResponseTime / stats.totalRequests
    : 0;

  const requestsPerSecond = stats.totalRequests / CONFIG.duration;

  const p50 = calculatePercentile(stats.responseTimes, 50);
  const p95 = calculatePercentile(stats.responseTimes, 95);
  const p99 = calculatePercentile(stats.responseTimes, 99);

  console.log('\n' + '='.repeat(60));
  console.log('负载测试报告');
  console.log('='.repeat(60));
  console.log(`目标: ${CONFIG.host}:${CONFIG.port}${CONFIG.endpoint}`);
  console.log(`并发数: ${CONFIG.concurrency}`);
  console.log(`持续时间: ${CONFIG.duration}秒`);
  console.log('='.repeat(60));
  console.log(`总请求数: ${stats.totalRequests}`);
  console.log(`成功请求: ${stats.successfulRequests}`);
  console.log(`失败请求: ${stats.failedRequests}`);
  console.log(`成功率: ${((stats.successfulRequests / stats.totalRequests) * 100).toFixed(2)}%`);
  console.log('='.repeat(60));
  console.log(`平均响应时间: ${avgResponseTime.toFixed(2)}ms`);
  console.log(`最小响应时间: ${stats.minResponseTime}ms`);
  console.log(`最大响应时间: ${stats.maxResponseTime}ms`);
  console.log(`P50 (中位数): ${p50}ms`);
  console.log(`P95: ${p95}ms`);
  console.log(`P99: ${p99}ms`);
  console.log('='.repeat(60));
  console.log(`吞吐量: ${requestsPerSecond.toFixed(2)} 请求/秒`);
  console.log('='.repeat(60));
  console.log('状态码分布:');
  Object.keys(stats.statusCodes)
    .sort()
    .forEach(code => {
      const count = stats.statusCodes[code];
      const percentage = ((count / stats.totalRequests) * 100).toFixed(2);
      console.log(`  ${code}: ${count} (${percentage}%)`);
    });
  console.log('='.repeat(60) + '\n');
}

/**
 * 主函数
 */
async function main() {
  console.log('🚀 开始负载测试...');
  console.log(`目标: ${CONFIG.host}:${CONFIG.port}${CONFIG.endpoint}`);
  console.log(`并发数: ${CONFIG.concurrency}`);
  console.log(`持续时间: ${CONFIG.duration}秒\n`);

  const startTime = Date.now();
  const endTime = startTime + (CONFIG.duration * 1000);

  // 持续发送请求直到时间结束
  while (Date.now() < endTime) {
    await runConcurrentRequests();

    // 每秒打印进度
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    if (elapsed > 0 && elapsed % 5 === 0) {
      const progress = ((elapsed / CONFIG.duration) * 100).toFixed(0);
      process.stdout.write(`\r进度: ${progress}% (${stats.totalRequests} 请求)`);
    }
  }

  console.log('\n\n✅ 负载测试完成！\n');
  printStats();
}

/**
 * 性能测试建议
 */
function printRecommendations() {
  const avgResponseTime = stats.totalResponseTime / stats.totalRequests;
  const p95 = calculatePercentile(stats.responseTimes, 95);
  const successRate = (stats.successfulRequests / stats.totalRequests) * 100;

  console.log('📊 性能分析和建议:');
  console.log('='.repeat(60));

  // 响应时间分析
  if (avgResponseTime < 100) {
    console.log('✅ 平均响应时间优秀 (< 100ms)');
  } else if (avgResponseTime < 200) {
    console.log('⚠️  平均响应时间良好 (< 200ms)，可以优化');
  } else {
    console.log('❌ 平均响应时间较慢 (>= 200ms)，需要优化');
  }

  // P95 分析
  if (p95 < 500) {
    console.log('✅ P95 响应时间优秀 (< 500ms)');
  } else if (p95 < 1000) {
    console.log('⚠️  P95 响应时间一般 (< 1000ms)');
  } else {
    console.log('❌ P95 响应时间较差 (>= 1000ms)');
  }

  // 成功率分析
  if (successRate >= 99.9) {
    console.log('✅ 成功率优秀 (>= 99.9%)');
  } else if (successRate >= 99) {
    console.log('⚠️  成功率良好 (>= 99%)');
  } else {
    console.log('❌ 成功率需要改进 (< 99%)');
  }

  console.log('='.repeat(60));

  // 具体建议
  console.log('\n💡 优化建议:');
  if (avgResponseTime > 200) {
    console.log('- 考虑添加缓存（Redis）');
    console.log('- 优化数据库查询（添加索引）');
    console.log('- 使用连接池');
  }
  if (p95 > 500) {
    console.log('- 检查慢查询');
    console.log('- 优化资源密集型操作');
    console.log('- 考虑异步处理');
  }
  if (successRate < 99) {
    console.log('- 检查错误日志');
    console.log('- 增加错误处理');
    console.log('- 提高系统稳定性');
  }
  console.log('');
}

// 运行测试
if (require.main === module) {
  main()
    .then(() => {
      printRecommendations();
      process.exit(0);
    })
    .catch((error) => {
      console.error('负载测试失败:', error);
      process.exit(1);
    });
}

module.exports = {
  sendRequest,
  runConcurrentRequests,
  calculatePercentile,
  stats
};
