# 🔐 安全编码最佳实践

本文档为 FunnyPixels 后端开发人员提供日常编码中的安全最佳实践指南。

---

## 1. 认证和授权

### ✅ DO - 正确的做法

```javascript
// ✅ 使用 bcrypt 哈希密码
const bcrypt = require('bcrypt');
const saltRounds = 12; // 生产环境推荐
const hashedPassword = await bcrypt.hash(password, saltRounds);

// ✅ 验证密码
const isValid = await bcrypt.compare(password, user.password_hash);

// ✅ 使用 authenticateToken 中间件保护路由
router.get('/profile', authenticateToken, UserController.getProfile);

// ✅ 在控制器中检查权限
if (req.user.id !== resource.owner_id) {
  return res.status(403).json({ error: '无权访问' });
}
```

### ❌ DON'T - 错误的做法

```javascript
// ❌ 不要明文存储密码
await db('users').insert({ password: plainPassword });

// ❌ 不要使用弱哈希算法
const hash = crypto.createHash('md5').update(password).digest('hex');

// ❌ 不要在客户端验证敏感操作
// 客户端验证可以被绕过，服务端必须再次验证

// ❌ 不要硬编码密钥
const JWT_SECRET = 'my-secret-key-123';
```

---

## 2. 输入验证

### ✅ DO - 正确的做法

```javascript
// ✅ 使用 Joi schema 验证所有输入
const { validate } = require('../middleware/validation');
const { createPixelSchema } = require('../validators/pixelValidator');

router.post('/pixels', validate(createPixelSchema), PixelController.create);

// ✅ 验证所有数据源（body, query, params）
router.get('/users/:id',
  validate(userIdSchema, 'params'),
  validate(querySchema, 'query'),
  UserController.getUser
);

// ✅ 使用白名单而非黑名单
const allowedFields = ['name', 'email', 'avatar'];
const sanitizedData = {};
allowedFields.forEach(field => {
  if (req.body[field] !== undefined) {
    sanitizedData[field] = req.body[field];
  }
});

// ✅ 验证业务逻辑约束
if (user.balance < price) {
  return res.status(400).json({ error: '余额不足' });
}
```

### ❌ DON'T - 错误的做法

```javascript
// ❌ 不要信任客户端输入
const userId = req.query.userId; // 未验证
await db('users').where('id', userId).first();

// ❌ 不要使用正则表达式黑名单
const sanitized = input.replace(/<script>/g, ''); // 可被绕过：<scr<script>ipt>

// ❌ 不要跳过验证
// if (process.env.NODE_ENV === 'development') {
//   // 跳过验证 - 危险！
// }
```

---

## 3. SQL 注入防护

### ✅ DO - 正确的做法

```javascript
// ✅ 使用 Knex.js 参数化查询
const users = await db('users')
  .where('email', email)
  .andWhere('status', 'active');

// ✅ 使用参数绑定
const result = await db.raw(
  'SELECT * FROM users WHERE email = ? AND created_at > ?',
  [email, startDate]
);

// ✅ 使用 Knex query builder
const pixels = await db('pixels')
  .whereIn('grid_id', gridIds)
  .whereBetween('created_at', [startDate, endDate]);
```

### ❌ DON'T - 错误的做法

```javascript
// ❌ 不要拼接 SQL 字符串
const query = `SELECT * FROM users WHERE email = '${email}'`; // 危险！
const result = await db.raw(query);

// ❌ 不要使用未验证的输入构建查询
const orderBy = req.query.sort; // 可能是恶意的
await db('users').orderByRaw(orderBy); // 危险！

// 正确做法：使用白名单
const allowedSortFields = ['created_at', 'name'];
const orderBy = allowedSortFields.includes(req.query.sort)
  ? req.query.sort
  : 'created_at';
```

---

## 4. XSS 防护

### ✅ DO - 正确的做法

```javascript
// ✅ 使用 Joi 验证并清理输入
const schema = Joi.object({
  content: Joi.string()
    .max(1000)
    .trim()
    .required()
});

// ✅ 前端使用 React/Vue 自动转义
// React: {user.name} 自动转义
// Vue: {{ user.name }} 自动转义

// ✅ 设置 CSP 头（已在 Helmet 配置）
// Content-Security-Policy: default-src 'self'

// ✅ 对 HTML 内容使用专门的清理库
const sanitizeHtml = require('sanitize-html');
const clean = sanitizeHtml(userInput, {
  allowedTags: ['b', 'i', 'em', 'strong'],
  allowedAttributes: {}
});
```

