# 测试文档 / Testing Documentation

## 概述

本项目使用 Jest 作为测试框架，提供完整的单元测试、集成测试和性能测试支持。

## 目录

- [目录结构](#目录结构)
- [快速开始](#快速开始)
- [单元测试](#单元测试)
- [集成测试](#集成测试)
- [性能测试](#性能测试)
- [负载测试](#负载测试)
- [测试辅助工具](#测试辅助工具)
- [编写测试](#编写测试)
- [最佳实践](#最佳实践)
- [CI/CD 集成](#cicd-集成)
- [常见问题](#常见问题)

---

## 目录结构

```
backend/src/__tests__/
├── README.md                    # 本文档
├── setup.js                     # 全局测试配置
├── helpers/                     # 测试辅助工具
│   ├── mockData.js             # 模拟数据生成器
│   ├── mockDb.js               # 数据库模拟
│   └── mockRedis.js            # Redis 模拟
├── utils/                       # 工具函数测试
│   └── i18n.test.js            # i18n 工具测试
├── integration/                 # 集成测试
│   ├── setup.js                # 集成测试环境设置
│   └── api.test.js             # API 集成测试
└── performance/                 # 性能测试
    ├── benchmark.test.js       # 性能基准测试
    └── loadTest.js             # 负载测试脚本
```

## 快速开始

### 运行所有测试

```bash
npm test
```

### 运行特定测试文件

```bash
npm test -- i18n.test.js
```

### 运行测试并查看覆盖率

```bash
npm run test:coverage
```

### 监听模式（开发时使用）

```bash
npm run test:watch
```

---

## 单元测试

单元测试用于测试独立的函数和模块，不依赖外部服务（数据库、Redis 等）。

### 什么时候写单元测试？

- 测试工具函数和辅助方法
- 测试业务逻辑（纯函数）
- 测试数据验证和转换
- 测试中间件逻辑

### 单元测试示例

```javascript
// src/utils/formatters.js
function formatCurrency(amount) {
  return `¥${amount.toFixed(2)}`;
}

// src/__tests__/utils/formatters.test.js
describe('formatCurrency', () => {
  test('应该格式化金额', () => {
    expect(formatCurrency(100)).toBe('¥100.00');
    expect(formatCurrency(99.99)).toBe('¥99.99');
  });

  test('应该处理小数', () => {
    expect(formatCurrency(1.5)).toBe('¥1.50');
  });
});
```

---

## 集成测试

集成测试测试完整的 HTTP 请求-响应流程，需要真实的数据库和 Redis 连接。

### 环境配置

在运行集成测试前，需要配置测试环境变量：

```bash
# .env.test
DATABASE_URL=postgresql://user:password@localhost:5432/funnypixels_test
REDIS_URL=redis://localhost:6379/1
JWT_SECRET=test-jwt-secret-key-for-integration-testing-32chars
```

### 运行集成测试

```bash
# 确保测试数据库和 Redis 正在运行
npm test -- integration/
```

### 重要说明

**当前集成测试包含占位测试。** 要启用实际测试，需要将 `server.js` 重构为导出 Express app：

1. 创建 `src/app.js`:

```javascript
const express = require('express');
const app = express();

// ... 中间件配置
// ... 路由配置

module.exports = app;
```

2. 修改 `src/server.js`:

```javascript
const app = require('./app');
const PORT = process.env.PORT || 3001;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}
```

3. 在集成测试中使用:

```javascript
const request = require('supertest');
const app = require('../../app');

test('GET /api/health', async () => {
  const response = await request(app)
    .get('/api/health')
    .expect(200);

  expect(response.body).toHaveProperty('status', 'ok');
});
```

### 集成测试示例

```javascript
describe('Authentication API', () => {
  let testUser;
  let authToken;

  beforeAll(async () => {
    testUser = await createTestUser({
      email: 'integration-test@test.com',
      username: 'testuser'
    });
    authToken = generateTestToken(testUser.id);
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  test('POST /api/auth/login 应该登录用户', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'integration-test@test.com',
        password: 'password123'
      })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveProperty('token');
  });

  test('GET /api/auth/me 应该返回当前用户', async () => {
    const response = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(response.body.data.id).toBe(testUser.id);
  });
});
```

---

## 性能测试

性能测试确保关键操作满足性能要求。

### 运行性能测试

```bash
npm test -- performance/benchmark.test.js
```

### 性能指标

| 操作 | 目标 | 说明 |
|------|------|------|
| 像素查询 | < 100ms | 查询 100 条像素记录 |
| 用户查询 | < 50ms | 查询 100 条用户记录 |
| 聚合查询 | < 200ms | 按用户分组统计 |
| 批量插入 | >= 100 条/秒 | 批量插入性能 |
| Redis GET | < 10ms | Redis 读操作 |
| Redis SET | < 10ms | Redis 写操作 |
| Joi 验证 | < 1ms | 单次验证 |
| bcrypt 哈希 | 50-500ms | 密码哈希（安全性权衡） |
| JSON 序列化 | < 50ms | 1000 条记录 |

### 性能测试示例

```javascript
describe('Database Query Performance', () => {
  test('用户查询应该在 50ms 内完成', async () => {
    const start = Date.now();

    await db('users')
      .select('id', 'email', 'username')
      .limit(100);

    const duration = Date.now() - start;
    expect(duration).toBeLessThan(50);
    console.log(`✅ 用户查询耗时: ${duration}ms`);
  });
});
```

### 内存泄漏检测

```javascript
test('批量数据处理不应导致内存泄漏', async () => {
  const initialMemory = process.memoryUsage().heapUsed;

  // 处理大量数据
  for (let i = 0; i < 10; i++) {
    const data = Array.from({ length: 1000 }, (_, j) => ({
      id: j,
      data: 'x'.repeat(100)
    }));

    data.forEach(item => {
      const processed = { ...item, processed: true };
    });
  }

  if (global.gc) global.gc();

  const finalMemory = process.memoryUsage().heapUsed;
  const memoryGrowthMB = (finalMemory - initialMemory) / 1024 / 1024;

  expect(memoryGrowthMB).toBeLessThan(50);
  console.log(`✅ 内存增长: ${memoryGrowthMB.toFixed(2)}MB`);
});
```

---

## 负载测试

负载测试模拟高并发场景，测试系统在压力下的表现。

### 运行负载测试

```bash
# 基本用法（默认配置）
node src/__tests__/performance/loadTest.js

# 自定义配置
ENDPOINT=/api/health \
CONCURRENCY=50 \
DURATION=60 \
node src/__tests__/performance/loadTest.js
```

### 配置参数

| 环境变量 | 默认值 | 说明 |
|----------|--------|------|
| TEST_HOST | localhost | 目标主机 |
| TEST_PORT | 3001 | 目标端口 |
| ENDPOINT | /api/health | 测试端点 |
| CONCURRENCY | 10 | 并发连接数 |
| DURATION | 30 | 测试持续时间（秒） |

### 负载测试示例

```bash
# 测试健康检查端点（低负载）
ENDPOINT=/api/health CONCURRENCY=10 DURATION=30 \
  node src/__tests__/performance/loadTest.js

# 测试认证端点（中等负载）
ENDPOINT=/api/auth/me CONCURRENCY=50 DURATION=60 \
  node src/__tests__/performance/loadTest.js

# 测试像素查询端点（高负载）
ENDPOINT=/api/pixels CONCURRENCY=100 DURATION=120 \
  node src/__tests__/performance/loadTest.js
```

### 解读负载测试结果

```
============================================================
负载测试报告
============================================================
目标: localhost:3001/api/health
并发数: 10
持续时间: 30秒
============================================================
总请求数: 15420
成功请求: 15420
失败请求: 0
成功率: 100.00%
============================================================
平均响应时间: 18.45ms
最小响应时间: 5ms
最大响应时间: 156ms
P50 (中位数): 15ms
P95: 45ms
P99: 89ms
============================================================
吞吐量: 514.00 请求/秒
============================================================
```

**性能评估标准**:

- **平均响应时间**:
  - ✅ 优秀: < 100ms
  - ⚠️ 良好: < 200ms
  - ❌ 需要优化: >= 200ms

- **P95 响应时间**:
  - ✅ 优秀: < 500ms
  - ⚠️ 一般: < 1000ms
  - ❌ 较差: >= 1000ms

- **成功率**:
  - ✅ 优秀: >= 99.9%
  - ⚠️ 良好: >= 99%
  - ❌ 需要改进: < 99%

### 优化建议

脚本会根据测试结果自动提供优化建议：

- 平均响应时间 > 200ms:
  - 考虑添加缓存（Redis）
  - 优化数据库查询（添加索引）
  - 使用连接池

- P95 > 500ms:
  - 检查慢查询
  - 优化资源密集型操作
  - 考虑异步处理

- 成功率 < 99%:
  - 检查错误日志
  - 增加错误处理
  - 提高系统稳定性

---

## 测试辅助工具

### mockData.js - 模拟数据生成

```javascript
const {
  createMockUser,
  createMockPixel,
  createMockRequest,
  createMockResponse
} = require('./helpers/mockData');

// 创建模拟用户
const user = createMockUser({ id: 123, email: 'custom@example.com' });

// 创建模拟请求
const req = createMockRequest({
  body: { email: 'test@example.com' },
  user: { id: 1 }
});

// 创建模拟响应
const res = createMockResponse();
res.json({ success: true });
expect(res._data).toEqual({ success: true });
```

### mockDb.js - 数据库模拟

```javascript
const { createMockDb, createMockQueryBuilder } = require('./helpers/mockDb');

// 创建模拟数据库
const mockDb = createMockDb();

// 模拟查询
const queryBuilder = mockDb('users');
queryBuilder.mockResolvedValue([{ id: 1, email: 'test@example.com' }]);

// 使用
const users = await mockDb('users').where('id', 1);
// users = [{ id: 1, email: 'test@example.com' }]
```

### mockRedis.js - Redis 模拟

```javascript
const { createMockRedis } = require('./helpers/mockRedis');

// 创建模拟 Redis 客户端
const redis = createMockRedis();

// 使用（完全兼容 Redis 客户端API）
await redis.set('key', 'value');
const value = await redis.get('key');
expect(value).toBe('value');

// 清空存储（测试清理）
redis._clear();
```

## 编写测试

### 基础测试结构

```javascript
/**
 * 服务/模块名称测试
 */

describe('UserService', () => {
  // 每个测试前执行
  beforeEach(() => {
    // 设置
  });

  // 每个测试后执行
  afterEach(() => {
    // 清理
    jest.clearAllMocks();
  });

  describe('findByEmail()', () => {
    test('应该通过邮箱找到用户', async () => {
      // Arrange - 准备
      const mockDb = createMockDb();
      const userService = new UserService(mockDb);

      // Act - 执行
      const user = await userService.findByEmail('test@example.com');

      // Assert - 断言
      expect(user).toBeTruthy();
      expect(user.email).toBe('test@example.com');
    });

    test('应该在用户不存在时返回 null', async () => {
      // ...
    });
  });
});
```

### 测试中间件

```javascript
const { createMockRequest, createMockResponse, createMockNext } = require('./helpers/mockData');

test('应该验证请求', () => {
  const req = createMockRequest({ body: { email: 'test@example.com' } });
  const res = createMockResponse();
  const next = createMockNext();

  middleware(req, res, next);

  expect(next).toHaveBeenCalled();
  expect(res.status).not.toHaveBeenCalled();
});
```

### 测试异步函数

```javascript
test('应该异步加载用户', async () => {
  const user = await userService.loadUser(1);
  expect(user.id).toBe(1);
});

// 或使用 Promise
test('应该返回 Promise', () => {
  return userService.loadUser(1).then(user => {
    expect(user.id).toBe(1);
  });
});
```

### 测试异常

```javascript
test('应该在用户不存在时抛出错误', async () => {
  await expect(userService.loadUser(999)).rejects.toThrow('User not found');
});

// 或
test('应该抛出特定错误', () => {
  expect(() => {
    userService.validateEmail('invalid');
  }).toThrow('Invalid email');
});
```

### 模拟函数（Mock Functions）

```javascript
// 创建 mock 函数
const mockFn = jest.fn();

// 设置返回值
mockFn.mockReturnValue('result');
mockFn.mockResolvedValue('async result');
mockFn.mockRejectedValue(new Error('error'));

// 验证调用
expect(mockFn).toHaveBeenCalled();
expect(mockFn).toHaveBeenCalledWith('arg1', 'arg2');
expect(mockFn).toHaveBeenCalledTimes(1);
```

### 模拟模块

```javascript
// 模拟整个模块
jest.mock('../../services/emailService');
const emailService = require('../../services/emailService');

// 模拟特定函数
emailService.sendEmail = jest.fn().mockResolvedValue(true);

// 使用
await emailService.sendEmail('test@example.com', 'Hello');
expect(emailService.sendEmail).toHaveBeenCalled();
```

### 测试定时器

```javascript
// 使用假定时器
jest.useFakeTimers();

test('应该在延迟后执行', () => {
  const callback = jest.fn();
  setTimeout(callback, 1000);

  // 快进时间
  jest.advanceTimersByTime(1000);

  expect(callback).toHaveBeenCalled();
});

// 恢复真实定时器
jest.useRealTimers();
```

## 最佳实践

### 1. 使用描述性测试名称

```javascript
// ✅ 好
test('应该在邮箱已存在时返回错误', () => { });

// ❌ 不好
test('测试1', () => { });
```

### 2. 遵循 AAA 模式

```javascript
test('示例', () => {
  // Arrange - 准备测试数据
  const user = createMockUser();

  // Act - 执行被测试的代码
  const result = validateUser(user);

  // Assert - 验证结果
  expect(result).toBe(true);
});
```

### 3. 每个测试应该独立

```javascript
// ✅ 好 - 每个测试独立
describe('UserService', () => {
  let userService;

  beforeEach(() => {
    userService = new UserService();
  });

  test('测试1', () => { });
  test('测试2', () => { });
});

// ❌ 不好 - 测试相互依赖
let sharedUser;
test('创建用户', () => {
  sharedUser = createUser();
});
test('更新用户', () => {
  updateUser(sharedUser); // 依赖前一个测试
});
```

### 4. 使用 beforeEach/afterEach 清理

```javascript
describe('Redis Tests', () => {
  let redis;

  beforeEach(() => {
    redis = createMockRedis();
  });

  afterEach(() => {
    redis._clear();
    jest.clearAllMocks();
  });

  test('测试1', () => { });
  test('测试2', () => { });
});
```

### 5. 不要测试实现细节

```javascript
// ✅ 好 - 测试行为
test('应该返回格式化的用户名', () => {
  const result = formatUserName({ firstName: 'John', lastName: 'Doe' });
  expect(result).toBe('John Doe');
});

// ❌ 不好 - 测试实现
test('应该调用 toUpperCase', () => {
  const spy = jest.spyOn(String.prototype, 'toUpperCase');
  formatUserName({ firstName: 'John', lastName: 'Doe' });
  expect(spy).toHaveBeenCalled();
});
```

### 6. 测试边界情况

```javascript
describe('divide()', () => {
  test('应该正确除法', () => {
    expect(divide(10, 2)).toBe(5);
  });

  test('应该处理除以零', () => {
    expect(() => divide(10, 0)).toThrow('Division by zero');
  });

  test('应该处理负数', () => {
    expect(divide(-10, 2)).toBe(-5);
  });

  test('应该处理小数', () => {
    expect(divide(5, 2)).toBe(2.5);
  });
});
```

## 覆盖率目标

项目覆盖率目标（在 jest.config.js 中配置）：

- **分支覆盖率**: 50%
- **函数覆盖率**: 50%
- **行覆盖率**: 50%
- **语句覆盖率**: 50%

查看覆盖率报告：

```bash
npm run test:coverage
open coverage/lcov-report/index.html  # 在浏览器中打开
```

---

## CI/CD 集成

### GitHub Actions 配置示例

```yaml
# .github/workflows/test.yml
name: Tests

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: funnypixels_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

      redis:
        image: redis:7
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 6379:6379

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm run test:ci
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/funnypixels_test
          REDIS_URL: redis://localhost:6379/1
          JWT_SECRET: test-jwt-secret-key-for-ci-testing-32chars
          NODE_ENV: test

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
          flags: unittests
          name: codecov-umbrella
```

### 持续集成最佳实践

测试应该在以下情况下运行：

1. **提交代码前** (pre-commit hook)
   - 运行快速单元测试
   - 检查代码格式

2. **推送到远程仓库前** (pre-push hook)
   - 运行所有单元测试
   - 生成覆盖率报告

3. **Pull Request 时** (CI/CD pipeline)
   - 运行所有单元测试
   - 运行集成测试
   - 运行性能基准测试
   - 检查覆盖率阈值

4. **合并到主分支前** (required check)
   - 所有测试必须通过
   - 覆盖率不能降低

### 覆盖率阈值配置

在 `jest.config.js` 中配置覆盖率阈值，CI 会强制执行：

```javascript
module.exports = {
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 50,
      lines: 50,
      statements: 50
    },
    // 关键文件可以设置更高阈值
    './src/services/authService.js': {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  }
};
```

---

## 常见问题

### Q: 如何跳过某个测试？

```javascript
test.skip('暂时跳过的测试', () => {
  // 不会运行
});
```

### Q: 如何只运行某个测试？

```javascript
test.only('只运行这个测试', () => {
  // 只有这个会运行
});
```

### Q: 如何调试测试？

```javascript
// 1. 使用 VSCode 调试器
// 2. 添加断点
// 3. 运行 "Jest: Debug Test"

// 或使用 console.log
test('调试', () => {
  const result = someFunction();
  console.log('Result:', result);
  expect(result).toBe(expected);
});
```

### Q: 测试运行很慢怎么办？

```bash
# 并行运行测试
npm test -- --maxWorkers=4

# 只运行改变的文件
npm test -- --onlyChanged

# 不收集覆盖率
npm test -- --coverage=false
```

### Q: 如何测试私有方法？

不要直接测试私有方法，而是通过公共 API 间接测试它们。如果必须测试：

```javascript
// 不推荐但可行
const PrivateMethod = MyClass.__get__('privateMethod');
```

### Q: 数据库测试数据如何清理？

A: 使用 `afterEach` 或 `afterAll` 钩子清理测试数据：

```javascript
afterEach(async () => {
  // 清理特定模式的测试数据
  await db('pixels').where('grid_id', 'like', 'test_%').del();
  await db('users').where('email', 'like', '%@test.com').del();
});
```

### Q: 如何测试需要认证的端点？

A: 使用测试辅助函数生成 token：

```javascript
const { generateTestToken } = require('./integration/setup');

test('应该访问受保护的端点', async () => {
  const testUser = await createTestUser();
  const token = generateTestToken(testUser.id);

  const response = await request(app)
    .get('/api/protected')
    .set('Authorization', `Bearer ${token}`)
    .expect(200);
});
```

### Q: 集成测试需要真实数据库吗？

A: 是的，集成测试应该使用真实数据库（通常是专门的测试数据库）来确保：
- 数据库查询正确工作
- 事务处理正确
- 数据约束被正确执行

建议使用 Docker 快速启动测试数据库：

```bash
docker run -d \
  --name funnypixels-test-db \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=funnypixels_test \
  -p 5432:5432 \
  postgres:15
```

### Q: 性能测试失败怎么办？

A: 首先确定是否是真实的性能问题：

1. **检查测试环境**: 确保在稳定的环境中运行（不是共享的 CI 环境）
2. **多次运行**: 运行 3-5 次取平均值
3. **分析瓶颈**: 使用性能分析工具找出慢的部分
4. **调整阈值**: 如果性能在可接受范围内，可以适当调整阈值

```javascript
// 使用更宽松的阈值
expect(duration).toBeLessThan(150); // 而不是 100
```

### Q: 负载测试应该在什么时候运行？

A: 负载测试通常不在 CI 中运行，而是：

- 在部署前手动运行
- 定期在测试环境运行（每周/每月）
- 在重大性能优化后运行
- 在生产环境模拟高峰流量前运行

---

## 测试命令参考

```bash
# 运行所有测试
npm test

# 运行并生成覆盖率报告
npm run test:coverage

# 监听模式（开发时使用）
npm run test:watch

# 详细输出模式
npm run test:verbose

# CI 模式（更快，适合 CI/CD）
npm run test:ci

# 运行特定文件
npm test -- path/to/test.js

# 运行特定测试套件
npm test -- integration/
npm test -- performance/

# 运行匹配模式的测试
npm test -- --testNamePattern="用户"

# 更新快照
npm test -- --updateSnapshot

# 静默模式
npm test -- --silent

# 限制并发进程
npm test -- --maxWorkers=4

# 只运行改变的文件
npm test -- --onlyChanged
```

---

## 参考资源

### 官方文档

- [Jest 官方文档](https://jestjs.io/)
- [Supertest 文档](https://github.com/visionmedia/supertest)
- [Node.js 测试最佳实践](https://github.com/goldbergyoni/nodebestpractices#-6-testing-and-overall-quality-practices)

### 测试方法论

- [测试驱动开发 (TDD)](https://en.wikipedia.org/wiki/Test-driven_development)
- [行为驱动开发 (BDD)](https://en.wikipedia.org/wiki/Behavior-driven_development)
- [JavaScript 测试最佳实践](https://github.com/goldbergyoni/javascript-testing-best-practices)

### 工具和库

- [Jest Cheat Sheet](https://github.com/sapegin/jest-cheat-sheet)
- [Testing Library](https://testing-library.com/)
- [Faker.js](https://fakerjs.dev/) - 生成更丰富的测试数据

---

## 维护者

FunnyPixels Team

如有问题或建议，请提交 Issue 或 Pull Request。
