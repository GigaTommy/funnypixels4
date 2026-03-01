# 自动修复构建错误 Skill

这是一个自动化构建和修复系统，能够自动检测并修复 Swift/iOS 项目中的编译错误。

## 快速开始

### 运行自动修复
```bash
# 从项目根目录运行
./.claude/skills/fix-build-errors/build_fixer.sh
```

### 使用 Claude Code 技能
```
/auto-fix-build
```

## 功能特性

### 1. 自动错误检测
- 运行 `swift build` 捕获所有编译错误
- 按类型分类错误（macOS 兼容性、Color 系统、API 版本等）
- 生成详细的错误报告

### 2. 智能修复引擎
- **macOS 兼容性**: 自动添加 `#if os(iOS)` 条件编译
- **Color 系统**: 修复 `Color(.xxx)` 语法错误
- **API 版本**: 更新为兼容的 API 调用
- **模型属性**: 映射到正确的属性名
- **UIKit 依赖**: 添加条件编译保护

### 3. 安全修复
- 修复前自动创建 git 备份
- 逐步验证每个修复
- 生成修复报告

### 4. Web 端功能参考
- 参考 Web 端实现确保功能一致
- API 端点对照
- 数据模型映射
- UI/UX 设计指南

## 修复规则

### macOS 兼容性
```swift
// 自动修复
.navigationBarTitleDisplayMode(.large)
// ↓
#if os(iOS)
.navigationBarTitleDisplayMode(.large)
#endif
```

### Color 系统
```swift
// 自动修复
Color(.systemBackground)
// ↓
Color.systemBackground
```

### API 版本
```swift
// 自动修复
.onChange(of: value) { _, newValue in }
// ↓
.onChange(of: value) { newValue in }
```

### 模型属性
```swift
// 自动修复
allianceViewModel.userAlliance
// ↓
allianceViewModel.userAlliances.first
```

## 错误类型

| 类型 | 检测模式 | 修复策略 |
|------|---------|---------|
| macOS 兼容性 | `is unavailable in macOS` | 条件编译 |
| Color 系统 | `CGColor has no member` | 直接替换 |
| API 版本 | `only available in macOS 14` | 降级 API |
| UIKit 依赖 | `Cannot find UIKit` | 条件编译 |
| 模型属性 | `has no member` | 属性映射 |

## 输出示例

```
🔨 Running build...
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

📊 生成修复报告...
✓ 报告已生成: fix_report.md

========================================
修复总结
========================================
初始错误: 425
已修复:   425
剩余:     0

🎉 所有错误已修复！可以开始真机测试了！
```

## 文件结构

```
.claude/skills/fix-build-errors/
├── skill.md              # Skill 文档
├── build_fixer.sh        # 主修复脚本
├── fix_rules.sh          # 修复规则引擎
├── error_patterns.json   # 错误模式配置
├── web_reference.md      # Web 端参考文档
└── README.md             # 本文件
```

## 高级用法

### 单独运行修复规则
```bash
# 只修复 macOS 兼容性
source .claude/skills/fix-build-errors/fix_rules.sh
fix_macos_errors

# 只修复 Color 系统
fix_color_errors

# 只修复模型属性
fix_model_errors
```

### 自定义修复规则
编辑 `error_patterns.json` 添加新的错误模式：
```json
{
  "error_patterns": {
    "custom_error": {
      "description": "自定义错误类型",
      "patterns": ["error pattern"],
      "fix_strategy": "replacement",
      "priority": "high"
    }
  }
}
```

### 集成到 CI/CD
```yaml
# .github/workflows/build.yml
- name: Auto-fix build errors
  run: |
    ./.claude/skills/fix-build-errors/build_fixer.sh

- name: Verify fixes
  run: |
    swift build
```

## 扩展和定制

### 添加新的修复规则

1. 在 `fix_rules.sh` 中定义新函数：
```bash
fix_custom_errors() {
    local errors_file="$PROJECT_ROOT/.fix_cache/custom_errors.txt"
    # 实现修复逻辑
}
```

2. 在 `build_fixer.sh` 中调用：
```bash
if [ "$CUSTOM_ERRORS" -gt 0 ]; then
    fix_custom_errors
fi
```

### 添加新的错误检测

1. 在 `error_patterns.json` 中定义模式：
```json
{
  "patterns": ["your error pattern"]
}
```

2. 在 `build_fixer.sh` 中添加检测逻辑：
```bash
grep -E "your error pattern" "$BUILD_LOG" > "$PROJECT_ROOT/.fix_cache/custom_errors.txt"
```

## 最佳实践

1. **定期运行**: 在每次大改动后运行自动修复
2. **查看报告**: 检查 `fix_report.md` 了解修复详情
3. **版本控制**: 修复脚本会自动创建 git 备份
4. **手动验证**: 自动修复后，手动验证关键功能
5. **贡献规则**: 发现新的修复模式，更新规则库

## 故障排除

### 问题: 脚本无法执行
```bash
chmod +x .claude/skills/fix-build-errors/build_fixer.sh
chmod +x .claude/skills/fix-build-errors/fix_rules.sh
```

### 问题: 修复后仍有错误
1. 查看 `build_errors_after.log` 了解剩余错误
2. 手动修复复杂错误
3. 更新错误模式和修复规则

### 问题: 修复引入新问题
1. 恢复备份: `git checkout HEAD~1`
2. 手动应用修复
3. 报告问题以便改进规则

## 贡献

欢迎贡献新的修复规则和改进建议！

1. Fork 项目
2. 创建修复分支
3. 测试修复规则
4. 提交 Pull Request

## 许可

MIT License
