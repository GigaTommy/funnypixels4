# FunnyPixels 生产级压力测试指南

本指南提供完整的生产环境压力测试方案，涵盖测试策略、执行步骤、监控分析和问题诊断。

## 目录

- [测试概览](#测试概览)
- [测试矩阵](#测试矩阵)
- [测试执行](#测试执行)
- [性能目标SLO](#性能目标slo)
- [监控和告警](#监控和告警)
- [问题诊断](#问题诊断)
- [最佳实践](#最佳实践)

---

## 测试概览

### 测试目标

1. **性能验证**: 确保系统满足性能SLO
2. **容量规划**: 确定系统最大承载能力
3. **稳定性验证**: 验证长时间运行的稳定性
4. **故障恢复**: 测试系统在异常情况下的表现

### 测试工具栈

- **K6**: 核心负载测试工具
- **Artillery**: 场景编排测试
- **Custom Simulators**: 真实用户行为模拟
- **Prometheus + Grafana**: 监控和可视化
- **ELK Stack**: 日志聚合和分析

---

## 测试矩阵

### 1. 渐进式压力测试 (Gradual Ramp-Up)

**目的**: 平滑增压，观察系统在不同负载下的表现

```bash
# 运行渐进式测试: 0 → 5000用户, 30分钟
k6 run --out json=reports/gradual-$(date +%Y%m%d-%H%M%S).json \
  k6/advanced/gradual-ramp-up.js
```

**关键观察点**:
- CPU、内存使用率随负载的变化
- 响应时间是否线性增长
- 数据库连接池使用情况
- 缓存命中率变化

**成功标准**:
- 成功率 > 95%
- P95延迟 < 500ms
- P99延迟 < 1000ms
- 资源使用 < 80%

### 2. 尖峰流量测试 (Spike Test)

**目的**: 测试系统应对突发流量的能力

```bash
# 运行尖峰测试: 100用户 → 500用户瞬间冲击
k6 run --env BASELINE_VUS=100 --env SPIKE_MULTIPLIER=5 \
  k6/advanced/spike-test.js
```

**关键观察点**:
- 自动扩容响应时间
- 请求队列积压情况
- 限流和熔断机制
- 错误率峰值

**成功标准**:
- 尖峰期间成功率 > 90%
- P95延迟 < 2秒
- 系统无崩溃
- 恢复时间 < 2分钟

### 3. 耐久性测试 (Soak Test)

**目的**: 检测内存泄漏和长期性能衰退

```bash
# 运行耐久测试: 1000用户, 4小时
k6 run --env TARGET_VUS=1000 --env SOAK_DURATION=4 \
  k6/advanced/soak-test.js
```

**关键观察点**:
- 内存使用是否持续增长
- 响应时间是否逐渐增加
- 连接泄漏
- 磁盘空间消耗

**成功标准**:
- 成功率 > 98%
- 性能衰退 < 30%
- 无内存泄漏迹象
- 资源使用稳定

### 4. 压力极限测试 (Stress Test)

**目的**: 找到系统崩溃点

```bash
# 运行压力测试: 持续增压直至崩溃
k6 run --env MAX_VUS=10000 --env STEP_DURATION=3 \
  k6/advanced/stress-test.js
```

**关键观察点**:
- 系统开始降级的负载点
- 故障模式（优雅降级 vs 崩溃）
- 恢复能力
- 瓶颈识别

**成功标准**:
- 明确的崩溃点
- 优雅降级机制生效
- 快速恢复能力
- 清晰的瓶颈诊断

### 5. 容量规划测试 (Capacity Planning)

**目的**: 为扩容决策提供数据

```bash
# 运行容量规划测试: 阶梯式增压
k6 run k6/advanced/capacity-planning.js
```

**输出数据**:
- 不同负载下的资源消耗
- 成本-性能曲线
- 扩容建议
- SLO达成率

### 6. 真实用户旅程测试 (Realistic User Journey)

**目的**: 模拟真实用户行为

```bash
# 运行真实用户测试: 100用户, 10分钟
k6 run --vus 100 --duration 10m \
  k6/advanced/realistic-user-journey.js
```

**用户类型**:
- 休闲用户 (60%): 偶尔绘制
- 活跃用户 (30%): 频繁绘制
- 艺术家 (10%): 大型作品创作

### 7. WebSocket专项测试

#### 连接数极限测试

```bash
# 测试10000+并发WebSocket连接
k6 run --vus 10000 --duration 10m \
  k6/websocket/ws-connection-limit.js
```

#### 广播延迟测试

```bash
# 测试100房间、1000用户的消息广播延迟
k6 run --vus 1000 --duration 10m \
  --env ROOM_COUNT=100 \
  k6/websocket/ws-broadcast-latency.js
```

**成功标准**:
- 连接成功率 > 99%
- 广播延迟 P95 < 200ms
- 心跳响应 < 50ms

---

## 性能目标 (SLO)

### 核心业务指标

| 指标 | P50 | P95 | P99 | 目标 |
|------|-----|-----|-----|------|
| 像素绘制延迟 | < 200ms | < 500ms | < 1000ms | ✓ |
| 地图瓦片加载 | < 100ms | < 300ms | < 600ms | ✓ |
| WebSocket连接建立 | < 500ms | < 1000ms | < 2000ms | ✓ |
| WebSocket消息延迟 | < 50ms | < 100ms | < 200ms | ✓ |
| 批量绘制 (10像素) | < 500ms | < 1000ms | < 2000ms | ✓ |

### 可用性目标

- **整体可用性**: > 99.9% (年停机 < 8.76小时)
- **成功率**: > 95% (正常) / > 90% (尖峰)
- **错误率**: < 1% (HTTP 5xx)

### 吞吐量目标

- **像素绘制**: > 1000 req/s
- **地图瓦片**: > 5000 req/s
- **WebSocket消息**: > 10000 msg/s

---

## 测试执行流程

### 准备阶段

#### 1. 环境准备

```bash
# 1.1 清理旧数据
cd ops/loadtest
npm run cleanup:confirm

# 1.2 生成测试用户
npm run generate:users -- --count 10000

# 1.3 验证服务健康
curl http://localhost:3001/health

# 1.4 启动监控
docker-compose -f monitoring/docker-compose.yml up -d
```

#### 2. 基线测试

```bash
# 运行单用户基线测试
k6 run --vus 1 --duration 5m k6/canvas-draw-load.js
```

记录基线性能指标，用于后续对比。

### 执行阶段

#### 完整测试套件执行

```bash
#!/bin/bash
# run-full-test-suite.sh

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
REPORT_DIR="reports/full-suite-${TIMESTAMP}"
mkdir -p ${REPORT_DIR}

echo "🚀 开始完整测试套件 - ${TIMESTAMP}"

# 1. 渐进式测试
echo "📈 运行渐进式测试..."
k6 run --out json=${REPORT_DIR}/gradual.json \
  k6/advanced/gradual-ramp-up.js

sleep 120  # 冷却2分钟

# 2. 尖峰测试
echo "⚡ 运行尖峰测试..."
k6 run --out json=${REPORT_DIR}/spike.json \
  k6/advanced/spike-test.js

sleep 120

# 3. 真实用户测试
echo "👥 运行真实用户测试..."
k6 run --vus 100 --duration 10m \
  --out json=${REPORT_DIR}/realistic.json \
  k6/advanced/realistic-user-journey.js

sleep 120

# 4. WebSocket测试
echo "🔌 运行WebSocket测试..."
k6 run --vus 1000 --duration 10m \
  --out json=${REPORT_DIR}/websocket.json \
  k6/websocket/ws-connection-limit.js

# 5. 生成汇总报告
echo "📊 生成测试报告..."
node reporting/report-generator.js \
  --input ${REPORT_DIR} \
  --output ${REPORT_DIR}/summary.html

echo "✅ 测试套件完成！报告: ${REPORT_DIR}/summary.html"
```

### 分析阶段

#### 1. 查看实时监控

访问 Grafana Dashboard:
```
http://localhost:3000/d/funnypixels-load-test
```

#### 2. 分析测试报告

```bash
# 生成详细报告
node reporting/performance-analyzer.js \
  --input reports/gradual-*.json \
  --output reports/analysis.html

# 检测瓶颈
node reporting/bottleneck-detector.js \
  --input reports/gradual-*.json
```

#### 3. 对比历史数据

```bash
# 对比两次测试结果
node reporting/comparison-tool.js \
  --baseline reports/baseline-*.json \
  --current reports/gradual-*.json
```

---

## 监控和告警

### 关键监控指标

#### 应用层指标

```promql
# 请求成功率
sum(rate(http_requests_total{status=~"2.."}[5m]))
/
sum(rate(http_requests_total[5m]))

# P95延迟
histogram_quantile(0.95,
  sum(rate(http_request_duration_seconds_bucket[5m])) by (le)
)

# 错误率
sum(rate(http_requests_total{status=~"5.."}[5m]))
/
sum(rate(http_requests_total[5m]))
```

#### 系统层指标

```promql
# CPU使用率
100 - (avg(irate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)

# 内存使用率
(node_memory_MemTotal_bytes - node_memory_MemAvailable_bytes)
/
node_memory_MemTotal_bytes * 100

# 磁盘IO
rate(node_disk_io_time_seconds_total[5m])
```

#### 数据库指标

```promql
# 连接池使用率
pg_stat_activity_count / pg_settings_max_connections * 100

# 慢查询数量
rate(pg_stat_database_queries_slow[5m])

# 死锁数量
rate(pg_stat_database_deadlocks[5m])
```

### 告警规则

创建文件 `monitoring/alerts/load-test-alerts.yml`:

```yaml
groups:
  - name: load_test_alerts
    interval: 15s
    rules:
      - alert: HighErrorRate
        expr: |
          sum(rate(http_requests_total{status=~"5.."}[5m]))
          /
          sum(rate(http_requests_total[5m])) > 0.05
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "HTTP错误率过高 (> 5%)"

      - alert: HighLatency
        expr: |
          histogram_quantile(0.95,
            sum(rate(http_request_duration_seconds_bucket[5m])) by (le)
          ) > 1
        for: 3m
        labels:
          severity: warning
        annotations:
          summary: "P95延迟过高 (> 1秒)"

      - alert: LowSuccessRate
        expr: |
          funnypixels:pixel_draw_success:rate5m < 0.95
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "像素绘制成功率低于95%"

      - alert: WebSocketConnectionFailure
        expr: |
          rate(ws_connection_failures[5m]) > 10
        for: 1m
        labels:
          severity: warning
        annotations:
          summary: "WebSocket连接失败率过高"
```

---

## 问题诊断

### 常见问题和解决方案

#### 1. 数据库连接池耗尽

**症状**:
```
Error: Pool timeout - unable to get connection
```

**诊断**:
```sql
-- 查看当前连接数
SELECT count(*) FROM pg_stat_activity;

-- 查看最大连接数
SHOW max_connections;

-- 查看等待锁的查询
SELECT * FROM pg_stat_activity WHERE wait_event_type = 'Lock';
```

**解决方案**:
```bash
# 临时增加连接池大小
export DB_POOL_MAX=200

# 优化慢查询
# 添加索引
# 使用连接复用
```

#### 2. Redis内存不足

**症状**:
```
Error: OOM command not allowed when used memory > 'maxmemory'
```

**诊断**:
```bash
redis-cli INFO memory
redis-cli MEMORY STATS
```

**解决方案**:
```bash
# 增加Redis内存
redis-cli CONFIG SET maxmemory 4gb

# 调整淘汰策略
redis-cli CONFIG SET maxmemory-policy allkeys-lru

# 清理过期键
redis-cli --scan --pattern "expired:*" | xargs redis-cli DEL
```

#### 3. WebSocket连接失败

**症状**:
```
Error: WebSocket connection failed
```

**诊断**:
```bash
# 检查系统文件描述符限制
ulimit -n

# 检查活跃连接数
netstat -an | grep ESTABLISHED | wc -l

# 检查WebSocket服务状态
curl -i -N \
  -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  http://localhost:3001/ws/tile-updates
```

**解决方案**:
```bash
# 增加文件描述符限制
ulimit -n 65536

# 配置Nginx WebSocket代理
# nginx.conf
location /ws/ {
    proxy_pass http://backend;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 86400;
}
```

#### 4. 内存泄漏

**症状**:
- 内存使用持续增长
- 性能逐渐衰退
- 最终OOM

**诊断**:
```bash
# 生成堆快照
node --heapsnapshot-signal=SIGUSR2 server.js

# 发送信号生成快照
kill -USR2 <pid>

# 使用Chrome DevTools分析
# 或使用 clinic.js
npx clinic doctor -- node server.js
```

**解决方案**:
- 检查事件监听器泄漏
- 检查全局变量
- 检查闭包引用
- 使用WeakMap/WeakSet
- 定期重启进程

---

## 最佳实践

### 1. 测试环境隔离

- 使用独立的测试环境
- 不要在生产环境直接测试
- 模拟真实的网络拓扑
- 使用生产级别的数据规模

### 2. 渐进式测试

```bash
# 从小规模开始
k6 run --vus 10 --duration 1m test.js

# 逐步增加
k6 run --vus 50 --duration 5m test.js
k6 run --vus 100 --duration 10m test.js
k6 run --vus 500 --duration 10m test.js
```

### 3. 监控先行

- 测试前启动监控
- 设置告警
- 准备日志收集
- 配置链路追踪

### 4. 结果记录

```bash
# 每次测试保存完整结果
k6 run --out json=reports/test-$(date +%Y%m%d-%H%M%S).json test.js

# 记录环境信息
cat > reports/env-info.txt <<EOF
Date: $(date)
Server: $(hostname)
CPU: $(nproc)
Memory: $(free -h | grep Mem | awk '{print $2}')
OS: $(uname -a)
Node: $(node --version)
EOF
```

### 5. 性能基线

建立性能基线并定期对比:

```json
{
  "baseline": {
    "date": "2026-02-25",
    "success_rate": 99.2,
    "p95_latency": 285,
    "p99_latency": 456,
    "max_vus": 1000
  }
}
```

### 6. 自动化测试

集成到CI/CD流程:

```yaml
# .github/workflows/load-test.yml
name: Weekly Load Test
on:
  schedule:
    - cron: '0 2 * * 0'  # 每周日凌晨2点

jobs:
  load-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run Load Test
        run: |
          cd ops/loadtest
          npm install
          k6 run --vus 100 --duration 10m k6/advanced/gradual-ramp-up.js
      - name: Upload Report
        uses: actions/upload-artifact@v3
        with:
          name: load-test-report
          path: ops/loadtest/reports/
```

---

## 附录

### A. 测试清单

测试前检查清单:

- [ ] 测试环境准备完成
- [ ] 测试数据已生成
- [ ] 监控系统已启动
- [ ] 告警规则已配置
- [ ] 日志收集已启用
- [ ] 备份已完成
- [ ] 团队已通知
- [ ] 回滚方案已准备

### B. 紧急响应

如果测试导致生产问题:

1. 立即停止测试: `Ctrl+C`
2. 检查系统状态
3. 执行回滚
4. 分析根因
5. 记录事故报告

### C. 参考资源

- [K6官方文档](https://k6.io/docs/)
- [Prometheus查询语法](https://prometheus.io/docs/prometheus/latest/querying/basics/)
- [Grafana Dashboard设计](https://grafana.com/docs/grafana/latest/dashboards/)
- [性能测试最佳实践](https://www.performancetestingtips.com/)

---

**文档版本**: v1.0
**更新日期**: 2026-02-25
**维护团队**: FunnyPixels DevOps
