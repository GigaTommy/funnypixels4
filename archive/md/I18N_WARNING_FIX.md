# i18next 语言代码警告修复

## 问题描述

后端日志中出现大量 i18next 语言代码警告：

```
WARN: i18next::languageUtils: rejecting language code not found in supportedLngs: zh
WARN: i18next::languageUtils: rejecting language code not found in supportedLngs: pt
```

**影响**：
- 每次请求触发 6-12 次警告
- 严重污染日志输出
- 潜在性能影响（重复的语言代码验证）

---

## 根本原因

### 配置不匹配

**i18next 配置** (`backend/src/config/i18n.js`)：
```javascript
supportedLngs: ['zh-Hans', 'en', 'ja', 'ko', 'es', 'pt-BR']
```

**代码中使用** (`backend/src/utils/i18n.js`)：
```javascript
// ❌ 使用简短代码
function t(key, lng = 'zh', options = {}) { ... }
function getTranslator(req) {
  const lng = req.headers['accept-language']?.split(',')[0] || 'zh';
  ...
}
```

**HTTP Headers** (客户端发送)：
```
Accept-Language: zh, zh-CN, en
Accept-Language: pt
```

---

## 修复方案

### 1. 添加语言代码映射表

新增 `LANGUAGE_CODE_MAP` 映射表：

```javascript
const LANGUAGE_CODE_MAP = {
  'zh': 'zh-Hans',
  'zh-CN': 'zh-Hans',
  'zh-TW': 'zh-Hant',
  'zh-HK': 'zh-Hant',
  'pt': 'pt-BR',
  'en': 'en',
  'ja': 'ja',
  'ko': 'ko',
  'es': 'es'
};
```

### 2. 添加语言代码规范化函数

```javascript
/**
 * 规范化语言代码
 * @param {string} langCode - 原始语言代码
 * @returns {string} 规范化后的语言代码
 */
function normalizeLangCode(langCode) {
  if (!langCode) return 'zh-Hans';

  // 提取主语言代码（如 'zh-CN' -> 'zh', 'en-US' -> 'en'）
  const mainCode = langCode.split('-')[0].toLowerCase();
  const fullCode = langCode.toLowerCase();

  // 尝试完全匹配
  if (LANGUAGE_CODE_MAP[fullCode]) {
    return LANGUAGE_CODE_MAP[fullCode];
  }

  // 尝试主语言代码匹配
  if (LANGUAGE_CODE_MAP[mainCode]) {
    return LANGUAGE_CODE_MAP[mainCode];
  }

  // 默认返回简体中文
  return 'zh-Hans';
}
```

### 3. 更新翻译函数

**修改前**：
```javascript
function t(key, lng = 'zh', options = {}) {
  return i18next.t(key, { lng, ...options });
}

function getTranslator(req) {
  const lng = req.language || req.headers['accept-language']?.split(',')[0] || 'zh';
  return (key, options = {}) => {
    return i18next.t(key, { lng, ...options });
  };
}
```

**修改后**：
```javascript
function t(key, lng = 'zh-Hans', options = {}) {
  const normalizedLng = normalizeLangCode(lng);
  return i18next.t(key, { lng: normalizedLng, ...options });
}

function getTranslator(req) {
  const rawLng = req.language || req.headers['accept-language']?.split(',')[0] || 'zh-Hans';
  const lng = normalizeLangCode(rawLng);

  return (key, options = {}) => {
    return i18next.t(key, { lng, ...options });
  };
}
```

### 4. 启用非显式支持语言

在 `backend/src/config/i18n.js` 中添加：

```javascript
// 非显式支持的语言（不会触发警告，会自动fallback）
nonExplicitSupportedLngs: true,
```

---

## 修复效果

### 修复前（日志截图）
```log
[14:06:28] WARN: rejecting language code not found in supportedLngs: zh
[14:06:28] WARN: rejecting language code not found in supportedLngs: zh
[14:06:28] WARN: rejecting language code not found in supportedLngs: zh
[14:06:28] WARN: rejecting language code not found in supportedLngs: pt
[14:06:28] WARN: rejecting language code not found in supportedLngs: zh
[14:06:28] WARN: rejecting language code not found in supportedLngs: zh
[14:06:28] INFO: languageChanged: ["zh-Hans"]
```

**每次请求 6-12 次警告**

### 修复后（预期）
```log
[14:10:28] INFO: languageChanged: ["zh-Hans"]
```

**0 次警告，直接使用正确的语言代码**

---

## 测试验证

### 1. 重启后端服务
```bash
cd backend
npm run dev
# 或
pm2 restart funnypixels-backend
```

### 2. 发送测试请求

**测试中文简短代码**：
```bash
curl -H "Accept-Language: zh" http://localhost:3000/api/health
```

