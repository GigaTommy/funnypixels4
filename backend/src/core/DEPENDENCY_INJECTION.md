# 依赖注入指南 / Dependency Injection Guide

## 概述

本项目使用轻量级依赖注入（DI）容器来管理服务依赖，提高代码的可测试性和解耦程度。

## 为什么使用依赖注入？

### ❌ 没有依赖注入的问题

```javascript
// 服务直接导入依赖
const { db } = require('../config/database');
const logger = require('../utils/logger');
const CacheService = require('./cacheService');

class UserService {
  async findById(id) {
    // 硬编码依赖，难以测试
    const user = await db('users').where({ id }).first();
    logger.info(`找到用户: ${id}`);
    return user;
  }
}
```

**问题**:
- ❌ 难以进行单元测试（无法 mock 数据库）
- ❌ 服务之间紧耦合
- ❌ 无法在测试时替换依赖
- ❌ 难以追踪依赖关系

### ✅ 使用依赖注入的优势

```javascript
class UserService {
  constructor(db, logger) {
    this.db = db;
    this.logger = logger;
  }

  async findById(id) {
    const user = await this.db('users').where({ id }).first();
    this.logger.info(`找到用户: ${id}`);
    return user;
  }
}
```

**优势**:
- ✅ 易于测试（可以注入 mock 对象）
- ✅ 服务解耦
- ✅ 依赖关系清晰
- ✅ 易于维护和扩展

---

## 快速开始

### 1. 获取容器

```javascript
const { getContainer } = require('../core/ServiceProvider');

// 获取全局容器实例
const container = getContainer();

// 获取服务
const userService = container.get('userService');
const db = container.get('db');
const logger = container.get('logger');
```

### 2. 注册新服务

在 `src/core/ServiceProvider.js` 中注册服务：

```javascript
// 注册单例服务（推荐，大多数服务都是单例）
container.singleton('userService', (c) => {
  const UserService = require('../services/userService');
  return new UserService(
    c.get('db'),
    c.get('logger')
  );
});

// 注册工厂服务（每次创建新实例）
container.factory('requestHandler', (c) => {
  return new RequestHandler(c.get('logger'));
});

// 注册值/配置
container.value('config', {
  apiVersion: '1.0.0',
  maxRequestSize: 1024
});
```

### 3. 在服务中使用依赖注入

```javascript
class UserService {
  /**
   * @param {import('knex').Knex} db - 数据库连接
   * @param {import('../utils/logger')} logger - 日志工具
   */
  constructor(db, logger) {
    this.db = db;
    this.logger = logger;
  }

  async findById(id) {
    this.logger.info(`查找用户: ${id}`);
    return await this.db('users').where({ id }).first();
  }

  async create(userData) {
    this.logger.info('创建用户');
    const [user] = await this.db('users').insert(userData).returning('*');
    return user;
  }
}

module.exports = UserService;
```

---

## 迁移现有服务

### 步骤 1: 重构服务类

**之前**:
```javascript
// services/pixelService.js
const { db } = require('../config/database');
const logger = require('../utils/logger');
const CacheService = require('./cacheService');

class PixelService {
  async getPixel(gridId) {
    // 直接使用全局依赖
    logger.info(`获取像素: ${gridId}`);
    return await db('pixels').where({ grid_id: gridId }).first();
  }
}

module.exports = new PixelService(); // 导出单例
```

**之后**:
```javascript
// services/pixelService.js
class PixelService {
  /**
   * @param {import('knex').Knex} db
   * @param {import('./cacheService')} cacheService
   * @param {import('../utils/logger')} logger
   */
  constructor(db, cacheService, logger) {
    this.db = db;
    this.cacheService = cacheService;
    this.logger = logger;
  }

  async getPixel(gridId) {
    this.logger.info(`获取像素: ${gridId}`);
    return await this.db('pixels').where({ grid_id: gridId }).first();
  }
}

module.exports = PixelService; // 导出类，不是实例
```

### 步骤 2: 在 ServiceProvider 中注册

