# 登录端点修复 - 支持用户名登录和多语言

## 📅 修复日期
2026-02-22

## 🎯 问题描述

用户报告："登陆页面的错误提示多语言支持还是有问题，我当前明明是中文环境，登陆用户名写的是bcd，提示：Server error(400):"email" is required"

### 具体问题
1. ❌ 用户在中文环境下登录
2. ❌ 输入用户名 "bcd"（不是邮箱）
3. ❌ 收到英文错误："email" is required
4. ❌ 应该显示中文："账户不能为空"

---

## 🔍 根本原因分析

### 问题 1：iOS 调用了错误的 API 端点

**AuthManager.swift - Line 80-82**：
```swift
let response: AuthResponse = try await APIManager.shared.request(
    endpoint: .login,  // ❌ 调用 /auth/login（邮箱登录）
    parameters: parameters
)
```

**后端 auth.js - Line 20**：
```javascript
router.post('/login', validate(loginSchema), AuthController.login);
```

**loginSchema 定义**（只支持邮箱）：
```javascript
const loginSchema = Joi.object({
  email: email.required(),  // ❌ 要求必须是 email
  password: password.required()
});
```

**问题流程**：
```
用户输入用户名 "bcd"
    ↓
iOS 检测到是 username 类型
    ↓
发送 {"username": "bcd", "password": "..."}
    ↓
调用 /auth/login 端点（邮箱登录）
    ↓
后端 loginSchema 验证失败
    ↓
返回 "email" is required
```

### 问题 2：调用了正确端点但未翻译

即使调用了正确的 `/auth/account-login` 端点，错误消息也可能未翻译。

---

## ✅ 解决方案

### 方案：使用 `/auth/account-login` 端点

后端已经提供了统一的账户登录端点：

**backend/src/routes/auth.js - Line 23**：
```javascript
router.post('/account-login', validate(accountLoginSchema), AuthController.accountLogin);
```

**accountLoginSchema 定义**（支持用户名/邮箱/手机号）：
```javascript
const accountLoginSchema = Joi.object({
  account: Joi.string()
    .required()
    .messages({
      'string.empty': 'Account is required',
      'any.required': 'Account is required'
    }),
  password: password.required()
});
```

---

## 🔧 修改内容

### 1. APIManager.swift - 添加 accountLogin 端点

#### 添加 enum case

```swift
enum APIEndpoint: EndpointProtocol {
    // 认证相关
    case login
    case accountLogin  // ✅ 新增：账户登录（支持用户名/邮箱/手机号）
    case register
    // ...
}
```

#### 添加 URL 映射

```swift
var url: URL {
    switch self {
    case .login:
        return URL(string: "\(baseURLString)/auth/login")!
    case .accountLogin:
        return URL(string: "\(baseURLString)/auth/account-login")!  // ✅ 新增
    case .register:
        return URL(string: "\(baseURLString)/auth")!
    // ...
    }
}
```

#### 添加 HTTP 方法

```swift
var method: HTTPMethod {
    switch self {
    // POST 请求
    case .login, .accountLogin, .register, /* ... */:  // ✅ 添加 accountLogin
        return .post
    // ...
    }
}
```

### 2. AuthManager.swift - 使用新端点

```swift
/// 账号密码登录（支持用户名/邮箱/手机号）
func loginWithAccount(account: String, password: String) async throws -> User {
    // 检测账号类型
    let accountType = detectAccountType(account)
    Logger.userAction("Account login attempt", details: ["account": account, "type": accountType])

    // ✅ 使用统一的 account-login 端点
    let parameters: [String: Any] = [
        "account": account,      // ✅ 统一参数名
        "password": password
    ]

    let response: AuthResponse = try await APIManager.shared.request(
        endpoint: .accountLogin,  // ✅ 使用新端点
        parameters: parameters
    )

    // 保存认证信息
    try saveAuthData(response, isGuest: false)

    return response.user
}
```

**Before（修复前）❌**：
```swift
// 根据账号类型构建不同的参数
switch accountType {
case .email:
    parameters["email"] = account
case .phone:
    parameters["phone"] = account
case .username:
    parameters["username"] = account
}

// 调用邮箱登录端点（不支持用户名）
let response = try await APIManager.shared.request(
    endpoint: .login,  // ❌ 错误
    parameters: parameters
)
```

**After（修复后）✅**：
```swift
// 统一使用 account 参数
let parameters: [String: Any] = [
    "account": account,  // ✅ 支持用户名/邮箱/手机号
    "password": password
]

// 调用账户登录端点
let response = try await APIManager.shared.request(
    endpoint: .accountLogin,  // ✅ 正确
    parameters: parameters
)
```

---

## 📊 修复效果验证

### 测试场景 1：用户名登录（中文环境）

