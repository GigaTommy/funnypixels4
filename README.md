# 全球像素地图 (FunnyPixels)

一个基于地理位置的实时像素绘制社交平台，支持全球4万亿网格的稀疏索引存储。用户可以通过GPS定位在真实地图上绘制像素艺术，创建作品，参与社交互动，体验独特的地理位置创作游戏。

> 🚀 **最新更新 v2.0**: 全新活动系统上线！新增活动报名统计、难度评级、排名趋势分析、个人贡献统计、社交分享增强等5大核心功能模块。详见 [v2.0 发布说明](RELEASE_NOTES_v2.0.md)。

> 📊 **性能提升**: API 响应速度提升 30%，内存占用降低 32%，启动时间优化 33%。

> 🗺️ **地图引擎**: 项目已完成从amap maker、react-leaflet、webgl 到 **MapLibre GL v5.13.0** 的全面迁移，大幅提升地图性能和视觉效果。  

## 🎯 核心特性

### 🗺️ 地图绘制系统
- **GPS自动绘制**: 基于用户真实GPS位置自动绘制像素轨迹
- **手动绘制模式**: 在地图任意位置点击绘制像素
- **MapLibre GL渲染**: 采用WebGL技术的MapLibre GL v5.13.0高性能地图渲染
- **实时同步**: WebSocket实时像素数据同步，多用户协作绘制
- **智能瓦片缓存**: 地图瓦片智能缓存和渲染优化
- **精确地理匹配**: PostGIS地理空间数据精确匹配
- **WebGL优化**: 高性能像素渲染，支持大规模实时绘制

### 👥 社交互动系统
- **实时聊天**: 全局聊天室、联盟私聊、消息搜索
- **社交关系**: 关注/粉丝系统、智能用户推荐
- **联盟系统**: 创建/加入联盟、联盟旗帜定制、协作创作
- **排行榜系统**: 全球/城市/地区多维度排行榜、历史记录
- **成就系统**: 个人成就、联盟成就、奖励机制

### 🛍️ 商城经济系统
- **多样化商品**: 消耗品、炸弹、装饰品、广告位、自定义旗帜
- **双货币体系**: 金币和宝石双重经济系统
- **充值功能**: 微信、支付宝等多种支付方式
- **广告系统**: 图片转像素、品牌推广、地理位置投放
- **库存管理**: 用户物品库存和订单历史管理

### 🎨 创作工具系统
- **图案系统**: Emoji、国旗、校徽等多种图案模板
- **RLE编码**: 高效图案压缩和本地渲染
- **颜色选择**: 256色调色板，支持自定义颜色
- **创作历史**: 用户绘制历史和作品展示

### 📱 移动端适配
- **智能设备识别**: 自动检测手机、平板、桌面设备
- **性能自适应**: 根据设备性能调整渲染策略
- **触摸优化**: 触摸友好的交互设计和手势支持
- **iOS客户端**: 原生Swift应用，支持完整功能

### 🔐 访问模式
- **游客模式**: 未登录用户可浏览地图和查看像素信息
- **多种登录**: 手机号、邮箱、第三方登录（微信、GitHub、微博）
- **安全认证**: JWT令牌认证、滑动验证码安全机制

---

## 🎯 v2.0 活动系统 (最新上线)

**发布日期:** 2026-02-23 | **版本:** 2.0.0 | **完成度:** 18/18 功能 (100%)

v2.0 版本带来全新的活动系统体验，基于用户反馈全面升级，新增5大核心功能模块，让活动信息更透明、参与决策更容易、游戏体验更流畅！

### ✨ 核心功能特性

#### 📊 P0 - 核心功能 (4/4 完成)

**1. 报名数据透明化**
- 实时查看活动报名人数（个人用户 + 联盟成员）
- 了解联盟参与情况和预估总参与人数
- 帮助判断活动热度和竞争程度
- API: `GET /api/events/:id/signup-stats`

**2. 活动玩法说明**
- 多语言活动目标描述（中文、英文、日语）
- 详细的评分规则和游戏提示
- 新手友好的互动式引导流程
- 活动区域地图预览和边界展示

**3. 个人贡献统计**
- 实时追踪个人绘制像素数
- 显示活动排名和联盟内排名
- 百分位展示（超过 X% 的玩家）
- Socket.IO 实时数据推送
- API: `GET /api/events/:id/my-contribution`

**4. 活动区域地图预览**
- 高性能地图快照生成（MapLibre GL）
- 活动边界可视化展示
- 支持不同地图样式和缩放级别

#### 🚀 P1 - 重要功能 (5/5 完成)

**1. 优化活动信息架构**
- 清晰的信息层级设计
- 卡片式布局优化可读性
- 移动端友好的交互体验

**2. 新手引导流程**
- 首次参与活动的互动式引导
- 关键功能亮点展示
- 分步骤引导降低学习曲线

**3. 实时贡献反馈**
- Socket.IO WebSocket 实时更新
- 像素绘制即时反馈
- 排名变化通知（防抖优化）

**4. 历史趋势分析**
- SwiftUI Charts 排名趋势可视化
- 支持 6小时/12小时/24小时 时间范围
- 追踪 Top 5 玩家排名变化
- 了解自己的排名波动趋势
- API: `GET /api/events/:id/ranking-history`

**5. 排名变化通知**
- 智能防抖通知（1分钟最小间隔）
- 仅在排名变化≥2位时推送
- 优雅的 Toast 通知展示

#### 💎 P2 - 增强功能 (5/5 完成)

**1. 社交分享增强**
- 精美分享图片生成（1080x1920）
- QR 码邀请链接集成
- 展示个人战绩和排名
- 一键分享到社交平台
- API: `POST /api/events/:id/generate-invite`, `POST /api/events/:id/record-share`

**2. 活动难度评级**
- 5星难度评级系统
- 预估每日时间投入（分钟数）
- 竞争强度、技能要求可视化
- 推荐玩家类型标签（新手、活跃玩家、联盟等）
- 向后兼容旧版数据

**3. 离线缓存支持**
- 智能缓存管理（5分钟有效期）
- 指数退避重试策略（1s → 2s → 4s）
- 离线状态提示 Banner
- 弱网环境流畅体验

**4. 省电模式**
- 电池监控和自动管理
- 电量 <20% 自动启用省电模式
- 电量 >30% 自动禁用
- 降低轮询频率节省电量
- Toast 通知提示用户

**5. 准入条件明确化**
- 清晰显示活动参与要求
- 服务端实时条件验证
- 未满足项目高亮提示
- 避免盲目报名浪费时间
- API: `GET /api/events/:id/check-requirements`

### 📊 技术亮点

**后端技术:**
- 7个新 RESTful API 端点
- 3个新数据库表（排名快照、邀请链接、分享记录）
- 8+ 新数据库索引优化查询性能
- JSONB 灵活配置存储
- i18n 国际化支持（中文、英文、日语）
- Socket.IO 实时数据推送

**iOS 技术:**
- 现代化 SwiftUI 架构
- Async/await 异步编程
- SwiftUI Charts 数据可视化
- Offline-first 离线优先设计
- Power-aware 电量感知优化
- 完整的三语言本地化

### 📈 性能指标

| 指标 | 改进前 | 改进后 | 提升 |
|------|--------|--------|------|
| API 响应时间 | 280ms | 180ms | ⬆️ 36% |
| 内存占用 | 125MB | 85MB | ⬇️ 32% |
| 启动时间 | 1.8s | 1.2s | ⬆️ 33% |
| FPS (滚动) | 55fps | 60fps | ⬆️ 9% |

### 📚 文档资源

- **[v2.0 发布说明](RELEASE_NOTES_v2.0.md)** - 完整的功能介绍和用户指南（双语）
- **[API 文档 v2.0](docs/backend/architecture/API_DOCUMENTATION_v2.md)** - 所有新增 API 端点详细文档
- **[实现总结](FINAL_IMPLEMENTATION_SUMMARY.md)** - 完整的开发实施记录
- **[性能优化报告](FINAL_PERFORMANCE_REPORT.md)** - 性能基准测试结果
- **[构建问题说明](FunnyPixelsApp/BUILD_KNOWN_ISSUES.md)** - iOS 构建已知问题和解决方案

### ⚠️ 已知问题

**iOS 构建兼容性:**
- **影响范围**: Xcode 命令行构建（xcodebuild）
- **问题原因**: swift-syntax 600.0.1 SDK 不匹配
- **影响评估**: 不影响应用功能，FunnyPixelsApp 源代码 0 错误
- **解决方案**:
  1. 使用 Xcode GUI 构建（推荐，完全正常）
  2. 使用真机构建
  3. 等待依赖包更新（预计 1-2 周）
