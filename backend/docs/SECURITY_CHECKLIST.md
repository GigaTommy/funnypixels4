# 🔒 FunnyPixels 后端安全配置检查清单

## 概述

本文档提供了 FunnyPixels 后端项目的安全配置检查清单，用于部署前的安全审查和日常安全维护。

**最后更新**: 2026-02-21
**适用环境**: Production, Staging

---

## 📋 部署前安全检查清单

### 1. 环境变量和密钥管理

#### ✅ 必须配置的环境变量

- [ ] `JWT_SECRET` - JWT 访问令牌密钥（至少32字符，随机生成）
- [ ] `JWT_REFRESH_SECRET` - JWT 刷新令牌密钥（至少32字符，随机生成）
- [ ] `DATABASE_URL` - 数据库连接字符串（包含安全密码）
- [ ] `REDIS_URL` - Redis 连接字符串（包含密码）
- [ ] `NODE_ENV=production` - 生产环境标识

#### ✅ 密钥强度验证

```bash
# 验证 JWT 密钥长度（至少32字符）
node -e "console.log('JWT_SECRET length:', process.env.JWT_SECRET?.length || 0)"
node -e "console.log('JWT_REFRESH_SECRET length:', process.env.JWT_REFRESH_SECRET?.length || 0)"
```

**要求**:
- JWT 密钥长度 ≥ 32 字符
- 使用加密安全的随机字符串
- 不同环境使用不同的密钥
- 定期轮换密钥（建议每6个月）

#### ✅ 环境变量安全

- [ ] 不在代码中硬编码任何密钥
- [ ] `.env` 文件已添加到 `.gitignore`
- [ ] 生产环境使用环境变量而非 `.env` 文件
- [ ] 使用密钥管理服务（AWS Secrets Manager, Azure Key Vault 等）

#### 🛠️ 生成安全密钥

```bash
# 生成32字符随机密钥
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 生成64字符随机密钥（更安全）
node -e "console.log(require('crypto').randomBytes(64).toString('base64'))"
```

---

### 2. 认证和授权

#### ✅ JWT 配置

- [ ] JWT 访问令牌过期时间已配置（默认 1 小时）
- [ ] JWT 刷新令牌过期时间已配置（默认 7 天）
- [ ] JWT 签名算法使用 HS256 或更强
- [ ] 启动时验证 JWT 密钥存在（见 `middleware/auth.js`）

**配置位置**: `src/constants/config.js`
```javascript
AUTH: {
  JWT_ACCESS_TOKEN_EXPIRY: '1h',
  JWT_REFRESH_TOKEN_EXPIRY: '7d',
  JWT_MIN_SECRET_LENGTH: 32
}
```

#### ✅ 密码策略

- [ ] 密码最小长度 ≥ 6 字符（见 `validators/commonValidator.js`）
- [ ] 密码最大长度 ≤ 128 字符
- [ ] 使用 bcrypt 哈希存储密码
- [ ] bcrypt 轮数 ≥ 10（生产环境建议 12）

**验证位置**: `validators/authValidator.js`

#### ✅ 验证码安全

- [ ] 验证码为 6 位数字
- [ ] 验证码有效期 ≤ 5 分钟
- [ ] 验证成功后立即删除验证码
- [ ] 使用验证码后无法重用

**实现位置**: `controllers/authController.js::verifyVerificationCode()`

---

### 3. 输入验证

#### ✅ Joi 验证已启用

- [ ] 所有 POST/PUT 端点使用 Joi schema 验证
- [ ] 启用 `stripUnknown: true` 移除未知字段
- [ ] 启用 `abortEarly: false` 返回所有错误
- [ ] 启用 `convert: true` 自动类型转换

**验证位置**:
- `validators/commonValidator.js`
- `validators/authValidator.js`
- `validators/pixelValidator.js`

#### ✅ 已验证的关键端点

