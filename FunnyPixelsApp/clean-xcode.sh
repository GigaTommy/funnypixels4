#!/bin/bash

echo "🧹 清理 Xcode 缓存和索引..."

# 1. 检查 Xcode 是否在运行
if pgrep -x "Xcode" > /dev/null; then
    echo "⚠️  请先关闭 Xcode"
    echo "正在等待 Xcode 关闭..."
    while pgrep -x "Xcode" > /dev/null; do
        sleep 1
    done
    echo "✅ Xcode 已关闭"
fi

# 2. 清理派生数据
echo "🗑️  删除派生数据..."
rm -rf ~/Library/Developer/Xcode/DerivedData/FunnyPixelsApp-*

# 3. 清理索引
echo "🗑️  删除索引文件..."
rm -rf ~/Library/Developer/Xcode/DerivedData/*/Index*

# 4. 清理 SPM 缓存
echo "🗑️  清理 Swift Package Manager 缓存..."
rm -rf ~/Library/Caches/org.swift.swiftpm/

# 5. 清理本地构建
echo "🗑️  清理本地构建文件..."
cd /Users/ginochow/code/funnypixels3/FunnyPixelsApp
rm -rf .build

# 6. 显示清理的空间
echo ""
echo "✅ 清理完成！"
echo ""
echo "现在可以重新打开 Xcode："
echo "  open FunnyPixelsApp.xcodeproj"
echo ""
echo "首次打开后，Xcode 会重新构建索引（2-5 分钟）"
echo "请耐心等待 'Preparing Editor Functionality' 完成"