```javascript
// core/ServiceProvider.js
container.singleton('pixelService', (c) => {
  const PixelService = require('../services/pixelService');
  return new PixelService(
    c.get('db'),
    c.get('cacheService'),
    c.get('logger')
  );
});
```

### 步骤 3: 更新使用方

**之前**:
```javascript
// controllers/pixelController.js
const pixelService = require('../services/pixelService');

class PixelController {
  static async getPixel(req, res) {
    const pixel = await pixelService.getPixel(req.params.gridId);
    res.json(pixel);
  }
}
```

**之后**:
```javascript
// controllers/pixelController.js
const { getContainer } = require('../core/ServiceProvider');

class PixelController {
  static async getPixel(req, res) {
    const pixelService = getContainer().get('pixelService');
    const pixel = await pixelService.getPixel(req.params.gridId);
    res.json(pixel);
  }
}
```

**或者更好的方式（控制器也使用 DI）**:
```javascript
class PixelController {
  constructor(pixelService) {
    this.pixelService = pixelService;
  }

  async getPixel(req, res) {
    const pixel = await this.pixelService.getPixel(req.params.gridId);
    res.json(pixel);
  }
}

// 在 ServiceProvider 中注册
container.singleton('pixelController', (c) => {
  return new PixelController(c.get('pixelService'));
});
```

---

## 测试时使用依赖注入

### 单元测试示例

```javascript
// __tests__/services/userService.test.js
const UserService = require('../../services/userService');
const { createMockDb } = require('../helpers/mockDb');

describe('UserService', () => {
  let userService;
  let mockDb;
  let mockLogger;

  beforeEach(() => {
    // 创建 mock 依赖
    mockDb = createMockDb();
    mockLogger = {
      info: jest.fn(),
      error: jest.fn()
    };

    // 手动注入依赖
    userService = new UserService(mockDb, mockLogger);
  });

  test('findById 应该返回用户', async () => {
    const mockUser = { id: 1, email: 'test@example.com' };
    mockDb.mockResolvedValue([mockUser]);

    const result = await userService.findById(1);

    expect(result).toEqual(mockUser);
    expect(mockDb).toHaveBeenCalledWith('users');
    expect(mockLogger.info).toHaveBeenCalledWith('查找用户: 1');
  });
});
```

### 集成测试示例

```javascript
// __tests__/integration/user.test.js
const { createContainer } = require('../../core/ServiceProvider');
const { setupTestEnvironment } = require('./setup');

describe('User Integration Tests', () => {
  let container;
  let userService;

  beforeAll(async () => {
    await setupTestEnvironment();

    // 为测试创建独立容器
    container = createContainer();
    userService = container.get('userService');
  });

  test('应该创建和查找用户', async () => {
    const userData = { email: 'test@example.com', username: 'testuser' };
    const user = await userService.create(userData);

    expect(user.id).toBeDefined();
    expect(user.email).toBe(userData.email);

    const found = await userService.findById(user.id);
    expect(found.email).toBe(userData.email);
  });
});
```

---

## 最佳实践

### 1. 使用构造函数注入

```javascript
// ✅ 好 - 构造函数注入
class UserService {
  constructor(db, logger, cacheService) {
    this.db = db;
    this.logger = logger;
    this.cacheService = cacheService;
  }
}

// ❌ 不好 - 属性注入（难以追踪依赖）
class UserService {
  setDb(db) { this.db = db; }
  setLogger(logger) { this.logger = logger; }
}
```

### 2. 明确依赖关系

```javascript
// ✅ 好 - 使用 JSDoc 明确类型
class UserService {
  /**
   * @param {import('knex').Knex} db
   * @param {import('../utils/logger')} logger
   */
  constructor(db, logger) {
    this.db = db;
    this.logger = logger;
  }
}
```

### 3. 避免循环依赖

```javascript
// ❌ 不好 - 循环依赖
// userService 依赖 orderService
// orderService 依赖 userService

// ✅ 好 - 引入中间服务或事件系统
// userService 发布事件
// orderService 监听事件
```

