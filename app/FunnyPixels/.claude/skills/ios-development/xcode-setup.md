# Xcode Setup & Build Skill

**描述**: 自动配置Xcode工程基础设置和验证构建系统

**使用场景**:
- 初始化iOS项目配置
- 配置Bundle ID、Scheme、环境变量
- 验证xcodebuild命令行构建能力
- 设置Debug/Release配置

**参数**:
- `bundle_id` (可选): Bundle Identifier，默认为当前配置
- `scheme` (可选): Xcode Scheme名称，默认自动检测
- `environment` (可选): dev/staging/prod

**实现步骤**:

## 1. 检查Xcode工程配置

```bash
#!/bin/bash

PROJECT_ROOT="."
XCODEPROJ=$(find . -name "*.xcodeproj" -maxdepth 2 | head -1)
XCWORKSPACE=$(find . -name "*.xcworkspace" -maxdepth 2 | head -1)

if [ -n "$XCWORKSPACE" ]; then
    BUILD_TARGET="-workspace $XCWORKSPACE"
elif [ -n "$XCODEPROJ" ]; then
    BUILD_TARGET="-project $XCODEPROJ"
else
    echo "❌ No Xcode project found"
    exit 1
fi

echo "✅ Found Xcode project: $BUILD_TARGET"
```

## 2. 验证和配置Scheme

```bash
# 列出所有可用的schemes
xcodebuild -list $BUILD_TARGET

# 选择或确认scheme
SCHEME=$(xcodebuild -list $BUILD_TARGET | grep -A 100 "Schemes:" | grep -v "Schemes:" | grep -v "^$" | head -1 | xargs)

echo "Using Scheme: $SCHEME"

# 确保Scheme是Shared的
if [ ! -f "$XCODEPROJ/xcshareddata/xcschemes/$SCHEME.xcscheme" ]; then
    echo "⚠️  Scheme is not shared. Making it shared..."
    # 在Xcode中需要手动操作：Manage Schemes -> 勾选 Shared
fi
```

## 3. 配置Bundle ID

```bash
# 读取当前Bundle ID
BUNDLE_ID=$(xcodebuild -showBuildSettings $BUILD_TARGET -scheme "$SCHEME" | grep PRODUCT_BUNDLE_IDENTIFIER | awk '{print $3}' | head -1)

echo "Current Bundle ID: $BUNDLE_ID"

# 如果需要修改Bundle ID（需要提供新的ID）
if [ -n "$NEW_BUNDLE_ID" ]; then
    echo "Updating Bundle ID to: $NEW_BUNDLE_ID"
    # 需要修改 .xcodeproj/project.pbxproj 或使用 PlistBuddy
    /usr/libexec/PlistBuddy -c "Set :CFBundleIdentifier $NEW_BUNDLE_ID" "Info.plist"
fi
```

## 4. 配置环境变量

在Xcode中为不同环境配置Build Settings：

```swift
// Sources/FunnyPixels/Config/Environment.swift
public enum AppEnvironment {
    case development
    case staging
    case production

    static var current: AppEnvironment {
        #if DEBUG
        return .development
        #elseif STAGING
        return .staging
        #else
        return .production
        #endif
    }

    var apiBaseURL: String {
        switch self {
        case .development:
            return "http://localhost:3000"
        case .staging:
            return "https://staging-api.funnypixels.com"
        case .production:
            return "https://api.funnypixels.com"
        }
    }
}
```

## 5. 验证Simulator构建

```bash
echo "🔨 Building for iOS Simulator..."

xcodebuild \
    $BUILD_TARGET \
    -scheme "$SCHEME" \
    -configuration Debug \
    -destination 'platform=iOS Simulator,name=iPhone 15,OS=17.0' \
    -derivedDataPath .build/simulator \
    clean build

if [ $? -eq 0 ]; then
    echo "✅ Simulator build successful"
else
    echo "❌ Simulator build failed"
    exit 1
fi
```

