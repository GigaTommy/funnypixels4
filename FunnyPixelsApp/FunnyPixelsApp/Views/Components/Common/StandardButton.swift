
import SwiftUI

// MARK: - Standard Button

public struct StandardButton: View {
    public enum Style {
        case primary
        case secondary
        case ghost
        case destructive
    }
    
    public enum Size {
        case small
        case medium
        case large
    }
    
    let title: String
    let icon: String?
    let style: Style
    let size: Size
    let isLoading: Bool
    let isDisabled: Bool
    let haptic: Bool
    let action: () -> Void
    
    public init(
        title: String,
        icon: String? = nil,
        style: Style = .primary,
        size: Size = .medium,
        isLoading: Bool = false,
        isDisabled: Bool = false,
        haptic: Bool = true,
        action: @escaping () -> Void
    ) {
        self.title = title
        self.icon = icon
        self.style = style
        self.size = size
        self.isLoading = isLoading
        self.isDisabled = isDisabled
        self.haptic = haptic
        self.action = action
    }
    
    public var body: some View {
        Button(action: {
            if haptic {
                HapticManager.shared.impact(style: .light)
            }
            action()
        }) {
            HStack(spacing: 8) {
                if isLoading {
                    ProgressView()
                        .tint(textColor)
                } else {
                    if let icon = icon {
                        Image(systemName: icon)
                            .font(font)
                    }
                    Text(title)
                        .font(font)
                        .fontWeight(.semibold)
                }
            }
            .frame(maxWidth: .infinity)
            .frame(height: height)
            .background(backgroundColor)
            .foregroundColor(textColor)
            .clipShape(RoundedRectangle(cornerRadius: AppRadius.l))
            .overlay(
                RoundedRectangle(cornerRadius: AppRadius.l)
                    .stroke(borderColor, lineWidth: 1)
            )
            .shadow(color: shadowColor, radius: 4, x: 0, y: 2)
            .opacity(isDisabled ? 0.6 : 1.0)
        }
        .buttonStyle(StandardScaleButtonStyle())
        .disabled(isLoading || isDisabled)
    }
    
    // MARK: - Style Helpers
    
    private var height: CGFloat {
        switch size {
        case .small: return 36
        case .medium: return 48
        case .large: return 56
        }
    }
    
    private var font: Font {
        switch size {
        case .small: return .system(size: 14)
        case .medium: return .system(size: 16)
        case .large: return .system(size: 18)
        }
    }
    
    private var backgroundColor: Color {
        switch style {
        case .primary: return AppColors.primary
        case .secondary: return AppColors.surface
        case .ghost: return .clear
        case .destructive: return AppColors.tertiary
        }
    }
    
    private var textColor: Color {
        switch style {
        case .primary, .destructive: return .white
        case .secondary: return AppColors.primary
        case .ghost: return AppColors.textSecondary
        }
    }
    
    private var borderColor: Color {
        switch style {
        case .secondary: return AppColors.border
        default: return .clear
        }
    }
    
    private var shadowColor: Color {
        switch style {
        case .primary: return AppColors.primary.opacity(0.3)
        case .destructive: return AppColors.tertiary.opacity(0.3)
        default: return .clear
        }
    }
}

// MARK: - Button Style (Motion)

struct StandardScaleButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.96 : 1)
            .animation(.spring(response: 0.3, dampingFraction: 0.6), value: configuration.isPressed)
    }
}

#Preview {
    VStack(spacing: 20) {
        StandardButton(title: "Primary Button", icon: "star.fill", style: .primary, action: {})
        StandardButton(title: "Secondary Button", icon: "star", style: .secondary, action: {})
        StandardButton(title: "Ghost Button", style: .ghost, action: {})
        StandardButton(title: "Destructive", style: .destructive, action: {})
        StandardButton(title: "Loading", style: .primary, isLoading: true, action: {})
    }
    .padding()
}
