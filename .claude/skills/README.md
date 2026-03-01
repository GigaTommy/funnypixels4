# FunnyPixels 自动化 Skills 系统

完整的自动化开发、测试和部署工作流程。

## 📋 可用 Skills

| Skill | 用途 | 执行时间 | 自动化程度 |
|-------|------|---------|-----------|
| **update-dev-ip** | 更新开发环境 IP | 5-10分钟 | 🤖🤖🤖🤖🤖 100% |
| **ios-integration** | iOS 功能集成 | 30-60分钟 | 🤖🤖🤖🤖◯ 80% |
| **backend-api** | 后端 API 开发 | 40-60分钟 | 🤖🤖🤖🤖◯ 80% |
| **test-validation** | 全面测试验证 | 15-30分钟 | 🤖🤖🤖🤖🤖 95% |
| **acceptance-check** | 验收标准检查 | 20-40分钟 | 🤖🤖🤖🤖◯ 85% |
| **deploy-ready** | 部署就绪检查 | 30-50分钟 | 🤖🤖🤖🤖🤖 90% |
| **performance-test** | 性能基准测试 | 40-60分钟 | 🤖🤖🤖🤖🤖 95% |
| **stress-test-prepare** | 压测环境准备 | 5-10分钟 | 🤖🤖🤖🤖🤖 95% |
| **stress-test-run** | 运行 10K 压测 | 2-30分钟 | 🤖🤖🤖🤖🤖 95% |
| **stress-test-restore** | 压测环境恢复 | 2-5分钟 | 🤖🤖🤖🤖🤖 95% |

## 🚀 快速开始

### 1. 验证 Skills 已加载

```bash
cd /Users/ginochow/code/funnypixels3

# 使用 Claude Code CLI
claude

# 在 Claude 中输入
/help
```

你应该看到新的 skills：
- `/update-dev-ip` - 更新开发环境 IP
- `/ios-integration` - iOS 功能集成
- `/backend-api` - 后端 API 开发
- `/test-validation` - 全面测试验证
- `/acceptance-check` - 验收标准检查
- `/deploy-ready` - 部署就绪检查
- `/performance-test` - 性能基准测试
- `/stress-test-prepare` - 压测环境准备
- `/stress-test-run` - 运行 10K 压测
- `/stress-test-restore` - 压测环境恢复

### 2. 典型工作流程

#### **场景 0: 更新开发环境 IP** ⚡

```bash
# 当网络环境变更时（如换了 WiFi 或 IP 地址变了）
claude
> /update-dev-ip 192.168.1.15

# Claude 会自动：
# ✅ 验证 IP 格式
# ✅ 备份所有配置文件
# ✅ 更新根目录 .env
# ✅ 同步到 Backend、Frontend、Admin Frontend
# ✅ 更新 iOS AppConfig.swift
# ✅ 更新 CORS 配置
# ✅ 验证配置正确性
# ✅ 生成更新报告

# 然后重启服务
# Backend、Frontend、Admin Frontend 会自动使用新 IP
# iOS App 需要重新编译
```

#### **场景 1: 实现新的 iOS 功能**

```bash
# 1. 规划和实现
claude
> /ios-integration share-reward

# Claude 会自动：
# ✅ 分析现有代码结构
# ✅ 创建 ShareRewardManager.swift
# ✅ 修改 SessionSummaryView.swift
# ✅ 实现 API 调用和错误处理
# ✅ 添加奖励动画
# ✅ 编写单元测试
# ✅ 生成实施报告

# 2. 测试验证
> /test-validation ios

# ✅ 运行所有测试
# ✅ 检查覆盖率
# ✅ 生成测试报告

# 3. 验收检查
> /acceptance-check share-reward

# ✅ 验证功能需求
# ✅ 检查代码质量
# ✅ 确认测试覆盖
# ✅ 性能验证
```

#### **场景 2: 开发新的后端 API**

```bash
claude
> /backend-api create-vip-daily-claim

# Claude 会自动：
# ✅ 设计 API 端点
# ✅ 创建数据库迁移
# ✅ 实现控制器和模型
# ✅ 添加路由
# ✅ 编写单元测试和集成测试
# ✅ 生成 API 文档

# 测试
> /test-validation backend

# 验收
> /acceptance-check vip-daily-claim
```

#### **场景 3: 部署前完整验证**

