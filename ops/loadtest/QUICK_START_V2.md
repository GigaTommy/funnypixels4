# FunnyPixels 压力测试系统 - 快速开始指南 v2.0

## 目录

1. [系统简介](#系统简介)
2. [快速开始](#快速开始)
3. [测试场景](#测试场景)
4. [监控和报告](#监控和报告)
5. [CI/CD集成](#cicd集成)
6. [故障排查](#故障排查)

---

## 系统简介

FunnyPixels压力测试系统v2.0是一个生产级的性能测试框架，包含:

- **6种高级K6测试** - 渐进、尖峰、耐久、压力、容量、用户旅程
- **2种WebSocket测试** - 连接极限、广播延迟
- **混合流量模拟器** - 真实用户行为模拟
- **完整监控方案** - Prometheus + Grafana
- **自动化CI/CD** - GitHub Actions集成
- **部署前质量门禁** - 自动化测试脚本

---

## 快速开始

### 前置要求

```bash
# 1. 安装Node.js (v18+)
node --version  # 应该 >= v18.0.0

# 2. 安装k6
# macOS
brew install k6

# Ubuntu/Debian
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg \
  --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | \
  sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6

# 3. 验证安装
k6 version
```

### 安装和配置

```bash
# 1. 进入loadtest目录
cd ops/loadtest

# 2. 安装依赖
npm install

# 3. 验证环境
npm run test:draw -- --vus 1 --duration 10s

# 4. 生成测试用户（首次使用）
npm run generate:users:large
```

---

## 测试场景

### 场景1: 快速验证 (5分钟)

适用于: 代码提交前的快速验证

```bash
npm run test:journey
```

预期结果:
- ✓ 成功率 > 95%
- ✓ P95延迟 < 500ms
- ✓ 无崩溃

### 场景2: 渐进式压力测试 (30分钟)

适用于: 每周性能回归测试

```bash
npm run test:gradual
```

这个测试将:
1. 从0用户逐步增长到5000用户
2. 在每个阶段稳定观察
3. 收集完整的性能数据

预期结果:
- ✓ 成功率 > 95%
- ✓ P95延迟 < 500ms
- ✓ 资源使用 < 80%
- ✓ 无性能衰退

### 场景3: 尖峰流量测试 (15分钟)

适用于: 验证突发流量承载能力

```bash
npm run test:spike
```

模拟场景:
- 基线: 100用户
- 尖峰: 500用户 (5x)
- 持续: 1分钟

预期结果:
- ✓ 尖峰期间成功率 > 90%
- ✓ 系统无崩溃
- ✓ 2分钟内恢复正常

### 场景4: 耐久性测试 (4小时)

适用于: 验证长期稳定性

```bash
npm run test:soak
```

检测:
- 内存泄漏
- 性能衰退
- 资源耗尽

预期结果:
- ✓ 成功率 > 98%
- ✓ 性能衰退 < 30%
- ✓ 无内存泄漏

### 场景5: 压力极限测试 (20分钟)

适用于: 找到系统崩溃点

```bash
npm run test:stress
```

持续增压直到系统失败，确定:
- 最大承载能力
- 瓶颈位置
- 降级表现

### 场景6: WebSocket专项测试 (10分钟)

```bash
# 连接数极限测试
npm run test:ws-limit

# 广播延迟测试
npm run test:ws-broadcast
```

预期结果:
- ✓ 连接成功率 > 99%
- ✓ 广播延迟 P95 < 200ms
- ✓ 支持10000+并发连接

### 场景7: 混合流量模拟 (10分钟)

适用于: 模拟真实用户行为

```bash
npm run test:mixed
```

用户分布:
- 60% 休闲用户 (偶尔绘制)
- 30% 活跃用户 (频繁绘制)
- 10% 艺术家 (大型作品)

---

## 监控和报告

### 启动监控 (可选)

如果需要实时监控，启动Prometheus和Grafana:

```bash
# 1. 启动Prometheus
prometheus --config.file=monitoring/prometheus-config.yml

# 2. 访问Prometheus
open http://localhost:9090

# 3. 启动Grafana (如果已安装)
grafana-server

# 4. 导入Dashboard
# 访问 http://localhost:3000
# 导入 monitoring/grafana-dashboard.json
```

### 生成测试报告

```bash
# 运行测试并保存结果
npm run test:gradual

# 生成HTML报告
node reporting/report-generator.js \
  --input reports/gradual-*.json \
  --output reports/gradual-report.html

# 在浏览器中查看
open reports/gradual-report.html
```

### 查看实时统计

测试运行时，k6会在终端显示实时统计:

```
     ✓ draw_success_rate........: 98.5%
     ✓ pixel_draw_latency.......: avg=285ms p95=456ms p99=789ms
     ✓ http_req_failed..........: 1.2%

     http_reqs...................: 12450 (205.8/s)
     pixel_draw_success..........: 12250
     pixel_draw_failure..........: 200
```

---

## CI/CD集成

### GitHub Actions自动化测试

测试会在以下情况自动运行:

1. **每周定时测试** - 周日凌晨2点
2. **PR到main分支** - 运行快速烟雾测试
3. **手动触发** - 通过GitHub Actions界面

### 手动触发测试

```bash
# 1. 访问GitHub仓库
# 2. 点击 Actions 标签
# 3. 选择 "Load Test" workflow
# 4. 点击 "Run workflow"
# 5. 选择测试类型和参数
# 6. 点击 "Run workflow" 确认
```

### 部署前测试

在部署到生产环境前，运行自动化测试:

```bash
# Staging环境测试
npm run test:pre-deploy

# Production环境测试
npm run test:pre-deploy:prod
```

测试脚本会:
1. 检查服务健康
2. 运行烟雾测试
3. 运行负载测试
4. 分析结果
5. 判定是否通过
6. 生成报告

如果测试失败，脚本会返回非零退出码，可以阻止部署。

---

## 故障排查

### 常见问题

#### 问题1: k6命令未找到

```bash
# 安装k6
brew install k6  # macOS
# 或参考上面的Ubuntu安装方法
```

#### 问题2: 数据库连接失败

```bash
# 检查数据库是否运行
psql -h localhost -U postgres -d funnypixels_test -c "SELECT 1;"

# 检查环境变量
echo $DATABASE_URL
```

#### 问题3: Redis连接失败

```bash
# 检查Redis
redis-cli ping  # 应该返回 PONG

# 启动Redis
redis-server
```

#### 问题4: 测试用户未生成

```bash
# 重新生成测试用户
npm run generate:users:large

# 验证文件存在
ls -lh data/test-users.json
```

#### 问题5: 端口冲突

```bash
# 检查3001端口是否被占用
lsof -i :3001

# 更改BASE_URL
export BASE_URL=http://localhost:3002
npm run test:draw
```

### 性能问题诊断

#### 高延迟

可能原因:
- 数据库查询慢 → 检查慢查询日志
- Redis缓存未命中 → 检查缓存命中率
- 网络带宽不足 → 检查网络使用

诊断命令:
```bash
# 数据库慢查询
psql -d funnypixels_test -c "SELECT * FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 10;"

# Redis缓存统计
redis-cli INFO stats

# 网络使用
iftop
```

#### 高错误率

可能原因:
- 连接池耗尽 → 增加pool size
- 超时设置过低 → 增加timeout
- 服务器资源不足 → 扩容

诊断命令:
```bash
# 数据库连接数
psql -d funnypixels_test -c "SELECT count(*) FROM pg_stat_activity;"

# 系统资源
top
htop
```

---

## 测试最佳实践

### 1. 从小开始

```bash
# 先测试1个用户
k6 run --vus 1 --duration 1m test.js

# 然后10个
k6 run --vus 10 --duration 2m test.js

# 再100个
k6 run --vus 100 --duration 5m test.js

# 最后1000+
npm run test:gradual
```

### 2. 使用独立测试环境

- ❌ 不要在生产环境测试
- ✅ 使用staging或专用测试环境
- ✅ 确保测试环境配置与生产相似

### 3. 定期测试

建立测试计划:
- 每日: 快速烟雾测试
- 每周: 完整回归测试
- 每月: 耐久性测试
- 每季度: 容量规划测试

### 4. 记录基线

第一次测试后，保存结果作为基线:

```bash
# 保存基线
cp reports/gradual-*.json reports/baseline.json

# 后续对比
node reporting/comparison-tool.js \
  --baseline reports/baseline.json \
  --current reports/gradual-*.json
```

### 5. 监控和告警

设置告警规则:
- 成功率 < 95%
- P95延迟 > 500ms
- 错误率 > 5%
- WebSocket连接失败率 > 5%

---

## 下一步

### 学习更多

- 📖 阅读 [PRODUCTION_TESTING_GUIDE.md](./PRODUCTION_TESTING_GUIDE.md) - 详细的生产测试指南
- 📊 查看 [COMPREHENSIVE_TESTING_SUMMARY.md](./COMPREHENSIVE_TESTING_SUMMARY.md) - 系统完整总结
- 🔧 参考 [README.md](./README.md) - 详细的工具文档

### 获取帮助

- 📧 Email: ops@funnypixels.com
- 💬 Slack: #performance-testing
- 🐛 Issue: [GitHub Issues](https://github.com/funnypixels/funnypixels/issues)

---

**版本**: v2.0.0
**更新日期**: 2026-02-25
**状态**: 生产就绪 ✅