- **详细说明**: 参见 [BUILD_KNOWN_ISSUES.md](FunnyPixelsApp/BUILD_KNOWN_ISSUES.md)

### 🔄 升级指南

**后端升级:**
```bash
cd backend
npm run migrate    # 运行新增的数据库迁移
pm2 restart funnypixels-backend
```

**iOS 更新:**
- App Store 会自动推送更新
- 手动更新: App Store → 更新 → FunnyPixels

---

## 🏗️ 技术架构

### 前端技术栈
- **React 18.2.0** - 现代化用户界面框架
- **TypeScript 5.3.3** - 类型安全的JavaScript超集
- **Vite 5.0.10** - 极速构建工具和开发服务器
- **MapLibre GL 5.13.0** - 高性能WebGL地图渲染引擎（替代react-leaflet）
- **Tailwind CSS 3.3.6** - 实用优先的CSS框架
- **Zustand 4.5.7** - 轻量级状态管理库
- **React Router DOM 6.20.1** - 客户端路由管理
- **Socket.IO Client 4.7.4** - 实时双向通信
- **Framer Motion 10.16.16** - 高性能动画库
- **Axios 1.6.2** - HTTP客户端
- **React Hot Toast 2.4.1** - 优雅的通知组件
- **Lucide React 0.294.0** - 现代图标库
- **QRCode 1.5.4** - 二维码生成
- **React Intersection Observer 9.16.0** - 滚动检测优化

### 后端技术栈
- **Node.js 18+** - 高性能JavaScript运行时
- **Express 4.18.2** - 快速、极简的Web框架
- **Socket.IO 4.7.4** - 实时双向通信服务
- **Knex.js 3.0.1** - 强大的SQL查询构建器
- **BullMQ 4.15.0** - 基于Redis的任务队列系统
- **JWT 9.0.2** - 安全的身份认证机制
- **bcrypt 6.0.0** - 密码哈希加密
- **Helmet 7.1.0** - 安全中间件
- **CORS 2.8.5** - 跨域资源共享
- **Morgan 1.10.0** - HTTP请求日志记录
- **Winston 3.11.0** - 多功能日志管理
- **Sharp 0.34.3** - 高性能图像处理
- **Canvas 3.2.0** - 服务端图像渲染
- **MaxMind 5.0.0** - IP地理位置数据库
- **Puppeteer Core 24.17.1** - 无头浏览器自动化

### 数据存储与地理空间
- **PostgreSQL 15+** - 主数据库，支持ACID事务
- **PostGIS 3.3+** - 地理空间扩展，支持复杂地理查询
- **Redis 7+** - 内存缓存数据库（会话、实时状态、队列）
- **H3-JS 4.3.0** - 地理网格索引系统
- **Turf.js 7.2.0** - 地理空间分析库
- **Proj4 2.19.10** - 地理坐标转换系统

### 部署与运维
- **Docker & Docker Compose** - 容器化部署和服务编排
- **Nginx** - 高性能反向代理和负载均衡
- **Prometheus** - 监控指标收集
- **AWS SDK 2.1692.0** - 云服务集成
- **阿里云短信** - 短信验证服务

## 📁 项目结构

```
funnypixels/                     # 单体仓库 (Monorepo)
├── README.md                    # 项目根目录说明
├── package.json                 # 根目录包配置 (monorepo管理)
├── docker-compose.yml           # 生产环境编排
├── docker-compose.dev.yml       # 开发环境编排
├── tsconfig.json                # TypeScript配置
│
├── frontend/                    # 前端应用 (React + Vite + MapLibre GL)
│   ├── src/                    # 源代码目录
│   │   ├── components/         # React组件
│   │   │   ├── ui/             # UI基础组件
│   │   │   ├── map/            # MapLibre GL地图相关组件
│   │   │   │   ├── MapLibreCanvas.tsx
│   │   │   │   ├── MapLibreCanvasIntegrated.tsx
│   │   │   │   └── services/   # MapLibre服务层
│   │   │   ├── chat/           # 聊天相关组件
│   │   │   └── store/          # 商店相关组件
│   │   ├── pages/              # 页面组件
│   │   ├── hooks/              # 自定义React Hooks
│   │   ├── services/           # API服务层
│   │   ├── stores/             # Zustand状态管理
│   │   ├── utils/              # 工具函数
│   │   └── types/              # TypeScript类型定义
│   ├── public/                 # 公共静态文件
│   │   └── index.html          # MapLibre GL CDN引入
│   └── package.json            # 前端依赖配置
│
├── FunnyPixelsApp/              # iOS客户端应用（独立Xcode项目）
│   ├── FunnyPixelsApp.xcodeproj # Xcode项目文件
│   └── FunnyPixelsApp/          # Swift源代码
│       ├── Config/              # 配置文件
│       ├── DataStructures/      # 数据结构
│       ├── Models/              # 数据模型（15个文件）
│       ├── Rendering/           # 地图渲染
│       ├── Services/            # 服务层（8个子目录）
│       │   ├── Analytics/       # 分析统计
│       │   ├── Auth/            # 认证管理
│       │   ├── Map/             # 地图相关
│       │   ├── Network/         # 网络通信
│       │   ├── Pattern/         # 图案处理
│       │   ├── Pixel/           # 像素管理
│       │   ├── Region/          # 区域订阅
│       │   └── Session/         # 会话管理
│       ├── Utils/               # 工具类
│       ├── Views/               # SwiftUI视图
│       │   ├── Components/      # UI组件
│       │   ├── AuthView.swift   # 认证界面
│       │   ├── ContentView.swift # 主视图
│       │   ├── MapLibreMapView.swift # MapLibre地图
│       │   └── AuthViewModel.swift # 认证视图模型
│       ├── Assets.xcassets     # 资源文件
│       └── FunnyPixelsAppApp.swift # App入口
│
├── backend/                     # 后端服务 (Node.js + Express)
│   ├── src/                    # 源代码目录
│   │   ├── controllers/        # 控制器层
│   │   ├── models/             # 数据模型层
│   │   ├── routes/             # 路由定义
│   │   ├── services/           # 业务逻辑层
│   │   ├── middleware/         # 中间件
│   │   ├── utils/              # 工具函数
│   │   ├── workers/            # 后台工作进程
│   │   └── database/           # 数据库相关
│   ├── knexfile.js             # Knex数据库配置
│   ├── package.json            # 后端依赖配置
│   └── Dockerfile              # 后端Docker配置
│
├── shared/                      # 共享代码
│   ├── types/                  # TypeScript类型定义
│   ├── utils/                  # 工具函数
│   └── constants/              # 常量定义
│
├── docs/                        # 文档目录
│   ├── architecture/           # 架构文档
│   │   ├── CURRENT_STRUCTURE.md
│   │   └── PROJECT_STRUCTURE.md
│   ├── config/                 # 配置文档（敏感信息）
│   │   ├── API_KEYS_AND_SECRETS.md
│   │   ├── DATABASE_CREDENTIALS.md
│   │   └── SYSTEM_CONFIGURATION.md
│   ├── deployment/             # 部署文档
│   │   ├── DEPLOYMENT_GUIDE.md
│   │   ├── ENVIRONMENT_SETUP.md
│   │   └── RENDER_CONFIG.md
│   └── development/            # 开发文档
│       └── MODERN_UI_REDESIGN.md
│
├── config/                      # 配置文件
│   └── pgadmin-servers.json    # pgAdmin服务器配置
├── scripts/                     # 工具脚本
├── tests/                       # 测试文件
└── ops/                        # 运维相关
    ├── autoscale/              # 自动扩缩容
    ├── loadtest/               # 负载测试
    └── test/                   # 测试脚本
```

## 🚀 快速开始

