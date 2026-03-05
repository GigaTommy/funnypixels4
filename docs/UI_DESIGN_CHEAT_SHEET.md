# FunnyPixels3 UI设计规范速查表
## 开发者日常快速参考

---

## 🎨 1. 颜色速查（UnifiedColors）

### 主色系
```swift
UnifiedColors.primary           // #3B82F6 蓝色 - 按钮/链接
UnifiedColors.secondary         // #10B981 绿色 - 成功/积极
UnifiedColors.accent            // #F59E0B 橙色 - 警告/提醒
```

### 功能色
```swift
UnifiedColors.success           // #10B981 成功
UnifiedColors.warning           // #F59E0B 警告
UnifiedColors.error             // #EF4444 错误
UnifiedColors.like              // #EF4444 点赞红心
UnifiedColors.destructive       // #EF4444 删除/登出
```

### 文本色
```swift
UnifiedColors.textPrimary       // #1F2937 主文本（标题）
UnifiedColors.textSecondary     // #6B7280 次要文本（说明）
UnifiedColors.textTertiary      // #9CA3AF 辅助文本（提示）
```

### 背景色
```swift
UnifiedColors.background        // #F9FAFB 页面背景
UnifiedColors.surface           // #FFFFFF 卡片表面
UnifiedColors.surfaceSecondary  // #F3F4F6 次级背景
```

### 边框色
```swift
UnifiedColors.border            // #E5E7EB 边框/分割线
```

---

## 📝 2. 字体速查（ResponsiveFont）

### 标题层级
```swift
.responsiveFont(.largeTitle)    // 34pt - 页面大标题
.responsiveFont(.title1)        // 28pt - 区块标题
.responsiveFont(.title2)        // 22pt - 卡片标题
.responsiveFont(.title3)        // 20pt - 小标题
```

### 正文层级
```swift
.responsiveFont(.headline)      // 17pt - 强调文本（用户名/按钮）
.responsiveFont(.body)          // 17pt - 正文
.responsiveFont(.callout)       // 16pt - 次级文本
.responsiveFont(.subheadline)   // 15pt - 次要文本
```

### 辅助层级
```swift
.responsiveFont(.footnote)      // 13pt - 脚注（时间戳）
.responsiveFont(.caption)       // 12pt - 说明文字
.responsiveFont(.caption2)      // 11pt - 小说明
```

### 特殊用途
```swift
.responsiveFont(.numeric)       // 17pt 等宽数字
.responsiveFont(.largeNumeric)  // 28pt 大号数字
```

### 自定义权重
```swift
.responsiveFont(.headline, weight: .bold)      // 粗体
.responsiveFont(.body, weight: .semibold)      // 半粗体
.responsiveFont(.caption, weight: .medium)     // 中等
```

---

## 📐 3. 尺寸速查（ResponsiveSize）

### 间距（固定，不跟随缩放）
```swift
ResponsiveSize.spacingXS        // 4pt
ResponsiveSize.spacingS         // 8pt
ResponsiveSize.spacingM         // 12pt ⭐ 默认
ResponsiveSize.spacingL         // 16pt
ResponsiveSize.spacingXL        // 24pt
ResponsiveSize.spacingXXL       // 32pt
```

### 图标尺寸（跟随字体缩放）
```swift
ResponsiveSize.iconSmall(scale: fontManager.scale)    // 16pt
ResponsiveSize.iconMedium(scale: fontManager.scale)   // 24pt ⭐ 常用
ResponsiveSize.iconLarge(scale: fontManager.scale)    // 32pt
ResponsiveSize.iconXLarge(scale: fontManager.scale)   // 48pt
```

### 按钮高度（最小保证可点击）
```swift
ResponsiveSize.buttonSmall(scale: fontManager.scale)  // 36pt min
ResponsiveSize.buttonMedium(scale: fontManager.scale) // 44pt min ⭐ iOS标准
ResponsiveSize.buttonLarge(scale: fontManager.scale)  // 56pt min
```

