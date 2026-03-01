# FunnyPixels 负载测试工具集

这是FunnyPixels项目的负载测试工具集，包含多种测试工具和脚本，用于压力测试全球画布的多用户绘制性能。

## 目录结构

```
loadtest/
├── k6/                          # k6测试脚本
│   ├── canvas-draw-load.js      # 像素绘制压力测试
│   └── canvas-websocket-load.js # WebSocket连接压力测试
├── artillery/                   # Artillery测试配置
│   └── canvas-scenario.yml      # 多场景编排测试
├── scripts/                     # 自定义测试脚本
│   ├── realistic-user-simulator.js    # 真实用户行为模拟器
│   ├── generate-test-users.js         # 测试用户生成器
│   └── cleanup-test-data.js           # 测试数据清理工具
├── data/                        # 测试数据目录
│   ├── test-users.json          # 测试用户数据（生成）
│   ├── test-users.csv           # CSV格式（生成）
│   └── test-users.sql           # SQL导入脚本（生成）
├── reports/                     # 测试报告目录
├── package.json                 # NPM依赖配置
└── README.md                    # 本文件
```

## 快速开始

### 1. 安装依赖

```bash
# 安装Node.js依赖
cd ops/loadtest
npm install

# 安装k6 (macOS)
brew install k6

# 安装Artillery
npm install -g artillery@latest
```

### 2. 生成测试数据

```bash
# 生成1000个测试用户
npm run generate:users

# 生成用户并创建SQL导入脚本
npm run generate:users:sql

# 导入到数据库（可选）
psql -U postgres -d funnypixels_test -f data/test-users.sql
```

### 3. 运行测试

```bash
# k6像素绘制压力测试（100用户，5分钟）
npm run test:draw

# WebSocket连接压力测试（200用户，5分钟）
npm run test:websocket

# Artillery多场景测试
npm run test:artillery

# 真实用户行为模拟（100用户，10分钟）
npm run test:simulator
```

### 4. 清理测试数据

```bash
# 预览要删除的数据（dry-run）
npm run cleanup

# 确认删除测试数据
npm run cleanup:confirm
```

## 测试工具详解

### k6 负载测试

#### 像素绘制压力测试

```bash
# 基础运行
k6 run --vus 100 --duration 5m k6/canvas-draw-load.js

# 自定义参数
k6 run \
  --vus 500 \
  --duration 10m \
  --env BASE_URL=https://api.funnypixels.local \
  --env REGION_LAT_MIN=39.90 \
  --env REGION_LAT_MAX=39.92 \
  --env REGION_LNG_MIN=116.39 \
  --env REGION_LNG_MAX=116.41 \
  k6/canvas-draw-load.js

# 保存结果到JSON
k6 run --vus 100 --duration 5m \
  --summary-export=reports/draw-test-$(date +%Y%m%d-%H%M%S).json \
  k6/canvas-draw-load.js
```

**环境变量:**
- `BASE_URL`: API基础URL（默认: http://localhost:3001）
- `TEST_USERS_FILE`: 测试用户JSON文件路径
- `REGION_LAT_MIN/MAX`: 绘制区域纬度范围
- `REGION_LNG_MIN/MAX`: 绘制区域经度范围

#### WebSocket连接压力测试

```bash
# 基础运行
k6 run --vus 200 --duration 5m k6/canvas-websocket-load.js

# 自定义参数
k6 run \
  --vus 1000 \
  --duration 10m \
  --env WS_URL=wss://api.funnypixels.local/ws/tile-updates \
  --env TILES_PER_CLIENT=9 \
  --env CENTER_LAT=39.90 \
  --env CENTER_LNG=116.40 \
  --env ZOOM_LEVEL=14 \
  k6/canvas-websocket-load.js
```

**环境变量:**
- `WS_URL`: WebSocket URL
- `TILES_PER_CLIENT`: 每个客户端订阅的瓦片数
- `CENTER_LAT/LNG`: 测试中心坐标
- `ZOOM_LEVEL`: 缩放级别

### Artillery 场景测试

```bash
# 运行多场景测试
artillery run artillery/canvas-scenario.yml

# 生成HTML报告
artillery run --output reports/artillery-report.json artillery/canvas-scenario.yml
artillery report reports/artillery-report.json

# 自定义配置
artillery run \
  --target https://api.funnypixels.local \
  --payload data/test-users.csv \
  artillery/canvas-scenario.yml

# 分布式运行（AWS Fargate）
artillery run-fargate artillery/canvas-scenario.yml
```

**配置文件结构:**
- `config.phases`: 测试阶段配置（预热、加压、稳定、冲击）
- `scenarios`: 测试场景定义（真实用户绘制、批量绘制、地图浏览）

### 自定义Node.js模拟器

#### 真实用户行为模拟器

