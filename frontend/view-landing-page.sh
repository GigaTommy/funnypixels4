#!/bin/bash

# FunnyPixels Landing Page 快速启动脚本
# 作者: Claude Sonnet 4.5
# 日期: 2026-03-06

echo "🚀 FunnyPixels Landing Page 启动中..."
echo ""
echo "📦 检查依赖..."

if [ ! -d "node_modules" ]; then
    echo "⚠️  未找到 node_modules，正在安装依赖..."
    npm install
fi

echo ""
echo "✨ 启动开发服务器..."
echo ""
echo "💡 提示："
echo "   - Landing Page: http://localhost:5173/"
echo "   - Game App: http://localhost:5173/app"
echo "   - 隐私政策: http://localhost:5173/privacy-policy"
echo "   - 服务条款: http://localhost:5173/terms"
echo "   - 帮助中心: http://localhost:5173/support"
echo ""
echo "按 Ctrl+C 停止服务器"
echo ""

npm run dev
