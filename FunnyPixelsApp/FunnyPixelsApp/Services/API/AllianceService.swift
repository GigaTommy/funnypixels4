import Foundation

/// 联盟服务
/// 负责处理联盟相关的API操作
class AllianceService {
    static let shared = AllianceService()

    private init() {}

    // MARK: - 数据模型

    /// 联盟模型
    struct Alliance: Codable, Identifiable {
        let id: Int
        let name: String
        let description: String?
        let notice: String? // Alliance Notification
        let color: String?
        let flagPatternId: String?
        let flagUnicodeChar: String?
        let flagRenderType: String?
        let flagPayload: String?
        let bannerUrl: String?
        let logoUrl: String?
        let leaderId: String
        let memberCount: Int
        let maxMembers: Int
        let isPublic: Bool
        let isActive: Bool?
        let approvalRequired: Bool
        let createdAt: String
        let updatedAt: String
        let flagUrl: String?
        var userRole: String? = nil
        let leaderName: String?

        // Alliance level system
        let level: Int?
        let levelName: String?
        let levelNameEn: String?
        let levelIcon: String?
        let experience: Int?
        let nextLevelExp: Int?
        let levelProgress: Double?
        let isMaxLevel: Bool?

        var displayName: String { name }

        private enum CodingKeys: String, CodingKey {
            case id, name, description, notice, color, level, experience
            case flagColor = "flag_color"
            case flagPatternId = "flag_pattern_id"
            case flagUnicodeChar = "flag_unicode_char"
            case flagRenderType = "flag_render_type"
            case flagPayload = "flag_payload"
            case bannerUrl = "banner_url"
            case logoUrl = "logo_url"
            case leaderId = "leader_id"
            case leaderName = "leader_name"
            case memberCount = "member_count"
            case maxMembers = "max_members"
            case isPublic = "is_public"
            case isActive = "is_active"
            case approvalRequired = "approval_required"
            case createdAt = "created_at"
            case updatedAt = "updated_at"
            case flagUrl = "flag_url"
            case userRole = "user_role"
            case levelName = "level_name"
            case levelNameEn = "level_name_en"
            case levelIcon = "level_icon"
            case nextLevelExp = "next_level_exp"
            case levelProgress = "level_progress"
            case isMaxLevel = "is_max_level"
        }

        init(from decoder: Decoder) throws {
            let container = try decoder.container(keyedBy: CodingKeys.self)
            id = try container.decode(Int.self, forKey: .id)
            name = try container.decode(String.self, forKey: .name)
            description = try? container.decodeIfPresent(String.self, forKey: .description)
            notice = try? container.decodeIfPresent(String.self, forKey: .notice)
            
            // Handle both color and flag_color - prioritize flagColor
            if let flagColorVal = try? container.decodeIfPresent(String.self, forKey: .flagColor), !flagColorVal.isEmpty {
                color = flagColorVal
            } else if let colorVal = try? container.decodeIfPresent(String.self, forKey: .color), !colorVal.isEmpty {
                color = colorVal
            } else {
                color = nil
            }
            
            flagPatternId = try? container.decodeIfPresent(String.self, forKey: .flagPatternId)
            flagUnicodeChar = try? container.decodeIfPresent(String.self, forKey: .flagUnicodeChar)
            flagRenderType = try? container.decodeIfPresent(String.self, forKey: .flagRenderType)
            flagPayload = try? container.decodeIfPresent(String.self, forKey: .flagPayload)
            bannerUrl = try? container.decodeIfPresent(String.self, forKey: .bannerUrl)
            logoUrl = try? container.decodeIfPresent(String.self, forKey: .logoUrl)
            leaderId = try container.decode(String.self, forKey: .leaderId)
            memberCount = try container.decode(Int.self, forKey: .memberCount)
            maxMembers = try container.decode(Int.self, forKey: .maxMembers)
            isPublic = try container.decode(Bool.self, forKey: .isPublic)
            isActive = try? container.decodeIfPresent(Bool.self, forKey: .isActive)
            approvalRequired = try container.decode(Bool.self, forKey: .approvalRequired)
            createdAt = try container.decode(String.self, forKey: .createdAt)
            updatedAt = try container.decode(String.self, forKey: .updatedAt)
            flagUrl = try? container.decodeIfPresent(String.self, forKey: .flagUrl)
            userRole = try? container.decodeIfPresent(String.self, forKey: .userRole)
            leaderName = try? container.decodeIfPresent(String.self, forKey: .leaderName)
            level = try? container.decodeIfPresent(Int.self, forKey: .level)
            levelName = try? container.decodeIfPresent(String.self, forKey: .levelName)
            levelNameEn = try? container.decodeIfPresent(String.self, forKey: .levelNameEn)
            levelIcon = try? container.decodeIfPresent(String.self, forKey: .levelIcon)
            experience = try? container.decodeIfPresent(Int.self, forKey: .experience)
            nextLevelExp = try? container.decodeIfPresent(Int.self, forKey: .nextLevelExp)
            levelProgress = try? container.decodeIfPresent(Double.self, forKey: .levelProgress)
            isMaxLevel = try? container.decodeIfPresent(Bool.self, forKey: .isMaxLevel)
        }