```bash
# 基础运行
node scripts/realistic-user-simulator.js \
  --users 100 \
  --duration 600

# 完整参数
node scripts/realistic-user-simulator.js \
  --users 100 \
  --duration 600 \
  --base-url https://api.funnypixels.local \
  --ws-url wss://api.funnypixels.local/ws/tile-updates \
  --region beijing \
  --output reports/simulator-$(date +%Y%m%d-%H%M%S).json \
  --verbose
```

**参数说明:**
- `--users <number>`: 并发用户数（默认: 10）
- `--duration <seconds>`: 测试持续时间（默认: 300秒）
- `--base-url <url>`: API基础URL
- `--ws-url <url>`: WebSocket URL
- `--region <name>`: 测试区域（beijing|shanghai|global）
- `--output <file>`: 保存性能指标到文件
- `--verbose`: 详细日志输出

**支持的区域:**
- `beijing`: 北京天安门区域（39.90-39.92, 116.39-116.41）
- `shanghai`: 上海外滩区域（31.23-31.25, 121.48-121.50）
- `global`: 全球随机位置（-85到85, -180到180）

## 测试数据管理

### 生成测试用户

```bash
# 生成1000个测试用户（JSON格式）
node scripts/generate-test-users.js \
  --count 1000 \
  --prefix load_test_ \
  --output data/test-users.json

# 同时生成CSV和SQL
node scripts/generate-test-users.js \
  --count 1000 \
  --csv \
  --db-insert
```

**生成的文件:**
- `data/test-users.json`: JSON格式（用于k6和Node.js脚本）
- `data/test-users.csv`: CSV格式（用于Artillery）
- `data/test-users.sql`: SQL插入语句（用于数据库初始化）

**用户数据结构:**
```json
{
  "id": "load_test_0",
  "email": "load_test_0@loadtest.example.com",
  "username": "TestUser0",
  "password": "TestPassword123!",
  "hashedPassword": "$2a$10$...",
  "token": "base64_encoded_token",
  "createdAt": "2026-02-25T12:00:00.000Z"
}
```

### 清理测试数据

```bash
# 预览要删除的数据（不实际删除）
node scripts/cleanup-test-data.js \
  --prefix load_test_ \
  --dry-run

# 删除测试数据（需要确认）
node scripts/cleanup-test-data.js \
  --prefix load_test_

# 跳过确认直接删除（危险！）
node scripts/cleanup-test-data.js \
  --prefix load_test_ \
  --confirm

# 指定数据库环境
node scripts/cleanup-test-data.js \
  --prefix load_test_ \
  --env test \
  --db-config ../../../backend/knexfile.js
```

**清理的数据表:**
1. `pixels_history` - 像素历史记录
2. `drawing_sessions` - 绘制会话
3. `pixels` - 像素数据
4. `user_pixel_states` - 用户像素状态
5. `users` - 用户账号

## 性能指标说明

### 关键指标

#### 成功率指标
- `draw_success_rate`: 像素绘制成功率（目标 > 95%）
- `ws_connection_rate`: WebSocket连接成功率（目标 > 95%）
- `http_req_failed`: HTTP请求失败率（目标 < 5%）

#### 延迟指标
- `pixel_draw_latency`: 像素绘制延迟
  - 平均: < 300ms
  - P95: < 500ms
  - P99: < 1000ms
- `ws_connection_duration`: WebSocket连接建立时间
  - 平均: < 1000ms
  - P95: < 3000ms
- `ws_message_latency`: WebSocket消息延迟
  - P95: < 200ms
  - P99: < 500ms

#### 吞吐量指标
- `pixel_draw_success`: 成功绘制的像素总数
- `ws_message_received`: 收到的WebSocket消息总数

#### 错误指标
- `pixel_conflicts`: 像素冲突次数
- `auth_failures`: 认证失败次数
- `ws_connection_failure`: WebSocket连接失败次数

### 测试报告示例

```
📊 测试摘要:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ 成功绘制: 12450
❌ 失败绘制: 125
⚠️  冲突次数: 45
🔐 认证失败: 8
📈 成功率: 99.00%
⏱️  平均延迟: 185.23ms
⏱️  P95延迟: 432.10ms
⏱️  P99延迟: 876.54ms
🌐 HTTP错误率: 0.82%
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## 测试场景

### 场景1: 单用户连续绘制

**目标**: 测试单用户绘制性能基线

```bash
k6 run --vus 1 --duration 10m k6/canvas-draw-load.js
```

**验收标准**:
- 成功率 > 99.9%
- 平均延迟 < 200ms
- P95延迟 < 500ms

### 场景2: 多用户并发（不同区域）

**目标**: 测试系统并发处理能力

```bash
# 100用户
k6 run --vus 100 --duration 5m k6/canvas-draw-load.js

# 500用户
k6 run --vus 500 --duration 5m k6/canvas-draw-load.js

# 1000用户
k6 run --vus 1000 --duration 5m k6/canvas-draw-load.js
```

**验收标准**:
- 成功率 > 99%
- 平均延迟 < 300ms
- WebSocket消息延迟 < 100ms

### 场景3: 多用户同一区域（冲突测试）

**目标**: 测试冲突处理

```bash
k6 run \
  --vus 200 \
  --duration 3m \
  --env REGION_LAT_MIN=39.910 \
  --env REGION_LAT_MAX=39.911 \
  --env REGION_LNG_MIN=116.395 \
  --env REGION_LNG_MAX=116.396 \
  k6/canvas-draw-load.js
