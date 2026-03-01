---
name: test-validation
description: Run comprehensive test validation including unit tests, integration tests, and coverage analysis. Use after code changes or before deployment.
allowed-tools: Bash(npm *), Bash(xcodebuild *), Bash(swift *), Read, Write
disable-model-invocation: false
---

# 全面测试验证

执行完整的测试套件并生成详细报告。

## 测试范围

检测项目类型并运行相应测试：
- **Backend (Node.js)**: npm test, coverage, API tests
- **iOS (Swift)**: xcodebuild test, XCTest
- **Database**: Migration tests, query validation

## 执行流程

### 1. 环境检查 (1分钟)

```bash
# 检查 Node.js 环境
node --version
npm --version

# 检查 Xcode 环境
xcodebuild -version
swift --version

# 检查数据库连接
psql -d funnypixels_db -c "SELECT 1"
```

### 2. 后端测试 (5-10分钟)

#### 单元测试
```bash
cd backend
npm test -- --coverage --testPathPattern=".*\\.test\\.js$"
```

#### 集成测试
```bash
npm run test:integration
```

#### API 端点测试
```bash
npm run test:api
```

#### 覆盖率检查
```bash
npm run test:coverage
```

**验证标准:**
- ✅ 所有测试通过
- ✅ 覆盖率 > 80%
- ✅ 无跳过的测试
- ✅ 无控制台错误

### 3. iOS 测试 (10-15分钟)

#### 编译检查
```bash
cd FunnyPixelsApp
xcodebuild clean build \
  -scheme FunnyPixels \
  -destination 'platform=iOS Simulator,name=iPhone 15,OS=latest'
```

#### 单元测试
```bash
xcodebuild test \
  -scheme FunnyPixels \
  -destination 'platform=iOS Simulator,name=iPhone 15,OS=latest' \
  -resultBundlePath TestResults.xcresult
```

#### 代码覆盖率
```bash
xcrun xccov view --report TestResults.xcresult
```

**验证标准:**
- ✅ 编译无警告
- ✅ 所有测试通过
- ✅ 覆盖率 > 70%
- ✅ 无内存泄漏

### 4. 数据库测试 (2-3分钟)

#### 迁移测试
```bash
cd backend

# 测试迁移
npx knex migrate:rollback --all
npx knex migrate:latest

# 验证表结构
psql -d funnypixels_db -c "\dt"
```

#### 数据完整性
```bash
# 检查外键约束
psql -d funnypixels_db -c "
  SELECT conname, conrelid::regclass, confrelid::regclass
  FROM pg_constraint
  WHERE contype = 'f';
"

# 检查索引
psql -d funnypixels_db -c "\di"
```

### 5. 性能测试 (5分钟)

#### API 响应时间
```bash
# 测试关键端点响应时间
for endpoint in \
  "/api/share/stats" \
  "/api/referral/stats" \
  "/api/vip/subscriptions"
do
  echo "Testing $endpoint"
  time curl -s -o /dev/null -w "%{time_total}\n" \
    -H "Authorization: Bearer $TOKEN" \
    http://localhost:3000$endpoint
done
```

**性能标准:**
- ✅ API 响应 < 200ms
- ✅ 数据库查询 < 100ms
- ✅ 内存使用稳定
- ✅ 无 N+1 查询问题

### 6. 安全测试 (3分钟)

#### SQL 注入测试
```bash
# 测试防护
curl -X POST http://localhost:3000/api/items \
  -H "Content-Type: application/json" \
  -d '{"name":"test\"; DROP TABLE users; --"}'
```

#### XSS 测试
```bash
# 测试防护
curl -X POST http://localhost:3000/api/items \
  -H "Content-Type: application/json" \
  -d '{"name":"<script>alert(1)</script>"}'
```

#### 认证测试
```bash
# 未认证访问应返回 401
curl -I http://localhost:3000/api/share/stats
```

## 测试报告生成

### 格式化输出

```markdown
# Test Validation Report
Generated: $(date)

## Summary
- Total Tests: X
- Passed: X
- Failed: X
- Skipped: X
- Coverage: X%
- Duration: Xs

## Backend Tests
- Unit Tests: X/X passed
- Integration Tests: X/X passed
- API Tests: X/X passed
- Coverage: X%

## iOS Tests
- Unit Tests: X/X passed
- UI Tests: X/X passed
- Coverage: X%

## Performance
- API Response Time: Xms (target: <200ms)
- Database Query Time: Xms (target: <100ms)
- Memory Usage: XMB

## Failed Tests
1. Test Name - Error Message
2. ...

## Recommendations
- [ ] Action item 1
- [ ] Action item 2
```

### 保存报告

```bash
# 保存到文件
REPORT_FILE="test-report-$(date +%Y%m%d-%H%M%S).md"
echo "Report saved to: $REPORT_FILE"
```

## 失败处理

### 如果测试失败

1. **收集详细信息**
   - 失败的测试名称
   - 错误消息和堆栈
   - 相关日志

2. **分类问题**
   - 代码错误
   - 环境问题
   - 配置问题
   - 测试本身的问题

3. **建议修复**
   - 提供具体的修复建议
   - 引用相关代码位置
   - 推荐解决方案

### 如果覆盖率不足

1. **识别未覆盖代码**
   ```bash
   npm run test:coverage -- --verbose
   ```

2. **优先级排序**
   - 关键路径优先
   - 复杂逻辑优先
   - 公共 API 优先

3. **生成测试建议**
   - 列出需要测试的函数
   - 提供测试用例模板
   - 估算所需时间

## 成功标准

### 必须满足（阻塞部署）
- ✅ 所有测试通过
- ✅ 无编译错误/警告
- ✅ 覆盖率 > 80%
- ✅ 安全测试通过

### 建议满足（不阻塞但需改进）
- ⚠️ 覆盖率 > 90%
- ⚠️ 性能测试优于目标值
- ⚠️ 无跳过的测试

## 输出文件

1. **完整报告**: `test-validation-report-${timestamp}.md`
2. **失败详情**: `test-failures-${timestamp}.log`
3. **覆盖率报告**: `coverage/lcov-report/index.html`

---

**执行此 skill**: `/test-validation`
**只测试后端**: `/test-validation backend`
**只测试 iOS**: `/test-validation ios`
