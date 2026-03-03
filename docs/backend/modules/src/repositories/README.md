# Repository 模式指南

## 概述

Repository 模式提供了一个抽象层，封装了数据访问逻辑，将业务逻辑与数据库操作分离。

## 为什么使用 Repository 模式？

### ❌ 没有 Repository 的问题

```javascript
// Service 直接操作数据库
class UserService {
  async findUserByEmail(email) {
    // 直接写 SQL 查询
    const user = await db('users').where({ email }).first();
    return user;
  }

  async createUser(userData) {
    const [user] = await db('users').insert(userData).returning('*');
    return user;
  }
}
```

**问题**:
- ❌ 数据访问逻辑分散在多个服务中
- ❌ SQL 查询重复
- ❌ 难以测试（需要 mock 整个数据库）
- ❌ 修改数据库结构需要改动多处代码

### ✅ 使用 Repository 的优势

```javascript
// Repository 封装数据访问
class UserRepository extends BaseRepository {
  async findByEmail(email) {
    return await this.findOne({ email });
  }

  async emailExists(email) {
    return await this.exists({ email });
  }
}

// Service 使用 Repository
class UserService {
  constructor(userRepository) {
    this.userRepository = userRepository;
  }

  async findUserByEmail(email) {
    return await this.userRepository.findByEmail(email);
  }

  async createUser(userData) {
    // 业务逻辑验证
    const exists = await this.userRepository.emailExists(userData.email);
    if (exists) {
      throw new Error('Email already exists');
    }

    return await this.userRepository.create(userData);
  }
}
```

**优势**:
- ✅ 数据访问逻辑集中管理
- ✅ 代码复用（常见查询方法）
- ✅ 易于测试（只需 mock Repository）
- ✅ 易于维护和修改

---

## 快速开始

### 1. 使用现有的 Repository

```javascript
const { getContainer } = require('../core/ServiceProvider');

// 获取 Repository 实例
const userRepository = getContainer().get('userRepository');

// 查找用户
const user = await userRepository.findById(1);
const userByEmail = await userRepository.findByEmail('test@example.com');

// 创建用户
const newUser = await userRepository.create({
  email: 'new@example.com',
  username: 'newuser',
  password_hash: 'hashed_password'
});

// 更新用户
const updated = await userRepository.update(1, {
  display_name: 'New Name'
});

// 删除用户
await userRepository.delete(1);
```

### 2. 创建自定义 Repository

```javascript
// repositories/PostRepository.js
const BaseRepository = require('./BaseRepository');

class PostRepository extends BaseRepository {
  constructor(db) {
    super(db, 'posts'); // 指定表名
  }

  /**
   * 根据用户ID查找帖子
   */
  async findByUserId(userId) {
    return await this.findMany({ user_id: userId }, {
      orderBy: 'created_at',
      order: 'desc'
    });
  }

  /**
   * 查找已发布的帖子
   */
  async findPublished(limit = 10) {
    return await this.query()
      .where({ status: 'published' })
      .orderBy('created_at', 'desc')
      .limit(limit);
  }

  /**
   * 获取帖子及其作者信息
   */
  async findByIdWithAuthor(postId) {
    const result = await this.query()
      .where({ 'posts.id': postId })
      .join('users', 'posts.user_id', 'users.id')
      .select(
        'posts.*',
        'users.username',
        'users.avatar_url'
      )
      .first();

    if (!result) return undefined;

    const { username, avatar_url, ...post } = result;
    return {
      ...post,
      author: { username, avatar_url }
    };
  }
}

module.exports = PostRepository;
```

### 3. 在 ServiceProvider 中注册

```javascript
// core/ServiceProvider.js

container.singleton('postRepository', (c) => {
  const PostRepository = require('../repositories/PostRepository');
  return new PostRepository(c.get('db'));
});
```

### 4. 在 Service 中使用

```javascript
class PostService {
  constructor(postRepository, userRepository) {
    this.postRepository = postRepository;
    this.userRepository = userRepository;
  }

  async createPost(userId, postData) {
    // 验证用户存在
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // 创建帖子
    return await this.postRepository.create({
      ...postData,
      user_id: userId,
      status: 'draft'
    });
  }

  async publishPost(postId) {
    return await this.postRepository.update(postId, {
      status: 'published',
      published_at: new Date()
    });
  }

  async getPostWithAuthor(postId) {
    return await this.postRepository.findByIdWithAuthor(postId);
  }
}
```

