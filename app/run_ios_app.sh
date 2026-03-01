#!/bin/bash

# FunnyPixels iOS App 启动脚本
# 修复 Bundle Identifier 崩溃

set -e

echo "🚀 FunnyPixels iOS App 启动脚本"
echo "================================"

# 切换到项目目录
cd "$(dirname "$0")"

# 颜色输出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 检查模拟器
echo -e "${YELLOW}📱 检查可用的 iOS 模拟器...${NC}"
SIMULATOR=$(xcrun simctl list devices available | grep "iPhone 17 Pro (" | head -1 | sed 's/.*(\(.*\)).*/\1/')

if [ -z "$SIMULATOR" ]; then
    echo -e "${RED}❌ 未找到可用的 iPhone 模拟器${NC}"
    echo "请在 Xcode 中下载 iOS 模拟器"
    exit 1
fi

echo -e "${GREEN}✅ 找到模拟器: $SIMULATOR${NC}"

# 启动模拟器
echo -e "${YELLOW}🔄 启动模拟器...${NC}"
xcrun simctl boot "$SIMULATOR" 2>/dev/null || echo "模拟器已在运行"
open -a Simulator

# 等待模拟器启动
sleep 3

# 清理构建
echo -e "${YELLOW}🧹 清理旧构建...${NC}"
rm -rf .build

# 构建应用
echo -e "${YELLOW}🔨 构建 iOS 应用...${NC}"

# 由于 SPM 不支持 iOS 应用，我们需要创建一个 Xcode 项目
echo -e "${RED}⚠️  Swift Package Manager 不支持构建 iOS 应用${NC}"
echo ""
echo -e "${YELLOW}解决方案：${NC}"
echo "1. 在 Xcode 中打开 Package.swift"
echo "2. 创建新的 iOS App Target:"
echo "   - File → New → Target → iOS App"
echo "   - Product Name: FunnyPixelsApp"
echo "   - Bundle Identifier: com.funnypixels.app"
echo "3. 添加 FunnyPixels 库依赖"
echo "4. 使用以下代码作为应用入口:"
echo ""
cat << 'EOF'
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
EOF

echo ""
echo -e "${GREEN}📖 详细指南：docs/iOS_APP_SETUP.md${NC}"
