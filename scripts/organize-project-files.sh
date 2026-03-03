#!/bin/bash
# =============================================================================
# FunnyPixels 项目文件整理脚本
# 用途：整理临时文件、日志和文档，使项目符合monorepo管理规范
# 作者：Claude Code
# 日期：2026-02-22
# =============================================================================

set -e

PROJECT_ROOT="/Users/ginochow/code/funnypixels3"
cd "$PROJECT_ROOT"

echo "======================================"
echo "FunnyPixels 项目文件整理工具"
echo "======================================"
echo ""

# =============================================================================
# 1. 创建目录结构
# =============================================================================
echo "📁 [1/6] 创建目录结构..."

mkdir -p logs/build
mkdir -p logs/runtime
mkdir -p .temp/backups
mkdir -p docs/troubleshooting
mkdir -p docs/reports
mkdir -p docs/guides
mkdir -p docs/monitoring
mkdir -p docs/configuration
mkdir -p docs/backend
mkdir -p app/docs
mkdir -p frontend/docs
mkdir -p admin-frontend/docs

echo "  ✓ 目录结构创建完成"

# =============================================================================
# 2. 整理构建日志文件 (55个)
# =============================================================================
echo ""
echo "📋 [2/6] 整理构建日志文件..."

# 移动根目录的所有.log文件到logs/build/
if ls *.log 1> /dev/null 2>&1; then
    echo "  发现 $(ls *.log | wc -l | xargs) 个日志文件，移动到 logs/build/ ..."
    mv *.log logs/build/ 2>/dev/null || true
    echo "  ✓ 构建日志已移动"
else
    echo "  ✓ 未发现需要移动的日志文件"
fi

