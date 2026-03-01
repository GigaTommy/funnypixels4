# Funnypixels Admin Console

基于 React + TypeScript + Ant Design Pro 的管理控制台前端应用。

## 功能特性

- 🔐 **用户认证**：完整的登录/登出流程，JWT Token 管理
- 👥 **用户管理**：用户列表、新增、编辑、状态切换
- 🛡️ **角色权限管理**：角色列表、权限分配、权限树管理
- 📋 **广告审批**：待审批列表、详情查看、通过/拒绝操作
- 🎨 **现代UI设计**：基于 Ant Design Pro 组件库
- 📱 **响应式布局**：支持桌面端和移动端
- 🚀 **高性能**：基于 Vite 构建，快速热更新
- 🐳 **Docker 支持**：完整的容器化部署方案

## 技术栈

- **前端框架**：React 18 + TypeScript
- **UI 组件库**：Ant Design Pro (ProComponents)
- **状态管理**：React Context + Hooks
- **路由管理**：React Router v6
- **HTTP 客户端**：Axios
- **构建工具**：Vite
- **代码规范**：ESLint + Prettier
- **容器化**：Docker + Docker Compose

## 项目结构

```
admin-frontend/
├── src/
│   ├── components/          # 通用组件
│   │   ├── Layout.tsx       # 主布局组件
│   │   └── ProtectedRoute.tsx # 路由保护组件
│   ├── contexts/           # React Context
│   │   └── AuthContext.tsx  # 认证上下文
│   ├── pages/              # 页面组件
│   │   ├── Login.tsx       # 登录页
│   │   ├── Dashboard.tsx   # 工作台
│   │   ├── user/           # 用户管理
│   │   │   └── List.tsx    # 用户列表
│   │   ├── role/           # 角色管理
│   │   │   └── List.tsx    # 角色列表
│   │   └── ad/             # 广告审批
│   │       ├── Approval.tsx # 审批列表
│   │       └── Detail.tsx  # 审批详情
│   ├── services/           # API 服务
│   │   ├── request.ts      # HTTP 请求封装
│   │   ├── auth.ts         # 认证服务
│   │   ├── user.ts         # 用户服务
│   │   ├── role.ts         # 角色服务
│   │   └── advertisement.ts # 广告服务
│   ├── styles/             # 样式文件
│   │   └── index.css       # 全局样式
│   ├── types/              # 类型定义
│   │   └── index.ts        # 通用类型
│   ├── App.tsx             # 根组件
│   ├── main.tsx            # 入口文件
│   └── vite-env.d.ts       # Vite 类型声明
├── scripts/                # 脚本文件
│   ├── start.sh            # Linux/macOS 启动脚本
│   └── start.bat           # Windows 启动脚本
├── docker-compose.yml      # 生产环境 Docker 配置
├── docker-compose.dev.yml  # 开发环境 Docker 配置
├── Dockerfile              # 生产环境镜像构建
├── Dockerfile.dev          # 开发环境镜像构建
├── nginx.conf              # Nginx 配置
└── package.json            # 项目配置
```

## 快速开始

### 环境要求

- Node.js >= 16.0.0
- npm >= 8.0.0
- Docker >= 20.0.0 (可选)
- Docker Compose >= 2.0.0 (可选)

### 本地开发

1. 安装依赖：
```bash
npm install
```

2. 启动开发服务器：
```bash
npm run dev
```

3. 访问 http://localhost:8000

### Docker 部署

#### 方式一：使用启动脚本

**Linux/macOS:**
```bash
chmod +x scripts/start.sh
./scripts/start.sh start dev    # 开发环境
./scripts/start.sh start        # 生产环境
```

**Windows:**
```cmd
scripts\start.bat start dev    # 开发环境
scripts\start.bat start        # 生产环境
```

#### 方式二：手动使用 Docker Compose

**开发环境:**
```bash
docker-compose -f docker-compose.dev.yml up --build
```

**生产环境:**
```bash
docker-compose up --build -d
```

