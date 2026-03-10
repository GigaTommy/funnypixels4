# FunnyPixels 开发工作流程最佳实践

## 项目架构特性

### Xcode 15+ File System Synchronized Groups

本项目使用 **objectVersion 77**，启用了自动文件同步特性：

#### ✅ 优势
- **自动文件管理**：新建Swift文件无需手动"Add to Project"
- **简化项目文件**：project.pbxproj仅973行（传统项目数千行）
- **减少合并冲突**：团队协作时project.pbxproj变更极少

#### 📋 工作流程
```bash
# 1. 直接创建文件（命令行或编辑器）
touch FunnyPixelsApp/Utilities/NewFeature.swift

# 2. 编写代码
echo 'struct NewFeature {}' > FunnyPixelsApp/Utilities/NewFeature.swift

# 3. 立即可用 - 无需任何额外步骤
# 在其他文件中直接 import 或引用即可
```

## SPM依赖管理策略

### 三级清理策略

#### 🟢 Level 1: 最小清理（默认，日常使用）
```bash
xcodebuild clean -project FunnyPixelsApp.xcodeproj -scheme FunnyPixelsApp
```
**使用时机**：
- 日常开发后构建
- 修改Swift代码后
- 修复编译错误后
- **99%的情况下使用此级别**

**时间成本**：1-5秒

#### 🟡 Level 2: 中等清理（谨慎使用）
```bash
# ⚠️ 必须先关闭Xcode
killall Xcode 2>/dev/null
rm -rf ~/Library/Developer/Xcode/DerivedData/FunnyPixelsApp-*
```
**使用时机**：
- Xcode索引损坏
- 模块导入错误
- Level 1清理后仍有问题

**时间成本**：5-15分钟（重新resolve packages）

#### 🔴 Level 3: 完全重置（极少使用）
```bash
# ⚠️ 这会导致realm-swift重新下载（30分钟-2小时）
killall Xcode 2>/dev/null
rm -rf ~/Library/Developer/Xcode/DerivedData/FunnyPixelsApp-*
rm -rf ~/Library/Caches/org.swift.swiftpm
rm -rf FunnyPixelsApp.xcodeproj/project.xcworkspace/xcuserdata
rm -rf FunnyPixelsApp.xcodeproj/xcuserdata
```
**使用时机**：
- SPM校验和错误（checksum mismatch）
- 包依赖真正损坏
- **<1%的情况**

**时间成本**：30分钟-2小时（realm-swift binary下载）

### 为什么realm-swift特别慢？

```
realm-swift依赖链：
  realm-swift (Swift代码，10 MB)
    └── realm-core (C++ Binary，500+ MB)
         ├── arm64 binary
         ├── x86_64 binary
         └── Platform-specific assets
```

- **realm-core是binary artifact**，不是源代码
- **下载速度取决于网络**（GitHub releases服务器）
- **其他纯Swift包**（如Alamofire）仅需checkout源代码（秒级）

## 开发工作流程

### 添加新功能模块

#### ❌ 错误流程（旧习惯）
```bash
# 不要这样做
touch NewFile.swift
open NewFile.swift  # 编辑
# 然后在Xcode中 File → Add Files to "FunnyPixelsApp" ❌
```

#### ✅ 正确流程（File System Synced）
```bash
# 方式1：命令行创建
touch FunnyPixelsApp/ViewModels/NewViewModel.swift
# 直接编辑，无需添加到project

# 方式2：Xcode创建（推荐）
# Xcode → File → New → File...
# 选择目标位置，自动同步
```

### 构建验证流程

```bash
# 1. 快速检查SPM健康
claude-code /spm-health-check

# 2. 执行构建（使用Level 1清理）
claude-code /xcode-build

# 3. 如果构建失败
# - 查看错误日志
# - 如果是SPM问题，参考spm-health-check的建议
# - 如果是代码问题，修复后重新执行步骤2
```

### Git提交流程

```bash
# 1. 检查未提交的文件
git status

# 2. 特别注意新文件（??标记）
# 确认这些是你想要提交的

# 3. 提交（包括新文件）
git add FunnyPixelsApp/Utilities/PatternColorExtractor.swift
git add FunnyPixelsApp/ViewModels/TowerViewModel.swift
git commit -m "feat: Add pattern color extraction for 3D towers"

# 4. project.pbxproj变更极少
# 除非修改了target配置、依赖、或Info.plist
```

## 常见问题诊断

### 问题1：无法import新创建的文件

**症状**：
```swift
import NewModule  // ❌ Cannot find 'NewModule' in scope
```

**诊断**：
```bash
# 1. 检查文件是否存在
ls -la FunnyPixelsApp/**/NewModule.swift

# 2. 检查SPM状态
claude-code /spm-health-check

# 3. 清理并重新构建
xcodebuild clean -project FunnyPixelsApp.xcodeproj -scheme FunnyPixelsApp
```

