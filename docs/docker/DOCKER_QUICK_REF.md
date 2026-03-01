#!/bin/bash

# FunnyPixels Docker 快速启动脚本
# 用于快速启动和验证 Docker 服务

set -e

# 颜色
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}FunnyPixels Docker 快速启动${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# 检查 Docker
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker 未安装${NC}"
    echo "请访问 https://www.docker.com/products/docker-desktop 安装 Docker Desktop"
    exit 1
fi

if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker 未运行${NC}"
    echo "请启动 Docker Desktop 应用程序"
    exit 1
fi

echo -e "${GREEN}✅ Docker 已运行${NC}"
echo ""

# 启动服务
echo -e "${YELLOW}🚀 启动 Docker 服务...${NC}"
docker-compose up -d postgres redis pgadmin

echo ""
echo "等待服务启动..."
sleep 5

# 验证服务
echo ""
echo -e "${BLUE}📊 服务状态：${NC}"
docker-compose ps

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✅ 所有服务已启动！${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${BLUE}📍 服务地址：${NC}"
echo "  🐘 PostgreSQL:  ${GREEN}localhost:5432${NC}"
echo "     用户: postgres  密码: password"
echo ""
echo "  📦 Redis:       ${GREEN}localhost:6379${NC}"
echo "     无密码"
echo ""
echo -e "  🎛️  pgAdmin:     ${GREEN}http://localhost:5050${NC}"
echo "     邮箱: admin@funnypixels.com  密码: admin123"
echo ""
echo -e "${BLUE}🔧 常用命令：${NC}"
echo "  查看日志:     docker-compose logs -f"
echo "  停止服务:     docker-compose stop"
echo "  重启服务:     docker-compose restart"
echo "  进入PostgreSQL: ./docker-services.sh psql"
echo "  进入Redis:      ./docker-services.sh redis"
echo ""
echo -e "${BLUE}📚 详细文档：${NC}"
echo "  INSTALL_DOCKER.md    - Docker 安装和启动指南"
echo "  DOCKER_SETUP.md      - 完整配置文档"
echo ""
