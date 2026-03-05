import Foundation
import SwiftUI
import Combine
import AuthenticationServices

/// 认证视图模型
@MainActor
class AuthViewModel: ObservableObject {
    @ObservedObject private var fontManager = FontSizeManager.shared
    @Published var isAuthenticated = false
    @Published var currentUser: User?
    @Published var isLoading = false
    @Published var errorMessage: String?
    /// 是否正在验证会话（App启动时检查token有效性）
    @Published var isValidatingSession = false

    // 登录方式：phone（手机验证码）或 account（账号密码）
    @Published var loginMethod: LoginMethod = .account

    // 手机验证码登录相关
    @Published var phoneNumber = ""
    @Published var verificationCode = ""
    @Published var showVerificationCodeField = false
    @Published var countdownSeconds = 0
    @Published var canResendCode = true

    // 账号密码登录相关
    @Published var account = ""
    @Published var password = ""
    @Published var showPassword = false

    // 注册相关
    @Published var username = ""
    @Published var isLoginMode = true

    private let authManager = AuthManager.shared
    private var cancellables = Set<AnyCancellable>()
    private var countdownTimer: Timer?

    init() {
        setupBindings()
    }

    /// 发送验证码
    func sendVerificationCode() async {
        guard isValidPhoneNumber(phoneNumber) else {
            errorMessage = NSLocalizedString("auth.error.invalid_phone", comment: "")
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
            errorMessage = NSLocalizedString("auth.error.send_code_failed", comment: "")
            Logger.error("Failed to send verification code: \(error)")
        }

        isLoading = false
    }

    /// 登录
    func login() async {
        // 根据登录方式调用不同的登录方法
        switch loginMethod {
        case .phone:
            await loginWithPhone()
        case .account:
            await loginWithAccount()
        }
    }

    /// 手机验证码登录
    private func loginWithPhone() async {
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

            // ⚡ 登录成功反馈
            SoundManager.shared.playSuccess()
            HapticManager.shared.notification(type: .success)

            Logger.userAction("User logged in with phone", details: ["user_id": user.id])
        } catch {
            // ⚡ 登录失败反馈
            SoundManager.shared.playFailure()
            HapticManager.shared.notification(type: .error)

            errorMessage = error.localizedDescription
            Logger.error("Login failed: \(error)")
        }

        isLoading = false
    }

    /// 账号密码登录
    private func loginWithAccount() async {
        guard !account.isEmpty else {
            errorMessage = NSLocalizedString("auth.error.missing", comment: "")
            return
        }

        guard !password.isEmpty else {
            errorMessage = NSLocalizedString("auth.error.missing", comment: "")
            return
        }

        isLoading = true
        errorMessage = nil

        do {
            let user = try await authManager.loginWithAccount(account: account, password: password)

            currentUser = user
            isAuthenticated = true
            clearForm()

            // ⚡ 登录成功反馈
            SoundManager.shared.playSuccess()
            HapticManager.shared.notification(type: .success)

            Logger.userAction("User logged in with account", details: ["user_id": user.id])
        } catch {
            // ⚡ 登录失败反馈
            SoundManager.shared.playFailure()
            HapticManager.shared.notification(type: .error)

            errorMessage = error.localizedDescription
            Logger.error("Account login failed: \(error)")
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
            errorMessage = NSLocalizedString("auth.error.missing", comment: "")
            return
        }

        guard username.count >= 2 && username.count <= 20 else {
            errorMessage = NSLocalizedString("auth.error.username_length", comment: "")
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

            // ⚡ 注册成功反馈
            SoundManager.shared.playSuccess()
            HapticManager.shared.notification(type: .success)

            Logger.userAction("User registered", details: ["user_id": user.id])
        } catch {
            // ⚡ 注册失败反馈
            SoundManager.shared.playFailure()
            HapticManager.shared.notification(type: .error)

            errorMessage = error.localizedDescription
            Logger.error("Registration failed: \(error)")
        }

        isLoading = false
    }

    /// 游客登录
    func loginAsGuest() async {
        // Disabled for Beta Launch - Force Login
        errorMessage = "Guest mode is disabled."
    }

    /// Apple 登录
    func signInWithApple() async {
        isLoading = true
        errorMessage = nil

        do {
            let appleResult = try await AppleAuthManager.shared.signInWithApple()

            let user = try await authManager.loginWithApple(
                identityToken: appleResult.identityToken,
                authorizationCode: appleResult.authorizationCode,
                fullName: appleResult.displayName,
                email: appleResult.email
            )

            currentUser = user
            isAuthenticated = true
            clearForm()

            Logger.userAction("User logged in with Apple", details: ["user_id": user.id])
        } catch {
            // 用户取消不显示错误
            if case AppleAuthError.userCanceled = error {
                Logger.info("Apple Sign In cancelled by user")
            } else {
                errorMessage = error.localizedDescription
                Logger.error("Apple Sign In failed: \(error)")
            }
        }

        isLoading = false
    }

    /// Google 登录
    func signInWithGoogle() async {
        isLoading = true
        errorMessage = nil

        do {
            let googleResult = try await GoogleAuthManager.shared.signInWithGoogle()

            let user = try await authManager.loginWithGoogle(
                idToken: googleResult.idToken,
                fullName: googleResult.fullName,
                email: googleResult.email
            )

            currentUser = user
            isAuthenticated = true
            clearForm()

            Logger.userAction("User logged in with Google", details: ["user_id": user.id])
        } catch {
            // 用户取消不显示错误
            if case GoogleAuthError.userCanceled = error {
                Logger.info("Google Sign In cancelled by user")
            } else {
                errorMessage = error.localizedDescription
                Logger.error("Google Sign In failed: \(error)")
            }
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
        account = ""
        password = ""
        showPassword = false
        username = ""
        showVerificationCodeField = false
        stopCountdown()
        errorMessage = nil
    }

    /// 切换登录方式
    func switchLoginMethod(_ method: LoginMethod) {
        loginMethod = method
        clearForm()
        errorMessage = nil
        Logger.userAction("Switched login method", details: ["method": method == .phone ? "phone" : "account"])
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

        authManager.$isValidatingSession
            .receive(on: DispatchQueue.main)
            .assign(to: &$isValidatingSession)

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
            Task { @MainActor in
                if self.countdownSeconds > 0 {
                    self.countdownSeconds -= 1
                } else {
                    self.stopCountdown()
                }
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
        switch loginMethod {
        case .phone:
            return !phoneNumber.isEmpty && !verificationCode.isEmpty
        case .account:
            return !account.isEmpty && !password.isEmpty
        }
    }

    var canRegister: Bool {
        canSubmit && !username.isEmpty && username.count >= 2 && username.count <= 20
    }

    var sendButtonText: String {
        if countdownSeconds > 0 {
            return String(format: NSLocalizedString("auth.button.resend_countdown", value: "%ds resend", comment: ""), countdownSeconds)
        } else {
            return NSLocalizedString("auth.button.send_code", value: "Send Code", comment: "")
        }
    }

    var submitButtonText: String {
        isLoginMode ? NSLocalizedString("auth.button.login", comment: "") : NSLocalizedString("auth.button.signup", comment: "")
    }

    var toggleButtonText: String {
        isLoginMode ? NSLocalizedString("auth.toggle.to_signup", comment: "") : NSLocalizedString("auth.toggle.to_login", comment: "")
    }
}

/// 登录方式枚举
enum LoginMethod {
    case phone  // 手机验证码登录
    case account  // 账号密码登录
}