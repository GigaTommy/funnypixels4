#!/bin/bash

# 自动创建 iOS App 项目并配置依赖
set -e

echo "🚀 创建 FunnyPixels iOS 应用..."
echo "================================"

# 项目配置
APP_NAME="FunnyPixelsApp"
BUNDLE_ID="com.funnypixels.app"
ORG_NAME="FunnyPixels"
DEPLOYMENT_TARGET="16.0"

# 创建项目目录
mkdir -p "$APP_NAME"
cd "$APP_NAME"

echo "📦 创建项目结构..."

# 创建源代码目录
mkdir -p "$APP_NAME"

# 创建 App 入口文件
cat > "$APP_NAME/${APP_NAME}App.swift" << 'EOF'
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
EOF

# 创建 Assets.xcassets
mkdir -p "$APP_NAME/Assets.xcassets/AppIcon.appiconset"
mkdir -p "$APP_NAME/Assets.xcassets/AccentColor.colorset"

cat > "$APP_NAME/Assets.xcassets/AppIcon.appiconset/Contents.json" << 'EOF'
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

cat > "$APP_NAME/Assets.xcassets/AccentColor.colorset/Contents.json" << 'EOF'
{
  "colors" : [
    {
      "idiom" : "universal"
    }
  ],
  "info" : {
    "author" : "xcode",
    "version" : 1
  }
}
EOF

cat > "$APP_NAME/Assets.xcassets/Contents.json" << 'EOF'
{
  "info" : {
    "author" : "xcode",
    "version" : 1
  }
}
EOF

# 创建 Info.plist (使用属性列表)
cat > "$APP_NAME/Info.plist" << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>NSLocationWhenInUseUsageDescription</key>
	<string>We need your location to show pixels on the map</string>
	<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
	<string>We need your location to track your pixel drawing path</string>
</dict>
</plist>
EOF

# 创建 Xcode 项目文件
cat > "project.pbxproj" << 'PBXEOF'
// !$*UTF8*$!
{
	archiveVersion = 1;
	classes = {
	};
	objectVersion = 56;
	objects = {
PBXEOF

echo "⚠️  无法通过脚本创建完整的 .xcodeproj 文件"
echo ""
echo "✅ 已创建项目目录和源文件"
echo ""
echo "🎯 请使用 Xcode 完成项目创建："
echo ""
echo "1. 打开 Xcode"
echo "2. File → New → Project"
echo "3. 选择 iOS → App"
echo "4. 配置:"
echo "   - Product Name: FunnyPixelsApp"
echo "   - Team: 选择您的开发团队"
echo "   - Organization Identifier: com.funnypixels"
echo "   - Bundle Identifier: com.funnypixels.app"
echo "   - Interface: SwiftUI"
echo "   - Language: Swift"
echo "   - 保存位置: $(pwd)"
echo ""
echo "5. 项目创建后，添加本地包依赖:"
echo "   - File → Add Package Dependencies"
echo "   - 点击 'Add Local...'"
echo "   - 选择: /Users/ginochow/code/funnypixels3/app"
echo "   - 添加 FunnyPixels 产品到 target"
echo ""
echo "6. 替换自动生成的 App 文件:"
echo "   - 使用 $APP_NAME/${APP_NAME}App.swift"
echo "   - 引用 ../FunnyPixels/Sources/FunnyPixelsApp/FunnyPixelsApp.swift"
echo ""
echo "7. 运行应用 (⌘R)"

