# 语言代码一致性修复总结

## 🐛 发现的问题

### 问题1: 缺少葡萄牙文（巴西）支持
**原实现**: 只支持5种语言
**应该支持**: 6种语言

### 问题2: 语言代码不一致
**原实现**: 使用 `zh` 作为简体中文的语言代码
**项目标准**: 使用 `zh-Hans` 作为简体中文的语言代码

---

## ✅ 修复内容

### 1. 本地化字符串定义

**文件**: `backend/src/locales/daily_tasks.json`

**修复前**:
```json
{
  "zh": { ... },
  "en": { ... },
  "ja": { ... },
  "ko": { ... },
  "es": { ... }
}
```

**修复后**:
```json
{
  "zh-Hans": { ... },
  "en": { ... },
  "ja": { ... },
  "ko": { ... },
  "es": { ... },
  "pt-BR": { ... }  // 🆕 新增葡萄牙文（巴西）
}
```

**葡萄牙文（巴西）翻译内容**:
```json
{
  "notification.task_completed.title": "🎉 Tarefa Concluída!",
  "notification.task_completed.body": "Parabéns! Você concluiu a tarefa \"{{title}}\" e ganhou {{reward}} pontos!",
  "notification.all_tasks_completed.title": "🏆 Bônus de Presença Perfeita!",
  "notification.all_tasks_completed.body": "Incrível! Você concluiu todas as tarefas diárias hoje. Continue assim amanhã!",
  "notification.streak_reward.title": "🔥 Sequência de {{days}} Dias!",
  "notification.streak_reward.body": "Você concluiu todas as tarefas diárias por {{days}} dias consecutivos! Continue para recompensas ainda melhores!",
  "notification.task_reminder.title": "⏰ Tarefas Não Concluídas",
  "notification.task_reminder.body": "Você ainda tem tarefas inacabadas hoje. Complete todas as tarefas para bônus de recompensas!"
}
```

---

### 2. 推送通知国际化工具

**文件**: `backend/src/utils/notificationI18n.js`

**修复前**:
```javascript
const DEFAULT_LANGUAGE = 'zh';
```

**修复后**:
```javascript
const DEFAULT_LANGUAGE = 'zh-Hans';
```

---

### 3. 数据库迁移

**文件**: `backend/src/database/migrations/20260224000001_add_preferred_language_to_users.js`

**修复前**:
```javascript
table.string('preferred_language', 10).defaultTo('zh').notNullable();
```

**修复后**:
```javascript
table.string('preferred_language', 10).defaultTo('zh-Hans').notNullable();
```

---

### 4. 文档更新

更新了以下文档以反映正确的6种语言支持：

1. **`DAILY_TASKS_I18N_IMPLEMENTATION.md`**
   - 支持语言列表：5种 → 6种
   - 语言代码：`zh` → `zh-Hans`
   - 导入结果示例更新

2. **`DAILY_TASKS_I18N_QUICK_GUIDE.md`**
   - 快速参考表格更新
   - 测试示例更新
   - 预期输出更新

3. **`DAILY_TASK_AUTO_COMPLETION_IMPLEMENTATION.md`**
   - 支持语言列表更新

---

## 🌐 项目语言代码标准

根据 `backend/src/middleware/localization.js`，项目统一使用以下语言代码：

```javascript
const SUPPORTED_LANGUAGES = ['en', 'zh-Hans', 'ja', 'ko', 'es', 'pt-BR'];
```

| 语言 | 代码 | 说明 |
|------|------|------|
| 简体中文 | `zh-Hans` | ✅ 正确 (不是 `zh`) |
| English | `en` | ✅ 正确 |
| 日本語 | `ja` | ✅ 正确 |
| 한국어 | `ko` | ✅ 正确 |
| Español | `es` | ✅ 正确 |
| Português (Brasil) | `pt-BR` | ✅ 正确 (不是 `pt`) |

---

## 🔄 与其他系统的一致性验证

### iOS 客户端

**文件**: `FunnyPixelsApp/FunnyPixelsApp/Utilities/Localization/LocalizationManager.swift`

```swift
static let supportedLanguages: [(code: String, name: String, nativeName: String)] = [
    ("en", "English", "English"),
    ("zh-Hans", "Chinese (Simplified)", "简体中文"),
    ("ja", "Japanese", "日本語"),
    ("ko", "Korean", "한국어"),
    ("es", "Spanish", "Español"),
    ("pt-BR", "Portuguese (Brazil)", "Português (Brasil)")
]
```

✅ **完全一致**

---

### 后端中间件

**文件**: `backend/src/middleware/localization.js`

```javascript
const SUPPORTED_LANGUAGES = ['en', 'zh-Hans', 'ja', 'ko', 'es', 'pt-BR'];
```

✅ **完全一致**

---

### AppConfig 映射

**文件**: `FunnyPixelsApp/FunnyPixelsApp/Config/AppConfig.swift`

```swift
switch languageCode {
case "zh": return "zh-Hans"
case "ja": return "ja"
case "ko": return "ko"
case "es": return "es"
case "pt": return "pt-BR"
default: return "en"
}
```

