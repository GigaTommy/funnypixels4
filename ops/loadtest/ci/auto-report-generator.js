#!/usr/bin/env node

/**
 * FunnyPixels 自动综合报告生成器
 *
 * 扫描 reports/ 目录中的所有 k6 JSON 结果，生成一份综合 HTML 报告
 * 用于 CI/CD 流水线自动生成测试总结
 *
 * 使用方法:
 * node ci/auto-report-generator.js --input reports --output reports/summary.html
 */

const fs = require('fs');
const path = require('path');
const { Command } = require('commander');

const program = new Command();
program
  .requiredOption('-i, --input <dir>', '输入目录 (包含 JSON 测试结果)')
  .option('-o, --output <file>', '输出 HTML 文件', 'reports/summary.html')
  .parse(process.argv);

const opts = program.opts();

/**
 * 递归查找目录中的所有 JSON 文件
 */
function findJsonFiles(dir) {
  const files = [];
  if (!fs.existsSync(dir)) return files;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...findJsonFiles(fullPath));
    } else if (entry.name.endsWith('.json') && !entry.name.startsWith('.')) {
      files.push(fullPath);
    }
  }
  return files;
}

/**
 * 尝试解析 k6 JSON 结果
 */
function parseK6Result(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(content);
    // 验证是否为 k6 输出格式
    if (!data.metrics) return null;
    return { file: filePath, data };
  } catch {
    return null;
  }
}

/**
 * 从 k6 结果中提取摘要
 */
function extractSummary(data, filePath) {
  const m = data.metrics || {};
  const name = path.basename(filePath, '.json').replace(/-/g, ' ');

  return {
    name,
    file: filePath,
    timestamp: data.timestamp || null,
    vus_max: m.vus_max?.values?.value ?? m.vus?.values?.max ?? 0,
    duration: data.state?.testRunDurationMs ? data.state.testRunDurationMs / 1000 : 0,

    http_reqs: m.http_reqs?.values?.count ?? 0,
    http_reqs_rate: m.http_reqs?.values?.rate ?? 0,
    http_duration_avg: m.http_req_duration?.values?.avg ?? 0,
    http_duration_p95: m.http_req_duration?.values?.['p(95)'] ?? 0,
    http_duration_p99: m.http_req_duration?.values?.['p(99)'] ?? 0,
    http_failed_rate: (m.http_req_failed?.values?.rate ?? 0) * 100,

    draw_success: m.pixel_draw_success?.values?.count ?? 0,
    draw_failure: m.pixel_draw_failure?.values?.count ?? 0,
    draw_rate: (m.draw_success_rate?.values?.rate ?? 0) * 100,
    draw_latency_p95: m.pixel_draw_latency?.values?.['p(95)'] ?? 0,

    ws_connections: m.ws_connections?.values?.count ?? 0,
    ws_failures: m.ws_connection_failures?.values?.count ?? 0,

    data_received: m.data_received?.values?.count ?? 0,
    data_sent: m.data_sent?.values?.count ?? 0,
  };
}

/**
 * 计算综合评级
 */
function overallRating(summaries) {
  if (summaries.length === 0) return { rating: 'NO DATA', color: '#999', emoji: '❓' };

  let worstScore = 100;
  for (const s of summaries) {
    let score = 100;
    if (s.http_failed_rate > 10) score -= 40;
    else if (s.http_failed_rate > 5) score -= 20;
    else if (s.http_failed_rate > 2) score -= 10;

    if (s.http_duration_p95 > 2000) score -= 30;
    else if (s.http_duration_p95 > 1000) score -= 15;
    else if (s.http_duration_p95 > 500) score -= 5;

    if (s.draw_rate > 0 && s.draw_rate < 90) score -= 30;
    else if (s.draw_rate > 0 && s.draw_rate < 95) score -= 15;

    worstScore = Math.min(worstScore, score);
  }

  if (worstScore >= 85) return { rating: 'EXCELLENT', color: '#4CAF50', emoji: '🏆' };
  if (worstScore >= 70) return { rating: 'GOOD', color: '#2196F3', emoji: '👍' };
  if (worstScore >= 50) return { rating: 'FAIR', color: '#ff9800', emoji: '⚠️' };
  return { rating: 'POOR', color: '#f44336', emoji: '🔴' };
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return (bytes / Math.pow(k, i)).toFixed(1) + ' ' + sizes[i];
}

function formatDuration(seconds) {
  if (seconds < 60) return `${seconds.toFixed(0)}s`;
  if (seconds < 3600) return `${(seconds / 60).toFixed(1)}min`;
  return `${(seconds / 3600).toFixed(1)}h`;
}

/**
 * 生成综合 HTML 报告
 */
