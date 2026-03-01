/**
 * FunnyPixels 测试报告生成器
 *
 * 功能: 将K6 JSON输出转换为可读的HTML报告
 *
 * 使用方法:
 * node reporting/report-generator.js --input reports/test.json --output reports/test.html
 */

const fs = require('fs');
const path = require('path');
const { Command } = require('commander');

const program = new Command();
program
  .requiredOption('-i, --input <file>', '输入JSON文件路径')
  .option('-o, --output <file>', '输出HTML文件路径', null)
  .option('-t, --template <file>', '自定义HTML模板', null)
  .parse(process.argv);

const options = program.opts();

// 读取测试结果
function loadTestResults(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`❌ 无法读取文件: ${filePath}`);
    console.error(error.message);
    process.exit(1);
  }
}

// 提取关键指标
function extractMetrics(data) {
  const metrics = data.metrics || {};

  return {
    // 业务指标
    pixelDrawSuccess: metrics.pixel_draw_success?.values?.count || 0,
    pixelDrawFailure: metrics.pixel_draw_failure?.values?.count || 0,
    drawSuccessRate: (metrics.draw_success_rate?.values?.rate || 0) * 100,

    // 延迟指标
    drawLatencyAvg: metrics.pixel_draw_latency?.values?.avg || 0,
    drawLatencyP50: metrics.pixel_draw_latency?.values?.med || 0,
    drawLatencyP95: metrics.pixel_draw_latency?.values['p(95)'] || 0,
    drawLatencyP99: metrics.pixel_draw_latency?.values['p(99)'] || 0,
    drawLatencyMax: metrics.pixel_draw_latency?.values?.max || 0,

    // HTTP指标
    httpReqs: metrics.http_reqs?.values?.count || 0,
    httpReqDurationAvg: metrics.http_req_duration?.values?.avg || 0,
    httpReqDurationP95: metrics.http_req_duration?.values['p(95)'] || 0,
    httpReqFailedRate: (metrics.http_req_failed?.values?.rate || 0) * 100,

    // WebSocket指标
    wsConnections: metrics.ws_connections?.values?.count || 0,
    wsConnectionFailures: metrics.ws_connection_failures?.values?.count || 0,
    wsMessagesReceived: metrics.ws_messages_received?.values?.count || 0,

    // 错误指标
    pixelConflicts: metrics.pixel_conflicts?.values?.count || 0,
    authFailures: metrics.auth_failures?.values?.count || 0,
    systemOverloadErrors: metrics.system_overload_errors?.values?.count || 0,
  };
}

// 性能评级
function getRating(metrics) {
  let rating = 'EXCELLENT';
  let color = '#4CAF50';
  let issues = [];

  if (metrics.drawSuccessRate < 90) {
    rating = 'POOR';
    color = '#f44336';
    issues.push('成功率低于90%');
  } else if (metrics.drawSuccessRate < 95) {
    rating = 'FAIR';
    color = '#ff9800';
    issues.push('成功率低于95%');
  } else if (metrics.drawSuccessRate < 98) {
    rating = 'GOOD';
    color = '#2196F3';
  }

  if (metrics.drawLatencyP95 > 1000) {
    if (rating === 'EXCELLENT') rating = 'GOOD';
    color = '#ff9800';
    issues.push('P95延迟超过1秒');
  } else if (metrics.drawLatencyP95 > 500 && rating === 'EXCELLENT') {
    rating = 'GOOD';
  }

  if (metrics.httpReqFailedRate > 10) {
    rating = 'POOR';
    color = '#f44336';
    issues.push('HTTP错误率超过10%');
  } else if (metrics.httpReqFailedRate > 5 && rating !== 'POOR') {
    rating = 'FAIR';
    color = '#ff9800';
    issues.push('HTTP错误率超过5%');
  }

  return { rating, color, issues };
}