        func encode(to encoder: Encoder) throws {
            var container = encoder.container(keyedBy: CodingKeys.self)
            try container.encode(id, forKey: .id)
            try container.encode(name, forKey: .name)
            try container.encodeIfPresent(description, forKey: .description)
            try container.encodeIfPresent(notice, forKey: .notice)
            try container.encodeIfPresent(color, forKey: .color)
            try container.encodeIfPresent(flagPatternId, forKey: .flagPatternId)
            try container.encodeIfPresent(flagUnicodeChar, forKey: .flagUnicodeChar)
            try container.encodeIfPresent(flagRenderType, forKey: .flagRenderType)
            try container.encodeIfPresent(flagPayload, forKey: .flagPayload)
            try container.encodeIfPresent(bannerUrl, forKey: .bannerUrl)
            try container.encodeIfPresent(logoUrl, forKey: .logoUrl)
            try container.encode(leaderId, forKey: .leaderId)
            try container.encode(memberCount, forKey: .memberCount)
            try container.encode(maxMembers, forKey: .maxMembers)
            try container.encode(isPublic, forKey: .isPublic)
            try container.encodeIfPresent(isActive, forKey: .isActive)
            try container.encode(approvalRequired, forKey: .approvalRequired)
            try container.encode(createdAt, forKey: .createdAt)
            try container.encode(updatedAt, forKey: .updatedAt)
            try container.encodeIfPresent(userRole, forKey: .userRole)
            try container.encodeIfPresent(leaderName, forKey: .leaderName)
            try container.encodeIfPresent(level, forKey: .level)
            try container.encodeIfPresent(levelName, forKey: .levelName)
            try container.encodeIfPresent(levelNameEn, forKey: .levelNameEn)
            try container.encodeIfPresent(levelIcon, forKey: .levelIcon)
            try container.encodeIfPresent(experience, forKey: .experience)
            try container.encodeIfPresent(nextLevelExp, forKey: .nextLevelExp)
            try container.encodeIfPresent(levelProgress, forKey: .levelProgress)
            try container.encodeIfPresent(isMaxLevel, forKey: .isMaxLevel)
        }
    }

    /// 联盟成员模型
    struct AllianceMember: Codable, Identifiable {
        let id: String
        let username: String
        let avatarUrl: String?
        let role: String
        let joinedAt: String
        let lastActiveAt: String?
        let totalPixels: Int?
        let currentPixels: Int?

        var displayName: String { username }

        private enum CodingKeys: String, CodingKey {
            case id, username, role
            case avatarUrl = "avatar_url"
            case joinedAt = "joined_at"
            case lastActiveAt = "last_active_at"
            case totalPixels = "total_pixels"
            case currentPixels = "current_pixels"
        }
    }

    /// 联盟申请模型
    struct AllianceApplication: Codable, Identifiable {
        let id: Int
        let userId: String
        let username: String
        let avatarUrl: String?
        let totalPixels: Int?
        let currentPixels: Int?
        let message: String?
        let status: String
        let createdAt: String
        let reviewedAt: String?
        let reviewMessage: String?

