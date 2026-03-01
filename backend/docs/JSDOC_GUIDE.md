# JSDoc 类型注释指南

## 概述

本项目使用 JSDoc 为 JavaScript 代码添加类型注释，提供类型安全和IDE智能提示。

## 为什么使用 JSDoc 而非 TypeScript？

1. **渐进式采用** - 无需重写现有代码
2. **零运行时开销** - 纯注释，不影响性能
3. **IDE 支持** - VSCode 等现代IDE原生支持
4. **灵活性** - 可选择性地添加类型
5. **学习曲线低** - 基于熟悉的 JavaScript

## 基础类型注释

### 函数参数和返回值

```javascript
/**
 * 用户登录
 * @param {string} email - 用户邮箱
 * @param {string} password - 用户密码
 * @returns {Promise<{user: Object, token: string}>} 用户信息和JWT令牌
 * @throws {Error} 当凭据无效时抛出错误
 */
async function login(email, password) {
  // ...
}
```

### 变量类型

```javascript
/**
 * 用户ID
 * @type {number}
 */
const userId = 123;

/**
 * 用户信息
 * @type {{id: number, email: string, name: string}}
 */
const user = {
  id: 123,
  email: 'user@example.com',
  name: 'John Doe'
};
```

### 数组类型

```javascript
/**
 * 用户ID列表
 * @type {number[]}
 */
const userIds = [1, 2, 3];

/**
 * 用户列表
 * @type {Array<{id: number, email: string}>}
 */
const users = [
  { id: 1, email: 'a@example.com' },
  { id: 2, email: 'b@example.com' }
];
```

## 自定义类型定义

### 使用 @typedef

```javascript
/**
 * 用户对象
 * @typedef {Object} User
 * @property {number} id - 用户ID
 * @property {string} email - 邮箱地址
 * @property {string} name - 用户名
 * @property {Date} created_at - 创建时间
 * @property {boolean} [is_admin] - 是否是管理员（可选）
 */

/**
 * 获取用户信息
 * @param {number} userId - 用户ID
 * @returns {Promise<User>} 用户对象
 */
async function getUser(userId) {
  // ...
}
```

### 复杂类型示例

```javascript
/**
 * 像素对象
 * @typedef {Object} Pixel
 * @property {number} id - 像素ID
 * @property {string} grid_id - 网格ID
 * @property {number} user_id - 用户ID
 * @property {string} color - 十六进制颜色代码
 * @property {number} latitude - 纬度
 * @property {number} longitude - 经度
 * @property {Date} created_at - 创建时间
 * @property {Date} updated_at - 更新时间
 */

/**
 * 分页查询结果
 * @typedef {Object} PaginatedResult
 * @template T
 * @property {T[]} data - 数据列表
 * @property {number} total - 总数
 * @property {number} page - 当前页码
 * @property {number} limit - 每页数量
 */

/**
 * 查询像素列表
 * @param {Object} options - 查询选项
 * @param {number} options.page - 页码
 * @param {number} options.limit - 每页数量
 * @returns {Promise<PaginatedResult<Pixel>>} 分页查询结果
 */
async function getPixels(options) {
  // ...
}
```

## Express 类型注释

### 控制器方法

```javascript
/**
 * 登录控制器
 * @param {import('express').Request} req - Express 请求对象
 * @param {import('express').Response} res - Express 响应对象
 * @returns {Promise<void>}
 */
async function login(req, res) {
  const { email, password } = req.body;
  // ...
}
```

### 中间件

```javascript
/**
 * 认证中间件
 * @param {import('express').Request} req - Express 请求对象
 * @param {import('express').Response} res - Express 响应对象
 * @param {import('express').NextFunction} next - 下一个中间件
 * @returns {void}
 */
function authenticateToken(req, res, next) {
  const token = req.headers.authorization;
  // ...
}
```

### 路由处理器

```javascript
/**
 * @type {import('express').RequestHandler}
 */
const getPixelHandler = async (req, res) => {
  // ...
};
```

