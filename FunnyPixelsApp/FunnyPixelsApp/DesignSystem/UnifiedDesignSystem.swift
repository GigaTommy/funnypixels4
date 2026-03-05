import SwiftUI

/// 统一响应式设计系统 - 完全兼容FontSizeManager
///
/// 设计原则：
/// 1. 所有字号通过FontSizeManager统一缩放
/// 2. 所有组件通过@ObservedObject监听字体变化
/// 3. 提供便捷的ViewModifier简化使用
/// 4. 保持与DesignTokens的向后兼容
///
/// 使用方式：
/// ```swift
/// @ObservedObject private var fontManager = FontSizeManager.shared
///
/// Text("标题")
///     .font(ResponsiveFont.title1(scale: fontManager.scale))
///
/// // 或使用ViewModifier
/// Text("标题")
///     .responsiveFont(.title1)
/// ```

// MARK: - 响应式字体系统

public enum ResponsiveFont {

    // MARK: - 标题层级

    /// 大标题 - 页面主标题 (34pt base)
    public static func largeTitle(scale: CGFloat = 1.0, weight: Font.Weight = .bold) -> Font {
        .system(size: 34 * scale, weight: weight, design: .rounded)
    }

    /// 一级标题 - 区块标题 (28pt base)
    public static func title1(scale: CGFloat = 1.0, weight: Font.Weight = .bold) -> Font {
        .system(size: 28 * scale, weight: weight, design: .rounded)
    }

    /// 二级标题 - 卡片标题 (22pt base)
    public static func title2(scale: CGFloat = 1.0, weight: Font.Weight = .semibold) -> Font {
        .system(size: 22 * scale, weight: weight, design: .rounded)
    }

    /// 三级标题 - 小标题 (20pt base)
    public static func title3(scale: CGFloat = 1.0, weight: Font.Weight = .semibold) -> Font {
        .system(size: 20 * scale, weight: weight, design: .rounded)
    }

    // MARK: - 正文层级

    /// 强调文本 - 用户名、按钮文字 (17pt base)
    public static func headline(scale: CGFloat = 1.0, weight: Font.Weight = .semibold) -> Font {
        .system(size: 17 * scale, weight: weight)
    }

    /// 正文 - 主要内容文字 (17pt base)
    public static func body(scale: CGFloat = 1.0, weight: Font.Weight = .regular) -> Font {
        .system(size: 17 * scale, weight: weight)
    }

    /// 次级文本 (16pt base)
    public static func callout(scale: CGFloat = 1.0, weight: Font.Weight = .regular) -> Font {
        .system(size: 16 * scale, weight: weight)
    }

    /// 次要文本 - 说明文字 (15pt base)
    public static func subheadline(scale: CGFloat = 1.0, weight: Font.Weight = .regular) -> Font {
        .system(size: 15 * scale, weight: weight)
    }

    // MARK: - 辅助层级

    /// 脚注 - 时间戳、标签 (13pt base)
    public static func footnote(scale: CGFloat = 1.0, weight: Font.Weight = .regular) -> Font {
        .system(size: 13 * scale, weight: weight)
    }

    /// 说明文字 (12pt base)
    public static func caption(scale: CGFloat = 1.0, weight: Font.Weight = .regular) -> Font {
        .system(size: 12 * scale, weight: weight)
    }

    /// 小说明文字 (11pt base)
    public static func caption2(scale: CGFloat = 1.0, weight: Font.Weight = .regular) -> Font {
        .system(size: 11 * scale, weight: weight)
    }

    // MARK: - 特殊用途

    /// 等宽数字 - 统计数据、倒计时 (17pt base)
    public static func numeric(scale: CGFloat = 1.0, weight: Font.Weight = .regular) -> Font {
        .system(size: 17 * scale, weight: weight, design: .monospaced)
    }

    /// 大号等宽数字 - 重要数据展示 (28pt base)
    public static func largeNumeric(scale: CGFloat = 1.0, weight: Font.Weight = .bold) -> Font {
        .system(size: 28 * scale, weight: weight, design: .monospaced)
    }
}

// MARK: - 响应式ViewModifier

public struct ResponsiveFontModifier: ViewModifier {
    @ObservedObject private var fontManager = FontSizeManager.shared

    let fontProvider: (CGFloat) -> Font

    public func body(content: Content) -> some View {
        content.font(fontProvider(fontManager.scale))
    }
}

extension View {
    /// 应用响应式字体 - 自动响应FontSizeManager变化
    /// - Parameter style: 字体样式枚举
    /// - Returns: 应用了响应式字体的View
    ///
    /// 示例：
    /// ```swift
    /// Text("标题")
    ///     .responsiveFont(.title1)
    ///
    /// Text("正文")
    ///     .responsiveFont(.body)
    /// ```
    public func responsiveFont(_ style: ResponsiveFontStyle) -> some View {
        self.modifier(ResponsiveFontModifier(fontProvider: style.fontProvider))
    }

