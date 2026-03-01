# FunnyPixels 全球画布多用户压力测试方案

## 目录

1. [测试目标](#测试目标)
2. [测试工具选择](#测试工具选择)
3. [测试场景设计](#测试场景设计)
4. [性能基线与目标](#性能基线与目标)
5. [实施步骤](#实施步骤)
6. [测试环境准备](#测试环境准备)
7. [测试脚本说明](#测试脚本说明)
8. [监控与指标](#监控与指标)
9. [问题诊断](#问题诊断)
10. [最佳实践](#最佳实践)

---

## 测试目标

### 核心目标

1. **验证系统容量**：确定系统能够支持的最大并发用户数和像素绘制速率
2. **性能基线建立**：建立关键API的性能基线（延迟、吞吐量）
3. **瓶颈识别**：识别数据库、Redis、WebSocket等组件的性能瓶颈
4. **稳定性验证**：验证系统在高负载下的稳定性和错误处理能力
5. **真实场景模拟**：模拟全球用户在不同地理位置绘制像素的真实场景

### 业务场景

- **高峰时段模拟**：活动期间1000+用户同时在线绘制
- **联盟协作**：多个联盟成员在同一区域协作绘图
- **赛事场景**：多个联盟在赛事区域内激烈竞争
- **冲突处理**：多用户尝试在同一像素位置绘制

---

## 测试工具选择

### 1. k6 (推荐用于REST API压测)

**优势**：
- 高性能，Go语言编写
- 支持WebSocket协议
- 内置丰富的性能指标
- 可编程性强（JavaScript DSL）
- 支持分布式负载测试

**适用场景**：
- REST API压力测试
- WebSocket连接压力测试
- 复杂场景模拟

**安装**：
```bash
# macOS
brew install k6

# Ubuntu/Debian
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6

# Windows
choco install k6
```

### 2. Artillery (推荐用于复杂场景)

**优势**：
- 配置简单（YAML格式）
- 内置场景编排能力
- 支持多协议（HTTP、WebSocket、Socket.IO）
- 实时报告和HTML报告
- 插件生态丰富

**适用场景**：
- 多阶段负载测试
- WebSocket实时通信测试
- 复杂用户行为模拟

**安装**：
```bash
npm install -g artillery@latest
```

### 3. 自定义Node.js脚本

**优势**：
- 完全可控，可模拟真实用户行为
- 易于集成现有测试工具
- 可复用项目代码和配置
- 灵活的数据生成和清理

**适用场景**：
- 真实用户行为模拟
- 数据准备和清理
- 特定业务逻辑测试

---

## 测试场景设计

### 场景1：单用户连续绘制

**目标**：测试单用户绘制像素的性能和稳定性

**关键指标**：
- 绘制成功率 > 99.9%
- 平均响应时间 < 200ms
- P95响应时间 < 500ms
- P99响应时间 < 1000ms

**测试参数**：
- 用户数：1
- 绘制速率：10像素/秒
- 持续时间：10分钟
- 绘制区域：随机分布

### 场景2：多用户同时绘制（不同区域）

**目标**：测试系统并发处理能力，验证区域隔离

**关键指标**：
- 并发用户数：100-1000
- 绘制成功率 > 99%
- 平均响应时间 < 300ms
- WebSocket消息延迟 < 100ms

**测试参数**：
- 用户数：递增 50 → 100 → 500 → 1000
- 每用户绘制速率：1像素/秒
- 持续时间：5分钟
- 绘制区域：全球10个不同区域

### 场景3：多用户同时绘制（同一区域）

**目标**：测试冲突处理和数据一致性

**关键指标**：
- 并发用户数：50-500
- 绘制成功率 > 95%（考虑冲突）
- 数据一致性：100%（最终一致性）
- 冲突解决时间 < 1秒

**测试参数**：
- 用户数：50, 100, 200, 500
- 每用户绘制速率：5像素/秒
- 持续时间：3分钟
- 绘制区域：同一个100x100像素区域

### 场景4：WebSocket连接数压力测试

**目标**：测试WebSocket服务器最大连接数

**关键指标**：
- 最大同时连接数 > 5000
- 连接建立成功率 > 99%
- 心跳响应时间 < 50ms
- 消息广播延迟 < 200ms

**测试参数**：
- 连接数：递增 1000 → 5000 → 10000
- 每连接订阅瓦片数：5-10
- 消息频率：10消息/秒
- 持续时间：10分钟

### 场景5：数据库写入并发压力

**目标**：测试批处理和数据库写入性能

**关键指标**：
- 写入TPS > 1000
- 批处理队列长度 < 1000
- 数据库连接池使用率 < 80%
- 批处理延迟 < 5秒

**测试参数**：
- 并发写入用户：200
- 每用户绘制速率：10像素/秒
- 持续时间：5分钟
- 批处理大小：100像素/批次

### 场景6：缓存命中率测试

**目标**：验证Redis缓存效果

**关键指标**：
- 瓦片缓存命中率 > 90%
- 用户状态缓存命中率 > 95%
- Redis延迟 < 10ms
- 缓存内存使用 < 2GB

**测试参数**：
- 读写比例：90% 读，10% 写
- 热点区域：10个热门区域
- 并发用户：500
- 持续时间：10分钟

### 场景7：联盟赛事压力测试

**目标**：模拟赛事高峰期多联盟竞争

**关键指标**：
- 并发联盟数：10-20
- 每联盟用户数：20-50
- 总并发用户：200-1000
- 赛事区域像素更新率 > 100像素/秒
- 排行榜更新延迟 < 5秒

**测试参数**：
- 联盟数：10
- 每联盟用户：50
- 绘制区域：同一赛事边界
- 持续时间：10分钟
- 排行榜更新频率：每30秒

---

## 性能基线与目标

### REST API性能目标

| API端点 | 目标QPS | 平均延迟 | P95延迟 | P99延迟 | 成功率 |
|---------|---------|----------|---------|---------|--------|
| POST /api/pixel | 1000 | < 200ms | < 500ms | < 1000ms | > 99% |
| POST /api/pixels/batch | 100 | < 500ms | < 1000ms | < 2000ms | > 99% |
| GET /api/tiles/{z}/{x}/{y}.mvt | 10000 | < 100ms | < 200ms | < 500ms | > 99.9% |
| POST /api/pixel/init | 500 | < 100ms | < 200ms | < 500ms | > 99.9% |
| WebSocket /ws/tile-updates | 5000连接 | < 50ms | < 100ms | < 200ms | > 99% |

### 系统资源目标

| 资源 | 目标值 | 警戒值 | 说明 |
|------|--------|--------|------|
| CPU使用率 | < 60% | > 80% | 多核平均 |
| 内存使用 | < 4GB | > 6GB | Node.js进程 |
| 数据库连接 | < 50 | > 80 | 连接池大小100 |
| Redis内存 | < 2GB | > 4GB | 缓存数据 |
| WebSocket连接 | < 5000 | > 8000 | 单服务器 |
| 批处理队列 | < 500 | > 1000 | 待处理像素数 |

### 业务指标目标

| 指标 | 目标值 | 说明 |
|------|--------|------|
| 像素绘制成功率 | > 99% | 排除冲突情况 |
| 数据一致性 | 100% | 最终一致性 |
| WebSocket消息延迟 | < 200ms | 从绘制到广播 |
| 缓存命中率 | > 90% | 瓦片缓存 |
| 批处理延迟 | < 5秒 | 从入队到持久化 |

---

## 实施步骤

### 阶段1：环境准备（1天）

1. **测试环境搭建**
   ```bash
   # 克隆生产环境配置
   cp backend/.env.production.example backend/.env.test

   # 修改数据库配置为测试数据库
   # 修改Redis配置为测试Redis实例
   ```

2. **安装测试工具**
   ```bash
   # 安装k6
   brew install k6  # macOS

   # 安装Artillery
   npm install -g artillery@latest

   # 安装项目依赖
   cd ops/loadtest
   npm install
   ```

3. **创建测试数据**
   ```bash
   # 生成测试用户
   node ops/loadtest/scripts/generate-test-users.js --count 1000

   # 生成测试联盟
   node ops/loadtest/scripts/generate-test-alliances.js --count 20
   ```

### 阶段2：单场景测试（2-3天）

每个场景按以下步骤执行：

1. **准备测试数据**
2. **执行冒烟测试**（少量用户，验证脚本正确性）
3. **执行压力测试**（逐步增加负载）
4. **收集性能指标**
5. **分析瓶颈**
6. **清理测试数据**

### 阶段3：综合场景测试（1-2天）

1. **混合负载测试**：同时运行多种场景
2. **峰值流量模拟**：模拟活动高峰期
3. **稳定性测试**：长时间运行（6-12小时）
4. **故障恢复测试**：模拟服务重启、数据库故障等

### 阶段4：结果分析与优化（2天）

1. **性能报告生成**
2. **瓶颈分析与优化建议**
3. **容量规划建议**
4. **监控告警配置**

---

## 测试环境准备

### 1. 数据库准备

```sql
-- 创建测试数据库
CREATE DATABASE funnypixels_test;

-- 运行迁移
npm run migrate

-- 创建测试用户索引（提升性能）
CREATE INDEX idx_pixels_lat_lng ON pixels(latitude, longitude);
CREATE INDEX idx_pixels_created_at ON pixels(created_at);
CREATE INDEX idx_user_pixel_states_user_id ON user_pixel_states(user_id);
```

### 2. Redis准备

```bash
# 启动独立Redis实例用于测试
docker run -d --name redis-test -p 6380:6379 redis:7-alpine

# 配置测试环境变量
export REDIS_HOST=localhost
export REDIS_PORT=6380
```

### 3. 监控准备

```bash
# 安装监控工具（可选）
npm install -g clinic

# 启动服务器并启用性能监控
clinic doctor -- node backend/src/server.js
```

### 4. 测试用户准备

```bash
# 生成1000个测试用户
node ops/loadtest/scripts/generate-test-users.js \
  --count 1000 \
  --prefix load_test_ \
  --output ops/loadtest/data/test-users.json

# 生成测试联盟
node ops/loadtest/scripts/generate-test-alliances.js \
  --count 20 \
  --members-per-alliance 50 \
  --output ops/loadtest/data/test-alliances.json
```

---

## 测试脚本说明

### k6脚本

位置：`ops/loadtest/k6/`

1. **canvas-draw-load.js**：像素绘制压力测试
2. **canvas-websocket-load.js**：WebSocket连接压力测试
3. **canvas-mixed-load.js**：混合场景压力测试

运行方式：
```bash
# 单用户连续绘制
k6 run --vus 1 --duration 10m ops/loadtest/k6/canvas-draw-load.js

# 多用户并发绘制
k6 run --vus 100 --duration 5m ops/loadtest/k6/canvas-draw-load.js

# 自定义参数
k6 run \
  --vus 500 \
  --duration 10m \
  --env BASE_URL=https://api.funnypixels.local \
  --env TEST_USERS_FILE=./data/test-users.json \
  ops/loadtest/k6/canvas-draw-load.js
```

### Artillery脚本

位置：`ops/loadtest/artillery/`

1. **canvas-scenario.yml**：多场景编排测试
2. **websocket-stress.yml**：WebSocket压力测试
3. **alliance-battle.yml**：联盟赛事模拟

运行方式：
```bash
# 运行单个场景
artillery run ops/loadtest/artillery/canvas-scenario.yml

# 生成HTML报告
artillery run --output report.json ops/loadtest/artillery/canvas-scenario.yml
artillery report report.json

# 分布式运行
artillery run-fargate ops/loadtest/artillery/canvas-scenario.yml
```

### Node.js脚本

位置：`ops/loadtest/scripts/`

1. **realistic-user-simulator.js**：真实用户行为模拟
2. **generate-test-users.js**：测试数据生成
3. **cleanup-test-data.js**：测试数据清理
4. **performance-monitor.js**：实时性能监控

运行方式：
```bash
# 模拟100个真实用户
node ops/loadtest/scripts/realistic-user-simulator.js \
  --users 100 \
  --duration 600 \
  --base-url https://api.funnypixels.local

# 清理测试数据
node ops/loadtest/scripts/cleanup-test-data.js \
  --prefix load_test_
```

---

## 监控与指标

### 关键指标采集

1. **应用层指标**（通过日志和APM）
   - API响应时间（P50、P95、P99）
   - 请求成功率
   - WebSocket连接数
   - 批处理队列长度

2. **数据库指标**
   - 查询响应时间
   - 连接池使用率
   - 慢查询数量
   - 锁等待时间

3. **Redis指标**
   - 命中率
   - 内存使用
   - 命令执行时间
   - 连接数

4. **系统资源指标**
   - CPU使用率
   - 内存使用
   - 网络I/O
   - 磁盘I/O

### 实时监控脚本

```bash
# 启动性能监控
node ops/loadtest/scripts/performance-monitor.js \
  --interval 5 \
  --output monitor-$(date +%Y%m%d-%H%M%S).json
```

### 日志分析

```bash
# 分析错误日志
grep "ERROR" backend/logs/app.log | tail -100

# 分析慢请求
grep "Processing time:" backend/logs/app.log | awk '{print $NF}' | sort -n | tail -20

# WebSocket连接统计
grep "WebSocket" backend/logs/app.log | grep "connected\|disconnected" | wc -l
```

---

## 问题诊断

### 常见性能问题

#### 1. 数据库连接池耗尽

**症状**：
- 大量"等待数据库连接"错误
- 请求超时

**诊断**：
```sql
-- 查看当前连接数
SELECT count(*) FROM pg_stat_activity;

-- 查看慢查询
SELECT * FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 10;
```

**解决方案**：
- 增加连接池大小
- 优化慢查询
- 使用连接池预热

#### 2. Redis内存不足

**症状**：
- 缓存未命中率升高
- OOM错误

**诊断**：
```bash
redis-cli INFO memory
redis-cli --bigkeys
```

**解决方案**：
- 增加Redis内存配置
- 配置内存淘汰策略（LRU）
- 优化缓存键设计

#### 3. WebSocket消息延迟

**症状**：
- 像素更新延迟 > 1秒
- 大量消息堆积

**诊断**：
```javascript
// 检查WebSocket统计信息
const stats = tileUpdateHandler.getStats();
console.log('Active rooms:', stats.totalTileRooms);
console.log('Total clients:', stats.totalClients);
```

**解决方案**：
- 优化瓦片订阅策略
- 减少消息大小
- 使用消息批处理

#### 4. 批处理队列堆积

**症状**：
- 批处理队列长度持续增长
- 像素持久化延迟

**诊断**：
```javascript
const stats = batchPixelService.getStats();
console.log('Queue size:', stats.queueSize);
console.log('Processed:', stats.totalProcessed);
```

**解决方案**：
- 增加批处理并发数
- 减小批处理大小
- 优化数据库写入性能

---

## 最佳实践

### 1. 测试数据隔离

- 使用独立的测试数据库
- 为测试用户添加明确的前缀（如 `load_test_`）
- 测试后及时清理数据

### 2. 逐步增加负载

```javascript
// k6 ramping 配置示例
export let options = {
  stages: [
    { duration: '2m', target: 50 },   // 2分钟升到50用户
    { duration: '5m', target: 50 },   // 稳定5分钟
    { duration: '2m', target: 100 },  // 2分钟升到100用户
    { duration: '5m', target: 100 },  // 稳定5分钟
    { duration: '2m', target: 0 },    // 2分钟降到0
  ],
};
```

### 3. 真实场景模拟

- 模拟真实的地理分布（全球多个区域）
- 模拟真实的用户行为（浏览、绘制、休息）
- 考虑网络延迟和丢包

### 4. 持续监控

- 设置性能基线
- 在CI/CD中集成性能测试
- 定期回归测试

### 5. 结果可重现

- 保存测试配置和参数
- 记录环境信息（版本、配置）
- 保存原始性能数据

---

## 测试报告模板

### 执行摘要

- 测试日期：YYYY-MM-DD
- 测试环境：生产环境/测试环境
- 测试工具：k6/Artillery/自定义脚本
- 测试场景：场景名称

### 测试结果

| 指标 | 目标值 | 实际值 | 达成状态 |
|------|--------|--------|----------|
| 最大并发用户数 | 1000 | 850 | 未达成 |
| 平均响应时间 | < 200ms | 180ms | 达成 |
| P95响应时间 | < 500ms | 450ms | 达成 |
| 成功率 | > 99% | 99.2% | 达成 |

### 性能瓶颈

1. **数据库写入性能**
   - 现象：高并发时TPS下降
   - 原因：单表写入冲突
   - 建议：分区表或分库分表

2. **Redis内存不足**
   - 现象：缓存命中率下降
   - 原因：缓存键设计不合理
   - 建议：优化缓存策略

### 优化建议

1. 短期优化（1周内）
   - 调整数据库连接池大小
   - 优化慢查询

2. 中期优化（1月内）
   - 实现数据库读写分离
   - 引入CDN加速瓦片访问

3. 长期优化（3月内）
   - 微服务拆分
   - 多区域部署

---

## 附录

### A. 测试清单

- [ ] 测试环境准备完成
- [ ] 测试数据生成完成
- [ ] 监控工具配置完成
- [ ] 场景1：单用户连续绘制
- [ ] 场景2：多用户不同区域绘制
- [ ] 场景3：多用户同一区域绘制
- [ ] 场景4：WebSocket连接压力
- [ ] 场景5：数据库写入压力
- [ ] 场景6：缓存命中率测试
- [ ] 场景7：联盟赛事压力
- [ ] 性能报告生成
- [ ] 测试数据清理

### B. 参考资源

- [k6官方文档](https://k6.io/docs/)
- [Artillery官方文档](https://www.artillery.io/docs)
- [PostgreSQL性能优化](https://wiki.postgresql.org/wiki/Performance_Optimization)
- [Redis性能优化](https://redis.io/docs/management/optimization/)
- [WebSocket性能优化](https://www.nginx.com/blog/websocket-nginx/)

### C. 联系方式

- 技术负责人：[姓名]
- 运维负责人：[姓名]
- 紧急联系：[电话/邮箱]

---

**文档版本**：v1.0
**最后更新**：2026-02-25
**维护者**：FunnyPixels团队
