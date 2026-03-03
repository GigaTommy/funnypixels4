# 🌐 国际化（i18n）系统文档

## 概述

FunnyPixels 后端使用 i18next 实现完整的国际化支持，提供中文和英文两种语言。

## 目录结构

```
backend/src/
├── config/
│   └── i18n.js                 # i18n 配置
├── locales/
│   ├── zh/                     # 中文翻译
│   │   ├── common.json         # 通用文本
│   │   ├── errors.json         # 错误消息
│   │   ├── validation.json     # 验证消息
│   │   └── success.json        # 成功消息
│   ├── en/                     # 英文翻译
│   │   ├── common.json
│   │   ├── errors.json
│   │   ├── validation.json
│   │   └── success.json
│   └── README.md               # 本文档
└── utils/
    └── i18n.js                 # i18n 工具函数
```

## 语言检测

i18n 中间件自动检测用户语言，检测顺序：

1. **HTTP Header**: `Accept-Language: zh-CN,zh;q=0.9,en;q=0.8`
2. **Query String**: `?lng=zh` 或 `?lng=en`
3. **Cookie**: `i18next=zh` 或 `i18next=en`
4. **默认**: `zh`（中文）

### 示例

```bash
# 使用 HTTP Header
curl -H "Accept-Language: en" http://localhost:3001/api/auth/login

# 使用 Query String
curl http://localhost:3001/api/auth/login?lng=en

# 使用 Cookie
curl -H "Cookie: i18next=en" http://localhost:3001/api/auth/login
```

## 在控制器中使用

### 方法 1：使用工具函数（推荐）

```javascript
const { errors, success } = require('../utils/i18n');

// 错误响应
static async login(req, res) {
  const user = await User.findByEmail(email);

  if (!user) {
    const error = errors.emailNotFound(req);
    return res.status(error.statusCode).json(error);
  }

  // 成功响应
  const response = success.loginSuccess(req, { user, token });
  return res.json(response);
}
```

### 方法 2：使用翻译器

```javascript
const { getTranslator } = require('../utils/i18n');

static async someAction(req, res) {
  const t = getTranslator(req);

  // 翻译错误消息
  return res.status(400).json({
    success: false,
    message: t('errors:auth.invalidCredentials')
  });

  // 翻译成功消息
  return res.json({
    success: true,
    message: t('success:auth.loginSuccess')
  });
}
```

### 方法 3：使用 createErrorResponse/createSuccessResponse

```javascript
const { createErrorResponse, createSuccessResponse } = require('../utils/i18n');

static async createPixel(req, res) {
  try {
    const pixel = await Pixel.create(data);

    // 成功响应
    const response = createSuccessResponse(req, 'pixel.created', pixel);
    return res.json(response);
  } catch (error) {
    // 错误响应
    const errorResponse = createErrorResponse(
      req,
      'pixel.drawingFailed',
      500
    );
    return res.status(500).json(errorResponse);
  }
}
```

## 插值（变量替换）

### 基础插值

```javascript
// 翻译文件：errors.json
{
  "rateLimit": {
    "tooManyRequests": "请求过于频繁，请 {{retryAfter}} 秒后再试"
  }
}

// 控制器
const { createErrorResponse } = require('../utils/i18n');

const error = createErrorResponse(
  req,
  'rateLimit.tooManyRequests',
  429,
  { retryAfter: 60 }
);
// 结果: "请求过于频繁，请 60 秒后再试"
```

### 复数处理

```javascript
// 翻译文件
{
  "pixel": {
    "batchCreated": "批量创建成功，共 {{count}} 个像素",
    "batchCreated_plural": "批量创建成功，共 {{count}} 个像素"
  }
}

// 使用
const t = getTranslator(req);
t('success:pixel.batchCreated', { count: 5 });
```

## 添加新的翻译

### 1. 添加翻译键

在 `locales/zh/errors.json`:
```json
{
  "alliance": {
    "notFound": "联盟不存在",
    "nameTaken": "联盟名称已被使用"
  }
}
```

在 `locales/en/errors.json`:
```json
{
  "alliance": {
    "notFound": "Alliance not found",
    "nameTaken": "Alliance name already taken"
  }
}
```

### 2. 添加工具函数（可选）

在 `utils/i18n.js`:
```javascript
const errors = {
  // ... 现有错误
  allianceNotFound: (req) => createErrorResponse(req, 'alliance.notFound', 404),
  allianceNameTaken: (req) => createErrorResponse(req, 'alliance.nameTaken', 409)
};
```

### 3. 在控制器中使用

