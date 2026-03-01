# iOS App 配置指南 - 修复 Bundle Identifier 崩溃

## 问题诊断

您遇到的崩溃是因为：
```
__BKSHIDEvent__BUNDLE_IDENTIFIER_FOR_CURRENT_PROCESS_IS_NIL__
missing bundleID for main bundle
```

**根本原因**：
1. Swift Package Manager 的可执行目标默认只支持 macOS
2. MapLibre 依赖只支持 iOS，不支持 macOS
3. iOS 应用需要正确的 App Bundle 和 Bundle Identifier

## 解决方案：在 Xcode 中创建 iOS App Target

### 步骤 1: 打开项目

```bash
cd /Users/ginochow/code/funnypixels3/app
open Package.swift
```

### 步骤 2: 创建新的 iOS App Target

1. 在 Xcode 中，选择 **File → New → Target**
2. 选择 **iOS → App**
3. 配置如下：
   - **Product Name**: `FunnyPixelsApp`
   - **Team**: 选择您的开发团队
   - **Organization Identifier**: `com.funnypixels`
   - **Bundle Identifier**: `com.funnypixels.app`
   - **Interface**: SwiftUI
   - **Language**: Swift
   - **Storage**: None

### 步骤 3: 配置 Target 依赖

1. 选择新创建的 `FunnyPixelsApp` target
2. 进入 **Build Phases** 标签
3. 在 **Dependencies** 部分，点击 **+** 按钮
4. 添加 `FunnyPixels` 库

### 步骤 4: 配置 Info.plist

在 `FunnyPixelsApp` target 的 **Info** 标签中，确保以下键值存在：

```xml
<key>CFBundleIdentifier</key>
<string>com.funnypixels.app</string>

<key>NSLocationWhenInUseUsageDescription</key>
<string>We need your location to show pixels on the map</string>

<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
<string>We need your location to track your pixel drawing path</string>

<key>UILaunchScreen</key>
<dict/>
```

### 步骤 5: 使用现有的 App 入口点

1. 将 `FunnyPixels/Sources/FunnyPixelsApp/FunnyPixelsApp.swift` 添加到新 target
2. 或者在新 target 中创建入口点：

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

### 步骤 6: 配置 Package 依赖

1. 选择项目（顶层）
2. 进入 **Package Dependencies** 标签
3. 确保所有依赖包已添加：
   - Alamofire
   - SocketIO
   - Realm
   - Kingfisher
   - KeychainAccess
   - SwiftDependencies
   - SwiftLog
   - ComposableArchitecture
   - MapLibre

4. 为 `FunnyPixelsApp` target 链接这些包

### 步骤 7: 构建并运行

1. 选择 iOS 模拟器作为目标设备（例如 iPhone 17 Pro）
2. 点击 **Product → Run** 或按 **⌘R**

## 快速方案：使用命令行构建

如果您已经在 Xcode 中配置好了 iOS App target：

```bash
# 构建
xcodebuild -scheme FunnyPixelsApp \
    -destination 'platform=iOS Simulator,name=iPhone 17 Pro' \
    build

# 运行
xcodebuild -scheme FunnyPixelsApp \
    -destination 'platform=iOS Simulator,name=iPhone 17 Pro' \
    -derivedDataPath build \
    test
```

## 验证 Bundle Identifier

构建成功后，检查 app bundle：

```bash
# 查找生成的 .app
find ~/Library/Developer/Xcode/DerivedData -name "FunnyPixelsApp.app" -type d | head -1

# 检查 Info.plist
plutil -p $(find ~/Library/Developer/Xcode/DerivedData -name "FunnyPixelsApp.app" -type d | head -1)/Info.plist | grep CFBundleIdentifier
```

应该显示：
```
"CFBundleIdentifier" => "com.funnypixels.app"
```

## 当前状态总结

✅ **Swift 代码编译成功**
✅ **所有语法错误已修复**
✅ **Info.plist 文件已准备好** (`FunnyPixels/Sources/FunnyPixelsApp/Info.plist`)
⚠️  **需要在 Xcode 中创建 iOS App target**（SPM 限制）

## 替代方案：使用 XcodeGen（如果网络正常）

如果您可以访问 Homebrew：

```bash
brew install xcodegen
cd /Users/ginochow/code/funnypixels3/app
xcodegen
open FunnyPixels.xcodeproj
```

我已经为您创建了 `project.yml` 配置文件。

## 下一步

请在 Xcode 中按照步骤 1-7 创建 iOS App target，然后就可以正常运行应用了。如果遇到任何问题，请告诉我！
