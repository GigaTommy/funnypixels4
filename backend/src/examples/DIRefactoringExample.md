# 依赖注入重构示例

本文档展示如何将现有服务重构为使用依赖注入模式。

## 示例 1: 用户服务重构

### ❌ 重构前（紧耦合）

```javascript
// services/userService.js
const { db } = require('../config/database');
const logger = require('../utils/logger');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

class UserService {
  async findByEmail(email) {
    logger.info(`查找用户: ${email}`);
    return await db('users').where({ email }).first();
  }

  async create(userData) {
    const hashedPassword = await bcrypt.hash(userData.password, 10);

    const [user] = await db('users')
      .insert({
        ...userData,
        password_hash: hashedPassword
      })
      .returning('*');

    logger.info(`创建用户: ${user.id}`);
    return user;
  }

  async generateToken(user) {
    return jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
  }
}

// 导出单例
module.exports = new UserService();
```

**问题**:
- ❌ 直接依赖全局模块（`db`, `logger`, `bcrypt`, `jwt`）
- ❌ 难以进行单元测试
- ❌ 无法 mock 依赖
- ❌ 硬编码的配置（JWT secret、expire time）

---

### ✅ 重构后（使用依赖注入）

```javascript
// services/userService.js

/**
 * 用户服务
 * 处理用户相关的业务逻辑
 */
class UserService {
  /**
   * @param {import('knex').Knex} db - 数据库连接
   * @param {import('../utils/logger')} logger - 日志工具
   * @param {import('bcrypt')} bcrypt - 密码哈希工具
   * @param {Object} config - 配置对象
   * @param {string} config.jwtSecret - JWT 密钥
   * @param {string} config.jwtExpiry - JWT 过期时间
   */
  constructor(db, logger, bcrypt, config = {}) {
    this.db = db;
    this.logger = logger;
    this.bcrypt = bcrypt;
    this.jwtSecret = config.jwtSecret || process.env.JWT_SECRET;
    this.jwtExpiry = config.jwtExpiry || '24h';
  }

  async findByEmail(email) {
    this.logger.info(`查找用户: ${email}`);
    return await this.db('users').where({ email }).first();
  }

  async create(userData) {
    const hashedPassword = await this.bcrypt.hash(userData.password, 10);

    const [user] = await this.db('users')
      .insert({
        ...userData,
        password_hash: hashedPassword
      })
      .returning('*');

    this.logger.info(`创建用户: ${user.id}`);
    return user;
  }

  async generateToken(user) {
    const jwt = require('jsonwebtoken');
    return jwt.sign(
      { id: user.id, email: user.email },
      this.jwtSecret,
      { expiresIn: this.jwtExpiry }
    );
  }
}

// 导出类，不是实例
module.exports = UserService;
```

### 📝 在 ServiceProvider 中注册

```javascript
// core/ServiceProvider.js

container.singleton('userService', (c) => {
  const UserService = require('../services/userService');
  const bcrypt = require('bcrypt');

  return new UserService(
    c.get('db'),
    c.get('logger'),
    bcrypt,
    {
      jwtSecret: process.env.JWT_SECRET,
      jwtExpiry: '24h'
    }
  );
});
```

### ✅ 单元测试变得简单

```javascript
// __tests__/services/userService.test.js

const UserService = require('../../services/userService');

describe('UserService', () => {
  let userService;
  let mockDb;
  let mockLogger;
  let mockBcrypt;

  beforeEach(() => {
    // 创建 mock 依赖
    mockDb = {
      insert: jest.fn().mockReturnThis(),
      returning: jest.fn().mockResolvedValue([{ id: 1, email: 'test@example.com' }])
    };
    mockDb.mockReturnValue = mockDb;

    mockLogger = {
      info: jest.fn(),
      error: jest.fn()
    };

    mockBcrypt = {
      hash: jest.fn().mockResolvedValue('hashed_password')
    };

    // 注入 mock 依赖
    userService = new UserService(
      mockDb,
      mockLogger,
      mockBcrypt,
      {
        jwtSecret: 'test-secret',
        jwtExpiry: '1h'
      }
    );
  });

  test('create 应该创建用户并哈希密码', async () => {
    const userData = {
      email: 'test@example.com',
      password: 'password123',
      username: 'testuser'
    };

    const user = await userService.create(userData);

    // 验证密码被哈希
    expect(mockBcrypt.hash).toHaveBeenCalledWith('password123', 10);

    // 验证数据库插入
    expect(mockDb.insert).toHaveBeenCalledWith({
      email: 'test@example.com',
      username: 'testuser',
      password_hash: 'hashed_password'
    });

    // 验证返回用户
    expect(user).toEqual({ id: 1, email: 'test@example.com' });

    // 验证日志
    expect(mockLogger.info).toHaveBeenCalledWith('创建用户: 1');
  });
});
```

---

## 示例 2: 像素服务重构

### ❌ 重构前