- [ ] `/api/auth/register` - 注册验证
- [ ] `/api/auth/login` - 登录验证
- [ ] `/api/auth/send-code` - 验证码验证
- [ ] `/api/auth/change-password` - 密码修改验证
- [ ] 其他关键业务端点

**应用位置**: `routes/auth.js`

#### ✅ 输入清理

- [ ] 移除 HTML 标签（`<>` 字符）
- [ ] 移除 `javascript:` 协议
- [ ] 移除内联事件处理器（`onXxx=`）
- [ ] Trim 字符串两端空格

**实现位置**: `middleware/security.js::sanitizeInput()`

---

### 4. CORS 配置

#### ✅ CORS 白名单

**配置位置**: `src/server.js` (行 200-221)

- [ ] 仅允许白名单中的域名
- [ ] 生产环境移除通配符匹配（已完成，见 Task #16）
- [ ] 生产环境要求 Origin 头部
- [ ] 禁用 `credentials: true`（如不需要）

**当前白名单**:
```javascript
const corsOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'https://funnypixels.pages.dev',
  'https://funnypixels-frontend.pages.dev'
];
```

#### 🚨 禁止配置

- ❌ 不要使用 `origin: '*'`
- ❌ 不要使用 `.includes()` 检查域名（已修复）
- ❌ 不要在生产环境允许所有 `.pages.dev` 域名（已修复）

---

### 5. 速率限制

#### ✅ Rate Limiter 配置

**配置位置**: `src/middleware/rateLimit.js`

| 端点类型 | 时间窗口 | 最大请求数 | 目的 |
|---------|---------|----------|------|
| 认证 (`/api/auth/login`) | 15分钟 | 5次 | 防止暴力破解 |
| 注册 (`/api/auth/register`) | 1小时 | 3次 | 防止垃圾注册 |
| API 通用 | 1分钟 | 200次 | 防止滥用 |
| 排行榜 (`/api/leaderboard/*`) | 1分钟 | 60次 | 防止刷榜 |
| 像素绘制 (`/api/pixels/draw`) | 1分钟 | 2000次 | 防止恶意刷屏 |
| 聊天 (`/api/chat/*`) | 10秒 | 10次 | 防止刷屏 |
| 文件上传 (`/api/upload/*`) | 1分钟 | 5次 | 防止资源滥用 |

#### ✅ Redis 存储

- [ ] Rate Limiter 使用 Redis 存储（支持分布式）
- [ ] 每个限流器使用独立的 prefix 隔离计数器
- [ ] Redis 连接失败时降级到内存存储

**实现**: `middleware/rateLimit.js::RedisStore`

---

### 6. 内容安全策略 (CSP)

#### ✅ Helmet 配置

**配置位置**: `src/middleware/security.js`

- [ ] 生产环境禁用 `unsafe-inline`（已完成，见 Task #4）
- [ ] 生产环境禁用 `unsafe-eval`（已完成）
- [ ] 启用 `HSTS` 强制 HTTPS
- [ ] 启用 `frameguard` 防止点击劫持
- [ ] 启用 `noSniff` 防止 MIME 嗅探
- [ ] 启用 `xssFilter` 防止 XSS

**当前 CSP 配置**:
```javascript
contentSecurityPolicy: {
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: isProduction ? ["'self'"] : ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
    styleSrc: isProduction ? ["'self'"] : ["'self'", "'unsafe-inline'"],
    connectSrc: ["'self'", "ws:", "wss:", "https:"],
    imgSrc: ["'self'", "data:", "https:", "blob:"]
  }
}
```

---

### 7. 数据库安全

#### ✅ 连接池配置

**配置位置**: `src/constants/config.js`

- [ ] 生产环境最小连接数: 5
- [ ] 生产环境最大连接数: 25
- [ ] 连接超时: 30秒
- [ ] 空闲超时: 20秒（生产环境）

#### ✅ SQL 注入防护

