# FunnyPixels iOS App

FunnyPixels iOS 客户端应用，基于 Swift 和 SwiftUI 开发的现代化像素艺术创作社交应用。

## 📱 项目概览

FunnyPixels 是一个基于地理位置的像素艺术创作社交平台，用户可以在真实世界的地图上创建、分享像素艺术作品。

### 主要功能

- 🗺️ **地图交互**: 在真实地图上创建和查看像素艺术
- 📍 **GPS跟踪**: 实时记录绘制轨迹和位置信息
- 🏴 **联盟系统**: 创建和加入联盟，与其他玩家协作
- 🏆 **排行榜系统**: 用户和联盟排行榜，展示创作成就
- 🛍️ **商店系统**: 购买像素颜色、道具和特效
- 👤 **用户系统**: 支持注册登录和游客模式
- 📚 **绘制历史**: 完整的绘制历史记录和统计分析
- 🎨 **创作工具**: 丰富的颜色和创作工具

## 🛠️ 技术栈

- **开发语言**: Swift 5.9+
- **UI框架**: SwiftUI 5.0 + UIKit (混合架构)
- **最低版本**: iOS 16.0+
- **架构模式**: MVVM + Clean Architecture
- **依赖管理**: Swift Package Manager
- **网络请求**: Alamofire
- **地图服务**: MapKit + CoreLocation
- **数据存储**: SwiftData + KeychainAccess
- **实时通信**: Socket.IO

## 📁 项目结构

```
app/
└── FunnyPixels/
    ├── Package.swift                    # Swift Package 配置
    ├── Sources/
    │   └── FunnyPixels/
    │       ├── FunnyPixelsApp.swift    # 应用入口
    │       ├── Models/                 # 数据模型
    │       │   ├── User.swift
    │       │   ├── Pixel.swift
    │       │   └── ...
    │       ├── Views/                  # 视图组件
    │       │   ├── ContentView.swift
    │       │   ├── AuthView.swift
    │       │   ├── MapView.swift
    │       │   ├── ChatView.swift
    │       │   ├── StoreView.swift
    │       │   └── ProfileView.swift
    │       ├── ViewModels/             # 视图模型
    │       │   ├── AuthViewModel.swift
    │       │   ├── MapViewModel.swift
    │       │   └── ChatViewModel.swift
    │       ├── Services/               # 服务层
    │       │   ├── APIManager.swift
    │       │   ├── AuthManager.swift
    │       │   └── ...
    │       └── Utils/                  # 工具类
    │           ├── Logger.swift
    │           └── ...
    └── Tests/
        ├── FunnyPixelsTests/
        └── FunnyPixelsUITests/
```

## 🚀 快速开始

### 环境要求

- Xcode 15.0+
- iOS 16.0+
- Swift 5.9+

### 安装步骤

1. **克隆项目**
   ```bash
   git clone <repository-url>
   cd funnypixels/app/FunnyPixels
   ```

2. **打开项目**
   ```bash
   open Package.swift
   # 或者在 Xcode 中打开 Package.swift 文件
   ```

3. **配置依赖**
   - 项目使用 Swift Package Manager 管理依赖
   - Xcode 会自动下载和配置依赖包

4. **运行项目**
   - 选择目标设备或模拟器
   - 按下 `Cmd + R` 运行项目

### 开发配置

1. **后端API地址**
   - 在 `APIManager.swift` 中配置 `baseURL`
   - 默认地址: `http://localhost:3001/api`

2. **地图配置**
   - 配置地图服务密钥（如果需要）
   - 设置默认地图区域

3. **推送通知**
   - 配置 APNs 证书
   - 设置推送通知权限

## 📋 开发指南

### 代码规范

- 遵循 Swift 官方编码规范
- 使用 SwiftUI 优先原则
- 实现响应式设计
- 添加完整的代码注释

### 测试

```bash
# 运行单元测试
xcodebuild test -scheme FunnyPixels -destination 'platform=iOS Simulator,name=iPhone 15'

# 运行UI测试
xcodebuild test -scheme FunnyPixelsUITests -destination 'platform=iOS Simulator,name=iPhone 15'
```

### 构建发布

```bash
# 构建Archive
xcodebuild archive -scheme FunnyPixels -destination generic/platform=iOS -archivePath ./FunnyPixels.xcarchive

# 导出IPA
xcodebuild -exportArchive -archivePath ./FunnyPixels.xcarchive -exportPath ./build -exportOptionsPlist ExportOptions.plist
```

## 🔧 依赖包

### 主要依赖

- **Alamofire**: HTTP网络请求库
- **Socket.IO**: 实时通信
- **Realm**: 本地数据库
- **Kingfisher**: 图片加载和缓存
- **KeychainAccess**: 安全存储

### 开发依赖

- **SwiftLint**: 代码规范检查
- **XcodeGen**: 项目文件生成

## 📱 功能模块

### 认证模块 (`AuthViewModel`)

- 手机号验证码登录
- 用户注册
- 游客模式
- Token管理

### 地图模块 (`MapViewModel`)

- 像素创建和编辑
- GPS轨迹跟踪
- 实时位置更新
- 地图交互控制
- 像素详情展示
- 绘制会话管理

### 联盟系统模块 (`AllianceViewModel`)

- 联盟创建和管理
- 成员加入和审核
- 联盟成员管理
- 权限控制
- 联盟搜索

### 排行榜模块 (`LeaderboardViewModel`)

- 用户排行榜
- 联盟排行榜
- 多种指标统计
- 时间筛选
- 实时排名更新

### 绘制历史模块 (`ProfileViewModel`)

- GPS轨迹跟踪
- 绘制历史记录
- 统计分析
- 分享功能
- 历史管理

### 商店模块

- 像素颜色购买
- 道具交易
- 特效购买
- 积分充值

### 个人中心

- 用户资料
- 统计信息
- 设置选项
- 成就展示

## 🔐 安全考虑

- Token安全存储 (Keychain)
- API请求加密
- 用户数据保护
- 网络安全传输

## 📊 性能优化

- 图片懒加载
- 内存管理
- 网络请求优化
- UI响应优化

## 🐛 问题排查

### 常见问题

1. **构建失败**
   - 检查Xcode版本
   - 更新依赖包
   - 清理构建缓存

2. **网络请求失败**
   - 检查API地址配置
   - 确认网络连接
   - 检查SSL证书

3. **地图显示异常**
   - 检查位置权限
   - 确认地图服务配置
   - 验证坐标数据

### 调试技巧

- 使用Logger记录日志
- 开启Debug模式
- 检查网络请求
- 监控内存使用

## 📈 路线图

### v1.0 (当前版本)
- [x] 基础地图功能
- [x] 用户认证系统
- [x] 聊天功能
- [x] 商店系统
- [x] 个人中心

### v1.1 (计划中)
- [ ] 实时协作
- [ ] 高级创作工具
- [ ] 社交功能增强
- [ ] 性能优化

### v2.0 (未来版本)
- [ ] AR功能集成
- [ ] AI辅助创作
- [ ] 多人游戏模式
- [ ] 跨平台支持

## 🤝 贡献指南

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 📞 联系我们

- 项目主页: [GitHub Repository]
- 问题反馈: [Issues Page]
- 技术讨论: [Discussions]

---

**Happy Coding! 🎨✨**