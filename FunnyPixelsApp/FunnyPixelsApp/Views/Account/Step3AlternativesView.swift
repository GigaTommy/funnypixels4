import SwiftUI

/// 步骤3：替代方案建议
struct Step3AlternativesView: View {
    var body: some View {
        VStack(spacing: 24) {
            // 提示文本
            Text(NSLocalizedString("delete_account_alternatives_title", comment: "在删除账户之前，您是否考虑过这些替代方案？"))
                .font(.headline)
                .multilineTextAlignment(.center)
                .padding(.horizontal)

            // 替代方案列表
            VStack(spacing: 16) {
                AlternativeOption(
                    icon: "pause.circle.fill",
                    color: .blue,
                    title: NSLocalizedString("delete_account_alternative_deactivate", comment: "暂时停用账户"),
                    description: NSLocalizedString("delete_account_alternative_deactivate_desc", comment: "隐藏您的资料，随时可以重新激活"),
                    isRecommended: true
                )

                AlternativeOption(
                    icon: "eye.slash.fill",
                    color: .purple,
                    title: NSLocalizedString("delete_account_alternative_privacy", comment: "调整隐私设置"),
                    description: NSLocalizedString("delete_account_alternative_privacy_desc", comment: "控制谁可以看到您的内容和资料")
                )

                AlternativeOption(
                    icon: "person.crop.circle.badge.xmark",
                    color: .orange,
                    title: NSLocalizedString("delete_account_alternative_unfollow", comment: "取消关注/屏蔽用户"),
                    description: NSLocalizedString("delete_account_alternative_unfollow_desc", comment: "管理您的社交圈，避免不想看到的内容")
                )

                AlternativeOption(
                    icon: "bell.slash.fill",
                    color: .green,
                    title: NSLocalizedString("delete_account_alternative_notifications", comment: "关闭通知"),
                    description: NSLocalizedString("delete_account_alternative_notifications_desc", comment: "减少打扰，保留账户数据")
                )
            }

            // 仍要删除的提示
            VStack(spacing: 8) {
                Text(NSLocalizedString("delete_account_still_delete", comment: "如果您仍然决定删除账户"))
                    .font(.subheadline)
                    .fontWeight(.semibold)

                Text(NSLocalizedString("delete_account_still_delete_desc", comment: "请点击\"下一步\"继续删除流程"))
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            .padding()
            .background(Color(UIColor.secondarySystemGroupedBackground))
            .cornerRadius(12)
        }
    }
}

/// 替代方案选项
struct AlternativeOption: View {
    let icon: String
    let color: Color
    let title: String
    let description: String
    var isRecommended: Bool = false

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: icon)
                    .font(.title2)
                    .foregroundColor(color)

                Text(title)
                    .font(.headline)

                if isRecommended {
                    Text(NSLocalizedString("recommended", comment: "推荐"))
                        .font(.caption2)
                        .fontWeight(.bold)
                        .foregroundColor(.white)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(color)
                        .cornerRadius(4)
                }

                Spacer()
            }

            Text(description)
                .font(.subheadline)
                .foregroundColor(.secondary)
        }
        .padding()
        .background(Color(UIColor.secondarySystemGroupedBackground))
        .cornerRadius(12)
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(isRecommended ? color : Color.clear, lineWidth: 2)
        )
    }
}

#Preview {
    Step3AlternativesView()
}
