import Foundation

// MARK: - Sprite URL Helpers
// These extensions add computed properties to AllianceService's nested types.
// The standalone Alliance/AllianceMember/etc. types that were previously defined
// in this file have been removed — they were unused dead code.
// The actual models used throughout the app are defined inside AllianceService.swift.

extension AllianceService.FlagPattern {
    /// 计算属性：Sprite 图标 URL
    var spriteURL: URL? {
        guard renderType == "complex" else { return nil }
        // 优先使用 key (custom_xxx, emoji_xxx, color_xxx)
        // 若无 key，则使用 patternId (某些旧数据)
        // 最后使用 ID (String)
        let finalId = key ?? patternId ?? String(id)
        guard !finalId.isEmpty else { return nil }

        let baseUrl = APIEndpoint.baseURL.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        return URL(string: "\(baseUrl)/sprites/icon/2/complex/\(finalId).png")
    }
}

extension AllianceService.Alliance {
    /// 计算属性：Flag Sprite URL
    var flagSpriteURL: URL? {
        guard flagRenderType == "complex" else { return nil }

        // Use flagPatternId if available
        guard let patternId = flagPatternId, !patternId.isEmpty else { return nil }

        let baseUrl = APIEndpoint.baseURL.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        return URL(string: "\(baseUrl)/sprites/icon/2/complex/\(patternId).png")
    }
}
