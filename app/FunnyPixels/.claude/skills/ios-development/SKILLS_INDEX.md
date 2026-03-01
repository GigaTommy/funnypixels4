# iOS Development Skills Index

**用途**: 快速查找和调用iOS开发专用Skills

---

## 快速索引

| Skill名称 | 命令 | 用途 | 优先级 |
|----------|------|------|--------|
| **Xcode Setup** | `/xcode-setup` | 配置工程、验证构建 | 🔴 高 |
| **Map Renderer** | `/ios-map` | 地图和像素渲染 | 🔴 高 |
| **WebSocket** | `/ios-websocket` | 实时通信 | 🟡 中 |
| **Auth & Keychain** | `/ios-auth` | 用户认证和安全存储 | 🟡 中 |
| **Unit Test** | `/ios-test` | 单元测试 | 🟢 中 |
| **Device Test** | `/ios-device` | 真机测试和性能验证 | 🟢 低 |

---

## 按开发阶段分类

### 阶段0: 项目初始化（必须完成）

```
1️⃣ /xcode-setup
   配置Bundle ID、Scheme、环境变量
   验证构建系统
```

### 阶段1: 核心地图功能

```
2️⃣ /ios-map
   实现PixelTile数据结构
   集成MapKit
   实现LOD渲染策略
   地图缓存机制
```

### 阶段2: 像素绘制与实时更新

```
3️⃣ /ios-websocket
   WebSocket连接管理
   区域订阅机制
   断线重连处理
```

### 阶段3: 用户系统

```
4️⃣ /ios-auth
   Keychain安全存储
   登录/注册
   游客模式
   会话恢复
```

### 阶段4: 测试与质量

```
5️⃣ /ios-test
   Model Codable测试
   API解析测试
   业务逻辑测试

6️⃣ /ios-device
   真机性能测试
   GPS精度验证
   Instruments分析
```

---

## 按功能分类

### 🏗️ 构建与配置
- **xcode-setup**: Xcode工程配置
- **ios-device**: 真机配置和部署

### 🗺️ 地图与渲染
- **ios-map**: MapKit集成、像素渲染、LOD策略

### 🔄 网络与通信
- **ios-websocket**: WebSocket实时通信
- **ios-auth**: API认证、Token管理

### 🔐 安全与存储
- **ios-auth**: Keychain安全存储

### 🧪 测试与质量
- **ios-test**: 单元测试、集成测试
- **ios-device**: 性能测试、稳定性测试

---

## 使用示例

### 场景1: 开始新项目

```bash
# Step 1: 配置Xcode工程
使用Skill: /xcode-setup

# Step 2: 实现地图功能
使用Skill: /ios-map

# Step 3: 添加实时通信
使用Skill: /ios-websocket

# Step 4: 实现用户认证
使用Skill: /ios-auth

# Step 5: 编写测试
使用Skill: /ios-test

# Step 6: 真机验证
使用Skill: /ios-device
```

### 场景2: 修复构建问题

```bash
# 使用现有的构建修复Skill
/auto-fix-build

# 或者重新配置Xcode
/xcode-setup --verify-only
```

### 场景3: 优化性能

```bash
# 真机性能测试
/ios-device --performance

# 使用Instruments分析
/ios-device --instruments
```

---

## Skills详细信息

### 1. Xcode Setup (`xcode-setup.md`)

**输入参数**:
- `bundle_id` (可选): Bundle Identifier
- `scheme` (可选): Xcode Scheme名称
- `environment` (可选): dev/staging/prod

**输出**:
- ✅ Xcode工程配置完成
- ✅ Build Settings验证通过
- ✅ Simulator/Device构建成功
- 📄 `build_report.md`

**典型用法**:
```
请帮我配置Xcode工程，Bundle ID使用com.funnypixels.app
```

---

### 2. iOS Map Renderer (`ios-map-renderer.md`)

