# iOS 模拟器快速测试指南

## 最简单的方法：在 Xcode 中创建 iOS App target

### 步骤 1: 在 Xcode 中添加 iOS Target

1. 在已打开的 Xcode 中，点击项目导航器中的项目文件（蓝色图标）
2. 点击底部的 "+" 按钮（或者 File → New → Target）
3. 选择 "iOS" → "Application"
4. 选择 "App" → 点击 "Next"
5. 填写信息：
   - Product Name: `FunnySimulator`
   - Team: 选择你的 Apple ID（免费即可）
   - Organization Identifier: `com.funnypixels`
   - Bundle Identifier: 会自动生成
   - Language: Swift
   - Platform: iOS
   - 取消 "Include Tests"
6. 点击 "Finish"

### 步骤 2: 配置新 Target

1. 在项目设置中，选择新创建的 `FunnySimulator` target
2. "General" 标签 → "Frameworks, Libraries, and Embedded Content"
3. 点击 "+" 号
4. 在列表中选择 `FunnyPixels` library
5. 在 "Build Phases" → "Dependencies" 中添加 `FunnyPixels`

### 步骤 3: 修改 App 文件

打开 `FunnySimulatorApp.swift`，替换为：

```swift
import SwiftUI
import FunnyPixels

@main
struct FunnySimulatorApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}
```

### 步骤 4: 配置权限

Target → Info 标签 → 添加：
- `Privacy - Location When In Use Usage Description`: 需要位置权限用于GPS绘制像素

### 步骤 5: 运行

1. 顶部 scheme 选择器选择 "FunnySimulator"
2. 设备选择器选择任意 iPhone 模拟器
3. 点击 Run（▶️）

## 模拟器限制

模拟器**无法测试**的功能：
- GPS 实际定位（只能使用模拟位置）
- 相机拍照
- 后台位置更新

这些功能需要真机测试。

## 快捷方式：直接用命令行运行 macOS 版本

```bash
swift run FunnyPixelsApp
```

这会运行 macOS 版本，可以快速验证 UI 和基本逻辑。