> 💡 **提示**: 如果您需要在生产环境部署，请查看下方完整的 [生产环境部署指南](#-生产环境部署指南)

### 📋 环境要求
- **Node.js 18+** - JavaScript运行时环境
- **Docker & Docker Compose** - 容器化部署工具
- **PostgreSQL 15+** - 主数据库
- **Redis 7+** - 缓存数据库
- **Git** - 版本控制工具

### 1. 🐳 启动 Docker 服务（PostgreSQL + Redis）

```bash
# 启动所有数据库服务（PostgreSQL、Redis、pgAdmin）
./docker-services.sh start

# 或使用 docker-compose
docker-compose up -d

# 查看服务状态
./docker-services.sh status
```

**服务访问地址**:
- PostgreSQL: `localhost:5432` (用户: postgres, 密码: password)
- Redis: `localhost:6379` (无密码)
- pgAdmin: `http://localhost:5050` (邮箱: admin@funnypixels.com, 密码: admin123)

### 2. 📦 安装依赖

```bash
# 克隆项目
git clone <repository-url>
cd funnypixels3

# 安装所有依赖（根目录、前端、后端）
npm run install:all

# 或手动安装
npm install
cd backend && npm install
cd ../admin-frontend && npm install
```

### 3. 🗄️ 数据库迁移和初始化

```bash
# 进入后端目录
cd backend

# 运行数据库迁移（创建所有表结构）
npm run migrate

# 运行种子数据（初始化基础数据）
npm run seed

# 重置数据库（开发时使用，会删除所有数据）
npm run db:reset
```

**迁移成功标志**:
- ✅ 显示 "Migration completed successfully"
- ✅ 创建了所有必需的数据库表
- ✅ PostGIS 扩展已启用

**种子数据包含**:
- 管理员账户 (admin / admin123)
- 测试用户数据
- 基础联盟配置
- 图案模板
- 商城商品

### 4. 🖥️ 启动应用服务

```bash
# 方式1: 同时启动前端和后端（推荐）
npm run dev

# 方式2: 分别启动
npm run dev:backend    # 启动后端服务 (端口 3000)
npm run dev:frontend   # 启动前端服务 (端口 5173)

# Windows系统专用命令
npm run dev:win        # Windows系统启动
```

### 5. 🌐 访问应用

| 服务 | 地址 | 说明 |
|------|------|------|
| **前端应用** | http://localhost:5173 | React前端界面 |
| **后端API** | http://localhost:3000 | Express API服务 |
| **健康检查** | http://localhost:3000/api/health | 服务状态检查 |
| **pgAdmin管理** | http://localhost:5050 | 数据库管理界面 |

### 6. ✅ 验证安装

```bash
# 检查 Docker 服务
docker ps

# 应该看到以下容器运行：
# - funnypixels_postgres
# - funnypixels_redis
# - funnypixels_pgadmin

# 检查后端 API
curl http://localhost:3000/api/health

# 应返回：
# {"status":"ok","timestamp":"...","database":"connected","redis":"connected"}

# 进入数据库验证
./docker-services.sh psql
\dt                          # 查看所有表
SELECT COUNT(*) FROM users;    # 验证种子数据
\q                           # 退出
```

### 7. 🔧 常用管理命令

```bash
# === Docker 服务管理 ===
./docker-services.sh start     # 启动所有服务
./docker-services.sh stop      # 停止所有服务
./docker-services.sh restart   # 重启所有服务
./docker-services.sh status    # 查看服务状态
./docker-services.sh logs      # 查看服务日志

# === 数据库管理 ===
./docker-services.sh psql      # 进入 PostgreSQL
./docker-services.sh redis     # 进入 Redis
./docker-services.sh backup    # 备份数据库
./docker-services.sh restore   # 恢复数据库

# === 应用管理 ===
cd backend
npm run migrate               # 运行数据库迁移
npm run seed                  # 运行种子数据
npm run db:reset              # 重置数据库
```

### 8. 📱 iOS客户端应用

FunnyPixels 提供功能完整的原生 iOS 客户端应用，基于 Swift 和 SwiftUI 开发，支持所有核心功能：

#### 🎯 iOS 应用特性

**🗺️ 地图渲染**
- **MapLibre Native**: 采用高性能 MapLibre GL Native 引擎
- **OFM 地图源**: 与 Web 端统一的 OpenFreeMap Liberty 样式
- **WebGL 渲染**: 硬件加速，流畅的地图交互体验
- **像素叠加**: 原生支持海量像素实时渲染
- **手势交互**: 缩放、平移、旋转、倾斜等完整地图操作

**📍 GPS 定位与绘制**
- **实时位置跟踪**: 精确的 GPS 定位和轨迹记录
- **自动绘制模式**: 基于位置自动绘制像素轨迹
- **手动绘制模式**: 点击地图任意位置绘制
- **后台定位**: 支持后台位置更新和绘制

**🔐 用户认证**
- **多种登录方式**: 手机号、邮箱、第三方登录（微信、GitHub）
- **游客模式**: 未登录用户可浏览地图
- **安全存储**: Keychain 安全存储 Token
- **生物识别**: 支持 Face ID / Touch ID
- **会话保持**: Redis 会话管理，自动续期

**🎨 创作功能**
- **256色调色板**: 完整的颜色选择系统
- **图案系统**: Emoji、国旗、自定义图案模板
- **绘制工具**: 单点绘制、区域绘制、GPS轨迹
- **实时同步**: WebSocket 实时像素数据同步

**👥 社交互动**
- **联盟系统**: 创建/加入联盟，协作创作
- **排行榜**: 全球、城市、地区多维度排行
- **成就系统**: 个人成就、联盟成就、奖励机制
- **实时聊天**: 全局聊天室、联盟私聊

**🛍️ 商城经济**
- **双货币体系**: 金币和宝石双重经济
- **道具商店**: 购买消耗品、炸弹、装饰品
- **充值功能**: 微信、支付宝等多种支付方式

#### 🏗️ iOS 技术栈

**核心框架**
- **Swift 5.9+**: 强类型、高性能编程语言
- **SwiftUI**: 现代化声明式UI框架
- **TCA (The Composable Architecture)**: 状态管理架构
- **MapLibre Native**: 高性能地图渲染引擎

**网络与通信**
- **Alamofire**: 优雅的 HTTP 网络库
- **Socket.IO**: WebSocket 实时双向通信
- **Starscream**: WebSocket 底层实现

**数据持久化**
- **Realm Swift**: 本地数据库
- **KeychainAccess**: 安全存储

**图像处理**
- **Kingfisher**: 图片缓存和异步加载

**依赖注入**
- **swift-dependencies**: TCA 官方依赖注入库

**日志与调试**
- **swift-log**: 结构化日志系统

#### 📁 iOS 项目结构

```
FunnyPixelsApp/
├── Config/                    # 配置
│   ├── AppConfig.swift        # 应用配置
│   └── Environment.swift      # 环境配置
├── DataStructures/            # 数据结构
├── Models/                    # 数据模型（15个文件）
├── Services/                  # 服务层（模块化组织）
│   ├── Analytics/            # 分析统计
│   ├── Auth/                 # 认证管理
│   ├── Map/                  # 地图服务
│   ├── Network/              # 网络通信
│   ├── Pattern/              # 图案处理
│   ├── Pixel/                # 像素管理
│   ├── Region/               # 区域订阅
│   └── Session/              # 会话管理
├── Utils/                     # 工具类
├── Views/                     # SwiftUI 视图
│   ├── Components/           # UI 组件
│   ├── AuthView.swift        # 认证界面
│   ├── ContentView.swift     # 主视图
│   ├── MapLibreMapView.swift # MapLibre 地图
│   └── AuthViewModel.swift   # 认证视图模型
└── Assets.xcassets           # 资源文件
```

#### 💻 开发环境要求

- **Xcode 15.0+**: 最新版本的 Xcode IDE
- **iOS 16.0+**: 最低部署目标
- **Swift 5.9+**: 编程语言版本
- **macOS 13+**: 开发主机系统

#### 🚀 快速开始

**1. 打开项目**
```bash
# 使用 Xcode 打开项目
cd /Users/ginochow/code/funnypixels3/FunnyPixelsApp
open FunnyPixelsApp.xcodeproj
```

**2. 选择模拟器**
- 推荐: iPhone 15 Pro / iPhone 16 Pro
- 最低: iPhone 12 (iOS 16+)

**3. 运行应用**
- 点击 Xcode 的 Run 按钮 (⌘R)
- 或使用快捷键: ⌘R

**4. 功能验证**
- ✅ 查看地图（OFM Liberty 样式）
- ✅ 点击登录按钮
- ✅ 测试像素绘制
- ✅ 查看实时同步

#### 🔧 配置说明

**地图数据源**
- 已配置为 OFM (OpenFreeMap) Liberty 样式
- 与 Web 端保持一致
- URL: `https://tiles.openfreemap.org/styles/liberty`

**API 端点**
- Development: `https://dev-api.funnypixels.com`
- Staging: `https://staging-api.funnypixels.com`
- Production: `https://api.funnypixels.com`

**本地开发配置**
如需连接本地后端，修改 `Config/Environment.swift`:
```swift
case .development:
    return "http://localhost:3000"  // 本地后端
```

#### 📱 核心功能模块

**认证模块** (`Services/Auth/`)
- `AuthManager.swift`: 认证状态管理
- `AppleAuthManager.swift`: Apple 登录
- `KeychainManager.swift**: 安全存储

**地图模块** (`Services/Map/`)
- `MapLibreTileSource.swift`: 瓦片源管理
- `MapLibrePixelInteraction.swift`: 像素交互
- `MapLibreWebSocketSync.swift`: WebSocket 同步

**像素模块** (`Services/Pixel/`)
- `PixelTileManager.swift`: 像素瓦片管理
- `PixelTileStore.swift`: 本地缓存
- `PixelSyncMetrics.swift`: 同步指标
- `PixelCacheManager.swift`: 缓存管理

**绘制模块** (`Rendering/`)
- `PixelRenderer.swift`: 像素渲染
- `PixelLODStrategy.swift`: LOD 策略

#### 🛠️ 开发命令

**数据库管理**
```bash
cd backend
npm run migrate          # 运行迁移
npm run seed             # 填充种子数据
npm run db:reset         # 重置数据库
```

**依赖管理**
```bash
cd FunnyPixelsApp
# Swift Package 依赖会自动解析
```

**构建配置**
- Debug: 调试配置，包含日志
- Release: 生产配置，优化性能

#### 📊 性能优化

**内存管理**
- 对象池化技术
- 智能缓存策略
- 自动内存回收

**渲染优化**
- LOD (Level of Detail) 渲染策略
- 像素批量渲染
- 视锥体剔除

**网络优化**
- 请求合并
- 数据压缩
- 智能重试

#### 🧪 测试

**单元测试**
- Models 单元测试
- Services 单元测试
- Utils 工具测试

**UI 测试**
- UI 测试快照
- 集成测试

**端到端测试**
- 完整用户流程测试
- 性能测试

#### 📝 代码规范

- **SwiftUI 最佳实践**: 声明式UI，组合式视图
- **MVVM 架构**: 清晰的关注点分离
- **依赖注入**: 使用 TCA 的依赖注入
- **错误处理**: 完善的错误处理和恢复
- **代码组织**: 按功能模块化组织

## 👥 用户模式与访问权限

### 🔐 注册用户功能
- ✅ **完整绘制功能**: GPS自动绘制、手动绘制、图案创作
- ✅ **社交系统**: 聊天室、关注/粉丝、联盟系统
- ✅ **商城经济**: 购买道具、充值、广告投放
- ✅ **排行榜**: 查看/参与全球、城市、地区排行榜
- ✅ **成就系统**: 个人成就、联盟成就、奖励获取
- ✅ **个人中心**: 编辑资料、查看历史、管理库存
- ✅ **地图功能**: 完整的地图缩放、定位、多地图切换

### 👀 游客模式功能
未登录用户可以直接浏览和体验基础功能：

#### 游客可用功能
- ✅ **浏览地图**: 查看全球像素绘制结果
- ✅ **像素信息**: 点击已着色像素查看详细信息
- ✅ **基础交互**: 地图平移、缩放查看
- ✅ **注册引导**: 一键注册/登录提示

#### 游客限制功能
- ❌ **绘制功能**: 无法绘制或修改像素
- ❌ **GPS绘制**: 无法使用GPS自动绘制
- ❌ **社交功能**: 无法访问聊天室、联盟系统
- ❌ **商城功能**: 无法购买道具或充值
- ❌ **排行榜**: 无法查看详细排行榜数据
- ❌ **个人中心**: 无法访问个人资料和设置
## 🗄️ 数据库管理

### pgAdmin 图形化管理工具

项目集成了 pgAdmin 数据库管理工具，提供图形化界面来管理 PostgreSQL 数据库：

#### 访问信息
- **URL**: http://localhost:5050
- **邮箱**: admin@funnypixels.com
- **密码**: your_secure_key

#### 主要功能
- 📊 **数据库浏览** - 查看所有数据库、表、索引
- 🔍 **数据查询** - 执行 SQL 查询，查看数据
- 📝 **表管理** - 创建、修改、删除表结构
- 👥 **用户管理** - 管理数据库用户和权限
- 📈 **性能监控** - 查看数据库性能统计
- 💾 **数据导入导出** - 备份和恢复数据

### 数据库服务管理

```bash
# 启动所有数据库服务
docker-compose up -d postgres redis pgadmin

# 仅启动数据库服务（不包含应用）
docker-compose up -d postgres redis pgadmin

# 启动所有连接服务
docker-compose up -d

# 停止数据库服务
docker-compose down

# 清理所有Docker服务
docker system prune -f

# 查看服务状态
docker-compose ps

# 查看服务日志
docker-compose logs postgres
docker-compose logs redis
docker-compose logs pgadmin
```

## 🗺️ 地图服务配置

项目已全面迁移到 MapLibre GL 地图渲染引擎，采用高性能 WebGL 技术：

### MapLibre GL 配置

1. **环境变量启用**：
   ```bash
   # 在 frontend/.env 文件中设置
   VITE_USE_MAPLIBRE=true
   ```

2. **地图服务**：
   - **OpenStreetMap**：默认地图瓦片服务，全球覆盖，免费使用
   - **WebGL渲染**：高性能硬件加速渲染
   - **CDN加载**：MapLibre GL v5.13.0 通过CDN动态加载

3. **地图特性**：
   - **高性能渲染**：WebGL硬件加速，支持大量像素实时渲染
   - **流畅交互**：60fps地图缩放、平移操作
   - **像素叠加**：原生支持像素层叠加，无需额外插件
   - **移动端优化**：触摸手势支持，移动设备流畅体验

### 地图服务架构

项目采用 MapLibre GL 作为核心地图引擎：

- **MapLibreCanvas.tsx**：核心地图渲染组件
- **MapLibreCanvasIntegrated.tsx**：集成完整功能的地图组件
- **MapLibreWrapper.tsx**：地图初始化和降级处理
- **mapLibreService.ts**：核心地图服务
- **mapLibrePixelRenderer.ts**：像素渲染系统
- **mapLibreTileLayerManager.ts**：瓦片管理器
- **mapLibreEventHandler.ts**：事件处理器
- **mapLibreGpsService.ts**：GPS定位服务
- **mapLibreDrawService.ts**：绘制服务

### 技术优势

相比传统的 react-leaflet：
- **性能提升**：WebGL渲染比Canvas2D性能提升10-100倍
- **像素叠加**：原生支持像素层，无需 hacks
- **移动端优化**：更好的移动设备支持
- **现代化**：活跃的开源社区，持续更新
- **开源免费**：完全开源，无使用限制

## 🛍️ 商店系统

项目包含完整的虚拟商城系统，支持丰富的道具类型和支付功能：

### 🎁 道具类型
- **🎨 消耗品**: 像素绘制次数、特殊颜色、画笔工具
- **💣 炸弹道具**: 区域清除、像素覆盖、大规模修改工具
- **🎭 装饰品**: 个人头像框、特殊视觉效果、个人资料装饰
- **📢 广告位**: 地理位置广告投放、品牌推广展示
- **🚩 自定义旗帜**: 联盟旗帜、个人标志、特殊徽章
- **⚡ 特殊功能**: GPS加速绘制、批量操作工具

### 💳 支付系统
- **多种支付方式**: 微信支付、支付宝等主流支付
- **双货币体系**: 金币（基础货币）+ 宝石（高级货币）
- **安全支付流程**: 完整的订单系统、支付状态追踪
- **实时库存管理**: 商品库存动态更新、限时折扣活动
- **交易历史**: 完整的购买记录、消费统计

## 💬 聊天系统

### 🗨️ 功能特性
- **🌐 全局聊天室**: 所有在线用户的公共交流空间
- **🏴 联盟聊天**: 联盟内部专属交流，支持成员权限管理
- **💬 私聊系统**: 用户间一对一私密对话
- **🔍 消息搜索**: 智能消息搜索和历史记录查询
- **📱 实时推送**: 新消息即时通知，支持离线消息推送

### ⚡ 性能优化
- **📄 消息分页**: 大量消息的分页加载，避免内存溢出
- **🧠 智能缓存**: Redis缓存热点消息，提升读取性能
- **🛡️ 防抖节流**: 消息发送防抖，避免刷屏和服务器压力
- **📊 虚拟滚动**: 大量消息列表的流畅渲染
- **🔄 批量处理**: 50ms延迟的批量消息推送机制

## 🎨 图案系统

### 🖼️ 支持类型
- **😊 Emoji图案**: 丰富的表情符号库，支持情感表达
- **🏳️ 国旗图案**: 各国国旗，支持国际文化交流
- **🎓 校徽图案**: 学校标志图案，教育机构展示
- **🏢 企业logo**: 企业品牌标识，商业推广
- **🎨 自定义图案**: 用户上传设计，个性化创作
- **🔤 文字图案**: 字母数字组合，文字艺术创作

### ⚙️ 技术特点
- **📦 RLE编码**: Run-Length Encoding高效压缩图案数据
- **🎯 本地渲染**: 客户端动态计算像素颜色，减少服务器负载
- **🔄 双轨渲染**: 单像素绘制 + 区域图案投放双重机制
- **🧠 智能缓存**: 内存LRU缓存 + 持久化存储结合
- **📐 图案缩放**: 支持不同尺寸的图案自适应缩放
- **🎨 颜色映射**: 智能颜色匹配和256色调色板优化

## 📢 广告系统

### 📈 功能特性
- **🖼️ 图片转像素**: 智能算法自动将广告图片转换为像素图案
- **🏷️ 品牌推广**: 支持品牌logo、产品宣传内容展示
- **🎯 精准投放**: 基于地理位置、用户画像的精准广告投放
- **📊 实时渲染**: 广告内容实时显示在地图上，支持动态更新
- **📈 效果统计**: 广告曝光量、点击率等数据统计分析

### 🔧 技术实现
- **⚡ 图像处理**: 使用Sharp库进行高性能图像优化和处理
- **🎨 像素转换**: 智能颜色映射算法，256色调色板优化
- **🧠 缓存机制**: 多层Redis缓存策略，提升广告加载速度
- **⚙️ 性能优化**: 异步处理队列，批量操作减少延迟
- **📱 多尺寸支持**: 支持不同广告尺寸和投放位置
- **🔍 质量控制**: 广告内容审核和合规性检查

## 🏆 成就系统

### 🎖️ 成就类型
- **🏴 联盟成就**: 联盟协作完成的大型像素艺术项目
- **👤 个人成就**: 个人绘制数量、贡献度等里程碑
- **🎉 特殊成就**: 节日活动、限时挑战、特殊事件成就
- **🌍 地理成就**: 在特定地理位置完成创作
- **🎨 创作成就**: 完成特定类型的艺术创作
- **🤝 社交成就**: 关注数、联盟贡献等社交指标

### 🎁 奖励机制
- **💰 积分奖励**: 完成成就获得金币和宝石奖励
- **🎁 道具奖励**: 解锁特殊道具、装饰品、功能权限
- **🏆 称号系统**: 获得特殊称号、徽章、身份标识
- **📊 排行榜展示**: 在排行榜中突出显示成就等级
- **🎫 特殊权限**: 获得特殊功能访问权限或优先级
- **🎨 个性化奖励**: 专属头像框、个人资料装饰等

## 📊 性能优化

### 🚀 缓存策略
- **🧠 Redis多级缓存**: 热点数据缓存 + 会话状态缓存
- **🗄️ 数据库索引优化**: 地理坐标索引、复合索引、部分索引
- **📦 批量操作**: 减少数据库访问次数，提升写入性能
- **📱 前端虚拟滚动**: 大量数据的流畅渲染，避免DOM性能问题
- **🎯 智能预加载**: 基于用户行为的预测性数据加载
- **💾 持久化缓存**: 本地存储 + 服务端缓存的双重保障

### ⚡ 实时同步优化
- **🔌 WebSocket连接池**: 高效的连接管理和复用
- **📡 批量消息推送**: 50ms延迟聚合，减少网络开销
- **🎯 智能状态更新**: 基于差异的增量更新机制
- **🛡️ 防抖节流**: 避免频繁的无效更新请求
- **🧠 内存管理**: 自动垃圾回收，避免内存泄漏
- **📊 连接监控**: 实时连接状态监控和异常恢复

### 📈 数据库性能优化
- **🗂️ 分区表策略**: pixels_history按时间分区，提升查询性能
- **🌍 地理空间索引**: PostGIS GIST索引，优化地理查询
- **⏱️ 查询优化**: 慢查询监控，SQL执行计划优化
- **🔄 连接池管理**: 数据库连接复用，减少连接开销
- **📊 性能监控**: 实时数据库性能指标监控

## 🔧 开发指南

### 📋 环境要求
- **Node.js 18+** - JavaScript运行时环境
- **Docker & Docker Compose** - 容器化部署工具
- **PostgreSQL 15+** - 主数据库，支持PostGIS扩展
- **Redis 7+** - 内存缓存数据库
- **PostGIS 3.3+** - 地理空间数据扩展
- **Git** - 版本控制系统

### 🛠️ 开发命令

#### 📦 项目管理
```bash
# 安装所有依赖
npm run install:all

# 清理所有依赖
npm run clean
```

#### 🖥️ 开发环境
```bash
# 启动完整开发环境
npm run dev                    # 同时启动前端和后端
npm run dev:backend            # 仅启动后端 (端口3001)
npm run dev:frontend           # 仅启动前端 (端口5173)

# Windows系统专用
npm run dev:win                # Windows系统启动
```

#### 🐳 Docker服务管理
```bash
npm run docker:up             # 启动所有Docker服务
npm run docker:down           # 停止Docker服务
npm run docker:build          # 构建Docker镜像
```

#### 🗄️ 数据库管理
```bash
cd backend && npm run migrate          # 运行数据库迁移
cd backend && npm run migrate:rollback # 回滚数据库迁移
cd backend && npm run seed             # 运行种子数据
cd backend && npm run db:reset         # 重置数据库
```

#### 🔍 代码质量检查
```bash
npm run lint                   # 运行ESLint检查
npm run lint:fix              # 自动修复ESLint问题
```

#### 🧪 测试
```bash
npm run test                  # 运行测试
npm run test:coverage         # 运行测试并生成覆盖率报告
npm run test:e2e             # 运行端到端测试
```

#### 🏗️ 构建和部署
```bash
npm run build                 # 构建生产版本
npm run start                 # 启动生产版本
```

### 📝 代码规范
- **🔒 TypeScript 严格模式** - 启用所有严格类型检查
- **✨ ESLint + Prettier** - 自动化代码格式化和质量检查
- **🧩 组件化开发** - React函数式组件，关注点分离
- **🔧 函数式编程** - 纯函数和不可变数据原则
- **📐 统一代码风格** - 2空格缩进、单引号字符串、必需分号
- **📚 注释规范** - JSDoc注释，清晰的函数和组件说明
- **🎯 命名规范** - 语义化变量名和函数名

### 🔍 调试和监控
- **🐛 错误追踪**: Winston日志系统，结构化错误记录
- **📊 性能监控**: Prometheus指标收集，实时性能监控
- **🔧 开发工具**: 热重载、源码映射、调试器支持
- **🌐 API测试**: 内置API文档和测试工具

## 📚 文档

详细文档请参考：

### 🆕 v2.0 版本文档
- **[v2.0 发布说明](RELEASE_NOTES_v2.0.md)** - 完整的功能介绍和用户指南（中英双语）
- **[API 文档 v2.0](docs/backend/architecture/API_DOCUMENTATION_v2.md)** - 所有新增 API 端点详细文档
- **[实现总结](FINAL_IMPLEMENTATION_SUMMARY.md)** - 完整的开发实施记录
- **[性能优化报告](FINAL_PERFORMANCE_REPORT.md)** - 性能基准测试结果
- **[优化和审查报告](OPTIMIZATION_AND_REVIEW_REPORT.md)** - 代码质量审查和优化建议
- **[iOS 构建问题](FunnyPixelsApp/BUILD_KNOWN_ISSUES.md)** - 已知问题和解决方案

### 架构文档
- [当前架构结构](docs/architecture/CURRENT_STRUCTURE.md)
- [项目结构说明](docs/architecture/PROJECT_STRUCTURE.md)

### 部署文档
- [部署指南](docs/deployment/DEPLOYMENT_GUIDE.md)
- [环境设置](docs/deployment/ENVIRONMENT_SETUP.md)
- [Render配置](docs/deployment/RENDER_CONFIG.md)
- [Cloudflare配置](docs/deployment/CLOUDFLARE_CONFIG.md)

### 开发文档
- [现代UI重设计](docs/development/MODERN_UI_REDESIGN.md)
- [使用指南](docs/USAGE_GUIDE.md)
- [测试报告](docs/TEST_REPORT.md)

### 配置文档 (包含敏感信息)
- [API密钥和密钥](docs/config/API_KEYS_AND_SECRETS.md)
- [数据库凭据](docs/config/DATABASE_CREDENTIALS.md)
- [系统配置](docs/config/SYSTEM_CONFIGURATION.md)

### 技术分析文档
- [像素渲染分析](docs/PIXEL_RENDERING_ANALYSIS.md)
- [性能优化计划](docs/PERFORMANCE_OPTIMIZATION_PLAN.md)
- [图案管理系统](docs/COMPLETE_PATTERN_MANAGEMENT_SYSTEM.md)
- [联盟成就系统](docs/alliance-achievement-system.md)

## 🚀 生产环境部署指南

本文档提供完整的生产环境部署步骤，包括 Docker 服务、数据库迁移、种子数据初始化等。

### 📋 部署前置要求

#### 系统要求
- **操作系统**: Linux (Ubuntu 20.04+ / CentOS 7+) 或 macOS
- **内存**: 最低 4GB，推荐 8GB+
- **磁盘空间**: 最低 20GB 可用空间
- **网络**: 稳定的互联网连接

#### 软件依赖
- **Docker**: 20.10.0+
- **Docker Compose**: 2.0.0+
- **Node.js**: 18.0.0+ (本地开发)
- **Git**: 2.0.0+

### 🐳 第一步：安装 Docker 环境

#### macOS 安装
```bash
# 使用 Homebrew 安装
brew install --cask docker

# 或访问官网下载安装包
# https://www.docker.com/products/docker-desktop

# 启动 Docker Desktop
open -a Docker
```

#### Linux (Ubuntu) 安装
```bash
# 更新包索引
sudo apt-get update

# 安装依赖
sudo apt-get install -y \
    ca-certificates \
    curl \
    gnupg \
    lsb-release

# 添加 Docker 官方 GPG key
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

# 设置仓库
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# 安装 Docker Engine
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# 验证安装
docker --version
docker-compose version
```

#### 启动 Docker 服务
```bash
# macOS
open -a Docker

# Linux
sudo systemctl start docker
sudo systemctl enable docker

# 验证 Docker 运行
docker info
```

### 📦 第二步：克隆项目并配置

```bash
# 克隆项目仓库
git clone <your-repository-url>
cd funnypixels3

# 复制环境变量配置文件
cp backend/.env.example backend/.env
cp admin-frontend/.env.example admin-frontend/.env

# 编辑环境变量（生产环境）
nano backend/.env
```

### 🔧 第三步：配置生产环境变量

编辑 `backend/.env` 文件，配置以下关键变量：

```bash
# ================================
# 🗄️ 数据库配置
# ================================
DB_HOST=postgres
DB_PORT=5432
DB_NAME=funnypixels_postgres
DB_USER=postgres
DB_PASSWORD=your_secure_password_here

# ================================
# 🧠 Redis 配置
# ================================
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# ================================
# 🔐 安全配置（生产环境必须修改！）
# ================================
JWT_SECRET=your_super_secure_jwt_secret_key_at_least_32_characters_long
JWT_REFRESH_SECRET=your_refresh_token_secret_key_here
JWT_EXPIRES_IN=7d
JWT_REFRESH_EXPIRES_IN=30d

# ================================
# 🌐 服务器配置
# ================================
NODE_ENV=production
PORT=3000
API_URL=https://api.yourdomain.com

# ================================
# 📧 邮件服务配置（可选）
# ================================
SMTP_HOST=smtp.your-provider.com
SMTP_PORT=587
SMTP_USER=your_email@yourdomain.com
SMTP_PASS=your_email_password
EMAIL_FROM=noreply@yourdomain.com

# ================================
# 📱 短信服务配置（可选，阿里云）
# ================================
ALIYUN_ACCESS_KEY=your_aliyun_access_key
ALIYUN_SECRET_KEY=your_aliyun_secret_key
ALIYUN_SIGN_NAME=YourAppName

# ================================
# 🗺️ 地图服务配置
# ================================
MAP_TILE_URL=https://tiles.openfreemap.org/styles/liberty

# ================================
# 📊 监控和日志（可选）
# ================================
SENTRY_DSN=your_sentry_dsn
LOG_LEVEL=info

# ================================
# 🏷️ 域名和CORS配置
# ================================
FRONTEND_URL=https://yourdomain.com
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
```

### 🐳 第四步：启动 Docker 服务

项目提供 Docker 服务管理脚本，包含以下服务：
- **PostgreSQL 15 + PostGIS 3.3**: 主数据库
- **Redis 7**: 缓存和会话存储
- **pgAdmin 4**: 数据库可视化管理

#### 使用管理脚本启动（推荐）

```bash
# 启动所有服务
./docker-services.sh start

# 查看服务状态
./docker-services.sh status

# 查看服务日志
./docker-services.sh logs

# 查看帮助信息
./docker-services.sh help
```

#### 使用 Docker Compose 启动

```bash
# 启动所有服务
docker-compose up -d

# 查看服务状态
docker-compose ps

# 查看服务日志
docker-compose logs -f

# 仅启动特定服务
docker-compose up -d postgres redis
```

#### 服务访问地址

| 服务 | 地址 | 用户名 | 密码 | 说明 |
|------|------|--------|------|------|
| PostgreSQL | localhost:5432 | postgres | password | 主数据库 + PostGIS |
| Redis | localhost:6379 | - | - | 缓存服务 |
| pgAdmin | http://localhost:5050 | admin@funnypixels.com | admin123 | 数据库管理 |

### 🗄️ 第五步：数据库迁移

#### 5.1 验证数据库连接

```bash
# 等待数据库启动（约10秒）
sleep 10

# 验证 PostgreSQL 连接
docker-compose exec postgres pg_isready -U postgres

# 进入 PostgreSQL 命令行
./docker-services.sh psql

# 在 psql 中验证 PostGIS
SELECT PostGIS_Version();

# 退出 psql
\q
```

#### 5.2 运行数据库迁移

```bash
# 进入后端目录
cd backend

# 安装后端依赖（首次运行）
npm install

# 运行所有数据库迁移
npm run migrate

# 迁移成功后应显示：
# ✅ Migration completed successfully
```

#### 5.3 迁移验证

```bash
# 进入 PostgreSQL 验证表结构
./docker-services.sh psql

# 查看所有表
\dt

# 查看表数量
SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';

# 应该看到以下核心表：
# - users (用户表)
# - pixels (像素表)
# - pixels_history (像素历史表)
# - alliances (联盟表)
# - sessions (会话表)
# - patterns (图案表)
# 等...

# 退出
\q
```

#### 5.4 迁移回滚（如需要）

```bash
# 回滚最后一次迁移
npm run migrate:rollback

# 回滚所有迁移
npm run migrate:rollback:all

# 重新运行迁移
npm run migrate
```

### 🌱 第六步：初始化种子数据

#### 6.1 运行种子数据脚本

```bash
# 仍在 backend 目录中
npm run seed

# 种子数据成功后应显示：
# ✅ Seed data completed successfully
```

#### 6.2 种子数据内容

种子数据包含以下内容：

1. **管理员账户**
   - 用户名: admin
   - 密码: admin123
   - 邮箱: admin@funnypixels.com
   - 角色: 超级管理员

2. **测试用户**
   - 创建 10 个测试用户账户
   - 用于功能测试和演示

3. **基础联盟**
   - 创建 5 个示例联盟
   - 包含不同旗帜和颜色配置

4. **图案模板**
   - Emoji 图案集
   - 国旗图案集
   - 常用符号图案

5. **系统配置**
   - 基础商城商品
   - 成就等级定义
   - 排行榜周期配置

#### 6.3 验证种子数据

```bash
# 进入 PostgreSQL
./docker-services.sh psql

# 验证管理员用户
SELECT id, username, email, role FROM users WHERE username = 'admin';

# 验证联盟数量
SELECT COUNT(*) FROM alliances;

# 验证图案数量
SELECT COUNT(*) FROM patterns;

# 验证商品数量
SELECT COUNT(*) FROM products;

# 退出
\q
```

### 🔧 第七步：数据库备份（重要！）

首次部署完成后，立即创建数据库备份：

```bash
# 使用管理脚本备份
./docker-services.sh backup

# 备份文件会保存在 backups/ 目录
# 文件名格式: funnypixels_backup_YYYYMMDD_HHMMSS.sql

# 验证备份文件
ls -lh backups/
```

### 🖥️ 第八步：启动应用服务

#### 8.1 构建生产版本

```bash
# 构建前端
cd admin-frontend
npm install
npm run build

# 返回后端目录
cd ../backend

# 安装生产依赖
npm install --production
```

#### 8.2 启动后端服务

```bash
# 开发环境启动
npm run dev

# 生产环境启动（使用 PM2）
npm install -g pm2
pm2 start npm --name "funnypixels-backend" -- start

# 查看服务状态
pm2 status
pm2 logs funnypixels-backend

# 设置开机自启
pm2 startup
pm2 save
```

#### 8.3 验证服务运行

```bash
# 检查 API 健康状态
curl http://localhost:3000/api/health

# 应返回：
# {"status":"ok","timestamp":"...","database":"connected","redis":"connected"}

# 检查数据库连接
curl http://localhost:3000/api/health/database

# 检查 Redis 连接
curl http://localhost:3000/api/health/redis
```

### 🌐 第九步：配置 Nginx 反向代理（可选）

如果需要配置域名和 HTTPS，使用 Nginx 作为反向代理：

```bash
# 安装 Nginx
sudo apt-get install nginx

# 创建站点配置
sudo nano /etc/nginx/sites-available/funnypixels
```

Nginx 配置示例：

```nginx
# HTTP 重定向到 HTTPS
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

# HTTPS 主配置
server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    # SSL 证书配置（使用 Let's Encrypt）
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    # 前端静态文件
    location / {
        root /var/www/funnypixels/admin-frontend/dist;
        try_files $uri /index.html;
    }

    # 后端 API 代理
    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket 代理
    location /socket.io {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

启用配置：

```bash
# 创建软链接
sudo ln -s /etc/nginx/sites-available/funnypixels /etc/nginx/sites-enabled/

# 测试配置
sudo nginx -t

# 重启 Nginx
sudo systemctl restart nginx
```

### 🔄 第十步：数据库管理和维护

#### 日常管理命令

```bash
# === 服务管理 ===
# 启动服务
./docker-services.sh start

# 停止服务
./docker-services.sh stop

# 重启服务
./docker-services.sh restart

# 查看状态
./docker-services.sh status

# 查看日志
./docker-services.sh logs

# === 数据库管理 ===
# 进入 PostgreSQL
./docker-services.sh psql

# 进入 Redis
./docker-services.sh redis

# 备份数据库
./docker-services.sh backup

# 恢复数据库
./docker-services.sh restore <backup_file>

# === 数据库迁移 ===
cd backend

# 运行迁移
npm run migrate

# 回滚迁移
npm run migrate:rollback

# 重置数据库（警告：会删除所有数据！）
npm run db:reset

# === 种子数据 ===
# 运行种子数据
npm run seed

# 重新运行种子数据（会更新现有数据）
npm run seed:force
```

#### 数据库备份策略

**自动备份设置**：

```bash
# 创建备份脚本
cat > /home/youruser/backup-funnypixels.sh << 'EOF'
#!/bin/bash
cd /path/to/funnypixels3
./docker-services.sh backup

# 保留最近7天的备份
find backups/ -name "funnypixels_backup_*.sql" -mtime +7 -delete
EOF

# 添加执行权限
chmod +x /home/youruser/backup-funnypixels.sh

# 设置定时任务（每天凌晨2点备份）
crontab -e

# 添加以下行
0 2 * * * /home/youruser/backup-funnypixels.sh
```

**手动备份**：

```bash
# 快速备份
./docker-services.sh backup

# 查看备份文件
ls -lh backups/

# 备份到远程服务器
scp backups/funnypixels_backup_*.sql user@remote-server:/backups/
```

#### 数据库监控

```bash
# 查看数据库大小
./docker-services.sh psql
SELECT pg_database.datname,
       pg_size_pretty(pg_database_size(pg_database.datname)) AS size
FROM pg_database
ORDER BY pg_database_size(pg_database.datname) DESC;

# 查看表大小
SELECT schemaname,
       tablename,
       pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

# 查看活跃连接
SELECT count(*) FROM pg_stat_activity WHERE state = 'active';

# 查看慢查询
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;

# 退出
\q
```

### ⚠️ 故障排查

#### 问题 1：Docker 服务无法启动

```bash
# 检查 Docker 是否运行
docker info

# 检查端口占用
lsof -i :5432  # PostgreSQL
lsof -i :6379  # Redis
lsof -i :5050  # pgAdmin

# 查看容器日志
docker-compose logs postgres
docker-compose logs redis

# 重启 Docker
# macOS: 重启 Docker Desktop
# Linux: sudo systemctl restart docker
```

#### 问题 2：数据库迁移失败

```bash
# 查看迁移日志
cd backend
npm run migrate -- --verbose

# 检查数据库连接
./docker-services.sh psql
\conninfo
\q

# 重新运行迁移
npm run db:reset
npm run migrate
```

#### 问题 3：Redis 连接失败

```bash
# 测试 Redis 连接
docker-compose exec redis redis-cli ping
# 应返回: PONG

# 重启 Redis
docker-compose restart redis

# 查看 Redis 日志
docker-compose logs redis
```

#### 问题 4：PostGIS 功能不可用

```bash
# 进入 PostgreSQL
./docker-services.sh psql

# 启用 PostGIS 扩展
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;

# 验证安装
SELECT PostGIS_Version();

# 查看可用的 PostGIS 函数
\df postgis_*

# 退出
\q
```

### 📊 性能优化建议

#### 数据库优化

```sql
-- 创建索引（如果缺失）
CREATE INDEX IF NOT EXISTS idx_pixels_grid_id ON pixels(grid_id);
CREATE INDEX IF NOT EXISTS idx_pixels_user_id ON pixels(user_id);
CREATE INDEX IF NOT EXISTS idx_pixels_created_at ON pixels(created_at DESC);

-- 分析查询性能
EXPLAIN ANALYZE SELECT * FROM pixels WHERE grid_id = 12345;

-- 更新统计信息
ANALYZE pixels;
ANALYZE pixels_history;
```

#### Redis 优化

```bash
# 编辑 redis 配置
docker-compose exec redis redis-cli CONFIG SET maxmemory 256mb
docker-compose exec redis redis-cli CONFIG SET maxmemory-policy allkeys-lru

# 查看内存使用
docker-compose exec redis redis-cli INFO memory
```

#### 应用优化

```bash
# 使用 PM2 集群模式
pm2 start npm --name "funnypixels-backend" -i max -- start

# 配置日志轮转
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7

# 监控性能
pm2 monit
```

### 📚 相关文档

- **INSTALL_DOCKER.md** - Docker 安装和快速启动指南
- **DOCKER_SETUP.md** - 完整的 Docker 配置和使用文档
- **DOCKER_FILES_INDEX.md** - Docker 文件清单和检查列表
- **docs/deployment/DEPLOYMENT_GUIDE.md** - 完整部署指南
- **docs/deployment/ENVIRONMENT_SETUP.md** - 环境配置详解

### 🆘 获取帮助

```bash
# 显示 Docker 服务帮助
./docker-services.sh help

# 查看应用日志
cd backend
npm run dev

# 查看错误日志
tail -f backend/logs/error.log

# 查看访问日志
tail -f backend/logs/access.log
```

---

## 🌐 其他部署方式

除了 Docker 部署外，项目还支持以下部署方式：

#### 1. ☁️ 云平台部署
- **Vercel**: 前端自动部署
- **Railway**: 全栈应用部署
- **Render**: 后端服务部署
- **AWS/阿里云**: 企业级部署

#### 2. 🖥️ 传统服务器部署
- **VPS部署**: 支持Ubuntu/CentOS系统
- **云服务器**: 阿里云ECS、腾讯云CVM等
- **CDN加速**: 静态资源CDN分发

详细部署指南请参考：[部署文档](docs/deployment/DEPLOYMENT_GUIDE.md)

## 🔮 待实现功能（Roadmap）

以下功能已完成设计评审，计划在后续版本中实现：

### 📊 v2.1 计划功能（待排期）

#### 🎯 像素热门统计与可视化系统
> **详细设计文档**: [PIXEL_HOT_RANKING_FEATURE.md](PIXEL_HOT_RANKING_FEATURE.md)
> **优先级**: P2 - 增强功能
> **预计开发周期**: 3周

**核心模块**:

1. **🎨 像素回忆（Pixel Memories）**
   - 热门像素成就展示（用户绘制的像素成为全球热门）
   - 重复绘制统计（最"执着"的像素点）
   - 地理足迹回忆（访问过的城市、里程碑）
   - 时间线回忆（关键时刻展示）

2. **👥 社交发现（Social Discovery）**
   - 像素知音推荐（发现踩过相同像素的用户）
   - 像素社群推荐（同一区域的活跃用户）
   - 创作风格推荐（相似风格的创作者）

3. **🗺️ 地图热力图层（Hot Pixels Layer）**
   - 热门像素标记（Top 1-100 特殊标记）
   - 热力分布图（颜色渐变展示密度）
   - 图层控制器（可开关、可筛选）
   - 热门像素详情弹窗（活跃趋势、参与用户）

4. **📮 定时推送报告系统**
   - 月度报告自动生成
   - 个性化推送通知
   - 精美报告展示页面
   - 社交分享功能

**技术亮点**:
- 物化视图预计算热门像素（性能优化）
- Redis 多级缓存策略
- 智能推荐算法（相似度计算）
- 地图热力渲染（WebGL）

**预期效果**:
- 📈 用户参与度提升 25%
- 🤝 社交互动增长 40%
- 📊 次月留存率提升 15%
- 🔥 报告打开率 >60%

---

#### 🛡️ 像素治理与优化系统
> **背景**: 随着用户增长和像素数量增加，需要智能治理机制避免地图混乱
> **设计原则**: 保护有价值内容，清理低质量内容，平衡新老用户需求
> **优先级**: P1 - 重要功能
> **预计开发周期**: 4-5周

**阶段1: 像素质量过滤器** (P0 - 核心治理功能)
- [ ] **像素质量评分算法**
  - 基于举报次数、点赞数、创作者状态等多维度评分
  - 质量分<40的像素进入"候选清除池"
  - 清除前提供30天通知期
- [ ] **低质量像素自动标记系统**
  - 违规内容检测（基于举报系统）
  - 封禁用户像素自动降权
  - 僵尸像素识别（90天无互动）
- [ ] **智能清理机制**
  - 仅清除明确垃圾内容
  - 保留所有付费内容（广告、VIP作品）
  - 保留联盟作品和活动产出
  - 清除记录归档到pixels_history

**阶段2: 分层保护机制** (P1 - 重要优化功能)
- [ ] **像素保护等级系统**
  - 永久保护：广告、联盟作品、活动产出、VIP作品
  - 条件保护：30天内有互动或创作者活跃的像素
  - 临时保护：90天无互动但创作者登录的像素
  - 可清除：90天无互动 + 创作者90天未登录
- [ ] **僵尸像素检测与清理**
  - 定时任务检测僵尸像素（每周执行）
  - 清理前提前30天用户通知
  - 提供付费保护选项（新营收点）
- [ ] **活跃度追踪系统**
  - 像素互动统计（点赞、评论、查看）
  - 用户活跃度监控
  - 创作价值评估

**阶段3: 热力衰减机制** (P1 - 视觉优化)
- [ ] **像素透明度衰减算法**
  - 30天内：100%不透明
  - 30-90天：70%透明度
  - 90-180天：40%透明度
  - 180天以上：10%透明度（几乎透明）
- [ ] **互动复活机制**
  - 任何互动（点赞、评论）可提升透明度
  - 创作者登录自动复活其像素
  - 付费道具"像素复活卡"
- [ ] **视觉淡化渲染**
  - 前端WebGL透明度渲染
  - 性能优化（只渲染可见区域）
  - 用户可选择是否显示淡化像素

**阶段4: 区域竞争机制** (P2 - 增强功能)
- [ ] **热门区域检测**
  - 识别像素密度超过阈值的区域
  - 热力图可视化展示
  - 区域竞争度评级
- [ ] **像素投票系统**
  - 新像素需要5个点赞才能覆盖旧像素（热门区域）
  - 普通区域无需投票
  - 投票权重（VIP用户投票权重×2）
- [ ] **覆盖规则引擎**
  - 根据区域竞争度动态调整规则
  - 联盟作品额外保护
  - 防刷机制（同一用户24小时内只能投票1次）

**阶段5: 虚拟图层系统** (P2 - 增强功能)
- [ ] **时间图层切换**
  - 当前视图（默认）
  - 最近一周 / 最近一月 / 最近一年
  - 全部历史
- [ ] **历史视图功能**
  - "时光机"模式查看历史像素
  - 对比视图（前后对比）
  - 区域演变动画
- [ ] **图层可视化**
  - 图层切换控制面板
  - 平滑过渡动画
  - 性能优化（按需加载）

**阶段6: 数据分析Dashboard** (P2 - 运营工具)
- [ ] **像素密度分析**
  - 全球热力图
  - 区域像素密度统计
  - 拥挤区域报警（>10000像素/km²）
- [ ] **用户活跃度统计**
  - 活跃用户vs僵尸像素比例
  - 用户留存率分析
  - 创作活跃度趋势
- [ ] **区域热力图**
  - 实时更新热力数据
  - 导出数据报表
  - 辅助运营决策

**技术实现要点**:
- 📦 复用现有技术栈（pixels_history分区表、Redis缓存、定时任务）
- ⚡ 性能优化（批量处理、异步清理、增量更新）
- 🔐 安全机制（防止误删、多重确认、可恢复）
- 📊 监控告警（清理统计、用户反馈、异常检测）

**数据驱动决策**:
在正式实施前，先收集以下数据（预计1个月）：
- 各区域像素密度分布
- 用户活跃度vs僵尸像素比例
- 用户投诉"画面混乱"的数量和位置
- 基于数据决定实施哪些阶段

**预期效果**:
- ✅ 地图视觉整洁度提升30%
- ✅ 保护99%有价值内容（付费、活跃用户）
- ✅ 清理<1%垃圾内容（违规、僵尸像素）
- ✅ 新增付费保护道具营收
- ✅ 用户满意度提升（平衡各方需求）

**重要说明**:
⚠️ **不采用全局潮汐机制**：经过充分分析，全局定期清除像素会严重损害用户创作动力、破坏付费用户权益、违背产品"永久创作"定位。本方案采用**精细化治理策略**，保护有价值内容的同时清理垃圾内容。

---

### 🚀 其他计划中的功能

#### 📱 移动端增强
- [ ] AR 实景绘制模式
- [ ] 离线绘制支持（本地缓存后同步）
- [ ] Widget 小组件（快速查看统计）
- [ ] Apple Watch 支持

#### 🎮 游戏化功能
- [ ] 每日挑战任务系统
- [ ] 赛季竞赛排行
- [ ] 像素宝藏猎人模式
- [ ] 团队协作副本

#### 🤖 AI 智能功能
- [ ] AI 图案生成（文字转像素画）
- [ ] 智能配色建议
- [ ] 自动作品评分
- [ ] 个性化推荐系统

#### 🌐 国际化增强
- [ ] 多语言支持完善（10+语言）
- [ ] 地区特色图案库
- [ ] 文化节日主题活动
- [ ] 时区智能适配

---

### 📝 功能提案

如果你有新的功能想法，欢迎通过以下方式提出：

1. **GitHub Issues**: 创建功能请求 Issue，使用 `enhancement` 标签
2. **讨论区**: 在 [Discussions](https://github.com/your-org/funnypixels/discussions) 中发起讨论
3. **投票**: 为你喜欢的功能提案投票 👍

---

## 🤝 贡献指南

我们欢迎所有形式的贡献！请遵循以下步骤：

### 🎯 贡献类型
- **🐛 Bug修复**: 修复现有功能问题
- **✨ 新功能**: 添加新的功能特性
- **📚 文档改进**: 完善文档和注释
- **🎨 UI/UX优化**: 界面和交互体验改进
- **⚡ 性能优化**: 代码性能和系统优化

### 🔄 贡献流程
1. **🍴 Fork 项目** - 创建你的项目副本
2. **🌿 创建功能分支** - `git checkout -b feature/amazing-feature`
3. **💻 提交更改** - `git commit -m 'Add some amazing feature'`
4. **📤 推送到分支** - `git push origin feature/amazing-feature`
5. **🔀 创建 Pull Request** - 详细描述你的更改

### 📝 提交规范
- 使用语义化提交信息
- 提供清晰的代码注释
- 确保所有测试通过
- 遵循项目的代码规范

## 📄 许可证

本项目采用 **MIT License** 开源协议。

## 📞 联系我们

- **📧 邮箱**: [contact@funnypixels.com](mailto:contact@funnypixels.com)
- **💬 讨论**: [GitHub Discussions](https://github.com/your-org/funnypixels/discussions)
- **🐛 问题反馈**: [GitHub Issues](https://github.com/your-org/funnypixels/issues)
- **📖 文档**: [项目Wiki](https://github.com/your-org/funnypixels/wiki)

---

<div align="center">

**🌟 如果这个项目对你有帮助，请给我们一个Star！**

**最后更新**: 2026年02月23日
**当前版本**: v2.0.0 🎉
**维护状态**: 🟢 活跃开发中
**最新特性**: 活动系统全面升级

Made with ❤️ by FunnyPixels Team

</div>