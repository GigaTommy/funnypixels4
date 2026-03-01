import Foundation
import SwiftUI
import Combine

/// 认证视图模型
@MainActor
class AuthViewModel: ObservableObject {
    @Published var isAuthenticated = false
    @Published var currentUser: User?
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var phoneNumber = ""
    @Published var verificationCode = ""
    @Published var username = ""
    @Published var isLoginMode = true
    @Published var showVerificationCodeField = false
    @Published var countdownSeconds = 0
    @Published var canResendCode = true

    private let authManager = AuthManager.shared
    private var cancellables = Set<AnyCancellable>()
    private var countdownTimer: Timer?

    init() {
        setupBindings()
    }

    /// 发送验证码
    func sendVerificationCode() async {
        guard isValidPhoneNumber(phoneNumber) else {
            errorMessage = "请输入有效的手机号码"
            return
        }

        isLoading = true
        errorMessage = nil

        do {
            // 这里应该调用发送验证码的API
            // 暂时模拟发送成功
            try await Task.sleep(nanoseconds: 1_000_000_000) // 1秒延迟

            showVerificationCodeField = true
            startCountdown()
            Logger.userAction("Verification code sent", details: ["phone": phoneNumber])
        } catch {
            errorMessage = "发送验证码失败，请稍后重试"
            Logger.error("Failed to send verification code: \(error)")
        }

        isLoading = false
    }

    /// 登录
    func login() async {
        guard !phoneNumber.isEmpty else {
            errorMessage = "请输入手机号码"
            return
        }

        guard !verificationCode.isEmpty else {
            errorMessage = "请输入验证码"
            return
        }

        isLoading = true
        errorMessage = nil

        do {
            let user = try await authManager.login(phone: phoneNumber, code: verificationCode)

            currentUser = user
            isAuthenticated = true
            clearForm()

            Logger.userAction("User logged in", details: ["user_id": user.id])
        } catch {
            errorMessage = error.localizedDescription
            Logger.error("Login failed: \(error)")
        }

        isLoading = false
    }

    /// 注册
    func register() async {
        guard !phoneNumber.isEmpty else {
            errorMessage = "请输入手机号码"
            return
        }

        guard !verificationCode.isEmpty else {
            errorMessage = "请输入验证码"
            return
        }

        guard !username.isEmpty else {
            errorMessage = "请输入用户名"
            return
        }

        guard username.count >= 2 && username.count <= 20 else {
            errorMessage = "用户名长度应在2-20个字符之间"
            return
        }

        isLoading = true
        errorMessage = nil

        do {
            let user = try await authManager.register(
                phone: phoneNumber,
                code: verificationCode,
                username: username
            )

            currentUser = user
            isAuthenticated = true
            clearForm()

            Logger.userAction("User registered", details: ["user_id": user.id])
        } catch {
            errorMessage = error.localizedDescription
            Logger.error("Registration failed: \(error)")
        }

        isLoading = false
    }

    /// 游客登录
    func loginAsGuest() async {
        isLoading = true
        errorMessage = nil

        do {
            let user = try await authManager.loginAsGuest()

            currentUser = user
            isAuthenticated = true

            Logger.userAction("Guest login", details: ["user_id": user.id])
        } catch {
            errorMessage = error.localizedDescription
            Logger.error("Guest login failed: \(error)")
        }

        isLoading = false
    }

    /// 登出
    func logout() async {
        await authManager.logout()

        isAuthenticated = false
        currentUser = nil
        clearForm()

        Logger.userAction("User logged out")
    }

    /// 切换登录/注册模式
    func toggleMode() {
        isLoginMode.toggle()
        clearForm()
        errorMessage = nil
        Logger.userAction("Toggled auth mode", details: ["is_login": isLoginMode])
    }

    /// 重置表单
    func clearForm() {
        phoneNumber = ""
        verificationCode = ""
        username = ""
        showVerificationCodeField = false
        stopCountdown()
        errorMessage = nil
    }

    /// 重发验证码
    func resendVerificationCode() async {
        await sendVerificationCode()
    }

    // MARK: - Private Methods

    private func setupBindings() {
        // 监听认证管理器状态
        authManager.$isAuthenticated
            .receive(on: DispatchQueue.main)
            .assign(to: &$isAuthenticated)

        authManager.$currentUser
            .receive(on: DispatchQueue.main)
            .assign(to: &$currentUser)

        authManager.$isGuest
            .receive(on: DispatchQueue.main)
            .sink { [weak self] isGuest in
                if isGuest {
                    self?.clearForm()
                }
            }
            .store(in: &cancellables)
    }

    private func isValidPhoneNumber(_ phone: String) -> Bool {
        let phoneRegex = "^1[3-9]\\d{9}$"
        let phoneTest = NSPredicate(format: "SELF MATCHES %@", phoneRegex)
        return phoneTest.evaluate(with: phone)
    }

    private func startCountdown() {
        countdownSeconds = 60
        canResendCode = false

        countdownTimer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { [weak self] _ in
            guard let self = self else { return }

            if self.countdownSeconds > 0 {
                self.countdownSeconds -= 1
            } else {
                self.stopCountdown()
            }
        }
    }

    private func stopCountdown() {
        countdownTimer?.invalidate()
        countdownTimer = nil
        countdownSeconds = 0
        canResendCode = true
    }
}

// MARK: - Computed Properties
extension AuthViewModel {
    var canSubmit: Bool {
        if !phoneNumber.isEmpty && !verificationCode.isEmpty {
            return true
        }
        return false
    }

    var canRegister: Bool {
        canSubmit && !username.isEmpty && username.count >= 2 && username.count <= 20
    }

    var sendButtonText: String {
        if countdownSeconds > 0 {
            return "\(countdownSeconds)s后重发"
        } else {
            return "发送验证码"
        }
    }

    var submitButtonText: String {
        isLoginMode ? "登录" : "注册"
    }

    var toggleButtonText: String {
        isLoginMode ? "没有账号？立即注册" : "已有账号？立即登录"
    }
}