    /// 应用响应式字体（带自定义权重）
    public func responsiveFont(_ style: ResponsiveFontStyle, weight: Font.Weight) -> some View {
        self.modifier(ResponsiveFontModifier(fontProvider: { scale in
            style.fontProvider(scale).weight(weight)
        }))
    }
}

// MARK: - 字体样式枚举

public enum ResponsiveFontStyle {
    case largeTitle
    case title1
    case title2
    case title3
    case headline
    case body
    case callout
    case subheadline
    case footnote
    case caption
    case caption2
    case numeric
    case largeNumeric

    var fontProvider: (CGFloat) -> Font {
        switch self {
        case .largeTitle: return { ResponsiveFont.largeTitle(scale: $0) }
        case .title1: return { ResponsiveFont.title1(scale: $0) }
        case .title2: return { ResponsiveFont.title2(scale: $0) }
        case .title3: return { ResponsiveFont.title3(scale: $0) }
        case .headline: return { ResponsiveFont.headline(scale: $0) }
        case .body: return { ResponsiveFont.body(scale: $0) }
        case .callout: return { ResponsiveFont.callout(scale: $0) }
        case .subheadline: return { ResponsiveFont.subheadline(scale: $0) }
        case .footnote: return { ResponsiveFont.footnote(scale: $0) }
        case .caption: return { ResponsiveFont.caption(scale: $0) }
        case .caption2: return { ResponsiveFont.caption2(scale: $0) }
        case .numeric: return { ResponsiveFont.numeric(scale: $0) }
        case .largeNumeric: return { ResponsiveFont.largeNumeric(scale: $0) }
        }
    }
}

// MARK: - 响应式尺寸系统

/// 响应式尺寸 - 跟随字体缩放的UI元素尺寸
public struct ResponsiveSize {

    // MARK: - 头像尺寸

    public static func avatar(_ size: CGFloat, scale: CGFloat = 1.0) -> CGFloat {
        size * scale
    }

    // MARK: - 图标尺寸

    /// 小图标 (16pt base) - 用于按钮、列表项
    public static func iconSmall(scale: CGFloat = 1.0) -> CGFloat {
        16 * scale
    }

    /// 中图标 (24pt base) - 用于卡片、导航栏
    public static func iconMedium(scale: CGFloat = 1.0) -> CGFloat {
        24 * scale
    }

    /// 大图标 (32pt base) - 用于空状态、Toast
    public static func iconLarge(scale: CGFloat = 1.0) -> CGFloat {
        32 * scale
    }

    /// 特大图标 (48pt base) - 用于页面主视觉
    public static func iconXLarge(scale: CGFloat = 1.0) -> CGFloat {
        48 * scale
    }

    // MARK: - 按钮高度

    /// 小按钮高度 (36pt base)
    public static func buttonSmall(scale: CGFloat = 1.0) -> CGFloat {
        max(36, 32 * scale)  // 最小36pt，保证可点击
    }

    /// 中按钮高度 (44pt base) - iOS标准触控尺寸
    public static func buttonMedium(scale: CGFloat = 1.0) -> CGFloat {
        max(44, 40 * scale)
    }

    /// 大按钮高度 (56pt base)
    public static func buttonLarge(scale: CGFloat = 1.0) -> CGFloat {
        max(48, 48 * scale)
    }

    // MARK: - 间距（固定，不跟随字体缩放）

    public static let spacingXS: CGFloat = 4
    public static let spacingS: CGFloat = 8
    public static let spacingM: CGFloat = 12
    public static let spacingL: CGFloat = 16
    public static let spacingXL: CGFloat = 24
    public static let spacingXXL: CGFloat = 32
}

// MARK: - 响应式尺寸ViewModifier

public struct ResponsiveSizeModifier: ViewModifier {
    @ObservedObject private var fontManager = FontSizeManager.shared

    let sizeProvider: (CGFloat) -> CGFloat

    public func body(content: Content) -> some View {
        let size = sizeProvider(fontManager.scale)
        return content.frame(width: size, height: size)
    }
}

extension View {
    /// 应用响应式图标尺寸
    public func responsiveIconSize(_ style: ResponsiveIconSize) -> some View {
        self.modifier(ResponsiveSizeModifier(sizeProvider: { scale in
            switch style {
            case .small: return ResponsiveSize.iconSmall(scale: scale)
            case .medium: return ResponsiveSize.iconMedium(scale: scale)
            case .large: return ResponsiveSize.iconLarge(scale: scale)
            case .xLarge: return ResponsiveSize.iconXLarge(scale: scale)
            }
        }))
    }
}

public enum ResponsiveIconSize {
    case small   // 16pt
    case medium  // 24pt
    case large   // 32pt
    case xLarge  // 48pt
}

// MARK: - 统一色彩系统（合并DesignSystem.swift和FeedDesign.swift）

public enum UnifiedColors {

