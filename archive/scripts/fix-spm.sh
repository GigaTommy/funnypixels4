#!/bin/bash

echo "🧹 清理 Xcode SPM 缓存..."

# 进入项目目录
cd /Users/ginochow/code/funnypixels3

echo "1️⃣ 删除 DerivedData..."
rm -rf ~/Library/Developer/Xcode/DerivedData/FunnyPixelsApp-*

echo "2️⃣ 清理项目 Build 文件夹..."
rm -rf Build/

echo "3️⃣ 清理 app 目录下的 .build 文件夹..."
rm -rf app/.build/
rm -rf app/FunnyPixels/.build/

echo "4️⃣ 清理 SPM 缓存..."
rm -rf ~/Library/Caches/org.swift.swiftpm/
rm -rf ~/Library/org.swift.swiftpm/

echo "5️⃣ 重置 SPM Package..."
cd app
swift package reset
swift package resolve

echo "✅ 清理完成！"
echo ""
echo "📝 下一步："
echo "   1. 打开 Xcode"
echo "   2. 等待包自动解析（这可能需要几分钟）"
echo "   3. 如果还是卡住，尝试：File -> Packages -> Reset Package Caches"
