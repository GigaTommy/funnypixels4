import SwiftUI

struct ShareToFeedSheet: View {
    let stats: SessionStats
    let onQuickShare: () async -> Void
    let onEditShare: () -> Void
    @Environment(\.dismiss) var dismiss

    var body: some View {
        VStack(spacing: 24) {
            // 标题
            Text(NSLocalizedString("share.to_feed.title", comment: ""))
                .font(.title2.weight(.bold))
                .padding(.top)

            // 快捷分享选项
            ShareOptionCard(
                icon: "bolt.fill",
                iconColor: .blue,
                title: NSLocalizedString("share.quick.title", comment: ""),
                subtitle: NSLocalizedString("share.quick.description", comment: ""),
                action: {
                    Task {
                        await onQuickShare()
                    }
                    dismiss()
                }
            )

            // 编辑分享选项
            ShareOptionCard(
                icon: "pencil",
                iconColor: .orange,
                title: NSLocalizedString("share.edit.title", comment: ""),
                subtitle: NSLocalizedString("share.edit.description", comment: ""),
                action: {
                    onEditShare()
                    dismiss()
                }
            )

            // 取消按钮
            Button(action: { dismiss() }) {
                Text(NSLocalizedString("common.cancel", comment: ""))
                    .font(.body)
                    .foregroundColor(.secondary)
            }
            .padding(.bottom)
        }
        .padding()
    }
}

struct ShareOptionCard: View {
    let icon: String
    let iconColor: Color
    let title: String
    let subtitle: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 16) {
                // 图标
                ZStack {
                    Circle()
                        .fill(iconColor.opacity(0.15))
                        .frame(width: 50, height: 50)
                    Image(systemName: icon)
                        .font(.title2)
                        .foregroundColor(iconColor)
                }

                // 文本
                VStack(alignment: .leading, spacing: 4) {
                    Text(title)
                        .font(.headline)
                        .foregroundColor(.primary)
                    Text(subtitle)
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                        .multilineTextAlignment(.leading)
                }

                Spacer()

                Image(systemName: "chevron.right")
                    .foregroundColor(.secondary)
            }
            .padding()
            .background(Color(.systemGray6))
            .cornerRadius(12)
        }
        .buttonStyle(.plain)
    }
}