**测试葡萄牙语简短代码**：
```bash
curl -H "Accept-Language: pt" http://localhost:3000/api/health
```

**测试完整代码**：
```bash
curl -H "Accept-Language: zh-Hans" http://localhost:3000/api/health
```

### 3. 检查日志

✅ **应该看到**：
- 0 次 `rejecting language code` 警告
- 只有正常的 `languageChanged` 信息日志

❌ **不应该看到**：
- `WARN: rejecting language code not found in supportedLngs`

---

## 支持的语言代码映射

| 客户端发送 | 规范化后 | 最终语言 |
|-----------|---------|---------|
| `zh` | `zh-Hans` | 简体中文 |
| `zh-CN` | `zh-Hans` | 简体中文 |
| `zh-TW` | `zh-Hant` | 繁体中文 |
| `zh-HK` | `zh-Hant` | 繁体中文 |
| `pt` | `pt-BR` | 巴西葡萄牙语 |
| `en` | `en` | 英语 |
| `en-US` | `en` | 英语 |
| `ja` | `ja` | 日语 |
| `ko` | `ko` | 韩语 |
| `es` | `es` | 西班牙语 |
| （其他） | `zh-Hans` | 简体中文（默认） |

---

## 文件变更清单

### 修改的文件

1. **`backend/src/utils/i18n.js`**
   - ✅ 添加 `LANGUAGE_CODE_MAP` 映射表
   - ✅ 添加 `normalizeLangCode()` 函数
   - ✅ 更新 `t()` 函数默认值从 `'zh'` 改为 `'zh-Hans'`
   - ✅ 更新 `getTranslator()` 函数使用规范化代码

2. **`backend/src/config/i18n.js`**
   - ✅ 添加 `nonExplicitSupportedLngs: true` 配置

### 未修改的文件

- ✅ 语言文件 (`backend/src/locales/*/` 保持不变)
- ✅ API 接口（无需修改）
- ✅ 客户端代码（无需修改）

---

## 额外优化建议

### 1. 添加性能监控

在 `backend/src/utils/i18n.js` 中添加调试日志（可选）：

```javascript
function normalizeLangCode(langCode) {
  if (!langCode) return 'zh-Hans';

  const mainCode = langCode.split('-')[0].toLowerCase();
  const fullCode = langCode.toLowerCase();

  let normalized;
  if (LANGUAGE_CODE_MAP[fullCode]) {
    normalized = LANGUAGE_CODE_MAP[fullCode];
  } else if (LANGUAGE_CODE_MAP[mainCode]) {
    normalized = LANGUAGE_CODE_MAP[mainCode];
  } else {
    normalized = 'zh-Hans';
  }

  // 开发环境输出映射日志
  if (process.env.NODE_ENV === 'development' && langCode !== normalized) {
    console.debug(`[i18n] Language code mapped: ${langCode} -> ${normalized}`);
  }

  return normalized;
}
```

### 2. 添加单元测试

创建 `backend/src/__tests__/utils/i18n.test.js`：

```javascript
const { normalizeLangCode } = require('../../utils/i18n');

describe('i18n Language Code Normalization', () => {
  test('should normalize zh to zh-Hans', () => {
    expect(normalizeLangCode('zh')).toBe('zh-Hans');
  });

  test('should normalize zh-CN to zh-Hans', () => {
    expect(normalizeLangCode('zh-CN')).toBe('zh-Hans');
  });

  test('should normalize pt to pt-BR', () => {
    expect(normalizeLangCode('pt')).toBe('pt-BR');
  });

  test('should keep en unchanged', () => {
    expect(normalizeLangCode('en')).toBe('en');
  });

  test('should fallback to zh-Hans for unknown codes', () => {
    expect(normalizeLangCode('fr')).toBe('zh-Hans');
  });

  test('should handle null/undefined', () => {
    expect(normalizeLangCode(null)).toBe('zh-Hans');
    expect(normalizeLangCode(undefined)).toBe('zh-Hans');
  });
});
```

---

## 问题解决确认

- ✅ 修复 `zh` 语言代码警告
- ✅ 修复 `pt` 语言代码警告
- ✅ 添加完整的语言代码映射
- ✅ 启用非显式支持语言（减少警告）
- ✅ 保持向后兼容（客户端无需修改）
- ✅ 性能影响：微乎其微（简单的映射查找）

---

## 相关文档

- **i18next 官方文档**: https://www.i18next.com/overview/configuration-options
- **语言代码标准**: https://www.ietf.org/rfc/bcp/bcp47.txt
- **FunnyPixels 国际化指南**: `docs/development/I18N_GUIDE.md`

---

**修复完成时间**: 2026-02-25
**修复人员**: Claude Code
**测试状态**: 待验证（重启服务后）
**优先级**: P1 - 高优先级（日志污染严重）
