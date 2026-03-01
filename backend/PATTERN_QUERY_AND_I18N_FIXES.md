# Pattern 查询与多语言修复总结

## 📅 修复日期
2026-02-22

## 🎯 修复的三个核心问题

### 1. ✅ Pattern Assets 统一使用 Key 查询

**问题**：代码中混用 ID 和 Key 查询 `pattern_assets` 表，导致类型不匹配错误。

**修复策略**：
- ❌ 废弃：通过数字 ID 查询 pattern_assets
- ✅ 统一：所有查询必须使用字符串 key（如 `color_magenta`, `emoji_smile`, `custom_xxx`）

**修改的文件**：

1. **`src/controllers/patternController.js`**
   - 移除所有 `PatternAsset.getById()` 调用
   - 统一使用 `PatternAsset.getByKey()`
   - 更新 4 处查询逻辑：
     - `getPatternInfo()` - 获取图案信息
     - `getPatternDetail()` - 获取图案详情
     - `updatePattern()` - 更新图案（管理员）
     - `verifyPattern()` - 验证图案（管理员）
     - `deletePattern()` - 删除图案（管理员）

2. **`src/controllers/allianceController.js`**
   - 移除 ID/Key 判断逻辑
   - 统一使用 `where('key', alliance.flag_pattern_id)`

3. **`src/controllers/pixelController.js`**
   - 移除 ID/Key 判断逻辑
   - 统一使用 `where('key', allianceResult.flag_pattern_id)`

**代码示例**：
```javascript
// ❌ 之前的错误做法
if (/^\d+$/.test(pattern_id)) {
  pattern = await PatternAsset.getById(parseInt(pattern_id));
} else {
  pattern = await PatternAsset.getByKey(pattern_id);
}

// ✅ 现在的正确做法
const pattern = await PatternAsset.getByKey(pattern_id);
```

---

### 2. ✅ Trust Proxy 安全配置

**问题**：生产环境盲目信任所有代理，存在 IP 欺骗风险。

**修复策略**：
- 生产环境：仅信任第一个代理（nginx/CDN）
- 开发环境：信任所有代理（方便调试）

**修改的文件**：

1. **`src/server.js`**
```javascript
// 🔧 生产环境 vs 开发环境差异化配置
if (process.env.NODE_ENV === 'production') {
  // 生产环境：仅信任第一个代理（防止 IP 欺骗）
  app.set('trust proxy', 1);
} else {
  // 开发环境：信任所有代理
  app.set('trust proxy', true);
}
```

2. **`src/middleware/security.js`**
   - 新增 `getClientIP(req)` 辅助函数
   - 优先级：`X-Forwarded-For` > `X-Real-IP` > `req.ip`
   - 更新所有日志记录使用 `getClientIP()`

**受益的功能**：
- 请求日志正确显示客户端真实 IP
- 错误日志准确记录攻击来源
- CSRF 保护基于真实 IP
- 安全监控基于真实 IP

---

### 3. ✅ iOS 端多语言支持 - 移除硬编码中文

**问题**：API 响应中硬编码中文错误消息，iOS 国际化困难。

**修复策略**：
- 使用现有的 i18next 国际化系统
- 所有面向客户端的消息支持中英双语
- 基于 `Accept-Language` 头自动选择语言

**新增翻译键**：

**English (`locales/en/errors.json`)**：
```json
{
  "pattern": {
    "notFound": "Pattern not found",
    "invalidKey": "Invalid pattern key",
    "loadFailed": "Failed to load pattern information"
  }
}
```

**中文 (`locales/zh/errors.json`)**：
```json
{
  "pattern": {
    "notFound": "图案不存在",
    "invalidKey": "无效的图案标识",
    "loadFailed": "获取图案信息失败"
  }
}
```

**新增快捷方法 (`utils/i18n.js`)**：
```javascript
const errors = {
  // ... 其他错误
  patternNotFound: (req) => createErrorResponse(req, 'pattern.notFound', 404),
  patternLoadFailed: (req) => createErrorResponse(req, 'pattern.loadFailed', 500)
};
```

**更新的控制器**：
```javascript
// ❌ 之前硬编码中文
if (!pattern) {
  return res.status(404).json({
    success: false,
    message: '图案不存在'
  });
}

// ✅ 现在支持多语言
if (!pattern) {
  const errorResponse = errors.patternNotFound(req);
  return res.status(errorResponse.statusCode).json(errorResponse);
}
```

**iOS 客户端使用方式**：
```swift
// 在 API 请求头中指定语言
request.setValue("en", forHTTPHeaderField: "Accept-Language")
// 或
request.setValue("zh-CN", forHTTPHeaderField: "Accept-Language")
```

**响应示例**：

英文响应：
```json
{
  "success": false,
  "error": "PATTERN_NOT_FOUND",
  "message": "Pattern not found"
}
```

中文响应：
```json
{
  "success": false,
  "error": "PATTERN_NOT_FOUND",
  "message": "图案不存在"
}
```

---

## 🔍 影响范围

### API 端点
- ✅ `/api/patterns/:id` - GET 图案详情
- ✅ `/api/patterns/:id/info` - GET 图案信息
- ✅ `/api/patterns/:id` - PUT 更新图案
- ✅ `/api/patterns/:id/verify` - POST 验证图案
- ✅ `/api/patterns/:id` - DELETE 删除图案
- ✅ `/api/alliances/:id/flag` - GET 联盟旗帜
- ✅ `/api/pixels/:id` - GET 像素信息（含联盟旗帜）

### 客户端影响
- **iOS App**：需要确保传递 pattern **key** 而非 ID
- **Frontend**：需要确保传递 pattern **key** 而非 ID
- **Admin Frontend**：需要确保传递 pattern **key** 而非 ID

---

## 🧪 测试建议

### 1. Pattern Key 查询测试
```bash
# 测试有效的 key
curl -X GET http://localhost:3000/api/patterns/color_magenta

# 测试无效的 key
curl -X GET http://localhost:3000/api/patterns/invalid_key

# 测试联盟旗帜
curl -X GET http://localhost:3000/api/alliances/1/flag \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 2. IP 获取测试
```bash
# 模拟代理请求
curl -X GET http://localhost:3000/api/pixel-draw/validate \
  -H "X-Forwarded-For: 192.168.1.15" \
  -H "Authorization: Bearer YOUR_TOKEN"

# 检查日志中的 IP 是否正确显示为 192.168.1.15
```

### 3. 多语言测试
```bash
# 英文响应
curl -X GET http://localhost:3000/api/patterns/invalid_key \
  -H "Accept-Language: en"

# 中文响应
curl -X GET http://localhost:3000/api/patterns/invalid_key \
  -H "Accept-Language: zh-CN"
```

---

## ⚠️ 注意事项

1. **前端需要更新**：
   - 所有传递给 API 的 pattern 标识必须使用 **key**（字符串）
   - 不要再传递数字 ID

2. **数据库迁移不需要**：
   - `pattern_assets` 表已有 `key` 字段
   - 无需更改表结构

3. **向后兼容性**：
   - ⚠️ 此修复**不向后兼容**旧的 ID 查询方式
   - 前端/iOS 必须同步更新

4. **i18n 系统**：
   - 新增的 API 错误消息都应该使用 `errors.*` 快捷方法
   - 避免硬编码任何面向用户的文本

---

## 📚 相关文档
- i18n 系统使用指南：`src/locales/README.md`
- Pattern Assets 设计文档：（待创建）
- 安全配置指南：（待创建）
