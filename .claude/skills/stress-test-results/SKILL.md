---
name: stress-test-results
description: Analyze stress test results from k6 reports. Generates performance summary, SLO validation, bottleneck analysis, and optimization recommendations.
context: fork
agent: general-purpose
allowed-tools: Read, Glob, Grep, Bash(node *), Bash(cat *), Bash(ls *), Bash(wc *)
argument-hint: [report-file] (optional, defaults to latest summary)
---

# 压力测试结果分析

读取 k6 生成的结构化 JSON 摘要报告，进行 SLO 达标判定、性能指标分析、瓶颈定位和优化建议。

## 参数
报告文件: $ARGUMENTS（默认读取最新的 `stress-10k-mixed-summary.json`）

## 分析流程

### 第 1 步: 前置检查 — 确认环境已恢复

在分析之前，验证压测环境已恢复正常状态，避免分析过程中遗忘恢复环境。

**检查项:**

1. 读取 `backend/src/middleware/rateLimit.js`，找到 `authLimiter` 行，确认 `max` 参数为 `5`（非 `5000`）
2. 确认后端未以 cluster 模式运行（不存在 `CLUSTER_WORKERS` 环境变量或 cluster.js 进程）

```bash
# 检查是否有 cluster 模式进程
node -e "
const { execSync } = require('child_process');
try {
  const ps = execSync('ps aux', { encoding: 'utf8' });
  const clusterProcs = ps.split('\n').filter(l => l.includes('cluster.js') && !l.includes('grep'));
  if (clusterProcs.length > 0) {
    console.log('WARNING: cluster.js 进程仍在运行');
    clusterProcs.forEach(p => console.log('  ' + p.trim()));
  } else {
    console.log('OK: 未检测到 cluster 模式进程');
  }
} catch(e) { console.log('OK: 检查完成'); }
"
```

**判断标准:**
- `authLimiter` max = 5 → 已恢复
- 无 cluster.js 进程 → 已恢复

**如果未恢复:** 停止分析，提醒用户先执行 `/stress-test-restore`，然后再运行 `/stress-test-results`。

### 第 2 步: 定位报告文件

如果用户通过参数指定了报告文件路径，直接使用该文件。

否则，自动查找最新的摘要报告：

```bash
ls -lt ops/loadtest/reports/stress-10k-mixed-summary.json 2>/dev/null
```

如果摘要文件不存在，尝试查找最新的详细报告：

```bash
ls -lt ops/loadtest/reports/stress-10k-*.json 2>/dev/null | head -5
```

**读取报告文件:** 使用 Read 工具读取 JSON 文件内容。

**报告 JSON 结构:**
```json
{
  "testName": "10K Mixed Stress Test",
  "timestamp": "ISO-8601",
  "duration_seconds": number,
  "config": { "writer_max_vus", "reader_max_vus", "base_url", "smoke" },
  "write_metrics": { "success", "failure", "success_rate", "latency_avg/p50/p90/p95/p99/max", "conflicts_409", "rate_limited_429", "server_errors_5xx", "auth_errors" },
  "read_metrics": { "success", "failure", "success_rate", "latency_avg/p50/p90/p95/p99/max", "by_endpoint": { "bbox_p95", "tile_p95", "stats_p95", "hot_zones_p95" } },
  "http_global": { "total_requests", "rps", "failed_rate", "duration_avg/p95/p99" },
  "thresholds": { ... }
}
```

### 第 3 步: SLO 达标判定

逐一检查 6 项 SLO 指标，输出 PASS/FAIL 表格：

