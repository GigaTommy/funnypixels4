# FunnyPixels 负载测试快速开始指南

本指南帮助你在5分钟内启动并运行FunnyPixels全球画布的负载测试。

## 前置条件

- Node.js 18+
- PostgreSQL数据库（测试环境）
- Redis（可选，用于缓存）
- 10GB+ 可用磁盘空间

## 第一步：安装工具

### macOS

```bash
# 安装k6
brew install k6

# 安装Node.js依赖
cd ops/loadtest
npm install

# 安装Artillery（可选）
npm install -g artillery@latest
```

### Ubuntu/Debian

```bash
# 安装k6
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6

# 安装Node.js依赖
cd ops/loadtest
npm install

# 安装Artillery（可选）
npm install -g artillery@latest
```

### Windows

```powershell
# 使用Chocolatey安装k6
choco install k6

# 安装Node.js依赖
cd ops\loadtest
npm install

# 安装Artillery（可选）
npm install -g artillery@latest
```

## 第二步：准备测试环境

### 1. 配置测试数据库

```bash
# 创建测试数据库
createdb funnypixels_test

# 运行数据库迁移
cd ../../backend
npm run migrate

# 返回loadtest目录
cd ../ops/loadtest
```

### 2. 生成测试用户

```bash
# 生成100个测试用户（快速测试）
node scripts/generate-test-users.js --count 100

# 或生成1000个测试用户（完整测试）
node scripts/generate-test-users.js --count 1000 --db-insert

# 导入到数据库（如果生成了SQL）
psql -U postgres -d funnypixels_test -f data/test-users.sql
```

### 3. 启动服务器

```bash
# 在新终端窗口中启动后端服务器
cd ../../backend
npm run dev

# 验证服务器运行
curl http://localhost:3001/health
```

## 第三步：运行第一个测试

### 选项A: k6快速测试（推荐新手）

```bash
# 10个用户，持续2分钟
k6 run --vus 10 --duration 2m k6/canvas-draw-load.js
```

预期输出:
```
     ✓ draw status 200
     ✓ pixel created

     pixel_draw_latency.............: avg=185.23ms p(95)=432.10ms
     pixel_draw_success.............: 245
     pixel_draw_failure.............: 5
     draw_success_rate..............: 98.00%
```

### 选项B: Node.js真实用户模拟

```bash
# 10个虚拟用户，持续5分钟
node scripts/realistic-user-simulator.js \
  --users 10 \
  --duration 300 \
  --verbose
```

预期输出:
```
╔═══════════════════════════════════════════════════════════════╗
║        FunnyPixels Realistic User Behavior Simulator         ║
╚═══════════════════════════════════════════════════════════════╝

Configuration:
  Users:           10
  Duration:        300s
  Base URL:        http://localhost:3001
  Test Region:     Beijing (Tiananmen)

Creating 10 virtual users...
Starting virtual users...
All users started. Test will run for 300s...
```

### 选项C: Artillery场景测试

```bash
# 运行多场景测试
artillery run artillery/canvas-scenario.yml
```

## 第四步：查看测试结果

### k6测试结果

k6会在终端输出详细的统计信息:

```
📊 测试摘要:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ 成功绘制: 245
❌ 失败绘制: 5
⚠️  冲突次数: 2
🔐 认证失败: 0
📈 成功率: 98.00%
⏱️  平均延迟: 185.23ms
⏱️  P95延迟: 432.10ms
⏱️  P99延迟: 876.54ms
🌐 HTTP错误率: 2.00%
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 保存结果到文件

```bash
# k6保存JSON报告
k6 run --vus 10 --duration 2m \
  --summary-export=reports/test-$(date +%Y%m%d-%H%M%S).json \
  k6/canvas-draw-load.js

# Node.js模拟器保存报告
node scripts/realistic-user-simulator.js \
  --users 10 \
  --duration 300 \
  --output reports/simulator-$(date +%Y%m%d-%H%M%S).json
```

## 第五步：清理测试数据

```bash
# 预览要删除的数据（不实际删除）
node scripts/cleanup-test-data.js --prefix load_test_ --dry-run

