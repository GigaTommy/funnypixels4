import SwiftUI

/// FunnyPixels Design System Tokens
/// 统一设计语言的基础常量 + 动态字体支持
enum DesignTokens {
    
    // MARK: - Typography (动态字体 - 支持 Dynamic Type)
    
    struct Typography {
        // 新的动态字体系统
        static let largeTitle = Font.largeTitle
        static let title1 = Font.title
        static let title2 = Font.title2
        static let title3 = Font.title3
        static let body = Font.body
        static let bodyEmphasized = Font.body.weight(.semibold)
        static let subheadline = Font.subheadline
        static let footnote = Font.footnote
        static let caption = Font.caption
        static let caption2 = Font.caption2
        static let button = Font.headline
        static let tag = Font.caption.weight(.medium)
        static let numeric = Font.body.monospacedDigit()
        static let largeNumeric = Font.title.monospacedDigit().weight(.bold)
        
        // 向后兼容的函数式API
        static func display(_ text: String) -> Text {
            Text(text).font(title1)
        }
        
        static func headline(_ text: String) -> Text {
            Text(text).font(title2.weight(.bold))
        }
        
        static func title(_ text: String) -> Text {
            Text(text).font(title3.weight(.semibold))
        }
        
        static func body(_ text: String) -> Text {
            Text(text).font(body)
        }
        
        static func caption(_ text: String) -> Text {
            Text(text).font(subheadline.weight(.medium))
        }
        
        static func tiny(_ text: String) -> Text {
            Text(text).font(caption.weight(.bold))
        }
    }
    
    // MARK: - Colors
    
    struct Colors {
        // 文字颜色
        static let textPrimary = Color.primary
        static let textSecondary = Color.secondary
        static let textTertiary = Color(uiColor: .tertiaryLabel)
        
        // 背景颜色
        static let background = Color(UIColor.systemBackground)
        static let backgroundPrimary = Color(uiColor: .systemBackground)
        static let backgroundSecondary = Color(uiColor: .secondarySystemBackground)
        static let backgroundTertiary = Color(uiColor: .tertiarySystemBackground)
        
        // 强调色
        static let accent = Color.blue
        static let success = Color.green
        static let warning = Color.orange
        static let error = Color.red
        static let info = Color.blue
        
        // 向后兼容
        static let primary = accent
        static let secondary = Color.secondary
        static let cardBackground = backgroundPrimary
        static let secondaryBackground = backgroundSecondary
        static let overlayBackground = Color.black.opacity(0.4)
        static let destructive = error
    }
    
    // MARK: - Spacing
    
    struct Spacing {
        static let xxs: CGFloat = 2
        static let xs: CGFloat = 4
        static let sm: CGFloat = 8
        static let md: CGFloat = 12
        static let lg: CGFloat = 16
        static let xl: CGFloat = 24
        static let xxl: CGFloat = 32
        static let xxxl: CGFloat = 48
        
        // 向后兼容
        static let s: CGFloat = sm
        static let m: CGFloat = md
        static let l: CGFloat = lg
    }
    
    // MARK: - Corner Radius
    
    struct CornerRadius {
        static let sm: CGFloat = 4
        static let md: CGFloat = 8
        static let lg: CGFloat = 12
        static let xl: CGFloat = 16
        static let xxl: CGFloat = 24
    }
    
    // 向后兼容
    struct Radius {
        static let small: CGFloat = CornerRadius.sm
        static let medium: CGFloat = CornerRadius.md
        static let large: CGFloat = CornerRadius.xl
        static let pill: CGFloat = 999
    }
    
    // MARK: - Shadow
    
    struct Shadow {
        static let sm = (color: Color.black.opacity(0.06), radius: CGFloat(4), x: CGFloat(0), y: CGFloat(2))
        static let md = (color: Color.black.opacity(0.1), radius: CGFloat(8), x: CGFloat(0), y: CGFloat(4))
        static let lg = (color: Color.black.opacity(0.15), radius: CGFloat(16), x: CGFloat(0), y: CGFloat(8))
    }
    
    // 向后兼容
    struct Shadows {
        static let card = ShadowStyle(color: Color.black.opacity(0.1), radius: 10, x: 0, y: 4)
        static let floating = ShadowStyle(color: Color.black.opacity(0.15), radius: 20, x: 0, y: 8)
    }
    
    struct ShadowStyle {
        let color: Color
        let radius: CGFloat
        let x: CGFloat
        let y: CGFloat
    }
}

// MARK: - View Modifiers

extension View {
    func fpShadow(_ style: DesignTokens.ShadowStyle) -> some View {
        self.shadow(color: style.color, radius: style.radius, x: style.x, y: style.y)
    }
}

// MARK: - Font Extensions

extension Font {
    /// 用于需要固定大小的特殊场景（如图标、徽章）
    /// 注意：应尽量避免使用，优先使用动态字体
    static func fixed(size: CGFloat, weight: Weight = .regular) -> Font {
        return .system(size: size, weight: weight)
    }
}
