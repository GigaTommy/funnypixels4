import SwiftUI

/// 步骤2：删除后果展示
struct Step2ConsequencesView: View {
    let stats: (pixels: Int, sessions: Int, messages: Int)

    var body: some View {
        VStack(spacing: 24) {
            // 数据统计卡片
            VStack(spacing: 16) {
                Text(NSLocalizedString("delete_account_consequences_data", comment: "您将失去以下数据："))
                    .font(.headline)
                    .frame(maxWidth: .infinity, alignment: .leading)

                DeleteStatCard(
                    icon: "paintbrush.fill",
                    title: NSLocalizedString("delete_account_stat_pixels", comment: "绘制的像素"),
                    value: "\(stats.pixels)",
                    color: .blue
                )

                DeleteStatCard(
                    icon: "clock.fill",
                    title: NSLocalizedString("delete_account_stat_sessions", comment: "绘画会话"),
                    value: "\(stats.sessions)",
                    color: .green
                )

                DeleteStatCard(
                    icon: "message.fill",
                    title: NSLocalizedString("delete_account_stat_messages", comment: "私信记录"),
                    value: "\(stats.messages)",
                    color: .orange
                )
            }
            .padding()
            .background(Color(UIColor.secondarySystemGroupedBackground))
            .cornerRadius(12)

            // 恢复期限说明
            VStack(spacing: 12) {
                HStack {
                    Image(systemName: "clock.badge.exclamationmark.fill")
                        .font(.title2)
                        .foregroundColor(.orange)

                    Text(NSLocalizedString("delete_account_recovery_period", comment: "30天恢复期"))
                        .font(.headline)
                }

                Text(NSLocalizedString("delete_account_recovery_desc", comment: "删除后30天内，您可以使用恢复令牌恢复账户。30天后数据将被永久删除。"))
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal)
            }
            .padding()
            .background(Color.orange.opacity(0.1))
            .cornerRadius(12)

            // 不可恢复的内容
            VStack(alignment: .leading, spacing: 12) {
                Text(NSLocalizedString("delete_account_irreversible", comment: "以下内容立即生效且不可恢复："))
                    .font(.headline)
                    .foregroundColor(.red)

                IrreversibleItem(text: NSLocalizedString("delete_account_irreversible_username", comment: "用户名将被释放，可能被他人注册"))
                IrreversibleItem(text: NSLocalizedString("delete_account_irreversible_alliance", comment: "联盟成员资格立即失效"))
                IrreversibleItem(text: NSLocalizedString("delete_account_irreversible_leaderboard", comment: "排行榜记录将被移除"))
            }
            .padding()
            .background(Color.red.opacity(0.05))
            .cornerRadius(12)
        }
    }
}

/// 统计卡片
struct DeleteStatCard: View {
    let icon: String
    let title: String
    let value: String
    let color: Color

    var body: some View {
        HStack {
            Image(systemName: icon)
                .font(.title2)
                .foregroundColor(color)
                .frame(width: 32)

            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.caption)
                    .foregroundColor(.secondary)

                Text(value)
                    .font(.title3)
                    .fontWeight(.bold)
            }

            Spacer()
        }
        .padding()
        .background(color.opacity(0.1))
        .cornerRadius(8)
    }
}

/// 不可恢复项
struct IrreversibleItem: View {
    let text: String

    var body: some View {
        HStack(alignment: .top, spacing: 8) {
            Image(systemName: "xmark.circle.fill")
                .font(.caption)
                .foregroundColor(.red)

            Text(text)
                .font(.caption)
                .foregroundColor(.secondary)
        }
    }
}

#Preview {
    Step2ConsequencesView(stats: (pixels: 12345, sessions: 67, messages: 89))
}
