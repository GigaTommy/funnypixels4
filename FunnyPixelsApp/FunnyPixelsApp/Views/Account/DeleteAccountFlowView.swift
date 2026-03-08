import SwiftUI

/// 账户删除流程主视图（5步确认）
struct DeleteAccountFlowView: View {
    @StateObject private var viewModel = DeleteAccountViewModel()
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationView {
            ZStack {
                // 背景色
                Color(UIColor.systemGroupedBackground)
                    .ignoresSafeArea()

                VStack(spacing: 0) {
                    // 进度条
                    ProgressView(value: viewModel.progress)
                        .tint(.red)
                        .padding()

                    // 步骤标题
                    stepTitle
                        .padding(.horizontal)
                        .padding(.bottom, 20)

                    // 当前步骤内容
                    ScrollView {
                        currentStepView
                            .padding()
                    }

                    Spacer()

                    // 底部按钮
                    bottomButtons
                        .padding()
                }
            }
            .navigationTitle(NSLocalizedString("delete_account_title", comment: "删除账户"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button(NSLocalizedString("cancel", comment: "取消")) {
                        dismiss()
                    }
                }
            }
            .alert(NSLocalizedString("delete_account_error", comment: "删除失败"), isPresented: $viewModel.showError) {
                Button(NSLocalizedString("ok", comment: "确定"), role: .cancel) { }
            } message: {
                Text(viewModel.errorMessage)
            }
            // 删除成功后显示恢复令牌
            .sheet(isPresented: $viewModel.deleteSuccess) {
                DeleteSuccessView(recoveryToken: viewModel.recoveryToken ?? "")
            }
        }
    }

    // MARK: - 步骤标题
    private var stepTitle: some View {
        VStack(spacing: 8) {
            Text(NSLocalizedString("delete_account_step_indicator", comment: "步骤 %d / 5").formatted(viewModel.currentStep))
                .font(.caption)
                .foregroundColor(.secondary)

            Text(stepTitleText)
                .font(.title2)
                .fontWeight(.bold)
                .multilineTextAlignment(.center)
        }
    }

    private var stepTitleText: String {
        switch viewModel.currentStep {
        case 1:
            return NSLocalizedString("delete_account_step1_title", comment: "⚠️ 重要警告")
        case 2:
            return NSLocalizedString("delete_account_step2_title", comment: "删除后果")
        case 3:
            return NSLocalizedString("delete_account_step3_title", comment: "是否考虑其他方案？")
        case 4:
            return NSLocalizedString("delete_account_step4_title", comment: "最后确认")
        case 5:
            return NSLocalizedString("delete_account_step5_title", comment: "确认删除")
        default:
            return ""
        }
    }

    // MARK: - 当前步骤视图
    @ViewBuilder
    private var currentStepView: some View {
        switch viewModel.currentStep {
        case 1:
            Step1WarningView()
        case 2:
            Step2ConsequencesView(stats: viewModel.getUserStats())
        case 3:
            Step3AlternativesView()
        case 4:
            Step4ChecklistView(
                acknowledgedExport: $viewModel.acknowledgedExport,
                acknowledgedBackup: $viewModel.acknowledgedBackup,
                acknowledgedFinal: $viewModel.acknowledgedFinal
            )
        case 5:
            Step5FinalConfirmationView(
                confirmationInput: $viewModel.confirmationInput,
                countdown: viewModel.countdown
            )
        default:
            EmptyView()
        }
    }

    // MARK: - 底部按钮
    private var bottomButtons: some View {
        HStack(spacing: 16) {
            // 上一步按钮
            if viewModel.currentStep > 1 {
                Button(action: viewModel.previousStep) {
                    HStack {
                        Image(systemName: "chevron.left")
                        Text(NSLocalizedString("previous", comment: "上一步"))
                    }
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(Color.secondary.opacity(0.2))
                    .cornerRadius(12)
                }
            }

            // 下一步/删除按钮
            Button(action: {
                if viewModel.currentStep == 5 {
                    Task {
                        await viewModel.deleteAccount()
                    }
                } else {
                    viewModel.nextStep()
                }
            }) {
                HStack {
                    if viewModel.isDeleting {
                        ProgressView()
                            .tint(.white)
                    } else {
                        Text(viewModel.currentStep == 5 ?
                             NSLocalizedString("delete_account_confirm", comment: "确认删除") :
                             NSLocalizedString("next", comment: "下一步"))
                    }
                }
                .frame(maxWidth: .infinity)
                .padding()
                .background(viewModel.canProceed ? Color.red : Color.gray)
                .foregroundColor(.white)
                .cornerRadius(12)
            }
            .disabled(!viewModel.canProceed || viewModel.isDeleting)
        }
    }
}

// MARK: - Helper Extension
extension String {
    func formatted(_ args: CVarArg...) -> String {
        return String(format: self, arguments: args)
    }
}

// MARK: - 删除成功视图
struct DeleteSuccessView: View {
    let recoveryToken: String
    @Environment(\.dismiss) private var dismiss

    @State private var copied = false

    var body: some View {
        NavigationView {
            VStack(spacing: 24) {
                Image(systemName: "checkmark.circle.fill")
                    .font(.system(size: 80))
                    .foregroundColor(.green)

                Text(NSLocalizedString("delete_account_success_title", comment: "账户已删除"))
                    .font(.title)
                    .fontWeight(.bold)

                Text(NSLocalizedString("delete_account_success_message", comment: "您有30天时间恢复账户"))
                    .font(.body)
                    .multilineTextAlignment(.center)
                    .foregroundColor(.secondary)

                // 恢复令牌
                VStack(alignment: .leading, spacing: 8) {
                    Text(NSLocalizedString("recovery_token_label", comment: "恢复令牌："))
                        .font(.caption)
                        .foregroundColor(.secondary)

                    HStack {
                        Text(recoveryToken)
                            .font(.system(.body, design: .monospaced))
                            .padding()
                            .frame(maxWidth: .infinity)
                            .background(Color.secondary.opacity(0.1))
                            .cornerRadius(8)

                        Button(action: {
                            UIPasteboard.general.string = recoveryToken
                            copied = true
                            HapticManager.shared.impact(style: .medium)
                        }) {
                            Image(systemName: copied ? "checkmark" : "doc.on.doc")
                                .font(.title3)
                        }
                    }
                }
                .padding()
                .background(Color(UIColor.secondarySystemGroupedBackground))
                .cornerRadius(12)

                Text(NSLocalizedString("recovery_token_warning", comment: "请妥善保存此令牌"))
                    .font(.caption)
                    .foregroundColor(.orange)
                    .multilineTextAlignment(.center)

                Spacer()

                Button(action: {
                    dismiss()
                }) {
                    Text(NSLocalizedString("close", comment: "关闭"))
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(Color.blue)
                        .foregroundColor(.white)
                        .cornerRadius(12)
                }
                .padding(.horizontal)
            }
            .padding()
            .navigationTitle(NSLocalizedString("delete_account_title", comment: "删除账户"))
            .navigationBarTitleDisplayMode(.inline)
        }
    }
}

#Preview {
    DeleteAccountFlowView()
}
