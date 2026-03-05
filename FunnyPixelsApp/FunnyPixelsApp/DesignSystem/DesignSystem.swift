
import SwiftUI

// NOTE: AppColors, AppSpacing, AppRadius are defined in UnifiedDesignSystem.swift

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

