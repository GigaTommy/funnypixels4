#!/bin/bash
# /pixelwar/scripts/setup-db.sh

echo "🚀 开始设置数据库..."

# 检查Docker是否运行
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker未运行，请先启动Docker"
    exit 1
fi

# 启动数据库服务
echo "🐘 启动PostgreSQL和Redis..."
docker-compose up -d postgres redis

# 等待数据库启动
echo "⏳ 等待数据库启动..."
sleep 10

# 安装依赖
echo "📦 安装后端依赖..."
cd backend
npm install

# 复制环境变量文件
if [ ! -f .env ]; then
    echo "📝 创建环境变量文件..."
    cp env.example .env
fi

# 运行数据库迁移
echo "🗄️ 运行数据库迁移..."
npm run migrate

# 运行种子数据
echo "🌱 创建种子数据..."
npm run seed

echo "✅ 数据库设置完成！"
echo "📊 PostgreSQL: localhost:5432"
echo "🔴 Redis: localhost:6379"
echo "🚀 后端API: http://localhost:3001"