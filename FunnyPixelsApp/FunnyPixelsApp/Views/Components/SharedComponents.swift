import SwiftUI

// MARK: - Loading View

/// A view that displays a loading indicator.
public struct LoadingView: View {
    public init() {}

    public var body: some View {
        VStack(spacing: AppSpacing.m) {
            ProgressView()
                .scaleEffect(1.2)
                .tint(AppColors.primary)
            
            Text(NSLocalizedString("common.loading", comment: "Loading..."))
                .font(AppTypography.caption())
                .foregroundColor(AppColors.textSecondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(AppColors.background)
    }
}

// MARK: - Error View

/// A view that displays an error message.
public struct ErrorView: View {
    let message: String
    let retryAction: (() -> Void)?

    public init(message: String, retryAction: (() -> Void)? = nil) {
        self.message = message
        self.retryAction = retryAction
    }

    public var body: some View {
        VStack(spacing: AppSpacing.l) {
            Image(systemName: "exclamationmark.triangle.fill")
                .font(DesignTokens.Typography.largeTitle)
                .foregroundColor(AppColors.warning)
                .padding(.bottom, AppSpacing.s)

            Text(message)
                .font(AppTypography.body())
                .foregroundColor(AppColors.textPrimary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, AppSpacing.xl)

            if let retryAction = retryAction {
                StandardButton(
                    title: NSLocalizedString("common.retry", comment: "Retry"),
                    icon: "arrow.clockwise",
                    style: .secondary,
                    size: .medium,
                    action: retryAction
                )
                .frame(width: 160)
            }
        }
        .padding(AppSpacing.xl)
        .background(AppColors.background)
    }
}

// MARK: - Empty State View

/// A view that displays an empty state message.
public struct EmptyStateView: View {
    let title: String
    let message: String
    let systemImage: String
    let actionTitle: String?
    let action: (() -> Void)?

    public init(
        title: String,
        message: String,
        systemImage: String = "tray",
        actionTitle: String? = nil,
        action: (() -> Void)? = nil
    ) {
        self.title = title
        self.message = message
        self.systemImage = systemImage
        self.actionTitle = actionTitle
        self.action = action
    }

    public var body: some View {
        VStack(spacing: AppSpacing.l) {
            Image(systemName: systemImage)
                .font(DesignTokens.Typography.largeTitle.weight(.bold))
                .foregroundColor(AppColors.textTertiary)
                .padding(.bottom, AppSpacing.s)

            Text(title)
                .font(AppTypography.title3())
                .foregroundColor(AppColors.textPrimary)

            Text(message)
                .font(AppTypography.body())
                .foregroundColor(AppColors.textSecondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, AppSpacing.xl)
            
            if let actionTitle = actionTitle, let action = action {
                StandardButton(
                    title: actionTitle,
                    style: .primary,
                    size: .medium,
                    action: action
                )
                .frame(width: 200)
                .padding(.top, AppSpacing.m)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(AppSpacing.xl)
        .background(AppColors.background)
    }
}

// MARK: - Preview

#Preview {
    VStack(spacing: 32) {
        LoadingView()
            .frame(height: 100)
        
        ErrorView(message: "加载失败，请稍后重试") {
            Logger.debug("Retry tapped")
        }
        
        EmptyStateView(
            title: "暂无数据",
            message: "还没有任何像素点，快去探索吧！",
            systemImage: "paintbrush",
            actionTitle: "去探索",
            action: {}
        )
    }
}
