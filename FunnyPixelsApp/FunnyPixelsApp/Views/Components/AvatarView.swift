import Combine
import SwiftUI

/// 用户头像视图组件
/// 支持多种头像类型：URL图片、像素数据、纯色、默认头像
struct AvatarView: View {
    let avatarUrl: String?
    let avatar: String?      // 像素数据
    let avatarColor: String? // 纯色
    let displayName: String
    let flagPatternId: String? // 旗帜图案ID
    let patternType: String?   // render_type from backend: "color"/"emoji"/"complex"
    let unicodeChar: String?   // emoji character for emoji-type patterns
    let size: CGFloat

    private var patternCache: FlagPatternCache { FlagPatternCache.shared }

    private var isPixelAvatar: Bool {
        (avatar?.contains(",") == true) || (avatarUrl?.contains(",") == true)
    }
    
    private var pixelData: String? {
        if let avatar = avatar, avatar.contains(",") { return avatar }
        if let avatarUrl = avatarUrl, avatarUrl.contains(",") { return avatarUrl }
        return nil
    }

    private var resolvedAvatarUrl: URL? {
        // If it's pixel data, it's not a URL
        guard !isPixelAvatar else { return nil }
        
        let urlSource = (avatarUrl != nil && !avatarUrl!.isEmpty) ? avatarUrl : (avatar != nil && !avatar!.isEmpty ? avatar : nil)
        
        guard let urlString = urlSource?.trimmingCharacters(in: .whitespacesAndNewlines), !urlString.isEmpty else { return nil }
        
        // Handle full URLs
        if urlString.contains("://") {
            return URL(string: urlString)
        }
        
        // Handle relative URLs (with or without leading slash)
        var cleanPath = urlString.hasPrefix("/") ? String(urlString.dropFirst()) : urlString
        
        // Percent encode the path to handle spaces or special characters
        if let encodedPath = cleanPath.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) {
            cleanPath = encodedPath
        }
        
        let baseUrl = APIEndpoint.baseURL.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        // Static file paths (uploads/) are served at server root, not under /api
        let effectiveBase: String
        if cleanPath.hasPrefix("uploads/") || cleanPath.hasPrefix("public/") {
            if let apiRange = baseUrl.range(of: "/api", options: .backwards) {
                effectiveBase = String(baseUrl[baseUrl.startIndex..<apiRange.lowerBound])
            } else {
                effectiveBase = baseUrl
            }
        } else {
            effectiveBase = baseUrl
        }
        let url = URL(string: "\(effectiveBase)/\(cleanPath)")
        
        Logger.debug("📸 AvatarView: [\(displayName)] urlSource=\(urlString.prefix(50))\(urlString.count > 50 ? "..." : "")")
        Logger.debug("📸 AvatarView: [\(displayName)] resolvedURL=\(url?.absoluteString ?? "nil")")
        