- [ ] 使用 Knex.js 参数化查询
- [ ] 避免字符串拼接 SQL
- [ ] 使用 `whereRaw()` 时传递参数绑定

**正确示例**:
```javascript
// ✅ 正确 - 参数化查询
db('users').where('email', email);
db.raw('SELECT * FROM users WHERE email = ?', [email]);

// ❌ 错误 - 字符串拼接
db.raw(`SELECT * FROM users WHERE email = '${email}'`);
```

#### ✅ 数据库访问控制

- [ ] 数据库用户使用最小权限原则
- [ ] 应用账户不应有 DROP/ALTER 权限
- [ ] 使用只读副本处理查询密集型操作

---

### 8. Redis 安全

#### ✅ Redis 配置

- [ ] Redis 启用密码认证
- [ ] Redis 绑定到内网地址（不对外暴露）
- [ ] 使用 TLS 加密连接（生产环境推荐）

#### ✅ Redis 操作安全

- [ ] 避免使用 `KEYS` 命令（已修复，见 Task #22）
- [ ] 使用 `SCAN` 代替 `KEYS`
- [ ] 设置合理的 TTL 避免内存泄漏
- [ ] 启用 Redis maxmemory 和淘汰策略

**实现位置**: `services/drawingSessionService.js::_scanAndDelete()`

---

### 9. 文件上传安全

#### ✅ 文件类型限制

**配置位置**: `src/middleware/security.js::fileUploadSecurity()`

- [ ] 仅允许图片类型: JPEG, PNG, GIF, WebP
- [ ] 验证 MIME 类型
- [ ] 验证文件扩展名
- [ ] 文件大小限制 ≤ 5MB

#### ✅ 文件存储

- [ ] 上传文件重命名（UUID）
- [ ] 存储在非 Web 可访问目录
- [ ] 通过专用端点提供文件（验证权限）
- [ ] 定期清理过期临时文件

---

### 10. 日志和监控

#### ✅ 日志安全

- [ ] 不记录敏感信息（密码、JWT token）（已完成，见 Task #2）
- [ ] 记录安全事件（登录失败、权限错误）
- [ ] 记录可疑请求模式

**实现位置**:
- `middleware/security.js::securityLogger()`
- `middleware/auth.js` (JWT 日志已清理)

#### ✅ 性能监控

- [ ] 记录慢请求（> 200ms）
- [ ] 记录排行榜慢查询（> 500ms）
- [ ] 监控数据库连接池使用率
- [ ] 监控 Redis 内存使用

**实现位置**: `middleware/security.js::requestLogger()`

#### ✅ 告警配置

- [ ] 批量刷新达到最大迭代次数
- [ ] 增量排行榜连续失败 ≥ 5 次
- [ ] Rate Limiter 达到阈值
- [ ] 数据库连接池耗尽

---

### 11. 会话管理

#### ✅ Cookie 安全

- [ ] `httpOnly: true` - 防止 XSS 访问
- [ ] `secure: true` - 生产环境仅 HTTPS 传输
- [ ] `sameSite: 'strict'` - 防止 CSRF
- [ ] 合理的过期时间（默认 24 小时）

**实现位置**: `middleware/security.js::sessionSecurity()`

#### ✅ 会话存储

- [ ] 使用 Redis 存储会话
- [ ] 会话 TTL: 1 小时（活跃会话）
- [ ] 自动清理过期会话（24 小时未活动）

**配置位置**: `src/constants/config.js::SESSION`

---

### 12. 错误处理

#### ✅ 错误响应

- [ ] 生产环境不暴露堆栈跟踪
- [ ] 返回通用错误消息（"服务器内部错误"）
- [ ] 记录详细错误日志供调试

**实现位置**: `middleware/security.js::errorHandler()`

#### ✅ 错误类型

```javascript
// ✅ 正确 - 生产环境
{
  success: false,
  error: 'INTERNAL_SERVER_ERROR',
  message: '服务器内部错误'
}

// ❌ 错误 - 暴露内部信息
{
  error: 'Database connection failed: ECONNREFUSED',
  stack: '...'
}
```