        private enum CodingKeys: String, CodingKey {
            case id
            case userId = "user_id"
            case username
            case avatarUrl = "avatar_url"
            case totalPixels = "total_pixels"
            case currentPixels = "current_pixels"
            case message, status
            case createdAt = "created_at"
            case reviewedAt = "reviewed_at"
            case reviewMessage = "review_message"
        }
    }

    /// 联盟统计模型
    struct AllianceStats: Codable {
        let totalPixels: Int
        let currentPixels: Int
        let memberCount: Int
        let territory: Int
        let rank: Int?
        let dataSource: String?
        let comparison: ComparisonStats?

        private enum CodingKeys: String, CodingKey {
            case totalPixels = "totalPixels"
            case currentPixels = "currentPixels"
            case memberCount = "memberCount"
            case territory, rank
            case dataSource = "data_source"
            case comparison
        }
    }

    /// 对比统计
    struct ComparisonStats: Codable {
        let originalTotalPixels: Int
        let originalCurrentPixels: Int
        let proposedPixelsDelta: Int
        let proposedOwnershipDelta: Int

        private enum CodingKeys: String, CodingKey {
            case originalTotalPixels = "originalTotalPixels"
            case originalCurrentPixels = "originalCurrentPixels"
            case proposedPixelsDelta = "proposedPixelsDelta"
            case proposedOwnershipDelta = "proposedOwnershipDelta"
        }
    }

    /// 旗帜图案模型
    struct FlagPattern: Codable, Identifiable, Equatable {
        let id: Int
        let patternId: String?
        let key: String?
        let name: String
        let description: String?
        let category: String?
        let renderType: String?
        let unicodeChar: String?
        let color: String?  // 直接的颜色值，例如 "#FF0000"
        let width: Int?
        let height: Int?
        let payload: String?
        let encoding: String?
        let isOwned: Bool
        let isFree: Bool
        let price: Int?

        var displayName: String { name }

        private enum CodingKeys: String, CodingKey {
            case id, name, description, category, key, color
            case flagColor = "flag_color"
            case patternId = "pattern_id"
            case renderType = "render_type"
            case unicodeChar = "unicode_char"
            case width, height, payload, encoding
            case isOwned = "is_owned"
            case isFree = "is_free"
            case price
        }

        init(from decoder: Decoder) throws {
            let container = try decoder.container(keyedBy: CodingKeys.self)
            id = try container.decode(Int.self, forKey: .id)
            name = try container.decode(String.self, forKey: .name)
            description = try? container.decodeIfPresent(String.self, forKey: .description)
            category = try? container.decodeIfPresent(String.self, forKey: .category)
            key = try? container.decodeIfPresent(String.self, forKey: .key)
            
            // Handle both color and flag_color - prioritize flagColor
            if let flagColorVal = try? container.decodeIfPresent(String.self, forKey: .flagColor), !flagColorVal.isEmpty {
                color = flagColorVal
            } else if let colorVal = try? container.decodeIfPresent(String.self, forKey: .color), !colorVal.isEmpty {
                color = colorVal
            } else {
                color = nil
            }
            
            patternId = try? container.decodeIfPresent(String.self, forKey: .patternId)
            renderType = try? container.decodeIfPresent(String.self, forKey: .renderType)
            unicodeChar = try? container.decodeIfPresent(String.self, forKey: .unicodeChar)
            width = try? container.decodeIfPresent(Int.self, forKey: .width)
            height = try? container.decodeIfPresent(Int.self, forKey: .height)
            payload = try? container.decodeIfPresent(String.self, forKey: .payload)
            encoding = try? container.decodeIfPresent(String.self, forKey: .encoding)
            isOwned = try container.decodeIfPresent(Bool.self, forKey: .isOwned) ?? false
            isFree = try container.decodeIfPresent(Bool.self, forKey: .isFree) ?? false
            price = try? container.decodeIfPresent(Int.self, forKey: .price)
        }