### ❌ DON'T - 错误的做法

```javascript
// ❌ 不要直接返回 HTML
res.send(`<h1>Welcome ${username}</h1>`); // XSS 风险

// ❌ 不要使用 dangerouslySetInnerHTML（React）
<div dangerouslySetInnerHTML={{__html: userInput}} />

// ❌ 不要使用 v-html（Vue）
<div v-html="userInput"></div>
```

---

## 5. 日志安全

### ✅ DO - 正确的做法

```javascript
// ✅ 记录必要信息，但不包含敏感数据
logger.info('用户登录成功', {
  userId: user.id,
  email: user.email,
  ip: req.ip,
  userAgent: req.get('User-Agent')
});

// ✅ 错误日志中隐藏敏感信息
logger.error('数据库连接失败', {
  error: error.message,
  code: error.code,
  // 不要记录连接字符串中的密码
  host: dbConfig.host
});

// ✅ 使用日志级别
logger.debug('调试信息'); // 开发环境
logger.info('常规信息');
logger.warn('警告信息');
logger.error('错误信息');
```

### ❌ DON'T - 错误的做法

```javascript
// ❌ 不要记录密码
logger.info('用户注册', { email, password }); // 危险！

// ❌ 不要记录完整的 JWT token
logger.info('Token:', req.headers.authorization); // 危险！

// ❌ 不要记录信用卡号、身份证号等
logger.info('支付信息', { cardNumber, cvv }); // 违法！

// 正确做法：脱敏
logger.info('支付信息', {
  cardLast4: cardNumber.slice(-4),
  cardType: 'VISA'
});
```

---

## 6. 密钥和配置管理

### ✅ DO - 正确的做法

```javascript
// ✅ 从环境变量读取密钥
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET 未配置');
}

// ✅ 使用配置常量
const { AUTH, CACHE } = require('../constants/config');
const tokenExpiry = AUTH.JWT_ACCESS_TOKEN_EXPIRY;

// ✅ 不同环境使用不同配置
const dbConfig = {
  client: 'pg',
  connection: process.env.DATABASE_URL,
  pool: {
    min: process.env.NODE_ENV === 'production' ? 5 : 2,
    max: process.env.NODE_ENV === 'production' ? 25 : 10
  }
};

// ✅ 验证必需的环境变量
const requiredEnvVars = ['JWT_SECRET', 'DATABASE_URL', 'REDIS_URL'];
requiredEnvVars.forEach(varName => {
  if (!process.env[varName]) {
    throw new Error(`环境变量 ${varName} 未设置`);
  }
});
```

### ❌ DON'T - 错误的做法

```javascript
// ❌ 不要硬编码密钥
const JWT_SECRET = 'my-secret-key-123'; // 危险！

// ❌ 不要提交 .env 文件到 git
// 确保 .env 在 .gitignore 中

// ❌ 不要在代码中存储 API 密钥
const STRIPE_SECRET_KEY = 'sk_live_xxx'; // 危险！

// ❌ 不要使用默认密钥
const dbPassword = 'password123'; // 危险！
```

---

## 7. 错误处理

### ✅ DO - 正确的做法

```javascript
// ✅ 捕获所有错误
try {
  const result = await someOperation();
  res.json({ success: true, data: result });
} catch (error) {
  logger.error('操作失败', {
    error: error.message,
    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
  });

  // 返回通用错误消息
  res.status(500).json({
    success: false,
    error: 'INTERNAL_SERVER_ERROR',
    message: '服务器内部错误'
  });
}

// ✅ 使用错误类型区分错误
if (error.name === 'ValidationError') {
  return res.status(400).json({ error: '输入验证失败' });
}
if (error.name === 'UnauthorizedError') {
  return res.status(401).json({ error: '未授权访问' });
}

// ✅ 使用全局错误处理中间件
app.use(errorHandler); // 见 middleware/security.js
```

### ❌ DON'T - 错误的做法

```javascript
// ❌ 不要暴露堆栈跟踪到客户端
res.status(500).json({
  error: error.message,
  stack: error.stack // 危险！
});

// ❌ 不要暴露数据库错误细节
catch (error) {
  res.status(500).json({
    error: 'Database connection failed: ECONNREFUSED' // 信息泄露
  });
}

// ❌ 不要忽略错误
someAsyncOperation().catch(() => {}); // 危险！
```

---

## 8. 文件上传

### ✅ DO - 正确的做法

