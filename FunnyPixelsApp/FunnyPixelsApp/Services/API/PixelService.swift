import Foundation

/// Pixel Service for handling pixel interactions (Like, Report, etc.)
public class PixelService {
    public static let shared = PixelService()
    
    private let api = APIManager.shared
    
    private init() {}
    
    /// Like a pixel
    public func likePixel(pixelId: String) async throws -> Bool {
        let _: String = try await api.requestWithSuccessResponse(endpoint: .likePixel(pixelId))
        return true
    }
    
    /// Unlike a pixel
    public func unlikePixel(pixelId: String) async throws -> Bool {
        let _: String = try await api.requestWithSuccessResponse(endpoint: .unlikePixel(pixelId))
        return true
    }
    
    /// Check like status
    public func checkLikeStatus(pixelId: String) async throws -> PixelLikeStatusResponse {
        return try await api.get("/pixels/\(pixelId)/like-status")
    }
    
    /// Report a pixel
    public func reportPixel(pixelId: String, reason: String, description: String? = nil) async throws -> Bool {
        let params: [String: Any] = [
            "targetId": pixelId,
            "targetType": "pixel",
            "reason": reason,
            "description": description ?? ""
        ]
        
        let _: String = try await api.requestWithSuccessResponse(
            endpoint: .reportPixel,
            parameters: params
        )
        return true
    }
}

public struct PixelLikeStatusResponse: Codable {
    public let liked: Bool
    public let likeCount: Int
}