        func encode(to encoder: Encoder) throws {
            var container = encoder.container(keyedBy: CodingKeys.self)
            try container.encode(id, forKey: .id)
            try container.encode(name, forKey: .name)
            try container.encodeIfPresent(description, forKey: .description)
            try container.encodeIfPresent(category, forKey: .category)
            try container.encodeIfPresent(key, forKey: .key)
            try container.encodeIfPresent(color, forKey: .color)
            try container.encodeIfPresent(patternId, forKey: .patternId)
            try container.encodeIfPresent(renderType, forKey: .renderType)
            try container.encodeIfPresent(unicodeChar, forKey: .unicodeChar)
            try container.encodeIfPresent(width, forKey: .width)
            try container.encodeIfPresent(height, forKey: .height)
            try container.encodeIfPresent(payload, forKey: .payload)
            try container.encodeIfPresent(encoding, forKey: .encoding)
            try container.encode(isOwned, forKey: .isOwned)
            try container.encode(isFree, forKey: .isFree)
            try container.encodeIfPresent(price, forKey: .price)
        }
    }

    /// 旗帜图案分类响应
    struct FlagPatternsResponse: Codable {
        let success: Bool
        let patterns: PatternCategories
        let total: Int?

        struct PatternCategories: Codable, Equatable {
            let colors: [FlagPattern]
            let emojis: [FlagPattern]
            let complex: [FlagPattern]
        }
    }

    /// 邀请链接模型
    struct InviteLink: Codable, Identifiable {
        let id: String
        let inviteCode: String
        let createdAt: String
        let expiresAt: String
        let isActive: Bool
        let usedBy: String?
        let usedAt: String?

        var inviteUrl: String {
            return "funnypixels://alliance/join?code=\(inviteCode)"
        }

        private enum CodingKeys: String, CodingKey {
            case id
            case inviteCode = "invite_code"
            case createdAt = "created_at"
            case expiresAt = "expires_at"
            case isActive = "is_active"
            case usedBy = "used_by"
            case usedAt = "used_at"
        }
    }

    /// 联盟详情响应
    struct AllianceDetailResponse: Codable {
        let success: Bool
        let alliance: Alliance
        let members: [AllianceMember]?
    }

    /// 成员列表响应
    struct MembersResponse: Codable {
        let success: Bool
        let members: [AllianceMember]
    }

    /// 申请列表响应
    struct ApplicationsResponse: Codable {
        let success: Bool
        let applications: [AllianceApplication]
    }

    /// 统计响应
    struct StatsResponse: Codable {
        let success: Bool
        let stats: AllianceStats
    }

    /// 邀请链接响应
    struct InviteLinkResponse: Codable {
        let success: Bool
        let message: String
        let data: InviteLinkData?

        struct InviteLinkData: Codable {
            let inviteLink: String
            let inviteCode: String
            let expiresAt: String
            let allianceName: String

            private enum CodingKeys: String, CodingKey {
                case inviteLink = "invite_link"
                case inviteCode = "invite_code"
                case expiresAt = "expires_at"
                case allianceName = "alliance_name"
            }
        }
    }

    /// 邀请链接列表响应
    struct InviteLinksResponse: Codable {
        let success: Bool
        let data: InviteLinksData?

        struct InviteLinksData: Codable {
            let invites: [InviteLink]
        }
    }

    // MARK: - API方法

    /// 创建联盟
    func createAlliance(
        name: String,
        description: String? = nil,
        flagPatternId: String,
        isPublic: Bool = true,
        approvalRequired: Bool = true
    ) async throws -> Alliance {
        let path = "/alliances"

        var body: [String: Any] = [
            "name": name,
            "flag_pattern_id": flagPatternId,
            "is_public": isPublic,
            "approval_required": approvalRequired
        ]

        if let description = description {
            body["description"] = description
        }

        let response: AllianceCreateResponse = try await APIManager.shared.post(path, parameters: body)

        guard response.success, let alliance = response.alliance else {
            throw NetworkError.serverError(response.message ?? "Failed to create alliance")
        }

        return alliance
    }

