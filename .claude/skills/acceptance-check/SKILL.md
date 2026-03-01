---
name: acceptance-check
description: Verify acceptance criteria for features before deployment. Use to validate that all requirements are met and the feature is production-ready.
context: fork
agent: general-purpose
allowed-tools: Read, Grep, Glob, Bash(git *), Bash(npm *), Bash(curl *)
argument-hint: [feature-name or branch-name]
---

# 验收标准检查

系统化验证功能是否满足所有验收标准，确保生产就绪。

## 检查目标
功能/分支: $ARGUMENTS

## 验收流程

### 阶段 1: 需求验证 (5分钟)

#### 1. 功能需求对照

检查实施文档中的需求是否全部实现：

**对于病毒式营销功能:**
- [ ] 分享奖励：每次分享奖励 5 积分
- [ ] 追踪链接：生成包含邀请码的分享链接
- [ ] 分层奖励：邀请奖励根据数量递增（50→80→120→200）
- [ ] 里程碑奖励：5人、20人、50人触发特殊奖励
- [ ] 二级邀请：间接邀请奖励 10 积分
- [ ] VIP 会员：三个等级（Normal、Premium、Elite）
- [ ] 商城折扣：VIP 享受 10%/20%/30% 折扣
- [ ] 每日签到：VIP 每日领取积分

#### 2. 用户故事验证

```
作为一个用户，
当我分享会话到微信时，
应该立即获得 5 积分奖励，
并且看到奖励提示动画。
```

**验证步骤:**
1. 完成一次绘制会话
2. 点击分享按钮
3. 选择微信
4. 确认获得 5 积分
5. 确认看到奖励提示

### 阶段 2: 功能测试 (15分钟)

#### 测试矩阵

| 功能 | 正常场景 | 边界情况 | 错误处理 | 性能 |
|------|---------|---------|---------|------|
| 分享奖励 | ✓ | ✓ | ✓ | ✓ |
| 邀请系统 | ✓ | ✓ | ✓ | ✓ |
| VIP 订阅 | ✓ | ✓ | ✓ | ✓ |

#### 1. 分享奖励测试

**正常场景:**
```bash
# 测试分享 API
curl -X POST http://localhost:3000/api/share/record-action \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "shareType": "session",
    "shareTarget": "wechat",
    "sessionId": "test-session-id"
  }'

# 预期响应
{
  "success": true,
  "reward": 5,
  "trackingUrl": "https://...",
  "shareId": "uuid"
}
```

**边界情况:**
- 快速连续分享（防刷）
- sessionId 不存在
- 未登录用户分享

**错误处理:**
- 网络断开
- 服务器错误
- 无效 token

#### 2. 邀请系统测试

**分层奖励验证:**
```bash
# 查询用户邀请统计
curl http://localhost:3000/api/referral/stats \
  -H "Authorization: Bearer $TOKEN"

# 验证响应包含
{
  "currentTier": { "level": 2, "inviterReward": 80 },
  "nextTier": { "threshold": 15, "remaining": 3 }
}
```

**里程碑测试:**
- 邀请第 5 人触发 500 积分 + 成就
- 邀请第 20 人触发 VIP 7 天
- 邀请第 50 人触发永久 VIP Elite

#### 3. VIP 订阅测试

**订阅流程:**
1. 打开 VIP 页面
2. 选择等级（Premium）
3. 点击订阅
4. 完成支付（测试环境）
5. 验证 VIP 状态激活
6. 验证权益生效（折扣、每日积分）

### 阶段 3: 代码质量检查 (10分钟)

#### 1. 代码审查清单

**架构和设计:**
- [ ] 遵循项目架构模式
- [ ] 模块职责单一
- [ ] 依赖注入正确使用
- [ ] 避免循环依赖

**代码规范:**
- [ ] Swift/JavaScript 代码规范
- [ ] 命名清晰有意义
- [ ] 注释充分（复杂逻辑）
- [ ] 无 TODO/FIXME 标记

**错误处理:**
- [ ] 所有异步操作有错误处理
- [ ] 用户友好的错误消息
- [ ] 错误日志记录
- [ ] 优雅降级

**性能:**
- [ ] 无 N+1 查询
- [ ] 图片懒加载
- [ ] 列表分页
- [ ] 缓存策略

**安全:**
- [ ] 输入验证
- [ ] SQL 注入防护
- [ ] XSS 防护
- [ ] 敏感数据加密
- [ ] 认证和授权正确

#### 2. 静态分析

**后端:**
```bash
# ESLint
npm run lint

# TypeScript 类型检查（如适用）
npx tsc --noEmit
```

**iOS:**
```bash
# SwiftLint
swiftlint

# Xcode 静态分析
xcodebuild analyze -scheme FunnyPixels
```

#### 3. 依赖检查

```bash
# 检查过期依赖
npm outdated

# 检查安全漏洞
npm audit

# 检查许可证合规
npm run license-check
```

