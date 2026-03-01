# 多语言实现方式修正

## 🐛 发现的问题

### 问题：使用数据库存储翻译字符串（不一致）

**原实现**:
- 创建了 `daily_tasks.json` 文件
- 但 `notificationI18n.js` 从数据库 (`localization_strings` 表) 读取
- 需要运行导入脚本将JSON导入数据库
- 与项目现有的 i18n 系统不一致

**项目现有i18n系统**:
- 使用 **i18next + 文件系统**
- 翻译文件存储在 `backend/src/locales/{语言}/` 目录中
- 直接从文件读取，无需导入数据库

**`localization_strings` 表的实际用途**:
- 用于 **iOS 客户端的动态内容**
- 如用户协议、隐私政策等可在管理后台修改的内容
- **不是**用于应用内的固定翻译字符串

---

## ✅ 修正后的实现

### 1. 目录结构（与项目标准一致）

```
backend/src/locales/
├── zh-Hans/
│   ├── errors.json          # ✅ 已存在
│   ├── success.json         # ✅ 已存在
│   ├── common.json          # ✅ 已存在
│   ├── validation.json      # ✅ 已存在
│   └── notifications.json   # 🆕 新增
├── en/
│   ├── errors.json
│   ├── success.json
│   ├── common.json
│   ├── validation.json
│   └── notifications.json   # 🆕 新增
├── ja/
│   └── notifications.json   # 🆕 新增
├── ko/
│   └── notifications.json   # 🆕 新增
├── es/
│   └── notifications.json   # 🆕 新增
└── pt-BR/
    └── notifications.json   # 🆕 新增
```

### 2. i18next 配置更新

**文件**: `backend/src/config/i18n.js`

**修改前**:
```javascript
{
  fallbackLng: 'zh',
  supportedLngs: ['zh', 'en'],
  preload: ['zh', 'en'],
  ns: ['common', 'errors', 'validation', 'success']
}
```

**修改后**:
```javascript
{
  fallbackLng: 'zh-Hans',
  supportedLngs: ['zh-Hans', 'en', 'ja', 'ko', 'es', 'pt-BR'],
  preload: ['zh-Hans', 'en', 'ja', 'ko', 'es', 'pt-BR'],
  ns: ['common', 'errors', 'validation', 'success', 'notifications']  // 新增 notifications
}
```

### 3. notificationI18n.js 重写

**修改前（错误 - 从数据库读取）**:
```javascript
async function getLocalizedString(langCode, key, params = {}) {
  // ❌ 从数据库查询
  const result = await db('localization_strings')
    .where({ lang_code: langCode, key })
    .select('value')
    .first();
  // ...
}
```

**修改后（正确 - 从文件读取）**:
```javascript
function getLocalizedString(langCode, key, params = {}) {
  // ✅ 使用 i18next 从文件读取
  return i18next.t(`notifications:${key}`, {
    lng: langCode,
    ...params
  });
}
```

### 4. 翻译文件示例

**`backend/src/locales/zh-Hans/notifications.json`**:
```json
{
  "task_completed": {
    "title": "🎉 任务完成！",
    "body": "恭喜！你完成了任务「{{title}}」，获得{{reward}}积分奖励！"
  },
  "all_tasks_completed": {
    "title": "🏆 全勤奖励！",
    "body": "太棒了！今日所有任务已完成，获得全勤奖励！记得明天继续保持哦～"
  },
  "streak_reward": {
    "title": "🔥 连续{{days}}天全勤！",
    "body": "你已连续{{days}}天完成所有每日任务！继续保持，奖励会越来越丰厚～"
  },
  "task_reminder": {
    "title": "⏰ 还有任务未完成",
    "body": "今天的每日任务还没完成哦，完成所有任务可以获得额外奖励！"
  }
}
```

---

## 🔄 修改的文件清单

### 删除的文件（错误实现）

1. ❌ `backend/src/locales/daily_tasks.json` - 错误的单文件格式
2. ❌ `backend/scripts/import_daily_tasks_localization.js` - 不需要数据库导入

### 新增的文件（正确实现）

1. ✅ `backend/src/locales/zh-Hans/notifications.json`
2. ✅ `backend/src/locales/en/notifications.json`
3. ✅ `backend/src/locales/ja/notifications.json`
4. ✅ `backend/src/locales/ko/notifications.json`
5. ✅ `backend/src/locales/es/notifications.json`
6. ✅ `backend/src/locales/pt-BR/notifications.json`

### 修改的文件

1. ✅ `backend/src/config/i18n.js` - 添加6种语言支持和notifications命名空间
2. ✅ `backend/src/utils/notificationI18n.js` - 完全重写，使用i18next而不是数据库
3. ✅ `backend/src/database/migrations/20260224000001_add_preferred_language_to_users.js` - 保留（用户语言偏好仍需存储）

### 保持不变

- ✅ `backend/src/controllers/dailyTaskController.js` - 无需修改
- ✅ `backend/src/tasks/resetDailyTasks.js` - 无需修改

---

## 🆚 对比：数据库 vs 文件系统