| SLO 指标 | 阈值（本地开发） | 阈值（生产目标） | 实测值 | 结果 |
|----------|-----------------|-----------------|--------|------|
| 写入延迟 P95 | < 2000ms | < 500ms | `write_metrics.latency_p95` | PASS/FAIL |
| 写入延迟 P99 | < 5000ms | < 1000ms | `write_metrics.latency_p99` | PASS/FAIL |
| 读取延迟 P95 | < 1000ms | < 300ms | `read_metrics.latency_p95` | PASS/FAIL |
| 写入成功率 | > 95% | > 99% | `write_metrics.success_rate` | PASS/FAIL |
| 读取成功率 | > 95% | > 99% | `read_metrics.success_rate` | PASS/FAIL |
| HTTP 总错误率 | < 5% | < 1% | `http_global.failed_rate` | PASS/FAIL |

**注意:** `success_rate` 和 `failed_rate` 是字符串格式（如 `"98.50%"`），需要解析为数字再判断。

### 第 4 步: 性能指标详细分析

#### 4.1 写入性能

输出写入延迟分布表格：

| 指标 | 值 |
|------|-----|
| 平均延迟 | `latency_avg` ms |
| P50 | `latency_p50` ms |
| P90 | `latency_p90` ms |
| P95 | `latency_p95` ms |
| P99 | `latency_p99` ms |
| 最大延迟 | `latency_max` ms |

分析要点：
- P95 与 P50 的倍率（> 5x 表示长尾严重）
- P99 与 P95 的差距（> 2x 表示极端延迟）
- 成功/失败总数

#### 4.2 读取性能

输出读取延迟分布表格（同上格式），以及按端点 P95 分解：

| 端点 | P95 延迟 |
|------|----------|
| BBOX (pixels/bbox) | `by_endpoint.bbox_p95` ms |
| MVT Tile | `by_endpoint.tile_p95` ms |
| Stats | `by_endpoint.stats_p95` ms |
| Hot Zones | `by_endpoint.hot_zones_p95` ms |

分析要点：
- 哪个端点 P95 最高
- 是否有端点明显慢于其他端点

#### 4.3 吞吐量与全局指标

| 指标 | 值 |
|------|-----|
| 总请求数 | `http_global.total_requests` |
| 平均 RPS | `http_global.rps` |
| 全局错误率 | `http_global.failed_rate` |
| 测试持续时间 | `duration_seconds` s |

#### 4.4 错误分类统计

| 错误类型 | 数量 | 严重性 | 说明 |
|----------|------|--------|------|
| 409 Conflict | `conflicts_409` | 正常 | 像素坐标冲突，预期行为 |
| 429 Rate Limited | `rate_limited_429` | 需关注 | 限流触发 |
| 5xx Server Error | `server_errors_5xx` | 严重 | 服务端错误 |
| Auth Error | `auth_errors` | 严重 | 认证失败 |

### 第 5 步: 瓶颈定位与优化建议

根据第 3、4 步的数据特征，自动识别可能的瓶颈并给出建议。

**规则引擎:**

1. **写入 P95 > 2000ms（SLO 未达标）**
   - 若 5xx > 0 → 可能是 DB 连接池耗尽，建议检查 `pg_stat_activity`，增大 `DB_POOL_MAX`
   - 若 429 > 0 → 限流触发，建议调整 `rateLimit.js` 中写入限流配置
   - 若 409 占比 > 30% → 坐标冲突过多，建议扩大 k6 脚本中的坐标范围
   - 若 P99/P95 > 3 → 存在极端长尾，可能是锁争用或 GC 暂停
   - 若 bgRun 队列溢出（日志中 `[bgRun] Queue full`）→ 增大 `BG_CONCURRENCY_LIMIT` 或 `BG_QUEUE_MAX`

2. **读取 P95 > 1000ms（SLO 未达标）**
   - 检查按端点 P95，找出最慢端点
   - bbox_p95 高（通常是主瓶颈）→ 检查 Redis BBOX 缓存命中率、`pixels` 表索引、响应体大小
   - tile_p95 高 → MVT 渲染瓶颈，建议检查 tile 缓存或简化渲染逻辑
   - hot_zones_p95 高 → 聚合查询慢，建议添加物化视图或缓存