### 头像尺寸（跟随字体缩放）
```swift
40 * fontManager.scale          // 小头像（列表）
60 * fontManager.scale          // 中头像（个人中心）⭐ 常用
80 * fontManager.scale          // 大头像（详情页）
```

---

## 🔲 4. 圆角速查（UnifiedRadius）

```swift
UnifiedRadius.none              // 0pt - 图片/分割线
UnifiedRadius.xs                // 4pt - 小标签
UnifiedRadius.s                 // 8pt - 按钮/输入框
UnifiedRadius.m                 // 12pt - 中型卡片 ⭐ 推荐
UnifiedRadius.l                 // 16pt - 大型卡片
UnifiedRadius.pill              // 999pt - 胶囊按钮
```

---

## 🌑 5. 阴影速查（UnifiedShadow）

### 卡片阴影（推荐）
```swift
.unifiedCardShadow()
// 等同于：
.shadow(color: Color.black.opacity(0.04), radius: 8, x: 0, y: 2)
```

### 悬浮阴影（Modal/Toast）
```swift
.unifiedElevatedShadow()
// 等同于：
.shadow(color: Color.black.opacity(0.08), radius: 12, x: 0, y: 4)
```

---

## 🎯 6. 常用代码模式

### 模式1：标准卡片
```swift
VStack(alignment: .leading, spacing: 12) {
    Text("标题")
        .responsiveFont(.headline)
        .foregroundColor(UnifiedColors.textPrimary)

    Text("内容描述")
        .responsiveFont(.body)
        .foregroundColor(UnifiedColors.textSecondary)
}
.padding(16)
.background(UnifiedColors.surface)
.cornerRadius(UnifiedRadius.m)
.unifiedCardShadow()
```

### 模式2：用户信息行
```swift
HStack(spacing: 12) {
    // 头像
    AvatarView(
        avatarUrl: user.avatarUrl,
        displayName: user.displayName,
        size: 40 * fontManager.scale
    )

    // 信息
    VStack(alignment: .leading, spacing: 2) {
        Text(user.displayName)
            .responsiveFont(.subheadline, weight: .semibold)
            .foregroundColor(UnifiedColors.textPrimary)

        Text(user.bio ?? "")
            .responsiveFont(.caption)
            .foregroundColor(UnifiedColors.textSecondary)
            .lineLimit(1)
    }
}
```

### 模式3：统计数字显示
```swift
VStack(spacing: 4) {
    Text("\(count)")
        .responsiveFont(.numericLarge)
        .foregroundColor(UnifiedColors.textPrimary)

    Text("标签")
        .responsiveFont(.caption)
        .foregroundColor(UnifiedColors.textSecondary)
}
```

### 模式4：主操作按钮
```swift
StandardButton(
    title: "确认",
    style: .primary,
    size: .large
) {
    // 操作
}
.frame(maxWidth: .infinity)
```

### 模式5：空状态
```swift
VStack(spacing: 24) {
    Image(systemName: "photo.on.rectangle.angled")
        .font(.system(size: 48 * fontManager.scale))
        .foregroundColor(UnifiedColors.textTertiary)

    VStack(spacing: 8) {
        Text("标题")
            .responsiveFont(.title3, weight: .semibold)
            .foregroundColor(UnifiedColors.textPrimary)

        Text("描述文字")
            .responsiveFont(.body)
            .foregroundColor(UnifiedColors.textSecondary)
            .multilineTextAlignment(.center)
    }
}
.frame(maxWidth: .infinity, maxHeight: .infinity)
```

---

## ✅ 7. 必记清单

### 每个View必做
```swift
// ✅ 添加这一行
@ObservedObject private var fontManager = FontSizeManager.shared
```

### 文字必做
```swift
// ❌ 错误
.font(.system(size: 17))

// ✅ 正确
.responsiveFont(.body)
```

### 颜色必做
```swift
// ❌ 错误
.foregroundColor(.blue)
.foregroundColor(Color(hex: "1A73E8"))

// ✅ 正确
.foregroundColor(UnifiedColors.primary)
```