```bash
claude
> /deploy-ready

# Claude 会执行：
# ✅ 代码质量检查
# ✅ 完整测试套件
# ✅ 数据库备份验证
# ✅ 环境配置检查
# ✅ 性能基准测试
# ✅ 安全扫描
# ✅ 回滚计划准备
# ✅ 生成部署就绪报告
```

#### **场景 4: 10K 用户压力测试**

```bash
claude
# 1. 准备环境
> /stress-test-prepare

# Claude 会自动：
# ✅ 生成 1100 测试用户并导入数据库
# ✅ 设置 pixel_points = 999999
# ✅ 临时提高 Auth 限流 (5 -> 5000)
# ✅ 扩大 DB 连接池 (10 -> 50)
# ✅ 运行烟测验证环境

# 2. 运行正式测试
> /stress-test-run full

# ✅ 阶梯递增到 1000 writers + 2000 readers
# ✅ 峰值负载保持 10 分钟
# ✅ 生成详细 SLO 结果报告

# 3. 恢复环境
> /stress-test-restore

# ✅ 恢复 Auth 限流 (5000 -> 5)
# ✅ 恢复 DB 连接池 (50 -> 10)
# ✅ 重启后端
```

## 📊 推荐的完整开发流程

### **阶段 1: 功能开发** (1-3天)

```bash
# Day 1: iOS 分享奖励功能
/ios-integration share-reward
/test-validation ios
/acceptance-check share-reward

# Day 2: iOS 分层邀请系统
/ios-integration invite-tiers
/test-validation ios
/acceptance-check invite-tiers

# Day 3: VIP 订阅界面
/ios-integration vip-subscription
/test-validation ios
/acceptance-check vip-subscription
```

### **阶段 2: 测试和优化** (1-2天)

```bash
# 全面测试验证
/test-validation

# 性能测试
/performance-test

# 根据性能报告优化
# （手动优化或让 Claude 协助）

# 重新测试
/performance-test
```

### **阶段 3: 验收和部署** (1天)

```bash
# 完整验收检查
/acceptance-check viral-marketing

# 部署就绪检查
/deploy-ready

# 如果全部通过，执行部署
```

## 🎯 Skills 详细说明

### **update-dev-ip** ⚡ 新增

**功能**: 自动化更新开发环境 IP 地址到所有配置文件

**适用场景**:
- 本地开发环境 IP 变更
- 切换到新的 WiFi 网络
- 多人开发环境同步
- 新成员加入团队

**使用方式**:
```bash
/update-dev-ip 192.168.1.15    # 更新到新 IP
/update-dev-ip                 # 显示当前 IP 配置
```

**自动更新的文件**:
- ✅ `.env` (根目录主配置)
- ✅ `backend/.env`
- ✅ `frontend/.env`
- ✅ `admin-frontend/.env`
- ✅ `admin-frontend/vite.config.ts`
- ✅ `app/.../AppConfig.swift` (iOS)

**执行流程**:
1. 验证 IP 格式
2. 创建所有文件的备份
3. 更新根目录 `.env`
4. 运行 `sync-config.js` 同步到各端
5. 更新 iOS 配置
6. 验证配置正确性
7. 生成更新报告

**输出**:
- `IP_UPDATE_REPORT_${timestamp}.md` - 更新报告
- `*.backup.${timestamp}` - 备份文件

**成功标准**:
- ✅ 所有配置文件已更新
- ✅ Backend/Frontend/Admin 可从新 IP 访问
- ✅ iOS App 可连接新 IP
- ✅ CORS 配置正确
- ✅ 监控面板可访问

**优势**:
- 🚀 **快速**: 5-10分钟完成所有配置
- 🎯 **准确**: 自动化避免遗漏
- 💾 **安全**: 自动备份，可快速回滚
- 📋 **完整**: 包含验证和报告

### **ios-integration**

**功能**: 自动化集成病毒式营销功能到 iOS 应用

**支持的功能模块**:
1. `share-reward` - 分享奖励系统
2. `invite-tiers` - 分层邀请系统
3. `vip-subscription` - VIP 会员订阅
4. `shop-discount` - 商城折扣显示
5. `milestone-progress` - 里程碑进度展示

**使用方式**:
```bash
/ios-integration                    # 显示功能列表
/ios-integration share-reward       # 实现分享奖励
/ios-integration invite-tiers       # 实现邀请系统
/ios-integration vip-subscription   # 实现 VIP 订阅
```

