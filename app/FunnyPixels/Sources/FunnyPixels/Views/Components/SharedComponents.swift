import SwiftUI

// MARK: - Loading View

/// A view that displays a loading indicator.
public struct LoadingView: View {
    public init() {}

    public var body: some View {
        ProgressView()
            .scaleEffect(1.5)
            .padding()
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
        VStack(spacing: 16) {
            Image(systemName: "exclamationmark.triangle")
                .font(.system(size: 50))
                .foregroundColor(.orange)

            Text(message)
                .multilineTextAlignment(.center)
                .padding(.horizontal)

            if let retryAction = retryAction {
                Button("重试", action: retryAction)
                    .buttonStyle(.borderedProminent)
            }
        }
        .padding()
    }
}

// MARK: - Empty State View

/// A view that displays an empty state message.
public struct EmptyStateView: View {
    let title: String
    let message: String
    let systemImage: String

    public init(title: String, message: String, systemImage: String = "tray") {
        self.title = title
        self.message = message
        self.systemImage = systemImage
    }

    public var body: some View {
        VStack(spacing: 16) {
            Image(systemName: systemImage)
                .font(.system(size: 60))
                .foregroundColor(.gray)

            Text(title)
                .font(.headline)

            Text(message)
                .font(.subheadline)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
        }
        .padding()
    }
}

// MARK: - Preview

#Preview {
    VStack(spacing: 32) {
        LoadingView()
        ErrorView(message: "加载失败，请稍后重试") {
            print("Retry tapped")
        }
        EmptyStateView(
            title: "暂无数据",
            message: "还没有任何像素点",
            systemImage: "paintbrush"
        )
    }
}
