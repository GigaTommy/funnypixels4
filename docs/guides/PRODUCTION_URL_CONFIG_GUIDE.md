# 生产环境URL配置指南
> 更新时间: 2026-02-22
> 适用范围: 相对路径URL方案的生产环境部署

---

## 🌐 环境自动适配机制

### 核心原理

**相对路径方案会根据 `NODE_ENV` 自动切换URL生成策略**：

```javascript
// backend/src/config/urlConfig.js
if (this.isDevelopment) {
  // 开发环境：使用局域网IP
  this.baseURL = `http://${localIP}:${port}`;
} else {
  // 生产环境：使用域名
  this.baseURL = process.env.BASE_URL || 'https://api.funnypixels.com';
}
```

---

## 📊 不同环境的URL转换

### 开发环境 (NODE_ENV=development)

**环境变量配置**:
```bash
NODE_ENV=development
LOCAL_IP=192.168.1.15
PORT=3001
```

**URL转换示例**:
```
数据库存储: /uploads/materials/avatars/66/1b/avatar_test_medium.png

↓ 自动转换

API响应: http://192.168.1.15:3001/uploads/materials/avatars/66/1b/avatar_test_medium.png
```

---

### 生产环境 (NODE_ENV=production)

**环境变量配置**:
```bash
NODE_ENV=production
BASE_URL=https://api.funnypixels.com
CDN_BASE_URL=https://cdn.funnypixels.com  # 可选
```

**URL转换示例**:

#### 场景1: 使用服务器本地存储

```
数据库存储: /uploads/materials/avatars/66/1b/avatar_test_medium.png

↓ 自动转换

API响应: https://api.funnypixels.com/uploads/materials/avatars/66/1b/avatar_test_medium.png
```

#### 场景2: 使用独立CDN

```bash
# 配置独立CDN域名
CDN_BASE_URL=https://cdn.funnypixels.com
```

```
数据库存储: /uploads/materials/avatars/66/1b/avatar_test_medium.png

↓ 自动转换

API响应: https://cdn.funnypixels.com/uploads/materials/avatars/66/1b/avatar_test_medium.png
```

---

## ⚙️ 生产环境配置

### 必需环境变量

```bash
# 基础配置
NODE_ENV=production
PORT=3001

# API基础URL（必需）
BASE_URL=https://api.funnypixels.com

# 数据库配置
DB_HOST=your-db-host
DB_PORT=5432
DB_NAME=funnypixels_prod
DB_USER=postgres
DB_PASSWORD=your-secure-password

# Redis配置
REDIS_HOST=your-redis-host
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password
```

### 可选环境变量（CDN相关）

```bash
# 方案1: 使用独立CDN域名
CDN_BASE_URL=https://cdn.funnypixels.com

# 方案2: 使用云存储CDN
CDN_DOMAIN=https://your-bucket.s3.amazonaws.com

# 方案3: 不设置（使用 BASE_URL）
# 结果: https://api.funnypixels.com/uploads/...
```

---

## 🔄 URL生成流程

### 完整数据流

```
┌─────────────────────────────────────────────────────────┐
│ 1. 上传资源（Storage Layer）                             │
│    - LocalFileStorage/CDNStorage                         │
│    - 保存文件                                            │
│    - 返回相对路径: /uploads/materials/avatars/...       │
│                                                          │
│ 2. 存储到数据库                                          │
│    UPDATE users SET avatar_url = '/uploads/materials/...' │
│                                                          │
│ 3. API请求                                               │
│    GET /api/profile                                      │
│    SELECT * FROM users → avatar_url: '/uploads/...'    │
│                                                          │
│ 4. 响应拦截（Middleware）                                │
│    avatarUrlMiddleware                                   │
│    ├─ 检测环境: NODE_ENV                                 │
│    ├─ 获取 baseURL:                                      │
│    │  - 开发: http://192.168.1.15:3001                  │
│    │  - 生产: https://api.funnypixels.com               │
│    └─ 转换: /uploads/... → {baseURL}/uploads/...       │
│                                                          │
│ 5. 返回给客户端                                          │
│    {                                                     │
│      avatar_url: "https://api.funnypixels.com/uploads/..."│
│    }                                                     │
└─────────────────────────────────────────────────────────┘
```

---

## 🎯 生产环境优势

### 1. CDN迁移零成本

**场景**: 从本地存储迁移到CDN

**步骤**:
```bash
# 1. 上传文件到CDN
aws s3 sync ./public/uploads s3://your-bucket/uploads

# 2. 更新环境变量
CDN_BASE_URL=https://your-bucket.s3.amazonaws.com

