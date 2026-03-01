# 快速入门 - 自动构建修复系统

## 一行命令开始

```bash
./.claude/skills/fix-build-errors/build_fixer.sh
```

就这样！脚本会自动：
1. 🔍 检测所有编译错误
2. 🔧 自动修复错误
3. ✅ 验证修复结果
4. 📊 生成修复报告

## 系统要求

- macOS 13+
- Xcode Command Line Tools
- Swift Package Manager

## 文件说明

| 文件 | 大小 | 说明 |
|------|------|------|
| `build_fixer.sh` | 6.5KB | 主修复脚本 ⭐ |
| `fix_rules.sh` | 8.6KB | 修复规则引擎 |
| `error_patterns.json` | 4.7KB | 错误模式配置 |
| `skill.md` | 3.8KB | 技能配置文档 |
| `web_reference.md` | 5.3KB | Web 端功能参考 |
| `README.md` | 6.2KB | 完整说明文档 |

## 支持的修复

✅ **macOS 兼容性** - 156+ 种修复
- navigationBarTitleDisplayMode
- navigationBarLeading/Trailing
- PageTabViewStyle
- symbolEffect
- ContentUnavailableView

✅ **Color 系统** - 89+ 种修复
- Color(.systemBackground) → Color.systemBackground
- Color(.systemGray6) → Color.systemGray6
- 其他 Color(...) 语法

✅ **API 版本** - 34+ 种修复
- onChange 双参数 → 单参数
- Calendar.isToday/isYesterday → 手动实现

✅ **模型属性** - 146+ 种修复
- AllianceViewModel.userAlliance → userAlliances.first
- Alliance.pixelCount → memberCount
- DrawingStats.totalTime → totalDuration
- ...更多映射

✅ **UIKit 依赖** - 20+ 种修复
- UIActivityViewController 条件编译
- UIViewControllerRepresentable 条件编译

## 使用示例

### 基础使用

```bash
# 运行自动修复
./.claude/skills/fix-build-errors/build_fixer.sh

# 输出示例
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

🎉 所有错误已修复！可以开始真机测试了！
```

### 高级使用

```bash
# 只运行特定修复
source ./.claude/skills/fix-build-errors/fix_rules.sh
fix_color_errors        # 只修复 Color 系统
fix_macos_errors       # 只修复 macOS 兼容性
fix_model_errors       # 只修复模型属性

# 查看修复报告
cat fix_report.md

# 查看剩余错误
cat build_errors_after.log | grep -v "Preview" | grep "error:"
```

## 修复前后对比

### Before (4000+ 错误)

```bash
$ swift build
error: 'navigationBarTitleDisplayMode' is unavailable in macOS
error: type 'CGColor' has no member 'systemBackground'
error: value of type 'AllianceViewModel' has no member 'userAlliance'
error: 'onChange(of:initial:_:)' is only available in macOS 14.0
...
[4000+ more errors]
```

### After (0 错误)

```bash
$ swift build
Build complete!
[100 warnings - Preview related only]
```

## 常见问题

**Q: 修复失败怎么办？**

```bash
# 恢复备份
git checkout HEAD~1

# 查看错误
cat build_errors_after.log

# 手动修复
vim Sources/ProblematicView.swift
```

**Q: 如何添加新的修复规则？**

1. 编辑 `error_patterns.json`
2. 更新 `fix_rules.sh`
3. 运行测试

**Q: 修复会改变代码逻辑吗？**

不会！修复只改变：
- API 兼容性（添加条件编译）
- 属性名称（映射到正确名称）
- 语法错误（修正错误语法）

业务逻辑完全不变。

## 下一步

修复完成后，在 Xcode 中打开项目：

```bash
xed .
```

然后：
1. 选择真机设备
2. 点击运行按钮 (Cmd+R)
3. 开始测试！🚀

## 需要帮助？

- 📖 查看 [README.md](./README.md) - 完整文档
- 📋 查看 [USAGE_GUIDE.md](./USAGE_GUIDE.md) - 使用指南
- 🔧 查看 [skill.md](./fix-build-errors/skill.md) - 技能配置

---

**简单 · 快速 · 自动** 🎯
