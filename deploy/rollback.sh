#!/bin/bash
# ===========================================
# FunnyPixels 快速回滚脚本
# 回滚到指定 Git commit 并重新部署
# 用法: ./deploy/rollback.sh [commit-hash]
# ===========================================

set -euo pipefail

PROJECT_DIR="/opt/funnypixels"
COMPOSE_FILE="docker-compose.production.yml"
HEALTH_URL="http://localhost:3001/api/health"

cd "$PROJECT_DIR"

if [ -z "${1:-}" ]; then
    echo "用法: $0 <commit-hash>"
    echo ""
    echo "最近 10 次提交:"
    git log --oneline -10
    exit 1
fi

TARGET_COMMIT="$1"
CURRENT_COMMIT=$(git rev-parse --short HEAD)

echo "=========================================="
echo "  FunnyPixels 回滚"
echo "=========================================="
echo "当前: $CURRENT_COMMIT"
echo "目标: $TARGET_COMMIT"
echo ""

read -p "确认回滚? (y/N) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "已取消"
    exit 0
fi

# 回滚代码
echo "[1/3] 回滚代码到 $TARGET_COMMIT..."
git checkout "$TARGET_COMMIT"

# 重新构建并启动
echo "[2/3] 重新构建并启动..."
docker compose -f "$COMPOSE_FILE" build --no-cache backend
docker compose -f "$COMPOSE_FILE" up -d

# 健康检查
echo "[3/3] 健康检查..."
sleep 10
if curl -sf "$HEALTH_URL" > /dev/null 2>&1; then
    echo ""
    echo "回滚成功！当前运行版本: $TARGET_COMMIT"
else
    echo ""
    echo "回滚后健康检查失败，请检查日志:"
    echo "  docker compose -f $COMPOSE_FILE logs --tail=50 backend"
fi
