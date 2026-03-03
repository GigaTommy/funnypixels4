# 后端服务 (Backend)

基于 Node.js + Express + TypeScript 的RESTful API服务，支持WebSocket实时通信。

## 技术栈

- **Node.js** - JavaScript运行时环境
- **Express** - Web应用框架
- **TypeScript** - 类型安全的JavaScript
- **Socket.IO** - 实时双向通信
- **PostgreSQL** - 主数据库
- **Redis** - 缓存和会话存储
- **Bull Queue** - 任务队列
- **JWT** - 身份认证

## 目录结构

```
backend/
├── src/
│   ├── controllers/         # 控制器层
│   ├── models/             # 数据模型层
│   ├── routes/             # 路由定义
│   ├── middleware/         # 中间件
│   ├── services/           # 业务逻辑层
│   ├── utils/              # 工具函数
│   ├── types/              # TypeScript类型定义
│   └── config/             # 配置文件
├── tests/                  # 测试文件
├── logs/                   # 日志文件
├── package.json            # 依赖配置
├── tsconfig.json           # TypeScript配置
└── .env                    # 环境变量
```

## 开发指南

### 安装依赖
```bash
npm install
```

### 开发模式
```bash
npm run dev
```

### 生产模式
```bash
npm run build
npm start
```

## 像素历史系统

### 快速开始

1. **运行数据库迁移**：
```bash
npm run migrate
```

2. **启动像素历史系统**：
```bash
npm run pixels-history:start
```

3. **测试系统功能**：
```bash
npm run pixels-history:test
```

### 管理命令

```bash
# 启动队列处理器
npm run pixels-history:queue

# 管理分区
npm run pixels-history:manage create-partition 2025-02-01
npm run pixels-history:manage cleanup-partitions 12
npm run pixels-history:manage stats

# 数据归档
npm run pixels-history:archive archive 2024-12-01
npm run pixels-history:archive list
```

### API 接口

基础路径：`/api/pixels-history`

- `GET /user/:userId` - 获取用户像素历史
- `GET /location/:gridId` - 获取像素位置历史
- `GET /user/:userId/stats` - 获取用户行为统计
- `GET /region/stats` - 获取区域活跃度统计
- `GET /stats/overview` - 获取统计概览

详细文档请参考：[像素历史系统文档](docs/PIXELS_HISTORY_SYSTEM.md)

### 测试
```bash
npm run test
npm run test:watch
```

## API架构

### 控制器层 (controllers/)
- 处理HTTP请求和响应
- 参数验证和错误处理
- 调用服务层处理业务逻辑

### 服务层 (services/)
- 核心业务逻辑
- 数据库操作
- 外部API调用
- 缓存管理

### 模型层 (models/)
- 数据库模型定义
- 数据验证规则
- 关联关系定义

### 中间件 (middleware/)
- 身份认证
- 请求日志
- 错误处理
- CORS配置

## 主要功能模块

### 像素管理
- 像素创建、更新、删除
- 批量像素操作
- 像素历史记录
- 实时像素同步

### 用户管理
- 用户注册、登录
- 用户状态管理
- 权限控制
- 会话管理

### 地图服务
- 网格计算
- 地理编码
- 地图数据缓存
- 瓦片服务

### 实时通信
- WebSocket连接管理
- 实时数据推送
- 房间管理
- 消息广播

## 数据库设计

### PostgreSQL表结构
- `users` - 用户信息
- `pixels` - 像素数据
- `grids` - 网格信息
- `sessions` - 会话数据
- `audit_logs` - 审计日志

### Redis存储
- 用户会话
- 实时状态
- 缓存数据
- 队列任务

## 环境变量

创建 `.env` 文件：
```
NODE_ENV=development
PORT=your_server_port
DATABASE_URL=postgresql://your_db_user:your_db_password@your_db_host:your_db_port/your_db_name
REDIS_URL=redis://your_redis_host:your_redis_port
JWT_SECRET=your_jwt_secret_key
CORS_ORIGIN=your_cors_origin
```