---

## BaseRepository API

### 基础查询方法

#### `query()`
获取 Knex 查询构建器，用于复杂查询。

```javascript
const posts = await postRepository.query()
  .where('status', 'published')
  .where('created_at', '>', new Date('2024-01-01'))
  .orderBy('views', 'desc')
  .limit(10);
```

#### `findById(id)`
根据ID查找记录。

```javascript
const user = await userRepository.findById(1);
// => { id: 1, email: 'test@example.com', ... }
```

#### `findOne(conditions)`
根据条件查找单个记录。

```javascript
const user = await userRepository.findOne({ email: 'test@example.com' });
```

#### `findMany(conditions, options)`
根据条件查找多个记录。

```javascript
const activeUsers = await userRepository.findMany(
  { status: 'active' },
  {
    limit: 10,
    offset: 20,
    orderBy: 'created_at',
    order: 'desc'
  }
);
```

#### `findAll(options)`
查找所有记录。

```javascript
const allUsers = await userRepository.findAll({
  orderBy: 'created_at',
  limit: 100
});
```

### 创建方法

#### `create(data)`
创建单个记录。

```javascript
const user = await userRepository.create({
  email: 'new@example.com',
  username: 'newuser',
  password_hash: 'hashed'
});
// 自动添加 created_at 和 updated_at
```

#### `createMany(dataArray)`
批量创建记录。

```javascript
const users = await userRepository.createMany([
  { email: 'user1@example.com', username: 'user1' },
  { email: 'user2@example.com', username: 'user2' }
]);
```

### 更新方法

#### `update(id, data)`
更新单个记录。

```javascript
const updated = await userRepository.update(1, {
  display_name: 'New Name'
});
// 自动更新 updated_at
```

#### `updateMany(conditions, data)`
批量更新记录。

```javascript
const count = await userRepository.updateMany(
  { status: 'pending' },
  { status: 'active' }
);
// 返回受影响的行数
```

### 删除方法

#### `delete(id)`
删除单个记录。

```javascript
await userRepository.delete(1);
```

#### `deleteMany(conditions)`
批量删除记录。

```javascript
await userRepository.deleteMany({ status: 'inactive' });
```

### 工具方法

#### `exists(conditions)`
检查记录是否存在。

```javascript
const exists = await userRepository.exists({ email: 'test@example.com' });
// => true or false
```

#### `count(conditions)`
统计记录数量。

```javascript
const count = await userRepository.count({ status: 'active' });
// => 42
```

#### `paginate(conditions, page, pageSize, options)`
分页查询。

```javascript
const result = await userRepository.paginate(
  { status: 'active' },
  1,        // page
  10,       // pageSize
  { orderBy: 'created_at', order: 'desc' }
);

// result = {
//   data: [...],
//   total: 100,
//   page: 1,
//   pageSize: 10,
//   totalPages: 10
// }
```

#### `transaction(callback)`
使用事务。

```javascript
await userRepository.transaction(async (trx) => {
  const user = await trx('users').insert({ ... }).returning('*');
  await trx('profiles').insert({ user_id: user.id, ... });
});
```

#### `raw(sql, bindings)`
执行原始 SQL 查询。

```javascript
const result = await userRepository.raw(
  'SELECT COUNT(*) as count FROM users WHERE created_at > ?',
  [new Date('2024-01-01')]
);
```

---

## 高级用法

### 1. 自定义查询方法

```javascript
class UserRepository extends BaseRepository {
  /**
   * 查找最活跃的用户
   */
  async findMostActive(limit = 10) {
    return await this.query()
      .select('users.*')
      .count('pixels.id as pixel_count')
      .leftJoin('pixels', 'users.id', 'pixels.user_id')
      .groupBy('users.id')
      .orderBy('pixel_count', 'desc')
      .limit(limit);
  }

  /**
   * 查找用户及其统计信息
   */
  async findByIdWithStats(userId) {
    const user = await this.findById(userId);
    if (!user) return undefined;

    const stats = await this.db('pixels')
      .where({ user_id: userId })
      .select(
        this.db.raw('COUNT(*) as total_pixels'),
        this.db.raw('COUNT(DISTINCT DATE(created_at)) as active_days')
      )
      .first();

    return { ...user, stats };
  }
}
```

### 2. 使用事务确保数据一致性