function generateHTML(summaries) {
  const { rating, color, emoji } = overallRating(summaries);
  const totalRequests = summaries.reduce((sum, s) => sum + s.http_reqs, 0);
  const totalDuration = summaries.reduce((sum, s) => sum + s.duration, 0);
  const maxVUs = Math.max(...summaries.map(s => s.vus_max), 0);
  const now = new Date().toLocaleString('zh-CN');

  const testRows = summaries.map(s => {
    const statusColor = s.http_failed_rate > 5 ? '#f44336' : s.http_failed_rate > 2 ? '#ff9800' : '#4CAF50';
    return `
      <tr>
        <td><strong>${s.name}</strong></td>
        <td>${s.vus_max}</td>
        <td>${formatDuration(s.duration)}</td>
        <td>${s.http_reqs.toLocaleString()}</td>
        <td>${s.http_duration_avg.toFixed(0)}ms</td>
        <td>${s.http_duration_p95.toFixed(0)}ms</td>
        <td style="color:${statusColor};font-weight:bold">${s.http_failed_rate.toFixed(2)}%</td>
        <td>${s.draw_rate > 0 ? s.draw_rate.toFixed(1) + '%' : '-'}</td>
      </tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>FunnyPixels 综合压力测试报告</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f0f2f5; color: #333; }
    .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #fff; padding: 40px; border-radius: 12px; margin-bottom: 24px; }
    .header h1 { font-size: 2em; margin-bottom: 8px; }
    .header p { opacity: 0.9; }
    .rating { background: ${color}; color: #fff; padding: 24px; border-radius: 12px; text-align: center; margin-bottom: 24px; }
    .rating h2 { font-size: 2.5em; }
    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px; }
    .stat { background: #fff; padding: 20px; border-radius: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
    .stat h4 { color: #888; font-size: 0.85em; text-transform: uppercase; margin-bottom: 8px; }
    .stat .val { font-size: 1.8em; font-weight: bold; color: #333; }
    .card { background: #fff; padding: 24px; border-radius: 10px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
    .card h3 { margin-bottom: 16px; border-bottom: 2px solid #667eea; padding-bottom: 8px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 12px 16px; text-align: left; border-bottom: 1px solid #eee; }
    th { background: #f8f9fa; font-weight: 600; color: #555; font-size: 0.85em; }
    tr:hover { background: #f8f9fa; }
    .footer { text-align: center; padding: 24px; color: #999; font-size: 0.85em; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${emoji} FunnyPixels 综合压力测试报告</h1>
      <p>生成时间: ${now}</p>
      <p>包含 ${summaries.length} 项测试结果</p>
    </div>
    <div class="rating">
      <h2>${rating}</h2>
      <p>综合性能评级</p>
    </div>
    <div class="stats">
      <div class="stat"><h4>测试场景</h4><div class="val">${summaries.length}</div></div>
      <div class="stat"><h4>最大并发</h4><div class="val">${maxVUs.toLocaleString()}</div></div>
      <div class="stat"><h4>总请求数</h4><div class="val">${totalRequests.toLocaleString()}</div></div>
      <div class="stat"><h4>总测试时长</h4><div class="val">${formatDuration(totalDuration)}</div></div>
    </div>
    <div class="card">
      <h3>各场景测试结果</h3>
      <table>
        <thead><tr>
          <th>测试场景</th><th>最大 VU</th><th>时长</th><th>请求数</th>
          <th>平均延迟</th><th>P95 延迟</th><th>错误率</th><th>绘制成功率</th>
        </tr></thead>
        <tbody>${testRows}</tbody>
      </table>
    </div>
    ${summaries.some(s => s.ws_connections > 0) ? `
    <div class="card">
      <h3>WebSocket 测试结果</h3>
      <table>
        <thead><tr><th>场景</th><th>连接数</th><th>失败数</th><th>失败率</th></tr></thead>
        <tbody>${summaries.filter(s => s.ws_connections > 0).map(s => `
          <tr>
            <td>${s.name}</td>
            <td>${s.ws_connections.toLocaleString()}</td>
            <td>${s.ws_failures.toLocaleString()}</td>
            <td>${s.ws_connections > 0 ? ((s.ws_failures / s.ws_connections) * 100).toFixed(2) : 0}%</td>
          </tr>
        `).join('')}</tbody>
      </table>
    </div>` : ''}
    <div class="footer">
      <p>FunnyPixels Load Testing Suite v2.0 | CI/CD Auto Report</p>
    </div>
  </div>
</body>
</html>`;
}

function main() {
  console.log('📊 FunnyPixels 综合报告生成器\n');

  const jsonFiles = findJsonFiles(opts.input);
  console.log(`📂 扫描目录: ${opts.input}`);
  console.log(`   找到 ${jsonFiles.length} 个 JSON 文件`);

  const results = jsonFiles.map(f => parseK6Result(f)).filter(Boolean);
  console.log(`   其中 ${results.length} 个为有效 k6 结果\n`);

  if (results.length === 0) {
    console.log('⚠️  未找到有效的测试结果，生成空报告');
    const html = `<!DOCTYPE html><html><body><h1>No test results found</h1></body></html>`;
    const outputDir = path.dirname(opts.output);
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(opts.output, html);
    process.exit(0);
  }

  const summaries = results.map(r => extractSummary(r.data, r.file));

  // 按 VU 数排序
  summaries.sort((a, b) => b.vus_max - a.vus_max);

  const html = generateHTML(summaries);
  const outputDir = path.dirname(opts.output);
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(opts.output, html);

  const { rating } = overallRating(summaries);
  console.log(`✅ 报告已生成: ${opts.output}`);
  console.log(`📊 综合评级: ${rating}`);
  console.log(`📈 测试场景: ${summaries.length}`);
  console.log(`🔢 总请求数: ${summaries.reduce((s, r) => s + r.http_reqs, 0).toLocaleString()}\n`);
}

main();