## 类和模型

### 类注释

```javascript
/**
 * 像素服务类
 * @class
 */
class PixelService {
  /**
   * 创建 PixelService 实例
   * @constructor
   * @param {Object} db - 数据库连接
   */
  constructor(db) {
    this.db = db;
  }

  /**
   * 创建像素
   * @param {Pixel} pixelData - 像素数据
   * @returns {Promise<Pixel>} 创建的像素对象
   */
  async create(pixelData) {
    // ...
  }

  /**
   * 批量创建像素
   * @param {Pixel[]} pixels - 像素数据数组
   * @returns {Promise<Pixel[]>} 创建的像素数组
   */
  async batchCreate(pixels) {
    // ...
  }
}
```

### 静态方法

```javascript
class UserModel {
  /**
   * 通过邮箱查找用户
   * @static
   * @param {string} email - 邮箱地址
   * @returns {Promise<User|null>} 用户对象或 null
   */
  static async findByEmail(email) {
    // ...
  }
}
```

## 异步操作

### Promise 类型

```javascript
/**
 * 异步获取用户
 * @param {number} userId - 用户ID
 * @returns {Promise<User>} 用户对象
 */
async function getUser(userId) {
  // ...
}

/**
 * 同步验证用户
 * @param {User} user - 用户对象
 * @returns {boolean} 是否有效
 */
function validateUser(user) {
  // ...
}
```

### 回调函数

```javascript
/**
 * 处理像素
 * @param {Pixel} pixel - 像素对象
 * @param {(error: Error|null, result: any) => void} callback - 回调函数
 * @returns {void}
 */
function processPixel(pixel, callback) {
  // ...
}
```

## 联合类型和可选参数

### 联合类型

```javascript
/**
 * 格式化值
 * @param {string|number} value - 字符串或数字
 * @returns {string} 格式化后的字符串
 */
function format(value) {
  return String(value);
}
```

### 可选参数

```javascript
/**
 * 查询用户
 * @param {number} userId - 用户ID
 * @param {Object} [options] - 可选配置（可选）
 * @param {boolean} [options.includeDeleted=false] - 是否包含已删除用户
 * @param {string[]} [options.fields] - 要返回的字段
 * @returns {Promise<User|null>}
 */
async function getUser(userId, options = {}) {
  // ...
}
```

## 泛型

```javascript
/**
 * 通用查询函数
 * @template T
 * @param {string} table - 表名
 * @param {Object} where - 查询条件
 * @returns {Promise<T[]>} 查询结果
 */
async function query(table, where) {
  // ...
}

/**
 * @type {Promise<Pixel[]>}
 */
const pixels = await query('pixels', { user_id: 123 });
```

## 枚举和常量

```javascript
/**
 * 像素类型枚举
 * @enum {string}
 */
const PixelType = {
  BASIC: 'basic',
  PATTERN: 'pattern',
  PROP: 'prop'
};

/**
 * 创建像素
 * @param {PixelType} type - 像素类型
 * @returns {Promise<Pixel>}
 */
async function createPixel(type) {
  // ...
}
```

## 导入类型

### 从其他文件导入类型

```javascript
/**
 * @typedef {import('./models/User').User} User
 * @typedef {import('./models/Pixel').Pixel} Pixel
 */

/**
 * 获取用户的像素
 * @param {User} user - 用户对象
 * @returns {Promise<Pixel[]>} 像素数组
 */
async function getUserPixels(user) {
  // ...
}
```

### 从 node_modules 导入

```javascript
/**
 * @param {import('knex').Knex} db - Knex 数据库实例
 * @returns {Promise<User[]>}
 */
async function getUsers(db) {
  // ...
}
```

## 事件和回调

```javascript
/**
 * Socket.io 连接处理器
 * @param {import('socket.io').Socket} socket - Socket 实例
 * @returns {void}
 */
function handleConnection(socket) {
  /**
   * 像素更新事件
   * @param {Pixel} data - 像素数据
   * @returns {void}
   */
  socket.on('pixel:update', (data) => {
    // ...
  });
}
```

