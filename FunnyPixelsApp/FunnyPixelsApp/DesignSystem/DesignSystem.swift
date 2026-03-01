
import SwiftUI

// MARK: - App Colors

/// Semantic Color Palette
public enum AppColors {
    
    // Brand Colors
    public static let primary = Color(hex: "1A73E8") ?? .blue
    public static let secondary = Color(hex: "34A853") ?? .green
    public static let tertiary = Color(hex: "EA4335") ?? .red
    public static let warning = Color(hex: "FBBC05") ?? .orange
    
    // Surface & Background
    public static let background = Color(hex: "F8F9FA") ?? Color(.systemGroupedBackground)
    public static let surface = Color.white
    public static let surfaceSecondary = Color(hex: "F1F3F4") ?? Color(.secondarySystemBackground)
    
    // Text
    public static let textPrimary = Color(hex: "202124") ?? .primary
    public static let textSecondary = Color(hex: "5F6368") ?? .secondary
    public static let textTertiary = Color(hex: "9AA0A6") ?? .gray
    
    // Interactive
    public static let interactive = primary
    public static let interactivePressed = primary.opacity(0.8)
    
    // Borders
    public static let border = Color(hex: "DADCE0") ?? Color.gray.opacity(0.2)
}

// MARK: - App Typography

/// Dynamic Type Scaling System
public enum AppTypography {
    
    // Headings
    public static func largeTitle(_ size: CGFloat = 34) -> Font {
        .system(size: size, weight: .bold, design: .rounded)
    }
    
    public static func title1(_ size: CGFloat = 28) -> Font {
        .system(size: size, weight: .bold, design: .rounded)
    }
    
    public static func title2(_ size: CGFloat = 22) -> Font {
        .system(size: size, weight: .semibold, design: .rounded)
    }
    
    public static func title3(_ size: CGFloat = 20) -> Font {
        .system(size: size, weight: .semibold, design: .rounded)
    }
    
    // Body
    public static func headline(_ size: CGFloat = 17) -> Font {
        .system(size: size, weight: .semibold, design: .default)
    }
    
    public static func body(_ size: CGFloat = 17) -> Font {
        .system(size: size, weight: .regular, design: .default)
    }
    
    public static func subheadline(_ size: CGFloat = 15) -> Font {
        .system(size: size, weight: .regular, design: .default)
    }
    
    public static func caption(_ size: CGFloat = 12) -> Font {
        .system(size: size, weight: .medium, design: .default)
    }
    
    // Monospaced
    public static func mono(_ size: CGFloat = 13) -> Font {
        .system(size: size, weight: .medium, design: .monospaced)
    }
}

// MARK: - App Spacing

/// Standardized Spacing
public enum AppSpacing {
    public static let xs: CGFloat = 4
    public static let s: CGFloat = 8
    public static let m: CGFloat = 12
    public static let l: CGFloat = 16
    public static let xl: CGFloat = 24
    public static let xxl: CGFloat = 32
}

// MARK: - App Radius

/// Corner Radii
public enum AppRadius {
    public static let s: CGFloat = 4
    public static let m: CGFloat = 8
    public static let l: CGFloat = 12
    public static let xl: CGFloat = 16
    public static let xxl: CGFloat = 28 // For cards
}

// MARK: - App Shadows

/// Standard Drop Shadows
public struct AppShadows {
    
    public static func small(color: Color = .black.opacity(0.05)) -> some ViewModifier {
        ShadowModifier(color: color, radius: 2, x: 0, y: 1)
    }
    
    public static func medium(color: Color = .black.opacity(0.08)) -> some ViewModifier {
        ShadowModifier(color: color, radius: 8, x: 0, y: 4)
    }
    
    public static func large(color: Color = .black.opacity(0.1)) -> some ViewModifier {
        ShadowModifier(color: color, radius: 20, x: 0, y: 10)
    }
    
    public static func floating(color: Color = .blue.opacity(0.2)) -> some ViewModifier {
        ShadowModifier(color: color, radius: 10, x: 0, y: 4)
    }
    
    struct ShadowModifier: ViewModifier {
        let color: Color
        let radius: CGFloat
        let x: CGFloat
        let y: CGFloat
        
        func body(content: Content) -> some View {
            content.shadow(color: color, radius: radius, x: x, y: y)
        }
    }
}