# 确认删除
node scripts/cleanup-test-data.js --prefix load_test_
```

## 常见测试场景

### 场景1: 单用户性能基线

```bash
k6 run --vus 1 --duration 5m k6/canvas-draw-load.js
```

**目标**: 建立性能基线
**验收标准**: 成功率 > 99.9%, 平均延迟 < 200ms

### 场景2: 中等负载测试

```bash
k6 run --vus 50 --duration 5m k6/canvas-draw-load.js
```

**目标**: 验证正常负载下的性能
**验收标准**: 成功率 > 99%, 平均延迟 < 300ms

### 场景3: 高负载压力测试

```bash
k6 run --vus 200 --duration 5m k6/canvas-draw-load.js
```

**目标**: 找到系统瓶颈
**验收标准**: 成功率 > 95%, P95延迟 < 500ms

### 场景4: WebSocket连接压力

```bash
k6 run --vus 100 --duration 5m k6/canvas-websocket-load.js
```

**目标**: 测试WebSocket最大连接数
**验收标准**: 连接成功率 > 99%, 消息延迟 < 200ms

### 场景5: 峰值流量模拟

```bash
node scripts/realistic-user-simulator.js \
  --users 100 \
  --duration 600 \
  --region beijing
```

**目标**: 模拟活动高峰期
**验收标准**: 整体成功率 > 98%, 用户体验良好

## 故障排查

### 问题1: 连接被拒绝

```bash
# 检查服务器是否运行
curl http://localhost:3001/health

# 如果没有响应，启动服务器
cd ../../backend
npm run dev
```

### 问题2: 数据库连接错误

```bash
# 检查PostgreSQL是否运行
pg_isready

# 检查数据库是否存在
psql -U postgres -c "\l" | grep funnypixels_test

# 创建数据库（如果不存在）
createdb funnypixels_test

# 运行迁移
cd ../../backend
npm run migrate
```

### 问题3: Redis错误

```bash
# 检查Redis是否运行
redis-cli ping

# 如果没有响应，启动Redis
redis-server

# 或使用Docker
docker run -d -p 6379:6379 redis:7-alpine
```

### 问题4: 测试用户点数不足

```bash
# 重新初始化测试用户状态
psql -U postgres -d funnypixels_test << EOF
UPDATE user_pixel_states
SET pixel_points = 100,
    natural_pixel_points = 100,
    freeze_until = 0
WHERE user_id LIKE 'load_test_%';
EOF
```

## 下一步

现在你已经成功运行了第一个负载测试！接下来可以:

1. **阅读完整文档**: [CANVAS_LOAD_TESTING_GUIDE.md](../../docs/testing/CANVAS_LOAD_TESTING_GUIDE.md)
2. **探索更多场景**: 查看 [README.md](README.md) 了解所有可用的测试场景
3. **自定义测试**: 修改测试脚本以适应你的需求
4. **设置监控**: 配置Grafana或其他监控工具
5. **集成CI/CD**: 将负载测试集成到持续集成流程

## 快速参考

### NPM脚本

```bash
npm run test:draw           # k6像素绘制测试
npm run test:websocket      # k6 WebSocket测试
npm run test:artillery      # Artillery场景测试
npm run test:simulator      # 真实用户模拟
npm run generate:users      # 生成测试用户
npm run cleanup             # 清理测试数据（dry-run）
```

### 环境变量

```bash
# API基础URL
export BASE_URL=http://localhost:3001

# WebSocket URL
export WS_URL=ws://localhost:3001/ws/tile-updates

# 测试区域
export REGION_LAT_MIN=39.90
export REGION_LAT_MAX=39.92
export REGION_LNG_MIN=116.39
export REGION_LNG_MAX=116.41
```

### 关键指标目标

| 指标 | 目标值 |
|------|--------|
| 像素绘制成功率 | > 95% |
| 平均响应时间 | < 300ms |
| P95响应时间 | < 500ms |
| P99响应时间 | < 1000ms |
| WebSocket连接成功率 | > 99% |
| WebSocket消息延迟 | < 200ms |

## 获取帮助

- 📖 [完整文档](README.md)
- 📊 [测试方案](../../docs/testing/CANVAS_LOAD_TESTING_GUIDE.md)
- 💬 技术支持: [Email/Slack]
- 🐛 问题反馈: GitHub Issues

---

祝测试顺利！
