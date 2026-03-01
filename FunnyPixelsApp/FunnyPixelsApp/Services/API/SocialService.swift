import Foundation

/// Social Service for handling user relationships
public class SocialService {
    public static let shared = SocialService()
    
    private let api = APIManager.shared
    
    private init() {}
    
    /// Follow a user
    public func followUser(userId: String) async throws -> Bool {
        // Backend returns success message or status
        let _: String = try await api.requestWithSuccessResponse(endpoint: .followUser(userId))
        return true
    }
    
    /// Unfollow a user
    public func unfollowUser(userId: String) async throws -> Bool {
        let _: String = try await api.requestWithSuccessResponse(endpoint: .unfollowUser(userId))
        return true
    }
    
    /// Check follow status
    public func checkFollowStatus(userId: String) async throws -> FollowStatusResponse {
        return try await api.get("/social/follow-status/\(userId)")
    }
    
    // MARK: - Privacy
    
    /// Get current user's privacy settings
    public func getMyPrivacySettings() async throws -> PixelPrivacySettingsData {
        return try await api.requestWithStandardResponse(endpoint: .getPrivacySettings)
    }
    
    /// Update privacy settings
    public func updatePrivacySettings(settings: PixelPrivacySettings) async throws -> PixelPrivacySettings {
        let data = try JSONEncoder().encode(settings)
        let dict = try JSONSerialization.jsonObject(with: data) as? [String: Any]
        return try await api.requestWithStandardResponse(endpoint: .updatePrivacySettings, parameters: dict)
    }
    
    /// Get another user's privacy settings (for pixel card)
    public func getUserPrivacySettings(userId: String) async throws -> PixelPrivacySettings {
        let response: PixelPrivacySettingsData = try await api.requestWithStandardResponse(endpoint: .getPublicPrivacySettings(userId))
        return response.settings
    }

    // MARK: - Follow Lists

    /// Get user's following list
    public func getFollowing(userId: String) async throws -> [SocialUser] {
        let response: SocialUserListResponse = try await api.get("/social/following/\(userId)")
        return response.following ?? response.data ?? []
    }

    /// Get user's followers list
    public func getFollowers(userId: String) async throws -> [SocialUser] {
        let response: SocialUserListResponse = try await api.get("/social/followers/\(userId)")
        return response.followers ?? response.data ?? []
    }
}

// MARK: - Models

public struct PixelPrivacySettings: Codable, Equatable {
    public var hide_nickname: Bool
    public var hide_alliance: Bool
    public var hide_alliance_flag: Bool
    
    // Optional fields for update that might be partial?
    // Backend model has other fields like dm_receive_from, but user only cares about pixel privacy now.
    // We should probably include them to avoid data loss if PUT requires full object?
    // Backend updatePrivacySettings filters allowedFields. Partial update IS supported.
    // So distinct struct for Update is good, or just use this one with optionals?
    // But getMyPrivacySettings returns full object.
    
    public init(hide_nickname: Bool = false, hide_alliance: Bool = false, hide_alliance_flag: Bool = false) {
        self.hide_nickname = hide_nickname
        self.hide_alliance = hide_alliance
        self.hide_alliance_flag = hide_alliance_flag
    }
}

public struct PixelPrivacySettingsData: Codable {
    public let settings: PixelPrivacySettings
}

public struct FollowStatusResponse: Codable {
    public let isFollowing: Bool
    public let isFollower: Bool
}

public struct SocialUser: Codable, Identifiable {
    public let id: String
    public let username: String
    public let displayName: String?
    public let avatarUrl: String?
    public let avatar: String?
    public let motto: String?
    public let totalPixels: Int?
    public var isFollowing: Bool?
    public var isMutual: Bool?

    private enum CodingKeys: String, CodingKey {
        case id, username, motto, avatar
        case displayName = "display_name"
        case avatarUrl = "avatar_url"
        case totalPixels = "total_pixels"
        case isFollowing = "is_following"
        case isMutual = "is_mutual"
    }

    var displayOrUsername: String { displayName ?? username }
}

struct SocialUserListResponse: Codable {
    let success: Bool?
    let following: [SocialUser]?
    let followers: [SocialUser]?
    let data: [SocialUser]?
}