```javascript
// services/pixelService.js
const { db } = require('../config/database');
const CacheService = require('./cacheService');
const { calculateGridId } = require('../../shared/utils/gridUtils');
const logger = require('../utils/logger');

class PixelService {
  async createPixel(userId, latitude, longitude, color) {
    const gridId = calculateGridId(latitude, longitude);

    // 检查缓存
    const cached = await CacheService.get(`pixel:${gridId}`);
    if (cached) {
      logger.info(`从缓存获取像素: ${gridId}`);
      return cached;
    }

    // 创建像素
    const [pixel] = await db('pixels')
      .insert({ user_id: userId, grid_id: gridId, color, latitude, longitude })
      .returning('*');

    // 更新缓存
    await CacheService.set(`pixel:${gridId}`, pixel, 3600);

    logger.info(`创建像素: ${pixel.id}`);
    return pixel;
  }
}

module.exports = new PixelService();
```

---

### ✅ 重构后

```javascript
// services/pixelService.js

/**
 * 像素服务
 * 处理像素绘制相关的业务逻辑
 */
class PixelService {
  /**
   * @param {import('knex').Knex} db - 数据库连接
   * @param {import('./cacheService')} cacheService - 缓存服务
   * @param {Object} gridUtils - Grid 工具
   * @param {import('../utils/logger')} logger - 日志工具
   */
  constructor(db, cacheService, gridUtils, logger) {
    this.db = db;
    this.cacheService = cacheService;
    this.gridUtils = gridUtils;
    this.logger = logger;
  }

  async createPixel(userId, latitude, longitude, color) {
    const gridId = this.gridUtils.calculateGridId(latitude, longitude);

    // 检查缓存
    const cached = await this.cacheService.get(`pixel:${gridId}`);
    if (cached) {
      this.logger.info(`从缓存获取像素: ${gridId}`);
      return cached;
    }

    // 创建像素
    const [pixel] = await this.db('pixels')
      .insert({ user_id: userId, grid_id: gridId, color, latitude, longitude })
      .returning('*');

    // 更新缓存
    await this.cacheService.set(`pixel:${gridId}`, pixel, 3600);

    this.logger.info(`创建像素: ${pixel.id}`);
    return pixel;
  }
}

module.exports = PixelService;
```

### 📝 在 ServiceProvider 中注册

```javascript
container.singleton('pixelService', (c) => {
  const PixelService = require('../services/pixelService');

  return new PixelService(
    c.get('db'),
    c.get('cacheService'),
    c.get('gridUtils'),
    c.get('logger')
  );
});
```

### ✅ 单元测试

```javascript
const PixelService = require('../../services/pixelService');

describe('PixelService', () => {
  let pixelService;
  let mockDb;
  let mockCache;
  let mockGridUtils;
  let mockLogger;

  beforeEach(() => {
    mockDb = jest.fn().mockReturnValue({
      insert: jest.fn().mockReturnThis(),
      returning: jest.fn().mockResolvedValue([
        { id: 1, grid_id: 'abc123', color: '#FF0000' }
      ])
    });

    mockCache = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(true)
    };

    mockGridUtils = {
      calculateGridId: jest.fn().mockReturnValue('abc123')
    };

    mockLogger = {
      info: jest.fn(),
      error: jest.fn()
    };

    pixelService = new PixelService(
      mockDb,
      mockCache,
      mockGridUtils,
      mockLogger
    );
  });

  test('createPixel 应该创建新像素', async () => {
    const pixel = await pixelService.createPixel(1, 40.7128, -74.0060, '#FF0000');

    expect(mockGridUtils.calculateGridId).toHaveBeenCalledWith(40.7128, -74.0060);
    expect(mockCache.get).toHaveBeenCalledWith('pixel:abc123');
    expect(mockDb).toHaveBeenCalledWith('pixels');
    expect(mockCache.set).toHaveBeenCalledWith(
      'pixel:abc123',
      expect.any(Object),
      3600
    );
    expect(pixel.id).toBe(1);
  });

  test('createPixel 应该使用缓存的像素', async () => {
    const cachedPixel = { id: 2, grid_id: 'abc123', color: '#00FF00' };
    mockCache.get.mockResolvedValue(cachedPixel);

    const pixel = await pixelService.createPixel(1, 40.7128, -74.0060, '#FF0000');

    expect(pixel).toEqual(cachedPixel);
    expect(mockDb).not.toHaveBeenCalled();
    expect(mockLogger.info).toHaveBeenCalledWith('从缓存获取像素: abc123');
  });
});
```

---

## 示例 3: 控制器重构

### ❌ 重构前

```javascript
// controllers/userController.js
const userService = require('../services/userService');
const logger = require('../utils/logger');

class UserController {
  static async register(req, res) {
    try {
      const { email, password, username } = req.body;
      const user = await userService.create({ email, password, username });
      const token = await userService.generateToken(user);

      res.json({
        success: true,
        data: { user, token }
      });
    } catch (error) {
      logger.error(`注册失败: ${error.message}`);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
}

module.exports = UserController;
```

---

### ✅ 重构后

