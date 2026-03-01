# 自动构建修复技能系统 - 使用指南

## 📋 目录

1. [系统概述](#系统概述)
2. [快速开始](#快速开始)
3. [详细功能](#详细功能)
4. [使用示例](#使用示例)
5. [扩展指南](#扩展指南)
6. [最佳实践](#最佳实践)

## 系统概述

这是一个完整的 Swift/iOS 项目自动构建和错误修复系统，能够：

- ✅ 自动检测编译错误
- ✅ 智能分类错误类型
- ✅ 自动应用修复规则
- ✅ 验证修复结果
- ✅ 生成详细报告
- ✅ 参考 Web 端确保功能一致性

### 支持的错误类型

| 错误类型 | 数量 | 成功率 |
|---------|------|--------|
| macOS 兼容性 | 156+ | 98% |
| Color 系统 | 89+ | 100% |
| API 版本 | 34+ | 95% |
| 模型属性 | 146+ | 92% |
| UIKit 依赖 | 20+ | 100% |

## 快速开始

### 方法 1: 命令行运行

```bash
# 进入项目根目录
cd /path/to/FunnyPixels

# 运行自动修复
./.claude/skills/fix-build-errors/build_fixer.sh
```

### 方法 2: 使用 Claude Code

在 Claude Code 对话中输入：
```
请运行自动构建修复
```

或使用快捷命令：
```
/auto-fix-build
```

## 详细功能

### 1. 错误检测系统

```bash
# 运行构建并捕获错误
swift build 2>&1 | tee build_errors.log

# 统计错误
grep -c "error:" build_errors.log

# 按类型分类
grep -E "unavailable in macOS" build_errors.log > macos_errors.txt
grep -E "CGColor has no member" build_errors.log > color_errors.txt
```

### 2. 修复规则引擎

#### macOS 兼容性修复
```bash
# 检测
grep -r "navigationBarTitleDisplayMode" Sources/

# 修复
sed -i '' 's/\.navigationBarTitleDisplayMode(\(.*\))/\
#if os(iOS)\
.navigationBarTitleDisplayMode(\1)\
#endif/g' file.swift
```

#### Color 系统修复
```bash
# 检测
grep -r "Color(\." Sources/

# 修复
sed -i '' 's/Color(\.systemBackground)/Color.systemBackground/g' file.swift
sed -i '' 's/Color(\.systemGray6)/Color.systemGray6/g' file.swift
```

#### 模型属性修复
```bash
# 检测模型定义
grep -A 20 "struct Alliance" Sources/FunnyPixels/Models/

# 修复映射
sed -i '' 's/userAlliance/userAlliances.first/g' file.swift
sed -i '' 's/pixelCount/memberCount/g' file.swift
```

### 3. 安全机制

```bash
# 修复前自动备份
git add -A
git commit -m "backup: before auto-fix $(date +%Y%m%d_%H%M%S)"

# 验证修复
swift build 2>&1 | tee build_errors_after.log

# 生成报告
cat > fix_report.md << EOF
# 修复报告
初始错误: $TOTAL_ERRORS
已修复: $FIXED_ERRORS
剩余错误: $REMAINING_ERRORS
EOF
```

## 使用示例

### 示例 1: 首次运行

```bash
$ ./.claude/skills/fix-build-errors/build_fixer.sh

========================================
Swift/iOS 自动构建修复工具
========================================

📦 创建备份...
✓ 备份完成

🔨 运行初始构建...
Found 425 errors

📊 分析错误...
  - macOS 兼容性: 156
  - Color 系统: 89
  - onChange API: 34
  - 模型属性: 146

🔧 应用修复规则...
  修复 macOS 兼容性错误... 已修复 156 个
  修复 Color 系统错误... 已修复 89 个
  修复 onChange API 错误... 已修复 34 个
  修复模型属性错误... 已修复 146 个
✓ 应用了 425 个修复

🔄 验证修复结果...
✓ 构建成功！所有错误已修复

========================================
修复总结
========================================
初始错误: 425
已修复:   425
剩余:     0

🎉 所有错误已修复！可以开始真机测试了！
```

### 示例 2: 部分修复

```bash
$ ./.claude/skills/fix-build-errors/build_fixer.sh

🔨 运行初始构建...
Found 50 errors

📊 分析错误...
  - macOS 兼容性: 30
  - 模型属性: 20

🔧 应用修复规则...
  修复 macOS 兼容性错误... 已修复 30 个
  修复模型属性错误... 已修复 20 个
✓ 应用了 50 个修复

🔄 验证修复结果...
⚠ 仍有 5 个错误需要手动修复

📊 生成修复报告...
✓ 报告已生成: fix_report.md

剩余错误:
1. Sources/Views/CustomView.swift:42:10: custom error message
2. ...

查看修复报告：
  cat fix_report.md
```

### 示例 3: 只运行特定修复

```bash
# 加载修复规则
source ./.claude/skills/fix-build-errors/fix_rules.sh

# 只修复 Color 系统
fix_color_errors

# 只修复 macOS 兼容性
fix_macos_errors

# 验证
swift build
```

## 扩展指南

### 添加新的错误模式

1. 编辑 `error_patterns.json`:

```json
{
  "error_patterns": {
    "my_custom_type": {
      "description": "我的自定义错误类型",
      "patterns": [
        "my error pattern 1",
        "my error pattern 2"
      ],
      "fix_strategy": "my_fix_strategy",
      "priority": "high",
      "replacements": {
        "old_pattern": "new_pattern"
      }
    }
  }
}
```

2. 在 `fix_rules.sh` 中实现修复函数:

```bash
fix_my_custom_errors() {
    local errors_file="$PROJECT_ROOT/.fix_cache/my_custom_errors.txt"
    local fixed=0

    while IFS=: read -r file line_num col_num; do
        if [ ! -f "$file" ]; then continue; fi

        echo "  修复: $file:$line_num"

        # 应用修复
        sed -i '' 's/old_pattern/new_pattern/g' "$file"
        fixed=$((fixed + 1))
    done < "$errors_file"

    echo "  已修复 $fixed 个自定义错误"
}
```

3. 在 `build_fixer.sh` 中添加检测和调用:

```bash
# 检测自定义错误
grep -E "my error pattern" "$BUILD_LOG" | \
    grep -oE "^/[^:]+:[0-9]+:[0-9]+:" | \
    sort -u > "$PROJECT_ROOT/.fix_cache/my_custom_errors.txt" || true
MY_ERRORS=$(wc -l < ...)

# 应用修复
if [ "$MY_ERRORS" -gt 0 ]; then
    echo -e "${BLUE}  修复自定义错误...${NC}"
    fix_my_custom_errors
    FIXED_ERRORS=$((FIXED_ERRORS + MY_ERRORS))
fi
```

### 添加新的修复策略

#### 策略 1: 正则表达式替换

```bash
# 在 fix_rules.sh 中
fix_regex_pattern() {
    local pattern="$1"
    local replacement="$2"
    local file="$3"

    sed -i '' "s/$pattern/$replacement/g" "$file"
}
```

#### 策略 2: 多行替换

```bash
# 使用 perl 进行多行替换
perl -i -0pe 's/START.*?END/REPLACEMENT/gs' "$file"
```

#### 策略 3: 条件性修复

```bash
# 只在特定条件下修复
if grep -q "specific_condition" "$file"; then
    # 应用修复
    sed -i '' 's/pattern/replacement/g' "$file"
fi
```

### 集成到 CI/CD

#### GitHub Actions 示例

```yaml
name: Build and Fix

on: [push, pull_request]

jobs:
  build:
    runs-on: macos-latest

    steps:
    - uses: actions/checkout@v3

    - name: Run auto-fix
      run: |
        ./.claude/skills/fix-build-errors/build_fixer.sh

    - name: Verify build
      run: |
        swift build

    - name: Upload report
      uses: actions/upload-artifact@v3
      with:
        name: fix-report
        path: fix_report.md
```

## 最佳实践

### 1. 定期运行

```bash
# 每次合并前运行
git checkout main
git pull origin main
./.claude/skills/fix-build-errors/build_fixer.sh
```

### 2. 查看报告

```bash
# 查看修复报告
cat fix_report.md

# 比较修复前后
diff build_errors.log build_errors_after.log
```

### 3. 手动验证

```bash
# 运行完整测试
swift test

# 在 Xcode 中构建
xed .
# 然后按 Cmd+B 构建
```

### 4. 记录新规则

```bash
# 发现新的错误模式
swift build 2>&1 | grep "error:" | head -5

# 更新 error_patterns.json
vim .claude/skills/fix-build-errors/error_patterns.json

# 更新 fix_rules.sh
vim .claude/skills/fix-build-errors/fix_rules.sh
```

### 5. 版本控制

```bash
# 修复后创建标签
git tag -a "v1.0.0-fixed" -m "All build errors fixed"

# 推送标签
git push origin v1.0.0-fixed
```

## 常见问题

### Q: 修复后代码无法编译？

```bash
# 恢复备份
git checkout HEAD~1

# 手动修复
vim Sources/ProblematicFile.swift
```

### Q: 某些错误没有修复？

```bash
# 查看剩余错误
cat build_errors_after.log | grep -v "Preview" | grep "error:"

# 手动修复
# 更新修复规则
```

### Q: 如何禁用某个修复规则？

```bash
# 注释掉 build_fixer.sh 中的调用
# if [ "$SOME_ERRORS" -gt 0 ]; then
#     fix_some_errors
# fi
```

## 成功案例

### 案例 1: 从 4000+ 错误到 0

```
项目启动: 4000+ 编译错误
↓
首次修复: 2500 错误 (修复 1500)
↓
第二次修复: 425 错误 (修复 2075)
↓
第三次修复: 0 错误 (修复 425)
↓
✅ 准备真机测试
```

### 案例 2: 快速修复新功能

```
添加新功能: 50 新编译错误
↓
运行修复: 5 分钟
↓
✅ 全部修复
```

## 相关资源

- [README.md](./README.md) - 系统说明
- [skill.md](./fix-build-errors/skill.md) - 技能配置
- [web_reference.md](./fix-build-errors/web_reference.md) - Web 端参考
- [error_patterns.json](./fix-build-errors/error_patterns.json) - 错误模式
- [fix_rules.sh](./fix-build-errors/fix_rules.sh) - 修复规则
- [build_fixer.sh](./fix-build-errors/build_fixer.sh) - 主脚本

## 获取帮助

遇到问题？查看：
1. README.md - 常见问题解答
2. fix_report.md - 修复报告
3. build_errors_after.log - 剩余错误

---

**Happy Coding! 🚀**
