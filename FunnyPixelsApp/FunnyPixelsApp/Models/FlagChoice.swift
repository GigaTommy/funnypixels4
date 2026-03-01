import Foundation

/// 旗帜选择枚举
enum FlagChoice: Equatable, Codable {
    case personalColor(colorHex: String)
    case personalAvatar(avatarData: String)
    case alliance(allianceId: Int, allianceName: String)

    var allianceId: Int? {
        if case .alliance(let id, _) = self { return id }
        return nil
    }

    /// 用于 Live Activity 显示的名称
    var displayName: String {
        switch self {
        case .personalColor:
            return ""
        case .personalAvatar:
            return ""
        case .alliance(_, let name):
            return name
        }
    }

    /// 用于 Live Activity 显示的颜色（联盟色或个人色）
    var colorHex: String {
        switch self {
        case .personalColor(let hex):
            return hex
        case .personalAvatar:
            // 使用用户的个人颜色（基于用户ID映射），而不是硬编码的绿色
            let userId = AuthManager.shared.currentUser?.id ?? ""
            return PersonalColorPalette.colorForUser(userId)
        case .alliance:
            return "#4ECDC4" // 默认值，由调用者覆盖为实际联盟色
        }
    }
}

// PersonalColorPalette 现在定义在单独的文件中
// 参见: Models/PersonalColorPalette.swift
