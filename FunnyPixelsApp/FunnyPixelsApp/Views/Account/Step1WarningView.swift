import SwiftUI

/// 步骤1：重要警告
struct Step1WarningView: View {
    var body: some View {
        VStack(spacing: 20) {
            // 警告图标
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.system(size: 60))
                .foregroundColor(.red)
                .padding(.top, 20)

            // 警告内容
            VStack(alignment: .leading, spacing: 16) {
                WarningItem(
                    icon: "trash.fill",
                    title: NSLocalizedString("delete_account_warning_permanent", comment: "永久删除数据"),
                    description: NSLocalizedString("delete_account_warning_permanent_desc", comment: "30天后数据将被永久删除，无法恢复")
                )

                WarningItem(
                    icon: "person.fill.xmark",
                    title: NSLocalizedString("delete_account_warning_access", comment: "失去账户访问权限"),
                    description: NSLocalizedString("delete_account_warning_access_desc", comment: "立即失去所有功能访问权限")
                )

                WarningItem(
                    icon: "paintpalette.fill",
                    title: NSLocalizedString("delete_account_warning_pixels", comment: "所有像素记录"),
                    description: NSLocalizedString("delete_account_warning_pixels_desc", comment: "您的绘画作品将无法再访问")
                )

                WarningItem(
                    icon: "flag.fill",
                    title: NSLocalizedString("delete_account_warning_alliance", comment: "联盟成员资格"),
                    description: NSLocalizedString("delete_account_warning_alliance_desc", comment: "将失去所有联盟成员资格")
                )

                WarningItem(
                    icon: "person.2.fill",
                    title: NSLocalizedString("delete_account_warning_social", comment: "社交关系"),
                    description: NSLocalizedString("delete_account_warning_social_desc", comment: "关注/粉丝关系将全部清除")
                )
            }
            .padding()
            .background(Color(UIColor.secondarySystemGroupedBackground))
            .cornerRadius(12)

            // 提示信息
            Text(NSLocalizedString("delete_account_warning_footer", comment: "请仔细阅读以上内容后继续"))
                .font(.caption)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal)
        }
    }
}

/// 警告项组件
struct WarningItem: View {
    let icon: String
    let title: String
    let description: String

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: icon)
                .font(.title3)
                .foregroundColor(.red)
                .frame(width: 24)

            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.subheadline)
                    .fontWeight(.semibold)

                Text(description)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
    }
}

#Preview {
    Step1WarningView()
}
