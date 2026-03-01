import Foundation

final class LocalizationAPIService {
    static let shared = LocalizationAPIService()
    private let apiManager = APIManager.shared

    private init() {}

    func fetchBundle(lang: String, version: Int?) async throws -> LocalizationBundleResponse {
        var params: [String: Any] = ["lang": lang]
        if let version = version {
            params["version"] = version
        }

        return try await apiManager.get("/v1/localization", parameters: params)
    }
}
