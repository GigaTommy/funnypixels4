---
name: backend-api
description: Implement and test backend API endpoints. Use when creating new REST APIs, adding features to controllers, or modifying database models.
context: fork
agent: general-purpose
allowed-tools: Read, Write, Edit, Glob, Grep, Bash(npm *), Bash(node *), Bash(psql *)
argument-hint: [api-endpoint-name]
---

# 后端 API 开发和测试

自动化创建、实现和测试后端 API 端点。

## API 端点
开发端点: $ARGUMENTS

## 开发流程

### 阶段 1: API 设计 (10分钟)

1. **需求分析**
   - 确定 API 功能
   - 定义请求/响应格式
   - 识别依赖的数据模型

2. **路由设计**
   - HTTP 方法 (GET/POST/PUT/DELETE)
   - URL 路径
   - 查询参数和请求体

3. **数据库设计**
   - 检查现有表是否满足需求
   - 设计新表或修改现有表
   - 定义索引和约束

### 阶段 2: 实现 (30-40分钟)

#### 1. 数据库迁移（如需要）

```javascript
// backend/src/migrations/YYYYMMDD_feature_name.js
exports.up = function(knex) {
  return knex.schema
    .createTable('table_name', function(table) {
      table.uuid('id').primary();
      // ... 其他字段
    });
};
```

#### 2. 数据模型

```javascript
// backend/src/models/ModelName.js
class ModelName {
  static async create(data) { }
  static async findById(id) { }
  static async update(id, data) { }
  static async delete(id) { }
}
```

#### 3. 控制器

```javascript
// backend/src/controllers/featureController.js
class FeatureController {
  static async getItem(req, res) {
    try {
      // 1. 验证参数
      // 2. 查询数据
      // 3. 返回响应
    } catch (error) {
      // 错误处理
    }
  }
}
```

#### 4. 路由

```javascript
// backend/src/routes/featureRoutes.js
router.get('/items/:id', authenticateToken, FeatureController.getItem);
router.post('/items', authenticateToken, FeatureController.createItem);
```

#### 5. 验证和中间件

```javascript
// backend/src/middleware/validation.js
const validateCreateItem = (req, res, next) => {
  // 验证逻辑
};
```

### 阶段 3: 测试 (20分钟)

#### 1. 单元测试

```javascript
// backend/src/__tests__/models/ModelName.test.js
describe('ModelName', () => {
  test('should create item', async () => {
    const item = await ModelName.create({ name: 'Test' });
    expect(item.name).toBe('Test');
  });
});
```

#### 2. API 集成测试

```javascript
// backend/src/__tests__/routes/featureRoutes.test.js
describe('Feature API', () => {
  test('POST /api/items should create item', async () => {
    const response = await request(app)
      .post('/api/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Test' });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
  });
});
```

#### 3. 数据库测试

```bash
# 运行迁移
npx knex migrate:latest

# 验证表结构
psql -d funnypixels_db -c "\d table_name"

# 测试查询
psql -d funnypixels_db -c "SELECT * FROM table_name LIMIT 1"
```

### 阶段 4: 文档和验证 (10分钟)

1. **API 文档**
   ```markdown
   ## POST /api/items

   创建新项目

   **请求体:**
   ```json
   {
     "name": "string",
     "description": "string"
   }
   ```

   **响应:**
   ```json
   {
     "success": true,
     "data": { "id": "uuid", ... }
   }
   ```
   ```

2. **Postman/cURL 测试**
   ```bash
   curl -X POST http://localhost:3000/api/items \
     -H "Authorization: Bearer TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"name":"Test"}'
   ```

## 实现检查清单

### API 设计
- [ ] RESTful 规范
- [ ] 一致的响应格式
- [ ] 适当的 HTTP 状态码
- [ ] 清晰的错误消息

### 数据库
- [ ] 表结构正确
- [ ] 索引优化
- [ ] 外键约束
- [ ] 数据验证

### 代码质量
- [ ] 输入验证
- [ ] SQL 注入防护
- [ ] XSS 防护
- [ ] 错误处理完善
- [ ] 日志记录

### 性能
- [ ] 查询优化（避免 N+1）
- [ ] 分页实现
- [ ] 缓存策略
- [ ] 索引使用

### 测试
- [ ] 单元测试覆盖率 > 80%
- [ ] 集成测试覆盖主要场景
- [ ] 边界条件测试
- [ ] 错误场景测试

### 安全
- [ ] 认证验证
- [ ] 权限检查
- [ ] 速率限制（如需要）
- [ ] 敏感数据加密

## 输出文件

1. **API 文档**: `API_DOC_${endpoint-name}.md`
2. **测试报告**: `TEST_REPORT_${endpoint-name}.md`
3. **迁移脚本**: `migrations/YYYYMMDD_${endpoint-name}.js`

## 测试命令

```bash
# 运行所有测试
npm test

# 运行特定测试文件
npm test -- featureRoutes.test.js

# 测试覆盖率
npm run test:coverage

# 数据库迁移
npx knex migrate:latest

# 回滚迁移
npx knex migrate:rollback
```

## 成功标准

✅ API 端点正常工作
✅ 所有测试通过
✅ 测试覆盖率 > 80%
✅ 数据库迁移成功
✅ API 文档完整
✅ 性能测试通过（响应时间 < 200ms）
✅ 安全检查通过

---

**执行此 skill**: `/backend-api create-share-tracking`
