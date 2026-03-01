#!/bin/bash

# 创建 iOS 应用 Xcode 项目
set -e

echo "📦 创建 FunnyPixels iOS 应用项目..."

# 创建项目目录
mkdir -p FunnyPixelsIOSApp/FunnyPixelsIOSApp

# 创建 App 入口文件
cat > FunnyPixelsIOSApp/FunnyPixelsIOSApp/FunnyPixelsIOSAppApp.swift << 'EOF'
import SwiftUI
import FunnyPixels

@main
struct FunnyPixelsIOSAppApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}
EOF

# 创建 Assets
mkdir -p FunnyPixelsIOSApp/FunnyPixelsIOSApp/Assets.xcassets/AppIcon.appiconset

cat > FunnyPixelsIOSApp/FunnyPixelsIOSApp/Assets.xcassets/AppIcon.appiconset/Contents.json << 'EOF'
{
  "images" : [
    {
      "idiom" : "universal",
      "platform" : "ios",
      "size" : "1024x1024"
    }
  ],
  "info" : {
    "author" : "xcode",
    "version" : 1
  }
}
EOF

cat > FunnyPixelsIOSApp/FunnyPixelsIOSApp/Assets.xcassets/Contents.json << 'EOF'
{
  "info" : {
    "author" : "xcode",
    "version" : 1
  }
}
EOF

# 创建 Info.plist
cat > FunnyPixelsIOSApp/FunnyPixelsIOSApp/Info.plist << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>CFBundleDevelopmentRegion</key>
	<string>$(DEVELOPMENT_LANGUAGE)</string>
	<key>CFBundleExecutable</key>
	<string>$(EXECUTABLE_NAME)</string>
	<key>CFBundleIdentifier</key>
	<string>com.funnypixels.app</string>
	<key>CFBundleInfoDictionaryVersion</key>
	<string>6.0</string>
	<key>CFBundleName</key>
	<string>$(PRODUCT_NAME)</string>
	<key>CFBundlePackageType</key>
	<string>$(PRODUCT_BUNDLE_PACKAGE_TYPE)</string>
	<key>CFBundleShortVersionString</key>
	<string>1.0</string>
	<key>CFBundleVersion</key>
	<string>1</string>
	<key>LSRequiresIPhoneOS</key>
	<true/>
	<key>NSLocationWhenInUseUsageDescription</key>
	<string>We need your location to show pixels on the map</string>
	<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
	<string>We need your location to track your pixel drawing path</string>
	<key>UIApplicationSceneManifest</key>
	<dict>
		<key>UIApplicationSupportsMultipleScenes</key>
		<false/>
	</dict>
	<key>UILaunchScreen</key>
	<dict/>
	<key>UISupportedInterfaceOrientations</key>
	<array>
		<string>UIInterfaceOrientationPortrait</string>
		<string>UIInterfaceOrientationLandscapeLeft</string>
		<string>UIInterfaceOrientationLandscapeRight</string>
	</array>
	<key>UISupportedInterfaceOrientations~ipad</key>
	<array>
		<string>UIInterfaceOrientationPortrait</string>
		<string>UIInterfaceOrientationPortraitUpsideDown</string>
		<string>UIInterfaceOrientationLandscapeLeft</string>
		<string>UIInterfaceOrientationLandscapeRight</string>
	</array>
</dict>
</plist>
EOF

# 创建 Package.swift 用于引用主库
cat > FunnyPixelsIOSApp/Package.swift << 'EOF'
// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "FunnyPixelsIOSApp",
    platforms: [.iOS(.v16)],
    dependencies: [
        .package(path: "..")
    ],
    targets: [
        .executableTarget(
            name: "FunnyPixelsIOSApp",
            dependencies: [
                .product(name: "FunnyPixels", package: "app")
            ],
            path: "FunnyPixelsIOSApp"
        )
    ]
)
EOF

echo "✅ iOS 应用项目结构已创建！"
echo ""
echo "下一步："
echo "1. cd FunnyPixelsIOSApp"
echo "2. open Package.swift"
echo "3. 在 Xcode 中选择 iOS 模拟器并运行"
