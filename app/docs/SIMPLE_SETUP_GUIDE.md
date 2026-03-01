# 最简单的 iOS App 设置方案

## ✅ 推荐方案：创建独立的 iOS App 项目（5分钟）

**不需要拷贝任何代码！** iOS App 会直接引用现有的 FunnyPixels 库。

---

## 步骤 1：创建新的 iOS App 项目

1. 打开 **Xcode**
2. **File → New → Project**
3. 选择 **iOS → App**
4. 点击 **Next**

## 步骤 2：配置项目信息

填写以下信息：

```
Product Name: FunnyPixelsApp
Team: [选择您的开发团队]
Organization Identifier: com.funnypixels
Bundle Identifier: com.funnypixels.app  ✅ 这个很重要！
Interface: SwiftUI
Language: Swift
Storage: None
```

保存位置：选择 `/Users/ginochow/code/funnypixels3/`（与当前 app 目录平级）

**项目结构将会是：**
```
funnypixels3/
├── app/                          ← 现有的库代码（不动）
│   └── FunnyPixels/
│       └── Sources/
│           └── FunnyPixels/
└── FunnyPixelsApp/               ← 新的 iOS App 项目
    ├── FunnyPixelsApp.xcodeproj
    └── FunnyPixelsApp/
```

## 步骤 3：添加本地包依赖

在新创建的 Xcode 项目中：

1. 选择项目文件（蓝色图标）
2. 选择项目名称（不是 target）
3. 点击 **Package Dependencies** 标签
4. 点击下方的 **+** 按钮
5. 点击 **Add Local...**
6. 选择 `/Users/ginochow/code/funnypixels3/app` 文件夹
7. 点击 **Add Package**
8. 在弹出的对话框中，确保 **FunnyPixels** 被选中
9. 点击 **Add Package**

## 步骤 4：修改 App 入口文件

打开自动生成的 `FunnyPixelsAppApp.swift` 文件，替换为：

```swift
import SwiftUI
import FunnyPixels

@main
struct FunnyPixelsAppApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}
```

## 步骤 5：添加权限说明

1. 选择 `FunnyPixelsApp` target
2. 点击 **Info** 标签
3. 点击 **+** 添加以下键值对：

```
Privacy - Location When In Use Usage Description
值：We need your location to show pixels on the map

Privacy - Location Always and When In Use Usage Description
值：We need your location to track your pixel drawing path
```

或者直接编辑 Info.plist 文件，添加：

```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>We need your location to show pixels on the map</string>
<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
<string>We need your location to track your pixel drawing path</string>
```

## 步骤 6：选择模拟器并运行

1. 在 Xcode 顶部工具栏，点击设备选择器
2. 选择一个 iOS 模拟器（例如：iPhone 17 Pro）
3. 点击 **Run** 按钮（▶️）或按 **⌘R**

---

## ✅ 完成！

您的应用现在应该可以正常启动了，Bundle Identifier 崩溃问题已解决。

## 📊 这个方案的优势

✅ **不需要拷贝代码** - iOS App 直接引用现有库
✅ **代码修改实时生效** - 修改库代码后，App 自动更新
✅ **结构清晰** - 库和应用分离
✅ **Bundle Identifier 正确** - com.funnypixels.app ✅
✅ **支持所有 iOS 功能** - 定位、通知等

## 🔧 故障排除

### 如果构建失败：

1. **检查 MapLibre 依赖**：确保选择的是 iOS 模拟器，不是 Mac
2. **清理构建**：Product → Clean Build Folder (⇧⌘K)
3. **重置包缓存**：File → Packages → Reset Package Caches
4. **检查 Xcode 版本**：需要 Xcode 14+

### 如果包依赖添加失败：

确保主库可以编译：
```bash
cd /Users/ginochow/code/funnypixels3/app
swift build
```

如果有错误，先修复主库的编译问题。

---

## 📝 下一步

成功运行后，您可以：

1. 修改 `app/FunnyPixels/Sources/FunnyPixels/` 中的库代码
2. 在 `FunnyPixelsApp` 项目中添加应用特定的视图和功能
3. 配置应用图标和启动画面
4. 添加更多权限说明（相机、照片等）

祝您开发顺利！🎉
