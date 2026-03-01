#!/bin/bash

# FunnyPixels Logo 更新脚本
# 用途：将虚拟Logo替换为实际项目Logo设计

set -e

WIDGET_DIR="FunnyPixelsApp/FunnyPixelsWidget"
OLD_ICONS="LiveActivitySVGIcons.swift"
NEW_ICONS="LiveActivitySVGIcons_Updated.swift"
BACKUP_ICONS="LiveActivitySVGIcons_Old.swift.backup"

echo "========================================="
echo "🎨 FunnyPixels Logo 更新工具"
echo "========================================="
echo ""

# 检查文件是否存在
if [ ! -f "$WIDGET_DIR/$NEW_ICONS" ]; then
    echo "❌ 错误：新Logo文件不存在"
    echo "   文件路径：$WIDGET_DIR/$NEW_ICONS"
    exit 1
fi

echo "📋 Logo设计方案："
echo ""
echo "  ⭐ 方案1: 地图定位标记 + 像素点 (推荐)"
echo "     - GPS定位标记形状"
echo "     - 中心像素方块"
echo "     - 品牌色渐变圆环"
echo ""
echo "  📝 方案2: 像素风格字母 F"
echo "     - FunnyPixels首字母"
echo "     - 复古像素游戏风"
echo "     - 极简主义设计"
echo ""
echo "  🎨 方案3: 画笔 + 像素轨迹"
echo "     - 画笔工具"
echo "     - 绘制轨迹效果"
echo "     - 动态视觉"
echo ""
echo "默认使用: 方案1 (地图定位标记)"
echo ""
read -p "是否继续更新？(y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ 操作已取消"
    exit 0
fi

cd "$(dirname "$0")"

# 备份原版
if [ -f "$WIDGET_DIR/$OLD_ICONS" ]; then
    echo "📦 备份旧版Logo文件..."
    cp "$WIDGET_DIR/$OLD_ICONS" "$WIDGET_DIR/$BACKUP_ICONS"
    echo "✅ 备份完成：$BACKUP_ICONS"
else
    echo "⚠️  旧版文件不存在，跳过备份"
fi

# 替换为新版
echo "🚀 启用新版Logo..."
cp "$WIDGET_DIR/$NEW_ICONS" "$WIDGET_DIR/$OLD_ICONS"
echo "✅ 新版Logo已启用"

echo ""
echo "========================================="
echo "✨ Logo更新完成！"
echo "========================================="
echo ""
echo "当前使用: 方案1 (地图定位标记)"
echo ""
echo "如需切换Logo方案："
echo "  1. 打开 $WIDGET_DIR/$OLD_ICONS"
echo "  2. 找到 FunnyPixelsLogoIcon 结构"
echo "  3. 修改 body 中的 Logo Style"
echo ""
echo "可选方案："
echo "  - PixelMapPinLogoStyle(size: s)     // 方案1 (当前)"
echo "  - PixelLetterFLogoStyle(size: s)    // 方案2"
echo "  - PixelBrushMapLogoStyle(size: s)   // 方案3"
echo ""
echo "查看设计说明："
echo "  cat $WIDGET_DIR/LOGO_SELECTION_GUIDE.md"
echo ""
echo "下一步："
echo "  1. 在 Xcode 中 Clean Build Folder (Cmd+Shift+K)"
echo "  2. 重新构建项目 (Cmd+B)"
echo "  3. 运行应用查看新Logo效果"
echo ""
echo "预览Logo："
echo "  在 Xcode 中打开 $WIDGET_DIR/$OLD_ICONS"
echo "  查看 #Preview(\"Logo Styles\") 实时预览"
echo ""
