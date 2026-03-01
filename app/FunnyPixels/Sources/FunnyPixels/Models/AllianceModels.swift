import Foundation

// MARK: - Alliance Models

/// 联盟模型
struct Alliance: Codable, Identifiable {
    let id: String
    let name: String
    let description: String?
    let flagColor: String
    let flagPatternId: String?
    let leaderId: String
    let memberCount: Int
    let maxMembers: Int?
    let isPublic: Bool
    let approvalRequired: Bool
    let isActive: Bool
    let createdAt: String
    let updatedAt: String
    let userRole: AllianceRole?
    let leaderName: String?

    enum CodingKeys: String, CodingKey {
        case id, name, description
        case flagColor = "flag_color"
        case flagPatternId = "flag_pattern_id"
        case leaderId = "leader_id"
        case memberCount = "member_count"
        case maxMembers = "max_members"
        case isPublic = "is_public"
        case approvalRequired = "approval_required"
        case isActive = "is_active"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
        case userRole = "user_role"
        case leaderName = "leader_name"
    }

    /// 计算属性：角色显示名称
    var roleDisplayName: String {
        guard let role = userRole else { return "" }
        return role.displayName
    }
}

/// 联盟角色
enum AllianceRole: String, Codable, CaseIterable {
    case leader = "leader"
    case admin = "admin"
    case member = "member"

    var displayName: String {
        switch self {
        case .leader: return "盟主"
        case .admin: return "管理员"
        case .member: return "成员"
        }
    }

    var permissions: AlliancePermissions {
        switch self {
        case .leader:
            return AlliancePermissions(canInvite: true, canKick: true, canEdit: true, canDisband: true, canManageRoles: true)
        case .admin:
            return AlliancePermissions(canInvite: true, canKick: true, canEdit: false, canDisband: false, canManageRoles: false)
        case .member:
            return AlliancePermissions(canInvite: false, canKick: false, canEdit: false, canDisband: false, canManageRoles: false)
        }
    }
}

/// 联盟权限
struct AlliancePermissions {
    let canInvite: Bool
    let canKick: Bool
    let canEdit: Bool
    let canDisband: Bool
    let canManageRoles: Bool
}

/// 联盟成员
struct AllianceMember: Codable, Identifiable {
    let id: String
    let userId: String
    let allianceId: String
    let username: String
    let avatar: String?
    let role: AllianceRole
    let contributionPoints: Int
    let isOnline: Bool
    let joinedAt: String
    let lastActive: String?

    enum CodingKeys: String, CodingKey {
        case id, userId, allianceId, username, avatar, role
        case contributionPoints = "contribution_points"
        case isOnline = "is_online"
        case joinedAt = "joined_at"
        case lastActive = "last_active"
    }

    /// 计算属性：角色显示名称
    var roleDisplayName: String {
        return role.displayName
    }
}

/// 联盟申请
struct AllianceApplication: Codable, Identifiable {
    let id: String
    let allianceId: String
    let userId: String
    let username: String
    let avatar: String?
    let message: String?
    let status: ApplicationStatus
    let createdAt: String
    let updatedAt: String

    enum CodingKeys: String, CodingKey {
        case id, allianceId, userId, username, avatar, message, status
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }

    /// 申请状态
    enum ApplicationStatus: String, Codable, CaseIterable {
        case pending = "pending"
        case approved = "approved"
        case rejected = "rejected"

        var displayName: String {
            switch self {
            case .pending: return "待审核"
            case .approved: return "已通过"
            case .rejected: return "已拒绝"
            }
        }

        var color: String {
            switch self {
            case .pending: return "#FFA500" // 橙色
            case .approved: return "#00FF00" // 绿色
            case .rejected: return "#FF0000" // 红色
            }
        }
    }

    /// 计算属性：状态显示名称
    var statusDisplayName: String {
        return status.displayName
    }
}

/// 联盟邀请链接
struct AllianceInviteLink: Codable, Identifiable {
    let id: String
    let allianceId: String
    let code: String
    let createdBy: String
    let createdByName: String?
    let expiresAt: String
    let isActive: Bool
    let maxUses: Int?
    let currentUses: Int
    let createdAt: String

    enum CodingKeys: String, CodingKey {
        case id, allianceId, code, isActive
        case createdBy = "created_by"
        case createdByName = "created_by_name"
        case expiresAt = "expires_at"
        case maxUses = "max_uses"
        case currentUses = "current_uses"
        case createdAt = "created_at"
    }

    /// 计算属性：是否已过期
    var isExpired: Bool {
        guard let expirationDate = ISO8601DateFormatter().date(from: expiresAt) else {
            return true
        }
        return expirationDate < Date()
    }

    /// 计算属性：是否已达到使用上限
    var isMaxUsesReached: Bool {
        guard let maxUses = maxUses else { return false }
        return currentUses >= maxUses
    }

    /// 计算属性：链接是否有效
    var isValid: Bool {
        return isActive && !isExpired && !isMaxUsesReached
    }

    /// 计算属性：完整的邀请链接
    var inviteURL: String {
        return "funnypixels://alliance/invite/\(code)"
    }
}

/// 旗帜图案类型
enum FlagPatternType: String, Codable, CaseIterable {
    case color = "color"
    case emoji = "emoji"
    case complex = "complex"

    var displayName: String {
        switch self {
        case .color: return "颜色旗帜"
        case .emoji: return "Emoji旗帜"
        case .complex: return "特殊图案"
        }
    }

