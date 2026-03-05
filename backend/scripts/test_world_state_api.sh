#!/bin/bash
# World State Feed API 快速测试脚本
# 用法: ./test_world_state_api.sh [YOUR_AUTH_TOKEN]

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

API_BASE="http://localhost:3001/api"
TOKEN="${1:-}"

if [ -z "$TOKEN" ]; then
    echo -e "${RED}❌ 错误: 请提供认证token${NC}"
    echo "用法: $0 YOUR_AUTH_TOKEN"
    echo ""
    echo "获取token的方法："
    echo "1. 在浏览器中登录应用"
    echo "2. 打开开发者工具 → Application → Local Storage"
    echo "3. 查找 'authToken' 或类似的键"
    exit 1
fi

echo -e "${BLUE}🚀 开始测试World State Feed API...${NC}\n"

# 测试函数
test_endpoint() {
    local filter=$1
    local description=$2

    echo -e "${YELLOW}测试: $description (filter=$filter)${NC}"

    response=$(curl -s -w "\n%{http_code}" -X GET \
        "$API_BASE/feed/world-state?filter=$filter&offset=0&limit=5" \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json")

    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')

    if [ "$http_code" -eq 200 ]; then
        event_count=$(echo "$body" | jq -r '.data.events | length')
        has_more=$(echo "$body" | jq -r '.data.hasMore')

        echo -e "${GREEN}✓ HTTP 200 - 成功${NC}"
        echo "  事件数量: $event_count"
        echo "  有更多数据: $has_more"

        if [ "$event_count" -gt 0 ]; then
            echo "  事件类型:"
            echo "$body" | jq -r '.data.events[] | "    - \(.event_type): \(.title)"' | head -5
        else
            echo -e "  ${YELLOW}⚠️  无事件数据（可能需要运行generate_world_state_test_data.js）${NC}"
        fi
    else
        echo -e "${RED}✗ HTTP $http_code - 失败${NC}"
        echo "$body" | jq '.' 2>/dev/null || echo "$body"
    fi

    echo ""
}

# 运行所有测试
echo -e "${BLUE}═══════════════════════════════════════${NC}\n"

test_endpoint "all" "获取所有事件"
test_endpoint "milestones" "获取里程碑事件"
test_endpoint "territories" "获取领地变化事件"
test_endpoint "events" "获取活动进度事件"
test_endpoint "official" "获取官方公告"

echo -e "${BLUE}═══════════════════════════════════════${NC}"
echo -e "\n${GREEN}✅ 测试完成！${NC}\n"

# 统计信息
echo -e "${BLUE}📊 统计信息：${NC}"
echo -e "  API Base URL: ${YELLOW}$API_BASE${NC}"
echo -e "  Token前缀: ${YELLOW}${TOKEN:0:20}...${NC}"

# 提示
echo -e "\n${BLUE}💡 提示：${NC}"
echo "  - 如果看到'无事件数据'，请运行: node backend/scripts/generate_world_state_test_data.js"
echo "  - 如果看到'HTTP 401'，请检查token是否有效"
echo "  - 如果看到'HTTP 500'，请检查后端日志和数据库连接"
echo "  - 查看完整响应: curl -X GET \"$API_BASE/feed/world-state?filter=all\" -H \"Authorization: Bearer \$TOKEN\" | jq"