**输入参数**:
- `map_type`: apple/custom (默认apple)
- `tile_size`: Chunk大小 (默认1000x1000米)
- `max_pixels_per_tile`: 每tile最大像素数 (默认1000)

**输出**:
- ✅ PixelTile数据结构
- ✅ PixelTileManager实现
- ✅ LOD渲染策略
- ✅ MapKit集成

**典型用法**:
```
请帮我实现地图像素渲染系统，使用MapKit
```

---

### 3. iOS WebSocket (`ios-websocket.md`)

**输入参数**:
- `ws_url`: WebSocket服务器地址
- `reconnect_interval`: 重连间隔（秒），默认5
- `max_retry`: 最大重试次数，默认10

**输出**:
- ✅ WebSocket连接管理
- ✅ 区域订阅机制
- ✅ 消息队列和去重
- ✅ 断线重连

**典型用法**:
```
请帮我实现WebSocket管理器，支持自动重连
```

---

### 4. iOS Auth & Keychain (`ios-auth-keychain.md`)

**输入参数**:
- `keychain_service`: Keychain服务名称
- `enable_guest_mode`: 是否启用游客模式 (默认true)

**输出**:
- ✅ KeychainManager实现
- ✅ SessionManager实现
- ✅ 登录/注册流程
- ✅ 游客模式

**典型用法**:
```
请帮我实现用户认证系统，支持Keychain存储和游客模式
```

---

### 5. iOS Unit Test (`ios-unit-test.md`)

**输入参数**:
- `coverage_target`: 目标覆盖率，默认60%
- `test_framework`: XCTest (默认)

**输出**:
- ✅ Model测试
- ✅ API测试
- ✅ 业务逻辑测试
- ✅ ViewModel测试
- 📄 `coverage_report/`

**典型用法**:
```
请帮我创建单元测试，覆盖所有Model和API
```

---

### 6. iOS Device Test (`ios-device-test.md`)

**输入参数**:
- `device_udid`: 测试设备UDID
- `team_id`: Apple Developer Team ID
- `profile_path`: Provisioning Profile路径

**输出**:
- ✅ 真机构建和运行
- ✅ GPS性能测试
- ✅ 渲染性能测试
- ✅ 稳定性测试
- 📄 `performance_report.md`

**典型用法**:
```
请帮我在真机上测试App性能，验证GPS精度和耗电
```

---

## 依赖关系图

```
xcode-setup (必须首先执行)
    ↓
    ├─→ ios-map (核心功能)
    ├─→ ios-websocket (实时通信)
    ├─→ ios-auth (用户系统)
    ↓
    ├─→ ios-test (测试)
    └─→ ios-device (真机验证)
```

---

## 技术栈对照表

| 功能模块 | iOS实现 | Web实现 | 复用度 |
|---------|---------|---------|--------|
| 地图容器 | MapKit | MapLibre | 0% |
| 像素数据 | PixelTile | Tile API | 80% |
| 实时通信 | URLSessionWebSocket | WebSocket API | 100% |
| 用户认证 | Keychain | localStorage | 50% |
| API通信 | URLSession | fetch | 100% |

---

## 关键性能指标

| 指标 | 目标值 | 验证Skill |
|------|--------|----------|
| GPS精度 | < 10米 | ios-device |
| 5分钟GPS耗电 | < 2% | ios-device |
| 地图滑动FPS | 60fps | ios-device |
| 1000像素渲染 | < 500ms | ios-device |
| 2小时无崩溃 | ✅ | ios-device |
| 内存增长 | < 50MB | ios-device |
| 单元测试覆盖率 | > 60% | ios-test |

---

## 常见问题解决

### Q: 如何选择Skill？
A: 参考开发阶段分类，按顺序执行

### Q: Skill之间有依赖吗？
A: 有，参考依赖关系图

### Q: 可以并行执行Skills吗？
A: 部分可以，但建议按阶段顺序执行

### Q: 如何自定义Skill？
A: 复制现有Skill模板，修改参数和实现

---

**最后更新**: 2026-01-01
**版本**: v1.0.0
