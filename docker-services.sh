#!/bin/bash

# FunnyPixels Docker 服务管理脚本
# 用于管理 PostgreSQL + PostGIS、Redis 和 pgAdmin 服务

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 项目根目录
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_ROOT"

# 显示帮助信息
show_help() {
    echo -e "${BLUE}FunnyPixels Docker 服务管理${NC}"
    echo ""
    echo "用法: ./docker-services.sh [命令]"
    echo ""
    echo "命令:"
    echo "  start       启动核心 Docker 服务（PostgreSQL, Redis, pgAdmin）"
    echo "  start-all   启动所有 Docker 服务（含 Grafana, Prometheus, Alertmanager）"
    echo "  stop        停止所有 Docker 服务"
    echo "  restart     重启所有 Docker 服务"
    echo "  status      查看服务运行状态"
    echo "  logs        查看服务日志"
    echo "  clean       停止并删除所有容器、网络和卷（警告：会删除数据！）"
    echo "  backup      备份 PostgreSQL 数据库"
    echo "  restore     恢复 PostgreSQL 数据库"
    echo "  psql        进入 PostgreSQL 命令行"
    echo "  redis       进入 Redis 命令行"
    echo "  help        显示此帮助信息"
    echo ""
    echo "服务信息:"
    echo "  PostgreSQL: localhost:5432"
    echo "    数据库: funnypixels_postgres"
    echo "    用户: postgres"
    echo "    密码: password"
    echo ""
    echo "  Redis: localhost:6379"
    echo "    无密码"
    echo ""
    echo "  pgAdmin: http://localhost:5050"
    echo "    邮箱: admin@funnypixels.com"
    echo "    密码: admin123"
    echo ""
}

# 检查 Docker 是否运行
check_docker() {
    if ! docker info > /dev/null 2>&1; then
        echo -e "${RED}❌ Docker 未运行，请先启动 Docker Desktop${NC}"
        exit 1
    fi
}

# 检查并停止 Homebrew redis（避免端口冲突）
stop_local_redis() {
    if brew services list 2>/dev/null | grep -q "redis.*started"; then
        echo -e "${YELLOW}⚠️  检测到 Homebrew redis-server 占用端口 6379，正在停止...${NC}"
        brew services stop redis 2>/dev/null
        sleep 1
        echo -e "${GREEN}✅ Homebrew redis 已停止${NC}"
    fi
}

# 启动核心服务
start_services() {
    echo -e "${GREEN}🚀 启动核心 Docker 服务...${NC}"
    check_docker
    stop_local_redis

    docker-compose up -d postgres redis pgadmin

    echo -e "${GREEN}✅ 服务启动成功！${NC}"
    echo ""
    echo "等待服务就绪..."
    sleep 5
    show_status
}

# 启动所有服务（含监控）
start_all_services() {
    echo -e "${GREEN}🚀 启动所有 Docker 服务（含监控）...${NC}"
    check_docker
    stop_local_redis

    docker-compose up -d

    echo -e "${GREEN}✅ 所有服务启动成功！${NC}"
    echo ""
    echo "等待服务就绪..."
    sleep 5
    show_status
}

# 停止服务
stop_services() {
    echo -e "${YELLOW}🛑 停止 Docker 服务...${NC}"
    docker-compose stop
    echo -e "${GREEN}✅ 服务已停止${NC}"
}

# 重启服务
restart_services() {
    echo -e "${YELLOW}🔄 重启 Docker 服务...${NC}"
    docker-compose restart
    echo -e "${GREEN}✅ 服务已重启${NC}"
    show_status
}