# 移动app/FunnyPixels/的日志文件
if ls app/FunnyPixels/*.log 1> /dev/null 2>&1; then
    mv app/FunnyPixels/*.log logs/build/ 2>/dev/null || true
    echo "  ✓ iOS构建日志已移动"
fi

# 移动.zeroclaw/的日志到runtime
if [ -d ".zeroclaw" ] && ls .zeroclaw/*.log 1> /dev/null 2>&1; then
    mv .zeroclaw/*.log logs/runtime/ 2>/dev/null || true
    echo "  ✓ 运行时日志已移动"
fi

# =============================================================================
# 3. 整理备份文件
# =============================================================================
echo ""
echo "💾 [3/6] 整理备份文件..."

# 移动所有.backup*文件
find . -maxdepth 3 -name "*.backup*" -type f 2>/dev/null | while read file; do
    filename=$(basename "$file")
    mv "$file" ".temp/backups/" 2>/dev/null || true
done
echo "  ✓ 备份文件已移动到 .temp/backups/"

# =============================================================================
# 4. 整理根目录MD文档
# =============================================================================
echo ""
echo "📄 [4/6] 整理根目录MD文档..."

# Achievement相关文档 -> docs/reports/
echo "  整理成就系统相关文档..."
mv achievement_audit_report.md docs/reports/ 2>/dev/null || true
mv ACHIEVEMENT_*.md docs/reports/ 2>/dev/null || true

# GPS相关文档 -> docs/troubleshooting/ 或已存在的docs/gps/
echo "  整理GPS相关文档..."
mv GPS_*.md docs/gps/ 2>/dev/null || true
mv AVATAR_PIXEL_*.md docs/troubleshooting/ 2>/dev/null || true

# 性能相关文档 -> docs/optimization/
echo "  整理性能优化相关文档..."
mv COMPLETE_PERFORMANCE_ANALYSIS.md docs/optimization/ 2>/dev/null || true
mv OPTIMIZATION_*.md docs/optimization/ 2>/dev/null || true
mv PERFORMANCE_*.md docs/optimization/ 2>/dev/null || true
mv ENHANCEMENT_*.md docs/optimization/ 2>/dev/null || true

# 配置相关文档 -> docs/configuration/
echo "  整理配置相关文档..."
mv CONFIG_*.md docs/configuration/ 2>/dev/null || true
mv UPDATE_DEV_IP_GUIDE.md docs/configuration/ 2>/dev/null || true
mv REDIS_DEPLOYMENT.md docs/deployment/ 2>/dev/null || true

# 监控相关文档 -> docs/monitoring/
echo "  整理监控相关文档..."
mv MONITORING_*.md docs/monitoring/ 2>/dev/null || true

# 故障排查文档 -> docs/troubleshooting/
echo "  整理故障排查文档..."
mv BUGFIX_*.md docs/troubleshooting/ 2>/dev/null || true
mv DEEP_DIAGNOSTICS_REPORT.md docs/troubleshooting/ 2>/dev/null || true
mv ZOOM_*.md docs/troubleshooting/ 2>/dev/null || true
mv STATISTICS_*.md docs/troubleshooting/ 2>/dev/null || true
mv XCODE_ERRORS_EXPLAINED.md docs/troubleshooting/ 2>/dev/null || true

# iOS开发相关文档 -> docs/development/
echo "  整理iOS开发文档..."
mv iOS_*.md docs/development/ 2>/dev/null || true
mv LOW_POWER_MODE_*.md docs/development/ 2>/dev/null || true

# 功能开发文档 -> docs/development/
echo "  整理功能开发文档..."
mv HISTORY_GALLERY_*.md docs/development/ 2>/dev/null || true
mv LEADERBOARD_*.md docs/development/ 2>/dev/null || true
mv LOGIN_LAG_FIX.md docs/troubleshooting/ 2>/dev/null || true
mv VIRAL_MARKETING_*.md docs/development/ 2>/dev/null || true

# 设置和快速开始 -> docs/guides/
echo "  整理指南文档..."
mv QUICKSTART.md docs/guides/ 2>/dev/null || true

echo "  ✓ 根目录文档已整理"

# =============================================================================
# 5. 整理子目录的MD文档
# =============================================================================
echo ""
echo "📚 [5/6] 整理子目录文档..."

# Backend文档
echo "  整理backend文档..."
mv backend/CONTROLLER_REFACTORING_GUIDE.md docs/backend/ 2>/dev/null || true
mv backend/REFACTORING_SUMMARY.md docs/backend/ 2>/dev/null || true
mv backend/JSDOC_GUIDE.md docs/backend/ 2>/dev/null || true
mv backend/SECURITY_*.md docs/backend/ 2>/dev/null || true
mv backend/PROJECT_COMPLETION_SUMMARY.md docs/backend/ 2>/dev/null || true
mv backend/IOS_LEADERBOARD_FIXES_SUMMARY.md docs/backend/ 2>/dev/null || true

# iOS App文档
echo "  整理iOS app文档..."
mv app/FunnyPixels/iOS_*.md app/docs/ 2>/dev/null || true
mv app/FunnyPixels/Advanced_Features_Gap_Analysis.md app/docs/ 2>/dev/null || true
mv app/FunnyPixels/fix_report.md app/docs/ 2>/dev/null || true
mv app/FunnyPixels/PROJECT_COMPLETION_SUMMARY.md app/docs/ 2>/dev/null || true

# 其他app目录文档
mv app/TESTING_WITHOUT_PAID_ACCOUNT.md app/docs/ 2>/dev/null || true
mv app/SIMPLE_SETUP_GUIDE.md app/docs/ 2>/dev/null || true
mv app/iOS_*.md app/docs/ 2>/dev/null || true
mv app/DEBUG_CRASH.md app/docs/ 2>/dev/null || true

echo "  ✓ 子目录文档已整理"

# =============================================================================
# 6. 清理临时文件
# =============================================================================
echo ""
echo "🧹 [6/6] 清理临时文件..."

# 移动临时脚本
mv remove_bg*.py .temp/ 2>/dev/null || true
mv remove_bg*.swift .temp/ 2>/dev/null || true
mv files-to-remove.txt .temp/ 2>/dev/null || true
mv app.log logs/runtime/ 2>/dev/null || true

echo "  ✓ 临时文件已清理"

# =============================================================================
# 汇总报告
# =============================================================================
echo ""
echo "======================================"
echo "✅ 文件整理完成！"
echo "======================================"
echo ""
echo "目录结构："
echo "  logs/build/       - 构建日志 ($(find logs/build/ -type f 2>/dev/null | wc -l | xargs) 个文件)"
echo "  logs/runtime/     - 运行时日志 ($(find logs/runtime/ -type f 2>/dev/null | wc -l | xargs) 个文件)"
echo "  .temp/backups/    - 备份文件 ($(find .temp/backups/ -type f 2>/dev/null | wc -l | xargs) 个文件)"
echo "  docs/            - 项目文档"
echo "  docs/backend/    - 后端文档"
echo "  app/docs/        - iOS文档"
echo ""
echo "下一步："
echo "  1. 运行: ./scripts/update-gitignore.sh"
echo "  2. 检查整理结果: git status"
echo "  3. 提交更改: git add . && git commit -m 'chore: organize project files'"
echo ""