## 6. 验证真机构建（需要证书）

```bash
echo "🔨 Building for iOS Device..."

# 检查是否有可用的证书
SIGNING_IDENTITY=$(security find-identity -v -p codesigning | grep "iPhone Developer" | head -1 | awk '{print $2}')

if [ -z "$SIGNING_IDENTITY" ]; then
    echo "⚠️  No iOS signing identity found"
    echo "Please configure signing in Xcode or provide provisioning profile"
    exit 1
fi

xcodebuild \
    $BUILD_TARGET \
    -scheme "$SCHEME" \
    -configuration Debug \
    -destination 'generic/platform=iOS' \
    -derivedDataPath .build/device \
    CODE_SIGN_IDENTITY="$SIGNING_IDENTITY" \
    clean build

if [ $? -eq 0 ]; then
    echo "✅ Device build successful"
else
    echo "❌ Device build failed"
    exit 1
fi
```

## 7. 配置Debug/Release

创建 `.xcconfig` 文件：

```bash
# Config/Debug.xcconfig
SWIFT_ACTIVE_COMPILATION_CONDITIONS = DEBUG
GCC_PREPROCESSOR_DEFINITIONS = DEBUG=1
SWIFT_OPTIMIZATION_LEVEL = -Onone

# Config/Release.xcconfig
SWIFT_ACTIVE_COMPILATION_CONDITIONS = RELEASE
SWIFT_OPTIMIZATION_LEVEL = -O -whole-module-optimization
```

## 8. 生成构建报告

```bash
cat > build_report.md << EOF
# Xcode Build Configuration Report

**生成时间**: $(date)
**Project**: $BUILD_TARGET
**Scheme**: $SCHEME
**Bundle ID**: $BUNDLE_ID

## Build Targets

- ✅ iOS Simulator (Debug)
- ✅ iOS Device (Debug)

## Configuration

\`\`\`
Swift Version: $(swift --version)
Xcode Version: $(xcodebuild -version)
\`\`\`

## Next Steps

1. 在Xcode中打开项目并验证Scheme设置
2. 配置Team和Signing
3. 开始开发功能
EOF

echo "📊 Build report generated: build_report.md"
```

## 验收标准

- ✅ `xcodebuild -list` 可以列出schemes
- ✅ Scheme是Shared的
- ✅ Bundle ID已正确配置
- ✅ Simulator构建成功
- ✅ 环境配置文件已创建
- ✅ Debug/Release配置正确

## 故障排除

### 问题: No schemes found

```bash
# 在Xcode中：Product -> Scheme -> Manage Schemes -> 勾选 Shared
# 或者使用Swift Package Manager
swift package generate-xcodeproj
```

### 问题: Signing identity not found

```bash
# 方法1: 在Xcode中配置自动签名
# Signing & Capabilities -> Automatically manage signing

# 方法2: 手动配置
# 下载Provisioning Profile
# 配置CODE_SIGN_IDENTITY和PROVISIONING_PROFILE
```

### 问题: Build failed with errors

```bash
# 查看详细错误
xcodebuild -showBuildSettings $BUILD_TARGET -scheme "$SCHEME"

# 清理构建缓存
rm -rf ~/Library/Developer/Xcode/DerivedData
rm -rf .build
```

## 使用示例

```bash
# 运行完整配置
./.claude/skills/ios-development/run_xcode_setup.sh

# 仅验证构建
./.claude/skills/ios-development/run_xcode_setup.sh --verify-only

# 配置特定环境
./.claude/skills/ios-development/run_xcode_setup.sh --env=staging
```

## 依赖工具

- Xcode Command Line Tools
- xcodebuild
- PlistBuddy
- security (keychain)

## 输出文件

- `build_report.md` - 构建配置报告
- `.build/` - 构建产物目录
- `Config/*.xcconfig` - 环境配置文件
