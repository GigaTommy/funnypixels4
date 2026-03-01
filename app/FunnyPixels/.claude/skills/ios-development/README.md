# FunnyPixels iOS Development Skills

这是一套完整的iPhone App开发专用Skills集合，用于自动化、高效地完成FunnyPixels iOS项目的功能开发、构建、测试等工作。

## 📚 Skills目录

### 1. [Xcode Setup & Build](./xcode-setup.md)
**功能**: 配置Xcode工程基础设置和验证构建系统

**使用场景**:
- 初始化iOS项目配置
- 配置Bundle ID、Scheme、环境变量
- 验证xcodebuild命令行构建能力
- 设置Debug/Release配置

**快速开始**:
```bash
# 配置Xcode工程
./.claude/skills/ios-development/run_xcode_setup.sh

# 验证构建
xcodebuild -list
swift build
```

---

### 2. [iOS Map & Pixel Renderer](./ios-map-renderer.md)
**功能**: 实现基于MapKit的地图容器和像素渲染系统

**使用场景**:
- 设置MapKit地图容器
- 实现像素Chunk/Tile数据结构
- 实现LOD缩放策略
- 地图平移/缩放与像素同步

**关键组件**:
- `PixelTile` - 像素区块数据结构
- `PixelTileManager` - Tile管理器（缓存+LRU）
- `PixelLODStrategy` - LOD渲染策略
- `PixelRenderer` - 像素渲染器

---

### 3. [iOS WebSocket Manager](./ios-websocket.md)
**功能**: 实现iOS专用WebSocket实时通信管理器

**使用场景**:
- 建立WebSocket连接到后端
- 实现区域订阅机制（基于地图视口）
- 处理实时像素更新事件
- 断线重连和网络抖动处理

**关键特性**:
- 自动重连（指数退避）
- 区域订阅/取消订阅
- 消息去重和排序
- 离线消息队列
- 心跳保活

---

### 4. [iOS Auth & Keychain](./ios-auth-keychain.md)
**功能**: 实现iOS用户认证和安全存储

**使用场景**:
- 用户Token安全存储（Keychain）
- 登录状态恢复
- 游客模式支持
- 自动登录

**安全特性**:
- Keychain加密存储
- Token自动刷新
- 游客转正式用户
- 多账号支持

---

### 5. [iOS Unit Testing](./ios-unit-test.md)
**功能**: 为iOS App创建完整的单元测试

**使用场景**:
- Model Codable测试
- API数据解析测试
- 业务逻辑测试（像素冲突、绘制限制）
- ViewModel状态测试

**测试覆盖**:
- Model层测试
- Service层测试
- ViewModel测试
- 业务逻辑测试

**运行测试**:
```bash
swift test
swift test --enable-code-coverage
```

---

### 6. [iOS Device Testing](./ios-device-test.md)
**功能**: 真机测试和性能验证

**使用场景**:
- 配置Apple Developer账号和证书
- 在真机上运行App
- 验证GPS精度和耗电
- 测试地图滑动性能
- 使用Instruments进行性能分析

**性能指标**:
- GPS精度 < 10米
- 5分钟GPS耗电 < 2%
- 地图滑动60fps
- 1000像素渲染 < 500ms
- 2小时运行无崩溃

---

## 🚀 快速上手

### 阶段1: 项目初始化（第1天）

```bash
# 1. 配置Xcode工程
./.claude/skills/ios-development/run_xcode_setup.sh

# 2. 验证构建
swift build

# 3. 确认Scheme
xcodebuild -list
```

### 阶段2: 核心功能开发（第2-3周）

1. **地图和像素渲染**
   - 参考 `ios-map-renderer.md`
   - 实现PixelTile数据结构
   - 集成MapKit
   - 实现LOD策略

2. **WebSocket实时通信**
   - 参考 `ios-websocket.md`
   - 实现WebSocket连接
   - 实现区域订阅
   - 处理断线重连

3. **用户认证**
   - 参考 `ios-auth-keychain.md`
   - 实现Keychain存储
   - 实现登录/注册
   - 支持游客模式

### 阶段3: 测试和优化（第4周）

