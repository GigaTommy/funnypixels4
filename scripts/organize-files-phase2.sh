#!/bin/bash
# =============================================================================
# Phase 2: 移动有依赖的文档并更新引用
# 用途：整理剩余MD文档到规范目录，并自动更新文档引用
# 风险等级：🟡 中风险（会更新文档引用）
# =============================================================================

set -e

PROJECT_ROOT="/Users/ginochow/code/funnypixels3"
cd "$PROJECT_ROOT"

echo "======================================"
echo "Phase 2: 移动有依赖的文档"
echo "风险等级: 🟡 中"
echo "======================================"
echo ""

# =============================================================================
# 创建目录结构
# =============================================================================
echo "📁 [1/8] 创建目录结构..."
mkdir -p docs/troubleshooting
mkdir -p docs/optimization
mkdir -p docs/configuration
mkdir -p docs/monitoring
mkdir -p docs/guides
mkdir -p backend/docs
mkdir -p app/docs
mkdir -p frontend/docs
echo "  ✓ 目录结构创建完成"
echo ""

# =============================================================================
# 2. 移动GPS相关文档
# =============================================================================
echo "🗺️  [2/8] 移动GPS相关文档到 docs/gps/ ..."
GPS_COUNT=0
for file in GPS_*.md; do
    if [ -f "$file" ]; then
        mv "$file" docs/gps/ 2>/dev/null && GPS_COUNT=$((GPS_COUNT + 1))
    fi
done
echo "  ✓ 已移动 $GPS_COUNT 个GPS文档"
echo ""

# =============================================================================
# 3. 移动统计和优化文档
# =============================================================================
echo "📊 [3/8] 移动统计和优化文档..."

# 统计文档到troubleshooting
STAT_COUNT=0
for file in STATISTICS_*.md; do
    if [ -f "$file" ]; then
        mv "$file" docs/troubleshooting/ 2>/dev/null && STAT_COUNT=$((STAT_COUNT + 1))
    fi
done

# 优化文档到optimization
OPT_COUNT=0
for file in OPTIMIZATION_*.md PERFORMANCE_*.md; do
    if [ -f "$file" ]; then
        mv "$file" docs/optimization/ 2>/dev/null && OPT_COUNT=$((OPT_COUNT + 1))
    fi
done

echo "  ✓ 已移动 $STAT_COUNT 个统计文档到 docs/troubleshooting/"
echo "  ✓ 已移动 $OPT_COUNT 个优化文档到 docs/optimization/"
echo ""

# =============================================================================
# 4. 移动配置和监控文档
# =============================================================================
echo "⚙️  [4/8] 移动配置和监控文档..."

# 配置文档
CONFIG_COUNT=0
for file in CONFIG_*.md UPDATE_DEV_IP_GUIDE.md; do
    if [ -f "$file" ]; then
        mv "$file" docs/configuration/ 2>/dev/null && CONFIG_COUNT=$((CONFIG_COUNT + 1))
    fi
done

# 监控文档
MONITOR_COUNT=0
for file in MONITORING_*.md; do
    if [ -f "$file" ]; then
        mv "$file" docs/monitoring/ 2>/dev/null && MONITOR_COUNT=$((MONITOR_COUNT + 1))
    fi
done

echo "  ✓ 已移动 $CONFIG_COUNT 个配置文档到 docs/configuration/"
echo "  ✓ 已移动 $MONITOR_COUNT 个监控文档到 docs/monitoring/"
echo ""

# =============================================================================
# 5. 移动故障排查文档
# =============================================================================
echo "🔧 [5/8] 移动故障排查文档..."

TROUBLE_COUNT=0
for file in BUGFIX_*.md DEEP_DIAGNOSTICS_REPORT.md ZOOM_*.md XCODE_ERRORS_EXPLAINED.md \
            AVATAR_PIXEL_*.md LOGIN_LAG_FIX.md LEADERBOARD_ID_FIX.md; do
    if [ -f "$file" ]; then
        mv "$file" docs/troubleshooting/ 2>/dev/null && TROUBLE_COUNT=$((TROUBLE_COUNT + 1))
    fi
done

echo "  ✓ 已移动 $TROUBLE_COUNT 个故障排查文档到 docs/troubleshooting/"
echo ""

# =============================================================================
# 6. 移动开发和功能文档
# =============================================================================
echo "💻 [6/8] 移动开发和功能文档..."

# 开发文档
DEV_COUNT=0
for file in iOS_*.md LOW_POWER_MODE_*.md ENHANCEMENT_*.md HISTORY_GALLERY_*.md \
            VIRAL_MARKETING_*.md; do
    if [ -f "$file" ]; then
        mv "$file" docs/development/ 2>/dev/null && DEV_COUNT=$((DEV_COUNT + 1))
    fi
done

# 快速开始指南
GUIDE_COUNT=0
if [ -f "QUICKSTART.md" ]; then
    mv QUICKSTART.md docs/guides/ && GUIDE_COUNT=1
