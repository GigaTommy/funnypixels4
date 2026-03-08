import Foundation
import SwiftUI
import Combine

/// 删除账户流程的状态管理
@MainActor
class DeleteAccountViewModel: ObservableObject {
    // MARK: - Published Properties

    /// 当前步骤（1-5）
    @Published var currentStep = 1

    /// 是否正在处理删除请求
    @Published var isDeleting = false

    /// 是否显示错误提示
    @Published var showError = false

    /// 错误信息
    @Published var errorMessage = ""

    /// 确认清单状态
    @Published var acknowledgedExport = false
    @Published var acknowledgedBackup = false
    @Published var acknowledgedFinal = false

    /// 最终确认输入
    @Published var confirmationInput = ""

    /// 倒计时秒数（防止误触）
    @Published var countdown = 5

    /// 恢复令牌（删除成功后返回）
    @Published var recoveryToken: String?

    /// 是否删除成功
    @Published var deleteSuccess = false

    // MARK: - Computed Properties

    /// 当前步骤是否可以前进
    var canProceed: Bool {
        switch currentStep {
        case 1, 2, 3:
            return true
        case 4:
            return acknowledgedExport && acknowledgedBackup && acknowledgedFinal
        case 5:
            return confirmationInput.uppercased() == "DELETE" && countdown == 0
        default:
            return false
        }
    }

    /// 进度百分比
    var progress: Double {
        return Double(currentStep) / 5.0
    }

    // MARK: - Methods

    /// 前进到下一步
    func nextStep() {
        guard canProceed else { return }
        withAnimation {
            if currentStep < 5 {
                currentStep += 1

                // 如果是最后一步，开始倒计时
                if currentStep == 5 {
                    startCountdown()
                }
            }
        }
    }

    /// 返回上一步
    func previousStep() {
        withAnimation {
            if currentStep > 1 {
                currentStep -= 1

                // 如果从最后一步返回，重置倒计时
                if currentStep == 4 {
                    countdown = 5
                }
            }
        }
    }

    /// 重置所有状态
    func reset() {
        currentStep = 1
        isDeleting = false
        showError = false
        errorMessage = ""
        acknowledgedExport = false
        acknowledgedBackup = false
        acknowledgedFinal = false
        confirmationInput = ""
        countdown = 5
        recoveryToken = nil
        deleteSuccess = false
    }

    /// 开始倒计时
    private func startCountdown() {
        countdown = 5
        Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { [weak self] timer in
            guard let self = self else {
                timer.invalidate()
                return
            }

            Task { @MainActor in
                if self.countdown > 0 {
                    self.countdown -= 1
                } else {
                    timer.invalidate()
                }
            }
        }
    }

    /// 执行删除账户
    func deleteAccount() async {
        guard canProceed else { return }

        isDeleting = true
        showError = false

        do {
            Logger.userAction("执行账户删除")

            // 调用 AuthManager 删除账户
            let token = try await AuthManager.shared.deleteAccount()

            // 保存恢复令牌
            recoveryToken = token
            deleteSuccess = true

            Logger.info("✅ 账户删除成功，恢复令牌已保存")

        } catch {
            Logger.error("❌ 删除账户失败: \(error.localizedDescription)")
            errorMessage = error.localizedDescription
            showError = true
        }

        isDeleting = false
    }

    /// 格式化用户数据统计（用于显示后果）
    func getUserStats() -> (pixels: Int, sessions: Int, messages: Int) {
        guard let user = AuthManager.shared.currentUser else {
            return (0, 0, 0)
        }

        return (
            pixels: user.totalPixels ?? 0,
            sessions: 0,  // TODO: 如果有会话统计可以添加
            messages: 0   // TODO: 如果有消息统计可以添加
        )
    }
}
