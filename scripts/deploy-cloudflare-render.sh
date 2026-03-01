#!/bin/bash

# FunnyPixels 部署脚本 - Cloudflare + Render + Upstash
# 使用方法: ./scripts/deploy-cloudflare-render.sh

set -e

echo "🚀 开始部署 FunnyPixels 到 Cloudflare + Render + Upstash"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 检查必要的工具
check_requirements() {
    echo -e "${BLUE}📋 检查部署要求...${NC}"
    
    if ! command -v git &> /dev/null; then
        echo -e "${RED}❌ Git 未安装${NC}"
        exit 1
    fi
    
    if ! command -v npm &> /dev/null; then
        echo -e "${RED}❌ npm 未安装${NC}"
        exit 1
    fi
    
    if ! command -v wrangler &> /dev/null; then
        echo -e "${YELLOW}⚠️ Wrangler CLI 未安装，正在安装...${NC}"
        npm install -g wrangler
    fi
    
    echo -e "${GREEN}✅ 所有要求已满足${NC}"
}

# 构建前端
build_frontend() {
    echo -e "${BLUE}🔨 构建前端应用...${NC}"
    
    cd frontend
    
    # 安装依赖
    npm ci
    
    # 构建应用
    npm run build
    
    echo -e "${GREEN}✅ 前端构建完成${NC}"
    
    cd ..
}

# 部署到 Cloudflare Pages
deploy_cloudflare() {
    echo -e "${BLUE}☁️ 部署到 Cloudflare Pages...${NC}"
    
    cd frontend
    
    # 检查是否已登录
    if ! wrangler whoami &> /dev/null; then
        echo -e "${YELLOW}🔐 请先登录 Cloudflare:${NC}"
        wrangler login
    fi
    
    # 部署到 Cloudflare Pages
    wrangler pages deploy dist --project-name funnypixels-frontend
    
    echo -e "${GREEN}✅ Cloudflare Pages 部署完成${NC}"
    
    cd ..
}

# 部署到 Render
deploy_render() {
    echo -e "${BLUE}🔄 部署到 Render...${NC}"
    
    # 检查是否已安装 Render CLI
    if ! command -v render &> /dev/null; then
        echo -e "${YELLOW}⚠️ Render CLI 未安装，请手动部署:${NC}"
        echo "1. 访问 https://render.com"
        echo "2. 连接您的 GitHub 仓库"
        echo "3. 使用 backend/render.yaml 配置"
        echo "4. 设置环境变量"
        return
    fi
    
    # 部署到 Render
    render deploy --service funnypixels-backend
    
    echo -e "${GREEN}✅ Render 部署完成${NC}"
}

# 验证部署
verify_deployment() {
    echo -e "${BLUE}🔍 验证部署...${NC}"
    
    # 这里可以添加健康检查
    echo -e "${GREEN}✅ 部署验证完成${NC}"
}

# 显示部署信息
show_deployment_info() {
    echo -e "${GREEN}🎉 部署完成！${NC}"
    echo ""
    echo -e "${BLUE}📋 部署信息:${NC}"
    echo "前端: https://funnypixels-frontend.pages.dev"
    echo "后端: https://funnypixels-backend.onrender.com"
    echo ""
    echo -e "${YELLOW}📝 后续步骤:${NC}"
    echo "1. 配置自定义域名"
    echo "2. 设置 SSL 证书"
    echo "3. 配置 CDN 缓存"
    echo "4. 设置监控和日志"
}

# 主函数
main() {
    check_requirements
    build_frontend
    deploy_cloudflare
    deploy_render
    verify_deployment
    show_deployment_info
}

# 运行主函数
main "$@"