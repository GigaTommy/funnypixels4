# FunnyPixels 监控系统 - 快速开始

## 🎯 概述

本监控系统已完全集成到 admin-frontend 中，通过统一的 8000 端口访问，无需单独登录。

### 架构

```
开发环境架构（多端口）:
├── http://localhost:8000/              → Admin Frontend (管理后台)
│   └── /system/performance             → 性能监控页面 (iframe嵌入Grafana)
├── http://localhost:3000/              → Grafana (监控可视化)
├── http://localhost:9090/              → Prometheus (指标存储)
├── http://localhost:9093/              → Alertmanager (告警管理)
├── http://localhost:3001/              → Backend API
│   └── /metrics                        → Prometheus指标端点
│   └── /api/alerts/webhook             → 告警Webhook
├── http://localhost:5432/              → PostgreSQL (数据库)
└── http://localhost:6379/              → Redis (缓存)
```

## 🚀 快速开始

### 1. 启动所有服务

```bash
# 进入项目目录
cd /Users/ginochow/code/funnypixels3

# 启动监控系统（已集成到主docker-compose.yml）
docker-compose up -d

# 查看服务状态
docker-compose ps
```

### 2. 启动后端服务

```bash
# 在另一个终端窗口，启动后端服务
cd backend
npm start
```

### 3. 访问监控面板

**推荐方式（无需单独登录）**：

1. 打开浏览器访问：`http://localhost:8000`
2. 登录 admin-frontend
3. 点击左侧菜单 "系统管理" → "性能监控"
4. 查看实时监控数据（已嵌入 Grafana）

**直接访问方式（如需完整功能）**：

- Admin 管理后台：`http://localhost:8000/`
- Grafana 监控面板：`http://localhost:3000`
- Prometheus 查询：`http://localhost:9090`
- Alertmanager 告警：`http://localhost:9093`
- Backend API：`http://localhost:3001`

### 4. Grafana 默认账号

如需直接访问 Grafana 进行编辑：
- 用户名：`admin`
- 密码：`funnypixels2024`

（普通查看无需登录，已配置匿名访问）

## 📊 创建监控面板

### 方法 1：在 admin-frontend 中查看（推荐）

1. 登录 admin-frontend
2. 进入 "性能监控" 页面
3. 切换不同的 Tab 查看各类监控：
   - 系统总览
   - API 性能
   - 数据库
   - 用户活跃度
   - 告警

### 方法 2：在 Grafana 中创建 Dashboard

1. 访问 `http://localhost:8000/grafana/`
2. 使用管理员账号登录
3. 点击 "+" → "Dashboard"
4. 添加 Panel，选择 Prometheus 数据源
5. 输入 PromQL 查询，例如：
   ```promql
   # API 请求速率
   rate(http_request_duration_seconds_count[5m])

   # P95 响应时间
   histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))

   # 错误率
   rate(http_request_duration_seconds_count{status_code=~"5.."}[5m]) / rate(http_request_duration_seconds_count[5m])
   ```
6. 保存 Dashboard，记录 UID
7. 更新 admin-frontend 中的 Dashboard UID

### 更新 Dashboard UID

编辑 `/admin-frontend/src/pages/System/PerformanceMonitor.tsx`：

```typescript
const GRAFANA_DASHBOARDS = {
  overview: 'your-overview-dashboard-uid',    // 替换为你的 UID
  api: 'your-api-dashboard-uid',
  database: 'your-database-dashboard-uid',
  users: 'your-users-dashboard-uid',
  alerts: 'your-alerts-dashboard-uid'
}
```

## 📝 后端添加监控指标

### 1. 安装依赖（已安装）

```bash
cd backend
npm install prom-client
```

### 2. 创建指标收集器

```javascript
// backend/src/monitoring/metrics.js
const promClient = require('prom-client');

const register = new promClient.Registry();

// 默认指标（CPU、内存等）
promClient.collectDefaultMetrics({ register });

// 自定义指标
const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP请求耗时',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.5, 1, 2, 5]
});

register.registerMetric(httpRequestDuration);

module.exports = { register, httpRequestDuration };
```

### 3. 暴露 /metrics 端点

```javascript
// backend/src/server.js
const { register } = require('./monitoring/metrics');

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});
```

### 4. 添加中间件记录请求

```javascript
// backend/src/middleware/metricsMiddleware.js
const { httpRequestDuration } = require('../monitoring/metrics');

module.exports = (req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    httpRequestDuration
      .labels(req.method, req.route?.path || req.path, res.statusCode)
      .observe(duration);
  });

  next();
};
```