    /// 搜索联盟
    func searchAlliances(query: String, limit: Int = 20, offset: Int = 0) async throws -> [Alliance] {
        var path = "/alliances/search?q=\(query.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? "")"
        path += "&limit=\(limit)&offset=\(offset)"

        let response: AlliancesSearchResponse = try await APIManager.shared.get(path)

        guard response.success else {
            throw NetworkError.serverError("Failed to search alliances")
        }

        return response.alliances
    }

    /// 获取用户所属联盟
    func getUserAlliance() async throws -> Alliance? {
        let path = "/alliances/user/alliance"

        let response: UserAllianceResponse = try await APIManager.shared.get(path)

        guard response.success else {
            throw NetworkError.serverError("Failed to load alliance info")
        }

        return response.alliance
    }

    /// 获取用户所加入的所有联盟
    func fetchUserAlliances() async throws -> [Alliance] {
        let path = "/alliances/user/alliances"

        let response: UserAlliancesResponse = try await APIManager.shared.get(path)

        // Check success if present, otherwise assume success if we got a response without error status
        if let success = response.success, !success {
            throw NetworkError.serverError("Failed to load alliances")
        }

        return response.alliances ?? []
    }

    /// 获取用户联盟颜色
    func getUserAllianceColor() async throws -> String {
        let path = "/alliances/user/color"

        let response: AllianceColorResponse = try await APIManager.shared.get(path)

        guard response.success, let color = response.color else {
            throw NetworkError.serverError("Failed to load alliance color")
        }

        return color
    }

    /// 获取用户联盟旗帜信息
    func getUserAllianceFlag() async throws -> FlagInfo {
        let path = "/alliances/user/flag"

        do {
            let response: AllianceFlagResponse = try await APIManager.shared.get(path)

            guard response.success != false, let flag = response.flag else {
                Logger.warning("⚠️ AllianceService: getUserAllianceFlag response success is false or flag is nil")
                throw NetworkError.serverError("Failed to load alliance flag")
            }

            return flag
        } catch {
            Logger.error("❌ AllianceService: getUserAllianceFlag failed to decode/fetch: \(error)")
            throw error
        }
    }

    /// 获取可用的旗帜图案
    func getFlagPatterns() async throws -> FlagPatternsResponse.PatternCategories {
        let path = "/alliances/flag-patterns"

        let response: FlagPatternsResponse = try await APIManager.shared.get(path)

        guard response.success else {
            throw NetworkError.serverError("Failed to load flag patterns")
        }

        return response.patterns
    }

    /// 获取联盟详情
    func getAllianceDetail(id: Int) async throws -> (alliance: Alliance, members: [AllianceMember]?) {
        let path = "/alliances/\(id)"

        let response: AllianceDetailResponse = try await APIManager.shared.get(path)

        guard response.success else {
            throw NetworkError.serverError("Failed to load alliance details")
        }

        return (response.alliance, response.members)
    }

    /// 获取联盟成员列表
    func getAllianceMembers(id: Int) async throws -> [AllianceMember] {
        let path = "/alliances/\(id)/members"

        let response: MembersResponse = try await APIManager.shared.get(path)

        guard response.success else {
            throw NetworkError.serverError("Failed to load members")
        }

        return response.members
    }

    /// 获取联盟统计
    func getAllianceStats(id: Int) async throws -> AllianceStats {
        let path = "/alliances/\(id)/stats"

        let response: StatsResponse = try await APIManager.shared.get(path)

        guard response.success else {
            throw NetworkError.serverError("Failed to load alliance stats")
        }

        return response.stats
    }

    /// 申请加入联盟
    func applyToAlliance(id: Int, message: String? = nil) async throws -> String {
        let path = "/alliances/\(id)/apply"

        var body: [String: Any] = [:]
        if let message = message {
            body["message"] = message
        }

        let response: MessageResponse = try await APIManager.shared.post(path, parameters: body)

        guard response.success, let message = response.message else {
            throw NetworkError.serverError(response.message ?? "Failed to apply")
        }

        return message
    }

    /// 获取联盟申请列表
    func getAllianceApplications(id: Int) async throws -> [AllianceApplication] {
        let path = "/alliances/\(id)/applications"

        let response: ApplicationsResponse = try await APIManager.shared.get(path)

        guard response.success else {
            throw NetworkError.serverError("Failed to load applications")
        }

        return response.applications
    }

