import Foundation
import Combine
import SwiftUI

class ConfigService: ObservableObject {
    static let shared = ConfigService()
    
    @Published var shareDownloadUrl: String = "https://funnypixels.app" // Default backup
    
    private init() {
        fetchConfig()
    }
    
    func fetchConfig() {
        // Use AppEnvironment to get base URL if available, or fallback
        let baseURL = AppEnvironment.current.apiBaseURL
        guard let url = URL(string: "\(baseURL)/config/client") else { return }
        
        Task {
            do {
                let (data, _) = try await URLSession.shared.data(from: url)
                if let response = try? JSONDecoder().decode(ConfigResponse.self, from: data),
                   response.success {
                    await MainActor.run {
                        self.shareDownloadUrl = response.data.shareDownloadUrl
                        Logger.info("✅ Config fetched: shareUrl=\(self.shareDownloadUrl)")
                    }
                }
            } catch {
                Logger.warning("Failed to fetch config: \(error.localizedDescription)")
            }
        }
    }
}

struct ConfigResponse: Codable {
    let success: Bool
    let data: ConfigData
}

struct ConfigData: Codable {
    let shareDownloadUrl: String
}
