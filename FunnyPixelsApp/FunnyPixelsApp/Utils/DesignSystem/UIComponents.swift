import SwiftUI

// MARK: - FPButton
struct FPButton: View {
    enum Variant {
        case primary
        case secondary
        case ghost
    }
    
    let title: String
    let icon: String?
    let variant: Variant
    let action: () -> Void
    
    init(title: String, icon: String? = nil, variant: Variant = .primary, action: @escaping () -> Void) {
        self.title = title
        self.icon = icon
        self.variant = variant
        self.action = action
    }
    
    var body: some View {
        Button(action: action) {
            HStack(spacing: DesignTokens.Spacing.s) {
                if let icon = icon {
                    Image(systemName: icon)
                        .font(.system(size: 16, weight: .semibold))
                }
                Text(title)
                    .font(.system(size: 16, weight: .semibold))
            }
            .frame(maxWidth: .infinity)
            .frame(height: 50)
            .background(backgroundColor)
            .foregroundColor(foregroundColor)
            .clipShape(Capsule())
            .overlay(
                Capsule()
                    .strokeBorder(borderColor, lineWidth: variant == .secondary ? 1 : 0)
            )
            .contentShape(Rectangle()) // Better hit testing
        }
        .buttonStyle(ScaleButtonStyle())
    }
    
    private var backgroundColor: Color {
        switch variant {
        case .primary: return DesignTokens.Colors.accent
        case .secondary: return DesignTokens.Colors.cardBackground
        case .ghost: return .clear
        }
    }
    
    private var foregroundColor: Color {
        switch variant {
        case .primary: return .white
        case .secondary: return DesignTokens.Colors.textPrimary
        case .ghost: return DesignTokens.Colors.textSecondary
        }
    }
    
    private var borderColor: Color {
        switch variant {
        case .secondary: return Color.gray.opacity(0.2)
        default: return .clear
        }
    }
}

// MARK: - FPCard
struct FPCard<Content: View>: View {
    let content: Content
    
    init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }
    
    var body: some View {
        content
            .padding(DesignTokens.Spacing.xl)
            .background(DesignTokens.Colors.cardBackground)
            .cornerRadius(DesignTokens.Radius.large)
            .fpShadow(DesignTokens.Shadows.card)
    }
}

// MARK: - Button Style Animation
struct ScaleButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.96 : 1)
            .animation(.easeOut(duration: 0.2), value: configuration.isPressed)
            .opacity(configuration.isPressed ? 0.9 : 1)
    }
}