✅ **正确映射设备语言到后端支持的语言代码**

---

## 📊 修复影响范围

| 项目 | 修复前 | 修复后 | 影响 |
|------|--------|--------|------|
| 支持语言数量 | 5 | 6 | +1 (pt-BR) |
| 中文语言代码 | `zh` | `zh-Hans` | ✅ 与项目标准一致 |
| 本地化字符串总数 | 20 (5×4) | 24 (6×4) | +4 条 |
| 文档准确性 | ❌ 不一致 | ✅ 一致 |

---

## 🧪 验证清单

### 部署后验证

- [ ] 运行数据库迁移
  ```bash
  npm run migrate
  ```

- [ ] 导入本地化字符串
  ```bash
  node scripts/import_daily_tasks_localization.js
  ```

- [ ] 验证6种语言都已导入
  ```sql
  SELECT lang_code, COUNT(*)
  FROM localization_strings
  WHERE key LIKE 'notification.%'
  GROUP BY lang_code;

  -- 预期结果：
  -- zh-Hans: 4
  -- en: 4
  -- ja: 4
  -- ko: 4
  -- es: 4
  -- pt-BR: 4
  ```

- [ ] 测试中文通知（使用 zh-Hans）
  ```bash
  curl -X PATCH /api/users/profile \
    -d '{"preferred_language": "zh-Hans"}'
  ```

- [ ] 测试葡萄牙文通知（新增）
  ```bash
  curl -X PATCH /api/users/profile \
    -d '{"preferred_language": "pt-BR"}'
  ```

- [ ] 检查数据库默认值
  ```sql
  SELECT column_default
  FROM information_schema.columns
  WHERE table_name = 'users'
  AND column_name = 'preferred_language';

  -- 预期结果：'zh-Hans'::character varying
  ```

---

## 🔍 常见问题

### Q1: 为什么使用 `zh-Hans` 而不是 `zh`？

**A**:
- `zh-Hans` = 简体中文（Simplified Chinese）
- `zh-Hant` = 繁体中文（Traditional Chinese）
- 使用完整的语言代码可以清晰区分简体和繁体
- 符合 BCP 47 标准（RFC 5646）
- 与 iOS `Locale` 系统一致

### Q2: 为什么使用 `pt-BR` 而不是 `pt`？

**A**:
- `pt` = 葡萄牙语（欧洲葡萄牙语）
- `pt-BR` = 巴西葡萄牙语
- 两者在用词、拼写、习惯上有明显差异
- 巴西是最大的葡萄牙语使用国家（>2亿人）
- 与项目目标市场一致

### Q3: 旧数据（preferred_language = 'zh'）怎么办？

**A**: 如果数据库中已有用户使用旧的 `zh` 代码，需要运行数据迁移：

```sql
-- 迁移脚本
UPDATE users
SET preferred_language = 'zh-Hans'
WHERE preferred_language = 'zh';

UPDATE users
SET preferred_language = 'pt-BR'
WHERE preferred_language = 'pt';
```

或者在代码中添加兼容逻辑：
```javascript
// notificationI18n.js
async function getUserLanguage(userId) {
  const user = await db('users').where('id', userId).first();
  let lang = user?.preferred_language || DEFAULT_LANGUAGE;

  // 向后兼容旧的语言代码
  if (lang === 'zh') lang = 'zh-Hans';
  if (lang === 'pt') lang = 'pt-BR';

  return lang;
}
```

---

## ✅ 修复完成检查清单

- [x] 更新本地化字符串定义文件（添加 pt-BR，zh → zh-Hans）
- [x] 更新 notificationI18n.js 默认语言代码
- [x] 更新数据库迁移默认值
- [x] 更新所有技术文档
- [x] 验证与 iOS 客户端一致性
- [x] 验证与后端中间件一致性
- [ ] 运行数据库迁移（部署时）
- [ ] 导入更新后的本地化字符串（部署时）
- [ ] 测试所有6种语言的推送通知（部署后）
- [ ] 迁移现有用户的旧语言代码（如需要）

---

**修复日期**: 2026-02-24
**修复版本**: 待发布
**影响范围**: 每日任务推送通知多语言支持
**优先级**: P0（一致性问题）

---

## 📚 相关文档

- [多语言支持详细文档](./DAILY_TASKS_I18N_IMPLEMENTATION.md)
- [快速参考指南](./DAILY_TASKS_I18N_QUICK_GUIDE.md)
- [主功能文档](./DAILY_TASK_AUTO_COMPLETION_IMPLEMENTATION.md)
- [项目多语言支持验证](./docs/project/MULTILINGUAL_SUPPORT_VERIFICATION.md)

---

## 🎉 总结

本次修复确保了：
1. ✅ 支持完整的6种语言（添加了葡萄牙文-巴西）
2. ✅ 语言代码与项目标准完全一致（zh-Hans, pt-BR）
3. ✅ iOS 客户端、后端、数据库的语言代码统一
4. ✅ 文档准确性和完整性

现在每日任务推送通知系统完全符合项目的多语言支持标准！
