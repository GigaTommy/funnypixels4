---
name: performance-test
description: Run performance benchmarks and load testing. Use to validate API response times, database performance, and identify bottlenecks.
allowed-tools: Bash(npm *), Bash(ab), Bash(psql *), Read
---

# 性能测试和基准测试

执行全面的性能测试，识别瓶颈并提供优化建议。

## 测试范围
测试目标: $ARGUMENTS（如未指定则测试全部）

## 性能测试流程

### 1. API 响应时间测试 (10分钟)

#### 单个请求测试
```bash
# 测试关键端点
ENDPOINTS=(
  "GET /api/share/stats"
  "POST /api/share/record-action"
  "GET /api/referral/stats"
  "GET /api/vip/subscriptions"
  "GET /api/users/profile"
)

echo "📊 API Response Time Test"
echo "========================"

for endpoint in "${ENDPOINTS[@]}"; do
  method=$(echo $endpoint | cut -d' ' -f1)
  path=$(echo $endpoint | cut -d' ' -f2)

  echo -n "$method $path: "

  if [ "$method" == "GET" ]; then
    time=$(curl -w "%{time_total}" -o /dev/null -s \
      -H "Authorization: Bearer $TOKEN" \
      http://localhost:3000$path)
  else
    time=$(curl -X POST -w "%{time_total}" -o /dev/null -s \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d '{"shareType":"session","shareTarget":"wechat"}' \
      http://localhost:3000$path)
  fi

  echo "${time}s"

  # 评估性能
  if (( $(echo "$time < 0.2" | bc -l) )); then
    echo "  ✅ EXCELLENT"
  elif (( $(echo "$time < 0.5" | bc -l) )); then
    echo "  ⚠️ ACCEPTABLE"
  else
    echo "  ❌ SLOW"
  fi
done
```

**性能目标:**
- GET 请求: < 100ms (优秀), < 200ms (可接受)
- POST 请求: < 200ms (优秀), < 500ms (可接受)
- 复杂查询: < 500ms (优秀), < 1000ms (可接受)

#### 并发测试（使用 Apache Bench）
```bash
# 安装 ab (如未安装)
# macOS: brew install apache2
# Ubuntu: apt-get install apache2-utils

echo "🔥 Concurrent Request Test"
echo "=========================="

# 测试不同并发级别
for concurrent in 10 50 100; do
  echo "Testing with $concurrent concurrent users..."

  ab -n 1000 -c $concurrent \
    -H "Authorization: Bearer $TOKEN" \
    http://localhost:3000/api/share/stats \
    > ab_results_${concurrent}.txt

  # 提取关键指标
  echo "Results for $concurrent users:"
  grep "Requests per second" ab_results_${concurrent}.txt
  grep "Time per request" ab_results_${concurrent}.txt
  grep "Failed requests" ab_results_${concurrent}.txt
  echo ""
done
```

**并发性能目标:**
- 吞吐量: > 100 req/s
- 失败率: < 1%
- 99% 响应时间: < 500ms

### 2. 数据库性能测试 (15分钟)

#### 查询性能分析
```sql
-- 启用查询统计
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- 清空统计
SELECT pg_stat_statements_reset();

-- 运行负载测试...（使用上面的 ab 测试）

-- 分析慢查询
SELECT
  query,
  calls,
  total_exec_time,
  mean_exec_time,
  max_exec_time,
  stddev_exec_time,
  rows
FROM pg_stat_statements
WHERE mean_exec_time > 100  -- 超过 100ms 的查询
ORDER BY mean_exec_time DESC
LIMIT 20;
```

#### 索引效率分析
```sql
-- 未使用的索引
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch,
  pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_stat_user_indexes
WHERE idx_scan = 0
  AND indexrelname NOT LIKE '%pkey'  -- 排除主键
ORDER BY pg_relation_size(indexrelid) DESC;

-- 表扫描统计
SELECT
  schemaname,
  tablename,
  seq_scan,
  seq_tup_read,
  idx_scan,
  idx_tup_fetch,
  seq_tup_read / NULLIF(seq_scan, 0) as avg_seq_read
FROM pg_stat_user_tables
WHERE seq_scan > 0
ORDER BY seq_scan DESC
LIMIT 20;

-- 表膨胀检查
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size,
  pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) as table_size,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) as indexes_size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
LIMIT 20;
```