### 4. 单一职责原则

```javascript
// ✅ 好 - 每个服务职责单一
class UserService {
  // 只处理用户相关逻辑
  async findById(id) { }
  async create(data) { }
}

class EmailService {
  // 只处理邮件相关逻辑
  async send(to, subject, body) { }
}

// ❌ 不好 - 职责混杂
class UserService {
  async findById(id) { }
  async create(data) { }
  async sendWelcomeEmail(user) { } // 邮件逻辑不应该在这里
}
```

### 5. 使用接口隔离

```javascript
/**
 * @typedef {Object} ILogger
 * @property {function(string): void} info
 * @property {function(string): void} error
 * @property {function(string): void} warn
 */

/**
 * @param {ILogger} logger
 */
class UserService {
  constructor(logger) {
    this.logger = logger;
  }
}
```

---

## 服务生命周期

### Singleton（单例）

大多数服务应该使用单例模式：

```javascript
container.singleton('userService', (c) => {
  return new UserService(c.get('db'), c.get('logger'));
});

// 每次获取都返回同一个实例
const service1 = container.get('userService');
const service2 = container.get('userService');
console.log(service1 === service2); // true
```

**适用场景**:
- 无状态服务
- 需要共享状态的服务
- 资源管理服务（数据库连接、缓存连接）

### Factory（工厂）

需要每次创建新实例时使用工厂模式：

```javascript
container.factory('requestContext', (c) => {
  return new RequestContext(c.get('logger'));
});

// 每次获取都返回新实例
const ctx1 = container.get('requestContext');
const ctx2 = container.get('requestContext');
console.log(ctx1 === ctx2); // false
```

**适用场景**:
- 有状态的请求处理器
- 临时对象
- 需要隔离的上下文

### Value（值）

注册配置、常量等：

```javascript
container.value('config', {
  appName: 'FunnyPixels',
  version: '1.0.0'
});

const config = container.get('config');
console.log(config.appName); // "FunnyPixels"
```

---

## 常见问题

### Q: 何时应该重构为使用 DI？

A: 以下情况应该考虑使用 DI：
- 需要编写单元测试
- 服务依赖过多
- 需要在测试时 mock 依赖
- 服务之间耦合度高

### Q: 现有代码如何逐步迁移？

A: 采用渐进式迁移策略：
1. 先迁移核心服务（最常用、最复杂的）
2. 保持向后兼容（旧代码继续工作）
3. 新功能使用 DI
4. 逐步重构旧代码

### Q: DI 容器的性能开销如何？

A: 性能开销极小：
- 单例模式：首次创建后直接返回缓存实例
- 工厂模式：只是函数调用的开销
- 循环依赖检测：使用 Set 实现，O(1) 复杂度

### Q: 如何调试依赖注入问题？

A: 几种方法：
1. 检查注册的服务：`container.getRegisteredServices()`
2. 启用日志查看依赖解析过程
3. 使用 `container.has('serviceName')` 检查服务是否注册
4. 查看错误信息中的依赖链

---

## 迁移清单

### 已迁移服务
- ✅ cacheService
- ✅ tileChangeQueueService
- ✅ battleReportService
- ✅ batchPixelService

### 待迁移服务
- ⏳ authService
- ⏳ pixelDrawService
- ⏳ territoryService
- ⏳ allianceService

### 迁移步骤
1. [ ] 重构服务类使用构造函数注入
2. [ ] 在 ServiceProvider 中注册服务
3. [ ] 更新服务的使用方
4. [ ] 编写单元测试验证
5. [ ] 更新文档

---

## 参考资源

- [Dependency Injection in JavaScript](https://www.martinfowler.com/articles/injection.html)
- [Inversion of Control Containers](https://martinfowler.com/articles/injection.html)
- [SOLID Principles](https://en.wikipedia.org/wiki/SOLID)

---

## 维护者

FunnyPixels Team

如有问题或建议，请提交 Issue 或 Pull Request。
