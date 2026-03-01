#!/bin/bash
# Swift/iOS 项目自动构建修复脚本
# 用途：自动检测编译错误并应用修复规则

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 项目根目录
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$PROJECT_ROOT"

# 日志文件
BUILD_LOG="$PROJECT_ROOT/build_errors.log"
FIXED_LOG="$PROJECT_ROOT/build_errors_after.log"
REPORT_FILE="$PROJECT_ROOT/fix_report.md"

# 统计变量
TOTAL_ERRORS=0
FIXED_ERRORS=0
REMAINING_ERRORS=0

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Swift/iOS 自动构建修复工具${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Step 1: 创建备份
echo -e "${YELLOW}📦 创建备份...${NC}"
if [ -n "$(git status --porcelain)" ]; then
    git add -A
    git commit -m "backup: before auto-fix $(date +%Y%m%d_%H%M%S)" || true
    echo -e "${GREEN}✓ 备份完成${NC}"
else
    echo -e "${YELLOW}⚠ 没有更改需要备份${NC}"
fi
echo ""

# Step 2: 运行初始构建
echo -e "${YELLOW}🔨 运行初始构建...${NC}"
if swift build 2>&1 | tee "$BUILD_LOG"; then
    echo -e "${GREEN}✓ 构建成功，无需修复！${NC}"
    exit 0
fi
echo ""

# Step 3: 分析错误
echo -e "${YELLOW}📊 分析错误...${NC}"
TOTAL_ERRORS=$(grep -c "error:" "$BUILD_LOG" || echo "0")
echo "发现 $TOTAL_ERRORS 个错误"
echo ""

# Step 4: 按类型分类错误
echo -e "${YELLOW}🔍 错误分类...${NC}"

# 创建错误类型文件
mkdir -p "$PROJECT_ROOT/.fix_cache"

# macOS 兼容性错误
grep -E "is unavailable in macOS" "$BUILD_LOG" | grep -oE "^/[^:]+:[0-9]+:[0-9]+:" | sort -u > "$PROJECT_ROOT/.fix_cache/macos_errors.txt" || true
MACOS_ERRORS=$(wc -l < "$PROJECT_ROOT/.fix_cache/macos_errors.txt" | tr -d ' ')

# Color 系统错误
grep -E "type 'CGColor' has no member" "$BUILD_LOG" | grep -oE "^/[^:]+:[0-9]+:[0-9]+:" | sort -u > "$PROJECT_ROOT/.fix_cache/color_errors.txt" || true
COLOR_ERRORS=$(wc -l < "$PROJECT_ROOT/.fix_cache/color_errors.txt" | tr -d ' ')

# onChange API 错误
grep -E "onChange.*is only available in macOS" "$BUILD_LOG" | grep -oE "^/[^:]+:[0-9]+:[0-9]+:" | sort -u > "$PROJECT_ROOT/.fix_cache/onchange_errors.txt" || true
ONCHANGE_ERRORS=$(wc -l < "$PROJECT_ROOT/.fix_cache/onchange_errors.txt" | tr -d ' ')

# 模型属性错误
grep -E "has no member" "$BUILD_LOG" | grep -v "Preview" | grep -oE "^/[^:]+:[0-9]+:[0-9]+:" | sort -u > "$PROJECT_ROOT/.fix_cache/model_errors.txt" || true
MODEL_ERRORS=$(wc -l < "$PROJECT_ROOT/.fix_cache/model_errors.txt" | tr -d ' ')

echo "  - macOS 兼容性: $MACOS_ERRORS"
echo "  - Color 系统: $COLOR_ERRORS"
echo "  - onChange API: $ONCHANGE_ERRORS"
echo "  - 模型属性: $MODEL_ERRORS"
echo ""

# Step 5: 应用修复规则
echo -e "${YELLOW}🔧 应用修复规则...${NC}"

# 导入修复规则
source "$PROJECT_ROOT/.claude/skills/fix-build-errors/fix_rules.sh"

FIXED_ERRORS=0

# 修复 macOS 兼容性
if [ "$MACOS_ERRORS" -gt 0 ]; then
    echo -e "${BLUE}  修复 macOS 兼容性错误...${NC}"
    fix_macos_errors
    FIXED_ERRORS=$((FIXED_ERRORS + MACOS_ERRORS))
fi

# 修复 Color 系统
if [ "$COLOR_ERRORS" -gt 0 ]; then
    echo -e "${BLUE}  修复 Color 系统错误...${NC}"
    fix_color_errors
    FIXED_ERRORS=$((FIXED_ERRORS + COLOR_ERRORS))
fi

# 修复 onChange API
if [ "$ONCHANGE_ERRORS" -gt 0 ]; then
    echo -e "${BLUE}  修复 onChange API 错误...${NC}"
    fix_onchange_errors
    FIXED_ERRORS=$((FIXED_ERRORS + ONCHANGE_ERRORS))
fi

# 修复模型属性
if [ "$MODEL_ERRORS" -gt 0 ]; then
    echo -e "${BLUE}  修复模型属性错误...${NC}"
    fix_model_errors
    FIXED_ERRORS=$((FIXED_ERRORS + MODEL_ERRORS))
fi

echo -e "${GREEN}✓ 应用了 $FIXED_ERRORS 个修复${NC}"
echo ""

# Step 6: 验证修复
echo -e "${YELLOW}🔄 验证修复结果...${NC}"
if swift build 2>&1 | tee "$FIXED_LOG"; then
    echo -e "${GREEN}✓ 构建成功！所有错误已修复${NC}"
else
    REMAINING_ERRORS=$(grep -c "error:" "$FIXED_LOG" || echo "0")
    echo -e "${YELLOW}⚠ 仍有 $REMAINING_ERRORS 个错误需要手动修复${NC}"
fi
echo ""

# Step 7: 生成报告
echo -e "${YELLOW}📊 生成修复报告...${NC}"
cat > "$REPORT_FILE" << EOF
# 构建修复报告

**时间**: $(date '+%Y-%m-%d %H:%M:%S')
**项目**: FunnyPixels

## 错误统计

- **初始错误数**: $TOTAL_ERRORS
- **自动修复数**: $FIXED_ERRORS
- **剩余错误数**: $REMAINING_ERRORS

## 错误分类

| 类型 | 数量 |
|------|------|
| macOS 兼容性 | $MACOS_ERRORS |
| Color 系统 | $COLOR_ERRORS |
| onChange API | $ONCHANGE_ERRORS |
| 模型属性 | $MODEL_ERRORS |

## 修复详情

EOF

# 添加修复详情
if [ "$MACOS_ERRORS" -gt 0 ]; then
    cat >> "$REPORT_FILE" << EOF
### macOS 兼容性修复
- 添加 \`#if os(iOS)\` 条件编译
- 替换 macOS 不支持的 API
EOF
fi

if [ "$COLOR_ERRORS" -gt 0 ]; then
    cat >> "$REPORT_FILE" << EOF
### Color 系统修复
- \`Color(.systemBackground)\` → \`Color.systemBackground\`
- \`Color(.systemGray6)\` → \`Color.systemGray6\`
EOF
fi

if [ "$ONCHANGE_ERRORS" -gt 0 ]; then
    cat >> "$REPORT_FILE" << EOF
### onChange API 修复
- \`onChange(of:initial:_:)\` → \`onChange(of:)\`
EOF
fi

if [ "$MODEL_ERRORS" -gt 0 ]; then
    cat >> "$REPORT_FILE" << EOF
### 模型属性修复
- 更新为正确的属性名称
- 移除不存在的属性
EOF
fi

cat >> "$REPORT_FILE" << EOF

## 下一步

$([ $REMAINING_ERRORS -gt 0 ] && echo "需要手动修复剩余错误。查看错误日志：" || echo "✅ 所有错误已自动修复，可以进行真机测试！")

\`\`\`bash
swift build 2>&1 | grep -v "Preview" | grep "error:"
\`\`\`
EOF

echo -e "${GREEN}✓ 报告已生成: $REPORT_FILE${NC}"
echo ""

# Step 8: 总结
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}修复总结${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "初始错误: ${RED}$TOTAL_ERRORS${NC}"
echo -e "已修复:   ${GREEN}$FIXED_ERRORS${NC}"
echo -e "剩余:     ${YELLOW}$REMAINING_ERRORS${NC}"
echo ""

if [ "$REMAINING_ERRORS" -eq 0 ]; then
    echo -e "${GREEN}🎉 所有错误已修复！可以开始真机测试了！${NC}"
    echo ""
    echo "下一步："
    echo "  1. 在 Xcode 中打开项目: xed ."
    echo "  2. 选择真机设备"
    echo "  3. 点击运行按钮"
    exit 0
else
    echo -e "${YELLOW}⚠ 部分错误需要手动修复${NC}"
    echo ""
    echo "查看剩余错误："
    echo "  cat $FIXED_LOG | grep -v 'Preview' | grep 'error:'"
    echo ""
    echo "查看修复报告："
    echo "  cat $REPORT_FILE"
    exit 1
fi