1. **单元测试**
   ```bash
   # 运行单元测试
   swift test

   # 生成覆盖率报告
   swift test --enable-code-coverage
   ```

2. **真机测试**
   ```bash
   # 配置真机
   ./.claude/skills/ios-development/setup_device.sh

   # 构建并运行
   ./.claude/skills/ios-development/build_and_run_device.sh

   # 性能分析
   ./.claude/skills/ios-development/profile_with_instruments.sh
   ```

---

## 📊 开发里程碑

### Milestone 1: 可构建可运行
- [x] Xcode工程配置完成
- [ ] 模拟器可运行
- [ ] 真机可运行

### Milestone 2: 核心功能
- [ ] 地图显示正常
- [ ] 像素渲染可用
- [ ] WebSocket连接正常
- [ ] 用户登录可用

### Milestone 3: 测试完成
- [ ] 单元测试覆盖率 > 60%
- [ ] 真机性能达标
- [ ] 稳定性测试通过

### Milestone 4: 生产就绪
- [ ] 所有功能完成
- [ ] 性能优化完成
- [ ] 代码审查通过
- [ ] 准备提交App Store

---

## 🛠️ 工具依赖

### 必需工具
- Xcode 15+
- Swift 5.9+
- iOS 17.0+ SDK
- Command Line Tools

### 推荐工具
- SwiftLint (代码规范)
- SwiftFormat (代码格式化)
- fastlane (自动化)
- Instruments (性能分析)

### 安装依赖

```bash
# 安装Xcode Command Line Tools
xcode-select --install

# 安装SwiftLint
brew install swiftlint

# 安装fastlane
brew install fastlane
```

---

## 📖 最佳实践

### 代码组织
```
Sources/
├── FunnyPixels/
│   ├── Models/           # 数据模型
│   ├── Views/            # SwiftUI视图
│   ├── ViewModels/       # MVVM视图模型
│   ├── Services/         # 服务层（API, WebSocket, etc）
│   ├── Managers/         # 管理器（Tile, Cache, etc）
│   ├── Rendering/        # 渲染相关
│   └── Utils/            # 工具类
└── FunnyPixelsApp/
    └── FunnyPixelsApp.swift  # App入口
```

### Git工作流
```bash
# 功能分支
git checkout -b feature/map-rendering

# 定期提交
git commit -m "feat: implement pixel tile manager"

# 合并前测试
swift test

# 合并到主分支
git checkout main
git merge feature/map-rendering
```

### 性能优化原则
1. **异步优先**: 网络请求和数据处理使用async/await
2. **缓存策略**: 实现LRU缓存减少重复计算
3. **LOD渲染**: 根据缩放级别动态调整像素密度
4. **分批渲染**: 大量像素分批次渲染避免卡顿

---

## 🔧 故障排除

### 构建失败

```bash
# 清理构建缓存
rm -rf .build
rm -rf ~/Library/Developer/Xcode/DerivedData

# 重新构建
swift build
```

### 签名问题

```bash
# 检查证书
security find-identity -v -p codesigning

# 在Xcode中配置自动签名
# Project Settings -> Signing & Capabilities -> Automatically manage signing
```

### 真机无法连接

```bash
# 信任设备
# iPhone: 设置 -> 通用 -> VPN与设备管理 -> 信任开发者

# 检查设备
xcrun xctrace list devices
```

---

## 📞 支持与反馈

### 遇到问题？

1. 查看对应Skill的详细文档
2. 运行诊断脚本
3. 查看错误日志
4. 提交Issue

### 贡献新Skill

1. Fork项目
2. 创建新Skill文档
3. 编写测试用例
4. 提交Pull Request

---

## 📝 更新日志

### v1.0.0 (2026-01-01)
- ✅ 创建Xcode Setup Skill
- ✅ 创建Map Renderer Skill
- ✅ 创建WebSocket Manager Skill
- ✅ 创建Auth & Keychain Skill
- ✅ 创建Unit Testing Skill
- ✅ 创建Device Testing Skill

---

## 📄 许可证

MIT License

Copyright (c) 2026 FunnyPixels

---

**Happy Coding! 🎉**