#### 连接池性能
```sql
-- 查看当前连接
SELECT
  count(*) as total_connections,
  count(*) FILTER (WHERE state = 'active') as active,
  count(*) FILTER (WHERE state = 'idle') as idle,
  count(*) FILTER (WHERE state = 'idle in transaction') as idle_in_transaction
FROM pg_stat_activity
WHERE datname = 'funnypixels_db';

-- 长时间运行的查询
SELECT
  pid,
  now() - query_start as duration,
  state,
  query
FROM pg_stat_activity
WHERE state != 'idle'
  AND now() - query_start > interval '5 seconds'
ORDER BY duration DESC;
```

**数据库性能目标:**
- 平均查询时间: < 50ms
- 无超过 1s 的查询
- 索引命中率: > 99%
- 连接使用率: < 80%

### 3. 内存和 CPU 分析 (10分钟)

#### Node.js 应用内存分析
```bash
# 启动服务并记录进程 ID
npm start &
APP_PID=$!

# 监控内存使用
echo "📈 Memory Usage Monitoring"
for i in {1..10}; do
  echo -n "Sample $i: "
  ps -p $APP_PID -o rss= | awk '{printf "%.2f MB\n", $1/1024}'
  sleep 10
done

# 检查内存泄漏（使用 heapdump）
node --inspect backend/server.js &
# 使用 Chrome DevTools 连接并捕获 heap snapshot

# 停止服务
kill $APP_PID
```

#### CPU 使用分析
```bash
# CPU 分析（使用 clinic）
npm install -g clinic

# 运行性能分析
clinic doctor -- node backend/server.js &
CLINIC_PID=$!

# 运行负载测试
ab -n 1000 -c 50 http://localhost:3000/api/share/stats

# 停止并生成报告
kill -SIGINT $CLINIC_PID

# 查看报告
# clinic doctor --open
```

**资源使用目标:**
- 内存使用: < 500MB (空闲), < 1GB (负载)
- 内存增长: < 10MB/hour (无泄漏)
- CPU 使用: < 50% (正常负载)
- 事件循环延迟: < 10ms

### 4. iOS 应用性能测试 (15分钟)

#### 启动时间测试
```bash
# 使用 Instruments 测试
xcrun xctrace record \
  --template 'Time Profiler' \
  --device 'iPhone 15' \
  --launch FunnyPixels \
  --output app_launch.trace

# 分析启动时间
xcrun xctrace export \
  --input app_launch.trace \
  --xpath '/trace-toc/run[@number="1"]/data/table[@schema="time-profile"]'
```

#### 滚动性能测试
```swift
// 在 XCTest 中测试滚动性能
func testScrollPerformance() {
  let app = XCUIApplication()
  app.launch()

  let table = app.tables.firstMatch

  measure(metrics: [XCTOSSignpostMetric.scrollDecelerationMetric]) {
    table.swipeUp(velocity: .fast)
  }
}
```

#### 内存泄漏检测
```bash
# 使用 Instruments Leaks
xcrun xctrace record \
  --template 'Leaks' \
  --device 'iPhone 15' \
  --attach FunnyPixels \
  --time-limit 60s \
  --output memory_leaks.trace

# 分析泄漏
xcrun xctrace export \
  --input memory_leaks.trace \
  --xpath '/trace-toc/run[@number="1"]/data/table[@schema="leaks"]'
```

**iOS 性能目标:**
- 冷启动: < 2s
- 热启动: < 500ms
- 页面切换: < 100ms
- 滚动帧率: 60fps
- 内存占用: < 200MB
- 无内存泄漏

### 5. 网络性能测试 (5分钟)

#### 不同网络条件测试
```bash
# 使用 Network Link Conditioner (macOS)
# 或使用 tc (Linux)

# 模拟慢速网络
# 3G: 780kbps down, 330kbps up, 100ms latency
# 4G: 9Mbps down, 9Mbps up, 85ms latency

# 测试在不同网络条件下的表现
for network in "wifi" "4g" "3g"; do
  echo "Testing with $network network..."
  # 切换网络条件
  # 运行 API 测试
  curl -w "@curl-format.txt" \
    -H "Authorization: Bearer $TOKEN" \
    http://api.funnypixels.com/api/share/stats
done
```

