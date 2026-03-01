#!/bin/bash
# ===========================================
# FunnyPixels 一键部署脚本
# GitHub Actions 或手动执行
# 用法: cd /opt/funnypixels && ./deploy/deploy.sh
# ===========================================

set -euo pipefail

PROJECT_DIR="/opt/funnypixels"
COMPOSE_FILE="docker-compose.production.yml"
HEALTH_URL="http://localhost:3001/api/health"
MAX_WAIT=60

cd "$PROJECT_DIR"

echo "=========================================="
echo "  FunnyPixels 部署开始"
echo "  $(date '+%Y-%m-%d %H:%M:%S')"
echo "=========================================="

# ------------------------------------------
# 1. 拉取最新代码
# ------------------------------------------
echo "[1/5] 拉取最新代码..."
git pull origin main

# ------------------------------------------
# 2. 构建 Backend 镜像
# ------------------------------------------
echo "[2/5] 构建 Backend 镜像..."
# 保存当前镜像 ID 用于回滚
OLD_IMAGE=$(docker images -q funnypixels_backend_prod 2>/dev/null || echo "")
docker compose -f "$COMPOSE_FILE" build --no-cache backend

# ------------------------------------------
# 3. 运行数据库迁移
# ------------------------------------------
echo "[3/5] 运行数据库迁移..."
# 确保 postgres 和 redis 正在运行
docker compose -f "$COMPOSE_FILE" up -d postgres redis

# 等待数据库就绪
echo "等待数据库就绪..."
sleep 5

docker compose -f "$COMPOSE_FILE" run --rm backend npx knex migrate:latest
echo "数据库迁移完成"

# ------------------------------------------
# 4. 启动/更新服务
# ------------------------------------------
echo "[4/5] 启动服务..."
docker compose -f "$COMPOSE_FILE" up -d

# ------------------------------------------
# 5. 健康检查
# ------------------------------------------
echo "[5/5] 健康检查 (最长等待 ${MAX_WAIT}s)..."
WAITED=0
while [ $WAITED -lt $MAX_WAIT ]; do
    if curl -sf "$HEALTH_URL" > /dev/null 2>&1; then
        echo "健康检查通过！"
        echo ""
        echo "=========================================="
        echo "  部署成功！"
        echo "  $(date '+%Y-%m-%d %H:%M:%S')"
        echo "=========================================="
        docker compose -f "$COMPOSE_FILE" ps
        exit 0
    fi
    sleep 3
    WAITED=$((WAITED + 3))
    echo "  等待中... (${WAITED}s/${MAX_WAIT}s)"
done

# ------------------------------------------
# 健康检查失败 - 自动回滚
# ------------------------------------------
echo ""
echo "健康检查失败！尝试回滚..."

# 查看失败日志
docker compose -f "$COMPOSE_FILE" logs --tail=50 backend

if [ -n "$OLD_IMAGE" ]; then
    echo "回滚到上一个镜像: $OLD_IMAGE"
    docker compose -f "$COMPOSE_FILE" stop backend
    docker tag "$OLD_IMAGE" funnypixels_backend_prod:latest 2>/dev/null || true
    docker compose -f "$COMPOSE_FILE" up -d backend
    echo "回滚完成，请检查服务状态"
else
    echo "无可用的回滚镜像"
fi

echo ""
echo "=========================================="
echo "  部署失败！请检查日志"
echo "  $(date '+%Y-%m-%d %H:%M:%S')"
echo "=========================================="
exit 1