```

**验收标准**:
- 成功率 > 95%（考虑冲突）
- 数据一致性 100%
- 冲突解决时间 < 1秒

### 场景4: WebSocket连接压力

**目标**: 测试最大连接数

```bash
# 1000连接
k6 run --vus 1000 --duration 10m k6/canvas-websocket-load.js

# 5000连接
k6 run --vus 5000 --duration 10m k6/canvas-websocket-load.js

# 10000连接（需要调整系统限制）
k6 run --vus 10000 --duration 10m k6/canvas-websocket-load.js
```

**验收标准**:
- 连接成功率 > 99%
- 心跳响应 < 50ms
- 消息广播延迟 < 200ms

### 场景5: 真实用户模拟

**目标**: 模拟真实用户行为

```bash
node scripts/realistic-user-simulator.js \
  --users 100 \
  --duration 600 \
  --region beijing \
  --verbose
```

**验收标准**:
- 整体成功率 > 98%
- 用户体验延迟 < 300ms
- WebSocket消息实时性 < 200ms

## 故障排查

### 常见问题

#### 1. 数据库连接池耗尽

**症状**: 大量超时错误，日志显示"等待数据库连接"

**解决方案**:
```bash
# 检查数据库连接数
psql -U postgres -d funnypixels_test -c "SELECT count(*) FROM pg_stat_activity;"

# 增加连接池大小（backend/.env）
DB_POOL_MIN=10
DB_POOL_MAX=100
```

#### 2. Redis内存不足

**症状**: 缓存未命中率升高，OOM错误

**解决方案**:
```bash
# 检查Redis内存使用
redis-cli INFO memory

# 清理缓存
redis-cli FLUSHDB

# 增加Redis内存配置
maxmemory 4gb
maxmemory-policy allkeys-lru
```

#### 3. k6测试失败

**症状**: k6报错"connection refused"或"timeout"

**解决方案**:
```bash
# 检查服务器是否运行
curl http://localhost:3001/health

# 检查防火墙
sudo ufw status

# 增加k6超时时间
k6 run --http-timeout=30s k6/canvas-draw-load.js
```

#### 4. WebSocket连接失败

**症状**: 大量WebSocket连接错误

**解决方案**:
```bash
# 检查WebSocket端点
wscat -c ws://localhost:3001/ws/tile-updates

# 检查系统文件描述符限制
ulimit -n
# 增加限制
ulimit -n 65536

# 检查服务器WebSocket配置
```

## 最佳实践

### 1. 测试前准备

- [ ] 使用独立的测试环境
- [ ] 备份生产数据
- [ ] 清理旧的测试数据
- [ ] 生成足够的测试用户
- [ ] 配置监控和日志

### 2. 逐步加压

```javascript
// k6 ramping配置示例
export let options = {
  stages: [
    { duration: '2m', target: 50 },
    { duration: '5m', target: 50 },
    { duration: '2m', target: 100 },
    { duration: '5m', target: 100 },
    { duration: '2m', target: 0 },
  ],
};
```

### 3. 持续监控

- 使用`--verbose`选项获取详细日志
- 定期保存性能指标到文件
- 使用实时监控工具（Grafana、New Relic等）

### 4. 测试后清理

```bash
# 清理测试数据
npm run cleanup:confirm

# 清理日志文件
rm -f reports/*.json

# 重置数据库（可选）
npm run db:reset
```

## 进阶用法

### 分布式负载测试

使用Artillery Cloud进行分布式测试:

```bash
# 登录Artillery Cloud
artillery login

# 运行分布式测试
artillery run-fargate \
  --region us-west-2 \
  --count 10 \
  artillery/canvas-scenario.yml
```

### CI/CD集成

GitHub Actions示例:

```yaml
name: Load Test
on:
  schedule:
    - cron: '0 2 * * *'  # 每天凌晨2点
  workflow_dispatch:

jobs:
  load-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      - name: Install k6
        run: |
          sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
          echo "deb https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
          sudo apt-get update
          sudo apt-get install k6
      - name: Run load test
        run: |
          cd ops/loadtest
          npm install
          npm run generate:users
          k6 run --vus 100 --duration 5m k6/canvas-draw-load.js
```

## 参考资源

- [完整测试方案文档](../../docs/testing/CANVAS_LOAD_TESTING_GUIDE.md)
- [k6官方文档](https://k6.io/docs/)
- [Artillery官方文档](https://www.artillery.io/docs)
- [WebSocket性能优化](https://www.nginx.com/blog/websocket-nginx/)

## 技术支持

如有问题，请联系:
- 技术负责人: [Email]
- GitHub Issues: [项目地址]/issues

---

**版本**: v1.0
**更新日期**: 2026-02-25
