import Combine
import SwiftUI

/// 联盟徽章组件 - 显示会话使用的联盟旗帜
struct AllianceBadge: View {
    @ObservedObject private var fontManager = FontSizeManager.shared
    let patternId: String
    let size: CGFloat

    @ObservedObject private var cache = FlagPatternCache.shared
    @State private var pattern: AllianceService.FlagPattern?

    init(patternId: String, size: CGFloat = 28) {
        self.patternId = patternId
        self.size = size
    }

    /// Sprite endpoint URL - works for any patternId (emoji, complex, custom_flag_*)
    /// The backend sprite service can look up any pattern by key from pattern_assets
    private var spriteIconUrl: URL? {
        guard !patternId.isEmpty else { return nil }
        let baseUrl = APIEndpoint.baseURL.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        return URL(string: "\(baseUrl)/sprites/icon/2/complex/\(patternId).png")
    }

    var body: some View {
        ZStack {
            // 圆形背景
            Circle()
                .fill(Color.white)
                .shadow(color: Color.black.opacity(0.1), radius: 4, x: 0, y: 2)

            if let pattern = pattern {
                if pattern.renderType == "emoji", let emoji = pattern.unicodeChar {
                    // 旗帜 emoji
                    Text(emoji)
                        .font(.system(size: size * 0.6))
                } else if pattern.renderType == "complex", let url = spriteIconUrl {
                    // 复杂图形 (custom flags, alliance patterns)
                    spriteImageView(url: url)
                } else if pattern.renderType == "color", let colorHex = pattern.color, let color = Color(hex: colorHex) {
                    // 纯色旗帜
                    Circle()
                        .fill(color)
                        .padding(size * 0.15)
                } else {
                    // 未知类型 - 尝试 sprite endpoint
                    if let url = spriteIconUrl {
                        spriteImageView(url: url)
                    } else {
                        Image(systemName: "flag.fill")
                            .font(.system(size: size * 0.5))
                            .foregroundColor(.gray.opacity(0.5))
                    }
                }
            } else {
                // 缓存未命中 - 使用 sprite endpoint 加载（支持所有 render_type）
                if let url = spriteIconUrl {
                    spriteImageView(url: url)
                } else {
                    Image(systemName: "flag.fill")
                        .font(.system(size: size * 0.5))
                        .foregroundColor(.gray.opacity(0.3))
                }
            }
        }
        .frame(width: size, height: size)
        .task {
            await loadPattern()
        }
        .onChange(of: cache.isLoaded) { _, loaded in
            if loaded {
                Task { await loadPattern() }
            }
        }
    }

    @ViewBuilder
    private func spriteImageView(url: URL) -> some View {
        CachedAsyncImagePhase(url: url) { phase in
            switch phase {
            case .success(let image):
                image
                    .resizable()
                    .aspectRatio(contentMode: .fit)
                    .padding(size * 0.15)
            case .failure:
                Image(systemName: "flag.fill")
                    .font(.system(size: size * 0.5))
                    .foregroundColor(.gray.opacity(0.3))
            case .empty:
                ProgressView()
                    .scaleEffect(size / 40.0)
            @unknown default:
                EmptyView()
            }
        }
    }

    private func loadPattern() async {
        Logger.info("🎌 AllianceBadge.loadPattern: Loading pattern for patternId=\(patternId), cache.isLoaded=\(cache.isLoaded)")

        // 从联盟旗帜缓存获取
        if let flagPattern = cache.getPattern(for: patternId) {
            self.pattern = flagPattern
            Logger.info("🎌 AllianceBadge.loadPattern: Successfully loaded pattern for patternId=\(patternId), name=\(flagPattern.name), renderType=\(flagPattern.renderType ?? "nil")")
        } else {
            Logger.warning("🎌 AllianceBadge.loadPattern: Pattern not in cache for patternId=\(patternId), will use sprite endpoint fallback. cache.isLoaded=\(cache.isLoaded), cache.patterns.count=\(cache.patterns.count)")
        }
    }
}

// MARK: - Preview

#Preview {
    HStack(spacing: 20) {
        AllianceBadge(patternId: "emoji_cn", size: 28)
        AllianceBadge(patternId: "emoji_us", size: 32)
        AllianceBadge(patternId: "emoji_water", size: 24)
    }
    .padding()
    .background(Color.gray.opacity(0.1))
}