**输出文件**:
- `iOS_INTEGRATION_REPORT_${feature}.md` - 实施报告
- `TEST_RESULTS_${feature}.md` - 测试结果
- `USER_GUIDE_${feature}.md` - 用户指南

### **backend-api**

**功能**: 实现和测试后端 API 端点

**适用场景**:
- 创建新的 REST API 端点
- 添加功能到现有控制器
- 修改数据库模型
- 编写 API 测试

**使用方式**:
```bash
/backend-api create-share-tracking     # 创建分享追踪 API
/backend-api enhance-referral-system   # 增强邀请系统 API
/backend-api vip-daily-claim          # VIP 每日签到 API
```

**输出文件**:
- `API_DOC_${endpoint}.md` - API 文档
- `TEST_REPORT_${endpoint}.md` - 测试报告
- `migrations/YYYYMMDD_${endpoint}.js` - 数据库迁移

### **test-validation**

**功能**: 运行完整测试套件并生成详细报告

**测试范围**:
- 后端单元测试和集成测试
- iOS 单元测试和 UI 测试
- 数据库迁移测试
- 代码覆盖率分析

**使用方式**:
```bash
/test-validation           # 测试全部
/test-validation backend   # 只测试后端
/test-validation ios       # 只测试 iOS
```

**验证标准**:
- ✅ 所有测试通过
- ✅ 覆盖率 > 80%
- ✅ 无编译警告
- ✅ 无安全漏洞

### **acceptance-check**

**功能**: 验证功能是否满足所有验收标准

**检查内容**:
- 功能需求验证
- 用户故事验证
- 代码质量检查
- 测试覆盖验证
- 性能基准验证
- 安全检查

**使用方式**:
```bash
/acceptance-check                  # 检查当前分支
/acceptance-check viral-marketing  # 检查特定功能
/acceptance-check feature/share    # 检查特定分支
```

**决策标准**:
- ✅ **PASSED**: 所有标准满足，可部署
- ⚠️ **CONDITIONAL**: 有小问题但不阻塞
- ❌ **FAILED**: 存在阻塞性问题

### **deploy-ready**

**功能**: 部署前的最终全面检查

**检查项目**:
1. 代码质量和 Git 状态
2. 完整测试验证
3. 数据库备份和迁移
4. 环境配置验证
5. 依赖和构建检查
6. 性能基准测试
7. 监控和日志配置
8. 安全扫描
9. 回滚计划准备
10. 部署计划验证

**使用方式**:
```bash
/deploy-ready   # 执行完整检查
```

**决策矩阵**:
- ✅ **可以部署**: 所有阻塞性问题已解决
- ⚠️ **有条件部署**: 部分问题但风险可控
- ❌ **推迟部署**: 存在阻塞性问题

### **performance-test**

**功能**: 性能基准测试和瓶颈分析

**测试项目**:
- API 响应时间测试
- 并发负载测试
- 数据库性能分析
- 内存和 CPU 使用
- iOS 应用性能
- 网络性能测试

**使用方式**:
```bash
/performance-test              # 完整测试
/performance-test api          # 只测试 API
/performance-test database     # 只测试数据库
```

**性能目标**:
- API 响应: < 200ms
- 数据库查询: < 50ms
- iOS 启动: < 2s
- 内存使用: < 1GB

### **stress-test-prepare / stress-test-run / stress-test-restore**

**功能**: 10K 在线用户 + 1000 并发写入的混合压力测试全流程

**三个 Skill 分工**:
- `stress-test-prepare` - 准备环境（生成用户、导入 DB、放宽限流、扩大连接池）
- `stress-test-run` - 执行测试（烟测 / 正式 / 自定义规模）
- `stress-test-restore` - 恢复环境（恢复限流、连接池、可选清理数据）

**典型工作流**:
```bash
# 1. 准备环境
/stress-test-prepare

# 2. 烟测验证
/stress-test-run smoke

# 3. 正式测试
/stress-test-run full

# 4. 恢复环境
/stress-test-restore

# 4b. 恢复环境 + 清理测试用户
/stress-test-restore clean-users
```

**测试架构**:
- 场景 A: 1,000 Writers - POST /api/pixel-draw/manual（JWT 认证）
- 场景 B: 2,000 Readers - bbox/tiles/stats/hot-zones（无需认证）
- 等效负载: ~10,000 在线用户