    /// 审批联盟申请
    func reviewApplication(
        allianceId: Int,
        applicationId: Int,
        action: String,
        message: String? = nil
    ) async throws -> String {
        let path = "/alliances/\(allianceId)/review-application"

        var body: [String: Any] = [
            "application_id": applicationId,
            "action": action
        ]

        if let message = message {
            body["message"] = message
        }

        let response: MessageResponse = try await APIManager.shared.post(path, parameters: body)

        guard response.success, let message = response.message else {
            throw NetworkError.serverError(response.message ?? "Failed to review application")
        }

        return message
    }

    /// 更新成员角色
    func updateMemberRole(allianceId: Int, memberId: String, role: String) async throws -> String {
        let path = "/alliances/\(allianceId)/update-member-role"

        let body: [String: Any] = [
            "member_id": memberId,
            "role": role
        ]

        let response: MessageResponse = try await APIManager.shared.post(path, parameters: body)

        guard response.success, let message = response.message else {
            throw NetworkError.serverError("Failed to update role")
        }

        return message
    }

    /// 踢出成员
    func kickMember(allianceId: Int, memberId: String) async throws -> String {
        let path = "/alliances/\(allianceId)/kick-member"

        let body: [String: Any] = [
            "member_id": memberId
        ]

        let response: MessageResponse = try await APIManager.shared.post(path, parameters: body)

        guard response.success, let message = response.message else {
            throw NetworkError.serverError(response.message ?? "Failed to kick member")
        }

        return message
    }

    /// 转让盟主
    func transferLeadership(allianceId: Int, newLeaderId: String) async throws -> String {
        let path = "/alliances/\(allianceId)/transfer-leadership"

        let body: [String: Any] = [
            "new_leader_id": newLeaderId
        ]

        let response: MessageResponse = try await APIManager.shared.post(path, parameters: body)

        guard response.success, let message = response.message else {
            throw NetworkError.serverError(response.message ?? "Failed to transfer leadership")
        }

        return message
    }

    /// 退出联盟
    func leaveAlliance(allianceId: Int) async throws -> String {
        let path = "/alliances/\(allianceId)/leave"

        let response: MessageResponse = try await APIManager.shared.post(path, parameters: [:])

        guard response.success, let message = response.message else {
            throw NetworkError.serverError(response.message ?? "Failed to leave alliance")
        }

        return message
    }

    /// 更新联盟信息
    func updateAlliance(
        id: Int,
        name: String? = nil,
        description: String? = nil,
        notice: String? = nil,
        color: String? = nil,
        bannerUrl: String? = nil,
        flagPatternId: String? = nil,
        isPublic: Bool? = nil,
        approvalRequired: Bool? = nil
    ) async throws -> Alliance {
        let path = "/alliances/\(id)"

        var body: [String: Any] = [:]
        if let name = name { body["name"] = name }
        if let description = description { body["description"] = description }
        if let notice = notice { body["notice"] = notice }
        if let color = color { body["color"] = color }
        if let bannerUrl = bannerUrl { body["banner_url"] = bannerUrl }
        if let flagPatternId = flagPatternId { body["flag_pattern_id"] = flagPatternId }
        if let isPublic = isPublic { body["is_public"] = isPublic }
        if let approvalRequired = approvalRequired { body["approval_required"] = approvalRequired }

        let response: AllianceUpdateResponse = try await APIManager.shared.put(path, parameters: body)

        guard response.success, let alliance = response.alliance else {
            throw NetworkError.serverError(response.message ?? "Failed to update alliance")
        }

        return alliance
    }

    /// 解散联盟
    func dissolveAlliance(id: Int) async throws -> String {
        let path = "/alliances/\(id)"

        let response: MessageResponse = try await APIManager.shared.delete(path)

        guard response.success, let message = response.message else {
            throw NetworkError.serverError(response.message ?? "Failed to dissolve alliance")
        }

        return message
    }

