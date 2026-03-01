---
name: deploy-ready
description: Pre-deployment checklist and validation. Use before deploying to production to ensure everything is ready.
allowed-tools: Read, Bash(git *), Bash(npm *), Bash(psql *)
disable-model-invocation: false
---

# 部署就绪检查

部署前的最终验证，确保安全部署到生产环境。

## 部署前检查清单

### 1. 代码质量 (5分钟)

#### Git 状态检查
```bash
# 确保在正确的分支
git branch --show-current

# 检查是否有未提交的更改
git status

# 检查是否与远程同步
git fetch
git status
```

**要求:**
- [ ] 在正确的部署分支（main/production）
- [ ] 无未提交的更改
- [ ] 与远程仓库同步

#### 代码审查状态
```bash
# 检查 PR 状态（如果使用 GitHub）
gh pr view --json state,reviews,mergeable

# 或检查 git log
git log --oneline -10
```

**要求:**
- [ ] 所有 PR 已审查并批准
- [ ] 无待解决的评论
- [ ] CI/CD 检查通过

### 2. 测试验证 (10分钟)

#### 运行完整测试套件
```bash
# 后端测试
cd backend
npm test

# iOS 测试
cd ../FunnyPixelsApp
xcodebuild test -scheme FunnyPixels
```

**要求:**
- [ ] 所有测试通过（0 失败）
- [ ] 测试覆盖率 > 80%
- [ ] 无跳过的测试

#### 集成测试
```bash
# 启动测试环境
npm run test:integration

# 验证关键流程
- 用户注册/登录
- 分享奖励
- 邀请奖励
- VIP 订阅
- 支付流程
```

### 3. 数据库准备 (10分钟)

#### 备份当前数据库
```bash
# 生产数据库备份
BACKUP_FILE="funnypixels_backup_$(date +%Y%m%d_%H%M%S).sql"
pg_dump -U funnypixels_user funnypixels_db > $BACKUP_FILE

# 验证备份文件
ls -lh $BACKUP_FILE
```

#### 迁移脚本验证
```bash
# 在测试数据库上运行迁移
npx knex migrate:latest --env test

# 验证表结构
psql -d funnypixels_db_test -c "\d+ share_tracking"
psql -d funnypixels_db_test -c "\d+ vip_subscriptions"

# 回滚测试
npx knex migrate:rollback --env test
npx knex migrate:latest --env test
```

**要求:**
- [ ] 数据库备份完成
- [ ] 迁移脚本在测试环境通过
- [ ] 回滚脚本验证通过
- [ ] 无数据丢失风险

### 4. 配置和环境 (5分钟)

#### 环境变量检查
```bash
# 检查必需的环境变量
cat > check_env.sh << 'EOF'
#!/bin/bash
required_vars=(
  "DATABASE_URL"
  "JWT_SECRET"
  "API_BASE_URL"
  "WECHAT_APP_ID"
  "ALIPAY_APP_ID"
  "APPLE_TEAM_ID"
)

for var in "${required_vars[@]}"; do
  if [ -z "${!var}" ]; then
    echo "❌ Missing: $var"
  else
    echo "✅ Set: $var"
  fi
done
EOF

chmod +x check_env.sh
./check_env.sh
```

#### 配置文件验证
```bash
# 检查配置文件
cat backend/config/pricing.js
cat backend/config/vip.js

# 验证配置格式
node -e "require('./backend/config/pricing.js')"
node -e "require('./backend/config/vip.js')"
```

**要求:**
- [ ] 所有环境变量已设置
- [ ] 配置文件格式正确
- [ ] API 密钥有效
- [ ] 数据库连接字符串正确

### 5. 依赖和构建 (10分钟)

#### 依赖检查
```bash
# 检查过期的依赖
npm outdated

# 检查安全漏洞
npm audit

# 检查许可证
npm run license-check
```

#### 构建测试
```bash
# 后端构建
cd backend
npm run build

# iOS 构建
cd ../FunnyPixelsApp
xcodebuild clean build \
  -scheme FunnyPixels \
  -configuration Release
```

