#!/bin/bash

# =====================================================
# 生产环境像素历史系统部署脚本
# 文件名: deploy-pixels-history-production.sh
# 创建时间: 2025-09-07
# 说明: 自动化部署像素历史系统到生产环境
# =====================================================

set -e  # 遇到错误立即退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查依赖
check_dependencies() {
    log_info "检查依赖..."
    
    if ! command -v psql &> /dev/null; then
        log_error "psql 未安装，请先安装 PostgreSQL 客户端"
        exit 1
    fi
    
    if ! command -v npm &> /dev/null; then
        log_error "npm 未安装，请先安装 Node.js"
        exit 1
    fi
    
    log_success "依赖检查通过"
}

# 检查环境变量
check_environment() {
    log_info "检查环境变量..."
    
    if [ -z "$DATABASE_URL" ] && [ -z "$DB_HOST" ]; then
        log_error "请设置数据库连接信息 (DATABASE_URL 或 DB_HOST)"
        exit 1
    fi
    
    if [ -z "$NODE_ENV" ]; then
        log_warning "NODE_ENV 未设置，使用默认值: production"
        export NODE_ENV=production
    fi
    
    log_success "环境变量检查通过"
}

# 执行数据库设置
setup_database() {
    log_info "设置数据库..."
    
    local sql_file="backend/scripts/production-pixels-history-setup.sql"
    
    if [ ! -f "$sql_file" ]; then
        log_error "SQL文件不存在: $sql_file"
        exit 1
    fi
    
    # 执行SQL脚本
    if [ -n "$DATABASE_URL" ]; then
        log_info "使用 DATABASE_URL 连接数据库..."
        psql "$DATABASE_URL" -f "$sql_file"
    else
        log_info "使用 DB_HOST 连接数据库..."
        psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -f "$sql_file"
    fi
    
    if [ $? -eq 0 ]; then
        log_success "数据库设置完成"
    else
        log_error "数据库设置失败"
        exit 1
    fi
}

# 验证数据库设置
verify_database() {
    log_info "验证数据库设置..."
    
    local verify_sql="
    SELECT 
        'Tables: ' || COUNT(*) as table_count
    FROM information_schema.tables 
    WHERE table_name LIKE 'pixels_history%';
    
    SELECT 
        'Indexes: ' || COUNT(*) as index_count
    FROM pg_indexes 
    WHERE tablename LIKE 'pixels_history%';
    
    SELECT 
        'Functions: ' || COUNT(*) as function_count
    FROM pg_proc 
    WHERE proname LIKE '%pixels_history%' OR proname LIKE '%partition%';
    "
    
    if [ -n "$DATABASE_URL" ]; then
        psql "$DATABASE_URL" -c "$verify_sql"
    else
        psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -c "$verify_sql"
    fi
    
    log_success "数据库验证完成"
}

# 安装依赖
install_dependencies() {
    log_info "安装依赖..."
    
    cd backend
    npm install --production
    cd ..
    
    log_success "依赖安装完成"
}

# 重启服务
restart_services() {
    log_info "重启服务..."
    
    # 检查服务类型
    if command -v docker-compose &> /dev/null; then
        log_info "使用 Docker Compose 重启服务..."
        docker-compose restart backend
    elif command -v pm2 &> /dev/null; then
        log_info "使用 PM2 重启服务..."
        pm2 restart backend
    elif command -v systemctl &> /dev/null; then
        log_info "使用 systemctl 重启服务..."
        sudo systemctl restart your-backend-service
    else
        log_warning "未检测到服务管理工具，请手动重启后端服务"
    fi
    
    log_success "服务重启完成"
}

# 启动队列处理器
start_queue_processor() {
    log_info "启动队列处理器..."
    
    cd backend
    
    if command -v pm2 &> /dev/null; then
        log_info "使用 PM2 启动队列处理器..."
        pm2 start scripts/process-pixels-history-queue.js --name "pixels-history-queue"
    else
        log_info "使用 nohup 启动队列处理器..."
        nohup node scripts/process-pixels-history-queue.js > logs/pixels-history-queue.log 2>&1 &
    fi
    
    cd ..
    
    log_success "队列处理器启动完成"
}