    /// 生成邀请链接
    func generateInviteLink(allianceId: Int) async throws -> (inviteLink: String, inviteCode: String, expiresAt: String, allianceName: String) {
        let path = "/alliances/\(allianceId)/invite"

        let response: InviteLinkResponse = try await APIManager.shared.post(path, parameters: [:])

        guard response.success, let data = response.data else {
            throw NetworkError.serverError(response.message)
        }

        return (data.inviteLink, data.inviteCode, data.expiresAt, data.allianceName)
    }

    /// 通过邀请码加入
    func joinByInvite(inviteCode: String) async throws -> Alliance {
        let path = "/alliances/join-by-invite"

        let body: [String: Any] = [
            "inviteCode": inviteCode
        ]

        let response: JoinByInviteResponse = try await APIManager.shared.post(path, parameters: body)

        guard response.success, let data = response.data, let alliance = data.alliance else {
            throw NetworkError.serverError(response.message ?? "Failed to join alliance")
        }

        return alliance
    }

    /// 获取邀请链接列表
    func getInviteLinks(allianceId: Int) async throws -> [InviteLink] {
        let path = "/alliances/\(allianceId)/invites"

        let response: InviteLinksResponse = try await APIManager.shared.get(path)

        guard response.success, let data = response.data else {
            throw NetworkError.serverError("Failed to load invite links")
        }

        return data.invites
    }

    /// 删除邀请链接
    func deleteInviteLink(allianceId: Int, inviteId: String) async throws -> String {
        let path = "/alliances/\(allianceId)/invites/\(inviteId)"

        let response: MessageResponse = try await APIManager.shared.delete(path)

        guard response.success, let message = response.message else {
            throw NetworkError.serverError(response.message ?? "Failed to delete invite link")
        }

        return message
    }

    // MARK: - 贡献排行模型

    struct ContributionEntry: Codable, Identifiable {
        let rank: Int
        let userId: String
        let username: String
        let displayName: String?
        let avatarUrl: String?
        let avatar: String?
        let totalPixels: Int
        let role: String
        let joinedAt: String
        let checkinCount: Int
        let isCurrentUser: Bool

        var id: String { userId }

        private enum CodingKeys: String, CodingKey {
            case rank
            case userId = "user_id"
            case username
            case displayName = "display_name"
            case avatarUrl = "avatar_url"
            case avatar
            case totalPixels = "total_pixels"
            case role
            case joinedAt = "joined_at"
            case checkinCount = "checkin_count"
            case isCurrentUser = "is_current_user"
        }
    }

    struct ContributionsResponse: Codable {
        let success: Bool
        let data: [ContributionEntry]?
    }

    /// 获取联盟贡献排行
    func getMemberContributions(allianceId: Int, limit: Int = 10) async throws -> [ContributionEntry] {
        let path = "/alliances/\(allianceId)/contributions?limit=\(limit)"
        let response: ContributionsResponse = try await APIManager.shared.get(path)
        guard response.success, let data = response.data else {
            throw NetworkError.serverError("Failed to load contributions")
        }
        return data
    }

    // MARK: - 签到相关模型

    struct CheckinStatusResponse: Codable {
        let success: Bool
        let data: CheckinStatusData?
    }

    struct CheckinStatusData: Codable {
        let hasCheckedIn: Bool
        let streak: Int
        let todayCount: Int
        let checkedInMembers: [CheckinMember]

        private enum CodingKeys: String, CodingKey {
            case hasCheckedIn = "has_checked_in"
            case streak
            case todayCount = "today_count"
            case checkedInMembers = "checked_in_members"
        }
    }

    struct CheckinMember: Codable, Identifiable {
        let userId: String
        let username: String
        let displayName: String?
        let avatarUrl: String?
        let avatar: String?
        let checkinTime: String

        var id: String { userId }

        private enum CodingKeys: String, CodingKey {
            case userId = "user_id"
            case username
            case displayName = "display_name"
            case avatarUrl = "avatar_url"
            case avatar
            case checkinTime = "checkin_time"
        }
    }

    struct CheckinResponse: Codable {
        let success: Bool
        let message: String?
        let data: CheckinResultData?
    }

