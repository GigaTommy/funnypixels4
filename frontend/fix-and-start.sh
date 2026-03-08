#!/bin/bash

echo "🧹 清理缓存和依赖..."

# 停止所有运行中的 vite 进程
pkill -f "vite" || true

# 清理缓存
rm -rf node_modules/.vite
rm -rf node_modules/.cache
rm -rf .parcel-cache
rm -rf dist

echo "✅ 缓存已清理"
echo ""
echo "🚀 启动开发服务器..."
echo ""
echo "💡 访问地址："
echo "   Landing Page: http://localhost:5173/"
echo "   Game App: http://localhost:5173/app"
echo ""
echo "按 Ctrl+C 停止服务器"
echo ""

npm run dev
