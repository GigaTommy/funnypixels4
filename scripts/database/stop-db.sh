#!/bin/bash

echo "🛑 停止 PixelWar 数据库服务..."

# 停止所有服务
docker-compose down

echo "✅ 数据库服务已停止！"
echo ""
echo "💡 提示："
echo "   - 数据已保存到 Docker volumes"
echo "   - 如需完全清理数据，请运行: docker-compose down -v"