```javascript
// ✅ 验证文件类型
const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif'];
if (!allowedMimeTypes.includes(file.mimetype)) {
  return res.status(400).json({ error: '不支持的文件类型' });
}

// ✅ 验证文件大小
const maxSize = 5 * 1024 * 1024; // 5MB
if (file.size > maxSize) {
  return res.status(400).json({ error: '文件太大' });
}

// ✅ 重命名文件
const { v4: uuidv4 } = require('uuid');
const filename = `${uuidv4()}${path.extname(file.originalname)}`;

// ✅ 存储在安全位置
const uploadDir = path.join(__dirname, '../../uploads');
// 确保 uploads 目录不在 public 目录下

// ✅ 使用云存储（推荐）
const url = await uploadToS3(file); // AWS S3, Cloudflare R2 等
```

### ❌ DON'T - 错误的做法

```javascript
// ❌ 不要信任客户端提供的 MIME 类型
// 需要验证实际文件内容

// ❌ 不要使用原始文件名
const filename = file.originalname; // 可能包含 ../../../etc/passwd

// ❌ 不要允许可执行文件
// .exe, .sh, .bat, .php, .jsp 等

// ❌ 不要存储在 Web 可访问目录
const uploadDir = path.join(__dirname, '../../public/uploads'); // 危险！
```

---

## 9. Rate Limiting

### ✅ DO - 正确的做法

```javascript
// ✅ 对敏感端点应用 Rate Limiting
const { authLimiter } = require('../middleware/rateLimit');
router.post('/login', authLimiter, AuthController.login);

// ✅ 对不同端点使用不同的限制
router.post('/register', registerLimiter, AuthController.register);
router.post('/send-code', authLimiter, AuthController.sendCode);

// ✅ 使用 Redis 存储（支持分布式）
// 已在 middleware/rateLimit.js 中配置

// ✅ 返回有用的错误消息
{
  success: false,
  message: '请求过于频繁，请稍后再试',
  code: 'RATE_LIMIT_EXCEEDED'
}
```

### ❌ DON'T - 错误的做法

```javascript
// ❌ 不要只在内存中存储限流数据
// 多实例部署时无法共享状态

// ❌ 不要设置过于宽松的限制
router.post('/login', rateLimit({
  windowMs: 1000,
  max: 10000 // 太宽松！
}));

// ❌ 不要忘记对 API 端点限流
// 所有公开端点都应该有 Rate Limiting
```

---

## 10. 依赖项安全

### ✅ DO - 正确的做法

```bash
# ✅ 定期检查漏洞
npm audit

# ✅ 仅修复生产依赖漏洞
npm audit fix --only=prod

# ✅ 使用 npm ci 在 CI/CD 中
npm ci  # 更快，更可靠

# ✅ 锁定依赖版本
# 使用 package-lock.json
```

### ❌ DON'T - 错误的做法

```bash
# ❌ 不要使用过时的包
# 检查最后更新时间

# ❌ 不要安装未知来源的包
npm install some-random-package

# ❌ 不要忽略 npm audit 警告
```

---

## 11. CORS 配置

### ✅ DO - 正确的做法

```javascript
// ✅ 使用白名单
const corsOrigins = [
  'https://funnypixels.com',
  'https://app.funnypixels.com'
];

// ✅ 验证 Origin
origin: function (origin, callback) {
  if (!origin && process.env.NODE_ENV !== 'production') {
    return callback(null, true); // 开发环境允许
  }
  if (corsOrigins.includes(origin)) {
    callback(null, true);
  } else {
    logger.warn('CORS拒绝:', origin);
    callback(null, false);
  }
}
```

### ❌ DON'T - 错误的做法

```javascript
// ❌ 不要使用通配符
cors({ origin: '*' }); // 危险！

// ❌ 不要使用 .includes() 检查域名
if (origin.includes('.pages.dev')) {
  return callback(null, true); // 可被绕过！
}

// ❌ 不要在生产环境允许所有域名
```

---

## 12. 会话管理

### ✅ DO - 正确的做法

```javascript
// ✅ 设置安全的 Cookie 选项
res.cookie('sessionId', sessionId, {
  httpOnly: true,  // 防止 XSS
  secure: true,    // 仅 HTTPS
  sameSite: 'strict', // 防止 CSRF
  maxAge: 24 * 60 * 60 * 1000 // 24小时
});

// ✅ 使用 Redis 存储会话
// 支持分布式部署

// ✅ 实现会话过期
if (Date.now() - session.lastActivity > SESSION_TIMEOUT) {
  // 会话过期
  delete session;
}

// ✅ 登出时清除会话
res.clearCookie('sessionId');
await redis.del(`session:${sessionId}`);
```