    // MARK: - 主色系（品牌色 - 克制使用）

    /// 主色 - 按钮、链接、重要强调
    public static let primary = Color(hex: "3B82F6") ?? .blue  // 蓝色（降低饱和度）

    /// 次色 - 成功状态、积极反馈
    public static let secondary = Color(hex: "10B981") ?? .green

    /// 强调色 - 警告、提醒
    public static let accent = Color(hex: "F59E0B") ?? .orange

    // MARK: - 功能色（语义化）

    /// 成功 - 完成、正确
    public static let success = Color(hex: "10B981") ?? .green

    /// 警告 - 需要注意
    public static let warning = Color(hex: "F59E0B") ?? .orange

    /// 错误 - 失败、禁止
    public static let error = Color(hex: "EF4444") ?? .red

    /// 点赞专用色 - 红心
    public static let like = Color(hex: "EF4444") ?? .red

    /// 破坏性操作 - 删除、登出
    public static let destructive = Color(hex: "EF4444") ?? .red

    // MARK: - 中性色（黑白灰体系 - 主要使用）

    /// 主文本 - 标题、重要信息
    public static let textPrimary = Color(hex: "1F2937") ?? Color(.label)

    /// 次要文本 - 正文、描述
    public static let textSecondary = Color(hex: "6B7280") ?? Color(.secondaryLabel)

    /// 辅助文本 - 提示、禁用
    public static let textTertiary = Color(hex: "9CA3AF") ?? Color(.tertiaryLabel)

    /// 占位文本
    public static let textPlaceholder = Color(hex: "D1D5DB") ?? Color(.placeholderText)

    // MARK: - 背景色

    /// 页面背景
    public static let background = Color(hex: "F9FAFB") ?? Color(.systemGroupedBackground)

    /// 卡片/表面
    public static let surface = Color.white

    /// 次级背景
    public static let surfaceSecondary = Color(hex: "F3F4F6") ?? Color(.secondarySystemBackground)

    // MARK: - 边框与分割线

    /// 边框
    public static let border = Color(hex: "E5E7EB") ?? Color(.separator)

    /// 分割线
    public static let divider = Color(hex: "E5E7EB") ?? Color(.separator)

    // MARK: - 向后兼容（映射到AppColors）

    public static let interactive = primary
    public static let interactivePressed = primary.opacity(0.8)
}

// MARK: - 统一圆角系统

public enum UnifiedRadius {
    /// 无圆角 - 图片、分割线
    public static let none: CGFloat = 0

    /// 超小圆角 - 小标签 (4pt)
    public static let xs: CGFloat = 4

    /// 小圆角 - 按钮、输入框 (8pt)
    public static let s: CGFloat = 8

    /// 中圆角 - 中型卡片 (12pt) ⭐ 推荐使用
    public static let m: CGFloat = 12

    /// 大圆角 - 大型卡片 (16pt)
    public static let l: CGFloat = 16

    /// 胶囊圆角 - 胶囊按钮
    public static let pill: CGFloat = 999
}

// MARK: - 统一阴影系统

public struct UnifiedShadow {
    /// 轻微阴影 - 卡片分层 (仅推荐使用)
    public static let card = (color: Color.black.opacity(0.04), radius: CGFloat(8), x: CGFloat(0), y: CGFloat(2))

    /// 悬浮阴影 - Modal、Toast
    public static let elevated = (color: Color.black.opacity(0.08), radius: CGFloat(12), x: CGFloat(0), y: CGFloat(4))
}

extension View {
    /// 应用统一卡片阴影
    public func unifiedCardShadow() -> some View {
        let shadow = UnifiedShadow.card
        return self.shadow(color: shadow.color, radius: shadow.radius, x: shadow.x, y: shadow.y)
    }

    /// 应用统一悬浮阴影
    public func unifiedElevatedShadow() -> some View {
        let shadow = UnifiedShadow.elevated
        return self.shadow(color: shadow.color, radius: shadow.radius, x: shadow.x, y: shadow.y)
    }
}

// MARK: - 向后兼容别名

/// 向后兼容 - 映射到UnifiedColors
public typealias AppColors = UnifiedColors

/// 向后兼容 - 映射到ResponsiveSize
public enum AppSpacing {
    public static let xs = ResponsiveSize.spacingXS
    public static let s = ResponsiveSize.spacingS
    public static let m = ResponsiveSize.spacingM
    public static let l = ResponsiveSize.spacingL
    public static let xl = ResponsiveSize.spacingXL
    public static let xxl = ResponsiveSize.spacingXXL
}

/// 向后兼容 - 映射到UnifiedRadius
public enum AppRadius {
    public static let s = UnifiedRadius.xs
    public static let m = UnifiedRadius.s
    public static let l = UnifiedRadius.m
    public static let xl = UnifiedRadius.l
    public static let xxl: CGFloat = 28  // 旧版过大圆角，建议废弃
}
