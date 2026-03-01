# 输入验证系统文档

## 概述

本项目使用 Joi 作为专业的输入验证库，替代了之前的手动验证逻辑。验证系统分为以下几个部分：

1. **通用验证规则** (`commonValidator.js`) - 可重用的基础验证规则
2. **业务验证模式** (`authValidator.js`, `pixelValidator.js` 等) - 特定业务的验证 schema
3. **验证中间件** (`middleware/validation.js`) - Express 中间件函数

## 文件结构

```
backend/src/
├── validators/
│   ├── README.md               # 本文档
│   ├── commonValidator.js      # 通用验证规则（邮箱、密码、经纬度等）
│   ├── authValidator.js        # 认证相关验证（注册、登录、验证码等）
│   └── pixelValidator.js       # 像素相关验证（创建、查询、更新等）
└── middleware/
    └── validation.js           # 验证中间件
```

## 快速开始

### 1. 使用预定义的验证 Schema

```javascript
// routes/auth.js
const { validate } = require('../middleware/validation');
const { registerSchema, loginSchema } = require('../validators/authValidator');

// 应用验证中间件到路由
router.post('/register', validate(registerSchema), AuthController.register);
router.post('/login', validate(loginSchema), AuthController.login);
```

### 2. 验证不同数据源

```javascript
// 验证 body（默认）
router.post('/create', validate(createSchema), controller.create);

// 验证 query 参数
router.get('/list', validate(listSchema, 'query'), controller.list);

// 验证 params 参数
router.get('/:id', validate(idSchema, 'params'), controller.get);
```

### 3. 同时验证多个数据源

```javascript
const { validateMultiple } = require('../middleware/validation');

router.post('/create/:userId',
  validateMultiple({
    body: createPixelSchema,
    params: userIdSchema,
    query: optionsSchema
  }),
  controller.create
);
```

## 通用验证规则

`commonValidator.js` 提供了可重用的验证规则：

### 用户相关
- `email` - 邮箱格式（最大255字符）
- `password` - 密码（6-128字符）
- `userId` - 用户ID（正整数）
- `username` - 用户名（3-30字符，字母数字）
- `displayName` - 显示名称（1-50字符，支持Unicode）

### 认证相关
- `verificationCode` - 6位数字验证码
- `phone` - 国际手机号格式

### 地理相关
- `latitude` - 纬度（-90 到 90）
- `longitude` - 经度（-180 到 180）

### 其他
- `hexColor` - 十六进制颜色代码（如 #FFFFFF）
- `page` - 页码（最小1，默认1）
- `limit` - 每页数量（1-100，默认20）
- `uuid` - UUID v4 格式
- `isoDateTime` - ISO 8601 日期时间格式

## 创建新的验证 Schema

### 示例：创建联盟验证

```javascript
// validators/allianceValidator.js
const Joi = require('joi');
const { userId, displayName, hexColor } = require('./commonValidator');

const createAllianceSchema = Joi.object({
  name: displayName.required(),
  description: Joi.string().max(500).optional(),
  color: hexColor.required(),
  founderId: userId.required(),
  members: Joi.array()
    .items(userId)
    .max(100)
    .default([])
});

module.exports = {
  createAllianceSchema
};
```

### 应用到路由

```javascript
// routes/alliance.js
const { validate } = require('../middleware/validation');
const { createAllianceSchema } = require('../validators/allianceValidator');

router.post('/create',
  authenticateToken,
  validate(createAllianceSchema),
  AllianceController.create
);
```

## 验证错误响应格式

当验证失败时，API 返回以下格式：

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

## 自定义验证规则

### 添加自定义验证

```javascript
const customSchema = Joi.object({
  password: Joi.string()
    .min(6)
    .max(128)
    .required(),
  confirmPassword: Joi.string()
    .valid(Joi.ref('password'))
    .required()
    .messages({
      'any.only': '两次输入的密码不一致'
    })
});
```

### 使用自定义验证方法

```javascript
const schema = Joi.object({
  username: Joi.string()
    .required()
    .custom((value, helpers) => {
      if (value.toLowerCase().includes('admin')) {
        return helpers.error('username.reserved');
      }
      return value;
    }, '用户名验证')
    .messages({
      'username.reserved': '该用户名已被保留'
    })
});
```

