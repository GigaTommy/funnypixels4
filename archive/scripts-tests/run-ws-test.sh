#!/bin/bash
# WebSocket压力测试运行脚本 - Linux/macOS
#
# 使用方法:
# ./run-ws-test.sh [scenario]
#
# 场景:
#   quick    - 快速测试 (1K用户, 30秒)
#   normal   - 正常测试 (5K用户, 2分钟)
#   full     - 完整测试 (10K用户, 5分钟)
#   custom   - 自定义参数

set -e

# 切换到脚本所在目录（ws-room-test.js 同目录）
cd "$(dirname "$0")"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 检查k6是否安装
if ! command -v k6 &> /dev/null; then
    echo -e "${RED}❌ K6未安装，请先安装K6:${NC}"
    echo "   macOS: brew install k6"
    echo "   Ubuntu/Debian: sudo apt-get install k6"
    echo "   或访问: https://k6.io/docs/get-started/installation/"
    exit 1
fi

# 设置默认参数
VUS=5000
DURATION="2m"
SCENARIO=${1:-normal}

# 根据场景设置参数
case $SCENARIO in
    quick)
        VUS=1000
        DURATION="30s"
        echo -e "${GREEN}🚀 快速测试模式: 1K用户, 30秒${NC}"
        ;;
    normal)
        VUS=5000
        DURATION="2m"
        echo -e "${GREEN}🚀 正常测试模式: 5K用户, 2分钟${NC}"
        ;;
    full)
        VUS=10000
        DURATION="5m"
        echo -e "${GREEN}🚀 完整测试模式: 10K用户, 5分钟${NC}"
        ;;
    custom)
        read -p "请输入并发用户数 (默认5000): " VUS_INPUT
        VUS=${VUS_INPUT:-5000}
        read -p "请输入测试时长 (默认2m): " DURATION_INPUT
        DURATION=${DURATION_INPUT:-2m}
        echo -e "${GREEN}🚀 自定义测试模式: $VUS 用户, $DURATION${NC}"
        ;;
    *)
        echo -e "${YELLOW}🚀 使用默认参数: 5K用户, 2分钟${NC}"
        echo "可用场景: quick, normal, full, custom"
        ;;
esac

echo
echo -e "${BLUE}📊 测试配置:${NC}"
echo "   并发用户: $VUS"
echo "   测试时长: $DURATION"
echo "   WebSocket: ws://localhost:3001"
echo "   每用户瓦片: 20"
echo "   每秒更新: 500"
echo

# 检查服务器是否运行
if ! curl -s http://localhost:3001/api/health > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠️ 警告: 无法连接到服务器 (localhost:3001)${NC}"
    echo "请确保服务器正在运行"
    echo
    read -p "是否继续测试? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# 检查系统限制
echo -e "${BLUE}🔍 检查系统限制...${NC}"
OS=$(uname -s)

if [[ "$OS" == "Darwin" ]]; then
    # macOS
    MAX_FILES=$(ulimit -n)
    if [ "$MAX_FILES" -lt 20000 ]; then
        echo -e "${YELLOW}⚠️ 文件描述符限制较低 ($MAX_FILES)${NC}"
        echo "建议增加: ulimit -n 20000"
        echo
    fi
elif [[ "$OS" == "Linux" ]]; then
    # Linux
    MAX_FILES=$(ulimit -n)
    if [ "$MAX_FILES" -lt 65536 ]; then
        echo -e "${YELLOW}⚠️ 文件描述符限制较低 ($MAX_FILES)${NC}"
        echo "建议增加: ulimit -n 65536"
        echo "永久修改: echo '* soft nofile 65536' >> /etc/security/limits.conf"
        echo "永久修改: echo '* hard nofile 65536' >> /etc/security/limits.conf"
        echo
    fi
fi

# 记录测试开始时间
START_TIME=$(date '+%Y-%m-%d %H:%M:%S')
echo -e "${GREEN}🏁 开始测试... ($START_TIME)${NC}"
echo

# 运行测试
k6 run --vus $VUS --duration $DURATION ws-room-test.js

# 记录测试结束时间
END_TIME=$(date '+%Y-%m-%d %H:%M:%S')
echo
echo -e "${GREEN}✅ 测试完成！ ($END_TIME)${NC}"
echo

# 计算测试时长
DURATION_SECONDS=$(($(date -d "$END_TIME" +%s) - $(date -d "$START_TIME" +%s)))
DURATION_MINUTES=$((DURATION_SECONDS / 60))
DURATION_REMAINING_SECONDS=$((DURATION_SECONDS % 60))

echo -e "${BLUE}📈 测试统计:${NC}"
echo "   实际测试时长: ${DURATION_MINUTES}分${DURATION_REMAINING_SECONDS}秒"
echo "   总并发用户: $VUS"
echo "   测试开始时间: $START_TIME"
echo "   测试结束时间: $END_TIME"
echo

# 性能建议
echo -e "${BLUE}💡 提示:${NC}"
echo "   - 查看详细日志了解性能瓶颈"
echo "   - 运行 'k6 archive --output json=results.json' 保存结果"
echo "   - 使用 'k6 cloud' 上传结果到 k6 Cloud 进行分析"
echo

# 生成测试报告（如果存在结果文件）
RESULT_FILE="results-$(date +%Y%m%d-%H%M%S).json"
if command -v jq &> /dev/null && [ -f "$RESULT_FILE" ]; then
    echo -e "${BLUE}📊 生成测试报告...${NC}"

    # 这里可以添加更多报告生成逻辑
    # 例如使用 jq 解析结果并生成 HTML 报告

    echo "报告已保存到: $RESULT_FILE"
fi

echo -e "${GREEN}🎉 所有测试完成！${NC}"