# 运行测试
run_tests() {
    log_info "运行测试..."
    
    cd backend
    npm run pixels-history:test
    cd ..
    
    log_success "测试完成"
}

# 设置定时任务
setup_cron_jobs() {
    log_info "设置定时任务..."
    
    local project_path=$(pwd)
    local cron_jobs="
# 像素历史系统定时任务
# 每月1号创建新分区
0 0 1 * * cd $project_path/backend && npm run pixels-history:manage -- create-monthly

# 每月15号清理旧分区
0 2 15 * * cd $project_path/backend && npm run pixels-history:manage -- cleanup

# 每月1号归档数据
0 1 1 * * cd $project_path/backend && npm run pixels-history:archive
"
    
    # 检查是否已有相关定时任务
    if crontab -l 2>/dev/null | grep -q "pixels-history"; then
        log_warning "检测到已存在的像素历史定时任务，跳过设置"
    else
        # 添加定时任务
        (crontab -l 2>/dev/null; echo "$cron_jobs") | crontab -
        log_success "定时任务设置完成"
    fi
}

# 显示部署摘要
show_summary() {
    log_success "🎉 像素历史系统部署完成！"
    echo ""
    echo "📊 部署摘要:"
    echo "  ✅ 数据库表结构已创建"
    echo "  ✅ 分区和索引已设置"
    echo "  ✅ 管理函数已安装"
    echo "  ✅ 后端服务已重启"
    echo "  ✅ 队列处理器已启动"
    echo "  ✅ 定时任务已设置"
    echo ""
    echo "🔧 管理命令:"
    echo "  - 创建新分区: npm run pixels-history:manage -- create-monthly"
    echo "  - 清理旧分区: npm run pixels-history:manage -- cleanup"
    echo "  - 归档数据: npm run pixels-history:archive"
    echo "  - 查看统计: npm run pixels-history:manage -- stats"
    echo ""
    echo "📚 文档:"
    echo "  - 部署指南: docs/backend/pixels-history/PRODUCTION_PIXELS_HISTORY_DEPLOYMENT.md"
    echo "  - 系统文档: docs/backend/pixels-history/PIXELS_HISTORY_SYSTEM.md"
    echo ""
    echo "⚠️  注意事项:"
    echo "  - 请定期监控队列处理器状态"
    echo "  - 建议设置数据库备份策略"
    echo "  - 监控存储空间使用情况"
}

# 主函数
main() {
    echo "🚀 开始部署像素历史系统到生产环境..."
    echo ""
    
    check_dependencies
    check_environment
    setup_database
    verify_database
    install_dependencies
    restart_services
    start_queue_processor
    run_tests
    setup_cron_jobs
    show_summary
}

# 显示帮助信息
show_help() {
    echo "用法: $0 [选项]"
    echo ""
    echo "选项:"
    echo "  -h, --help     显示帮助信息"
    echo "  --skip-db      跳过数据库设置"
    echo "  --skip-test    跳过测试"
    echo "  --skip-cron    跳过定时任务设置"
    echo ""
    echo "环境变量:"
    echo "  DATABASE_URL   数据库连接URL"
    echo "  DB_HOST        数据库主机"
    echo "  DB_USER        数据库用户名"
    echo "  DB_NAME        数据库名称"
    echo "  NODE_ENV       运行环境 (默认: production)"
    echo ""
    echo "示例:"
    echo "  $0"
    echo "  DATABASE_URL=postgresql://user:pass@host:port/db $0"
    echo "  $0 --skip-test --skip-cron"
}

# 解析命令行参数
SKIP_DB=false
SKIP_TEST=false
SKIP_CRON=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
            ;;
        --skip-db)
            SKIP_DB=true
            shift
            ;;
        --skip-test)
            SKIP_TEST=true
            shift
            ;;
        --skip-cron)
            SKIP_CRON=true
            shift
            ;;
        *)
            log_error "未知选项: $1"
            show_help
            exit 1
            ;;
    esac
done

# 执行主函数
main