**解决**：
- 99%是文件路径错误或命名问题
- 1%是Xcode索引问题（重启Xcode）

### 问题2：Xcode卡在"Resolving packages"

**症状**：
启动Xcode后持续显示"Resolving packages..."超过5分钟

**诊断**：
```bash
# 检查是否有.lock文件残留
find ~/Library/Developer/Xcode/DerivedData/FunnyPixelsApp-* -name "*.lock"
```

**解决**：
```bash
# 1. 关闭Xcode
killall Xcode

# 2. 手动触发resolve
cd FunnyPixelsApp
xcodebuild -resolvePackageDependencies \
  -project FunnyPixelsApp.xcodeproj \
  -scheme FunnyPixelsApp

# 3. 重新打开Xcode
open FunnyPixelsApp.xcodeproj
```

### 问题3：realm-swift checksum错误

**症状**：
```
artifact of binary target 'realm-core' failed verification:
checksum mismatch (expected: xxx, actual: yyy)
```

**根因**：
- realm-core binary下载损坏
- 网络中断导致部分下载
- 磁盘空间不足

**解决**：
```bash
# 必须使用Level 3清理
killall Xcode 2>/dev/null
rm -rf ~/Library/Caches/org.swift.swiftpm/repositories/realm-core-*
rm -rf ~/Library/Developer/Xcode/DerivedData/FunnyPixelsApp-*

# 重新打开Xcode，等待重新下载（30分钟-2小时）
open FunnyPixelsApp.xcodeproj
```

### 问题4：构建成功但运行时崩溃

**症状**：
```
dyld: Library not loaded: @rpath/RealmSwift.framework/RealmSwift
```

**根因**：
- Embed Frameworks配置缺失
- 或者DerivedData缓存不一致

**解决**：
```bash
# Level 2清理（不需要重新下载realm）
killall Xcode 2>/dev/null
rm -rf ~/Library/Developer/Xcode/DerivedData/FunnyPixelsApp-*
open FunnyPixelsApp.xcodeproj
```

## 性能优化建议

### 本地开发环境

```bash
# 定期清理旧的DerivedData（保留最新的）
find ~/Library/Developer/Xcode/DerivedData -name "FunnyPixelsApp-*" \
  -mtime +7 -exec rm -rf {} \; 2>/dev/null

# 检查磁盘空间（建议保留>100GB）
df -h ~

# 清理Xcode Archives（如果不需要旧版本）
# ~/Library/Developer/Xcode/Archives
```

### CI/CD环境

```yaml
# GitHub Actions示例
- name: Cache SPM packages
  uses: actions/cache@v3
  with:
    path: |
      ~/Library/Caches/org.swift.swiftpm
      ~/Library/Developer/Xcode/DerivedData/**/SourcePackages
    key: ${{ runner.os }}-spm-${{ hashFiles('**/Package.resolved') }}

- name: Build
  run: |
    xcodebuild clean
    xcodebuild build -scheme FunnyPixelsApp
```

## Claude Code集成

### 可用的Skills

```bash
# SPM健康检查
/spm-health-check

# Xcode构建（带自动修复）
/xcode-build

# 性能测试
/performance-test

# 部署就绪检查
/deploy-ready
```

### 推荐工作流程

```
开发新功能
    ↓
创建新文件（自动同步）
    ↓
编写代码
    ↓
/xcode-build（Level 1清理 + 构建）
    ↓
如果失败 → 自动修复（最多5轮）
    ↓
成功 → git commit
```

## 最佳实践总结

### ✅ 推荐做法

1. **直接创建Swift文件** - 无需Add to Project
2. **优先使用Level 1清理** - 避免触发SPM重新resolve
3. **定期运行spm-health-check** - 预防性维护
4. **关闭Xcode再清理DerivedData** - 避免文件锁冲突
5. **保留充足磁盘空间** - 至少100GB可用

### ❌ 避免做法

1. **不要频繁删除DerivedData** - 除非真正需要
2. **不要在Xcode运行时删除缓存** - 会导致不一致
3. **不要手动修改project.pbxproj** - 使用Xcode界面
4. **不要盲目使用Level 3清理** - 2小时成本太高
5. **不要修改Package.resolved** - 除非升级依赖

## 故障排除决策树

```
编译错误
    ├─ 代码语法错误？
    │   └─ Yes → 修复代码 → Level 1清理 → 重新构建
    ├─ Module导入错误？
    │   └─ Yes → /spm-health-check → 按建议执行
    ├─ 奇怪的缓存错误？
    │   └─ Yes → Level 2清理
    └─ realm checksum错误？
        └─ Yes → Level 3清理（最后手段）
```

---

**维护者**: Claude Code
**最后更新**: 2026-03-10
**适用版本**: Xcode 26.2+, Swift 6.2+
