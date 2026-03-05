import SwiftUI

/// 小巧的联盟旗帜微标，用于显示当前选中的绘制图案
struct SmallAllianceFlagBadge: View {
    @ObservedObject private var fontManager = FontSizeManager.shared
    let pattern: DrawingPattern?
    var size: CGFloat = 20
    var borderSize: CGFloat = 1.5
    var showSwitchIndicator: Bool = false
    
    var body: some View {
        Group {
            if let pattern = pattern {
                switch pattern.type {
                case .color:
                    if let colorHex = pattern.color, let color = Color(hex: colorHex) {
                        Circle()
                            .fill(color)
                    } else {
                        fallbackIcon
                    }
                case .emoji:
                    if let emoji = pattern.emoji {
                        ZStack {
                            Circle().fill(.white)
                            Text(emoji).font(.system(size: size * 0.65))
                        }
                    } else {
                        fallbackIcon
                    }
                case .complex:
                    if let url = spriteIconUrl(for: pattern) {
                        CachedAsyncImagePhase(url: url) { phase in
                            switch phase {
                            case .success(let image):
                                image
                                    .resizable()
                                    .aspectRatio(contentMode: .fit)
                            case .failure, .empty:
                                paletteFallback
                            @unknown default:
                                paletteFallback
                            }
                        }
                    } else {
                        paletteFallback
                    }
                default:
                    fallbackIcon
                }
            } else {
                fallbackIcon
            }
        }
        .frame(width: size, height: size)
        .overlay(Circle().stroke(.white, lineWidth: borderSize))
        .shadow(color: .black.opacity(0.3), radius: 2)
        .overlay(alignment: .bottomTrailing) {
            if showSwitchIndicator {
                ZStack {
                    Circle().fill(Color.white)
                        .frame(width: size * 0.45, height: size * 0.45)
                    Image(systemName: "arrow.up.arrow.down")
                        .font(.system(size: size * 0.22, weight: .bold))
                        .foregroundColor(.blue)
                }
                .offset(x: size * 0.1, y: size * 0.1)
            }
        }
    }
    
    private func spriteIconUrl(for pattern: DrawingPattern) -> URL? {
        guard let patternId = pattern.patternId, !patternId.isEmpty else { return nil }
        let baseUrl = APIEndpoint.baseURL.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        return URL(string: "\(baseUrl)/sprites/icon/2/complex/\(patternId).png")
    }

    private var paletteFallback: some View {
        ZStack {
            Circle().fill(Color.indigo)
            Image(systemName: "paintpalette.fill")
                .font(.system(size: size * 0.5))
                .foregroundColor(.white)
        }
    }
    
    private var fallbackIcon: some View {
        ZStack {
            Circle().fill(Color.blue)
            Image(systemName: "flag.fill")
                .font(.system(size: size * 0.5))
                .foregroundColor(.white)
        }
    }
}
