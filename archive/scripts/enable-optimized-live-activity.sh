#!/bin/bash

# FunnyPixels Live Activity 优化版本启用脚本
# 用途：一键启用优化后的 GPS Drawing Live Activity

set -e

WIDGET_DIR="FunnyPixelsApp/FunnyPixelsWidget"
ORIGINAL_FILE="GPSDrawingLiveActivity.swift"
OPTIMIZED_FILE="GPSDrawingLiveActivity_Optimized.swift"
BACKUP_FILE="GPSDrawingLiveActivity_Original.swift.backup"

echo "========================================="
echo "🎨 FunnyPixels Live Activity 优化工具"
echo "========================================="
echo ""

# 检查文件是否存在
if [ ! -f "$WIDGET_DIR/$OPTIMIZED_FILE" ]; then
    echo "❌ 错误：优化文件不存在"
    echo "   文件路径：$WIDGET_DIR/$OPTIMIZED_FILE"
    exit 1
fi

# 询问用户
echo "即将执行以下操作："
echo "1. 备份原版文件为：$BACKUP_FILE"
echo "2. 启用优化版本：$OPTIMIZED_FILE -> $ORIGINAL_FILE"
echo ""
read -p "是否继续？(y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ 操作已取消"
    exit 0
fi

cd "$(dirname "$0")"

# 备份原版
if [ -f "$WIDGET_DIR/$ORIGINAL_FILE" ]; then
    echo "📦 备份原版文件..."
    cp "$WIDGET_DIR/$ORIGINAL_FILE" "$WIDGET_DIR/$BACKUP_FILE"
    echo "✅ 备份完成：$BACKUP_FILE"
else
    echo "⚠️  原版文件不存在，跳过备份"
fi

# 复制优化版本
echo "🚀 启用优化版本..."
cp "$WIDGET_DIR/$OPTIMIZED_FILE" "$WIDGET_DIR/$ORIGINAL_FILE"
echo "✅ 优化版本已启用"

echo ""
echo "========================================="
echo "✨ 启用完成！"
echo "========================================="
echo ""
echo "下一步操作："
echo "1. 在 Xcode 中打开项目"
echo "2. Clean Build Folder (Cmd + Shift + K)"
echo "3. 重新构建项目 (Cmd + B)"
echo "4. 运行应用并测试 Live Activity"
echo ""
echo "回滚方法："
echo "  cp $WIDGET_DIR/$BACKUP_FILE $WIDGET_DIR/$ORIGINAL_FILE"
echo ""
echo "查看文档："
echo "  cat $WIDGET_DIR/LIVE_ACTIVITY_OPTIMIZATION.md"
echo ""
