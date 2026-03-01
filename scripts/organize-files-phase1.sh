#!/bin/bash
# =============================================================================
# Phase 1: 移动无依赖文件（安全操作）
# 用途：移动构建日志、备份文件、临时文件和独立报告文档
# 风险等级：🟢 低风险
# =============================================================================

set -e

PROJECT_ROOT="/Users/ginochow/code/funnypixels3"
cd "$PROJECT_ROOT"

echo "======================================"
echo "Phase 1: 移动无依赖文件"
echo "风险等级: 🟢 低"
echo "======================================"
echo ""

# =============================================================================
# 创建目录结构
# =============================================================================
echo "📁 创建目录结构..."
mkdir -p logs/build
mkdir -p logs/runtime
mkdir -p .temp/backups
mkdir -p docs/reports
echo "  ✓ 目录创建完成"
echo ""

# =============================================================================
# 1. 移动构建日志 (55个文件，无代码引用)
# =============================================================================
echo "📋 [1/5] 移动构建日志文件..."
LOG_COUNT=0

if ls build_v*.log 1> /dev/null 2>&1; then
    LOG_COUNT=$(ls build_v*.log | wc -l | xargs)
    echo "  发现 $LOG_COUNT 个版本构建日志"
    mv build_v*.log logs/build/ 2>/dev/null || true
fi

if ls build*.log 1> /dev/null 2>&1; then
    EXTRA_LOGS=$(ls build*.log 2>/dev/null | wc -l | xargs)
    LOG_COUNT=$((LOG_COUNT + EXTRA_LOGS))
    mv build*.log logs/build/ 2>/dev/null || true
fi

# 移动iOS构建日志
if [ -f "app/FunnyPixels/build_errors.log" ]; then
    mv app/FunnyPixels/build_errors*.log logs/build/ 2>/dev/null || true
    LOG_COUNT=$((LOG_COUNT + 2))
fi

echo "  ✓ 已移动 $LOG_COUNT 个日志文件到 logs/build/"
echo ""

# =============================================================================
# 2. 移动备份文件 (无代码引用)
# =============================================================================
echo "💾 [2/5] 移动备份文件..."
BACKUP_COUNT=0

# iOS Info.plist备份
if [ -f "FunnyPixelsApp/FunnyPixelsApp/Info.plist.backup.1771694103821" ]; then
    mv FunnyPixelsApp/FunnyPixelsApp/Info.plist.backup.* .temp/backups/ 2>/dev/null || true
    BACKUP_COUNT=$((BACKUP_COUNT + 1))
fi

# Frontend .env备份
if ls frontend/.env.backup* 1> /dev/null 2>&1; then
    mv frontend/.env.backup* .temp/backups/ 2>/dev/null || true
    BACKUP_COUNT=$((BACKUP_COUNT + 2))
fi

# .gitignore备份（如果有）
if ls .gitignore.backup* 1> /dev/null 2>&1; then
    mv .gitignore.backup* .temp/backups/ 2>/dev/null || true
    BACKUP_COUNT=$((BACKUP_COUNT + 1))
fi

echo "  ✓ 已移动 $BACKUP_COUNT 个备份文件到 .temp/backups/"
echo ""

# =============================================================================
# 3. 移动临时文件 (无代码引用)
# =============================================================================
echo "🧹 [3/5] 移动临时文件..."
TEMP_COUNT=0

# remove_bg相关文件
if ls remove_bg*.py 1> /dev/null 2>&1; then
    mv remove_bg*.py .temp/ 2>/dev/null || true
    TEMP_COUNT=$((TEMP_COUNT + 1))
fi

if ls remove_bg*.swift 1> /dev/null 2>&1; then
    mv remove_bg*.swift .temp/ 2>/dev/null || true
    TEMP_COUNT=$((TEMP_COUNT + 2))
fi

# 其他临时文件
[ -f "files-to-remove.txt" ] && mv files-to-remove.txt .temp/ && TEMP_COUNT=$((TEMP_COUNT + 1))
[ -f "app.log" ] && mv app.log logs/runtime/ && TEMP_COUNT=$((TEMP_COUNT + 1))

echo "  ✓ 已移动 $TEMP_COUNT 个临时文件"
echo ""

# =============================================================================
# 4. 移动独立报告文档 (无相互引用，可安全移动)
# =============================================================================
echo "📄 [4/5] 移动独立报告文档..."
DOC_COUNT=0

# Achievement相关报告
for file in achievement_audit_report.md ACHIEVEMENT_BUGS_FIX.md ACHIEVEMENT_GAMIFICATION_ENHANCEMENT.md \
            ACHIEVEMENT_MULTILANG_FIX.md ACHIEVEMENT_PHASE1_COMPLETED.md; do
    if [ -f "$file" ]; then
        mv "$file" docs/reports/ 2>/dev/null && DOC_COUNT=$((DOC_COUNT + 1))
    fi
done

echo "  ✓ 已移动 $DOC_COUNT 个独立报告文档到 docs/reports/"
echo ""

# =============================================================================
# 5. 移动.zeroclaw运行时日志
# =============================================================================
echo "📊 [5/5] 移动运行时日志..."
RUNTIME_COUNT=0

if [ -d ".zeroclaw" ] && ls .zeroclaw/*.log 1> /dev/null 2>&1; then
    cp .zeroclaw/*.log logs/runtime/ 2>/dev/null || true
    RUNTIME_COUNT=$(ls .zeroclaw/*.log 2>/dev/null | wc -l | xargs)
    echo "  ✓ 已复制 $RUNTIME_COUNT 个运行时日志到 logs/runtime/"
    echo "  ℹ️  原文件保留在 .zeroclaw/ (仍在使用中)"
else
    echo "  ℹ️  未发现运行时日志"
fi
echo ""

# =============================================================================
# 汇总报告
# =============================================================================
echo "======================================"
echo "✅ Phase 1 完成！"
echo "======================================"
echo ""
echo "移动统计："
echo "  📋 构建日志:    $LOG_COUNT 个"
echo "  💾 备份文件:    $BACKUP_COUNT 个"
echo "  🧹 临时文件:    $TEMP_COUNT 个"
echo "  📄 报告文档:    $DOC_COUNT 个"
echo "  📊 运行时日志:  $RUNTIME_COUNT 个 (已复制)"
echo ""
echo "生成的目录："
echo "  logs/build/       - $(find logs/build/ -type f 2>/dev/null | wc -l | xargs) 个文件"
echo "  logs/runtime/     - $(find logs/runtime/ -type f 2>/dev/null | wc -l | xargs) 个文件"
echo "  .temp/backups/    - $(find .temp/backups/ -type f 2>/dev/null | wc -l | xargs) 个文件"
echo "  docs/reports/     - $(find docs/reports/ -type f 2>/dev/null | wc -l | xargs) 个文件"
echo ""
echo "下一步："
echo "  1. 检查移动结果: ls -la logs/ .temp/ docs/reports/"
echo "  2. 查看依赖分析: cat FILE_DEPENDENCY_ANALYSIS.md"
echo "  3. 执行Phase 2: ./scripts/organize-files-phase2.sh (需要更新文档引用)"
echo ""