## 条件验证

### 根据其他字段决定是否必填

```javascript
const schema = Joi.object({
  channelType: Joi.string()
    .valid('global', 'alliance', 'private')
    .required(),
  channelId: Joi.string()
    .when('channelType', {
      is: Joi.string().valid('alliance', 'private'),
      then: Joi.required(),
      otherwise: Joi.optional()
    })
});
```

## 数组验证

```javascript
const batchCreateSchema = Joi.object({
  pixels: Joi.array()
    .items(createPixelSchema)
    .min(1)
    .max(1000)
    .required()
    .messages({
      'array.min': '至少需要提供1个像素',
      'array.max': '单次最多只能创建1000个像素'
    })
});
```

## 最佳实践

### 1. 重用通用验证规则
```javascript
// ✅ 推荐
const { email, password } = require('./commonValidator');
const schema = Joi.object({
  email: email.required(),
  password: password.required()
});

// ❌ 不推荐
const schema = Joi.object({
  email: Joi.string().email().max(255).required(),
  password: Joi.string().min(6).max(128).required()
});
```

### 2. 使用有意义的错误消息
```javascript
// ✅ 推荐 - 中文友好错误消息
const schema = Joi.object({
  age: Joi.number()
    .min(18)
    .messages({
      'number.min': '年龄必须大于等于18岁'
    })
});

// ❌ 不推荐 - 使用默认英文消息
const schema = Joi.object({
  age: Joi.number().min(18)
});
```

### 3. 始终使用 stripUnknown
验证中间件已自动配置 `stripUnknown: true`，会移除未定义的字段，提高安全性。

### 4. 使用 convert 进行类型转换
验证中间件已自动配置 `convert: true`，会自动转换类型（如字符串 "123" 转为数字 123）。

## 迁移指南

### 从手动验证迁移到 Joi

**之前（手动验证）：**
```javascript
// controller.js
if (!email || !validateEmail(email)) {
  return res.status(400).json({ error: '邮箱格式不正确' });
}
if (!password || password.length < 6) {
  return res.status(400).json({ error: '密码长度至少6个字符' });
}
```

**现在（Joi 验证）：**
```javascript
// validators/authValidator.js
const registerSchema = Joi.object({
  email: email.required(),
  password: password.required()
});

// routes/auth.js
router.post('/register',
  validate(registerSchema),
  AuthController.register
);

// controller.js - 验证逻辑已由中间件处理，直接使用清理后的数据
const { email, password } = req.body;
```

## 性能考虑

1. **Schema 重用**：预定义的 schema 只创建一次，在多个请求间重用
2. **早期验证**：在中间件层面验证，避免无效请求进入业务逻辑
3. **abortEarly: false**：返回所有错误，减少客户端重试次数

## 安全优势

1. **输入清理**：自动移除未知字段（`stripUnknown: true`）
2. **类型安全**：确保数据类型正确
3. **范围验证**：防止 SQL 注入、XSS 等攻击
4. **一致性**：统一的验证逻辑，减少人为错误

## 常见问题

### Q: 如何验证可选字段？
A: 使用 `.optional()` 或 `.allow(null)`
```javascript
const schema = Joi.object({
  nickname: Joi.string().max(50).optional(),
  avatar: Joi.string().uri().allow(null)
});
```

### Q: 如何设置默认值？
A: 使用 `.default()`
```javascript
const schema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20)
});
```

### Q: 如何验证至少提供一个字段？
A: 使用 `.min(1)` 或 `.or()`
```javascript
// 至少一个字段
const schema = Joi.object({
  email: Joi.string().email().optional(),
  phone: Joi.string().optional()
}).or('email', 'phone');

// 至少提供一个更新字段
const updateSchema = Joi.object({
  name: Joi.string().optional(),
  color: hexColor.optional()
}).min(1);
```

## 参考资源

- [Joi 官方文档](https://joi.dev/api/)
- [Express Validator 对比](https://express-validator.github.io/docs/)
- [OWASP 输入验证](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
