# 每日任务多语言支持 - 快速参考指南

## ✅ 已修复的问题

**之前**: 推送通知硬编码中文，所有用户收到相同语言的通知
**现在**: 根据用户语言偏好 (`users.preferred_language`) 自动发送对应语言的通知

---

## 📋 修改清单

### 新增文件 (5个)

1. `backend/src/locales/daily_tasks.json` - 本地化字符串定义（6种语言）
2. `backend/src/utils/notificationI18n.js` - 推送通知国际化工具
3. `backend/scripts/import_daily_tasks_localization.js` - 本地化字符串导入脚本
4. `backend/src/database/migrations/20260224000001_add_preferred_language_to_users.js` - 数据库迁移
5. `DAILY_TASKS_I18N_IMPLEMENTATION.md` - 详细实现文档

### 修改文件 (2个)

1. `backend/src/controllers/dailyTaskController.js`
   - 添加 `notificationI18n` 导入
   - 任务完成通知使用本地化内容
   - 全勤奖励通知使用本地化内容

2. `backend/src/tasks/resetDailyTasks.js`
   - 添加 `notificationI18n` 导入
   - 连续完成奖励通知使用本地化内容

---

## 🚀 部署步骤

### 1. 运行数据库迁移

```bash
cd backend
npm run migrate
```

**验证**:
```bash
psql -d funnypixels -c "\d users" | grep preferred_language
```
应该看到 `preferred_language | character varying(10) | default 'zh'::character varying`

---

### 2. 导入本地化字符串

```bash
node scripts/import_daily_tasks_localization.js
```

**预期输出**:
```
==========================================
📝 导入每日任务本地化字符串
==========================================

📖 已读取本地化文件
   支持的语言: zh-Hans, en, ja, ko, es, pt-BR

🔄 正在导入 zh 语言...
   ✅ 成功导入 4 条字符串，版本号: 1
🔄 正在导入 en 语言...
   ✅ 成功导入 4 条字符串，版本号: 1
...

==========================================
✅ 导入完成！
==========================================
```

**验证**:
```bash
psql -d funnypixels -c "
  SELECT lang_code, COUNT(*) as count
  FROM localization_strings
  WHERE key LIKE 'notification.%'
  GROUP BY lang_code
  ORDER BY lang_code;
"
```

预期输出:
```
 lang_code | count
-----------+-------
 en        |     4
 es        |     4
 ja        |     4
 ko        |     4
 pt-BR     |     4
 zh-Hans   |     4
```

---

### 3. 重启后端服务

```bash
pm2 restart backend
```

**验证日志**:
```bash
pm2 logs backend --lines 50 | grep "每日任务"
```
应该看到: `✅ 每日任务重置定时任务已启动`

---

## 🧪 测试多语言支持

### 测试中文通知

```bash
# 1. 设置用户语言为简体中文（默认）
curl -X PATCH http://localhost:3000/api/users/profile \
  -H "Authorization: Bearer <your-token>" \
  -H "Content-Type: application/json" \
  -d '{"preferred_language": "zh-Hans"}'

# 2. 触发任务完成（绘制50个像素）
# ...完成任务...

# 3. 检查推送通知记录
psql -d funnypixels -c "
  SELECT title, body, type
  FROM push_notifications
  WHERE user_id = '<your-user-id>'
  ORDER BY sent_at DESC
  LIMIT 1;
"
```

**预期输出**:
```
       title        |                          body                           |         type
--------------------+---------------------------------------------------------+---------------------
 🎉 任务完成！       | 恭喜！你完成了任务「像素画家」，获得10积分奖励！           | daily_task_completed
```

---

### 测试英文通知

```bash
# 1. 设置用户语言为英文
curl -X PATCH http://localhost:3000/api/users/profile \
  -H "Authorization: Bearer <your-token>" \
  -H "Content-Type: application/json" \
  -d '{"preferred_language": "en"}'

# 2. 触发任务完成
# ...完成任务...

# 3. 检查推送通知
psql -d funnypixels -c "
  SELECT title, body
  FROM push_notifications
  WHERE user_id = '<your-user-id>'
  ORDER BY sent_at DESC
  LIMIT 1;
"
```

**预期输出**:
```
       title        |                                      body
--------------------+---------------------------------------------------------------------------------
 🎉 Task Completed! | Congratulations! You completed the task "Pixel Painter" and earned 10 points!
```

---

## 📊 支持的通知类型

| 通知类型 | 键前缀 | 参数 |
|---------|--------|------|
| 任务完成 | `notification.task_completed` | `{{title}}`, `{{reward}}` |
| 全勤奖励 | `notification.all_tasks_completed` | 无 |
| 连续完成 | `notification.streak_reward` | `{{days}}` |
| 任务提醒 | `notification.task_reminder` | 无 |

---

## 🌐 支持的语言

| 语言 | 代码 | 示例 |
|------|------|------|
| 简体中文 | `zh-Hans` | 🎉 任务完成！ |
| English | `en` | 🎉 Task Completed! |
| 日本語 | `ja` | 🎉 タスク完了！ |
| 한국어 | `ko` | 🎉 작업 완료! |
| Español | `es` | 🎉 ¡Tarea Completada! |
| Português (Brasil) | `pt-BR` | 🎉 Tarefa Concluída! |

---

## 🔧 故障排查

### 问题: 用户收到错误语言的通知

**检查用户语言设置**:
```sql
SELECT id, username, preferred_language
FROM users
WHERE id = '<user-id>';
```

**修改用户语言**:
```sql
UPDATE users
SET preferred_language = 'en'
WHERE id = '<user-id>';
```

---

### 问题: 本地化字符串未找到

**检查数据库中的本地化字符串**:
```sql
SELECT lang_code, key, value
FROM localization_strings
WHERE key LIKE 'notification.%'
ORDER BY lang_code, key;
```

**重新导入**:
```bash
node scripts/import_daily_tasks_localization.js
```

---

### 问题: 通知内容显示 {{title}} 或 {{reward}}

**原因**: 模板参数未正确替换

**检查代码**:
```javascript
// ❌ Wrong
const notification = await getTaskCompletedNotification(userId, {
  taskTitle: task.title  // 应该是 'title' 而不是 'taskTitle'
});

// ✅ Correct
const notification = await getTaskCompletedNotification(userId, {
  title: task.title,
  reward: task.reward_points
});
```

---

## 📚 相关文档

- [详细实现文档](./DAILY_TASKS_I18N_IMPLEMENTATION.md) - 完整的技术实现说明
- [主功能文档](./DAILY_TASK_AUTO_COMPLETION_IMPLEMENTATION.md) - 每日任务功能总览
- [API文档](./API_LOCALIZATION.md) - 本地化API说明

---

## ✅ 快速检查清单

部署后确认以下项目：

- [ ] 数据库迁移成功 (`users.preferred_language` 字段存在)
- [ ] 本地化字符串已导入 (6种语言 × 4个通知类型 = 24条记录)
- [ ] 后端服务已重启
- [ ] 用户可以设置语言偏好
- [ ] 推送通知根据用户语言发送
- [ ] 模板参数正确替换
- [ ] 日志中没有"本地化字符串缺失"错误

---

**快速参考版本**: 1.0
**更新日期**: 2026-02-24
**适用范围**: 每日任务推送通知多语言支持
