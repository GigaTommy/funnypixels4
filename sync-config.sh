#!/bin/bash

# 配置同步脚本包装器
# 自动从根目录 .env 同步配置到所有客户端

set -e  # 遇到错误立即退出

# 颜色定义
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${CYAN}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  FunnyPixels 配置同步工具"
echo "  Configuration Sync Tool"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${NC}"

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ 错误: 未找到 Node.js${NC}"
    echo -e "${YELLOW}请先安装 Node.js: https://nodejs.org/${NC}"
    exit 1
fi

# 检查根目录 .env
if [ ! -f ".env" ]; then
    echo -e "${RED}❌ 错误: 根目录 .env 文件不存在${NC}"
    exit 1
fi

# 运行同步脚本
node sync-config.js

# 完成
echo -e "${GREEN}✨ 同步完成！${NC}"
