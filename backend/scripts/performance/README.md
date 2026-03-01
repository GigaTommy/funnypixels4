# MVT性能评估工具集

## 📋 概述

在进行任何优化之前，使用这些工具进行完整的性能评估，获取真实的性能基线数据。

## 🚀 快速开始

### 1. 完整性能测试（推荐首先运行）

```bash
cd /Users/ginochow/code/funnypixels3/backend
node scripts/performance/mvt-performance-test.js
```

**测试内容：**
- ✅ 数据库索引状态检查
- ✅ SQL执行计划分析
- ✅ 不同地点性能测试（广州/北京/荒野）
- ✅ 不同Zoom级别性能测试（12/14/16/18）
- ✅ 缓存性能测试（冷/热缓存对比）
- ✅ 并发性能测试（1/10/50/100并发）

**预计耗时：** 5-8分钟

**输出：**
- 控制台显示实时测试进度和结果
- JSON报告文件：`mvt-performance-report-[timestamp].json`

### 2. SQL冗余分析

```bash
cd /Users/ginochow/code/funnypixels3/backend
node scripts/performance/analyze-sql-redundancy.js
```

**测试内容：**
- ✅ 当前SQL vs 优化SQL性能对比
- ✅ JOIN操作次数分析
- ✅ 数据库Buffer使用分析
- ✅ 预估优化收益

**预计耗时：** 2-3分钟

**输出：**
- 控制台显示详细对比结果
- JSON报告文件：`sql-redundancy-report-[timestamp].json`

## 📊 关键指标解读

### 响应时间指标
- **P50 (中位数)**: 50%的请求响应时间
- **P95**: 95%的请求响应时间（重要性能指标）
- **P99**: 99%的请求响应时间（极端情况）

**目标值：**
- ✅ 优秀: P95 < 100ms
- ⚠️ 可接受: P95 < 200ms
- ❌ 需优化: P95 > 200ms

### 缓存命中率
- **Memory Hit**: 内存缓存命中率
- **Redis Hit**: Redis缓存命中率
- **DB Query**: 数据库查询率

**目标值：**
- ✅ 优秀: Memory Hit > 50%, Redis Hit > 30%
- ⚠️ 可接受: Memory Hit > 30%, Redis Hit > 20%
- ❌ 需优化: Memory Hit < 30%

### 并发性能
- **吞吐量 (Throughput)**: 每秒处理的请求数
- **成功率**: 成功响应的请求比例

**目标值（100并发）：**
- ✅ 优秀: 吞吐量 > 500 req/s, P95 < 150ms
- ⚠️ 可接受: 吞吐量 > 200 req/s, P95 < 250ms
- ❌ 需优化: 吞吐量 < 200 req/s

## 🔍 问题诊断流程

### 如果P95 > 200ms

1. **检查索引状态**
   ```bash
   # 查看测试报告中的【索引状态】部分
   # 关键索引必须存在：
   - idx_pixels_geom_quantized (空间索引)
   - idx_pixels_grid_id (查询索引)
   ```

2. **检查SQL执行计划**
   ```bash
   # 查看测试报告中的【SQL性能】部分
   # 确认：
   - 使用索引: ✅ 必须为是
   - 执行时间: 应 < 150ms
   ```

3. **检查像素密度**
   ```bash
   # 如果测试tile像素数 > 50000
   # 考虑：
   - 增加采样率
   - 优化空间查询
   - 增加缓存TTL
   ```

### 如果缓存命中率低

1. **检查缓存配置**
   ```javascript
   // backend/src/services/productionMVTService.js
   const rawCache = new LRUCache({
     max: 500,        // 增加到1000?
     maxSize: 50 * 1024 * 1024  // 增加到100MB?
   });
   ```

2. **检查Redis连接**
   ```bash
   # 确认Redis可用
   redis-cli ping
   # 应返回 PONG
   ```

3. **分析缓存失效模式**
   ```bash
   # 查看测试报告中的【缓存效果】
   # 如果加速比 < 5x，说明缓存效果不佳
   ```

### 如果并发性能差

1. **检查数据库连接池**
   ```javascript
   // backend/src/config/database.js
   pool: {
     min: 2,
     max: 20  // 增加到50?
   }
   ```

2. **检查PostgreSQL配置**
   ```sql
   -- 查看当前连接数
   SELECT count(*) FROM pg_stat_activity;

   -- 查看最大连接数
   SHOW max_connections;
   ```

3. **检查CPU/内存使用**
   ```bash
   # 运行测试时监控系统资源
   top -pid $(pgrep postgres)
   ```

## 📈 性能优化决策树

