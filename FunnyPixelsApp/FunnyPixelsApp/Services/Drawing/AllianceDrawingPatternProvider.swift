import Foundation
import Combine

/// 联盟绘制图案提供者
/// 负责获取用户的联盟旗帜图案，用于绘制时使用
@MainActor
public class AllianceDrawingPatternProvider: ObservableObject {

    public static let shared = AllianceDrawingPatternProvider()

    // MARK: - Published Properties

    /// 当前用户的绘制图案（基于联盟旗帜）
    @Published public private(set) var currentDrawingPattern: DrawingPattern?

    /// 是否正在加载图案
    @Published public private(set) var isLoading = false

    // MARK: - Private Properties

    private let allianceService = AllianceService.shared
    private var cancellables = Set<AnyCancellable>()

    // MARK: - Default Pattern

    /// 默认图案（用户无联盟时使用）
    private let defaultPattern = DrawingPattern(
        type: .color,
        color: "#4ECDC4",  // 默认青色（原来是黑色）
        emoji: nil,
        patternId: "personal_color_4ecdc4",
        patternName: NSLocalizedString("pattern.default_color", value: "Default Color", comment: "Default Color"),
        isAlliancePattern: false
    )

    // MARK: - Initialization

    private init() {}

    // MARK: - Public Methods

    /// 加载用户的绘制图案（基于联盟旗帜）
    public func loadDrawingPattern(allianceId: Int? = nil) async {
        Logger.debug("🎨 AllianceDrawingPatternProvider: loadDrawingPattern called with allianceId: \(allianceId?.description ?? "nil")")
        isLoading = true
        defer { isLoading = false }

        do {
            if let id = allianceId {
                // 加载指定联盟的旗帜
                Logger.debug("🎨 AllianceDrawingPatternProvider: Loading specific alliance \(id)")
                let (alliance, _) = try await allianceService.getAllianceDetail(id: id)
                Logger.debug("🎨 AllianceDrawingPatternProvider: Got alliance detail - name: \(alliance.name), color: \(alliance.color ?? "nil")")
                let pattern = convertAllianceToDrawingPattern(alliance)
                currentDrawingPattern = pattern
                Logger.info("[TRACKER] 1. Alliance Selected: ID=\(id), Name=\(alliance.name), Pattern=\(pattern.patternName), Color=\(pattern.color ?? "nil")")
                Logger.info("✅ 已加载指定联盟(\(id))旗帜图案: \(pattern.patternName), type: \(pattern.type), color: \(pattern.color ?? "nil")")
            } else {
                // 加载默认/主联盟旗帜
                Logger.debug("🎨 AllianceDrawingPatternProvider: Loading user's default alliance flag")
                let flagInfo = try await allianceService.getUserAllianceFlag()
                Logger.debug("🎨 AllianceDrawingPatternProvider: Got flag info - renderType: \(flagInfo.renderType)")
                let pattern = convertFlagToDrawingPattern(flagInfo)
                currentDrawingPattern = pattern
                Logger.info("✅ 已加载用户联盟旗帜图案: \(pattern.patternName), type: \(pattern.type), color: \(pattern.color ?? "nil")")
            }
        } catch {
            // 403或其他错误，用户可能没有联盟，使用默认颜色图案
            let defaultColorPattern = DrawingPattern(
                type: .color,
                color: "#4ECDC4",  // 默认青色
                emoji: nil,
                patternId: nil,
                patternName: NSLocalizedString("pattern.default_color", value: "Default Color", comment: "Default Color"),
                isAlliancePattern: false
            )
            currentDrawingPattern = defaultColorPattern
            Logger.warning("⚠️ 无法获取联盟旗帜，使用默认颜色: \(error.localizedDescription)")
            Logger.warning("⚠️ Error details: \(error)")
        }
    }