        return url
    }

    private var complexIconUrl: URL? {
        guard let patternId = flagPatternId, !patternId.isEmpty else { return nil }

        let baseUrl = APIEndpoint.baseURL.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        let url = URL(string: "\(baseUrl)/sprites/icon/2/complex/\(patternId).png")
        
        Logger.debug("📸 AvatarView: [\(displayName)] complexIconUrl=\(url?.absoluteString ?? "nil")")
        return url
    }

    init(
        avatarUrl: String? = nil,
        avatar: String? = nil,
        avatarColor: String? = nil,
        displayName: String,
        flagPatternId: String? = nil,
        patternType: String? = nil,
        unicodeChar: String? = nil,
        size: CGFloat = 40
    ) {
        self.avatarUrl = avatarUrl
        self.avatar = avatar
        self.avatarColor = avatarColor
        self.displayName = displayName
        self.flagPatternId = flagPatternId
        self.patternType = patternType
        self.unicodeChar = unicodeChar
        self.size = size
    }

    @ViewBuilder
    var body: some View {
        Group {
            if isPixelAvatar, let data = pixelData {
                // 像素数据头像 - 解析并渲染
                PixelAvatarView(
                    pixelData: data,
                    size: size,
                    displayName: displayName,
                    avatarColor: avatarColor,
                    flagPatternId: flagPatternId
                )
                .onAppear {
                    if displayName.lowercased() == "testuser1" {
                        Logger.debug("👤 [testuser1] AvatarView: Using PixelAvatarView (data length: \(data.count))")
                    }
                }
            } else if let url = resolvedAvatarUrl {
                // URL头像 - 从CDN加载
                CachedAsyncImagePhase(url: url) { phase in
                    switch phase {
                    case .success(let image):
                        image
                            .resizable()
                            .aspectRatio(contentMode: .fit)
                    case .failure(let error):
                        failureContent()
                            .onAppear {
                                if displayName.lowercased() == "testuser1" {
                                    Logger.warning("👤 [testuser1] AvatarView: CachedAsyncImagePhase failed - \(error.localizedDescription)")
                                }
                            }
                    case .empty:
                        ProgressView()
                            .frame(width: size, height: size)
                    @unknown default:
                        DefaultAvatarView(displayName: displayName, avatarColor: avatarColor, flagPatternId: flagPatternId, patternType: patternType, unicodeChar: unicodeChar, size: size)
                    }
                }
                .onAppear {
                    if displayName.lowercased() == "testuser1" {
                        Logger.debug("👤 [testuser1] AvatarView: Using CachedAsyncImagePhase with URL: \(url.absoluteString)")
                    }
                }
            } else {
                // 无URL头像 - 由 DefaultAvatarView 处理所有旗帜类型 (color/emoji/complex)
                DefaultAvatarView(displayName: displayName, avatarColor: avatarColor, flagPatternId: flagPatternId, patternType: patternType, unicodeChar: unicodeChar, size: size)
                    .onAppear {
                        if displayName.lowercased() == "testuser1" {
                             Logger.warning("👤 [testuser1] AvatarView: Using DefaultAvatarView (no URL or pixel data)")
                             Logger.debug("👤   - avatarUrl: \(avatarUrl ?? "nil")")
                             Logger.debug("👤   - avatar: \(avatar?.prefix(50) ?? "nil")")
                             Logger.debug("👤   - avatarColor: \(avatarColor ?? "nil")")
                        }
                    }
            }
        }
        .frame(width: size, height: size)
        .clipShape(Circle())
        .shadow(color: .black.opacity(0.1), radius: 2, y: 1)
    }

    @ViewBuilder
    private func failureContent() -> some View {
        if let iconUrl = complexIconUrl {
            CachedAsyncImagePhase(url: iconUrl) { iconPhase in
                switch iconPhase {
                case .success(let iconImage):
                    iconImage
                        .resizable()
                        .aspectRatio(contentMode: .fit)
                case .failure, .empty:
                    DefaultAvatarView(displayName: displayName, avatarColor: avatarColor, flagPatternId: flagPatternId, patternType: patternType, unicodeChar: unicodeChar, size: size)
                @unknown default:
                    DefaultAvatarView(displayName: displayName, avatarColor: avatarColor, flagPatternId: flagPatternId, patternType: patternType, unicodeChar: unicodeChar, size: size)
                }
            }
        } else {
            DefaultAvatarView(displayName: displayName, avatarColor: avatarColor, flagPatternId: flagPatternId, patternType: patternType, unicodeChar: unicodeChar, size: size)
        }
    }
}

/// 默认头像/纯色头像组件（首字母或旗帜）
struct DefaultAvatarView: View {
    let displayName: String
    let avatarColor: String?
    let flagPatternId: String?
    let patternType: String?   // render_type from backend: "color"/"emoji"/"complex"
    let unicodeChar: String?   // emoji character for emoji-type patterns
    let size: CGFloat

    private var patternCache: FlagPatternCache { FlagPatternCache.shared }

    /// Sprite endpoint URL for any alliance flag pattern
    private var spriteIconUrl: URL? {
        guard let patternId = flagPatternId, !patternId.isEmpty else { return nil }
        let baseUrl = APIEndpoint.baseURL.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        return URL(string: "\(baseUrl)/sprites/icon/2/complex/\(patternId).png")
    }

    /// Resolve render type: prefer cache lookup, fall back to backend-provided patternType
    private var resolvedRenderType: String? {
        if let patternId = flagPatternId,
           let cached = patternCache.getPattern(for: patternId) {
            return cached.renderType
        }
        return patternType
    }

    /// Resolve emoji: prefer cache lookup, fall back to backend-provided unicodeChar
    private var resolvedEmoji: String? {
        if let patternId = flagPatternId,
           let emoji = patternCache.getEmoji(for: patternId) {
            return emoji
        }
        return unicodeChar
    }

    init(
        displayName: String,
        avatarColor: String? = nil,
        flagPatternId: String? = nil,
        patternType: String? = nil,
        unicodeChar: String? = nil,
        size: CGFloat = 40
    ) {
        self.displayName = displayName
        self.avatarColor = avatarColor
        self.flagPatternId = flagPatternId
        self.patternType = patternType
        self.unicodeChar = unicodeChar
        self.size = size
    }

