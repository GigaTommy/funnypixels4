import Foundation
import AuthenticationServices
import Combine

/// Apple登录管理器
/// 负责处理Sign in with Apple的完整流程
@MainActor
public class AppleAuthManager: NSObject, ObservableObject {

    // MARK: - Singleton
    public static let shared = AppleAuthManager()

    // MARK: - Published Properties

    /// 登录状态
    @Published public private(set) var authState: AppleAuthState = .signedOut

    /// 错误信息
    @Published public private(set) var errorMessage: String?

    // MARK: - Private Properties

    private var currentNonce: String?
    private var continuation: CheckedContinuation<AppleAuthResult, any Error>?

    // MARK: - Initialization

    private override init() {
        super.init()
        // Logger.info("AppleAuthManager initialized")  // 临时禁用，避免初始化问题
    }

    // MARK: - Public Methods

    /// 发起Apple登录
    /// - Returns: 登录结果
    public func signInWithApple() async throws -> AppleAuthResult {
        Logger.info("Starting Sign in with Apple")

        authState = .signingIn
        errorMessage = nil

        // 生成nonce用于安全验证（提前生成，失败时直接抛出）
        let nonce = try generateNonce()

        return try await withCheckedThrowingContinuation { continuation in
            self.continuation = continuation

            let appleIDProvider = ASAuthorizationAppleIDProvider()
            let request = appleIDProvider.createRequest()
            request.requestedScopes = [.fullName, .email]

            self.currentNonce = nonce
            request.nonce = sha256(nonce)

            let authorizationController = ASAuthorizationController(authorizationRequests: [request])
            authorizationController.delegate = self
            authorizationController.presentationContextProvider = self
            authorizationController.performRequests()
        }
    }

    /// 检查凭证状态
    /// - Parameter userID: Apple用户ID
    public func checkCredentialState(for userID: String) async throws -> ASAuthorizationAppleIDProvider.CredentialState {
        let appleIDProvider = ASAuthorizationAppleIDProvider()
        return try await appleIDProvider.credentialState(forUserID: userID)
    }

    /// 清除登录状态
    public func signOut() {
        authState = .signedOut
        currentNonce = nil
        errorMessage = nil
        Logger.info("Apple auth signed out")
    }

    // MARK: - Private Helpers

    /// 生成随机nonce字符串
    private func generateNonce(length: Int = 32) throws -> String {
        precondition(length > 0)
        let charset: [Character] =
            Array("0123456789ABCDEFGHIJKLMNOPQRSTUVXYZabcdefghijklmnopqrstuvwxyz-._")
        var result = ""
        var remainingLength = length

        while remainingLength > 0 {
            let randoms: [UInt8] = try (0 ..< 16).map { _ in
                var random: UInt8 = 0
                let errorCode = SecRandomCopyBytes(kSecRandomDefault, 1, &random)
                if errorCode != errSecSuccess {
                    throw AppleAuthError.nonceGenerationFailed
                }
                return random
            }

            randoms.forEach { random in
                if remainingLength == 0 {
                    return
                }

                if random < charset.count {
                    result.append(charset[Int(random)])
                    remainingLength -= 1
                }
            }
        }

        return result
    }

    /// SHA256哈希
    private func sha256(_ input: String) -> String {
        let inputData = Data(input.utf8)
        let hashedData = SHA256.hash(data: inputData)
        let hashString = hashedData.compactMap {
            String(format: "%02x", $0)
        }.joined()

        return hashString
    }
}

// MARK: - ASAuthorizationControllerDelegate

extension AppleAuthManager: ASAuthorizationControllerDelegate {