```javascript
// backend/src/server.js
const metricsMiddleware = require('./middleware/metricsMiddleware');
app.use(metricsMiddleware);
```

## 🔔 配置告警

### 1. 编辑告警规则

编辑 `prometheus/alerts.yml` 添加新规则：

```yaml
- alert: HighMemoryUsage
  expr: process_resident_memory_bytes / 1024 / 1024 > 512
  for: 10m
  labels:
    severity: warning
  annotations:
    summary: "内存使用过高"
    description: "内存使用超过512MB"
```

### 2. 重启 Prometheus

```bash
docker-compose -f docker-compose.monitoring.yml restart prometheus
```

### 3. 在 admin-frontend 查看告警

进入 "性能监控" → "告警" Tab，查看所有活跃告警。

## 🛠️ 常用命令

```bash
# 启动所有服务
docker-compose up -d

# 查看服务状态
docker-compose ps

# 查看服务日志
docker-compose logs -f grafana
docker-compose logs -f prometheus
docker-compose logs -f alertmanager

# 重启服务
docker-compose restart grafana
docker-compose restart prometheus

# 停止所有服务
docker-compose down

# 停止并删除数据卷
docker-compose down -v

# 只启动监控相关服务
docker-compose up -d grafana prometheus alertmanager
```

## 📈 监控指标说明

| 指标 | 说明 | PromQL |
|------|------|--------|
| QPS | 每秒请求数 | `rate(http_request_duration_seconds_count[1m])` |
| P95响应时间 | 95%请求的响应时间 | `histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))` |
| 错误率 | 5xx错误占比 | `rate(http_request_duration_seconds_count{status_code=~"5.."}[5m]) / rate(http_request_duration_seconds_count[5m])` |
| CPU使用率 | 进程CPU使用率 | `process_cpu_seconds_total` |
| 内存使用 | 进程内存使用（MB） | `process_resident_memory_bytes / 1024 / 1024` |

## 🎨 自定义面板样式

### 在 admin-frontend 中调整

编辑 `/admin-frontend/src/pages/System/PerformanceMonitor.tsx`：

```typescript
// 调整刷新间隔选项
<Option value="15s">15秒</Option>
<Option value="30s">30秒</Option>
<Option value="1m">1分钟</Option>

// 调整 iframe 高度
<GrafanaEmbed
  dashboardUid={GRAFANA_DASHBOARDS.overview}
  title="系统总览"
  height={900}  // 调整高度
  refresh={autoRefresh ? refreshInterval : ''}
/>
```

## 🔐 生产环境配置

### 1. 修改默认密码

编辑 `docker-compose.monitoring.yml`：

```yaml
grafana:
  environment:
    - GF_SECURITY_ADMIN_PASSWORD=your-secure-password
```

### 2. 配置 HTTPS

在生产环境使用 HTTPS 访问：

```nginx
server {
    listen 443 ssl http2;
    server_name admin.funnypixels.com;

    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;

    location / {
        proxy_pass http://nginx:8000;
    }
}
```

### 3. 配置邮件告警

编辑 `alertmanager/alertmanager.yml`：

```yaml
receivers:
  - name: 'email'
    email_configs:
      - to: 'ops@funnypixels.com'
        from: 'alerts@funnypixels.com'
        smarthost: 'smtp.gmail.com:587'
        auth_username: 'alerts@funnypixels.com'
        auth_password: 'your-app-password'
```

## ❓ 常见问题

### Q: admin-frontend 显示空白？

A: 需要先在 Grafana 中创建对应的 Dashboard，并更新 UID。

### Q: 监控数据不显示？

A:
1. 确认后端已暴露 `/metrics` 端点
2. 访问 `http://localhost:8000/prometheus/targets` 检查 Target 状态
3. 确认 Backend 正在运行

### Q: 无法嵌入 Grafana？

A: 检查 Grafana 配置：
- `GF_SECURITY_ALLOW_EMBEDDING=true` 已设置
- `GF_AUTH_ANONYMOUS_ENABLED=true` 已启用

### Q: 如何添加新的 Dashboard？

A:
1. 在 Grafana 中创建 Dashboard
2. 记录 Dashboard UID
3. 更新 `PerformanceMonitor.tsx` 中的 `GRAFANA_DASHBOARDS`

## 📚 进一步学习

- [Grafana 官方文档](https://grafana.com/docs/)
- [Prometheus 查询语言](https://prometheus.io/docs/prometheus/latest/querying/basics/)
- [Node.js Prometheus 客户端](https://github.com/siimon/prom-client)

---

**成功！** 🎉

现在你可以在 admin-frontend 中查看实时监控数据，无需单独登录 Grafana！
