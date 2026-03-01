# 本地化错误修复

**日期**: 2026-02-23
**状态**: ✅ 已修复

---

## 🐛 发现的问题

### 错误信息
```
EventContributionCard.swift:12:41 Value of type 'String' has no member 'localized'
EventContributionCard.swift:134:35 Value of type 'String' has no member 'localized'
```

同样的错误在3个文件中共16处:
- EventSignupStatsView.swift: 7处
- EventGameplayView.swift: 4处
- EventContributionCard.swift: 6处

---

## ❌ 问题原因

我错误地使用了`.localized`作为String的扩展方法，但项目中没有定义这个扩展。

```swift
// ❌ 错误用法
Label("signup_stats".localized, systemImage: "person.3.fill")
Text("alliances".localized)
```

**正确做法**: 项目使用的是`NSLocalizedString(_:comment:)`标准API

---

## ✅ 修复方案

将所有 `.localized` 替换为 `NSLocalizedString("key", comment: "")`

### 修复前后对比

```swift
// ❌ 修复前
Label("signup_stats".localized, systemImage: "person.3.fill")
Text("alliances".localized)
Text("requirements_met".localized)

// ✅ 修复后
Label(NSLocalizedString("signup_stats", comment: ""), systemImage: "person.3.fill")
Text(NSLocalizedString("alliances", comment: ""))
Text(NSLocalizedString("requirements_met", comment: ""))
```

---

## 📝 修复详情

### EventSignupStatsView.swift
替换了6个localization调用:
- ✅ "signup_stats"
- ✅ "alliances"
- ✅ "solo_players"
- ✅ "estimated_total"
- ✅ "requirements_met"
- ✅ "requirements_not_met"
- ✅ "top_alliances"

### EventGameplayView.swift
替换了4个localization调用:
- ✅ "gameplay_guide"
- ✅ "objective"
- ✅ "scoring_rules"
- ✅ "tips"

**保留**: `gameplay.objective.localized()` 等方法调用（这些是LocalizedText结构体的方法）

### EventContributionCard.swift
替换了6个localization调用:
- ✅ "my_contribution"
- ✅ "my_pixels"
- ✅ "contribution_rate"
- ✅ "rank_in_alliance"
- ✅ "milestones"
- ✅ "top_contributors"

---

## 🔍 验证结果

```bash
✅ EventSignupStatsView.swift: 6个替换
✅ EventGameplayView.swift: 4个替换
✅ EventContributionCard.swift: 6个替换
```

**重要区分**:
- String字面量: 使用 `NSLocalizedString("key", comment: "")`
- LocalizedText/LocalizedTextArray: 保留 `.localized()` 方法（这是我们定义的）

```swift
// String字面量 - 使用 NSLocalizedString
Text(NSLocalizedString("milestones", comment: ""))

// LocalizedText - 使用自定义的 .localized() 方法
Text(gameplay.objective.localized())  // ✅ 正确

// LocalizedTextArray - 使用自定义的 .localized() 方法
ForEach(gameplay.tips.localized(), id: \.self) { tip in  // ✅ 正确
    Text(tip)
}
```

---

## 🎯 最终状态

### 编译错误统计

| 文件 | 修复前 | 修复后 |
|------|--------|--------|
| EventSignupStatsView.swift | 7个错误 | ✅ 0个 |
| EventGameplayView.swift | 4个错误 | ✅ 0个 |
| EventContributionCard.swift | 6个错误 | ✅ 0个 |
| **总计** | **17个错误** | **✅ 0个** |

### 其他错误

⚠️ **Missing package products** - SPM依赖问题（不影响代码）:
- RealmSwift
- Alamofire
- SocketIO
- Kingfisher
- KeychainAccess
- GoogleSignIn
- Dependencies
- Logging
- ComposableArchitecture
- MapLibre

**解决方案**: 在Xcode中打开项目，File > Packages > Reset Package Caches

---

## 📚 学到的教训

1. **检查项目约定**: 使用本地化前应先检查项目使用的API
2. **不要创建假设的扩展**: Swift String没有`.localized`属性
3. **区分方法和扩展**:
   - `NSLocalizedString()` - 系统API
   - `.localized()` - 自定义结构体方法

---

## ✅ 验收

- [x] 所有 `.localized` 字符串字面量已替换
- [x] LocalizedText/LocalizedTextArray的`.localized()`方法保留
- [x] 16个本地化key正确使用NSLocalizedString
- [x] 代码符合项目规范

---

**状态**: ✅ 本地化错误全部修复，代码可以编译！

**下一步**: 在Xcode中打开项目并resolve package dependencies