```javascript
const { errors } = require('../utils/i18n');

static async createAlliance(req, res) {
  const existing = await Alliance.findByName(name);

  if (existing) {
    const error = errors.allianceNameTaken(req);
    return res.status(error.statusCode).json(error);
  }

  // ...
}
```

## 命名空间

i18n 使用命名空间组织翻译：

- `common:` - 通用文本
- `errors:` - 错误消息
- `validation:` - 验证消息
- `success:` - 成功消息

### 使用命名空间

```javascript
// 完整写法
t('errors:auth.invalidCredentials')
t('success:auth.loginSuccess')
t('common:app.name')

// 默认命名空间是 'common'
t('app.name') // 等同于 t('common:app.name')
```

## 响应格式

### 错误响应

```json
{
  "success": false,
  "error": "INVALID_CREDENTIALS",
  "message": "用户名或密码错误",
  "statusCode": 401
}
```

### 成功响应

```json
{
  "success": true,
  "message": "登录成功",
  "data": {
    "user": {...},
    "token": "..."
  }
}
```

### 验证错误响应

```json
{
  "success": false,
  "error": "VALIDATION_ERROR",
  "message": "请求参数验证失败",
  "details": [
    {
      "field": "email",
      "message": "邮箱格式不正确"
    },
    {
      "field": "password",
      "message": "密码长度至少6个字符"
    }
  ]
}
```

## 验证消息国际化

Joi 验证消息已在 `validators/` 目录中配置为中文。要支持多语言验证：

```javascript
// validators/authValidator.js
const Joi = require('joi');

const emailSchema = Joi.string()
  .email()
  .messages({
    'zh': { 'string.email': '邮箱格式不正确' },
    'en': { 'string.email': 'Invalid email format' }
  });
```

## 测试不同语言

### 使用 curl

```bash
# 中文（默认）
curl http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"wrong"}'

# 英文
curl http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -H "Accept-Language: en" \
  -d '{"email":"test@example.com","password":"wrong"}'

# 使用 Query String
curl "http://localhost:3001/api/auth/login?lng=en" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"wrong"}'
```

### 使用 Postman

1. 在 Headers 中添加：`Accept-Language: en`
2. 或在 URL 中添加：`?lng=en`

## 最佳实践

### 1. 使用语义化的键名

```javascript
// ✅ 好
t('errors:auth.invalidCredentials')
t('success:pixel.created')

// ❌ 不好
t('errors:error1')
t('success:msg2')
```

### 2. 保持翻译简洁

```json
// ✅ 好
{
  "invalidEmail": "邮箱格式不正确"
}

// ❌ 不好（过于冗长）
{
  "invalidEmail": "您输入的邮箱地址格式不正确，请检查后重新输入。邮箱格式应该是 xxx@xxx.xxx"
}
```

### 3. 使用插值而非拼接

```javascript
// ✅ 好
t('errors:rateLimit.tooManyRequests', { retryAfter: 60 })

// ❌ 不好
const message = '请求过于频繁，请 ' + retryAfter + ' 秒后再试';
```

### 4. 保持中英文键一致

```json
// zh/errors.json
{
  "auth": {
    "invalidCredentials": "用户名或密码错误"
  }
}

// en/errors.json
{
  "auth": {
    "invalidCredentials": "Invalid username or password"
  }
}
```

## 常见问题

### Q: 如何添加新语言（如日语）？

1. 在 `locales/` 下创建 `ja/` 目录
2. 复制 `zh/` 或 `en/` 的所有 JSON 文件
3. 翻译内容为日语
4. 在 `config/i18n.js` 中添加 `ja` 到 `supportedLngs` 和 `preload`

### Q: 如何在客户端获取语言设置？

服务器会在响应中设置 Cookie：`i18next=zh` 或 `i18next=en`

### Q: 翻译文件修改后需要重启服务器吗？

开发环境：需要重启（除非启用 `saveMissing` 和热重载）
生产环境：建议重启以确保所有翻译加载

### Q: 如何处理富文本翻译？

```javascript
// 使用 HTML 标签（需要前端渲染）
{
  "message": "请访问 <a href='/terms'>服务条款</a>"
}

// 或使用插值
{
  "message": "请访问 {{link}}"
}
const message = t('message', { link: '<a href="/terms">服务条款</a>' });
```

## 性能优化

- 翻译文件在服务器启动时预加载
- 使用缓存避免重复加载
- 生产环境禁用 `saveMissing` 和 `debug`

## 参考资源

- [i18next 官方文档](https://www.i18next.com/)
- [i18next-http-middleware](https://github.com/i18next/i18next-http-middleware)
- [i18next 最佳实践](https://www.i18next.com/principles/fallback)
