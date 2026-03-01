# FunnyPixels iOS 真机测试指南

## 环境配置完成状态

- ✅ Xcode 已安装
- ✅ 环境配置支持真机测试 IP 设置
- ⚠️ 需要配置 Xcode 开发者目录（需要密码）
- ⚠️ 需要创建 Xcode iOS App 项目

## 前置步骤（在终端执行）

### 1. 配置 Xcode 开发者目录

```bash
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
sudo xcodebuild -license
```

### 2. 获取你的 Mac 本地 IP 地址

```bash
ipconfig getifaddr en0
# 输出示例: 192.168.0.3
```

**记录这个 IP 地址**，真机需要通过它访问本地后端服务。

---

## 创建 Xcode 项目的步骤

由于这是一个 Swift Package Manager 项目，需要创建一个 Xcode iOS App 项目来在真机上运行。

### 方法：手动创建 iOS App 项目

1. **打开 Xcode**
   ```
   open -a Xcode
   ```

2. **创建新项目**
   - File → New → Project
   - 选择 "iOS" → "App"
   - 点击 "Next"

3. **填写项目信息**
   - Product Name: `FunnyPixels`
   - Team: 选择你的 Apple Developer 账号（或免费账号）
   - Organization Identifier: `com.funnypixels`（或你的域名）
   - Bundle Identifier: `com.funnypixels.FunnyPixels`
   - Interface: SwiftUI
   - Language: Swift
   - Storage: None
   - 取消勾选 "Include Tests"
   - 点击 "Next"

4. **保存位置**
   - 选择 `/Users/ginochow/code/funnypixels3/app/FunnyPixels/XcodeProject`
   - 取消勾选 "Create Git repository"
   - 点击 "Create"

5. **添加 Swift Package**
   - 在 Xcode 项目导航器中，点击项目文件
   - 选择 "FunnyPixels" target
   - 切换到 "Package Dependencies" 标签
   - 点击 "+" 按钮
   - 选择 "Add Local..."
   - 选择 `/Users/ginochow/code/funnypixels3/app/FunnyPixels` 目录
   - 点击 "Add"

6. **修改 App 文件**
   - 打开 `FunnyiOSApp.swift`（或 `ContentView.swift`）
   - 替换为以下内容：

```swift
import SwiftUI
import FunnyPixels

@main
struct FunnyPixelsApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}
```

7. **配置 Info.plist**
   - 在 Xcode 中添加以下权限描述：
   - Target → Info 标签 → Custom iOS Target Properties
   - 添加以下键值：

```
Key: Privacy - Location When In Use Usage Description
Value: 需要位置权限用于GPS绘制像素

Key: Privacy - Location Always and When In Use Usage Description
Value: 需要位置权限用于后台GPS绘制

Key: Privacy - Photo Library Usage Description
Value: 需要访问相册以选择图片

Key: Required background modes
Value: App registers for location updates (location)
```

8. **配置开发环境 IP（用于真机连接本地后端）**

   在 `FunnyiOSApp.swift` 的 `@main` 结构体中添加环境配置：

```swift
import SwiftUI
import FunnyPixels

@main
struct FunnyPixelsApp: App {
    init() {
        #if DEBUG
        // 设置开发环境的 API IP（真机测试用）
        // 将 192.168.0.3 替换为你的 Mac 本地 IP
        AppEnvironment.setDevelopmentAPIIP("192.168.0.3")
        #endif
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}
```

**重要**：
- 将 `192.168.0.3` 替换为你 Mac 的实际本地 IP（通过 `ipconfig getifaddr en0` 获取）
- 确保 iPhone 和 Mac 连接在**同一 Wi-Fi 网络**
- 确保后端服务运行在 Mac 的 3001 端口，并监听所有网络接口（`0.0.0.0`）

9. **配置代码签名**
   - Target → Signing & Capabilities
   - 勾选 "Automatically manage signing"
   - 选择你的 Team

10. **连接设备并运行**
   - 用 USB 连接 iPhone 到 Mac
   - 在 Xcode 顶部选择你的设备
   - 点击 Run 按钮（或按 Cmd+R）

## 常见问题

### 1. "Could not launch 'FunnyPixels'"
解决：在 iPhone 上打开 设置 → 通用 → VPN与设备管理 → 信任开发者证书

### 2. "Failed to register bundle identifier"
解决：检查 Bundle Identifier 是否唯一，可修改为 `com.yourname.funnypixels`

### 3. "Provisioning profile doesn't include signing certificate"
解决：在 Xcode 中 → Preferences → Accounts → 下载手动配置文件

### 4. 免费账号限制
- 免费 Apple ID 每周最多 3 个 app
- app 7 天后过期
- 无法使用推送通知等高级功能

### 5. "Cannot connect to server" 或网络请求失败
检查：
1. iPhone 和 Mac 是否在同一 Wi-Fi 网络
2. 后端服务是否正在运行（端口 3001）
3. 后端是否监听所有网络接口（`0.0.0.0`，不只是 `localhost`）
4. Mac 防火墙是否阻止了 3001 端口

**检查后端是否可访问**：
在 iPhone 的 Safari 浏览器中访问 `http://192.168.0.3:3001/api/health`（替换为你的 IP）

### 6. 查看当前配置的 API 地址
在 Xcode 控制台或添加调试代码查看：
```swift
print("API URL: \(AppEnvironment.current.apiBaseURL)")
print("WS URL: \(AppEnvironment.current.wsURL)")
```

---

## 后端服务配置

确保你的后端服务监听所有网络接口：

### Node.js / Express 示例
```javascript
app.listen(3001, '0.0.0.0', () => {
    console.log('Server running on http://0.0.0.0:3001');
});
```

### 检查 Mac 防火墙
系统设置 → 网络 → 防火墙 → 防火墙选项
确保允许传入连接或为你的 Node.js/后端添加例外

---

## 快速参考命令

```bash
# 获取 Mac 本地 IP
ipconfig getifaddr en0

# 配置 Xcode 开发者目录
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer

# 查看连接的设备
xcrun xctrace list devices

# 清理 Xcode 缓存（如有需要）
rm -rf ~/Library/Developer/Xcode/DerivedData/*
```
