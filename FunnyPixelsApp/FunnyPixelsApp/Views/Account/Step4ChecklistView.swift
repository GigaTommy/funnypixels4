import SwiftUI

/// 步骤4：确认清单
struct Step4ChecklistView: View {
    @Binding var acknowledgedExport: Bool
    @Binding var acknowledgedBackup: Bool
    @Binding var acknowledgedFinal: Bool

    var body: some View {
        VStack(spacing: 24) {
            // 说明文本
            Text(NSLocalizedString("delete_account_checklist_title", comment: "在继续之前，请确认您已："))
                .font(.headline)
                .frame(maxWidth: .infinity, alignment: .leading)

            // 确认清单
            VStack(spacing: 16) {
                ChecklistItem(
                    isChecked: $acknowledgedExport,
                    title: NSLocalizedString("delete_account_checklist_export", comment: "导出重要数据"),
                    description: NSLocalizedString("delete_account_checklist_export_desc", comment: "我已经导出或保存了所需的数据（如绘画作品截图等）")
                )

                ChecklistItem(
                    isChecked: $acknowledgedBackup,
                    title: NSLocalizedString("delete_account_checklist_backup", comment: "备份恢复令牌"),
                    description: NSLocalizedString("delete_account_checklist_backup_desc", comment: "我理解删除后会收到恢复令牌，需要妥善保存以便30天内恢复")
                )

                ChecklistItem(
                    isChecked: $acknowledgedFinal,
                    title: NSLocalizedString("delete_account_checklist_understand", comment: "理解删除后果"),
                    description: NSLocalizedString("delete_account_checklist_understand_desc", comment: "我完全理解删除账户的后果，且确认要继续")
                )
            }

            // 警告提示
            HStack(alignment: .top, spacing: 12) {
                Image(systemName: "info.circle.fill")
                    .foregroundColor(.blue)

                Text(NSLocalizedString("delete_account_checklist_note", comment: "请勾选所有选项后才能继续下一步"))
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            .padding()
            .background(Color.blue.opacity(0.1))
            .cornerRadius(8)
        }
    }
}

/// 清单项
struct ChecklistItem: View {
    @Binding var isChecked: Bool
    let title: String
    let description: String

    var body: some View {
        Button(action: {
            withAnimation(.easeInOut(duration: 0.2)) {
                isChecked.toggle()
                HapticManager.shared.impact(style: .light)
            }
        }) {
            HStack(alignment: .top, spacing: 12) {
                // 复选框
                ZStack {
                    RoundedRectangle(cornerRadius: 6)
                        .stroke(isChecked ? Color.blue : Color.gray, lineWidth: 2)
                        .frame(width: 24, height: 24)

                    if isChecked {
                        Image(systemName: "checkmark")
                            .font(.system(size: 14, weight: .bold))
                            .foregroundColor(.blue)
                    }
                }

                // 文本内容
                VStack(alignment: .leading, spacing: 4) {
                    Text(title)
                        .font(.subheadline)
                        .fontWeight(.semibold)
                        .foregroundColor(.primary)

                    Text(description)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }

                Spacer()
            }
            .padding()
            .background(Color(UIColor.secondarySystemGroupedBackground))
            .cornerRadius(12)
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(isChecked ? Color.blue : Color.clear, lineWidth: 2)
            )
        }
        .buttonStyle(PlainButtonStyle())
    }
}

#Preview {
    Step4ChecklistView(
        acknowledgedExport: .constant(false),
        acknowledgedBackup: .constant(true),
        acknowledgedFinal: .constant(false)
    )
}