### ❌ DON'T - 错误的做法

```javascript
// ❌ 不要在 Cookie 中存储敏感信息
res.cookie('user', JSON.stringify(user)); // 危险！

// ❌ 不要使用长期会话
maxAge: 365 * 24 * 60 * 60 * 1000 // 1年太长！

// ❌ 不要忘记设置 httpOnly
res.cookie('token', token); // 可被 XSS 窃取
```

---

## 13. 密码策略

### ✅ DO - 正确的做法

```javascript
// ✅ 合理的密码要求
const password = Joi.string()
  .min(6)
  .max(128)
  .required();

// ✅ 使用 bcrypt
const saltRounds = 12; // 生产环境推荐
const hash = await bcrypt.hash(password, saltRounds);

// ✅ 实施密码重置流程
// 1. 发送验证码到邮箱
// 2. 验证验证码
// 3. 允许设置新密码
// 4. 清除所有现有会话

// ✅ 防止时序攻击
const isValid = await bcrypt.compare(password, hash);
// bcrypt.compare 内部已防护时序攻击
```

### ❌ DON'T - 错误的做法

```javascript
// ❌ 不要要求过于复杂的密码
// 用户会写在纸上或重复使用

// ❌ 不要限制密码字符
// 允许任何字符（空格、emoji 等）

// ❌ 不要使用弱哈希
const hash = crypto.createHash('sha256').update(password).digest('hex');
// SHA-256 太快，易被暴力破解

// ❌ 不要通过邮件发送密码
// 只发送重置链接
```

---

## 14. API 密钥管理

### ✅ DO - 正确的做法

```javascript
// ✅ 使用环境变量
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

// ✅ 不同环境使用不同密钥
const apiKey = process.env.NODE_ENV === 'production'
  ? process.env.PROD_API_KEY
  : process.env.DEV_API_KEY;

// ✅ 定期轮换密钥
// 建议每 3-6 个月轮换一次

// ✅ 使用密钥管理服务
// AWS Secrets Manager, Azure Key Vault, HashiCorp Vault
```

### ❌ DON'T - 错误的做法

```javascript
// ❌ 不要硬编码
const API_KEY = 'sk_live_xxx'; // 危险！

// ❌ 不要提交到 Git
// 确保 .env 在 .gitignore

// ❌ 不要在客户端使用私钥
// 只在服务端使用
```

---

## 15. 安全检查清单（开发阶段）

在提交代码前，检查以下项目：

- [ ] 所有用户输入都经过验证（使用 Joi schema）
- [ ] 使用参数化查询（Knex.js）
- [ ] 敏感端点有 Rate Limiting
- [ ] 需要认证的端点使用 `authenticateToken`
- [ ] 不记录密码、Token 等敏感信息
- [ ] 错误处理不暴露内部细节
- [ ] CORS 配置正确
- [ ] 文件上传有大小和类型限制
- [ ] 密码使用 bcrypt 哈希
- [ ] 没有硬编码的密钥
- [ ] 运行 `npm audit` 检查漏洞

---

## 🚨 常见安全陷阱

### 1. 信任客户端数据

```javascript
// ❌ 危险
const isAdmin = req.body.isAdmin; // 客户端可以传 true！

// ✅ 正确
const isAdmin = await checkUserRole(req.user.id) === 'admin';
```

### 2. 不验证资源所有权

```javascript
// ❌ 危险
const pixel = await db('pixels').where('id', req.params.id).first();
await db('pixels').where('id', pixel.id).delete();

// ✅ 正确
const pixel = await db('pixels')
  .where('id', req.params.id)
  .andWhere('user_id', req.user.id)
  .first();
if (!pixel) {
  return res.status(404).json({ error: '像素未找到或无权删除' });
}
```

### 3. 使用 eval() 或 Function()

```javascript
// ❌ 绝不使用
eval(userInput); // 代码注入风险
new Function(userInput)(); // 同样危险
```

### 4. 不安全的随机数

```javascript
// ❌ 不安全（可预测）
const token = Math.random().toString(36).substr(2);

// ✅ 安全
const crypto = require('crypto');
const token = crypto.randomBytes(32).toString('hex');
```

---

## 📚 延伸阅读

- [OWASP Cheat Sheet Series](https://cheatsheetseries.owasp.org/)
- [Node.js Security Handbook](https://www.sqreen.com/resources/nodejs-security-handbook)
- [Express Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)

---

**记住**：安全是一个持续的过程，不是一次性的任务。保持警惕，持续学习！
