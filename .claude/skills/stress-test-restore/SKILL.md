---
name: stress-test-restore
description: Restore environment after stress testing. Reverts auth rate limits, DB pool config, and optionally cleans up test users from the database.
context: fork
agent: general-purpose
allowed-tools: Read, Edit, Bash(psql *), Bash(PGPASSWORD=*), Bash(curl *), Bash(touch *)
argument-hint: [clean-users] (optional, also removes test users from DB)
---

# 压力测试环境恢复

将压力测试期间临时修改的所有配置恢复为原始值，确保开发环境恢复正常状态。

## 参数
选项: $ARGUMENTS
- 无参数: 只恢复配置，保留测试用户
- `clean-users`: 恢复配置 + 清理测试用户数据

## 恢复流程

### 第 1 步: 恢复 Auth 限流

**文件:** `backend/src/middleware/rateLimit.js`

找到 `authLimiter` 行（约第 160 行），将 `5000` 恢复为 `5`：

```javascript
// 恢复前（压测配置）:
authLimiter: createRateLimiter(15 * 60 * 1000, 5000, '登录尝试次数过多，请15分钟后再试', 'rl:auth'), // 临时提高到5000次（压测用），原值: 5

// 恢复后（正常配置）:
authLimiter: createRateLimiter(15 * 60 * 1000, 5, '登录尝试次数过多，请15分钟后再试', 'rl:auth'), // 15分钟5次
```

**操作:** 使用 Edit 工具精确替换，确保：
1. `max` 参数从 `5000` 改回 `5`
2. 删除压测相关注释（`临时提高到5000次（压测用），原值: 5`）
3. 恢复原始注释（`15分钟5次`）

### 第 2 步: 验证 DB 连接池配置

**文件:** `backend/knexfile.js`

确认 pool max 默认值为 50（cluster 模式下自动按 worker 数平分，单进程模式下 clusterWorkers=1 不影响）：

```javascript
// 正常配置（无需修改，已支持 cluster 自动分配）:
const clusterWorkers = parseInt(process.env.CLUSTER_WORKERS || '1');
pool: {
  min: parseInt(process.env.DB_POOL_MIN || '5'),
  max: Math.floor(parseInt(process.env.DB_POOL_MAX || '50') / clusterWorkers),
  ...
}
```

单进程模式下 `CLUSTER_WORKERS` 未设置，默认 1，pool max = 50/1 = 50。无需修改。

### 第 3 步: 停止 Cluster 模式，恢复单进程启动

```bash
# 停止 cluster 模式的所有 worker 进程
lsof -ti :3001 | xargs kill -9 2>/dev/null || true
sleep 2

# 以 nodemon 单进程模式重启（正常开发模式）
cd backend && npm run dev &
sleep 5

# 验证后端重启（单进程模式）
curl -s http://localhost:3001/api/health
```

**验证:** 日志中不应出现 `[Cluster]` 字样，uptime 较短说明已重启。

### 第 4 步: 验证恢复结果

```bash
# 读取并确认 rateLimit.js 中 authLimiter 的值
grep -n "authLimiter" backend/src/middleware/rateLimit.js

# 读取并确认 knexfile.js 中 pool 的值
grep -A2 "pool:" backend/knexfile.js | head -5

# 测试限流是否生效（可选）
# 连续发 6 次登录请求，第 6 次应该被限流
for i in $(seq 1 6); do
  echo -n "Request $i: "
  curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3001/api/auth/login \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"test@test.com\",\"password\":\"wrong\"}"
  echo ""
done
```

### 第 5 步: 清理测试用户（可选）

仅当参数包含 `clean-users` 时执行。

```bash
# 统计即将删除的用户数
PGPASSWORD=password psql -h localhost -U postgres -d funnypixels_postgres -c "
SELECT COUNT(*) as users_to_delete FROM users WHERE email LIKE '%@loadtest.example.com';
"

# 删除用户像素状态
PGPASSWORD=password psql -h localhost -U postgres -d funnypixels_postgres -c "
DELETE FROM user_pixel_states
WHERE user_id::text IN (SELECT id::text FROM users WHERE email LIKE '%@loadtest.example.com');
"

# 删除测试用户绘制的像素（可选，谨慎操作）
PGPASSWORD=password psql -h localhost -U postgres -d funnypixels_postgres -c "
DELETE FROM pixels
WHERE user_id::text IN (SELECT id::text FROM users WHERE email LIKE '%@loadtest.example.com');
"

# 删除测试用户
PGPASSWORD=password psql -h localhost -U postgres -d funnypixels_postgres -c "
DELETE FROM users WHERE email LIKE '%@loadtest.example.com';
"

# 验证清理结果
PGPASSWORD=password psql -h localhost -U postgres -d funnypixels_postgres -c "
SELECT COUNT(*) as remaining_test_users FROM users WHERE email LIKE '%@loadtest.example.com';
"
```

**注意:** 删除操作不可逆。执行前确认用户想要清理。如果不传 `clean-users` 参数，测试用户保留在数据库中供后续测试复用。

**重要:** 删除测试用户的像素数据前，要考虑是否有外键约束或级联删除。如果有外键错误，需要先删除关联数据。

### 第 6 步: 清理测试报告文件（可选）

测试报告默认保留供分析。如果需要清理：

```bash
# 列出报告文件
ls -la ops/loadtest/reports/stress-10k-*

# 清理（仅在用户确认后）
# rm ops/loadtest/reports/stress-10k-*
```

## 恢复检查清单

### 配置恢复
- [ ] authLimiter max: 5000 -> 5
- [ ] Cluster 模式已停止，恢复单进程启动
- [ ] DB pool max: 50 (单进程，clusterWorkers=1)
- [ ] 后端已重启并加载新配置

### 验证
- [ ] Auth 限流正常工作（6次请求后被限流）
- [ ] DB pool 恢复为正常大小

### 可选清理
- [ ] 测试用户已从数据库删除（仅 clean-users 模式）
- [ ] 测试用户的像素数据已清理（仅 clean-users 模式）
- [ ] 测试报告已清理或归档

## 输出

恢复完成后，输出以下信息供用户确认：

```
========================================
  压力测试环境恢复完成
========================================

配置恢复:
  Auth Rate Limit: 5000 -> 5 (已恢复)
  Cluster Mode: 已停止，恢复单进程
  DB Pool Max: 50 (单进程)
  Backend: 已重启 (nodemon 开发模式)

数据清理:
  测试用户: [保留 / 已删除 N 条]
  测试像素: [保留 / 已删除 N 条]

验证:
  Auth 限流: 正常
  DB 配置: 正常
  后端健康: OK

环境已恢复正常开发状态。
========================================
```

## 安全注意事项

1. **不要在生产环境运行** - 此 skill 修改限流和数据库配置
2. **删除操作不可逆** - `clean-users` 模式会永久删除数据
3. **检查外键约束** - 删除用户前确认无级联影响
4. **保留报告** - 建议在清理前备份或归档测试报告

---

**执行此 skill**: `/stress-test-restore`（只恢复配置）
**恢复并清理用户**: `/stress-test-restore clean-users`