    /// 根据 FlagChoice 直接设置绘制图案（不走服务器请求）
    func setPatternFromFlagChoice(_ choice: FlagChoice) {
        switch choice {
        case .personalColor(let hex):
            currentDrawingPattern = DrawingPattern(
                type: .color, color: hex,
                patternId: "personal_color_\(hex.replacingOccurrences(of: "#", with: "").lowercased())",
                patternName: NSLocalizedString("flag.personal_color", value: "My Color", comment: ""),
                isAlliancePattern: false
            )
        case .personalAvatar(let avatarData):
            // avatarData 应该是 avatar_url（已上传的头像 URL）或空字符串
            let userId = AuthManager.shared.currentUser?.id ?? ""
            let hasCustomAvatar = !avatarData.isEmpty && !avatarData.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty

            if hasCustomAvatar {
                // 用户设置了自定义头像，使用 user_avatar_{userId} pattern (complex 类型)
                // 后端会动态从 users.avatar_url 获取图片URL（不预存在 pattern_assets，避免性能问题）
                let patternId = "user_avatar_\(userId)"
                let baseUrl = APIEndpoint.baseURL.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
                let spriteUrl = "\(baseUrl)/sprites/icon/1/complex/\(patternId).png"
                currentDrawingPattern = DrawingPattern(
                    type: .complex,
                    color: nil,
                    emoji: nil,
                    patternId: patternId,
                    payload: nil,
                    imageUrl: spriteUrl,
                    patternName: NSLocalizedString("flag.my_avatar", value: "My Avatar", comment: ""),
                    isAlliancePattern: false
                )
                Logger.info("✅ 个人头像模式（complex）: patternId=\(patternId), userId=\(userId), spriteUrl=\(spriteUrl)")
            } else {
                // 用户未设置头像，使用基于用户 ID 映射的固定颜色（PersonalColorPalette）
                let personalColor = PersonalColorPalette.colorForUser(userId)
                let patternId = "personal_color_\(personalColor.replacingOccurrences(of: "#", with: "").lowercased())"
                currentDrawingPattern = DrawingPattern(
                    type: .color,
                    color: personalColor,
                    emoji: nil,
                    patternId: patternId,
                    payload: nil,
                    imageUrl: nil,
                    patternName: NSLocalizedString("flag.personal_color", value: "My Color", comment: ""),
                    isAlliancePattern: false
                )
                Logger.info("✅ 默认个人颜色模式（基于用户ID映射）: userId=\(userId), color=\(personalColor), patternId=\(patternId)")
            }
        case .alliance:
            break  // 联盟模式走现有的 loadDrawingPattern(allianceId:)
        }
    }


    /// 刷新图案（重新从服务器获取）
    public func refreshPattern() async {
        await loadDrawingPattern()
    }

    /// 获取当前绘制参数（用于 DrawingService）
    public func getDrawingParameters() -> (type: DrawingMode, color: String?, emoji: String?, patternId: String?) {
        guard let pattern = currentDrawingPattern else {
            // 返回默认值
            return (.color, defaultPattern.color, nil, nil)
        }

        switch pattern.type {
        case .color:
            return (.color, pattern.color, nil, pattern.patternId)
        case .emoji:
            return (.emoji, nil, pattern.emoji, nil)
        case .complex:
            return (.complex, nil, nil, pattern.patternId)
        case .none:
            return (.none, defaultPattern.color, nil, nil)
        case .gps:
            return (.gps, defaultPattern.color, nil, nil)
        }
    }

    // MARK: - Private Methods
    
