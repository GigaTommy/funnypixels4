# 生产环境测试用户初始化指南

## 使用说明

### 1. 准备生产环境配置

首先，您需要创建生产环境配置文件 `.env.production`：

```bash
# 复制模板文件
cp env.production.template .env.production
```

然后编辑 `.env.production` 文件，填入您的生产环境配置：

```env
NODE_ENV=production
LOCAL_VALIDATION=false

# Render数据库配置 - 替换为您的实际值
DB_HOST=your-render-db-host
DB_PORT=5432
DB_USER=your-render-db-user
DB_PASSWORD=your-render-db-password
DB_NAME=your-render-db-name

# Upstash Redis配置 - 替换为您的实际值
UPSTASH_REDIS_REST_URL=your-upstash-redis-url
UPSTASH_REDIS_REST_TOKEN=your-upstash-redis-token

# JWT配置
JWT_SECRET=your-production-jwt-secret
JWT_REFRESH_SECRET=your-production-jwt-refresh-secret
```

### 2. 运行初始化脚本

#### 开发环境（默认）
```bash
node scripts/init-test-users.js
```

#### 生产环境
```bash
node scripts/init-test-users.js production
```

### 3. 安全注意事项

⚠️ **重要安全提醒**：

1. **生产环境警告**：脚本会在生产环境执行前显示5秒警告
2. **权限检查**：确保您有权限在生产数据库中创建用户
3. **测试用户管理**：建议在生产环境中及时删除或禁用测试用户
4. **密码安全**：生产环境中的测试用户使用简单密码，仅用于测试

### 4. 创建的测试用户

脚本会创建以下测试用户：

| 手机号 | 用户名 | 邮箱 | 密码 |
|--------|--------|------|------|
| 13800138000 | user_8000 | 13800138000@funnypixels.com | 123456 |
| 13800138001 | user_8001 | 13800138001@funnypixels.com | 123456 |
| 13800138002 | user_8002 | 13800138002@funnypixels.com | 123456 |

### 5. 验证部署

初始化完成后，您可以使用以下方式验证：

1. **手机号+密码登录**
2. **用户名+密码登录**
3. **邮箱+密码登录**

### 6. 清理测试用户（可选）

如果需要删除测试用户，可以运行：

```sql
-- 删除测试用户（请谨慎操作）
DELETE FROM users WHERE phone IN ('13800138000', '13800138001', '13800138002');
```

## 故障排除

### 常见错误

1. **数据库连接失败**
   - 检查 `.env.production` 文件中的数据库配置
   - 确认数据库服务正在运行
   - 验证网络连接和防火墙设置

2. **权限不足**
   - 确认数据库用户有创建表和插入数据的权限
   - 检查数据库连接字符串

3. **表不存在**
   - 先运行数据库迁移：`npm run migrate`
   - 确认数据库结构完整

### 获取帮助

如果遇到问题，请检查：
1. 环境配置文件是否正确
2. 数据库连接是否正常
3. 网络连接是否稳定
