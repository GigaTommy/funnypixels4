# 控制器重构指南

## 📋 概述

本指南说明如何将业务逻辑从控制器(Controller)移到服务层(Service)，以提高代码的可测试性、可维护性和可重用性。

## 🎯 重构目标

### Controller 的职责（应该做）
1. ✅ 接收 HTTP 请求
2. ✅ 验证请求格式（可由中间件辅助）
3. ✅ 调用 Service 层处理业务逻辑
4. ✅ 格式化响应数据
5. ✅ 返回适当的 HTTP 状态码
6. ✅ 处理并记录错误

### Controller 不应该做的事情
1. ❌ 直接操作数据库（应通过 Repository 或 Model）
2. ❌ 包含复杂的业务逻辑（应在 Service 层）
3. ❌ 进行复杂的数据验证（应在 Validator 或 Service 层）
4. ❌ 处理缓存逻辑（应在 Service 层）
5. ❌ 执行第三方 API 调用（应在 Service 层）

### Service 的职责（应该做）
1. ✅ 实现核心业务逻辑
2. ✅ 协调多个 Repository/Model 的操作
3. ✅ 处理数据验证和转换
4. ✅ 管理缓存
5. ✅ 调用第三方 API
6. ✅ 处理复杂的业务规则
7. ✅ 提供可测试的纯函数接口

## 📚 重构示例

### Before（重构前）❌

```javascript
// controllers/userController.js
class UserController {
  static async createUser(req, res) {
    try {
      const { email, password, username } = req.body;

      // ❌ 在Controller中进行验证
      if (!email || !email.includes('@')) {
        return res.status(400).json({ error: '邮箱格式不正确' });
      }

      if (!password || password.length < 6) {
        return res.status(400).json({ error: '密码至少6个字符' });
      }

      // ❌ 直接操作数据库
      const existingUser = await db.query(
        'SELECT * FROM users WHERE email = $1',
        [email]
      );

      if (existingUser.rows.length > 0) {
        return res.status(400).json({ error: '邮箱已被注册' });
      }

      // ❌ 在Controller中处理密码加密
      const bcrypt = require('bcrypt');
      const hashedPassword = await bcrypt.hash(password, 10);

      // ❌ 直接插入数据库
      const result = await db.query(
        'INSERT INTO users (email, password, username) VALUES ($1, $2, $3) RETURNING *',
        [email, hashedPassword, username]
      );

      // ❌ 在Controller中生成Token
      const jwt = require('jsonwebtoken');
      const token = jwt.sign({ id: result.rows[0].id }, process.env.JWT_SECRET);

      res.status(201).json({ user: result.rows[0], token });

    } catch (error) {
      res.status(500).json({ error: '服务器错误' });
    }
  }
}
```

### After（重构后）✅

```javascript
// services/userService.js
class UserService {
  /**
   * 创建新用户
   * @param {Object} userData - 用户数据
   * @returns {Promise<{user: Object, token: string}>}
   * @throws {Error} 验证失败或创建失败时抛出错误
   */
  static async createUser(userData) {
    const { email, password, username } = userData;

    // ✅ 在Service中进行业务验证
    this.validateEmail(email);
    this.validatePassword(password);

    // ✅ 通过Repository检查重复
    const existingUser = await UserRepository.findByEmail(email);
    if (existingUser) {
      throw new Error('邮箱已被注册');
    }

    // ✅ 在Service中处理密码加密
    const hashedPassword = await this.hashPassword(password);

    // ✅ 通过Repository创建用户
    const user = await UserRepository.create({
      email,
      password: hashedPassword,
      username
    });

    // ✅ 在Service中生成Token
    const token = this.generateToken(user.id);

    return { user, token };
  }

  static validateEmail(email) {
    if (!email || !email.includes('@')) {
      throw new Error('邮箱格式不正确');
    }
  }

  static validatePassword(password) {
    if (!password || password.length < 6) {
      throw new Error('密码至少6个字符');
    }
  }

  static async hashPassword(password) {
    const bcrypt = require('bcrypt');
    return await bcrypt.hash(password, 10);
  }

  static generateToken(userId) {
    const jwt = require('jsonwebtoken');
    return jwt.sign({ id: userId }, process.env.JWT_SECRET);
  }
}

// controllers/userController.js
class UserController {
  /**
   * 创建用户
   * POST /api/users
   */
  static async createUser(req, res) {
    try {
      // ✅ Controller只负责接收请求和调用Service
      const result = await UserService.createUser(req.body);

      // ✅ 格式化响应
      return res.status(201).json({
        success: true,
        user: result.user,
        token: result.token
      });

    } catch (error) {
      // ✅ 根据错误类型返回适当的状态码
      if (error.message.includes('邮箱') ||
          error.message.includes('密码') ||
          error.message.includes('已被注册')) {
        return res.status(400).json({
          success: false,
          error: error.message
        });
      }

      logger.error('创建用户失败', { error: error.message });
      return res.status(500).json({
        success: false,
        error: '创建用户失败'
      });
    }
  }
}
```