    /// 将 Alliance 对象转换为绘制图案
    private func convertAllianceToDrawingPattern(_ alliance: AllianceService.Alliance) -> DrawingPattern {
        let type: DrawingMode
        var color: String? = nil
        var emoji: String? = nil
        var patternId: String? = nil
        var payload: String? = nil
        var imageUrl: String? = nil
        var patternName: String = alliance.name 
        
        Logger.debug("🎨 AllianceDrawingPatternProvider: Converting alliance '\(alliance.name)' to pattern")
        Logger.debug("🎨   - flagRenderType: \(alliance.flagRenderType ?? "nil")")
        Logger.debug("🎨   - alliance.color: \(alliance.color ?? "nil")")
        Logger.debug("🎨   - flagPatternId: \(alliance.flagPatternId ?? "nil")")
        Logger.debug("🎨   - flagUnicodeChar: \(alliance.flagUnicodeChar ?? "nil")")

        // 根据 renderType 确定绘制类型
        switch alliance.flagRenderType {
        case "color":
            type = .color
            // Ensure patternId is passed for color types
            patternId = alliance.flagPatternId
            
            // Alliance struct stores color in `color` field usually for UI tint, 
            // but for flag it might use `flagPayload` (if pattern) or fallback.
            // Actually Alliance struct has `color` property which is usually the theme color.
            // Let's use `color` if available.
            if let c = alliance.color, !c.isEmpty, c != "#000000" {
                color = c
                Logger.debug("🎨   ✅ Using alliance.color: \(c)")
            } else if let pid = alliance.flagPatternId, !pid.isEmpty, let cachedPattern = FlagPatternCache.shared.getPattern(for: pid) {
                 // Try to resolve from cache (e.g. color_red -> #FF0000)
                 if let cachedColor = cachedPattern.color, !cachedColor.isEmpty {
                     color = cachedColor
                     patternName = cachedPattern.name
                     Logger.info("🎨   ✅ Resolved color from FlagPatternCache ('\(pid)'): \(cachedColor)")
                 } else {
                     color = "#4ECDC4"
                 }
            } else {
                color = "#4ECDC4"
                Logger.warning("🎨   ⚠️ Alliance color is nil/empty/black, using default: #4ECDC4")
            }

        case "emoji":
            type = .emoji
            emoji = alliance.flagUnicodeChar
            patternName = NSLocalizedString("pattern.alliance_flag_emoji", value: "Alliance Flag (Emoji)", comment: "Alliance Flag (Emoji)")
            Logger.debug("🎨   ✅ Using emoji: \(emoji ?? "nil")")

        case "complex":
            type = .complex
            patternId = alliance.flagPatternId
            payload = alliance.flagPayload
            
            // Prioritize imageUrl (from flagUrl)
            if let fUrl = alliance.flagUrl, !fUrl.isEmpty {
                // If in development and is a local-looking path (no http), resolve to actual disk path if needed
                // For now, we assume the backend provides either a full URL or a relative path we can handle
                if AppEnvironment.current == .development && !fUrl.contains("://") {
                    Logger.info("🛠️ [Provider] Development mode: flagUrl '\(fUrl)' detected as local path")
                }
                imageUrl = fUrl
            }
            
            patternName = NSLocalizedString("pattern.alliance_flag", value: "Alliance Flag", comment: "Alliance Flag")
            Logger.debug("🎨   ✅ Using complex pattern: \(patternId ?? "nil"), hasURL: \(imageUrl != nil), hasPayload: \(payload != nil)")

        default:
            type = .color
            let rawColor = alliance.color ?? "#4ECDC4"
            let flagPatternId = alliance.flagPatternId
            
            // Prioritize Color Resolution:
            // 1. Valid hex color from API (is not black)
            // 2. Lookup from FlagPatternCache using patternId
            // 3. Fallback to default Cyan
            
            if let c = alliance.color, !c.isEmpty, c != "#000000" {
                color = c
                Logger.debug("🎨   ✅ Using direct alliance.color: \(c)")
            } else if let pid = flagPatternId, !pid.isEmpty, let cachedPattern = FlagPatternCache.shared.getPattern(for: pid) {
                // Try to resolve from cache
                 if let cachedColor = cachedPattern.color, !cachedColor.isEmpty {
                     color = cachedColor
                     patternName = cachedPattern.name
                     Logger.info("🎨   ✅ Resolved color from FlagPatternCache ('\(pid)'): \(cachedColor)")
                 } else {
                     // Cache hit but no color?
                     color = "#4ECDC4"
                     Logger.warning("🎨   ⚠️ Cache hit for '\(pid)' but no color found, using default.")
                 }
            } else {
                // Fallback
                color = "#4ECDC4"
                patternName = "默认颜色"
                Logger.warning("🎨   ⚠️ Unable to resolve color (raw: \(rawColor), pid: \(flagPatternId ?? "nil")), using default: #4ECDC4")
            }
        }
        
        Logger.info("🎨 AllianceDrawingPatternProvider: Final pattern for '\(alliance.name)' - type: \(type), color: \(color ?? "nil")")

        return DrawingPattern(
            type: type,
            color: color,
            emoji: emoji,
            patternId: patternId,
            payload: payload,
            imageUrl: imageUrl,
            patternName: patternName,
            isAlliancePattern: true
        )
    }