**要求:**
- [ ] 无高危安全漏洞
- [ ] 依赖版本锁定（package-lock.json）
- [ ] 构建成功（0 错误，0 警告）
- [ ] 构建产物大小合理

### 6. 性能基准 (10分钟)

#### API 性能测试
```bash
# 启动服务器
npm start &
SERVER_PID=$!

# 等待服务器启动
sleep 5

# 测试关键端点
endpoints=(
  "/api/share/stats"
  "/api/referral/stats"
  "/api/vip/subscriptions"
  "/api/users/profile"
)

for endpoint in "${endpoints[@]}"; do
  echo "Testing $endpoint"
  curl -w "Time: %{time_total}s\n" \
    -H "Authorization: Bearer $TOKEN" \
    -o /dev/null -s \
    http://localhost:3000$endpoint
done

# 停止服务器
kill $SERVER_PID
```

**性能基准:**
- [ ] 所有端点响应 < 200ms
- [ ] 无超时错误
- [ ] 内存占用稳定
- [ ] CPU 使用合理

#### 数据库性能
```bash
# 检查慢查询
psql -d funnypixels_db << EOF
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
EOF

# 检查索引使用
psql -d funnypixels_db -c "
  SELECT tablename, indexname, idx_scan
  FROM pg_stat_user_indexes
  WHERE idx_scan < 100
  ORDER BY idx_scan;
"
```

**要求:**
- [ ] 无慢查询（> 500ms）
- [ ] 索引使用率正常
- [ ] 无未使用的索引
- [ ] 连接池配置合理

### 7. 监控和日志 (5分钟)

#### 错误监控
```bash
# 验证 Sentry 配置
curl -X POST https://sentry.io/api/0/projects/funnypixels/test/ \
  -H "Authorization: Bearer $SENTRY_TOKEN"

# 测试错误上报
node -e "
  const Sentry = require('@sentry/node');
  Sentry.init({ dsn: process.env.SENTRY_DSN });
  Sentry.captureMessage('Deployment test');
"
```

#### 日志配置
```bash
# 检查日志目录
ls -lh logs/

# 验证日志轮转配置
cat /etc/logrotate.d/funnypixels

# 测试日志写入
npm run log:test
```

**要求:**
- [ ] Sentry 配置正确
- [ ] 日志聚合工作正常
- [ ] 日志轮转配置
- [ ] 关键指标埋点

### 8. 安全检查 (10分钟)

#### 安全扫描
```bash
# npm 审计
npm audit --production

# OWASP 依赖检查
npm run security:check

# 代码安全扫描
npm run security:scan
```

#### SSL/TLS 验证
```bash
# 检查证书有效性
echo | openssl s_client -connect api.funnypixels.com:443 2>/dev/null | \
  openssl x509 -noout -dates

# 检查证书链
curl -v https://api.funnypixels.com 2>&1 | grep -A5 "SSL certificate"
```

#### 认证测试
```bash
# 测试未认证访问（应返回 401）
curl -I http://localhost:3000/api/share/stats

# 测试过期 token（应返回 401）
curl -I -H "Authorization: Bearer EXPIRED_TOKEN" \
  http://localhost:3000/api/share/stats

# 测试无效 token（应返回 401）
curl -I -H "Authorization: Bearer INVALID_TOKEN" \
  http://localhost:3000/api/share/stats
```

**要求:**
- [ ] 无高危安全漏洞
- [ ] SSL 证书有效（> 30 天）
- [ ] 认证/授权正确
- [ ] 敏感数据加密

### 9. 回滚计划 (5分钟)

#### 准备回滚脚本
```bash
cat > rollback.sh << 'EOF'
#!/bin/bash
set -e

echo "🔄 Starting rollback..."

# 1. 停止新版本服务
echo "Stopping services..."
pm2 stop funnypixels-api

# 2. 回滚代码
echo "Rolling back code..."
git checkout main
git reset --hard $PREVIOUS_COMMIT

# 3. 回滚数据库
echo "Rolling back database..."
psql -U funnypixels_user funnypixels_db < $BACKUP_FILE

# 4. 重启服务
echo "Restarting services..."
pm2 restart funnypixels-api

echo "✅ Rollback complete"
EOF

chmod +x rollback.sh
```