### 常用命令

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 预览生产版本
npm run preview

# 代码检查
npm run lint

# 代码格式化
npm run lint:fix

# Docker 命令
./scripts/start.sh start dev        # 启动开发环境
./scripts/start.sh stop dev         # 停止开发环境
./scripts/start.sh logs dev         # 查看开发环境日志
./scripts/start.sh status           # 查看服务状态
./scripts/start.sh cleanup          # 清理 Docker 资源
```

## 环境变量配置

### 开发环境 (.env.development)
```env
VITE_API_BASE_URL=http://localhost:3001/api/v1/admin
VITE_APP_TITLE=Funnypixels Admin Console
```

### 生产环境 (.env.production)
```env
VITE_API_BASE_URL=/api/v1/admin
VITE_APP_TITLE=Funnypixels Admin Console
```

## API 接口

### 认证接口
- `POST /api/v1/admin/auth/login` - 用户登录
- `POST /api/v1/admin/auth/logout` - 用户登出
- `GET /api/v1/admin/auth/me` - 获取当前用户信息

### 用户管理
- `GET /api/v1/admin/users` - 获取用户列表
- `POST /api/v1/admin/users` - 创建用户
- `PUT /api/v1/admin/users/{id}` - 更新用户
- `DELETE /api/v1/admin/users/{id}` - 删除用户
- `PATCH /api/v1/admin/users/{id}/status` - 切换用户状态

### 角色管理
- `GET /api/v1/admin/roles` - 获取角色列表
- `POST /api/v1/admin/roles` - 创建角色
- `PUT /api/v1/admin/roles/{id}` - 更新角色
- `DELETE /api/v1/admin/roles/{id}` - 删除角色
- `GET /api/v1/admin/permissions/tree` - 获取权限树

### 广告审批
- `GET /api/v1/admin/ads/pending` - 获取待审批广告列表
- `GET /api/v1/admin/ads/{id}` - 获取广告详情
- `POST /api/v1/admin/ads/approve/{id}` - 通过广告审批
- `POST /api/v1/admin/ads/reject/{id}` - 拒绝广告审批

## 部署说明

### 生产环境部署

1. 修改环境变量配置
2. 构建 Docker 镜像：
```bash
docker build -t funnypixels-admin .
```

3. 启动服务：
```bash
docker-compose up -d
```

4. 验证部署：
```bash
curl http://localhost:3002
```

### 端口说明

- **8000**: 管理控制台前端
- **3001**: 后端 API 服务
- **5432**: PostgreSQL 数据库
- **6379**: Redis 缓存

## 开发指南

### 添加新页面

1. 在 `src/pages/` 下创建页面组件
2. 在 `src/App.tsx` 中添加路由配置
3. 在 `src/components/Layout.tsx` 中添加菜单项

### 添加新 API

1. 在 `src/services/` 下创建服务文件
2. 定义 TypeScript 接口类型
3. 在组件中调用 API

### 样式规范

- 使用 Ant Design 组件样式
- 全局样式放在 `src/styles/index.css`
- 组件样式使用 CSS-in-JS 或 CSS Modules

## 故障排除

### 常见问题

1. **端口冲突**
   - 检查端口是否被占用
   - 修改 docker-compose.yml 中的端口映射

2. **API 连接失败**
   - 检查后端服务是否启动
   - 确认 API 地址配置正确

3. **Docker 构建失败**
   - 检查 Docker 版本是否满足要求
   - 清理 Docker 缓存：`docker system prune -f`

### 日志查看

```bash
# 查看所有服务日志
./scripts/start.sh logs

# 查看特定服务日志
./scripts/start.sh logs admin-frontend
./scripts/start.sh logs backend
```

## 贡献指南

1. Fork 项目
2. 创建功能分支：`git checkout -b feature/new-feature`
3. 提交更改：`git commit -am 'Add new feature'`
4. 推送分支：`git push origin feature/new-feature`
5. 提交 Pull Request

## 许可证

MIT License

## 联系方式

如有问题或建议，请联系开发团队。