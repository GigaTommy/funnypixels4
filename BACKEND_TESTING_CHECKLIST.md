# Backend 账户删除功能测试清单

## 🎯 测试目标
确保所有 API 正确处理已删除用户，不会返回 404 或 null 错误。

---

## ✅ 核心API测试

### 1. 用户档案 API
**测试文件**: `profileController.js`

- [ ] **GET /api/profile/:userId** - 查看已删除用户档案
  - 期望: 返回 200，用户显示为"已删除用户"，`is_deleted: true`, `clickable: false`
  - 不应返回: 404 或 null

### 2. 私信 API
**测试文件**: `privateMessageController.js`

- [ ] **POST /api/messages** - 向已删除用户发送私信
  - 期望: 返回 404，提示"接收者不存在或已删除账户"

- [ ] **GET /api/messages/conversations** - 对话列表包含已删除用户
  - 期望: 已删除用户显示为"已删除用户"，对话仍可查看（只读）

- [ ] **GET /api/messages/conversation/:userId** - 与已删除用户的对话历史
  - 期望: 消息历史正常显示，用户显示为"已删除用户"

### 3. 联盟 API
**测试文件**: `allianceController.js`

- [ ] **GET /api/alliances/:id/members** - 成员列表包含已删除用户
  - 期望: 已删除成员显示为"已删除用户"，`clickable: false`

- [ ] **GET /api/alliances/:id/applications** - 申请列表包含已删除用户
  - 期望: 已删除申请者显示为"已删除用户"

- [ ] **GET /api/alliances/:id/contributions** - 贡献排行包含已删除用户
  - 期望: 已删除用户仍在排行榜中，显示为"已删除用户"

### 4. 排行榜 API
**测试文件**: `leaderboardController.js`

- [ ] **GET /api/leaderboard/personal** - 个人排行榜包含已删除用户
  - 期望: 已删除用户显示为"已删除用户"，隐私设置不生效（删除优先级更高）

- [ ] **GET /api/leaderboard/friends** - 好友排行榜包含已删除用户
  - 期望: 已删除好友显示为"已删除用户"

### 5. 社交 API
**测试文件**: `socialController.js`

- [ ] **GET /api/social/:userId/following** - 关注列表包含已删除用户
  - 期望: 已删除用户显示为"已删除用户"

- [ ] **GET /api/social/:userId/followers** - 粉丝列表包含已删除用户
  - 期望: 已删除粉丝显示为"已删除用户"

- [ ] **GET /api/social/:userId/mutual** - 互关列表包含已删除用户
  - 期望: 已删除用户显示为"已删除用户"

- [ ] **GET /api/social/recommended** - 推荐关注不包含已删除用户
  - 期望: 已删除用户不出现在推荐列表中（如果模型层已过滤）

### 6. 动态流 API
**测试文件**: `feedController.js`

- [ ] **GET /api/feed** - 动态流包含已删除用户的动态
  - 期望: 已删除用户的动态仍显示，作者显示为"已删除用户"

- [ ] **GET /api/feed/:id/comments** - 评论列表包含已删除用户
  - 期望: 已删除评论者显示为"已删除用户"

### 7. 区域 API
**测试文件**: `regionController.js`

- [ ] **GET /api/regions/:id/stats** - 地区活跃用户包含已删除用户
  - 期望: 已删除用户显示为"已删除用户"

---

## 🔒 删除流程测试

### 8. 账户删除 API
**测试文件**: `authController.js`

- [ ] **DELETE /api/auth/account** - 软删除账户
  - 期望: 账户标记为 `pending_deletion`
  - 邮箱/用户名混淆为 `deleted_xxx` 格式
  - 所有会话撤销（强制登出）
  - 返回恢复令牌

- [ ] **POST /api/auth/recover-account** - 恢复账户
  - 期望: 使用恢复令牌成功恢复
  - 原始邮箱/用户名恢复
  - 账户状态变回 `active`
  - 生成新登录令牌

### 9. 定时任务测试
**测试文件**: `scheduledTasks.js`, `anonymizeExpiredAccounts.js`, `hardDeleteAnonymizedAccounts.js`

- [ ] **手动触发匿名化任务**
  ```bash
  curl -X POST http://localhost:3001/api/admin/trigger-anonymization \
    -H "Authorization: Bearer ADMIN_TOKEN"
  ```
  - 期望: 30天前的 `pending_deletion` 账户变为 `anonymized`
  - PII 数据清空
  - 像素作者字段设为 null，`is_anonymous: true`

- [ ] **手动触发硬删除任务**
  ```bash
  curl -X POST http://localhost:3001/api/admin/trigger-hard-delete \
    -H "Authorization: Bearer ADMIN_TOKEN"
  ```
  - 期望: 90天前的 `anonymized` 账户变为 `purged`
  - 私信、位置历史删除
  - 过期交易记录、审计日志删除

---

## 📊 边缘情况测试

### 10. 并发测试
- [ ] **并发删除** - 用户多次点击删除按钮
  - 期望: 前端防抖 + 后端状态检查，只执行一次

- [ ] **恢复令牌重放** - 使用同一令牌多次恢复
  - 期望: 令牌只能使用一次（待实现IP验证）

### 11. 联盟转移测试
- [ ] **盟主删除账户（有管理员）**
  - 期望: 自动转让给最资深的管理员

- [ ] **盟主删除账户（无管理员）**
  - 期望: 联盟自动解散

---

## ✅ 验收标准

### Backend 完成标准
- [x] 数据库迁移成功
- [x] API端点正常工作
- [x] 定时任务正确注册
- [ ] 单元测试覆盖率 > 80%
- [ ] 端到端测试通过
- [x] 所有面向用户的API已更新使用 `normalizeUserForDisplay()`

### 关键指标
- ✅ 无 404 错误 - 已删除用户返回标准化对象
- ✅ 无 null 错误 - 所有用户字段都有默认值
- ✅ 一致性 - 所有API返回统一的 `is_deleted` 和 `clickable` 字段
- ⏳ 性能 - 不影响现有API性能（待压测验证）

---

## 🚀 测试执行

### 快速测试脚本
```bash
# 1. 运行数据库迁移
cd backend
npm run migrate:latest

# 2. 启动后端服务
npm run dev

# 3. 创建测试用户并删除
# (使用 Postman 或 curl)

# 4. 验证所有API返回正确格式
# (逐个测试上述API)
```

### 自动化测试（待实现）
```bash
npm test -- --grep "deleted users"
```

---

**最后更新**: 2026-03-08
**测试负责人**: Backend Team
**预计测试时间**: 0.5天
