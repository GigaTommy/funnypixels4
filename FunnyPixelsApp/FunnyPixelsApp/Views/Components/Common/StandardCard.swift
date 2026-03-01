
import SwiftUI

// MARK: - Standard Card

/// A unified card container with consistent styling
public struct StandardCard<Content: View>: View {
    let content: Content
    let padding: CGFloat
    let onTap: (() -> Void)?
    
    public init(padding: CGFloat = AppSpacing.l, onTap: (() -> Void)? = nil, @ViewBuilder content: () -> Content) {
        self.content = content()
        self.padding = padding
        self.onTap = onTap
    }
    
    public var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            content
        }
        .padding(padding)
        .background(AppColors.surface)
        .clipShape(RoundedRectangle(cornerRadius: AppRadius.l))
        .modifier(AppShadows.medium())
        .onTapGesture {
            onTap?()
        }
    }
}

// MARK: - Standard List Row

/// A standardized list row with icon, title, subtitle, and optional chevron/badge
public struct StandardListRow<Badge: View>: View {
    let title: String
    let subtitle: String?
    let icon: String
    let iconColor: Color
    let showChevron: Bool
    let badge: Badge
    let action: (() -> Void)?
    
    public init(
        title: String,
        subtitle: String? = nil,
        icon: String,
        iconColor: Color = AppColors.primary,
        showChevron: Bool = true,
        action: (() -> Void)? = nil,
        @ViewBuilder badge: () -> Badge
    ) {
        self.title = title
        self.subtitle = subtitle
        self.icon = icon
        self.iconColor = iconColor
        self.showChevron = showChevron
        self.badge = badge()
        self.action = action
    }
    
    // Convenience init for no badge
    public init(
        title: String,
        subtitle: String? = nil,
        icon: String,
        iconColor: Color = AppColors.primary,
        showChevron: Bool = true,
        action: (() -> Void)? = nil
    ) where Badge == EmptyView {
        self.init(title: title, subtitle: subtitle, icon: icon, iconColor: iconColor, showChevron: showChevron, action: action) { EmptyView() }
    }
    
    public var body: some View {
        Button(action: { action?() }) {
            HStack(spacing: AppSpacing.l) {
                // Icon Container
                ZStack {
                    Circle()
                        .fill(iconColor.opacity(0.1))
                        .frame(width: 40, height: 40)
                    
                    Image(systemName: icon)
                        .font(AppTypography.body())
                        .foregroundColor(iconColor)
                }
                
                // Text
                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .font(AppTypography.body())
                        .foregroundColor(AppColors.textPrimary)
                    
                    if let subtitle = subtitle {
                        Text(subtitle)
                            .font(AppTypography.caption())
                            .foregroundColor(AppColors.textSecondary)
                    }
                }
                
                Spacer()
                
                // Badge
                badge
                
                // Chevron
                if showChevron {
                    Image(systemName: "chevron.right")
                        .font(AppTypography.caption())
                        .foregroundColor(AppColors.textTertiary)
                }
            }
            .padding(AppSpacing.l)
            .background(AppColors.surface)
            .contentShape(Rectangle()) // Hit testing
        }
        .buttonStyle(.plain)
    }
}

#Preview {
    ZStack {
        AppColors.background.ignoresSafeArea()
        VStack(spacing: 20) {
            StandardCard {
                Text("Simple Card Content")
                    .font(AppTypography.headline())
            }
            
            VStack(spacing: 1) {
                StandardListRow(title: "Menu Item 1", icon: "star.fill")
                Divider().padding(.leading, 56)
                StandardListRow(title: "Menu Item 2", subtitle: "With subtitle", icon: "heart.fill", iconColor: .red) {
                    Text("NEW")
                        .font(AppTypography.caption())
                        .fontWeight(.bold)
                        .foregroundColor(.white)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(Color.red)
                        .clipShape(Capsule())
                }
            }
            .background(AppColors.surface)
            .cornerRadius(AppRadius.l)
        }
        .padding()
    }
}