| 方面 | 数据库方式（错误） | 文件系统方式（正确） |
|------|-------------------|---------------------|
| **存储位置** | `localization_strings` 表 | `locales/{lang}/notifications.json` |
| **加载方式** | SQL 查询 | i18next 文件加载 |
| **部署步骤** | 需要运行导入脚本 | 无需额外步骤 |
| **性能** | 数据库查询开销 | 文件缓存，更快 |
| **一致性** | ❌ 与项目其他部分不一致 | ✅ 完全一致 |
| **维护** | 需要同步文件和数据库 | 只需编辑文件 |

---

## 📊 项目中两种i18n用途的对比

### 用途1: 应用内固定翻译（使用文件系统）

**适用场景**:
- 错误消息、成功消息
- 验证消息
- 推送通知模板
- UI文本

**实现方式**:
- ✅ i18next + 文件系统
- 文件位置: `backend/src/locales/{lang}/*.json`
- 命名空间: `errors`, `success`, `validation`, `notifications`

**优点**:
- 快速（文件缓存）
- 版本控制友好
- 部署简单

---

### 用途2: 动态管理内容（使用数据库）

**适用场景**:
- 用户协议（可在管理后台修改）
- 隐私政策（可在管理后台修改）
- 公告内容
- 其他需要非技术人员修改的内容

**实现方式**:
- ✅ `localization_strings` 表 + `LocalizationService`
- iOS 客户端通过 API 获取最新版本
- 管理后台可直接修改

**优点**:
- 无需发版即可更新内容
- 非技术人员可操作
- 支持版本控制和回滚

---

## 🚀 部署步骤（修正后）

### 步骤1: 重启服务加载新配置

```bash
cd backend
pm2 restart backend
```

### 步骤2: 验证翻译文件加载

```bash
# 检查日志确认i18next加载了6种语言
pm2 logs backend | grep "i18next"
```

### 步骤3: 测试推送通知

```bash
# 测试中文通知
curl -X PATCH http://localhost:3000/api/users/profile \
  -H "Authorization: Bearer <token>" \
  -d '{"preferred_language": "zh-Hans"}'

# 完成任务触发通知
# ...

# 检查推送通知记录
psql -d funnypixels -c "
  SELECT title, body
  FROM push_notifications
  WHERE user_id = '<user-id>'
  ORDER BY sent_at DESC
  LIMIT 1;
"
```

**预期结果（中文）**:
```
       title        |                          body
--------------------+---------------------------------------------------------
 🎉 任务完成！       | 恭喜！你完成了任务「像素画家」，获得10积分奖励！
```

**预期结果（英文）**:
```
       title            |                                      body
------------------------+---------------------------------------------------------------------------------
 🎉 Task Completed!     | Congratulations! You completed the task "Pixel Painter" and earned 10 points!
```

---

## 🔍 验证清单

- [x] 删除错误的数据库导入脚本
- [x] 删除错误的单文件 daily_tasks.json
- [x] 创建正确的目录结构（6种语言）
- [x] 每种语言创建 notifications.json
- [x] 更新 i18n.js 配置
- [x] 重写 notificationI18n.js 使用 i18next
- [x] 保留用户语言偏好数据库字段
- [ ] 重启服务验证加载
- [ ] 测试所有6种语言的通知

---

## 💡 最佳实践

### ✅ DO（正确做法）

1. **应用内固定文本** → 使用文件系统 + i18next
   ```javascript
   // ✅ Good
   const title = i18next.t('notifications:task_completed.title', { lng: 'zh-Hans' });
   ```

2. **动态管理内容** → 使用数据库 + LocalizationService
   ```javascript
   // ✅ Good (for user agreement, privacy policy, etc.)
   const content = await LocalizationService.getBundle('zh-Hans');
   ```

### ❌ DON'T（错误做法）

1. **不要混用两种方式**
   ```javascript
   // ❌ Bad - 固定文本不应该从数据库读取
   const title = await db('localization_strings').where(...);
   ```

2. **不要创建单独的导入脚本**
   ```javascript
   // ❌ Bad - 固定翻译不需要导入数据库
   await LocalizationString.bulkUpsert(entries);
   ```

---

## 📚 相关文档

- [i18n 系统文档](./backend/src/locales/README.md) - 项目i18n使用指南
- [多语言支持实现](./DAILY_TASKS_I18N_IMPLEMENTATION.md) - 详细技术文档（已过时，需更新）
- [i18next 官方文档](https://www.i18next.com/)

---

## ✅ 总结

### 修正前的问题
- ❌ 使用数据库存储固定翻译（不一致）
- ❌ 需要运行导入脚本（额外步骤）
- ❌ 与项目现有i18n系统冲突

### 修正后的优势
- ✅ 使用文件系统存储（与项目一致）
- ✅ 利用i18next（与项目一致）
- ✅ 无需导入脚本（简化部署）
- ✅ 更好的性能（文件缓存）
- ✅ 更易维护（编辑文件即可）

现在推送通知的多语言实现完全符合项目标准！

---

**修正日期**: 2026-02-24
**修正版本**: 待发布
**影响范围**: 推送通知多语言实现方式
**优先级**: P0（架构一致性）
