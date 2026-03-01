#!/bin/bash
# ========================================
# FunnyPixels 应用服务器一键部署脚本
# 运行在服务器 1 (应用服务器)
# Usage: ./deploy-app-server.sh
# ========================================

set -euo pipefail

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# 检查是否为 root
if [ "$EUID" -eq 0 ]; then
  log_error "请不要使用 root 运行此脚本，使用 deploy 用户"
  exit 1
fi

log_info "=========================================="
log_info "  FunnyPixels 应用服务器部署"
log_info "=========================================="

# ==========================================
# 1. 检查环境
# ==========================================
log_info "[1/7] 检查部署环境..."

if [ ! -f ".env.production" ]; then
  log_error ".env.production 文件不存在"
  log_info "请先复制并配置: cp deploy/.env.production.template .env.production"
  exit 1
fi

if ! command -v node &> /dev/null; then
  log_error "Node.js 未安装"
  exit 1
fi

if ! command -v npm &> /dev/null; then
  log_error "npm 未安装"
  exit 1
fi

log_info "✅ 环境检查通过"

# ==========================================
# 2. 拉取最新代码
# ==========================================
log_info "[2/7] 拉取最新代码..."

git pull origin main || {
  log_error "Git pull 失败"
  exit 1
}

log_info "✅ 代码已更新"

# ==========================================
# 3. 安装依赖
# ==========================================
log_info "[3/7] 安装后端依赖..."

cd backend
npm ci --production || {
  log_error "依赖安装失败"
  exit 1
}

log_info "✅ 依赖已安装"

# ==========================================
# 4. 数据库迁移
# ==========================================
log_info "[4/7] 运行数据库迁移..."

npx knex migrate:latest --env production || {
  log_error "数据库迁移失败"
  exit 1
}

log_info "✅ 数据库迁移完成"

# ==========================================
# 5. 重启应用
# ==========================================
log_info "[5/7] 重启应用..."

if command -v pm2 &> /dev/null; then
  # 使用 PM2
  if pm2 list | grep -q "funnypixels-backend"; then
    pm2 restart funnypixels-backend
  else
    pm2 start src/cluster.js --name funnypixels-backend -i 1 --env production
    pm2 save
  fi
  log_info "✅ PM2 应用已重启"
else
  log_warn "PM2 未安装，请手动重启应用"
fi

# ==========================================
# 6. 验证部署
# ==========================================
log_info "[6/7] 验证部署..."

sleep 5

# 检查 PM2 状态
if command -v pm2 &> /dev/null; then
  pm2 status
fi

# 测试健康检查
if curl -sf http://localhost:3001/api/health > /dev/null; then
  log_info "✅ 健康检查通过"
else
  log_error "健康检查失败"
  exit 1
fi

# ==========================================
# 7. 完成
# ==========================================
log_info "[7/7] 部署完成！"
log_info "=========================================="
log_info "访问 https://api.funnypixelsapp.com/api/health 测试"
log_info "查看日志: pm2 logs funnypixels-backend"
log_info "=========================================="