    var body: some View {
        ZStack {
            Circle()
                .fill(Color(hex: avatarColor ?? "#4ECDC4") ?? .blue)

            if let patternId = flagPatternId, !patternId.isEmpty {
                switch resolvedRenderType {
                case "emoji":
                    if let emoji = resolvedEmoji {
                        Text(emoji)
                            .font(.system(size: size * 0.6))
                    } else {
                        initialLetter
                    }
                case "complex":
                    if let url = spriteIconUrl {
                        spriteImage(url: url)
                    } else {
                        initialLetter
                    }
                case "color":
                    // Color pattern — the background circle already shows the color via avatarColor
                    initialLetter
                default:
                    // render_type unknown or nil — try sprite endpoint as universal fallback
                    if let url = spriteIconUrl {
                        spriteImage(url: url)
                    } else {
                        initialLetter
                    }
                }
            } else {
                initialLetter
            }
        }
    }

    private var initialLetter: some View {
        Text(displayName.prefix(1).uppercased())
            .font(.system(size: size * 0.4, weight: .semibold))
            .foregroundColor(.white)
    }

    @ViewBuilder
    private func spriteImage(url: URL) -> some View {
        CachedAsyncImagePhase(url: url) { phase in
            switch phase {
            case .success(let image):
                image
                    .resizable()
                    .aspectRatio(contentMode: .fit)
                    .padding(size * 0.1)
            case .failure, .empty:
                initialLetter
            @unknown default:
                EmptyView()
            }
        }
    }
}

/// 像素头像视图
/// 解析像素数据并渲染为网格
struct PixelAvatarView: View {
    let pixelData: String
    let size: CGFloat
    
    // Fallback data
    var displayName: String = ""
    var avatarColor: String? = nil
    var flagPatternId: String? = nil

    // 像素网格配置（32x32）
    private let gridSize = 32
    private var pixelSize: CGFloat { size / CGFloat(gridSize) }

    var body: some View {
        GeometryReader { geometry in
            let colors = parsePixelData()
            if !colors.isEmpty {
                Canvas { context, size in
                    let pixelSize = size.width / CGFloat(gridSize)

                    for (index, color) in colors.enumerated() {
                        // Avoid out of bounds if colors.count > gridSize * gridSize
                        guard index < gridSize * gridSize else { break }
                        
                        let x = CGFloat(index % gridSize) * pixelSize
                        let y = CGFloat(index / gridSize) * pixelSize

                        context.fill(
                            Path(CGRect(x: x, y: y, width: pixelSize, height: pixelSize)),
                            with: .color(color)
                        )
                    }
                }
            } else {
                // FALLBACK: Use DefaultAvatarView if pixel parsing failed completely
                DefaultAvatarView(displayName: displayName, avatarColor: avatarColor, flagPatternId: flagPatternId, size: size)
            }
        }
    }

    /// 解析像素数据
    /// 格式：逗号分隔的十六进制颜色代码 (#RRGGBB,#RRGGBB,...)
    private func parsePixelData() -> [Color] {
        // 检查空数据
        let cleanData = pixelData.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !cleanData.isEmpty else { 
            Logger.debug("📸 PixelAvatarView: Empty pixel data")
            return [] 
        }

        // 移除可能的前缀
        let data = cleanData
            .replacingOccurrences(of: "[", with: "")
            .replacingOccurrences(of: "]", with: "")

        // 分割颜色值
        let colorStrings = data.split(separator: ",")
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }

        Logger.debug("📸 PixelAvatarView: Parsed \(colorStrings.count) color strings (Expected \(gridSize * gridSize))")

        // 转换为Color
        let colors = colorStrings.compactMap { colorString -> Color? in
            guard !colorString.isEmpty else { return nil }
            return Color(hex: colorString)
        }
        
        if colors.count != colorStrings.count {
            Logger.warning("⚠️ PixelAvatarView: Failed to parse \(colorStrings.count - colors.count) colors")
        }
        
        return colors
    }
}

// MARK: - Preview

#Preview("URL Avatar") {
    AvatarView(
        avatarUrl: "https://example.com/avatar.png",
        displayName: "用户"
    )
}

#Preview("Pixel Avatar") {
    AvatarView(
        avatar: "#FF0000,#00FF00,#0000FF",
        displayName: "像素"
    )
}

#Preview("Color Avatar") {
    AvatarView(
        avatarColor: "#4ECDC4",
        displayName: "测试"
    )
}

#Preview("Default Avatar") {
    AvatarView(
        displayName: "默认"
    )
}

#Preview("Large Size") {
    AvatarView(
        avatarColor: "#FF6B6B",
        displayName: "大",
        size: 80
    )
}