    var description: String {
        switch self {
        case .color: return "纯色背景，简洁大方"
        case .emoji: return "使用emoji表情，生动有趣"
        case .complex: return "从商店购买的特殊图案"
        }
    }
}

/// 旗帜图案
struct FlagPattern: Codable, Identifiable {
    let id: String
    let name: String
    let type: FlagPatternType
    let pattern: String?
    let preview: String?
    let isFree: Bool
    let price: Int?
    let isActive: Bool

    enum CodingKeys: String, CodingKey {
        case id, name, type, pattern, preview, isActive
        case isFree = "is_free"
        case price
    }

    /// 计算属性：是否可以购买
    var canPurchase: Bool {
        return isActive && !isFree && price != nil
    }

    /// 计算属性：价格显示文本
    var priceDisplayText: String {
        if isFree {
            return "免费"
        } else if let price = price {
            return "\(price) 积分"
        } else {
            return "不可用"
        }
    }
}

// MARK: - Request/Response Models

/// 创建联盟请求
struct CreateAllianceRequest: Codable {
    let name: String
    let description: String?
    let flagColor: String
    let flagPatternId: String?
    let isPublic: Bool
    let approvalRequired: Bool

    enum CodingKeys: String, CodingKey {
        case name, description
        case flagColor = "flag_color"
        case flagPatternId = "flag_pattern_id"
        case isPublic = "is_public"
        case approvalRequired = "approval_required"
    }

    /// 验证请求数据
    var isValid: Bool {
        let trimmedName = name.trimmingCharacters(in: .whitespacesAndNewlines)
        return !trimmedName.isEmpty &&
               trimmedName.count >= 2 &&
               trimmedName.count <= 20 &&
               flagColor.isValidHexColor
    }
}

/// 更新联盟请求
struct UpdateAllianceRequest: Codable {
    let name: String?
    let description: String?
    let flagColor: String?
    let flagPatternId: String?
    let isPublic: Bool?
    let approvalRequired: Bool?
    let maxMembers: Int?

    enum CodingKeys: String, CodingKey {
        case name, description
        case flagColor = "flag_color"
        case flagPatternId = "flag_pattern_id"
        case isPublic = "is_public"
        case approvalRequired = "approval_required"
        case maxMembers = "max_members"
    }
}

/// 申请加入联盟请求
struct JoinAllianceRequest: Codable {
    let allianceId: String
    let message: String?

    enum CodingKeys: String, CodingKey {
        case allianceId = "alliance_id"
        case message
    }
}

/// 审批申请请求
struct ProcessApplicationRequest: Codable {
    let applicationId: String
    let approved: Bool
    let reason: String?

    enum CodingKeys: String, CodingKey {
        case applicationId = "application_id"
        case approved, reason
    }
}

/// 移除成员请求
struct RemoveMemberRequest: Codable {
    let allianceId: String
    let memberId: String
    let reason: String?

    enum CodingKeys: String, CodingKey {
        case allianceId = "alliance_id"
        case memberId = "member_id"
        case reason
    }
}

/// 更新成员角色请求
struct UpdateMemberRoleRequest: Codable {
    let allianceId: String
    let memberId: String
    let newRole: AllianceRole

    enum CodingKeys: String, CodingKey {
        case allianceId = "alliance_id"
        case memberId = "member_id"
        case newRole = "new_role"
    }
}

/// 转让盟主请求
struct TransferLeadershipRequest: Codable {
    let allianceId: String
    let newLeaderId: String

    enum CodingKeys: String, CodingKey {
        case allianceId = "alliance_id"
        case newLeaderId = "new_leader_id"
    }
}

/// 生成邀请链接请求
struct GenerateInviteLinkRequest: Codable {
    let allianceId: String
    let maxUses: Int?
    let expiresHours: Int?

    enum CodingKeys: String, CodingKey {
        case allianceId = "alliance_id"
        case maxUses = "max_uses"
        case expiresHours = "expires_hours"
    }
}

/// 通过邀请链接加入请求
struct JoinByInviteRequest: Codable {
    let code: String
}

/// 分页信息

// Note: StandardResponse is now defined in APIResponseModels.swift

/// 联盟列表响应
struct AlliancesResponse: Codable {
    let success: Bool
    let data: [Alliance]
    let pagination: PaginationInfo?
    let message: String?
}

/// 联盟详情响应
struct AllianceDetailResponse: Codable {
    let success: Bool
    let data: Alliance?
    let members: [AllianceMember]?
    let inviteLinks: [AllianceInviteLink]?
    let message: String?
}

/// 联盟成员响应
struct AllianceMembersResponse: Codable {
    let success: Bool
    let data: [AllianceMember]
    let pagination: PaginationInfo?
    let message: String?
}

/// 申请列表响应
struct ApplicationsResponse: Codable {
    let success: Bool
    let data: [AllianceApplication]
    let pagination: PaginationInfo?
    let message: String?
}

/// 邀请链接响应
struct InviteLinksResponse: Codable {
    let success: Bool
    let data: [AllianceInviteLink]
    let message: String?
}

/// 旗帜图案响应
struct FlagPatternsResponse: Codable {
    let success: Bool
    let data: [FlagPattern]
    let message: String?
}

// MARK: - Utility Extensions

extension String {
    /// 验证是否为有效的十六进制颜色
    var isValidHexColor: Bool {
        let hexColorRegex = "^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$"
        let predicate = NSPredicate(format: "SELF MATCHES %@", hexColorRegex)
        return predicate.evaluate(with: self)
    }
}