### 阶段 4: 测试覆盖验证 (5分钟)

#### 覆盖率要求

- **总体覆盖率**: > 80%
- **新增代码覆盖率**: > 90%
- **关键路径覆盖率**: 100%

#### 检查命令

```bash
# 后端覆盖率
cd backend
npm run test:coverage

# iOS 覆盖率
cd FunnyPixelsApp
xcodebuild test -scheme FunnyPixels -enableCodeCoverage YES
xcrun xccov view --report TestResults.xcresult
```

#### 覆盖率分析

```bash
# 识别未覆盖代码
grep -r "NOT_COVERED" coverage/lcov-report/

# 优先级排序
1. 关键业务逻辑（支付、积分）
2. 安全相关代码（认证、授权）
3. 错误处理代码
4. 公共 API
```

### 阶段 5: 性能和可扩展性 (10分钟)

#### 性能基准

**API 响应时间:**
- GET 请求: < 100ms
- POST 请求: < 200ms
- 复杂查询: < 500ms

**iOS 应用:**
- 启动时间: < 2s
- 页面切换: < 100ms
- 列表滚动: 60fps
- 内存占用: < 200MB

#### 负载测试（可选）

```bash
# 使用 Apache Bench
ab -n 1000 -c 10 http://localhost:3000/api/share/stats

# 分析结果
- 吞吐量 > 100 req/s
- 99% 请求 < 500ms
- 无失败请求
```

#### 数据库性能

```sql
-- 慢查询分析
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;

-- 索引使用率
SELECT schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes
WHERE idx_scan = 0;
```

### 阶段 6: 文档和交付物 (5分钟)

#### 必需文档

- [ ] README 更新（新功能说明）
- [ ] API 文档（新端点）
- [ ] 数据库迁移文档
- [ ] 部署说明
- [ ] 回滚计划

#### 用户文档

- [ ] 功能使用指南
- [ ] 常见问题 FAQ
- [ ] 截图和示例
- [ ] 已知限制说明

### 阶段 7: 部署检查 (5分钟)

#### 部署清单

**环境配置:**
- [ ] 环境变量正确配置
- [ ] 数据库迁移脚本就绪
- [ ] 依赖包版本锁定

**监控和日志:**
- [ ] 错误监控配置（Sentry）
- [ ] 日志聚合配置
- [ ] 关键指标埋点

**回滚准备:**
- [ ] 数据库回滚脚本
- [ ] 代码回滚计划
- [ ] 回滚验证步骤

**通知:**
- [ ] 团队通知准备
- [ ] 用户公告准备
- [ ] 客服培训完成

## 验收报告生成

### 报告结构

```markdown
# 验收报告：${feature-name}
日期：$(date)
版本：${version}

## 执行摘要
- 验收状态：✅ PASSED / ❌ FAILED
- 测试覆盖率：X%
- 发现问题：X 个
- 阻塞问题：X 个

## 需求验证
- [x] 需求 1
- [x] 需求 2
- [ ] 需求 3（未完成）

## 功能测试结果
### 分享奖励
- 正常场景：✅ PASSED
- 边界情况：✅ PASSED
- 错误处理：⚠️ WARNING（需改进错误提示）

## 代码质量
- 代码规范：✅ PASSED
- 静态分析：✅ 无警告
- 安全扫描：✅ 无漏洞

## 性能测试
- API 响应时间：95ms（目标 <200ms）✅
- 内存使用：180MB（目标 <200MB）✅

## 发现的问题
1. [P2] 分享失败错误提示不够清晰
2. [P3] 邀请页面加载稍慢

## 改进建议
1. 优化错误提示文案
2. 添加邀请页面缓存

## 结论
功能满足验收标准，建议部署到生产环境。
```

## 决策矩阵

### ✅ 通过验收（可部署）

必须满足所有条件：
- ✅ 所有核心功能正常
- ✅ 测试覆盖率 > 80%
- ✅ 无阻塞性 Bug
- ✅ 性能达标
- ✅ 安全审查通过
- ✅ 文档完整

### ⚠️ 有条件通过（需改进后部署）

- 有非阻塞性问题
- 已有改进计划
- 问题已记录到 issue
- 风险可控

### ❌ 不通过验收（返回开发）

任一条件：
- ❌ 核心功能失败
- ❌ 测试覆盖率 < 70%
- ❌ 存在阻塞性 Bug
- ❌ 安全问题
- ❌ 性能严重不达标

## 输出文件

1. **验收报告**: `ACCEPTANCE_REPORT_${feature-name}.md`
2. **测试结果**: `TEST_RESULTS_${feature-name}.json`
3. **问题清单**: `ISSUES_${feature-name}.md`

---

**执行此 skill**: `/acceptance-check viral-marketing`
**检查当前分支**: `/acceptance-check`
