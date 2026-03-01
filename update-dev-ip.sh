#!/bin/bash

# FunnyPixels 开发环境 IP 地址更新脚本
# 用法: ./update-dev-ip.sh [新IP地址]
# 示例: ./update-dev-ip.sh 192.168.1.100

set -e  # 遇到错误立即退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 默认旧IP
OLD_IP="192.168.0.3"

# 检查参数
if [ -z "$1" ]; then
    echo -e "${RED}❌ 错误: 请提供新的 IP 地址${NC}"
    echo -e "${YELLOW}用法: $0 [新IP地址]${NC}"
    echo -e "${YELLOW}示例: $0 192.168.1.100${NC}"
    exit 1
fi

NEW_IP="$1"

# 验证IP地址格式
if ! [[ $NEW_IP =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]]; then
    echo -e "${RED}❌ 错误: IP 地址格式无效${NC}"
    echo -e "${YELLOW}示例: 192.168.1.100${NC}"
    exit 1
fi

echo -e "${BLUE}🔄 开始更新开发环境配置...${NC}"
echo -e "${BLUE}旧IP: ${OLD_IP}${NC}"
echo -e "${BLUE}新IP: ${NEW_IP}${NC}"
echo ""

# 备份函数
backup_file() {
    local file=$1
    if [ -f "$file" ]; then
        cp "$file" "${file}.backup.$(date +%Y%m%d_%H%M%S)"
        echo -e "${GREEN}✓ 已备份: $file${NC}"
    fi
}

# 更新函数 (macOS 使用 sed -i '')
update_file() {
    local file=$1
    local old=$2
    local new=$3

    if [ -f "$file" ]; then
        # 检测操作系统
        if [[ "$OSTYPE" == "darwin"* ]]; then
            # macOS
            sed -i '' "s|$old|$new|g" "$file"
        else
            # Linux
            sed -i "s|$old|$new|g" "$file"
        fi
        echo -e "${GREEN}✓ 已更新: $file${NC}"
        return 0
    else
        echo -e "${YELLOW}⚠️  文件不存在: $file${NC}"
        return 1
    fi
}

echo -e "${YELLOW}📦 正在备份配置文件...${NC}"

# 备份重要配置文件
backup_file "FunnyPixelsApp/FunnyPixelsApp/Info.plist"
backup_file "backend/.env"
backup_file "frontend/.env"

echo ""
echo -e "${YELLOW}🔧 正在更新配置...${NC}"

# 1. 更新 iOS App Info.plist
echo -e "\n${BLUE}1️⃣  更新 iOS App 配置${NC}"
update_file "FunnyPixelsApp/FunnyPixelsApp/Info.plist" "$OLD_IP" "$NEW_IP"

# 2. 更新 Backend .env
echo -e "\n${BLUE}2️⃣  更新 Backend 配置${NC}"
if update_file "backend/.env" "$OLD_IP" "$NEW_IP"; then
    # 检查是否存在 LOCAL_IP 配置，如果不存在则添加
    if ! grep -q "^LOCAL_IP=" "backend/.env"; then
        echo -e "${YELLOW}   添加 LOCAL_IP 配置...${NC}"
        echo "" >> "backend/.env"
        echo "# 手动指定局域网IP（开发环境）" >> "backend/.env"
        echo "LOCAL_IP=$NEW_IP" >> "backend/.env"
        echo -e "${GREEN}   ✓ 已添加 LOCAL_IP=$NEW_IP${NC}"
    fi
fi

# 3. 更新 Frontend .env
echo -e "\n${BLUE}3️⃣  更新 Frontend 配置${NC}"
if update_file "frontend/.env" "localhost" "$NEW_IP"; then
    # 再次替换可能存在的旧IP
    update_file "frontend/.env" "$OLD_IP" "$NEW_IP"
fi

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ 配置更新完成！${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${BLUE}📋 新的开发环境地址:${NC}"
echo -e "   Backend API:    http://${NEW_IP}:3001"
echo -e "   Frontend:       http://${NEW_IP}:3000"
echo -e "   WebSocket:      ws://${NEW_IP}:3001"
echo ""
echo -e "${YELLOW}⚡ 接下来需要执行的操作:${NC}"
echo -e "   1. 重启 Backend:   ${BLUE}cd backend && npm run dev${NC}"
echo -e "   2. 重启 Frontend:  ${BLUE}cd frontend && npm run dev${NC}"
echo -e "   3. 重新编译 iOS:   在 Xcode 中执行 Clean Build (⇧⌘K) 然后 Build (⌘B)"
echo ""
echo -e "${YELLOW}💾 备份文件已保存（后缀 .backup.YYYYMMDD_HHMMSS）${NC}"
echo -e "${YELLOW}   如需恢复，可以手动复制备份文件${NC}"
echo ""
