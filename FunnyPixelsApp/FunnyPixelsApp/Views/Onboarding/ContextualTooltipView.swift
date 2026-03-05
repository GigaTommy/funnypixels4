import SwiftUI

/// 上下文提示气泡
/// 设计原则：轻量级、非侵入式、允许穿透
struct ContextualTooltipView: View {
    let config: TooltipConfiguration
    let onDismiss: () -> Void

    @State private var appeared = false

    var body: some View {
        ZStack(alignment: .topLeading) {
            // 半透明背景（允许点击穿透）
            Color.black.opacity(0.15)
                .ignoresSafeArea()
                .allowsHitTesting(false)

            // 提示气泡
            VStack(alignment: .leading, spacing: 12) {
                // 图标 + 标题
                HStack(spacing: 10) {
                    Image(systemName: config.icon)
                        .font(.system(size: 20, weight: .medium))
                        .foregroundColor(UnifiedColors.primary)

                    Text(config.title)
                        .responsiveFont(.headline, weight: .semibold)
                        .foregroundColor(UnifiedColors.textPrimary)
                }

                // 描述文字
                Text(config.message)
                    .responsiveFont(.caption)
                    .foregroundColor(UnifiedColors.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)

                // 操作按钮
                HStack {
                    Spacer()

                    Button(action: {
                        HapticManager.shared.selection()
                        onDismiss()
                    }) {
                        Text(NSLocalizedString("tooltip.got_it", value: "知道了", comment: "Got it button"))
                            .responsiveFont(.caption, weight: .semibold)
                            .foregroundColor(.white)
                            .padding(.horizontal, 20)
                            .padding(.vertical, 10)
                            .background(
                                Capsule()
                                    .fill(UnifiedColors.primary)
                            )
                    }
                }
            }
            .padding(16)
            .frame(maxWidth: 280)
            .background(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .fill(UnifiedColors.surface)
                    .shadow(
                        color: .black.opacity(0.12),
                        radius: 16,
                        x: 0,
                        y: 4
                    )
            )
            .overlay(alignment: config.arrowAlignment) {
                // 箭头指示器
                Triangle()
                    .fill(UnifiedColors.surface)
                    .frame(width: 16, height: 10)
                    .rotationEffect(config.arrowRotation)
                    .offset(config.arrowOffset)
                    .shadow(
                        color: .black.opacity(0.08),
                        radius: 4,
                        x: 0,
                        y: 2
                    )
            }
            .position(config.anchorPoint)
            .scaleEffect(appeared ? 1.0 : 0.9)
            .opacity(appeared ? 1.0 : 0.0)
        }
        .transition(.opacity)
        .onAppear {
            withAnimation(.spring(response: 0.4, dampingFraction: 0.75).delay(0.1)) {
                appeared = true
            }
        }
    }
}

/// 三角形箭头
fileprivate struct Triangle: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        path.move(to: CGPoint(x: rect.midX, y: rect.minY))
        path.addLine(to: CGPoint(x: rect.maxX, y: rect.maxY))
        path.addLine(to: CGPoint(x: rect.minX, y: rect.maxY))
        path.closeSubpath()
        return path
    }
}

// MARK: - Preview

#Preview("First Tap Tooltip") {
    ZStack {
        Color.gray.opacity(0.3)
            .ignoresSafeArea()

        ContextualTooltipView(
            config: .firstTap(screenSize: UIScreen.main.bounds.size),
            onDismiss: {}
        )
    }
}

#Preview("Post Draw Tooltip") {
    ZStack {
        Color.gray.opacity(0.3)
            .ignoresSafeArea()

        ContextualTooltipView(
            config: .postDrawSuccess(screenSize: UIScreen.main.bounds.size),
            onDismiss: {}
        )
    }
}
