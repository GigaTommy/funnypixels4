#!/bin/bash

echo "🚀 启动 PixelWar 数据库服务..."

# 检查 Docker 是否运行
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker 未运行，请先启动 Docker"
    exit 1
fi

# 启动数据库服务
echo "📦 启动 PostgreSQL、Redis 和 pgAdmin..."
docker-compose up -d postgres redis pgadmin

# 等待 PostgreSQL 启动
echo "⏳ 等待 PostgreSQL 启动..."
sleep 10

# 检查服务状态
echo "🔍 检查服务状态..."
docker-compose ps

echo ""
echo "✅ 数据库服务启动完成！"
echo ""
echo "📊 服务访问地址："
echo "   PostgreSQL: localhost:5432"
echo "   Redis: localhost:6379"
echo "   pgAdmin: http://localhost:5050"
echo ""
echo "🔑 pgAdmin 登录信息："
echo "   邮箱: admin@pixelwar.com"
echo "   密码: your_admin_password"
echo ""
echo "💡 提示："
echo "   - 首次访问 pgAdmin 会自动连接到 PostgreSQL 数据库"
echo "   - 数据库名: pixelwar_dev"
echo "   - 用户名: postgres"
echo "   - 密码: your_postgres_password"
