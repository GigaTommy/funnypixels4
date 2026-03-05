import Combine
import SwiftUI

/// 紧凑型成就徽章视图（用于个人主页展示）
struct AchievementBadgeView: View {
    @ObservedObject private var fontManager = FontSizeManager.shared
    let achievement: AchievementService.UserAchievement
    
    var body: some View {
        VStack(spacing: 8) {
            ZStack {
                // 高稀有度光效
                if isHighRarity {
                    rarityColor.opacity(0.4)
                        .frame(width: 50, height: 50)
                        .blur(radius: 10)
                }
                
                // 背景圆圈
                Circle()
                    .fill(
                        LinearGradient(
                            colors: [rarityColor.opacity(0.2), rarityColor.opacity(0.05)],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .frame(width: 60, height: 60)
                    .overlay(
                        Circle()
                            .strokeBorder(
                                LinearGradient(
                                    colors: [rarityColor, rarityColor.opacity(0.3)],
                                    startPoint: .top,
                                    endPoint: .bottom
                                ),
                                lineWidth: isHighRarity ? 2 : 1
                            )
                    )
                    .shadow(color: rarityColor.opacity(0.2), radius: 4, x: 0, y: 2)
                
                // 图标
                if Image.assetExists(categoryIcon) {
                    Image(categoryIcon)
                        .resizable()
                        .scaledToFit()
                        .frame(width: 36, height: 36)
                        .blendMode(.multiply)
                        .padding(12)
                } else if let iconUrl = achievement.iconUrl, !iconUrl.contains(",") {
                    let url: URL? = {
                        if iconUrl.hasPrefix("http") {
                            return URL(string: iconUrl)
                        } else {
                            let cleanPath = iconUrl.hasPrefix("/") ? String(iconUrl.dropFirst()) : iconUrl
                            return URL(string: "\(APIEndpoint.baseURL)/\(cleanPath)")
                        }
                    }()
                    
                    if let url = url {
                        CachedAsyncImagePhase(url: url) { phase in
                            switch phase {
                            case .empty:
                                ProgressView().scaleEffect(0.5)
                            case .success(let image):
                                image.resizable()
                                    .scaledToFit()
                                    .frame(width: 36, height: 36)
                                    .blendMode(.multiply)
                                    .padding(12)
                            case .failure:
                                fallbackIcon
                            @unknown default:
                                EmptyView()
                            }
                        }
                    } else {
                        fallbackIcon
                    }
                } else {
                    fallbackIcon
                }
            }
            .scaleEffect(1.0)
            
            // 名称（支持多语言）
            Text(NSLocalizedString(achievement.name, comment: ""))
                .font(.system(size: 11, weight: .medium))
                .foregroundColor(.primary.opacity(0.8))
                .lineLimit(1)
                .frame(width: 70)
        }
    }
    
    private var fallbackIcon: some View {
        Image(systemName: "star.fill")
            .font(.system(size: 24))
            .foregroundColor(rarityColor)
            .frame(width: 36, height: 36)
    }
    
    // MARK: - Helpers
    
    private var isHighRarity: Bool {
        guard let rarity = achievement.metadata?.rarity,
              let rarityEnum = AchievementService.Rarity(rawValue: rarity) else { return false }
        return rarityEnum == .legendary || rarityEnum == .epic
    }
    
    private var rarityColor: Color {
        guard let rarity = achievement.metadata?.rarity,
              let rarityEnum = AchievementService.Rarity(rawValue: rarity) else {
            return .gray
        }
        return rarityEnum.color
    }
    
    private var categoryIcon: String {
        switch achievement.category {
        case "pixel", "pixels": return "IconAchievementPixels"
        case "social": return "IconAchievementSocial"
        case "alliance": return "IconAchievementAlliance"
        case "shop": return "IconAchievementShop"
        case "special": return "IconAchievementSpecial"
        case "likes": return "IconAchievementLikes"
        case "activity": return "IconAchievementActivity"
        default: return "IconAchievementPixels"
        }
    }
}

#Preview {
    HStack {
        // Mock data for preview would go here
    }
}