#### 验证回滚脚本
```bash
# 在测试环境验证
# （不要在生产环境执行！）
./rollback.sh --dry-run
```

**要求:**
- [ ] 回滚脚本准备完毕
- [ ] 数据库备份已确认
- [ ] 回滚步骤已文档化
- [ ] 团队成员知晓回滚流程

### 10. 部署计划 (5分钟)

#### 部署时间窗口
```markdown
- 部署日期：2026-02-XX
- 部署时间：凌晨 2:00-4:00（低峰期）
- 预计停机时间：< 5 分钟
- 负责人：XXX
- 备份负责人：XXX
```

#### 部署步骤
```bash
# 1. 维护模式
echo "🔧 Entering maintenance mode..."
pm2 stop funnypixels-api

# 2. 数据库迁移
echo "📊 Running migrations..."
cd backend
npx knex migrate:latest

# 3. 部署代码
echo "🚀 Deploying code..."
git pull origin main
npm install --production
npm run build

# 4. 重启服务
echo "♻️ Restarting services..."
pm2 restart funnypixels-api

# 5. 健康检查
echo "🏥 Health check..."
curl -f http://localhost:3000/health || exit 1

# 6. 退出维护模式
echo "✅ Deployment complete!"
```

#### 部署后验证
```bash
# 烟雾测试脚本
cat > smoke_test.sh << 'EOF'
#!/bin/bash
echo "🧪 Running smoke tests..."

# 测试关键端点
curl -f http://api.funnypixels.com/health
curl -f http://api.funnypixels.com/api/share/stats
curl -f http://api.funnypixels.com/api/referral/stats

# 测试数据库
psql -d funnypixels_db -c "SELECT COUNT(*) FROM users;"

# 检查错误日志
tail -n 50 logs/error.log | grep -i error

echo "✅ Smoke tests passed"
EOF
```

## 最终检查清单

### 阻塞性问题（必须解决）
- [ ] 所有测试通过
- [ ] 数据库备份完成
- [ ] 无高危安全漏洞
- [ ] 环境变量配置正确
- [ ] 回滚计划准备完毕

### 重要问题（建议解决）
- [ ] 性能达标
- [ ] 监控配置完成
- [ ] 文档更新
- [ ] 团队通知发出

### 可选项（可部署后处理）
- [ ] 依赖更新
- [ ] 代码重构
- [ ] 优化改进

## 部署决策

### ✅ 可以部署

所有阻塞性问题已解决：
- 测试通过率 100%
- 安全检查通过
- 备份和回滚准备完毕
- 团队准备就绪

### ⚠️ 有条件部署

部分重要问题未解决：
- 性能略低于目标但可接受
- 非关键功能有小问题
- 已有改进计划

### ❌ 推迟部署

存在阻塞性问题：
- 测试失败
- 安全漏洞
- 回滚计划不完善
- 团队未准备好

## 输出报告

```markdown
# 部署就绪报告
日期：$(date)

## 部署信息
- 版本：v1.2.0
- 分支：main
- 提交：abc1234
- 负责人：XXX

## 检查结果
- 代码质量：✅ PASSED
- 测试验证：✅ PASSED (100%, 0 failures)
- 数据库：✅ PASSED (backup: 500MB)
- 配置：✅ PASSED
- 性能：✅ PASSED (avg 120ms)
- 安全：✅ PASSED (0 critical)
- 监控：✅ PASSED

## 部署计划
- 时间窗口：2026-02-XX 02:00-04:00
- 预计停机：< 5 分钟
- 回滚准备：✅ READY

## 风险评估
- 风险等级：LOW
- 潜在影响：最小
- 缓解措施：已准备

## 批准
- 技术负责人：✅ 批准
- 产品经理：✅ 批准
- 运维团队：✅ 批准

## 结论
✅ 可以部署
```

---

**执行此 skill**: `/deploy-ready`