# 显示服务状态
show_status() {
    echo ""
    echo -e "${BLUE}📊 服务运行状态：${NC}"
    echo ""

    docker-compose ps

    echo ""
    echo -e "${BLUE}📡 服务端口：${NC}"
    echo "  PostgreSQL:    ${GREEN}localhost:5432${NC}"
    echo "  Redis:         ${GREEN}localhost:6379${NC}"
    if brew services list 2>/dev/null | grep -q "redis.*started"; then
        echo "                 ${YELLOW}(Homebrew local)${NC}"
    fi
    echo "  pgAdmin:       ${GREEN}http://localhost:5050${NC}"
    # Show monitoring services if running
    if docker ps --filter "name=funnypixels_grafana" --filter "status=running" -q 2>/dev/null | grep -q .; then
        echo "  Grafana:       ${GREEN}http://localhost:3000${NC}"
        echo "  Prometheus:    ${GREEN}http://localhost:9090${NC}"
        echo "  Alertmanager:  ${GREEN}http://localhost:9093${NC}"
    fi
    echo ""
}

# 查看日志
show_logs() {
    echo -e "${BLUE}📋 显示服务日志（按 Ctrl+C 退出）：${NC}"
    echo ""
    docker-compose logs -f
}

# 清理所有数据
clean_all() {
    echo -e "${RED}⚠️  警告：这将删除所有容器、网络和数据卷！${NC}"
    echo ""
    read -p "确定要继续吗？(yes/no): " confirm

    if [ "$confirm" = "yes" ]; then
        echo -e "${YELLOW}🗑️  清理所有资源...${NC}"
        docker-compose down -v
        echo -e "${GREEN}✅ 清理完成${NC}"
    else
        echo -e "${YELLOW}已取消${NC}"
    fi
}

# 备份数据库
backup_database() {
    BACKUP_DIR="$PROJECT_ROOT/backups"
    mkdir -p "$BACKUP_DIR"

    BACKUP_FILE="$BACKUP_DIR/funnypixels_backup_$(date +%Y%m%d_%H%M%S).sql"

    echo -e "${BLUE}💾 备份 PostgreSQL 数据库...${NC}"
    docker-compose exec -T postgres pg_dump -U postgres funnypixels_postgres > "$BACKUP_FILE"

    echo -e "${GREEN}✅ 备份完成: $BACKUP_FILE${NC}"
}

# 恢复数据库
restore_database() {
    BACKUP_DIR="$PROJECT_ROOT/backups"

    if [ ! -d "$BACKUP_DIR" ]; then
        echo -e "${RED}❌ 备份目录不存在${NC}"
        exit 1
    fi

    echo "可用的备份文件:"
    ls -lt "$BACK_DIR"/*.sql 2>/dev/null | head -10

    if [ -z "$1" ]; then
        read -p "请输入备份文件名: " backup_file
    else
        backup_file="$1"
    fi

    BACKUP_PATH="$BACKUP_DIR/$backup_file"

    if [ ! -f "$BACKUP_PATH" ]; then
        echo -e "${RED}❌ 备份文件不存在: $BACKUP_PATH${NC}"
        exit 1
    fi

    echo -e "${BLUE}🔄 恢复 PostgreSQL 数据库...${NC}"
    docker-compose exec -T postgres psql -U postgres funnypixels_postgres < "$BACKUP_PATH"

    echo -e "${GREEN}✅ 恢复完成${NC}"
}

# 进入 PostgreSQL
enter_psql() {
    echo -e "${BLUE}🔌 进入 PostgreSQL 命令行...${NC}"
    echo "输入 \\q 退出"
    echo ""
    docker-compose exec postgres psql -U postgres funnypixels_postgres
}

# 进入 Redis
enter_redis() {
    echo -e "${BLUE}🔌 进入 Redis 命令行...${NC}"
    echo "输入 exit 退出"
    echo ""
    docker-compose exec redis redis-cli
}

# 主命令处理
case "${1:-help}" in
    start)
        start_services
        ;;
    start-all)
        start_all_services
        ;;
    stop)
        stop_services
        ;;
    restart)
        restart_services
        ;;
    status)
        show_status
        ;;
    logs)
        show_logs
        ;;
    clean)
        clean_all
        ;;
    backup)
        backup_database
        ;;
    restore)
        restore_database "$2"
        ;;
    psql)
        enter_psql
        ;;
    redis)
        enter_redis
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        echo -e "${RED}❌ 未知命令: $1${NC}"
        echo ""
        show_help
        exit 1
        ;;
esac