```javascript
// controllers/userController.js

/**
 * 用户控制器
 * 处理用户相关的 HTTP 请求
 */
class UserController {
  /**
   * @param {import('../services/userService')} userService
   * @param {import('../utils/logger')} logger
   */
  constructor(userService, logger) {
    this.userService = userService;
    this.logger = logger;
  }

  async register(req, res) {
    try {
      const { email, password, username } = req.body;
      const user = await this.userService.create({ email, password, username });
      const token = await this.userService.generateToken(user);

      res.json({
        success: true,
        data: { user, token }
      });
    } catch (error) {
      this.logger.error(`注册失败: ${error.message}`);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
}

module.exports = UserController;
```

### 📝 在 ServiceProvider 中注册

```javascript
container.singleton('userController', (c) => {
  const UserController = require('../controllers/userController');

  return new UserController(
    c.get('userService'),
    c.get('logger')
  );
});
```

### 🔌 在路由中使用

```javascript
// routes/auth.js
const { getContainer } = require('../core/ServiceProvider');

const router = require('express').Router();

// 获取控制器实例
const getUserController = () => getContainer().get('userController');

// 绑定路由
router.post('/register', (req, res) => {
  return getUserController().register(req, res);
});

module.exports = router;
```

**或者更简洁的方式**:

```javascript
// routes/auth.js
const { getContainer } = require('../core/ServiceProvider');

const router = require('express').Router();

// 辅助函数：创建路由处理器
const createHandler = (controllerName, methodName) => {
  return (req, res, next) => {
    const controller = getContainer().get(controllerName);
    return controller[methodName](req, res, next);
  };
};

router.post('/register', createHandler('userController', 'register'));
router.post('/login', createHandler('userController', 'login'));
router.get('/me', createHandler('userController', 'getCurrentUser'));

module.exports = router;
```

---

## 重构步骤总结

### 1. 识别依赖
列出服务的所有外部依赖：
- 数据库连接
- 缓存服务
- 日志工具
- 其他服务
- 配置

### 2. 修改构造函数
```javascript
// 之前
class MyService {
  someMethod() {
    const { db } = require('../config/database');
    // ...
  }
}

// 之后
class MyService {
  constructor(db, logger) {
    this.db = db;
    this.logger = logger;
  }

  someMethod() {
    this.db.query(...);
    // ...
  }
}
```

### 3. 注册到容器
```javascript
container.singleton('myService', (c) => {
  return new MyService(
    c.get('db'),
    c.get('logger')
  );
});
```

### 4. 更新使用方
```javascript
// 之前
const myService = require('../services/myService');

// 之后
const { getContainer } = require('../core/ServiceProvider');
const myService = getContainer().get('myService');
```

### 5. 编写测试
```javascript
const service = new MyService(mockDb, mockLogger);
// 测试...
```

---

## 最佳实践检查清单

- [ ] 所有依赖通过构造函数注入
- [ ] 使用 JSDoc 标注类型
- [ ] 导出类而不是实例
- [ ] 在 ServiceProvider 中注册
- [ ] 编写单元测试验证
- [ ] 更新使用该服务的代码
- [ ] 添加文档说明

---

## 常见陷阱

### ❌ 陷阱 1: 在构造函数中执行异步操作

```javascript
// 不好
class MyService {
  constructor(db) {
    this.db = db;
    // ❌ 构造函数不应该是 async
    this.init();
  }

  async init() {
    this.config = await this.db('config').first();
  }
}

// 好
class MyService {
  constructor(db) {
    this.db = db;
  }

  async initialize() {
    this.config = await this.db('config').first();
  }
}

// 在 ServiceProvider 中
container.singleton('myService', async (c) => {
  const service = new MyService(c.get('db'));
  await service.initialize();
  return service;
});
```

### ❌ 陷阱 2: 循环依赖

```javascript
// 不好 - ServiceA 依赖 ServiceB，ServiceB 依赖 ServiceA
class ServiceA {
  constructor(serviceB) {
    this.serviceB = serviceB;
  }
}

class ServiceB {
  constructor(serviceA) {
    this.serviceA = serviceA;
  }
}

// 好 - 使用事件或引入第三个服务
class ServiceA {
  constructor(eventBus) {
    this.eventBus = eventBus;
  }

  doSomething() {
    this.eventBus.emit('something-done', data);
  }
}

class ServiceB {
  constructor(eventBus) {
    this.eventBus = eventBus;
    this.eventBus.on('something-done', this.handleEvent.bind(this));
  }

  handleEvent(data) {
    // 处理事件
  }
}
```

### ❌ 陷阱 3: 在服务中直接使用 getContainer()

```javascript
// 不好
class MyService {
  doSomething() {
    const { getContainer } = require('../core/ServiceProvider');
    const otherService = getContainer().get('otherService');
    // 这破坏了依赖注入的目的
  }
}

// 好
class MyService {
  constructor(otherService) {
    this.otherService = otherService;
  }

  doSomething() {
    this.otherService.doWork();
  }
}
```

---

这些示例展示了如何将紧耦合的代码重构为使用依赖注入模式，从而提高可测试性和可维护性。
