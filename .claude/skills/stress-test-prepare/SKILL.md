---
name: stress-test-prepare
description: Prepare environment for 10K stress testing. Generates test users, imports to DB, raises auth rate limits, increases DB connection pool, and verifies system readiness.
context: fork
agent: general-purpose
allowed-tools: Read, Write, Edit, Glob, Grep, Bash(node *), Bash(psql *), Bash(ulimit *), Bash(docker *), Bash(curl *), Bash(PGPASSWORD=*)
argument-hint: [user-count] (default: 1100)
---

# 压力测试环境准备

自动化准备 10K 在线用户 + 1000 并发写入压力测试所需的环境。

## 参数
用户数量: $ARGUMENTS（默认 1100）

## 准备流程

### 第 1 步: 环境检查

在开始之前，验证所有前置条件：

```bash
# 1. 检查后端是否运行
curl -s http://localhost:3001/api/health | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'Backend OK, uptime: {d[\"uptime\"]:.0f}s')"

# 2. 检查 PostgreSQL 连接
PGPASSWORD=password psql -h localhost -U postgres -d funnypixels_postgres -c "SELECT 1 as ok;" -t

# 3. 检查 k6 已安装
k6 version

# 4. 检查当前 max_connections
PGPASSWORD=password psql -h localhost -U postgres -d funnypixels_postgres -c "SHOW max_connections;" -t
```

**判断标准:**
- 后端 health 返回 200
- PostgreSQL 可连接
- k6 已安装
- max_connections >= 500

如果 max_connections < 500，提醒用户需要在 PostgreSQL 配置中调整。

### 第 2 步: 生成测试用户并导入数据库

```bash
# 生成用户 JSON + SQL
cd ops/loadtest
node scripts/generate-test-users.js --count 1100 --db-insert --csv

# 导入到数据库（Docker PostgreSQL）
PGPASSWORD=password psql -h localhost -U postgres -d funnypixels_postgres -f data/test-users.sql

# 设置 pixel_points = 999999（避免测试中耗尽）
PGPASSWORD=password psql -h localhost -U postgres -d funnypixels_postgres -c "
UPDATE user_pixel_states
SET pixel_points = 999999, natural_pixel_points = 999999, max_natural_pixel_points = 999999
WHERE user_id::text IN (SELECT id::text FROM users WHERE email LIKE '%@loadtest.example.com');
"

# 验证
PGPASSWORD=password psql -h localhost -U postgres -d funnypixels_postgres -c "
SELECT COUNT(*) as total_test_users FROM users WHERE email LIKE '%@loadtest.example.com';
SELECT COUNT(*) as users_with_max_points FROM user_pixel_states ups JOIN users u ON ups.user_id::text = u.id::text WHERE u.email LIKE '%@loadtest.example.com' AND ups.pixel_points = 999999;
"
```

**注意:** `psql` 路径可能需要调整。Docker 环境下使用 `-h localhost` 参数。如果 `psql` 不在 PATH 中，尝试：
- macOS Homebrew: `/opt/homebrew/opt/postgresql@16/bin/psql`
- Linux: `/usr/bin/psql`

**验证标准:**
- 测试用户数 >= $ARGUMENTS（默认 1100）
- 所有用户 pixel_points = 999999

### 第 3 步: 临时提高 Auth 限流

Auth 登录限流使用 IP 作为 key（未认证时），所有 k6 VU 共享 `ip:127.0.0.1`。默认 5次/15分钟会导致 setup 阶段只能登录 5 个用户。

**修改文件:** `backend/src/middleware/rateLimit.js`

找到 `authLimiter` 行（约第 160 行），将 `max` 参数从 `5` 修改为 `5000`：

```javascript
// 修改前:
authLimiter: createRateLimiter(15 * 60 * 1000, 5, '登录尝试次数过多，请15分钟后再试', 'rl:auth'),

// 修改后:
authLimiter: createRateLimiter(15 * 60 * 1000, 5000, '登录尝试次数过多，请15分钟后再试', 'rl:auth'), // 临时提高到5000次（压测用），原值: 5
```

**重要:** 在注释中标注原值，方便 `stress-test-restore` 恢复。

### 第 4 步: 验证 DB 连接池配置

**文件:** `backend/knexfile.js`

检查 development 配置的 pool `max` 值。当前配置为 50，自动按 `CLUSTER_WORKERS` 平分（2 workers = 25/worker）。