```javascript
async createUserWithProfile(userData, profileData) {
  return await this.userRepository.transaction(async (trx) => {
    // 创建用户
    const [user] = await trx('users')
      .insert(userData)
      .returning('*');

    // 创建用户资料
    await trx('profiles').insert({
      ...profileData,
      user_id: user.id
    });

    return user;
  });
}
```

### 3. 复杂查询示例

```javascript
class PixelRepository extends BaseRepository {
  /**
   * 获取热门区域（像素密集区域）
   */
  async getHotspots(limit = 10) {
    return await this.query()
      .select(
        this.db.raw('ROUND(latitude::numeric, 2) as latitude'),
        this.db.raw('ROUND(longitude::numeric, 2) as longitude'),
        this.db.raw('COUNT(*) as pixel_count')
      )
      .groupBy(
        this.db.raw('ROUND(latitude::numeric, 2)'),
        this.db.raw('ROUND(longitude::numeric, 2)')
      )
      .orderBy('pixel_count', 'desc')
      .limit(limit);
  }

  /**
   * 获取用户的领土像素（未被覆盖的像素）
   */
  async getUserTerritoryPixels(userId) {
    return await this.db
      .select('p1.*')
      .from('pixels as p1')
      .innerJoin(
        this.db('pixels')
          .select('grid_id')
          .max('created_at as max_created_at')
          .groupBy('grid_id')
          .as('p2'),
        function() {
          this.on('p1.grid_id', '=', 'p2.grid_id')
            .andOn('p1.created_at', '=', 'p2.max_created_at');
        }
      )
      .where('p1.user_id', userId);
  }
}
```

### 4. 覆盖 _prepareForInsert 和 _prepareForUpdate

```javascript
class PostRepository extends BaseRepository {
  /**
   * 插入前的数据准备
   */
  _prepareForInsert(data) {
    return {
      ...super._prepareForInsert(data),
      // 自动生成 slug
      slug: data.slug || this._generateSlug(data.title),
      // 默认状态
      status: data.status || 'draft'
    };
  }

  /**
   * 更新前的数据准备
   */
  _prepareForUpdate(data) {
    const prepared = super._prepareForUpdate(data);

    // 如果更新了标题，重新生成 slug
    if (data.title) {
      prepared.slug = this._generateSlug(data.title);
    }

    return prepared;
  }

  _generateSlug(title) {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }
}
```

---

## 测试 Repository

### 单元测试（使用 Mock）

```javascript
const UserRepository = require('../../repositories/UserRepository');
const { createMockDb } = require('../helpers/mockDb');

describe('UserRepository', () => {
  let userRepository;
  let mockDb;

  beforeEach(() => {
    mockDb = createMockDb();
    userRepository = new UserRepository(mockDb);
  });

  test('findByEmail 应该返回用户', async () => {
    const mockUser = { id: 1, email: 'test@example.com' };
    mockDb.mockResolvedValue(mockUser);

    const user = await userRepository.findByEmail('test@example.com');

    expect(user).toEqual(mockUser);
    expect(mockDb().where).toHaveBeenCalledWith({ email: 'test@example.com' });
  });

  test('emailExists 应该检查邮箱是否存在', async () => {
    mockDb.mockResolvedValue({ id: 1 });

    const exists = await userRepository.emailExists('test@example.com');

    expect(exists).toBe(true);
  });
});
```

### 集成测试（使用真实数据库）

```javascript
const { createContainer } = require('../../core/ServiceProvider');
const { setupTestEnvironment, cleanupTestData } = require('./setup');

describe('UserRepository Integration', () => {
  let userRepository;

  beforeAll(async () => {
    await setupTestEnvironment();
    const container = createContainer();
    userRepository = container.get('userRepository');
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  test('应该创建和查找用户', async () => {
    const userData = {
      email: 'integration@test.com',
      username: 'integrationtest',
      password_hash: 'hashed'
    };

    // 创建用户
    const user = await userRepository.create(userData);
    expect(user.id).toBeDefined();
    expect(user.email).toBe(userData.email);

    // 查找用户
    const found = await userRepository.findByEmail(userData.email);
    expect(found.id).toBe(user.id);

    // 清理
    await userRepository.delete(user.id);
  });
});
```

---

## 最佳实践

### 1. 保持 Repository 简单

