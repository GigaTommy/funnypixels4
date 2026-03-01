---
name: stress-test-run
description: Run mixed stress test with k6. Supports smoke, full, and custom scale modes. Default 300 writers + 600 readers (tuned for local Mac dev machine).
context: fork
agent: general-purpose
allowed-tools: Read, Bash(k6 *), Bash(ulimit *), Bash(cd *), Bash(cat *), Bash(curl *), Bash(npm run test:stress*)
argument-hint: [smoke|full|custom WRITER_VUS=N READER_VUS=N]
---

# 运行混合压力测试

使用 k6 执行读写并发压力测试。默认 300 Writers + 600 Readers（基于 4-5 轮本地 Mac 压测迭代调优）。

## 测试模式
模式: $ARGUMENTS（默认 smoke）

## 前置条件

**必须先执行 `/stress-test-prepare`** 来准备测试环境。

验证准备状态：
```bash
# 检查后端运行
curl -s http://localhost:3001/api/health

# 检查测试用户存在
PGPASSWORD=password psql -h localhost -U postgres -d funnypixels_postgres -c "SELECT COUNT(*) FROM users WHERE email LIKE '%@loadtest.example.com';" -t
```

## 测试模式详解

### 模式 1: smoke（烟测）

快速验证测试脚本和环境是否正常工作。

```bash
cd ops/loadtest
ulimit -n 65536
k6 run --env SMOKE=true k6/stress-10k-mixed.js
```

**参数:**
- Writers: 5 VU
- Readers: 10 VU
- 持续时间: 30 秒
- 预期耗时: ~2 分钟（含 setup）

**适用场景:**
- 首次运行验证环境
- 修改脚本后快速验证
- CI/CD 快速检查

### 模式 2: full（正式测试）

默认规模压力测试，阶梯递增至 300 Writers + 600 Readers 峰值。

```bash
cd ops/loadtest
ulimit -n 65536
npm run test:stress-10k
```

等价于：
```bash
k6 run --out json=reports/stress-10k-$(date +%Y%m%d-%H%M%S).json k6/stress-10k-mixed.js
```

**参数（默认 300/600 VU）:**
- Writers: 0 -> 60 -> 150 -> 300 VU（阶梯递增）
- Readers: 0 -> 150 -> 300 -> 600 VU（阶梯递增）
- 峰值保持: 10 分钟
- 总持续时间: ~24 分钟 + setup 时间
- 预期总耗时: ~30 分钟

**阶梯递增详情（Writers, 默认 300 VU）:**
1. 0 -> 60 VU（2分钟 ramp up）
2. 60 VU 稳定（2分钟）
3. 60 -> 150 VU（2分钟 ramp up）
4. 150 VU 稳定（2分钟）
5. 150 -> 300 VU（2分钟 ramp up）
6. 300 VU 峰值保持（10分钟）
7. 300 -> 150 VU（2分钟 ramp down）
8. 150 -> 0 VU（2分钟 ramp down）

### 模式 3: custom（自定义）

自定义 VU 数量，用于渐进式测试或定位瓶颈。

```bash
cd ops/loadtest
ulimit -n 65536
k6 run --env WRITER_VUS=200 --env READER_VUS=500 k6/stress-10k-mixed.js
```

**常用组合:**
```bash
# 轻量级（快速验证优化效果）
k6 run --env WRITER_VUS=100 --env READER_VUS=200 k6/stress-10k-mixed.js

# 中等规模
k6 run --env WRITER_VUS=200 --env READER_VUS=400 k6/stress-10k-mixed.js

# 高负载（需要 cluster 模式）
k6 run --env WRITER_VUS=500 --env READER_VUS=1000 k6/stress-10k-mixed.js

# 只测写入
k6 run --env WRITER_VUS=300 --env READER_VUS=0 k6/stress-10k-mixed.js

# 只测读取
k6 run --env WRITER_VUS=0 --env READER_VUS=600 k6/stress-10k-mixed.js

# 保存 JSON 结果
k6 run --env WRITER_VUS=300 --env READER_VUS=600 --out json=reports/custom-test.json k6/stress-10k-mixed.js
```

## 测试场景架构

### 场景 A: Writers（写入者）

| 项目 | 值 |
|------|-----|
| 端点 | POST /api/pixel-draw/manual |
| 认证 | JWT Token（setup 阶段获取） |
| Think Time | 2-5 秒 |
| 请求体 | `{ latitude, longitude, color }` |
| 坐标范围 | 北京市中心 (39.90-39.95, 116.35-116.42) |

### 场景 B: Readers（读取者）

| 端点 | 权重 | 认证 | 说明 |
|------|------|------|------|
| POST /api/pixels/bbox | 40% | 无 | 模拟地图平移，随机 bbox |
| GET /api/tiles/pixels/{z}/{x}/{y}.pbf | 30% | 无 | MVT 瓦片，zoom 16 |
| GET /api/pixels/stats | 15% | 无 | 像素统计 |
| GET /api/pixels/hot-zones | 15% | 无 | 热区查询 |

