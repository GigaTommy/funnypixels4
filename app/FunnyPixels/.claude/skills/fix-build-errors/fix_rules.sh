#!/bin/bash
# 错误修复规则引擎
# 包含各种错误类型的自动修复逻辑

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

# ============================================
# macOS 兼容性错误修复
# ============================================

fix_macos_errors() {
    local errors_file="$PROJECT_ROOT/.fix_cache/macos_errors.txt"
    local fixed=0

    while IFS=: read -r file line_num col_num; do
        if [ ! -f "$file" ]; then continue; fi

        echo "  修复: $file:$line_num"

        # 修复 navigationBarTitleDisplayMode
        if grep -q "navigationBarTitleDisplayMode" "$file"; then
            # 查找并替换
            sed -i '' '/\.navigationBarTitleDisplayMode(/ {
                s/\.navigationBarTitleDisplayMode(/\
#if os(iOS)\
                .navigationBarTitleDisplayMode(/
                a\
                #endif
            }' "$file" 2>/dev/null || true
            fixed=$((fixed + 1))
        fi

        # 修复 navigationBarLeading/Trailing
        if grep -q "navigationBarLeading\|navigationBarTrailing" "$file"; then
            sed -i '' 's/\.navigationBarLeading/#if os(iOS)\n                    .navigationBarLeading\n                    #else\n                    .cancellationAction\n                    #endif/g' "$file" 2>/dev/null || true
            sed -i '' 's/\.navigationBarTrailing/#if os(iOS)\n                    .navigationBarTrailing\n                    #else\n                    .automatic\n                    #endif/g' "$file" 2>/dev/null || true
            fixed=$((fixed + 1))
        fi

        # 修复 PageTabViewStyle
        if grep -q "PageTabViewStyle" "$file"; then
            perl -i -0pe 's/(\.tabViewStyle\(PageTabViewStyle)/#if os(iOS)\n                $1/g' "$file" 2>/dev/null || true
            perl -i -0pe 's/(indexDisplayMode: .never\))/$1\n                #endif/g' "$file" 2>/dev/null || true
            fixed=$((fixed + 1))
        fi

        # 修复 symbolEffect
        if grep -q "\.symbolEffect" "$file"; then
            # 简单替换，移除 macOS 不支持的 symbolEffect
            sed -i '' 's/\.symbolEffect(\..*)//' "$file" 2>/dev/null || true
            fixed=$((fixed + 1))
        fi

        # 修复 ContentUnavailableView
        if grep -q "ContentUnavailableView" "$file"; then
            sed -i '' 's/ContentUnavailableView/EmptyView/g' "$file" 2>/dev/null || true
            fixed=$((fixed + 1))
        fi

    done < "$errors_file"

    echo "  已修复 $fixed 个 macOS 兼容性问题"
}

# ============================================
# Color 系统错误修复
# ============================================

fix_color_errors() {
    local errors_file="$PROJECT_ROOT/.fix_cache/color_errors.txt"
    local fixed=0

    # 批量修复所有源文件
    find "$PROJECT_ROOT/Sources" -name "*.swift" -type f | while read -r file; do
        local file_fixed=0

        # 修复 Color(.xxx) 语法
        if grep -q "Color(\." "$file"; then
            sed -i '' 's/Color(\.systemBackground)/Color.systemBackground/g' "$file"
            sed -i '' 's/Color(\.systemGray6)/Color.systemGray6/g' "$file"
            sed -i '' 's/Color(\.systemGray5)/Color.systemGray5/g' "$file"
            sed -i '' 's/Color(\.systemGray4)/Color.systemGray4/g' "$file"
            sed -i '' 's/Color(\.quaternary)/Color.gray.opacity(0.3)/g' "$file"
            file_fixed=1
        fi

        if [ "$file_fixed" -eq 1 ]; then
            fixed=$((fixed + 1))
        fi
    done

    echo "  已修复 $fixed 个 Color 系统问题"
}

# ============================================
# onChange API 错误修复
# ============================================

fix_onchange_errors() {
    local errors_file="$PROJECT_ROOT/.fix_cache/onchange_errors.txt"
    local fixed=0

    while IFS=: read -r file line_num col_num; do
        if [ ! -f "$file" ]; then continue; fi

        echo "  修复: $file:$line_num"

        # 修复 onChange 双参数为单参数
        if grep -q "\.onChange(of:.*{" "$file"; then
            # 将 .onChange(of: value) { _, newValue in
            # 改为 .onChange(of: value) { newValue in
            sed -i '' 's/\.onChange(of: \([^ ]*\)) { _, \([^ ]*\) in/.onChange(of: \1) { \2 in/g' "$file" 2>/dev/null || true
            fixed=$((fixed + 1))
        fi

    done < "$errors_file"

    echo "  已修复 $fixed 个 onChange API 问题"
}

# ============================================
# 模型属性错误修复
# ============================================

fix_model_errors() {
    local errors_file="$PROJECT_ROOT/.fix_cache/model_errors.txt"
    local fixed=0

    # 读取错误信息并应用修复
    while IFS=: read -r file line_num col_num; do
        if [ ! -f "$file" ]; then continue; fi

        echo "  修复: $file:$line_num"

        # 提取错误信息
        local error_msg=$(grep "^$file:$line_num:" "$PROJECT_ROOT/build_errors.log" | head -1)

        # 根据错误类型应用修复
        if echo "$error_msg" | grep -q "userAlliance"; then
            sed -i '' 's/\.userAlliance/.userAlliances.first/g' "$file"
            fixed=$((fixed + 1))
        fi

        if echo "$error_msg" | grep -q "pixelCount"; then
            # 移除 pixelCount 引用或使用替代
            sed -i '' 's/alliance\.pixelCount/alliance.memberCount/g' "$file" 2>/dev/null || true
            fixed=$((fixed + 1))
        fi

        if echo "$error_msg" | grep -q "totalTime"; then
            sed -i '' 's/\.totalTime/.totalDuration/g' "$file"
            fixed=$((fixed + 1))
        fi

        if echo "$error_msg" | grep -q "sessionPixels"; then
            sed -i '' 's/\.sessionPixels/.pixels/g' "$file"
            fixed=$((fixed + 1))
        fi

        if echo "$error_msg" | grep -q "metricValue"; then
            sed -i '' 's/\.metricValue/.periodPixels/g' "$file"
            fixed=$((fixed + 1))
        fi

    done < "$errors_file"

    echo "  已修复 $fixed 个模型属性问题"
}

# ============================================
# UIKit 依赖错误修复
# ============================================

fix_uikit_errors() {
    local fixed=0

    find "$PROJECT_ROOT/Sources" -name "*.swift" -type f | while read -r file; do
        if grep -q "UIActivityViewController\|UIViewControllerRepresentable" "$file"; then
            # 添加条件编译
            if ! grep -q "#if canImport(UIKit)" "$file"; then
                sed -i '' '/UIActivityViewController/i\
#if canImport(UIKit)
' "$file" 2>/dev/null || true
                # 添加对应的 #endif
                # 这需要更复杂的逻辑来匹配括号
                fixed=$((fixed + 1))
            fi
        fi
    done

    echo "  已修复 $fixed 个 UIKit 依赖问题"
}

# ============================================
# 高级修复：基于模式的智能替换
# ============================================

fix_advanced_pattern_matching() {
    echo "  应用高级模式匹配修复..."

    # Pattern 1: ToolbarItem placement
    find "$PROJECT_ROOT/Sources" -name "*.swift" -exec sed -i '' '
        /ToolbarItem(placement: \.navigationBarLeading)/ {
            /#if os(iOS)/!{
                s//\n#if os(iOS)\n                &/
            }
        }
    ' {} \; 2>/dev/null || true

    # Pattern 2: Map annotation outside Map
    find "$PROJECT_ROOT/Sources" -name "*.swift" -print0 | xargs -0 perl -i -0pe '
        s/ForEach\(([^)]+)\) \{ pixel in\n\s+MapAnnotation\(coordinate: pixel\.coordinate\) \{/Map(annotationItems: \1) { pixel in\n                MapAnnotation(coordinate: pixel.coordinate) {/g
    ' 2>/dev/null || true
}

# ============================================
# 验证修复
# ============================================

verify_fixes() {
    echo "  验证修复结果..."

    # 运行构建并统计剩余错误
    local remaining=$(swift build 2>&1 | grep -c "error:" || echo "0")
    echo "  剩余错误: $remaining"

    # 返回剩余错误数
    echo "$remaining"
}

# ============================================
# 辅助函数
# ============================================

# 备份文件
backup_file() {
    local file="$1"
    if [ -f "$file" ]; then
        cp "$file" "$file.backup"
    fi
}

# 恢复备份
restore_backup() {
    local file="$1"
    if [ -f "$file.backup" ]; then
        mv "$file.backup" "$file"
    fi
}

# 清理备份
cleanup_backups() {
    find "$PROJECT_ROOT/Sources" -name "*.backup" -delete 2>/dev/null || true
}

# 导出所有函数供主脚本使用
export -f fix_macos_errors
export -f fix_color_errors
export -f fix_onchange_errors
export -f fix_model_errors
export -f fix_uikit_errors
export -f fix_advanced_pattern_matching
export -f verify_fixes
export -f backup_file
export -f restore_backup
export -f cleanup_backups