## 🔄 重构步骤

### 1. 识别业务逻辑

审查 Controller 中的代码，识别以下业务逻辑：
- 数据验证（格式、唯一性等）
- 数据转换和处理
- 数据库操作
- 缓存操作
- 第三方 API 调用
- 复杂的条件判断
- 业务规则实现

### 2. 创建 Service 类

```javascript
// services/xxxService.js
/**
 * XXX服务
 * 处理XXX相关的业务逻辑
 */
class XxxService {
  /**
   * 业务方法
   * @param {type} param - 参数说明
   * @returns {Promise<type>} 返回值说明
   * @throws {Error} 错误说明
   */
  static async methodName(param) {
    // 实现业务逻辑
  }
}

module.exports = XxxService;
```

### 3. 将业务逻辑移到 Service

- 将数据验证逻辑移到 Service 方法中
- 将数据库操作改为调用 Repository
- 将复杂的业务规则封装为 Service 方法
- 使用 `throw new Error()` 抛出业务异常

### 4. 简化 Controller

- 删除 Controller 中的业务逻辑
- 调用 Service 方法
- 处理 Service 抛出的异常
- 返回适当的 HTTP 响应

### 5. 编写单元测试

```javascript
// services/__tests__/xxxService.test.js
describe('XxxService', () => {
  describe('methodName', () => {
    it('应该成功处理正常情况', async () => {
      const result = await XxxService.methodName(validData);
      expect(result).toBeDefined();
    });

    it('应该在参数无效时抛出错误', async () => {
      await expect(XxxService.methodName(invalidData))
        .rejects.toThrow('错误信息');
    });
  });
});
```

## 📝 实际案例：AuthController 重构

### 重构文件
- ✅ 已创建：`services/authService.js` - 认证业务逻辑
- ✅ 已创建：`controllers/authController.refactored.js` - 重构后的控制器

### 重构内容
1. 将验证逻辑移到 `AuthService`：
   - `validateEmail()` - 邮箱格式验证
   - `validatePassword()` - 密码强度验证
   - `verifyVerificationCode()` - 验证码验证

2. 将业务流程移到 `AuthService`：
   - `registerWithEmailCode()` - 邮箱注册流程
   - `login()` - 登录流程
   - `refreshAccessToken()` - 令牌刷新流程
   - `changePassword()` - 修改密码流程

3. 将缓存管理移到 `AuthService`：
   - `userCache` - 用户信息缓存
   - `clearUserCache()` - 清除缓存

4. Controller 只保留：
   - HTTP 请求接收
   - Service 调用
   - 响应格式化
   - 错误处理

### 使用重构后的代码

如果要应用重构后的代码，只需：

```bash
# 备份原文件
cp backend/src/controllers/authController.js backend/src/controllers/authController.backup.js

# 使用重构后的版本
cp backend/src/controllers/authController.refactored.js backend/src/controllers/authController.js
```

## 🎯 其他需要重构的控制器

根据代码审查，以下控制器包含较多业务逻辑，建议按照相同模式重构：

### 高优先级
1. **allianceController.js** - 联盟管理逻辑
   - 创建 `AllianceService`
   - 移动成员管理、权限检查、申请审批逻辑

2. **leaderboardController.js** - 排行榜逻辑
   - 创建 `LeaderboardService`
   - 移动排行榜计算、缓存管理逻辑

3. **pixelDrawController.js** - 像素绘制逻辑
   - 可能已部分重构（需检查）
   - 确保所有业务逻辑在 Service 层

### 中优先级
4. **adminController.js** - 管理员功能
5. **profileController.js** - 用户资料管理
6. **socialController.js** - 社交功能

## ✅ 重构检查清单

完成重构后，检查以下项目：

- [ ] Controller 方法少于30行
- [ ] Controller 不直接调用数据库
- [ ] Controller 不包含业务验证逻辑
- [ ] Service 方法有完整的 JSDoc 注释
- [ ] Service 方法使用 `throw Error()` 处理异常
- [ ] 为 Service 编写了单元测试
- [ ] Controller 正确处理 Service 抛出的异常
- [ ] HTTP 状态码使用正确
- [ ] 错误信息对用户友好

## 📚 参考资源

- [Express 最佳实践](https://expressjs.com/en/advanced/best-practice-performance.html)
- [Node.js 项目架构](https://github.com/goldbergyoni/nodebestpractices)
- [领域驱动设计](https://martinfowler.com/bliki/DomainDrivenDesign.html)

## 🔍 持续改进

随着项目发展，定期审查代码：
1. 每月检查新增的 Controller 代码
2. 识别重复的业务逻辑，提取到 Service
3. 重构超过 50 行的 Controller 方法
4. 保持 Service 方法单一职责

---

**重构是一个持续的过程，不是一次性的任务。保持代码整洁，团队效率会更高！** 🚀