确保 pool max 默认值为 50：

```javascript
pool: {
  min: parseInt(process.env.DB_POOL_MIN || '5'),
  max: Math.floor(parseInt(process.env.DB_POOL_MAX || '50') / clusterWorkers),
  ...
}
```

同时确保 PostgreSQL `max_connections` >= 500（需大于连接池 max）：
```bash
PGPASSWORD=password psql -h localhost -U postgres -c "SHOW max_connections;" -t
# 如果 < 500:
PGPASSWORD=password psql -h localhost -U postgres -c "ALTER SYSTEM SET max_connections = 500;"
docker restart funnypixels_postgres
```

### 第 5 步: 以 Cluster 模式启动后端

压测需要使用 cluster 模式（2 workers）来充分利用多核 CPU。

**先停止现有后端进程**（nodemon 或单进程）：

```bash
# 查找并停止现有后端进程
lsof -ti :3001 | xargs kill -9 2>/dev/null || true
sleep 2
```

**以 cluster 模式启动后端:**

```bash
cd backend
CLUSTER_WORKERS=2 node src/cluster.js &
sleep 5
curl -s http://localhost:3001/api/health
```

**验证 cluster 模式运行:**
- 检查日志中出现 `[Cluster] Primary ... starting 2 workers`
- 检查日志中出现两个 `Worker ... is online`
- health 端点返回 200

**重要:** cluster 模式下单例定时服务（排行榜维护、漂流瓶等）仅在 Worker 1 运行，所有 worker 共同处理 HTTP 请求。每个 worker 的连接池 max = 50/2 = 25，总连接数 = 50。

### 第 6 步: 提高 OS 文件描述符限制

k6 运行 3000 个 VU 需要大量 TCP 连接。macOS 默认 fd 限制为 256，需要提高：

```bash
ulimit -n 65536
```

**注意:** 此设置仅在当前 shell 会话中生效。用户需要在运行 k6 的同一 terminal 中执行此命令。

### 第 7 步: 烟测验证

运行一个最小规模的烟测来验证所有准备工作：

```bash
cd ops/loadtest
k6 run --env SMOKE=true k6/stress-10k-mixed.js
```

**烟测标准:**
- Setup 阶段所有用户登录成功
- 写入请求成功率 > 50%（小范围坐标冲突是正常的）
- 读取请求成功率 = 100%
- 无 5xx 错误
- 无 401/403 认证错误

## 准备完成检查清单

### 基础设施
- [ ] PostgreSQL 运行中，max_connections >= 500
- [ ] 后端运行中，已加载最新配置
- [ ] k6 已安装

### 数据
- [ ] 1100+ 测试用户已入库
- [ ] 所有用户 pixel_points = 999999

### 配置变更
- [ ] authLimiter max: 5 -> 5000
- [ ] DB pool max >= 50 (cluster 2 workers × 25/worker)
- [ ] 后端以 cluster 模式启动 (CLUSTER_WORKERS=2)
- [ ] ulimit -n 65536

### 验证
- [ ] 烟测通过（5 writers + 10 readers）

## 输出

准备完成后，输出以下信息供用户确认：

```
========================================
  压力测试环境准备完成
========================================

数据库:
  测试用户: 1100
  Pixel Points: 999999
  Max Connections: 500

配置变更:
  Auth Rate Limit: 5 -> 5000
  DB Pool Max: 50 (25/worker × 2 workers)
  Cluster Mode: 2 workers
  FD Limit: 65536

烟测结果:
  Login: XX/XX success
  Write Success Rate: XX%
  Read Success Rate: XX%

下一步:
  运行 /stress-test-run smoke   (烟测)
  运行 /stress-test-run full    (正式测试)
========================================
```

## 常见问题

### psql 命令找不到
macOS 上如果通过 Homebrew 安装 PostgreSQL，路径可能是：
```bash
/opt/homebrew/opt/postgresql@16/bin/psql
/opt/homebrew/opt/postgresql@15/bin/psql
```

### 后端未自动重启
手动重启后端：
```bash
# 找到并杀死现有进程
lsof -i :3001
# 重新启动
cd backend && npm run dev
```

### 烟测 setup 超时
增加 setupTimeout 或减少登录用户数。烟测模式已自动只登录最少需要的用户数。

---

**执行此 skill**: `/stress-test-prepare`
**指定用户数**: `/stress-test-prepare 2000`
