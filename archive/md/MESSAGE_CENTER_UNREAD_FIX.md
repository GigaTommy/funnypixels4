# 消息中心未读数不一致问题修复

## 🐛 问题描述

**用户报告**:
- 消息中心显示有 2 条未读消息
- 点击进入消息中心后，列表中看不到任何消息
- 返回后，未读数 2 依然存在，不会自动消失

## 🔍 问题根源

### 后端逻辑不一致

**文件**: `backend/src/controllers/systemMessageController.js`

#### 1. 未读数统计（之前）
```javascript
// ❌ 只统计个人消息
const sysUnread = await knex('system_messages')
    .where({ receiver_id: userId, is_read: false })
    .count('* as count')
```

#### 2. 消息列表查询
```javascript
// ✅ 包括个人消息 + 广播消息
let query = knex('system_messages')
    .where(qb => {
        qb.where('receiver_id', userId)
            .orWhereNull('receiver_id'); // 广播消息（receiver_id = null）
    })
```

### 问题分析

**不一致导致的问题**:
1. 未读数统计**不包括**广播消息
2. 消息列表**包括**广播消息
3. 如果有未读的广播消息，但它们在列表查询前被其他逻辑标记为已读
4. 结果：未读数显示 2，但列表为空或都是已读消息

**场景示例**:
```
1. 系统发送 2 条广播消息（receiver_id = null, is_read = false）
2. 未读数统计查询：WHERE receiver_id = userId AND is_read = false
   → 结果：0（因为广播消息 receiver_id = null）
3. 但如果有 2 条个人消息（receiver_id = userId, is_read = false）
4. 消息列表查询：WHERE receiver_id = userId OR receiver_id IS NULL
   → 结果：个人消息 + 广播消息
5. 如果个人消息被删除或过滤，但未读数未更新
   → 显示未读数 2，但列表为空
```

---

## ✅ 修复方案

### 1. 统一后端查询逻辑

**文件**: `backend/src/controllers/systemMessageController.js`

**修改**: `getUnreadCount()` 方法

```javascript
// ✅ 使用与消息列表相同的查询逻辑
const sysUnread = await knex('system_messages')
    .where('is_read', false)
    .andWhere(qb => {
        qb.where('receiver_id', userId)
            .orWhereNull('receiver_id'); // 包括广播消息
    })
    .count('* as count')
    .first();
```

**改进**:
- ✅ 未读数统计和消息列表使用相同的查询条件
- ✅ 包括广播消息（receiver_id = null）
- ✅ 确保数据一致性

---

### 2. iOS 端自动同步未读数

**文件**: `FunnyPixelsApp/Views/Profile/MessageCenterView.swift`

#### 改进 1: 进入/刷新时同步未读数

```swift
.task {
    await viewModel.fetchMessages()
    // ✅ 进入消息中心时刷新未读数
    await viewModel.refreshUnreadCount()
}
.refreshable {
    await viewModel.fetchMessages()
    await viewModel.refreshUnreadCount()
}
```

#### 改进 2: 离开时同步未读数

```swift
.onDisappear {
    // ✅ 离开消息中心时刷新未读数
    Task {
        await viewModel.refreshUnreadCount()
    }
}
```

#### 改进 3: 标记已读后同步

```swift
func markAsRead(_ message: NotificationService.SystemMessage) async {
    do {
        try await NotificationService.shared.markAsRead(id: message.id)
        if let index = messages.firstIndex(where: { $0.id == message.id }) {
            messages[index].is_read = true
        }
        // ✅ 标记已读后立即刷新未读数
        await refreshUnreadCount()
    } catch {
        Logger.error("Failed to mark message as read: \(error)")
    }
}
```

#### 新增方法: refreshUnreadCount

```swift
/// 刷新全局未读数（通知 Badge 更新）
func refreshUnreadCount() async {
    do {
        let count = try await NotificationService.shared.getUnreadCount()
        await MainActor.run {
            // 通知 BadgeViewModel 更新
            NotificationCenter.default.post(
                name: .init("RefreshUnreadCount"),
                object: count
            )
        }
    } catch {
        Logger.error("Failed to refresh unread count: \(error)")
    }
}
```

---

## 🧪 测试场景

### 场景 1: 广播消息
1. 创建 2 条广播消息（receiver_id = null, is_read = false）
2. 打开消息中心
3. 预期：显示 2 条未读消息，未读数显示 2
4. 点击一条消息标记为已读
5. 预期：未读数变为 1

### 场景 2: 个人消息
1. 创建 2 条个人消息（receiver_id = userId, is_read = false）
2. 打开消息中心
3. 预期：显示 2 条未读消息，未读数显示 2
4. 全部忽略（标记所有为已读）
5. 预期：未读数变为 0

