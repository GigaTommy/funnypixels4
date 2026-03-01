#!/bin/bash

echo "🔄 重置 PixelWar 数据库..."

# 停止并删除所有容器和卷
echo "🗑️  清理所有数据..."
docker-compose down -v

# 重新启动服务
echo "🚀 重新启动数据库服务..."
docker-compose up -d postgres redis pgadmin

# 等待 PostgreSQL 启动
echo "⏳ 等待 PostgreSQL 启动..."
sleep 15

# 运行数据库迁移
echo "📊 运行数据库迁移..."
cd backend
npm run migrate

echo ""
echo "✅ 数据库重置完成！"
echo ""
echo "📊 服务访问地址："
echo "   PostgreSQL: localhost:5432"
echo "   Redis: localhost:6379"
echo "   pgAdmin: http://localhost:5050"
echo ""
echo "🔑 pgAdmin 登录信息："
echo "   邮箱: admin@pixelwar.com"
echo "   密码: your_admin_password"
