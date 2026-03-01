import Foundation
import Alamofire

final class APIClient: @unchecked Sendable {
    let baseURL: String
    private var token: String?
    private let lock = NSLock()

    init(baseURL: String) {
        self.baseURL = baseURL
    }

    private func setToken(_ newToken: String) {
        lock.lock()
        defer { lock.unlock() }
        token = newToken
    }

    private func getToken() -> String? {
        lock.lock()
        defer { lock.unlock() }
        return token
    }

    // MARK: - Auth

    func login(email: String, password: String) async throws -> String {
        let url = "\(baseURL)/api/auth/login"
        let parameters: [String: Any] = [
            "email": email,
            "password": password
        ]

        return try await withCheckedThrowingContinuation { continuation in
            AF.request(url, method: .post, parameters: parameters, encoding: JSONEncoding.default)
                .validate()
                .responseData { response in
                    switch response.result {
                    case .success(let data):
                        // Try to decode
                        guard let loginResponse = try? JSONDecoder().decode(LoginResponse.self, from: data) else {
                            continuation.resume(throwing: APIError.loginFailed("Failed to decode response"))
                            return
                        }

                        if loginResponse.success, let token = loginResponse.tokens?.accessToken {
                            self.setToken(token)
                            continuation.resume(returning: token)
                        } else {
                            continuation.resume(throwing: APIError.loginFailed(loginResponse.message ?? "Unknown error"))
                        }
                    case .failure(let error):
                        continuation.resume(throwing: error)
                    }
                }
        }
    }

    // MARK: - Pixel Operations

    func drawPixel(latitude: Double, longitude: Double) async throws -> DrawPixelResult {
        let url = "\(baseURL)/api/pixel-draw/manual"
        let parameters: [String: Any] = [
            "latitude": latitude,
            "longitude": longitude
        ]

        guard let token = getToken() else {
            throw APIError.unauthorized
        }

        let headers: HTTPHeaders = [
            "Authorization": "Bearer \(token)"
        ]

        return try await withCheckedThrowingContinuation { continuation in
            AF.request(url, method: .post, parameters: parameters, encoding: JSONEncoding.default, headers: headers)
                .validate()
                .responseDecodable(of: DrawPixelResponse.self) { response in
                    switch response.result {
                    case .success(let drawResponse):
                        if drawResponse.success {
                            continuation.resume(returning: .success)
                        } else {
                            let message = drawResponse.message ?? ""
                            if message.contains("冻结") {
                                continuation.resume(returning: .frozen)
                            } else if message.contains("没有") || message.contains("不足") {
                                continuation.resume(returning: .noPoints)
                            } else {
                                continuation.resume(returning: .error(message, response.response?.statusCode))
                            }
                        }
                    case .failure(let error):
                        let statusCode = response.response?.statusCode ?? 0
                        if statusCode == 409 {
                            continuation.resume(returning: .conflict)
                        } else if statusCode == 401 {
                            continuation.resume(returning: .unauthorized)
                        } else {
                            continuation.resume(returning: .error(error.localizedDescription, statusCode))
                        }
                    }
                }
        }
    }

    // MARK: - Map Operations

    func getMVTTile(zoom: Int, x: Int, y: Int) async throws -> Data {
        let url = "\(baseURL)/api/tiles/pixels/\(zoom)/\(x)/\(y).pbf"

        return try await withCheckedThrowingContinuation { continuation in
            AF.request(url, method: .get)
                .validate()
                .responseData { response in
                    switch response.result {
                    case .success(let data):
                        continuation.resume(returning: data)
                    case .failure(let error):
                        continuation.resume(throwing: error)
                    }
                }
        }
    }

    // MARK: - Leaderboard

    func getPersonalLeaderboard(page: Int = 1) async throws -> LeaderboardData {
        let url = "\(baseURL)/api/leaderboard/personal"
        let parameters: [String: Int] = ["page": page]

        guard let token = getToken() else {
            throw APIError.unauthorized
        }

        let headers: HTTPHeaders = [
            "Authorization": "Bearer \(token)"
        ]

        return try await withCheckedThrowingContinuation { continuation in
            AF.request(url, method: .get, parameters: parameters, headers: headers)
                .validate()
                .responseDecodable(of: LeaderboardResponse.self) { response in
                    switch response.result {
                    case .success(let leaderboardResponse):
                        if leaderboardResponse.success, let data = leaderboardResponse.data {
                            continuation.resume(returning: data)
                        } else {
                            continuation.resume(throwing: APIError.serverError(leaderboardResponse.message ?? "Failed"))
                        }
                    case .failure(let error):
                        continuation.resume(throwing: error)
                    }
                }
        }
    }

    // MARK: - User Info

    func getAuthMe() async throws -> UserInfo {
        let url = "\(baseURL)/api/auth/me"

        guard let token = getToken() else {
            throw APIError.unauthorized
        }

        let headers: HTTPHeaders = [
            "Authorization": "Bearer \(token)"
        ]

        return try await withCheckedThrowingContinuation { continuation in
            AF.request(url, method: .get, headers: headers)
                .validate()
                .responseDecodable(of: AuthMeResponse.self) { response in
                    switch response.result {
                    case .success(let authMeResponse):
                        if authMeResponse.success, let user = authMeResponse.user {
                            continuation.resume(returning: user)
                        } else {
                            continuation.resume(throwing: APIError.serverError(authMeResponse.message ?? "Failed"))
                        }
                    case .failure(let error):
                        continuation.resume(throwing: error)
                    }
                }
        }
    }
}

// MARK: - Models

struct LoginResponse: Decodable {
    let success: Bool
    let message: String?
    let tokens: LoginTokens?

    struct LoginTokens: Decodable {
        let accessToken: String
    }
}

struct DrawPixelResponse: Decodable {
    let success: Bool
    let message: String?
}

enum DrawPixelResult {
    case success
    case conflict
    case frozen
    case noPoints
    case unauthorized
    case error(String, Int?)
}

struct LeaderboardResponse: Decodable {
    let success: Bool
    let message: String?
    let data: LeaderboardData?
}

struct LeaderboardData: Decodable {
    let data: [LeaderboardEntry]
}

struct LeaderboardEntry: Decodable {
    let userId: String
    let username: String
    let pixelCount: Int

    enum CodingKeys: String, CodingKey {
        case userId = "user_id"
        case username
        case pixelCount = "pixel_count"
    }
}

struct AuthMeResponse: Decodable {
    let success: Bool
    let message: String?
    let user: UserInfo?
}

struct UserInfo: Decodable {
    let id: String
    let username: String
    let email: String
}

enum APIError: Error {
    case unauthorized
    case loginFailed(String)
    case serverError(String)
}
