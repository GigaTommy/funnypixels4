import SwiftUI

/// 步骤5：最终确认（倒计时 + 输入验证）
struct Step5FinalConfirmationView: View {
    @Binding var confirmationInput: String
    let countdown: Int

    var body: some View {
        VStack(spacing: 24) {
            // 最后警告
            VStack(spacing: 16) {
                Image(systemName: "exclamationmark.triangle.fill")
                    .font(.system(size: 50))
                    .foregroundColor(.red)

                Text(NSLocalizedString("delete_account_final_warning", comment: "最后警告"))
                    .font(.title2)
                    .fontWeight(.bold)
                    .foregroundColor(.red)

                Text(NSLocalizedString("delete_account_final_warning_desc", comment: "此操作将立即执行，请再次确认您的决定"))
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal)
            }
            .padding()
            .background(Color.red.opacity(0.05))
            .cornerRadius(12)

            // 倒计时
            if countdown > 0 {
                VStack(spacing: 8) {
                    Text(NSLocalizedString("delete_account_countdown", comment: "请等待倒计时结束"))
                        .font(.caption)
                        .foregroundColor(.secondary)

                    ZStack {
                        Circle()
                            .stroke(Color.red.opacity(0.2), lineWidth: 8)
                            .frame(width: 80, height: 80)

                        Circle()
                            .trim(from: 0, to: CGFloat(5 - countdown) / 5.0)
                            .stroke(Color.red, lineWidth: 8)
                            .frame(width: 80, height: 80)
                            .rotationEffect(.degrees(-90))
                            .animation(.linear(duration: 1.0), value: countdown)

                        Text("\(countdown)")
                            .font(.system(size: 32, weight: .bold, design: .rounded))
                            .foregroundColor(.red)
                    }
                }
                .padding()
            }

            // 输入确认
            VStack(alignment: .leading, spacing: 12) {
                Text(NSLocalizedString("delete_account_type_delete", comment: "请输入 DELETE 以确认删除"))
                    .font(.subheadline)
                    .fontWeight(.semibold)

                TextField(
                    NSLocalizedString("delete_account_type_delete_placeholder", comment: "输入 DELETE"),
                    text: $confirmationInput
                )
                .textFieldStyle(RoundedBorderTextFieldStyle())
                .autocapitalization(.allCharacters)
                .disableAutocorrection(true)
                .font(.system(.body, design: .monospaced))
                .padding(.vertical, 8)

                // 输入验证提示
                HStack(spacing: 8) {
                    Image(systemName: confirmationInput.uppercased() == "DELETE" ? "checkmark.circle.fill" : "xmark.circle.fill")
                        .foregroundColor(confirmationInput.uppercased() == "DELETE" ? .green : .gray)

                    Text(confirmationInput.uppercased() == "DELETE" ?
                         NSLocalizedString("delete_account_input_correct", comment: "输入正确") :
                         NSLocalizedString("delete_account_input_incorrect", comment: "请输入 DELETE"))
                        .font(.caption)
                        .foregroundColor(confirmationInput.uppercased() == "DELETE" ? .green : .gray)
                }
            }
            .padding()
            .background(Color(UIColor.secondarySystemGroupedBackground))
            .cornerRadius(12)

            // 按钮状态说明
            if countdown > 0 || confirmationInput.uppercased() != "DELETE" {
                VStack(spacing: 8) {
                    if countdown > 0 {
                        HStack(spacing: 8) {
                            Image(systemName: "clock.fill")
                                .foregroundColor(.orange)
                            Text(NSLocalizedString("delete_account_wait_countdown", comment: "等待倒计时结束"))
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                    }

                    if confirmationInput.uppercased() != "DELETE" {
                        HStack(spacing: 8) {
                            Image(systemName: "keyboard")
                                .foregroundColor(.orange)
                            Text(NSLocalizedString("delete_account_enter_delete", comment: "输入 DELETE 确认"))
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                    }
                }
                .padding()
                .background(Color.orange.opacity(0.1))
                .cornerRadius(8)
            }
        }
    }
}

#Preview {
    VStack {
        Step5FinalConfirmationView(
            confirmationInput: .constant(""),
            countdown: 3
        )

        Divider()

        Step5FinalConfirmationView(
            confirmationInput: .constant("DELETE"),
            countdown: 0
        )
    }
}
