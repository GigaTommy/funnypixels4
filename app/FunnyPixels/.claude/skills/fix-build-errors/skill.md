# Fix Build Errors Skill

**描述**: 自动检测并修复 Swift/iOS 项目构建编译错误的 skill

**使用场景**:
- 项目编译失败，需要自动修复错误
- macOS 兼容性问题修复
- 模型属性不匹配修复
- API 版本兼容性问题修复

**参数**: 无（自动运行）

**实现步骤**:
1. 运行构建命令检测错误
2. 解析错误信息并分类
3. 根据错误类型应用修复规则
4. 验证修复结果
5. 输出修复报告

**依赖工具**:
- `swift build` - Swift 构建工具
- `sed`, `grep` - 文本处理工具
- `jq` - JSON 处理（可选）

## 错误类型和修复规则

### 1. macOS 兼容性错误

**模式**: `'xxx' is unavailable in macOS`

**修复策略**:
```swift
// Before
.navigationBarTitleDisplayMode(.large)
.toolbar {
    ToolbarItem(placement: .navigationBarTrailing) { ... }
}

// After
#if os(iOS)
.navigationBarTitleDisplayMode(.large)
#endif
.toolbar {
    #if os(iOS)
    ToolbarItem(placement: .navigationBarTrailing) { ... }
    #else
    ToolbarItem(placement: .automatic) { ... }
    #endif
}
```

**执行命令**:
```bash
# 修复 navigationBarTitleDisplayMode
sed -i '' 's/\.navigationBarTitleDisplayMode(\(.*\))/#if os(iOS)\n    .navigationBarTitleDisplayMode(\1)\n#endif/g' "$file"

# 修复 toolbar placement
sed -i '' 's/\.navigationBarLeading/#if os(iOS)\n                    .navigationBarLeading\n                    #else\n                    .cancellationAction\n                    #endif/g' "$file"
```

### 2. Color 系统错误

**模式**: `type 'CGColor' has no member 'systemBackground'`

**修复策略**:
```swift
// Before
Color(.systemBackground)
Color(.systemGray6)

// After
Color.systemBackground
Color.systemGray6
```

**执行命令**:
```bash
sed -i '' 's/Color(\.systemBackground)/Color.systemBackground/g' "$file"
sed -i '' 's/Color(\.systemGray6)/Color.systemGray6/g' "$file"
```

### 3. onChange API 错误

**模式**: `'onChange(of:initial:_:)' is only available in macOS 14.0 or newer`

**修复策略**:
```swift
// Before
.onChange(of: value) { _, newValue in ... }

// After
.onChange(of: value) { newValue in ... }
```

### 4. UIKit 依赖错误

**模式**: `Cannot find type 'UIActivityViewController' in scope`

**修复策略**:
```swift
#if canImport(UIKit)
.sheet(isPresented: $showing) {
    ShareSheet(items: [...])
}
#endif
```

### 5. 模型属性错误

**模式**: `value of type 'X' has no member 'Y'`

**修复策略**:
- 检查实际模型定义
- 替换为正确的属性名
- 使用默认值或移除不存在的属性

## 修复流程

```bash
#!/bin/bash

# Step 1: 运行构建
echo "🔨 Running build..."
swift build 2>&1 | tee build_errors.log

# Step 2: 统计错误
error_count=$(grep -c "error:" build_errors.log)
echo "Found $error_count errors"

# Step 3: 应用修复规则
echo "🔧 Applying fixes..."
./fix_rules.sh build_errors.log

# Step 4: 验证修复
echo "🔄 Verifying fixes..."
swift build 2>&1 | tee build_errors_after.log

# Step 5: 生成报告
echo "📊 Generating report..."
./generate_report.sh
```

## 最佳实践

1. **逐步修复**: 按错误类型分类，每次修复一类问题
2. **备份代码**: 修复前创建 git commit
3. **验证修复**: 每次修复后重新构建验证
4. **记录日志**: 保留修复前后的错误日志
5. **渐进式**: 对于复杂问题，手动修复并记录规则

## 常见错误模式

### macOS API 可用性
```bash
# 检测
grep -r "navigationBarTitleDisplayMode" Sources/
grep -r "PageTabViewStyle" Sources/
grep -r "symbolEffect" Sources/
```

### Color 系统
```bash
# 检测
grep -r "Color(\." Sources/
```

### 模型属性
```bash
# 检测模型定义
grep -A 20 "struct.*Model" Sources/FunnyPixels/Models/
```

## 扩展规则

添加新的修复规则：

1. 在 `error_patterns.json` 中定义错误模式
2. 在 `fix_rules.sh` 中实现修复逻辑
3. 测试规则并验证结果
4. 更新本文档