    struct CheckinResultData: Codable {
        let expEarned: Int
        let todayCheckins: Int
        let allianceLevel: Int
        let allianceExperience: Int
        let levelProgress: Double

        private enum CodingKeys: String, CodingKey {
            case expEarned = "exp_earned"
            case todayCheckins = "today_checkins"
            case allianceLevel = "alliance_level"
            case allianceExperience = "alliance_experience"
            case levelProgress = "level_progress"
        }
    }

    // MARK: - 签到API

    /// 联盟签到
    func checkin(allianceId: Int) async throws -> CheckinResultData {
        let path = "/alliances/\(allianceId)/checkin"
        let response: CheckinResponse = try await APIManager.shared.post(path, parameters: [:])
        guard response.success, let data = response.data else {
            throw NetworkError.serverError(response.message ?? "Failed to check in")
        }
        return data
    }

    /// 获取签到状态
    func getCheckinStatus(allianceId: Int) async throws -> CheckinStatusData {
        let path = "/alliances/\(allianceId)/checkin-status"
        let response: CheckinStatusResponse = try await APIManager.shared.get(path)
        guard response.success, let data = response.data else {
            throw NetworkError.serverError("Failed to load check-in status")
        }
        return data
    }

    // MARK: - Activity Log

    struct ActivityLogEntry: Codable, Identifiable {
        let id: Int
        let userId: String?
        let username: String?
        let actionType: String
        let detail: String?
        let createdAt: String

        private enum CodingKeys: String, CodingKey {
            case id
            case userId = "user_id"
            case username
            case actionType = "action_type"
            case detail
            case createdAt = "created_at"
        }
    }

    struct ActivityLogResponse: Codable {
        let success: Bool
        let data: [ActivityLogEntry]?
    }

    func getActivityLog(allianceId: Int, limit: Int = 20, offset: Int = 0) async throws -> [ActivityLogEntry] {
        let path = "/alliances/\(allianceId)/activity-log?limit=\(limit)&offset=\(offset)"
        let response: ActivityLogResponse = try await APIManager.shared.get(path)
        guard response.success, let data = response.data else {
            throw NetworkError.serverError("Failed to load activity log")
        }
        return data
    }

    // MARK: - 辅助响应类型

    private struct AllianceCreateResponse: Codable {
        let success: Bool
        let message: String?
        let alliance: Alliance?
    }

    private struct AllianceUpdateResponse: Codable {
        let success: Bool
        let message: String?
        let alliance: Alliance?
    }

    private struct AlliancesSearchResponse: Codable {
        let success: Bool
        let alliances: [Alliance]
        let pagination: PaginationInfo?

        struct PaginationInfo: Codable {
            let limit: Int
            let offset: Int
            let total: Int
        }
    }

    private struct UserAllianceResponse: Codable {
        let success: Bool
        let alliance: Alliance?
    }

    private struct UserAlliancesResponse: Codable {
        let success: Bool?
        let alliances: [Alliance]?
    }

    private struct AllianceColorResponse: Codable {
        let success: Bool
        let color: String?
    }

    private struct AllianceFlagResponse: Codable {
        let success: Bool?
        let flag: FlagInfo?
    }

    struct FlagInfo: Codable {
        let patternId: String
        let unicodeChar: String?
        let renderType: String
        let payload: String?
        let width: Int?
        let height: Int?
        let encoding: String?
        let anchorX: Int?
        let anchorY: Int?
        let rotation: Int?
        let mirror: Bool?
        let patternInfo: FlagPattern?

        private enum CodingKeys: String, CodingKey {
            case patternId = "pattern_id"
            case unicodeChar = "unicode_char"
            case renderType = "render_type"
            case payload
            case width, height
            case encoding
            case anchorX = "anchor_x"
            case anchorY = "anchor_y"
            case rotation, mirror
            case patternInfo = "pattern_info"
        }
    }

    private struct MessageResponse: Codable {
        let success: Bool
        let message: String?
    }

    private struct JoinByInviteResponse: Codable {
        let success: Bool
        let message: String?
        let data: JoinData?

        struct JoinData: Codable {
            let alliance: Alliance?
        }
    }
}