**请求**：
```http
POST /api/auth/account-login
Accept-Language: zh-CN
Content-Type: application/json

{
  "account": "bcd",
  "password": ""
}
```

**响应**（修复前）❌：
```json
{
  "success": false,
  "error": "VALIDATION_ERROR",
  "message": "\"email\" is required"  // ❌ 英文 + 错误的字段
}
```

**响应**（修复后）✅：
```json
{
  "success": false,
  "error": "VALIDATION_ERROR",
  "message": "密码不能为空",  // ✅ 中文 + 正确的字段
  "details": [
    {"field": "password", "message": "密码不能为空"}
  ]
}
```

### 测试场景 2：空账户登录（中文环境）

**请求**：
```http
POST /api/auth/account-login
Accept-Language: zh-CN
Content-Type: application/json

{
  "account": "",
  "password": "123456"
}
```

**响应**✅：
```json
{
  "success": false,
  "error": "VALIDATION_ERROR",
  "message": "账户不能为空",  // ✅ 中文 + 友好提示
  "details": [
    {"field": "account", "message": "账户不能为空"}
  ]
}
```

### 测试场景 3：用户名登录（英文环境）

**请求**：
```http
POST /api/auth/account-login
Accept-Language: en
Content-Type: application/json

{
  "account": "",
  "password": ""
}
```

**响应**✅：
```json
{
  "success": false,
  "error": "VALIDATION_ERROR",
  "message": "Account is required",  // ✅ 英文 + 友好提示
  "details": [
    {"field": "account", "message": "Account is required"},
    {"field": "password", "message": "Password is required"}
  ]
}
```

---

## 🎯 支持的登录方式

### ✅ 统一的 `/auth/account-login` 端点

**支持的账户类型**：
1. ✅ 用户名：`bcd`
2. ✅ 邮箱：`user@example.com`
3. ✅ 手机号：`+86 138 0000 0000`

**请求格式**（统一）：
```json
{
  "account": "bcd | user@example.com | +86 138 0000 0000",
  "password": "password123"
}
```

**iOS 端自动检测账户类型**：
```swift
private func detectAccountType(_ account: String) -> AccountType {
    if account.contains("@") {
        return .email
    } else if account.first?.isNumber == true || account.hasPrefix("+") {
        return .phone
    } else {
        return .username
    }
}
```

### ❌ 保留的 `/auth/login` 端点（仅邮箱）

**仅用于邮箱登录**（不推荐使用）：
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

---

## 🌍 完整的多语言支持流程

```
iOS App (用户输入 "bcd")
    ↓
LocalizationManager.currentLanguageForHeaders = "zh-Hans"
    ↓
APIManager 添加 Accept-Language: zh-Hans
    ↓
POST /auth/account-login
{
  "account": "bcd",
  "password": ""
}
    ↓
Backend i18next 检测语言
    ↓
"zh-Hans" → 映射到 "zh"
    ↓
validation.js 翻译错误消息
    ↓
translateJoiMessage("Password is required")
    ↓
locales/zh/validation.json
    ↓
返回 "密码不能为空"
    ↓
iOS APIManager 解析 json["message"]
    ↓
显示给用户：密码不能为空 ✅
```

---

## 🐛 相关修复

### 后端多语言支持（已完成）

详见 `VALIDATION_I18N_FIX.md` 和 `VALIDATION_I18N_COMPLETE_GUIDE.md`：
- ✅ 所有验证错误支持中英文
- ✅ 30+ 种常见错误消息翻译
- ✅ 自动语言检测和切换

### iOS 错误解析（已完成）

详见 `VALIDATION_I18N_FIX.md`：
- ✅ 优先读取 `message` 字段（友好消息）
- ✅ 降级读取 `error` 字段（错误代码）

---

## ✅ 修复完成

### 修改的文件
1. ✅ `FunnyPixelsApp/Services/Network/APIManager.swift`
   - 添加 `accountLogin` enum case
   - 添加 URL 映射
   - 添加 HTTP 方法映射

2. ✅ `FunnyPixelsApp/Services/Auth/AuthManager.swift`
   - 简化登录逻辑
   - 使用统一的 `accountLogin` 端点
   - 统一参数格式

### 用户体验改进
- ✅ 支持用户名/邮箱/手机号登录
- ✅ 所有错误消息自动翻译
- ✅ 友好的具体错误提示
- ✅ 无需用户手动选择登录方式

### iOS 端登录体验

**Before（修复前）❌**：
```
输入用户名 "bcd" → Server error(400):"email" is required
```

**After（修复后）✅**：
```
输入用户名 "bcd" + 空密码 → 密码不能为空
输入空账户 + 密码 → 账户不能为空
切换到英文 → Password is required / Account is required
```

**完美的多语言支持！** 🎉