### 场景 3: 混合消息
1. 创建 1 条广播消息 + 1 条个人消息（都未读）
2. 打开消息中心
3. 预期：显示 2 条未读消息，未读数显示 2
4. 点击查看广播消息
5. 预期：未读数变为 1（只剩个人消息未读）

### 场景 4: 离开时同步
1. 消息中心显示未读数 2
2. 打开消息中心，查看所有消息
3. 返回个人页面
4. 预期：未读数自动更新为 0（如果所有消息已读）

---

## 📊 数据一致性保证

### 查询条件统一

| 操作 | 查询条件 | 包括广播消息 |
|------|---------|------------|
| **获取消息列表** | `receiver_id = userId OR receiver_id IS NULL` | ✅ 是 |
| **统计未读数** | `receiver_id = userId OR receiver_id IS NULL` + `is_read = false` | ✅ 是 |
| **标记已读** | `receiver_id = userId OR receiver_id IS NULL` | ✅ 是 |

### 同步时机

| 时机 | 操作 | 目的 |
|------|------|------|
| **进入消息中心** | 刷新未读数 | 确保显示最新数据 |
| **下拉刷新** | 刷新未读数 | 同步最新状态 |
| **标记已读** | 刷新未读数 | 立即更新 Badge |
| **全部忽略** | 刷新未读数 | 批量更新后同步 |
| **离开消息中心** | 刷新未读数 | 确保 Badge 正确 |

---

## 🔄 部署步骤

### 1. 后端更新

```bash
cd backend

# 检查修改
git diff src/controllers/systemMessageController.js

# 重启服务
pm2 restart backend
```

### 2. iOS 更新

```bash
cd FunnyPixelsApp

# 检查修改
git diff FunnyPixelsApp/Views/Profile/MessageCenterView.swift

# 编译测试
xcodebuild -scheme FunnyPixelsApp -configuration Debug
```

### 3. 测试验证

```bash
# 测试脚本（如果有）
curl -X GET "http://localhost:3000/api/messages/unread-count" \
  -H "Authorization: Bearer <token>"

# 预期响应
{
  "success": true,
  "data": {
    "system_unread": 2,
    "notification_unread": 0,
    "total_unread": 2
  }
}
```

---

## ⚠️ 已知限制

### 广播消息的已读状态

**当前设计**:
- 广播消息（receiver_id = null）的 `is_read` 字段是**全局的**
- 如果用户 A 标记广播消息为已读，用户 B 也会看到它是已读状态

**影响**:
- 广播消息的已读状态不是 per-user 的
- 可能导致某些用户看不到应该看到的未读广播消息

**长期方案**（如需要）:
1. 创建 `message_reads` 表记录每个用户对每条消息的已读状态
2. 修改查询逻辑使用 JOIN
3. 迁移现有数据

**表结构示例**:
```sql
CREATE TABLE message_reads (
    id UUID PRIMARY KEY,
    message_id UUID NOT NULL REFERENCES system_messages(id),
    user_id UUID NOT NULL REFERENCES users(id),
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP,
    UNIQUE(message_id, user_id)
);
```

**查询示例**:
```javascript
// 未读数统计
const sysUnread = await knex('system_messages as sm')
    .leftJoin('message_reads as mr', function() {
        this.on('sm.id', '=', 'mr.message_id')
            .andOn('mr.user_id', '=', knex.raw('?', [userId]));
    })
    .where(qb => {
        qb.where('sm.receiver_id', userId)
            .orWhereNull('sm.receiver_id');
    })
    .andWhere(qb => {
        qb.where('mr.is_read', false)
            .orWhereNull('mr.id'); // 还没有阅读记录的消息
    })
    .count('* as count');
```

---

## ✅ 修复总结

### 修改的文件

1. ✅ `backend/src/controllers/systemMessageController.js`
   - 统一未读数统计和消息列表的查询逻辑
   - 包括广播消息

2. ✅ `FunnyPixelsApp/Views/Profile/MessageCenterView.swift`
   - 添加自动刷新未读数的逻辑
   - 确保进入/离开/操作时同步

### 预期效果

- ✅ 未读数与实际消息列表一致
- ✅ 标记已读后未读数立即更新
- ✅ 离开消息中心后 Badge 正确显示
- ✅ 不再出现"有未读数但看不到消息"的情况

---

**修复日期**: 2026-02-25
**优先级**: P1（用户体验问题）
**影响范围**: 消息中心 + Badge 显示
**测试状态**: 待验证