    public func authorizationController(controller: ASAuthorizationController, didCompleteWithAuthorization authorization: ASAuthorization) {

        guard let appleIDCredential = authorization.credential as? ASAuthorizationAppleIDCredential else {
            Logger.error("Invalid credential type")
            handleError(AppleAuthError.invalidCredential)
            return
        }

        guard let nonce = currentNonce else {
            Logger.error("Invalid state: nonce is nil")
            handleError(AppleAuthError.invalidState)
            return
        }

        guard let appleIDToken = appleIDCredential.identityToken,
              let idTokenString = String(data: appleIDToken, encoding: .utf8) else {
            Logger.error("Unable to fetch identity token")
            handleError(AppleAuthError.missingIdentityToken)
            return
        }

        // 构建结果
        let result = AppleAuthResult(
            userID: appleIDCredential.user,
            identityToken: idTokenString,
            authorizationCode: appleIDCredential.authorizationCode.flatMap { String(data: $0, encoding: .utf8) },
            email: appleIDCredential.email,
            fullName: appleIDCredential.fullName,
            nonce: nonce
        )

        Logger.info("Apple Sign In successful for user: \(result.userID)")

        authState = .signedIn
        continuation?.resume(returning: result)
        continuation = nil
    }

    public func authorizationController(controller: ASAuthorizationController, didCompleteWithError error: any Error) {
        Logger.error("Apple Sign In failed: \(error.localizedDescription)")

        let authError: AppleAuthError

        if let authorizationError = error as? ASAuthorizationError {
            switch authorizationError.code {
            case .canceled:
                authError = .userCanceled
            case .failed:
                authError = .authorizationFailed
            case .invalidResponse:
                authError = .invalidResponse
            case .notHandled:
                authError = .notHandled
            case .unknown:
                authError = .unknown
            default:
                authError = .unknown
            }
        } else {
            authError = .unknown
        }

        handleError(authError)
    }

    private func handleError(_ error: AppleAuthError) {
        authState = .failed
        errorMessage = error.localizedDescription
        continuation?.resume(throwing: error)
        continuation = nil
    }
}

// MARK: - ASAuthorizationControllerPresentationContextProviding

extension AppleAuthManager: ASAuthorizationControllerPresentationContextProviding {

    #if os(iOS)
    public func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        if let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
           let window = windowScene.windows.first {
            return window
        }
        Logger.warning("No window available for Apple Sign In presentation, using fallback")
        return UIWindow()
    }
    #elseif os(macOS)
    public func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        if let window = NSApplication.shared.windows.first {
            return window
        }
        Logger.warning("No window available for Apple Sign In presentation, using fallback")
        return NSWindow()
    }
    #endif
}

// MARK: - Supporting Types

/// Apple登录状态
public enum AppleAuthState {
    case signedOut
    case signingIn
    case signedIn
    case failed
}

/// Apple登录结果
public struct AppleAuthResult {
    public let userID: String
    public let identityToken: String
    public let authorizationCode: String?
    public let email: String?
    public let fullName: PersonNameComponents?
    public let nonce: String

    /// 获取显示名称
    public var displayName: String? {
        guard let fullName = fullName else { return nil }

        let formatter = PersonNameComponentsFormatter()
        formatter.style = .default
        return formatter.string(from: fullName)
    }
}

/// Apple登录错误
public enum AppleAuthError: LocalizedError {
    case userCanceled
    case authorizationFailed
    case invalidResponse
    case notHandled
    case unknown
    case invalidCredential
    case invalidState
    case missingIdentityToken
    case nonceGenerationFailed

    public var errorDescription: String? {
        switch self {
        case .userCanceled:
            return "用户取消了登录"
        case .authorizationFailed:
            return "授权失败"
        case .invalidResponse:
            return "无效的响应"
        case .notHandled:
            return "未处理的授权请求"
        case .unknown:
            return "未知错误"
        case .invalidCredential:
            return "无效的凭证"
        case .invalidState:
            return "无效的状态"
        case .missingIdentityToken:
            return "缺少身份令牌"
        case .nonceGenerationFailed:
            return "安全随机数生成失败"
        }
    }
}

// MARK: - SHA256 Helper

import CryptoKit

// SHA256 extension removed - use SHA256.hash(data:) directly from CryptoKit