# 3. 重启服务
pm2 restart funnypixels-api
```

**无需修改**:
- ✅ 数据库数据（仍然是相对路径）
- ✅ 应用代码
- ✅ API接口

---

### 2. 多区域部署支持

**场景**: 在不同地区部署多个服务器

**美国服务器**:
```bash
BASE_URL=https://us-api.funnypixels.com
CDN_BASE_URL=https://us-cdn.funnypixels.com
```

**亚洲服务器**:
```bash
BASE_URL=https://asia-api.funnypixels.com
CDN_BASE_URL=https://asia-cdn.funnypixels.com
```

**数据库共享**:
- ✅ 同一份数据库数据
- ✅ 不同区域自动使用对应的CDN URL

---

### 3. 灰度发布友好

**旧版服务器** (v1):
```bash
BASE_URL=https://api-v1.funnypixels.com
```

**新版服务器** (v2):
```bash
BASE_URL=https://api-v2.funnypixels.com
```

**数据库共享**:
- ✅ 两个版本共享数据库
- ✅ URL自动适配对应版本

---

## 📋 部署检查清单

### 部署前

- [ ] 确认 `NODE_ENV=production`
- [ ] 设置 `BASE_URL` 环境变量
- [ ] （可选）设置 `CDN_BASE_URL` 或 `CDN_DOMAIN`
- [ ] 检查数据库中的URL格式（应该是相对路径）
- [ ] 测试环境变量是否生效

### 部署后

- [ ] 验证API响应中的URL格式
- [ ] 测试资源加载（头像、旗帜、图案等）
- [ ] 检查日志中的URL Configuration输出
- [ ] 验证CDN缓存是否生效

---

## 🧪 验证方法

### 1. 检查环境配置

启动服务后，查看日志：

```
🌐 URL Configuration:
   Environment: production
   Base URL: https://api.funnypixels.com
   API Base URL: https://api.funnypixels.com/api
   CDN Base URL: https://cdn.funnypixels.com
   WebSocket URL: wss://api.funnypixels.com
   Frontend URL: https://funnypixels.com
```

### 2. 测试API响应

```bash
# 测试用户头像URL
curl https://api.funnypixels.com/api/profile | jq '.user.avatar_url'

# 预期输出
"https://api.funnypixels.com/uploads/materials/avatars/.../avatar.png"
# 或（如果配置了CDN）
"https://cdn.funnypixels.com/uploads/materials/avatars/.../avatar.png"
```

### 3. 测试图案URL

```bash
# 测试图案清单
curl https://api.funnypixels.com/api/patterns/manifest | jq '.patterns[0].image_url'

# 预期输出
"https://api.funnypixels.com/patterns/color_red.png"
```

---

## 🔒 安全建议

### 1. HTTPS配置

**生产环境必须使用HTTPS**:
```bash
BASE_URL=https://api.funnypixels.com  # ✅ 使用 https
# BASE_URL=http://api.funnypixels.com  # ❌ 不安全
```

### 2. CDN配置

**使用独立CDN域名**:
```bash
# ✅ 推荐：使用独立CDN域名
CDN_BASE_URL=https://cdn.funnypixels.com

# ⚠️ 可以但不推荐：使用API域名
CDN_BASE_URL=https://api.funnypixels.com/uploads
```

**优势**:
- ✅ 减轻API服务器负载
- ✅ 利用CDN缓存和边缘节点
- ✅ 提升资源加载速度
- ✅ 支持跨域资源共享

### 3. 环境变量保护

```bash
# ✅ 使用环境变量管理工具
# - AWS Secrets Manager
# - Google Cloud Secret Manager
# - HashiCorp Vault
# - Render/Heroku/Vercel 内置环境变量管理

# ❌ 不要在代码中硬编码
# const BASE_URL = 'https://api.funnypixels.com';  // 不要这样做
```

---

## 🚀 不同平台部署示例

### Render.com

**render.yaml**:
```yaml
services:
  - type: web
    name: funnypixels-api
    env: node
    plan: starter
    envVars:
      - key: NODE_ENV
        value: production
      - key: BASE_URL
        value: https://funnypixels-api.onrender.com
      - key: CDN_BASE_URL
        sync: false  # 从仪表板设置
```

### AWS EC2

**环境变量文件** (.env.production):
```bash
NODE_ENV=production
BASE_URL=https://api.funnypixels.com
CDN_BASE_URL=https://d1234567890.cloudfront.net
```

**启动命令**:
```bash
pm2 start ecosystem.config.js --env production
```

### Docker

**Dockerfile**:
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY . .
RUN npm ci --only=production
EXPOSE 3001
CMD ["node", "src/server.js"]
```

**docker-compose.yml**:
```yaml
version: '3.8'
services:
  api:
    build: .
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - BASE_URL=https://api.funnypixels.com
      - CDN_BASE_URL=https://cdn.funnypixels.com
```

---

## 📊 性能优化

### CDN缓存策略

**Nginx配置示例**:
```nginx
location /uploads/ {
    # CDN缓存
    proxy_cache_valid 200 30d;
    proxy_cache_valid 404 1h;

    # 浏览器缓存
    add_header Cache-Control "public, max-age=2592000";  # 30天

    # CORS
    add_header Access-Control-Allow-Origin *;
}

location /patterns/ {
    # 图案资源缓存
    proxy_cache_valid 200 30d;
    add_header Cache-Control "public, max-age=2592000";
}
```

---

## ✅ 总结

### 自动适配机制

| 环境 | baseURL来源 | URL示例 |
|------|-----------|---------|
| 开发 | 自动检测局域网IP | `http://192.168.1.15:3001` |
| 生产 | 环境变量 BASE_URL | `https://api.funnypixels.com` |
| 生产+CDN | 环境变量 CDN_BASE_URL | `https://cdn.funnypixels.com` |

### 关键优势

✅ **零代码修改**: 同一套代码适配所有环境
✅ **配置驱动**: 通过环境变量控制URL生成
✅ **向后兼容**: 支持旧的完整URL格式
✅ **灵活迁移**: CDN迁移只需修改配置
✅ **多区域支持**: 不同区域自动使用对应URL

---

## 🔗 相关文档

- [AVATAR_URL_RELATIVE_PATH_MIGRATION.md](./AVATAR_URL_RELATIVE_PATH_MIGRATION.md) - 相对路径改造方案
- [RESOURCE_URL_UNIFIED_FIX.md](./RESOURCE_URL_UNIFIED_FIX.md) - 资源URL统一处理

---

**生产环境完全自动适配，只需正确配置环境变量！** 🚀