    /// 将联盟旗帜信息转换为绘制图案
    private func convertFlagToDrawingPattern(_ flagInfo: AllianceService.FlagInfo) -> DrawingPattern {
        let type: DrawingMode
        var color: String? = nil
        var emoji: String? = nil
        var patternId: String? = nil
        var payload: String? = nil
        var patternName: String = ""
        
        Logger.debug("🎨 AllianceDrawingPatternProvider: Converting FlagInfo to pattern")
        Logger.debug("🎨   - renderType: \(flagInfo.renderType)")
        Logger.debug("🎨   - patternId: \(String(describing: flagInfo.patternId))")
        Logger.debug("🎨   - unicodeChar: \(String(describing: flagInfo.unicodeChar))")
        Logger.debug("🎨   - patternInfo.color: \(flagInfo.patternInfo?.color ?? "nil")")
        Logger.debug("🎨   - patternInfo.name: \(flagInfo.patternInfo?.name ?? "nil")")

        // 根据 renderType 确定绘制类型
        switch flagInfo.renderType {
        case "color":
            type = .color
            // 优先使用 patternInfo 中的直接颜色值
            if let patternInfo = flagInfo.patternInfo, let directColor = patternInfo.color, !directColor.isEmpty, directColor != "#000000" {
                color = directColor
                patternName = patternInfo.name
                Logger.debug("🎨   ✅ Using patternInfo.color: \(directColor)")
            } else if !flagInfo.patternId.isEmpty {
                // 如果 patternInfo 为 nil，尝试从 FlagPatternCache 中查找
                Logger.debug("🎨   🔍 patternInfo.color is nil, looking up in FlagPatternCache with patternId: \(flagInfo.patternId)")
                if let cachedPattern = FlagPatternCache.shared.getPattern(for: flagInfo.patternId) {
                    color = cachedPattern.color
                    patternName = cachedPattern.name
                    Logger.info("🎨   ✅ Found color in FlagPatternCache: \(cachedPattern.color ?? "nil"), name: \(cachedPattern.name)")
                } else {
                    // FlagPatternCache 中也没有，使用默认颜色
                    color = "#4ECDC4"
                    patternName = NSLocalizedString("pattern.alliance_color", value: "Alliance Color", comment: "Alliance Color")
                    Logger.warning("🎨   ⚠️ Pattern '\(flagInfo.patternId)' not found in FlagPatternCache, using default: #4ECDC4")
                }
            } else {
                // 既没有 patternInfo 也没有 patternId，使用默认颜色
                color = "#4ECDC4"
                patternName = "联盟颜色"
                Logger.warning("🎨   ⚠️ No patternInfo or patternId, using default: #4ECDC4")
            }

        case "emoji":
            type = .emoji
            emoji = flagInfo.unicodeChar
            patternName = flagInfo.patternInfo?.name ?? "联盟旗帜"
            Logger.debug("🎨   ✅ Using emoji: \(emoji ?? "nil")")

        case "complex":
            type = .complex
            patternId = flagInfo.patternId
            payload = flagInfo.payload ?? flagInfo.patternInfo?.payload
            
            patternName = flagInfo.patternInfo?.name ?? "联盟图案"
            Logger.debug("🎨   ✅ Using complex pattern: \(patternId ?? "nil"), hasURL: false, hasPayload: \(payload != nil)")

        default:
            type = .color
            color = "#4ECDC4"
            patternName = "默认颜色"
            Logger.warning("🎨   ⚠️ Unknown renderType '\(flagInfo.renderType)', using default color")
        }
        
        Logger.info("🎨 AllianceDrawingPatternProvider: Final FlagInfo pattern - type: \(type), color: \(color ?? "nil"), name: \(patternName)")

        return DrawingPattern(
            type: type,
            color: color,
            emoji: emoji,
            patternId: patternId,
            payload: payload,
            imageUrl: nil,
            patternName: patternName,
            isAlliancePattern: true
        )
    }
}

// MARK: - Drawing Pattern Model

/// 绘制图案模型
public struct DrawingPattern: Equatable {
    public let type: DrawingMode
    public let color: String?
    public let emoji: String?
    public let patternId: String?
    public let payload: String?
    public let imageUrl: String?
    public let patternName: String
    public let isAlliancePattern: Bool

    public init(
        type: DrawingMode,
        color: String? = nil,
        emoji: String? = nil,
        patternId: String? = nil,
        payload: String? = nil,
        imageUrl: String? = nil,
        patternName: String,
        isAlliancePattern: Bool
    ) {
        self.type = type
        self.color = color
        self.emoji = emoji
        self.patternId = patternId
        self.payload = payload
        self.imageUrl = imageUrl
        self.patternName = patternName
        self.isAlliancePattern = isAlliancePattern
    }
}
