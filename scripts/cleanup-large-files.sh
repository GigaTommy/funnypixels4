#!/bin/bash
# =============================================================================
# 清理 Git 仓库中的大文件脚本
# 用途：从 git 跟踪中移除大文件，解决 GitHub 空间不足问题
# =============================================================================

set -e

echo "🔍 开始清理 Git 仓库中的大文件..."
echo ""

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查是否在 git 仓库中
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo -e "${RED}❌ 错误：当前目录不是 git 仓库${NC}"
    exit 1
fi

echo -e "${YELLOW}⚠️  警告：此脚本将从 git 跟踪中移除大文件${NC}"
echo -e "${YELLOW}⚠️  本地文件不会被删除，只是不再被 git 跟踪${NC}"
echo ""
read -p "是否继续？(y/N): " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "已取消"
    exit 1
fi

echo ""
echo "📋 步骤 1: 从 git 跟踪中移除数据库备份文件..."
if git ls-files | grep -q "database/seeds/.*\.sql$"; then
    git rm --cached database/seeds/*.sql 2>/dev/null || true
    echo -e "${GREEN}✅ 已移除 SQL 备份文件${NC}"
else
    echo -e "${GREEN}✅ 没有找到 SQL 备份文件${NC}"
fi

echo ""
echo "📋 步骤 2: 从 git 跟踪中移除 node_modules（如果被跟踪）..."
REMOVED_NODEMODULES=false
for dir in frontend/node_modules backend/node_modules admin-frontend/node_modules; do
    if git ls-files | grep -q "^${dir}/"; then
        git rm --cached -r "${dir}" 2>/dev/null || true
        REMOVED_NODEMODULES=true
        echo -e "${GREEN}✅ 已移除 ${dir}${NC}"
    fi
done

if [ "$REMOVED_NODEMODULES" = false ]; then
    echo -e "${GREEN}✅ node_modules 未被跟踪${NC}"
fi

echo ""
echo "📋 步骤 3: 从 git 跟踪中移除 app/.build（如果被跟踪）..."
if git ls-files | grep -q "^app/\.build/"; then
    git rm --cached -r app/.build 2>/dev/null || true
    echo -e "${GREEN}✅ 已移除 app/.build${NC}"
else
    echo -e "${GREEN}✅ app/.build 未被跟踪${NC}"
fi

echo ""
echo "📋 步骤 4: 从 git 跟踪中移除其他大文件..."
# 移除 GeoLite2 备份文件
if git ls-files | grep -q "data/geolocation/backups/.*\.backup"; then
    git rm --cached data/geolocation/backups/*.backup 2>/dev/null || true
    echo -e "${GREEN}✅ 已移除 GeoLite2 备份文件${NC}"
fi

echo ""
echo "📊 检查当前 git 状态..."
git status --short | head -20

echo ""
echo -e "${GREEN}✅ 清理完成！${NC}"
echo ""
echo "📝 下一步操作："
echo "   1. 检查 git status 确认更改"
echo "   2. 提交更改: git commit -m 'chore: remove large files from git tracking'"
echo "   3. 推送到 GitHub: git push origin main"
echo ""
echo -e "${YELLOW}⚠️  注意：如果 GitHub 仍然空间不足，可能需要清理 git 历史${NC}"
echo -e "${YELLOW}   参考: docs/development/GitHub_Storage_Issue_Analysis.md${NC}"