---

### 13. HTTPS 和传输安全

#### ✅ HTTPS 配置

- [ ] 生产环境强制使用 HTTPS
- [ ] 启用 HSTS (max-age ≥ 31536000 秒)
- [ ] 使用有效的 TLS 证书
- [ ] TLS 版本 ≥ 1.2

#### ✅ Helmet HSTS 配置

```javascript
hsts: {
  maxAge: 31536000,        // 1 年
  includeSubDomains: true,
  preload: true
}
```

---

### 14. 依赖项安全

#### ✅ npm 审计

```bash
# 检查已知漏洞
npm audit

# 自动修复（谨慎使用）
npm audit fix

# 仅修复安全漏洞
npm audit fix --only=prod
```

#### ✅ 定期更新

- [ ] 每月运行 `npm audit`
- [ ] 及时更新有安全漏洞的包
- [ ] 测试更新后的依赖项

#### ✅ 使用 Snyk 或 Dependabot

- [ ] 启用 GitHub Dependabot 自动 PR
- [ ] 集成 Snyk 扫描

---

### 15. API 安全最佳实践

#### ✅ 幂等性

- [ ] 关键操作支持幂等性 Key（`x-idempotency-key`）
- [ ] 防止重复提交

#### ✅ 分页限制

- [ ] 所有列表接口限制每页最大数量（≤ 100）
- [ ] 默认分页大小: 20

**实现位置**: `validators/commonValidator.js::page, limit`

#### ✅ 批量操作限制

- [ ] 批量像素创建 ≤ 1000
- [ ] 批量查询 ≤ 1000

**实现位置**: `validators/pixelValidator.js::batchCreatePixelSchema`

---

## 🛡️ 安全事件响应

### 发现安全漏洞时的步骤

1. **立即隔离**
   - 停止受影响的服务
   - 阻止可疑 IP 地址
   - 轮换受影响的密钥

2. **评估影响**
   - 确定受影响的用户范围
   - 检查数据是否泄露
   - 分析攻击向量

3. **修复漏洞**
   - 应用安全补丁
   - 更新依赖项
   - 加固相关配置

4. **通知用户**（如有数据泄露）
   - 按照 GDPR/CCPA 要求通知
   - 提供修复建议
   - 强制重置密码（如需要）

5. **事后审查**
   - 编写事件报告
   - 更新安全检查清单
   - 改进监控和告警

---

## 📞 安全联系方式

**安全负责人**: [待填写]
**安全邮箱**: security@funnypixels.com
**漏洞赏金计划**: [待填写]

---

## 📚 参考资源

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [OWASP API Security Top 10](https://owasp.org/www-project-api-security/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [Express.js Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)
- [Helmet.js Documentation](https://helmetjs.github.io/)
- [Joi Validation](https://joi.dev/)

---

## 📋 快速检查命令

```bash
# 1. 验证环境变量
node -e "const requiredEnvVars = ['JWT_SECRET', 'JWT_REFRESH_SECRET', 'DATABASE_URL', 'REDIS_URL']; requiredEnvVars.forEach(v => console.log(v + ':', process.env[v] ? '✅ 已设置' : '❌ 未设置'))"

# 2. 检查依赖项漏洞
npm audit --production

# 3. 检查 JWT 密钥长度
node -e "console.log('JWT_SECRET 长度:', (process.env.JWT_SECRET || '').length, process.env.JWT_SECRET?.length >= 32 ? '✅' : '❌')"

# 4. 检查 Node 版本
node -v  # 应该 >= 18.x

# 5. 检查生产环境
node -e "console.log('NODE_ENV:', process.env.NODE_ENV, process.env.NODE_ENV === 'production' ? '✅' : '⚠️')"
```

---

**版本**: 1.0.0
**维护者**: FunnyPixels 后端团队
**下次审查日期**: [3个月后]