```
开始评估
   |
   v
运行 mvt-performance-test.js
   |
   v
P95 < 150ms? ────YES──> 缓存命中率 > 80%? ────YES──> ✅ 无需优化
   |                              |
   NO                            NO
   |                              |
   v                              v
运行 analyze-sql-redundancy.js    增强缓存配置
   |                              |
   v                              |
SQL优化收益 > 30%? ────YES──────>  实施SQL优化
   |                              |
   NO                             |
   |                              |
   v                              v
检查索引状态 ────缺失──────────>  添加索引
   |                              |
  完整                            |
   |                              |
   v                              v
检查并发性能 ────差──────────>  优化连接池
   |
   v
  完成评估
```

## 🎯 优化方案选择

根据测试结果，选择合适的优化方案：

### 方案A：仅缓存优化（快速，低风险）
**适用场景：**
- P95 在 150-200ms
- 缓存命中率 < 70%
- SQL性能正常

**实施步骤：**
1. 增加缓存大小
2. 延长缓存TTL
3. 预热常用tile

**预期收益：** P95 降低 20-30%

### 方案B：SQL优化（中等风险，高收益）
**适用场景：**
- P95 > 200ms
- SQL执行时间 > 150ms
- analyze-sql-redundancy显示优化收益 > 30%

**实施步骤：**
1. 重构SQL消除冗余JOIN
2. 灰度发布
3. 监控性能变化

**预期收益：** P95 降低 30-50%

### 方案C：数据库优化（高风险，需DBA支持）
**适用场景：**
- 索引缺失
- 数据库CPU > 70%
- 并发性能差

**实施步骤：**
1. 添加缺失索引
2. 优化PostgreSQL配置
3. 考虑读写分离

**预期收益：** P95 降低 40-60%

### 方案D：混合优化（推荐，最高收益）
**适用场景：**
- 即将生产部署
- 追求最佳性能

**实施步骤：**
1. 先实施方案A（缓存优化）
2. 再实施方案B（SQL优化）
3. 最后实施方案C（数据库优化）

**预期收益：** P95 降低 50-70%

## 📝 报告分析示例

### 示例输出（优秀性能）
```
【响应时间 (广州塔 zoom16)】
   P50: 45ms
   P95: 98ms    ✅ 优秀
   P99: 132ms
   Avg: 56ms

【缓存效果】
   冷缓存: 156ms
   热缓存: 12ms   ✅ 13x加速
   加速比: 13.0x

【并发性能 (100并发)】
   吞吐量: 856 req/s   ✅ 优秀
   P95响应: 124ms
   成功率: 100%
```

**结论：** 无需优化

### 示例输出（需要优化）
```
【响应时间 (广州塔 zoom16)】
   P50: 125ms
   P95: 285ms    ❌ 需优化
   P99: 420ms
   Avg: 156ms

【缓存效果】
   冷缓存: 298ms
   热缓存: 82ms    ⚠️ 仅3.6x加速
   加速比: 3.6x

【并发性能 (100并发)】
   吞吐量: 185 req/s   ❌ 需优化
   P95响应: 456ms
   成功率: 98%
```

**结论：** 需要全面优化（方案D）

## 🔧 故障排除

### 测试脚本无法运行

**问题：** `Cannot find module '../src/config/database'`
**解决：**
```bash
cd /Users/ginochow/code/funnypixels3/backend
npm install
```

### 数据库连接失败

**问题：** `connect ECONNREFUSED`
**解决：**
```bash
# 检查PostgreSQL是否运行
pg_isready

# 检查.env配置
cat .env | grep DATABASE
```

### 内存不足

**问题：** `JavaScript heap out of memory`
**解决：**
```bash
# 增加Node.js内存限制
node --max-old-space-size=4096 scripts/performance/mvt-performance-test.js
```

### Redis连接失败

**问题：** Redis相关测试跳过
**解决：**
```bash
# 检查Redis是否运行
redis-cli ping

# 如果未运行，启动Redis
redis-server
```

## 📞 需要帮助？

如果测试结果难以解读或不确定优化方向：

1. 保存完整的测试报告JSON文件
2. 附上系统配置信息（CPU、内存、数据库版本）
3. 描述当前遇到的性能问题
4. 联系团队进行深入分析

## 📚 相关文档

- [PostgreSQL性能优化指南](https://www.postgresql.org/docs/current/performance-tips.html)
- [PostGIS空间索引最佳实践](https://postgis.net/workshops/postgis-intro/indexing.html)
- [Redis缓存策略](https://redis.io/docs/manual/eviction/)
- [MVT规范](https://github.com/mapbox/vector-tile-spec)