**SLO 阈值**:
- 写入 P95 < 500ms, P99 < 1000ms
- 读取 P95 < 300ms
- 成功率 > 95%
- HTTP 错误率 < 5%

**临时配置变更（prepare 阶段）**:
| 配置 | 原值 | 压测值 | 文件 |
|------|------|--------|------|
| Auth 限流 | 5次/15分钟 | 5000次/15分钟 | rateLimit.js |
| DB 连接池 max | 10 | 50 | knexfile.js |
| OS fd 限制 | 256 | 65536 | ulimit |

## 💡 最佳实践

### ✅ 推荐做法

1. **逐步推进**
   ```bash
   # 好 ✅ - 一次一个功能
   /ios-integration share-reward
   /test-validation
   /acceptance-check share-reward

   # 不好 ❌ - 一次实现所有
   /ios-integration  # 然后要求实现所有功能
   ```

2. **频繁测试**
   ```bash
   # 每完成一个功能就测试
   /ios-integration share-reward
   /test-validation ios          # 立即测试

   /ios-integration invite-tiers
   /test-validation ios          # 再次测试
   ```

3. **使用验收检查**
   ```bash
   # 在认为功能完成时验收
   /acceptance-check share-reward
   # 根据报告修复问题
   # 再次验收直到通过
   ```

4. **部署前完整检查**
   ```bash
   # 部署前必须执行
   /deploy-ready
   # 仔细检查报告
   # 确保所有检查项通过
   ```

### ⚠️ 注意事项

1. **Skills 会修改代码** - 使用前先提交代码
   ```bash
   git add .
   git commit -m "Before using skills"
   ```

2. **审查 Skills 输出** - 不要盲目信任
   ```bash
   # 执行 skill 后
   git diff                    # 检查修改
   /test-validation           # 运行测试
   ```

3. **保存报告** - Skills 生成的报告很有价值
   ```bash
   # 报告文件会保存在项目根目录
   ls -la *_REPORT_*.md
   ls -la TEST_*.md
   ```

## 🔄 完整示例工作流

### 实施病毒式营销功能的完整流程

```bash
# === 第1周：iOS 集成 ===

# Day 1: 分享奖励
claude
> /ios-integration share-reward
> /test-validation ios
> /acceptance-check share-reward
> exit

git add .
git commit -m "feat: implement share reward system"

# Day 2: 邀请系统
claude
> /ios-integration invite-tiers
> /test-validation ios
> /acceptance-check invite-tiers
> exit

git add .
git commit -m "feat: implement tiered invitation system"

# Day 3: VIP 订阅
claude
> /ios-integration vip-subscription
> /test-validation ios
> /acceptance-check vip-subscription
> exit

git add .
git commit -m "feat: implement VIP subscription"

# === 第2周：测试和优化 ===

# Day 1: 全面测试
claude
> /test-validation
> exit

# 查看测试报告，修复失败的测试

# Day 2-3: 性能测试和优化
claude
> /performance-test
> exit

# 根据性能报告优化代码

# 重新测试
claude
> /performance-test
> /test-validation
> exit

# === 第3周：验收和部署 ===

# Day 1: 完整验收
claude
> /acceptance-check viral-marketing
> exit

# 根据验收报告修复问题

# Day 2: 部署准备
claude
> /deploy-ready
> exit

# 检查部署就绪报告

# Day 3: 执行部署
# （按照 deploy-ready 生成的部署计划执行）
```

## 📚 更多资源

- **Skills 源码**: `.claude/skills/*/SKILL.md`
- **实施文档**: `VIRAL_MARKETING_IMPLEMENTATION.md`
- **快速开始**: `QUICKSTART.md`
- **设置脚本**: `setup_viral_marketing.sh`

## 🆘 故障排查

### Skills 未显示？

```bash
# 检查 skills 目录
ls -la .claude/skills/

# 重新加载 Claude
claude
> /context
```

### Skills 执行失败？

```bash
# 查看 Claude 日志
tail -f ~/.claude/logs/claude.log

# 检查工具权限
# 某些 skills 需要 Bash 工具权限
```

### 报告文件找不到？

```bash
# 报告文件保存在项目根目录
ls -la *_REPORT_*.md
ls -la TEST_*.md

# 或在当前目录搜索
find . -name "*REPORT*.md" -type f
```

---

**开始使用**: `claude` → `/help` → 选择你需要的 skill

**祝你开发顺利！** 🎉