fi

echo "  ✓ 已移动 $DEV_COUNT 个开发文档到 docs/development/"
echo "  ✓ 已移动 $GUIDE_COUNT 个指南到 docs/guides/"
echo ""

# =============================================================================
# 7. 移动Backend和App文档
# =============================================================================
echo "📦 [7/8] 移动子项目文档..."

# Backend文档
BACKEND_COUNT=0
for file in backend/CONTROLLER_REFACTORING_GUIDE.md backend/REFACTORING_SUMMARY.md \
            backend/JSDOC_GUIDE.md backend/SECURITY_*.md \
            backend/PROJECT_COMPLETION_SUMMARY.md backend/IOS_LEADERBOARD_FIXES_SUMMARY.md; do
    if [ -f "$file" ]; then
        filename=$(basename "$file")
        mv "$file" backend/docs/ 2>/dev/null && BACKEND_COUNT=$((BACKEND_COUNT + 1))
    fi
done

# App文档
APP_COUNT=0
if [ -d "app/FunnyPixels" ]; then
    for file in app/FunnyPixels/*.md; do
        if [ -f "$file" ]; then
            mv "$file" app/docs/ 2>/dev/null && APP_COUNT=$((APP_COUNT + 1))
        fi
    done
fi

# app根目录的文档
for file in app/iOS_*.md app/TESTING_*.md app/SIMPLE_*.md app/DEBUG_*.md; do
    if [ -f "$file" ]; then
        mv "$file" app/docs/ 2>/dev/null && APP_COUNT=$((APP_COUNT + 1))
    fi
done

echo "  ✓ 已移动 $BACKEND_COUNT 个Backend文档到 backend/docs/"
echo "  ✓ 已移动 $APP_COUNT 个App文档到 app/docs/"
echo ""

# =============================================================================
# 8. 更新文档引用
# =============================================================================
echo "🔗 [8/8] 更新文档引用..."

# 更新STATISTICS_FIX_SUMMARY.md的引用
if [ -f "docs/troubleshooting/STATISTICS_FIX_SUMMARY.md" ]; then
    sed -i.bak 's|`GPS_DRAWING_VERIFICATION_GUIDE.md`](./GPS_DRAWING_VERIFICATION_GUIDE.md)|`GPS_DRAWING_VERIFICATION_GUIDE.md`](../gps/GPS_DRAWING_VERIFICATION_GUIDE.md)|g' docs/troubleshooting/STATISTICS_FIX_SUMMARY.md
    sed -i.bak 's|`OPTIMIZATION_TRACKING.md`](./OPTIMIZATION_TRACKING.md)|`OPTIMIZATION_TRACKING.md`](../optimization/OPTIMIZATION_TRACKING.md)|g' docs/troubleshooting/STATISTICS_FIX_SUMMARY.md
    rm -f docs/troubleshooting/STATISTICS_FIX_SUMMARY.md.bak
    echo "  ✓ 更新 STATISTICS_FIX_SUMMARY.md 引用"
fi

# 更新STATISTICS_BUG_ANALYSIS.md的引用
if [ -f "docs/troubleshooting/STATISTICS_BUG_ANALYSIS.md" ]; then
    sed -i.bak 's|GPS绘制验证指南: `GPS_DRAWING_VERIFICATION_GUIDE.md`|GPS绘制验证指南: `../gps/GPS_DRAWING_VERIFICATION_GUIDE.md`|g' docs/troubleshooting/STATISTICS_BUG_ANALYSIS.md
    sed -i.bak 's|性能优化跟踪: `OPTIMIZATION_TRACKING.md`|性能优化跟踪: `../optimization/OPTIMIZATION_TRACKING.md`|g' docs/troubleshooting/STATISTICS_BUG_ANALYSIS.md
    rm -f docs/troubleshooting/STATISTICS_BUG_ANALYSIS.md.bak
    echo "  ✓ 更新 STATISTICS_BUG_ANALYSIS.md 引用"
fi

# 更新STATISTICS_FIX_VERIFICATION.md的引用
if [ -f "docs/troubleshooting/STATISTICS_FIX_VERIFICATION.md" ]; then
    sed -i.bak 's|`STATISTICS_BUG_ANALYSIS.md`](./STATISTICS_BUG_ANALYSIS.md)|`STATISTICS_BUG_ANALYSIS.md`](./STATISTICS_BUG_ANALYSIS.md)|g' docs/troubleshooting/STATISTICS_FIX_VERIFICATION.md
    sed -i.bak 's|`STATISTICS_FIX_SUMMARY.md`](./STATISTICS_FIX_SUMMARY.md)|`STATISTICS_FIX_SUMMARY.md`](./STATISTICS_FIX_SUMMARY.md)|g' docs/troubleshooting/STATISTICS_FIX_VERIFICATION.md
    sed -i.bak 's|`GPS_DRAWING_VERIFICATION_GUIDE.md`](./GPS_DRAWING_VERIFICATION_GUIDE.md)|`GPS_DRAWING_VERIFICATION_GUIDE.md`](../gps/GPS_DRAWING_VERIFICATION_GUIDE.md)|g' docs/troubleshooting/STATISTICS_FIX_VERIFICATION.md
    rm -f docs/troubleshooting/STATISTICS_FIX_VERIFICATION.md.bak
    echo "  ✓ 更新 STATISTICS_FIX_VERIFICATION.md 引用"
fi

# 更新UPDATE_DEV_IP_GUIDE.md的引用
if [ -f "docs/configuration/UPDATE_DEV_IP_GUIDE.md" ]; then
    sed -i.bak 's|`MONITORING_QUICKSTART.md`|[`MONITORING_QUICKSTART.md`](../monitoring/MONITORING_QUICKSTART.md)|g' docs/configuration/UPDATE_DEV_IP_GUIDE.md
    rm -f docs/configuration/UPDATE_DEV_IP_GUIDE.md.bak
    echo "  ✓ 更新 UPDATE_DEV_IP_GUIDE.md 引用"
fi

# 更新脚本引用
if [ -f "app/run_ios_app.sh" ]; then
    sed -i.bak 's|iOS_APP_SETUP.md|docs/iOS_APP_SETUP.md|g' app/run_ios_app.sh
    rm -f app/run_ios_app.sh.bak
    echo "  ✓ 更新 app/run_ios_app.sh 引用"
fi

if [ -f "debug-tools/test-gps-automation.sh" ]; then
    sed -i.bak 's|GPS_LOCATION_TESTING_GUIDE.md|../docs/gps/GPS_LOCATION_TESTING_GUIDE.md|g' debug-tools/test-gps-automation.sh
    rm -f debug-tools/test-gps-automation.sh.bak
    echo "  ✓ 更新 debug-tools/test-gps-automation.sh 引用"
fi

echo "  ✓ 文档引用更新完成"
echo ""

# =============================================================================
# 汇总报告
# =============================================================================
echo "======================================"
echo "✅ Phase 2 完成！"
echo "======================================"
echo ""
echo "移动统计："
echo "  🗺️  GPS文档:        $GPS_COUNT 个"
echo "  📊 统计文档:        $STAT_COUNT 个"
echo "  ⚡ 优化文档:        $OPT_COUNT 个"
echo "  ⚙️  配置文档:        $CONFIG_COUNT 个"
echo "  📡 监控文档:        $MONITOR_COUNT 个"
echo "  🔧 故障排查文档:    $TROUBLE_COUNT 个"
echo "  💻 开发文档:        $DEV_COUNT 个"
echo "  📖 指南文档:        $GUIDE_COUNT 个"
echo "  📦 Backend文档:     $BACKEND_COUNT 个"
echo "  📱 App文档:         $APP_COUNT 个"
echo ""
echo "目录结构："
echo "  docs/gps/               - $(find docs/gps/ -name "*.md" 2>/dev/null | wc -l | xargs) 个文档"
echo "  docs/troubleshooting/   - $(find docs/troubleshooting/ -name "*.md" 2>/dev/null | wc -l | xargs) 个文档"
echo "  docs/optimization/      - $(find docs/optimization/ -name "*.md" 2>/dev/null | wc -l | xargs) 个文档"
echo "  docs/configuration/     - $(find docs/configuration/ -name "*.md" 2>/dev/null | wc -l | xargs) 个文档"
echo "  docs/monitoring/        - $(find docs/monitoring/ -name "*.md" 2>/dev/null | wc -l | xargs) 个文档"
echo "  docs/development/       - $(find docs/development/ -name "*.md" 2>/dev/null | wc -l | xargs) 个文档"
echo "  docs/guides/            - $(find docs/guides/ -name "*.md" 2>/dev/null | wc -l | xargs) 个文档"
echo "  backend/docs/           - $(find backend/docs/ -name "*.md" 2>/dev/null | wc -l | xargs) 个文档"
echo "  app/docs/               - $(find app/docs/ -name "*.md" 2>/dev/null | wc -l | xargs) 个文档"
echo ""
echo "✅ 已更新的引用："
echo "  • STATISTICS_FIX_SUMMARY.md"
echo "  • STATISTICS_BUG_ANALYSIS.md"
echo "  • STATISTICS_FIX_VERIFICATION.md"
echo "  • UPDATE_DEV_IP_GUIDE.md"
echo "  • app/run_ios_app.sh"
echo "  • debug-tools/test-gps-automation.sh"
echo ""
echo "下一步："
echo "  1. 验证引用: grep -r '\\.\\./.*\\.md' docs/"
echo "  2. 检查根目录: ls -1 *.md | wc -l"
echo "  3. 查看git状态: git status"
echo "  4. 更新.gitignore: ./scripts/update-gitignore.sh"
echo ""