## 常见模式

### 服务类模板

```javascript
/**
 * 用户服务
 * @class
 */
class UserService {
  /**
   * @param {import('knex').Knex} db - 数据库实例
   */
  constructor(db) {
    /** @type {import('knex').Knex} */
    this.db = db;
  }

  /**
   * 创建用户
   * @param {Object} userData - 用户数据
   * @param {string} userData.email - 邮箱
   * @param {string} userData.password - 密码
   * @returns {Promise<User>}
   */
  async create(userData) {
    // ...
  }

  /**
   * 更新用户
   * @param {number} userId - 用户ID
   * @param {Partial<User>} updates - 更新数据
   * @returns {Promise<User>}
   */
  async update(userId, updates) {
    // ...
  }
}

module.exports = UserService;
```

### 控制器模板

```javascript
/**
 * 用户控制器
 * @namespace UserController
 */
class UserController {
  /**
   * 获取用户列表
   * @memberof UserController
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   * @returns {Promise<void>}
   */
  static async getUsers(req, res) {
    try {
      const users = await UserService.getAll();
      res.json({ success: true, data: users });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
}

module.exports = UserController;
```

## VSCode 配置

创建 `jsconfig.json` 以启用类型检查：

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "target": "es6",
    "checkJs": true,
    "moduleResolution": "node",
    "lib": ["es2020"],
    "allowSyntheticDefaultImports": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules"]
}
```

## 类型检查

在文件顶部添加以启用严格检查：

```javascript
// @ts-check

/**
 * 这个文件启用了TypeScript类型检查
 */
```

## 最佳实践

### 1. 始终注释公共API

```javascript
// ✅ 好
/**
 * 创建用户
 * @param {Object} userData - 用户数据
 * @returns {Promise<User>}
 */
async function createUser(userData) { }

// ❌ 不好（缺少注释）
async function createUser(userData) { }
```

### 2. 使用 @typedef 定义复杂类型

```javascript
// ✅ 好
/**
 * @typedef {Object} ApiResponse
 * @property {boolean} success
 * @property {string} [message]
 * @property {any} [data]
 */

/**
 * @returns {Promise<ApiResponse>}
 */
async function callApi() { }

// ❌ 不好（内联复杂对象）
/**
 * @returns {Promise<{success: boolean, message?: string, data?: any}>}
 */
async function callApi() { }
```

### 3. 注释异常情况

```javascript
/**
 * 删除用户
 * @param {number} userId - 用户ID
 * @returns {Promise<void>}
 * @throws {Error} 当用户不存在时
 * @throws {Error} 当用户有关联数据时
 */
async function deleteUser(userId) { }
```

### 4. 使用描述性名称

```javascript
// ✅ 好
/**
 * @param {number} maxRetries - 最大重试次数
 */

// ❌ 不好
/**
 * @param {number} n - 数字
 */
```

## 工具推荐

1. **VSCode** - 原生 JSDoc 支持
2. **ESLint** - 使用 `eslint-plugin-jsdoc` 检查文档
3. **TypeScript** - 用于类型检查（无需迁移代码）

## 常见问题

### Q: JSDoc 会影响性能吗？
A: 不会。JSDoc 是纯注释，运行时会被忽略。

### Q: 如何检查类型正确性？
A: 使用 VSCode 的 TypeScript 检查或运行 `tsc --noEmit --allowJs`

### Q: 可以混用 JSDoc 和 TypeScript 吗？
A: 可以。可以逐步迁移，先用 JSDoc，后续再考虑 TypeScript。

## 参考资源

- [JSDoc 官方文档](https://jsdoc.app/)
- [TypeScript JSDoc 支持](https://www.typescriptlang.org/docs/handbook/jsdoc-supported-types.html)
- [Google JavaScript Style Guide](https://google.github.io/styleguide/jsguide.html#jsdoc)