**Think Time:** 1-3 秒

**VU 与真实用户的换算:**
- 真实用户每 5-10 秒发一次请求
- 600 VU 以 1-3 秒 think time ≈ 2,700 真实用户
- 300 Writers + 600 Readers ≈ ~4,000 真实在线用户

## SLO 阈值

基于 4-5 轮本地 Mac 压测经验调优（单机 + cluster 2 workers）：

| 指标 | SLO 阈值 | 说明 |
|------|----------|------|
| 写入延迟 P95 | < 2000ms | 95% 写入请求在 2s 内完成 |
| 写入延迟 P99 | < 5000ms | 99% 写入请求在 5s 内完成 |
| 读取延迟 P95 | < 1000ms | 95% 读取请求在 1s 内完成 |
| 写入成功率 | > 95% | 写入请求成功率 |
| 读取成功率 | > 95% | 读取请求成功率 |
| HTTP 总错误率 | < 5% | 全局 HTTP 错误率 |

**注意:** 以上 SLO 为本地开发机标准。生产环境 SLO 应更严格（Write P95 < 500ms, Read P95 < 300ms）。

## 历史压测数据参考

| 轮次 | Writers | Readers | Write P95 | Read P95 | BBOX P95 | 成功率 |
|------|---------|---------|-----------|----------|----------|--------|
| 最新 | 300 | 600 | 1506ms | 466ms | 799ms | W:99.7% R:96.9% |

**已知瓶颈:** BBOX 查询 P95=799ms 是读取延迟的主要来源（占读取请求 40% 权重）。

## 错误分类

| HTTP 状态 | 分类 | 严重性 | 说明 |
|-----------|------|--------|------|
| 409 | 像素冲突 | 正常 | 多用户争抢同一网格，预期行为 |
| 429 | 限流触发 | 需关注 | 限流配置可能需要调整 |
| 5xx | 服务端错误 | 严重 | DB 连接池耗尽、OOM 等 |
| 401/403 | 认证失败 | 严重 | Token 过期或无效 |

## 运行监控

测试运行期间，可在另一个 terminal 监控系统状态：

```bash
# 监控后端进程 CPU/内存（cluster 模式有多个 node 进程）
top -pid $(pgrep -f "node src/cluster.js" | head -1) 2>/dev/null || top -pid $(pgrep -f "node src/server.js" | head -1)

# 监控 PostgreSQL 连接数（cluster 模式下预期 2 × 25 = 50 连接）
watch -n 5 'PGPASSWORD=password psql -h localhost -U postgres -d funnypixels_postgres -c "SELECT count(*) as connections, state FROM pg_stat_activity GROUP BY state;"'

# 监控 k6 进程资源
top -pid $(pgrep k6)
```

## 结果分析

### 输出文件
- **控制台输出**: 实时进度 + 最终 SLO 结果表
- **JSON 报告**: `ops/loadtest/reports/stress-10k-mixed-summary.json`
- **k6 详细日志**: `ops/loadtest/reports/stress-10k-YYYYMMDD-HHMMSS.json`（使用 `--out json=` 时）

### 关键指标解读

```
--- SLO SUMMARY ---
  [PASS] Write P95 < 2000ms      # 写入延迟达标
  [PASS] Write P99 < 5000ms      # 写入延迟达标
  [PASS] Read P95 < 1000ms       # 读取延迟达标
  [PASS] Write Success > 95%     # 写入成功率达标
  [PASS] Read Success > 95%      # 读取成功率达标
  [PASS] HTTP Error < 5%         # 全局错误率达标

  Overall: ALL SLOs PASSED       # 全部通过 = 系统满足需求
```

### 未达标时的瓶颈分析

| 症状 | 可能原因 | 排查方向 |
|------|----------|----------|
| 写入 P95 > 2000ms | DB 连接池耗尽 | 检查 pg_stat_activity，增大 pool max |
| BBOX P95 > 800ms | 缺索引或缓存未命中 | 检查 Redis 缓存命中率，增大 bbox TTL |
| 大量 5xx | 后端 OOM / CPU 饱和 | 检查 top，考虑 cluster 模式 |
| 大量 429 | 限流触发 | 检查 rateLimit 配置 |
| 写入成功率低 | 像素冲突过多 | 扩大坐标范围减少冲突概率 |

## 完成后

测试完成后：
1. **先恢复环境**: `/stress-test-restore`
2. **再分析结果**: `/stress-test-results`

---

**执行此 skill**: `/stress-test-run smoke`
**正式测试**: `/stress-test-run full`
**自定义规模**: `/stress-test-run custom WRITER_VUS=200 READER_VUS=500`