### 尺寸必做
```swift
// ✅ 头像/图标：跟随字体缩放
AvatarView(size: 60 * fontManager.scale)
Image(systemName: "star").font(.system(size: 24 * fontManager.scale))

// ✅ 间距：固定不变
VStack(spacing: 12) { }  // ✅ 不要乘scale
```

### 卡片必做
```swift
// ✅ 统一圆角
.cornerRadius(UnifiedRadius.m)

// ✅ 统一阴影
.unifiedCardShadow()
```

---

## 🚫 8. 禁止使用

### 禁止硬编码
```swift
// ❌ 禁止
.font(.system(size: 17))
.foregroundColor(Color(hex: "1A73E8"))
Color.blue
AppColors.xxx
FeedDesign.Colors.xxx

// ✅ 使用
.responsiveFont(.body)
.foregroundColor(UnifiedColors.primary)
UnifiedColors.primary
```

### 禁止混用设计系统
```swift
// ❌ 禁止
AppColors.primary + FeedDesign.Colors.text  // 混用两套系统

// ✅ 使用
UnifiedColors.xxx  // 只用一套系统
```

---

## 🎬 9. 快速启动模板

### 创建新View
```swift
import SwiftUI

struct MyNewView: View {
    // ✅ 必加：响应字体管理器
    @ObservedObject private var fontManager = FontSizeManager.shared

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: ResponsiveSize.spacingL) {
                    // 你的内容
                }
                .padding()
            }
            .navigationTitle("标题")
            .navigationBarTitleDisplayMode(.inline)
            .background(UnifiedColors.background)
        }
    }
}
```

### 创建新卡片
```swift
struct MyCard: View {
    @ObservedObject private var fontManager = FontSizeManager.shared

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("卡片标题")
                .responsiveFont(.headline)
                .foregroundColor(UnifiedColors.textPrimary)

            Text("卡片内容")
                .responsiveFont(.body)
                .foregroundColor(UnifiedColors.textSecondary)
        }
        .padding(16)
        .background(UnifiedColors.surface)
        .cornerRadius(UnifiedRadius.m)
        .unifiedCardShadow()
    }
}
```

### 创建新按钮
```swift
StandardButton(
    title: NSLocalizedString("key", comment: ""),
    icon: "star.fill",  // 可选图标
    style: .primary,    // primary/secondary/ghost/destructive
    size: .medium,      // small/medium/large
    isLoading: false,   // 加载状态
    isDisabled: false   // 禁用状态
) {
    // 点击操作
}
```

---

## 🧪 10. 测试检查清单

### 开发时检查
```markdown
- [ ] 添加了@ObservedObject fontManager
- [ ] 所有文字使用.responsiveFont()
- [ ] 所有颜色使用UnifiedColors
- [ ] 头像/图标尺寸乘以fontManager.scale
- [ ] 间距保持固定（不乘scale）
- [ ] 编译无警告无错误
```

### 提交前检查
```markdown
- [ ] Small字号测试：UI正常
- [ ] Medium字号测试：视觉一致
- [ ] Large字号测试：不错乱
- [ ] iPhone SE测试：显示完整
- [ ] iPhone Pro Max测试：不浪费空间
- [ ] 深色模式测试：颜色正确
- [ ] 性能测试：滚动流畅60fps
```

---

## 📞 11. 需要帮助？

### 快速问题
- 如何添加fontManager？ → 见"每个View必做"
- 如何迁移硬编码字号？ → 见"字体速查"映射表
- 如何统一卡片样式？ → 见"常用代码模式1"
- 如何测试响应式？ → 见"测试检查清单"

### 详细文档
- 完整设计规范 → `UI_Design_System_V2_GPS_Canvas.md`
- 实战迁移指南 → `UI_MIGRATION_GUIDE.md`
- 管理层摘要 → `UI_REDESIGN_EXECUTIVE_SUMMARY.md`

### 联系人
- iOS Tech Lead - 技术问题
- UI/UX Designer - 设计问题
- Product Manager - 需求问题

---

**将此文档加入收藏夹，日常开发快速查阅！** ⚡

---

*文档版本：V1.0*
*最后更新：2026-03-04*
*打印友好：是*