// 生成HTML报告
function generateHTML(data, metrics, testInfo) {
  const { rating, color, issues } = getRating(metrics);
  const timestamp = data.timestamp || new Date().toISOString();

  return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>FunnyPixels 压力测试报告 - ${timestamp}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            background: #f5f5f5;
        }

        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }

        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 40px;
            border-radius: 10px;
            margin-bottom: 30px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.1);
        }

        .header h1 {
            font-size: 2.5em;
            margin-bottom: 10px;
        }

        .header p {
            font-size: 1.1em;
            opacity: 0.9;
        }

        .rating-box {
            background: ${color};
            color: white;
            padding: 30px;
            border-radius: 10px;
            text-align: center;
            margin-bottom: 30px;
            box-shadow: 0 5px 20px rgba(0,0,0,0.15);
        }

        .rating-box h2 {
            font-size: 3em;
            margin-bottom: 10px;
        }

        .rating-box p {
            font-size: 1.2em;
        }

        .metrics-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }

        .metric-card {
            background: white;
            padding: 25px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.08);
            transition: transform 0.2s, box-shadow 0.2s;
        }

        .metric-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 5px 20px rgba(0,0,0,0.15);
        }

        .metric-card h3 {
            color: #666;
            font-size: 0.9em;
            text-transform: uppercase;
            margin-bottom: 10px;
            letter-spacing: 1px;
        }

        .metric-card .value {
            font-size: 2.5em;
            font-weight: bold;
            color: #2196F3;
        }

        .metric-card .unit {
            font-size: 0.5em;
            color: #999;
        }

        .metric-card .sub-value {
            font-size: 0.9em;
            color: #666;
            margin-top: 5px;
        }

        .section {
            background: white;
            padding: 30px;
            border-radius: 10px;
            margin-bottom: 20px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.08);
        }

        .section h2 {
            color: #333;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 2px solid #667eea;
        }

        .latency-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
        }

        .latency-table th,
        .latency-table td {
            padding: 15px;
            text-align: left;
            border-bottom: 1px solid #eee;
        }

        .latency-table th {
            background: #f8f9fa;
            font-weight: 600;
            color: #666;
        }

        .latency-table tr:hover {
            background: #f8f9fa;
        }

        .progress-bar {
            width: 100%;
            height: 30px;
            background: #e0e0e0;
            border-radius: 15px;
            overflow: hidden;
            margin: 10px 0;
        }

        .progress-fill {
            height: 100%;
            background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: bold;
            transition: width 1s ease;
        }

        .issues-list {
            list-style: none;
            margin-top: 15px;
        }

        .issues-list li {
            padding: 10px;
            background: #fff3cd;
            border-left: 4px solid #ff9800;
            margin-bottom: 10px;
            border-radius: 4px;
        }

        .footer {
            text-align: center;
            padding: 30px;
            color: #666;
            font-size: 0.9em;
        }

        @media (max-width: 768px) {
            .metrics-grid {
                grid-template-columns: 1fr;
            }

            .header h1 {
                font-size: 1.8em;
            }

            .rating-box h2 {
                font-size: 2em;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎨 FunnyPixels 压力测试报告</h1>
            <p>生成时间: ${new Date(timestamp).toLocaleString('zh-CN')}</p>
            ${testInfo.testName ? `<p>测试类型: ${testInfo.testName}</p>` : ''}
            ${testInfo.duration ? `<p>测试时长: ${(testInfo.duration / 60).toFixed(2)}分钟</p>` : ''}
        </div>

        <div class="rating-box">
            <h2>${rating}</h2>
            <p>性能评级</p>
        </div>

        ${issues.length > 0 ? `
        <div class="section">
            <h2>⚠️ 发现的问题</h2>
            <ul class="issues-list">
                ${issues.map(issue => `<li>${issue}</li>`).join('')}
            </ul>
        </div>
        ` : ''}

        <div class="section">
            <h2>📊 核心指标</h2>
            <div class="metrics-grid">
                <div class="metric-card">
                    <h3>成功率</h3>
                    <div class="value">${metrics.drawSuccessRate.toFixed(2)}<span class="unit">%</span></div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${metrics.drawSuccessRate}%">
                            ${metrics.drawSuccessRate >= 95 ? '✓' : ''}
                        </div>
                    </div>
                </div>

                <div class="metric-card">
                    <h3>平均延迟</h3>
                    <div class="value">${metrics.drawLatencyAvg.toFixed(0)}<span class="unit">ms</span></div>
                    <div class="sub-value">目标: < 300ms</div>
                </div>

                <div class="metric-card">
                    <h3>P95延迟</h3>
                    <div class="value">${metrics.drawLatencyP95.toFixed(0)}<span class="unit">ms</span></div>
                    <div class="sub-value">目标: < 500ms</div>
                </div>

                <div class="metric-card">
                    <h3>P99延迟</h3>
                    <div class="value">${metrics.drawLatencyP99.toFixed(0)}<span class="unit">ms</span></div>
                    <div class="sub-value">目标: < 1000ms</div>
                </div>

                <div class="metric-card">
                    <h3>成功绘制</h3>
                    <div class="value">${metrics.pixelDrawSuccess.toLocaleString()}</div>
                    <div class="sub-value">失败: ${metrics.pixelDrawFailure.toLocaleString()}</div>
                </div>

                <div class="metric-card">
                    <h3>HTTP请求</h3>
                    <div class="value">${metrics.httpReqs.toLocaleString()}</div>
                    <div class="sub-value">错误率: ${metrics.httpReqFailedRate.toFixed(2)}%</div>
                </div>
            </div>
        </div>

        <div class="section">
            <h2>⏱️ 延迟分布</h2>
            <table class="latency-table">
                <thead>
                    <tr>
                        <th>指标</th>
                        <th>像素绘制</th>
                        <th>HTTP请求</th>
                        <th>目标</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td><strong>P50</strong></td>
                        <td>${metrics.drawLatencyP50.toFixed(2)}ms</td>
                        <td>${metrics.httpReqDurationAvg.toFixed(2)}ms</td>
                        <td>&lt; 200ms</td>
                    </tr>
                    <tr>
                        <td><strong>P95</strong></td>
                        <td>${metrics.drawLatencyP95.toFixed(2)}ms</td>
                        <td>${metrics.httpReqDurationP95.toFixed(2)}ms</td>
                        <td>&lt; 500ms</td>
                    </tr>
                    <tr>
                        <td><strong>P99</strong></td>
                        <td>${metrics.drawLatencyP99.toFixed(2)}ms</td>
                        <td>-</td>
                        <td>&lt; 1000ms</td>
                    </tr>
                    <tr>
                        <td><strong>Max</strong></td>
                        <td>${metrics.drawLatencyMax.toFixed(2)}ms</td>
                        <td>-</td>
                        <td>&lt; 5000ms</td>
                    </tr>
                </tbody>
            </table>
        </div>

        ${metrics.wsConnections > 0 ? `
        <div class="section">
            <h2>🔌 WebSocket 统计</h2>
            <div class="metrics-grid">
                <div class="metric-card">
                    <h3>连接数</h3>
                    <div class="value">${metrics.wsConnections.toLocaleString()}</div>
                    <div class="sub-value">失败: ${metrics.wsConnectionFailures.toLocaleString()}</div>
                </div>

                <div class="metric-card">
                    <h3>消息接收</h3>
                    <div class="value">${metrics.wsMessagesReceived.toLocaleString()}</div>
                </div>
            </div>
        </div>
        ` : ''}

        <div class="section">
            <h2>❌ 错误统计</h2>
            <div class="metrics-grid">
                <div class="metric-card">
                    <h3>像素冲突</h3>
                    <div class="value">${metrics.pixelConflicts.toLocaleString()}</div>
                </div>

                <div class="metric-card">
                    <h3>认证失败</h3>
                    <div class="value">${metrics.authFailures.toLocaleString()}</div>
                </div>

                <div class="metric-card">
                    <h3>系统过载</h3>
                    <div class="value">${metrics.systemOverloadErrors.toLocaleString()}</div>
                </div>
            </div>
        </div>

        <div class="footer">
            <p>FunnyPixels Load Testing Suite v2.0 | Generated by report-generator.js</p>
            <p>For questions, contact: ops@funnypixels.com</p>
        </div>
    </div>
</body>
</html>
  `.trim();
}

// 主函数
function main() {
  console.log('📊 FunnyPixels 测试报告生成器\n');

  // 加载测试结果
  console.log(`📂 加载测试结果: ${options.input}`);
  const data = loadTestResults(options.input);

  // 提取指标
  console.log('📈 提取性能指标...');
  const metrics = extractMetrics(data);

  // 提取测试信息
  const testInfo = {
    testName: data.testName || null,
    duration: data.duration || data.state?.testRunDurationMs / 1000 || null,
    timestamp: data.timestamp || new Date().toISOString()
  };

  // 生成HTML
  console.log('🎨 生成HTML报告...');
  const html = generateHTML(data, metrics, testInfo);

  // 确定输出路径
  const outputPath = options.output ||
    options.input.replace('.json', '.html');

  // 写入文件
  fs.writeFileSync(outputPath, html);

  console.log(`✅ 报告已生成: ${outputPath}`);
  console.log(`\n📊 性能评级: ${getRating(metrics).rating}`);
  console.log(`📈 成功率: ${metrics.drawSuccessRate.toFixed(2)}%`);
  console.log(`⏱️  P95延迟: ${metrics.drawLatencyP95.toFixed(2)}ms\n`);
}

// 执行
try {
  main();
} catch (error) {
  console.error('❌ 生成报告失败:', error.message);
  console.error(error.stack);
  process.exit(1);
}