**网络性能目标:**
- WiFi: < 100ms
- 4G: < 500ms
- 3G: < 2s
- 失败重试机制: ✓
- 离线缓存: ✓

### 6. 性能报告生成

```markdown
# 性能测试报告
日期：$(date)

## 执行摘要
- 测试环境：Production-like
- 测试时长：60分钟
- 负载级别：1000 concurrent users
- 总体评分：✅ PASSED

## API 性能

| 端点 | 平均响应 | P95 | P99 | 目标 | 状态 |
|------|---------|-----|-----|------|------|
| GET /api/share/stats | 85ms | 120ms | 180ms | <200ms | ✅ |
| POST /api/share/record-action | 145ms | 200ms | 280ms | <500ms | ✅ |
| GET /api/referral/stats | 92ms | 130ms | 190ms | <200ms | ✅ |

## 数据库性能

| 指标 | 当前值 | 目标 | 状态 |
|------|--------|------|------|
| 平均查询时间 | 35ms | <50ms | ✅ |
| 最慢查询 | 280ms | <1s | ✅ |
| 索引命中率 | 99.2% | >99% | ✅ |
| 连接池使用 | 65% | <80% | ✅ |

## 资源使用

| 资源 | 空闲 | 负载 | 峰值 | 目标 | 状态 |
|------|------|------|------|------|------|
| 内存 | 280MB | 650MB | 820MB | <1GB | ✅ |
| CPU | 5% | 45% | 78% | <80% | ✅ |

## 发现的问题

1. **慢查询**: `SELECT * FROM share_tracking WHERE user_id = ?`
   - 原因：缺少索引
   - 影响：中等
   - 建议：添加 user_id 索引

2. **内存增长**: 长时间运行后内存增长 15%
   - 原因：可能的小内存泄漏
   - 影响：低
   - 建议：进一步分析 heap snapshot

## 优化建议

### 高优先级
1. 添加 `share_tracking.user_id` 索引
2. 优化 `/api/referral/stats` 查询（使用缓存）

### 中优先级
3. 启用 API 响应压缩（gzip）
4. 实现 CDN 缓存策略

### 低优先级
5. 升级 Node.js 到最新 LTS
6. 优化图片加载策略

## 结论
系统性能满足生产要求，建议实施高优先级优化后部署。
```

## 性能优化建议生成器

根据测试结果自动生成优化建议：

```javascript
function generateOptimizations(testResults) {
  const optimizations = [];

  // API 响应时间优化
  if (testResults.api.avgResponseTime > 200) {
    optimizations.push({
      priority: 'HIGH',
      category: 'API',
      issue: '平均响应时间过长',
      suggestions: [
        '实现 Redis 缓存',
        '优化数据库查询',
        '启用 HTTP/2',
        '添加 CDN'
      ]
    });
  }

  // 数据库优化
  if (testResults.db.slowQueries.length > 0) {
    optimizations.push({
      priority: 'HIGH',
      category: 'Database',
      issue: '存在慢查询',
      suggestions: testResults.db.slowQueries.map(q =>
        `优化查询: ${q.query.substring(0, 50)}...`
      )
    });
  }

  // 内存优化
  if (testResults.memory.growth > 10) {
    optimizations.push({
      priority: 'MEDIUM',
      category: 'Memory',
      issue: '内存持续增长',
      suggestions: [
        '检查事件监听器泄漏',
        '使用 heapdump 分析',
        '实现对象池'
      ]
    });
  }

  return optimizations;
}
```

## 成功标准

### ✅ 性能达标
- API 响应时间达标
- 数据库性能良好
- 资源使用合理
- 无明显性能瓶颈

### ⚠️ 需要优化
- 部分指标略低于目标
- 存在可优化空间
- 建议实施优化后再部署

### ❌ 性能不足
- 多项指标不达标
- 存在严重性能问题
- 必须优化后才能部署

---

**执行此 skill**: `/performance-test`
**只测试 API**: `/performance-test api`
**只测试数据库**: `/performance-test database`