3. **写入成功率 < 95%**
   - 若 auth_errors > 0 → Token 问题，检查 JWT 过期时间和 setup 阶段
   - 若 5xx > 总写入 * 5% → 服务端严重错误，检查后端日志
   - 若 409 > 总写入 * 30% → 正常冲突但过多，扩大坐标范围

4. **读取成功率 < 95%**
   - 若 5xx > 0 → 服务端错误，检查后端日志
   - 若读取端点返回非 200 → 检查路由和中间件

5. **HTTP 总错误率 > 5%**
   - 综合以上分析，找出主要错误源
   - 建议先修复严重错误（5xx > auth > 429 > 409）

6. **全部 SLO 通过**
   - 输出正面评价
   - 如果 P95 接近阈值（> 80%），提醒余量不足
   - 建议下一步：增大 VU 数量测试系统极限

### 第 6 步: 输出格式化报告

汇总以上所有分析，输出完整的结构化报告：

```
========================================
  压力测试结果分析报告
========================================

测试信息:
  测试名称: {testName}
  执行时间: {timestamp}
  持续时间: {duration_seconds}s
  配置:     Writers {writer_max_vus} VU / Readers {reader_max_vus} VU
  模式:     {smoke ? "烟测" : "正式测试"}

SLO 达标情况（本地开发标准）:
  [PASS/FAIL] 写入 P95 < 2000ms     实测: {value}ms
  [PASS/FAIL] 写入 P99 < 5000ms     实测: {value}ms
  [PASS/FAIL] 读取 P95 < 1000ms     实测: {value}ms
  [PASS/FAIL] 写入成功率 > 95%      实测: {value}
  [PASS/FAIL] 读取成功率 > 95%      实测: {value}
  [PASS/FAIL] HTTP 错误率 < 5%      实测: {value}

  总结: {X}/6 项达标

写入性能:
  成功: {success} / 失败: {failure}
  延迟分布: avg={avg}ms  P50={p50}ms  P90={p90}ms  P95={p95}ms  P99={p99}ms  max={max}ms
  错误分类: 409={conflicts}  429={rate_limited}  5xx={server_errors}  auth={auth_errors}

读取性能:
  成功: {success} / 失败: {failure}
  延迟分布: avg={avg}ms  P50={p50}ms  P90={p90}ms  P95={p95}ms  P99={p99}ms  max={max}ms
  端点 P95:  BBOX={bbox}ms  Tile={tile}ms  Stats={stats}ms  HotZones={hot_zones}ms

全局指标:
  总请求数: {total_requests}
  平均 RPS: {rps}
  全局错误率: {failed_rate}

瓶颈分析:
  {根据第 5 步的规则引擎输出}

优化建议:
  1. {建议 1}
  2. {建议 2}
  ...

下一步:
  - 如需更高负载测试: /stress-test-prepare → /stress-test-run full
  - 如需查看详细日志: ops/loadtest/reports/stress-10k-YYYYMMDD-HHMMSS.json
========================================
```

## 分析检查清单

### 前置
- [ ] 确认环境已恢复（authLimiter = 5，非 cluster 模式）
- [ ] 报告文件已找到并读取

### 分析
- [ ] 6 项 SLO 逐一判定
- [ ] 写入延迟分布已分析
- [ ] 读取延迟分布已分析
- [ ] 按端点 P95 已分解
- [ ] 错误分类已统计
- [ ] 吞吐量 RPS 已计算

### 输出
- [ ] 瓶颈已识别（如有）
- [ ] 优化建议已给出（如有）
- [ ] 格式化报告已输出

## 安全注意事项

1. **只读操作** — 此 skill 仅读取报告文件和代码，不修改任何文件或配置
2. **无数据库操作** — 不连接数据库，不执行 SQL
3. **环境安全** — 第 1 步验证环境已恢复，确保分析在安全状态下进行

---

**执行此 skill**: `/stress-test-results`
**指定报告文件**: `/stress-test-results ops/loadtest/reports/stress-10k-mixed-summary.json`
