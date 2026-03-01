#!/bin/bash
##############################################################################
# FunnyPixels Pre-Deployment Load Test Script
#
# 用途: 在部署到生产环境前运行快速压力测试，确保新版本满足性能要求
#
# 使用方法:
#   ./pre-deployment-test.sh [environment] [threshold]
#
# 参数:
#   environment: staging | production (默认: staging)
#   threshold: 性能阈值(0-100) (默认: 95)
#
# 示例:
#   ./pre-deployment-test.sh staging 95
#   ./pre-deployment-test.sh production 98
##############################################################################

set -e  # 遇到错误立即退出

# ==================== 配置 ====================

ENVIRONMENT=${1:-staging}
SUCCESS_THRESHOLD=${2:-95}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOADTEST_DIR="$(dirname "$SCRIPT_DIR")"
REPORT_DIR="${LOADTEST_DIR}/reports/pre-deployment"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

# 环境配置
case $ENVIRONMENT in
  staging)
    BASE_URL="${STAGING_URL:-http://staging.funnypixels.local:3001}"
    TARGET_VUS=100
    TEST_DURATION="5m"
    ;;
  production)
    BASE_URL="${PRODUCTION_URL:-https://api.funnypixels.com}"
    TARGET_VUS=200
    TEST_DURATION="10m"
    ;;
  *)
    echo "❌ 错误: 不支持的环境 '$ENVIRONMENT'"
    echo "使用方法: $0 [staging|production] [threshold]"
    exit 1
    ;;
esac

# ==================== 函数定义 ====================

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查依赖
check_dependencies() {
    log_info "检查依赖..."

    if ! command -v k6 &> /dev/null; then
        log_error "k6 未安装。请运行: brew install k6"
        exit 1
    fi

    if ! command -v jq &> /dev/null; then
        log_error "jq 未安装。请运行: brew install jq"
        exit 1
    fi

    log_info "✓ 所有依赖已安装"
}

# 检查服务健康
check_service_health() {
    log_info "检查服务健康状态: $BASE_URL"

    local health_endpoint="${BASE_URL}/health"
    local response=$(curl -s -o /dev/null -w "%{http_code}" "$health_endpoint" || echo "000")

    if [ "$response" != "200" ]; then
        log_error "服务不健康 (HTTP $response): $health_endpoint"
        exit 1
    fi

    log_info "✓ 服务健康检查通过"
}

# 运行快速烟雾测试
run_smoke_test() {
    log_info "运行烟雾测试 (1 VU, 1分钟)..."

    local smoke_report="${REPORT_DIR}/smoke-${TIMESTAMP}.json"

    k6 run \
        --vus 1 \
        --duration 1m \
        --env BASE_URL="$BASE_URL" \
        --out json="$smoke_report" \
        --quiet \
        "${LOADTEST_DIR}/k6/canvas-draw-load.js"

    # 检查烟雾测试结果
    local smoke_success_rate=$(jq -r '.metrics.draw_success_rate.values.rate // 0' "$smoke_report")
    local smoke_success_pct=$(echo "$smoke_success_rate * 100" | bc)

    if (( $(echo "$smoke_success_pct < 95" | bc -l) )); then
        log_error "烟雾测试失败: 成功率 ${smoke_success_pct}% < 95%"
        exit 1
    fi

    log_info "✓ 烟雾测试通过 (成功率: ${smoke_success_pct}%)"
}

# 运行负载测试
run_load_test() {
    log_info "运行负载测试 ($TARGET_VUS VUs, $TEST_DURATION)..."

    local load_report="${REPORT_DIR}/load-${TIMESTAMP}.json"

    k6 run \
        --vus "$TARGET_VUS" \
        --duration "$TEST_DURATION" \
        --env BASE_URL="$BASE_URL" \
        --out json="$load_report" \
        "${LOADTEST_DIR}/k6/canvas-draw-load.js" | tee "${REPORT_DIR}/load-${TIMESTAMP}.log"

    echo "$load_report"
}

