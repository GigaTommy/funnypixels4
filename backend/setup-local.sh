#!/bin/bash

# FunnyPixels Backend 本地开发环境快速启动脚本
# 使用方法：cd backend && chmod +x setup-local.sh && ./setup-local.sh

set -e  # 遇到错误立即退出

echo "🚀 FunnyPixels Backend 本地环境设置"
echo "=================================="

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 步骤 1: 检查 Docker
echo ""
echo "📦 步骤 1/6: 检查 Docker 环境..."
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker 未安装${NC}"
    echo "请先安装 Docker Desktop for Mac"
    exit 1
fi

if ! docker info &> /dev/null; then
    echo -e "${YELLOW}⚠️  Docker 未运行，正在启动 Docker...${NC}"
    open -a Docker
    echo "等待 Docker 启动（30秒）..."
    sleep 30
fi

echo -e "${GREEN}✅ Docker 已就绪${NC}"

# 步骤 2: 启动数据库服务
echo ""
echo "🗄️  步骤 2/6: 启动数据库服务..."
cd "$(dirname "$0")/.."

if ! docker ps | grep -q "funnypixels_postgres"; then
    echo "启动 PostgreSQL 和 Redis..."
    docker-compose up -d postgres redis

    echo "等待数据库启动（10秒）..."
    sleep 10
else
    echo -e "${GREEN}✅ 数据库已在运行${NC}"
fi

# 步骤 3: 安装依赖
echo ""
echo "📚 步骤 3/6: 检查后端依赖..."
cd backend

if [ ! -d "node_modules" ]; then
    echo "安装 NPM 依赖..."
    npm install
else
    echo -e "${GREEN}✅ 依赖已安装${NC}"
fi

# 步骤 4: 配置环境变量
echo ""
echo "⚙️  步骤 4/6: 配置环境变量..."

if [ ! -f ".env.local" ]; then
    echo -e "${YELLOW}⚠️  未找到 .env.local${NC}"
    echo "使用默认配置..."
fi

# 导出环境变量
export $(grep -v '^#' .env 2>/dev/null | xargs)
export $(grep -v '^#' .env.local 2>/dev/null | xargs)

export LOCAL_VALIDATION=true

echo -e "${GREEN}✅ 环境变量已配置${NC}"

# 步骤 5: 运行数据库迁移
echo ""
echo "🔄 步骤 5/6: 运行数据库迁移..."

echo "检查数据库连接..."
until docker exec funnypixels_postgres pg_isready -U postgres &> /dev/null; do
    echo "等待 PostgreSQL 启动..."
    sleep 2
done

echo -e "${GREEN}✅ 数据库连接成功${NC}"
echo "运行迁移..."
npm run migrate -- -x

# 步骤 6: 运行种子数据
echo ""
echo "🌱 步骤 6/6: 填充初始数据..."
npm run seed -- -x

# 完成
echo ""
echo "=================================="
echo -e "${GREEN}🎉 设置完成！${NC}"
echo ""
echo "📝 后续步骤："
echo "  1. 启动后端服务:"
echo "     ${YELLOW}cd backend && npm run dev${NC}"
echo ""
echo "  2. 启动前端（可选）:"
echo "     ${YELLOW}cd frontend && npm run dev${NC}"
echo ""
echo "  3. 启动 iOS App:"
echo "     在 Xcode 中运行 FunnyPixelsApp"
echo ""
echo "📊 服务状态："
echo "  PostgreSQL: http://localhost:5432"
echo "  Redis:      http://localhost:6379"
echo "  API:        http://localhost:3000"
echo "  PgAdmin:    http://localhost:5050"
echo ""
