import Foundation
import GoogleSignIn
import Combine
#if canImport(UIKit)
import UIKit
#endif

/// Google登录管理器
@MainActor
public class GoogleAuthManager: ObservableObject {

    // MARK: - Singleton
    public static let shared = GoogleAuthManager()

    // MARK: - Published Properties
    @Published public private(set) var authState: GoogleAuthState = .signedOut
    @Published public private(set) var errorMessage: String?

    // MARK: - Initialization
    private init() {}

    // MARK: - Public Methods

    /// 发起Google登录
    public func signInWithGoogle() async throws -> GoogleAuthResult {
        Logger.info("Starting Sign in with Google")

        authState = .signingIn
        errorMessage = nil

        guard let presentingViewController = getRootViewController() else {
            let error = GoogleAuthError.noPresentingViewController
            authState = .failed
            errorMessage = error.localizedDescription
            throw error
        }

        do {
            let result = try await GIDSignIn.sharedInstance.signIn(withPresenting: presentingViewController)

            guard let idToken = result.user.idToken?.tokenString else {
                let error = GoogleAuthError.missingIDToken
                authState = .failed
                errorMessage = error.localizedDescription
                throw error
            }

            let fullName = result.user.profile?.name
            let email = result.user.profile?.email

            let authResult = GoogleAuthResult(
                idToken: idToken,
                fullName: fullName,
                email: email
            )

            Logger.info("Google Sign In successful, email: \(email ?? "nil")")
            authState = .signedIn
            return authResult

        } catch let error as GIDSignInError where error.code == .canceled {
            authState = .signedOut
            throw GoogleAuthError.userCanceled
        } catch {
            authState = .failed
            errorMessage = error.localizedDescription
            Logger.error("Google Sign In failed: \(error.localizedDescription)")
            throw GoogleAuthError.signInFailed(error)
        }
    }

    /// 清除登录状态
    public func signOut() {
        GIDSignIn.sharedInstance.signOut()
        authState = .signedOut
        errorMessage = nil
        Logger.info("Google auth signed out")
    }

    // MARK: - Private Helpers

    private func getRootViewController() -> UIViewController? {
        guard let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
              let window = windowScene.windows.first,
              let rootVC = window.rootViewController else {
            return nil
        }
        // Walk the presented chain to find the topmost VC
        var topVC = rootVC
        while let presented = topVC.presentedViewController {
            topVC = presented
        }
        return topVC
    }
}

// MARK: - Supporting Types

public enum GoogleAuthState {
    case signedOut
    case signingIn
    case signedIn
    case failed
}

public struct GoogleAuthResult {
    public let idToken: String
    public let fullName: String?
    public let email: String?
}

public enum GoogleAuthError: LocalizedError {
    case userCanceled
    case missingIDToken
    case noPresentingViewController
    case signInFailed(Error)

    public var errorDescription: String? {
        switch self {
        case .userCanceled:
            return "用户取消了登录"
        case .missingIDToken:
            return "无法获取 Google ID Token"
        case .noPresentingViewController:
            return "无法获取当前视图控制器"
        case .signInFailed(let error):
            return "Google 登录失败: \(error.localizedDescription)"
        }
    }
}
