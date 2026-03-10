#!/bin/bash

echo "🧹 清理 Xcode 缓存和构建文件..."
echo ""

# 1. 删除项目级 DerivedData
echo "1️⃣ 删除 DerivedData..."
rm -rf ~/Library/Developer/Xcode/DerivedData/FunnyPixelsApp-*
echo "✅ DerivedData 已删除"
echo ""

# 2. 清理项目构建缓存
echo "2️⃣ 清理项目构建缓存..."
cd /Users/ginochow/code/funnypixels3/FunnyPixelsApp
xcodebuild clean -project FunnyPixelsApp.xcodeproj -scheme FunnyPixelsApp 2>&1 | grep -E "(CLEAN|SUCCESS|error)" | head -5
echo "✅ 项目缓存已清理"
echo ""

# 3. 删除模块缓存
echo "3️⃣ 删除模块缓存..."
rm -rf ~/Library/Developer/Xcode/DerivedData/ModuleCache.noindex
echo "✅ 模块缓存已删除"
echo ""

echo "========================================="
echo "✅ 清理完成！"
echo ""
echo "📱 下一步操作："
echo "1. 在 Xcode 中: Product → Clean Build Folder (Cmd+Shift+K)"
echo "2. 完全退出 Xcode (Cmd+Q)"
echo "3. 重新打开 Xcode"
echo "4. Product → Run (Cmd+R)"
echo ""
echo "App 启动后,查看控制台的设备令牌应该是 64 字符"
echo "========================================="