# 分析测试结果
analyze_results() {
    local report_file=$1

    log_info "分析测试结果..."

    # 提取关键指标
    local success_rate=$(jq -r '.metrics.draw_success_rate.values.rate // 0' "$report_file")
    local avg_latency=$(jq -r '.metrics.pixel_draw_latency.values.avg // 0' "$report_file")
    local p95_latency=$(jq -r '.metrics.pixel_draw_latency.values["p(95)"] // 0' "$report_file")
    local p99_latency=$(jq -r '.metrics.pixel_draw_latency.values["p(99)"] // 0' "$report_file")
    local http_errors=$(jq -r '.metrics.http_req_failed.values.rate // 0' "$report_file")

    # 转换为百分比
    local success_pct=$(echo "$success_rate * 100" | bc)
    local error_pct=$(echo "$http_errors * 100" | bc)

    # 打印结果
    echo ""
    echo "========================================"
    echo "📊 测试结果汇总"
    echo "========================================"
    echo "环境: $ENVIRONMENT"
    echo "VUs: $TARGET_VUS"
    echo "持续时间: $TEST_DURATION"
    echo "----------------------------------------"
    echo "成功率: ${success_pct}%"
    echo "错误率: ${error_pct}%"
    echo "平均延迟: ${avg_latency}ms"
    echo "P95延迟: ${p95_latency}ms"
    echo "P99延迟: ${p99_latency}ms"
    echo "========================================"
    echo ""

    # 性能评级
    local passed=true

    # 检查成功率
    if (( $(echo "$success_pct < $SUCCESS_THRESHOLD" | bc -l) )); then
        log_error "✗ 成功率 ${success_pct}% < 阈值 ${SUCCESS_THRESHOLD}%"
        passed=false
    else
        log_info "✓ 成功率 ${success_pct}% >= 阈值 ${SUCCESS_THRESHOLD}%"
    fi

    # 检查P95延迟
    if (( $(echo "$p95_latency > 500" | bc -l) )); then
        log_warn "⚠ P95延迟 ${p95_latency}ms > 500ms"
        if [ "$ENVIRONMENT" = "production" ]; then
            passed=false
        fi
    else
        log_info "✓ P95延迟 ${p95_latency}ms <= 500ms"
    fi

    # 检查P99延迟
    if (( $(echo "$p99_latency > 1000" | bc -l) )); then
        log_warn "⚠ P99延迟 ${p99_latency}ms > 1000ms"
    else
        log_info "✓ P99延迟 ${p99_latency}ms <= 1000ms"
    fi

    # 检查错误率
    if (( $(echo "$error_pct > 5" | bc -l) )); then
        log_error "✗ HTTP错误率 ${error_pct}% > 5%"
        passed=false
    else
        log_info "✓ HTTP错误率 ${error_pct}% <= 5%"
    fi

    if [ "$passed" = true ]; then
        log_info "🎉 测试通过！可以继续部署。"
        return 0
    else
        log_error "❌ 测试未通过性能要求，请修复后重试。"
        return 1
    fi
}

# 生成报告
generate_report() {
    local report_file=$1

    log_info "生成HTML报告..."

    local html_report="${REPORT_DIR}/report-${TIMESTAMP}.html"

    cat > "$html_report" <<EOF
<!DOCTYPE html>
<html>
<head>
    <title>Pre-Deployment Test Report - ${TIMESTAMP}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #4CAF50; color: white; padding: 20px; }
        .metric { margin: 10px 0; padding: 10px; border-left: 4px solid #2196F3; }
        .pass { border-color: #4CAF50; }
        .fail { border-color: #f44336; }
        .warn { border-color: #ff9800; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Pre-Deployment Load Test Report</h1>
        <p>Environment: ${ENVIRONMENT} | Date: ${TIMESTAMP}</p>
    </div>
    <h2>Test Configuration</h2>
    <ul>
        <li>Base URL: ${BASE_URL}</li>
        <li>Virtual Users: ${TARGET_VUS}</li>
        <li>Duration: ${TEST_DURATION}</li>
        <li>Success Threshold: ${SUCCESS_THRESHOLD}%</li>
    </ul>
    <h2>Results</h2>
    <div id="metrics"></div>
    <script>
        // Load JSON data and render metrics
        fetch('$(basename "$report_file")')
            .then(r => r.json())
            .then(data => {
                const metrics = data.metrics;
                document.getElementById('metrics').innerHTML =
                    '<pre>' + JSON.stringify(metrics, null, 2) + '</pre>';
            });
    </script>
</body>
</html>
EOF

    log_info "✓ HTML报告已生成: $html_report"
}

# ==================== 主流程 ====================

main() {
    echo "╔════════════════════════════════════════════════════╗"
    echo "║   FunnyPixels Pre-Deployment Load Test            ║"
    echo "╚════════════════════════════════════════════════════╝"
    echo ""

    # 创建报告目录
    mkdir -p "$REPORT_DIR"

    # 1. 检查依赖
    check_dependencies

    # 2. 检查服务健康
    check_service_health

    # 3. 运行烟雾测试
    run_smoke_test

    # 4. 运行负载测试
    local report_file=$(run_load_test)

    # 5. 分析结果
    if analyze_results "$report_file"; then
        # 6. 生成报告
        generate_report "$report_file"

        log_info "✅ 部署前测试完成！"
        log_info "📄 报告位置: $REPORT_DIR"

        exit 0
    else
        log_error "❌ 部署前测试失败！"
        log_error "请查看日志: ${REPORT_DIR}/load-${TIMESTAMP}.log"

        exit 1
    fi
}

# ==================== 执行 ====================

main "$@"
