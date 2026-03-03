# 数据库连接池配置指南

## 📊 性能优化背景

根据代码审查发现，原有生产环境连接池配置（max: 25）对于高并发场景（2000 req/min）可能不足，可能导致：
- 连接池耗尽，请求超时
- 响应时间增加
- 高峰时段服务降级

## 🎯 推荐配置

### 生产环境（高并发）
```bash
# .env.production
DB_POOL_MIN=10
DB_POOL_MAX=75

# 超时配置（可选）
DB_ACQUIRE_TIMEOUT=5000    # 获取连接超时 5秒
DB_CREATE_TIMEOUT=3000     # 创建连接超时 3秒
DB_IDLE_TIMEOUT=30000      # 空闲连接回收 30秒
```

### 开发环境
```bash
# .env.development
DB_POOL_MIN=2
DB_POOL_MAX=10
```

### 测试环境
```bash
# .env.test
DB_POOL_MIN=2
DB_POOL_MAX=5
```

## 📐 连接池大小计算方法

### 公式
```
最大连接数 = (并发请求数 × 平均查询时间) + 缓冲
```

### 示例计算
假设：
- QPS (每秒请求数) = 2000 req/min ÷ 60 = 33.3 req/s
- 平均查询时间 = 500ms - 1s
- 需要的最小连接数 = 33.3 × 0.5 = 16.65 (平均场景)
- 需要的最大连接数 = 33.3 × 1 = 33.3 (慢查询场景)
- 建议连接池大小 = 33.3 × 2 + 10 (缓冲) ≈ **75**

### 不同场景推荐值

| 场景 | QPS | 平均查询时间 | 推荐 max | 推荐 min |
|------|-----|--------------|----------|----------|
| 低负载 | < 10 | 100-300ms | 10-20 | 2 |
| 中等负载 | 10-50 | 300-500ms | 30-50 | 5 |
| 高负载 | 50-100 | 500-1000ms | 75-100 | 10 |
| 极高负载 | > 100 | 500-1000ms | 100-200 | 20 |

## ⚙️ 配置说明

### pool.min
- **含义**: 连接池保持的最小活跃连接数
- **影响**:
  - 过小：启动时需要频繁创建连接
  - 过大：浪费数据库资源
- **推荐**: 10-20 (生产环境)

### pool.max
- **含义**: 连接池允许的最大连接数
- **影响**:
  - 过小：高并发时连接池耗尽，请求排队或超时
  - 过大：数据库负载过高，可能触发max_connections限制
- **推荐**: 75-100 (生产环境)
- **注意**: 必须小于数据库的 `max_connections` 设置

### acquireTimeoutMillis
- **含义**: 从连接池获取连接的最大等待时间
- **影响**:
  - 过小：并发高峰时大量请求超时失败
  - 过大：请求挂起时间过长，影响用户体验
- **推荐**: 5000ms (5秒)

### createTimeoutMillis
- **含义**: 创建新数据库连接的超时时间
- **影响**:
  - 过小：数据库响应慢时无法建立连接
  - 过大：连接失败时等待过久
- **推荐**: 3000ms (3秒)

### idleTimeoutMillis
- **含义**: 空闲连接在连接池中保留的时间
- **影响**:
  - 过小：频繁回收和创建连接，增加开销
  - 过大：长时间保持无用连接，浪费资源
- **推荐**: 30000ms (30秒)

## 🔍 监控指标

### 关键监控项

1. **连接池使用率**
   ```javascript
   const pool = db.client.pool;
   const usage = (pool.numUsed() / pool.max) * 100;
   ```
   - ⚠️ 警告阈值: > 70%
   - 🚨 危险阈值: > 90%

2. **等待队列长度**
   ```javascript
   const pending = pool.numPendingAcquires();
   ```
   - ⚠️ 警告阈值: > 10
   - 🚨 危险阈值: > 50

3. **平均获取时间**
   - 正常: < 10ms
   - ⚠️ 警告: > 100ms
   - 🚨 危险: > 1000ms

### Prometheus 指标示例
```javascript
// backend/src/monitoring/prometheusMetrics.js
const poolMetrics = new promClient.Gauge({
  name: 'db_pool_connections',
  help: 'Database connection pool status',
  labelNames: ['state']
});

// 定期更新
setInterval(() => {
  const pool = db.client.pool;
  poolMetrics.set({ state: 'used' }, pool.numUsed());
  poolMetrics.set({ state: 'free' }, pool.numFree());
  poolMetrics.set({ state: 'pending' }, pool.numPendingAcquires());
}, 10000);
```

## 🛠️ 故障排查

### 问题1: 连接池耗尽
**症状**:
```
Error: Knex: Timeout acquiring a connection. The pool is probably full.
```

**解决方案**:
1. 增加 `pool.max` 值
2. 减少 `acquireTimeoutMillis`（快速失败，避免堆积）
3. 优化查询，减少查询时间
4. 检查是否有连接泄漏（未释放）

### 问题2: 创建连接超时
**症状**:
```
Error: Connection timeout
```

**解决方案**:
1. 检查数据库服务器状态
2. 增加 `createTimeoutMillis`
3. 检查网络连接
4. 验证数据库 `max_connections` 未达上限

### 问题3: 连接泄漏
**症状**:
- 连接池逐渐耗尽，重启后恢复
- `pool.numUsed()` 持续增长

**排查方法**:
```javascript
// 检查未关闭的事务
SELECT * FROM pg_stat_activity
WHERE state = 'idle in transaction'
AND state_change < NOW() - INTERVAL '5 minutes';
```

**解决方案**:
1. 确保所有查询使用 `try/finally` 释放连接
2. 使用事务时必须 `commit()` 或 `rollback()`
3. 启用连接池调试日志

## 📈 性能测试

### 压力测试脚本
```bash
# 使用 ab (Apache Bench)
ab -n 10000 -c 100 http://localhost:3000/api/leaderboard/personal

# 使用 wrk
wrk -t4 -c100 -d30s http://localhost:3000/api/leaderboard/personal
```

### 预期结果
- **优化前** (max: 25):
  - QPS: ~30-40
  - P95 延迟: ~500ms
  - 错误率: 5-10% (高并发时)

- **优化后** (max: 75):
  - QPS: ~80-100
  - P95 延迟: ~200ms
  - 错误率: < 1%

## 🔗 相关文档

- [Knex.js Pool Configuration](https://knexjs.org/guide/#pool)
- [PostgreSQL Connection Pooling Best Practices](https://www.postgresql.org/docs/current/runtime-config-connection.html)
- [Node.js Database Performance Tuning](https://nodejs.org/en/docs/guides/database-performance-tuning/)

## 📝 变更历史

### 2026-02-22
- ✅ 提高生产环境连接池大小: max 25 → 75
- ✅ 调整最小连接数: min 5 → 10
- ✅ 添加超时配置支持
- ✅ 创建配置文档

---

**注意**: 调整连接池配置后，建议进行压力测试验证效果，并监控数据库性能指标。