```javascript
// ✅ 好 - Repository 只负责数据访问
class UserRepository extends BaseRepository {
  async findByEmail(email) {
    return await this.findOne({ email });
  }
}

// ❌ 不好 - Repository 包含业务逻辑
class UserRepository extends BaseRepository {
  async registerUser(email, password) {
    // 验证邮箱（业务逻辑）
    if (!this.validateEmail(email)) {
      throw new Error('Invalid email');
    }

    // 哈希密码（业务逻辑）
    const hash = await bcrypt.hash(password, 10);

    return await this.create({ email, password_hash: hash });
  }
}

// ✅ 好 - 业务逻辑在 Service 层
class UserService {
  async registerUser(email, password) {
    // 业务逻辑
    if (!this.validateEmail(email)) {
      throw new Error('Invalid email');
    }

    const hash = await bcrypt.hash(password, 10);

    // Repository 只负责数据访问
    return await this.userRepository.create({ email, password_hash: hash });
  }
}
```

### 2. 使用类型注释

```javascript
/**
 * @typedef {Object} User
 * @property {number} id
 * @property {string} email
 * @property {string} username
 */

/**
 * @extends {BaseRepository<User>}
 */
class UserRepository extends BaseRepository {
  /**
   * @param {string} email
   * @returns {Promise<User|undefined>}
   */
  async findByEmail(email) {
    return await this.findOne({ email });
  }
}
```

### 3. 避免 N+1 查询问题

```javascript
// ❌ 不好 - N+1 查询
async getPostsWithAuthors(postIds) {
  const posts = await this.postRepository.findByIds(postIds);

  // 每个帖子都查询一次作者（N 次查询）
  for (const post of posts) {
    post.author = await this.userRepository.findById(post.user_id);
  }

  return posts;
}

// ✅ 好 - 使用 JOIN 或批量查询
async getPostsWithAuthors(postIds) {
  return await this.postRepository.query()
    .whereIn('posts.id', postIds)
    .join('users', 'posts.user_id', 'users.id')
    .select('posts.*', 'users.username', 'users.avatar_url');
}

// 或者批量查询
async getPostsWithAuthors(postIds) {
  const posts = await this.postRepository.findByIds(postIds);
  const userIds = posts.map(p => p.user_id);
  const users = await this.userRepository.findByIds(userIds);

  // 构建用户映射
  const userMap = new Map(users.map(u => [u.id, u]));

  // 添加作者信息
  return posts.map(post => ({
    ...post,
    author: userMap.get(post.user_id)
  }));
}
```

### 4. 使用事务处理关联操作

```javascript
async createAllianceWithLeader(allianceData, userId) {
  return await this.allianceRepository.transaction(async (trx) => {
    // 创建联盟
    const [alliance] = await trx('alliances')
      .insert({
        ...allianceData,
        leader_id: userId
      })
      .returning('*');

    // 添加领袖为成员
    await trx('alliance_members').insert({
      alliance_id: alliance.id,
      user_id: userId,
      role: 'leader'
    });

    return alliance;
  });
}
```

---

## 常见问题

### Q: Repository 和 Service 有什么区别？

A:
- **Repository**: 负责数据访问，封装数据库操作
- **Service**: 负责业务逻辑，协调多个 Repository

```javascript
// Repository - 数据访问
class UserRepository {
  async findByEmail(email) {
    return await this.findOne({ email });
  }
}

// Service - 业务逻辑
class UserService {
  async login(email, password) {
    // 查找用户（使用 Repository）
    const user = await this.userRepository.findByEmail(email);

    // 业务逻辑：验证密码
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) throw new Error('Invalid password');

    // 业务逻辑：生成 token
    const token = jwt.sign({ id: user.id }, JWT_SECRET);

    return { user, token };
  }
}
```

### Q: 何时应该创建自定义 Repository 方法？

A: 当：
- 查询逻辑复杂且会被多次使用
- 需要 JOIN 多个表
- 需要特定的业务查询（如"查找最活跃用户"）

### Q: 如何处理复杂的查询？

A: 几种方法：
1. 使用 `query()` 方法获取 Knex 查询构建器
2. 创建自定义 Repository 方法
3. 使用 `raw()` 方法执行原始 SQL（作为最后手段）

---

## 参考资源

- [Repository Pattern](https://martinfowler.com/eaaCatalog/repository.html)
- [Knex.js 文档](http://knexjs.org/)
- [Data Access Layer Best Practices](https://docs.microsoft.com/en-us/dotnet/architecture/microservices/microservice-ddd-cqrs-patterns/infrastructure-persistence-layer-design)

---

**维护者**: FunnyPixels Team
