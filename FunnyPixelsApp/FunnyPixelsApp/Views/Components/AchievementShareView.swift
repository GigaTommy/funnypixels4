import Combine
import SwiftUI

/// 成就分享卡片视图（用于生成分享图片）
struct AchievementShareView: View {
    let achievement: AchievementService.UserAchievement
    let userProfile: ProfileViewModel.UserProfile?
    
    var body: some View {
        ZStack {
            // 背景渐变（不使用 ignoresSafeArea，ImageRenderer 无安全区域）
            LinearGradient(
                gradient: Gradient(colors: [rarityColor.opacity(0.8), rarityColor.opacity(0.3), Color.black]),
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )

            // 装饰纹理
            GeometryReader { proxy in
                Path { path in
                    path.move(to: CGPoint(x: 0, y: proxy.size.height * 0.7))
                    path.addCurve(
                        to: CGPoint(x: proxy.size.width, y: proxy.size.height * 0.4),
                        control1: CGPoint(x: proxy.size.width * 0.3, y: proxy.size.height * 0.2),
                        control2: CGPoint(x: proxy.size.width * 0.7, y: proxy.size.height * 0.9)
                    )
                }
                .stroke(Color.white.opacity(0.1), lineWidth: 40)
            }

            VStack(spacing: 24) {
                // Logo / Branding
                HStack {
                    Image(systemName: "paintpalette.fill")
                        .font(.system(size: 20))
                        .foregroundColor(.white)
                    Text("FunnyPixels")
                        .font(.system(size: 20, weight: .bold, design: .rounded))
                        .foregroundColor(.white)
                    Spacer()
                }
                .padding(.top, 40)
                .padding(.horizontal, 32)

                Spacer()

                // 成就图标 (大)
                ZStack {
                    // 使用纯色替代 Material.ultraThin（Material 在 ImageRenderer 中不渲染）
                    Circle()
                        .fill(rarityColor.opacity(0.15))
                        .frame(width: 180, height: 180)

                    Circle()
                        .strokeBorder(
                            LinearGradient(
                                colors: [.white.opacity(0.8), .white.opacity(0.1)],
                                startPoint: .top,
                                endPoint: .bottom
                            ),
                            lineWidth: 4
                        )
                        .frame(width: 180, height: 180)
                        .shadow(color: rarityColor, radius: 20)

                    // 优先使用本地资源（ImageRenderer 无法加载异步网络图片）
                    if let localName = localAssetName, Image.assetExists(localName) {
                        Image(localName)
                            .resizable()
                            .scaledToFit()
                            .padding(20)
                            .frame(width: 180, height: 180)
                    } else {
                        Image(systemName: "trophy.fill")
                            .font(.system(size: 80))
                            .foregroundColor(rarityColor)
                    }
                }
                
                // 文本信息
                VStack(spacing: 8) {
                    Text(NSLocalizedString("achievement.share.unlock", comment: "UNLOCK ACHIEVEMENT"))
                        .font(.caption)
                        .fontWeight(.bold)
                        .tracking(4)
                        .foregroundColor(.white.opacity(0.7))
                    
                    Text(NSLocalizedString(achievement.name, comment: ""))
                        .font(.system(size: 32, weight: .heavy))
                        .foregroundColor(.white)
                        .multilineTextAlignment(.center)
                    
                    Text(NSLocalizedString(achievement.description, comment: ""))
                        .font(.subheadline)
                        .foregroundColor(.white.opacity(0.8))
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 32)
                }
                
                Spacer()
                
                // 用户信息
                HStack(spacing: 12) {
                    AvatarView(
                        avatarUrl: userProfile?.avatarUrl,
                        avatar: userProfile?.avatar,
                        displayName: userProfile?.displayOrUsername ?? "PixelArtist",
                        flagPatternId: userProfile?.flagPatternId,
                        size: 44
                    )
                    .overlay(Circle().stroke(.white, lineWidth: 2))
                    
                    VStack(alignment: .leading, spacing: 2) {
                        Text(userProfile?.displayOrUsername ?? "PixelArtist")
                            .font(.headline)
                            .foregroundColor(.white)
                        
                        Text(DateFormatter.localizedString(from: Date(), dateStyle: .medium, timeStyle: .short))
                            .font(.caption)
                            .foregroundColor(.white.opacity(0.6))
                    }
                    
                    Spacer()
                    
                    // Rarity Badge
                    if let rarity = achievement.metadata?.rarity {
                        Text(NSLocalizedString(rarity, comment: "").uppercased())
                            .font(.caption2)
                            .fontWeight(.bold)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                            .background(Color.white.opacity(0.2))
                            .cornerRadius(4)
                            .foregroundColor(.white)
                    }
                }
                .padding(.horizontal, 32)
                .padding(.bottom, 40)
            }
        }
        .frame(width: 375, height: 667) // Target standard share size (iPhone 8 / SE size roughly)
        .background(Color.black)
    }
    
    private var localAssetName: String? {
        let name = achievement.name
        
        // Pixel
        if name.contains("新手") || name.lowercased().contains("novice") { return "AchievementPixelNovice" }
        if name.contains("爱好者") || name.lowercased().contains("lover") { return "AchievementPixelLover" }
        if name.contains("艺术家") || name.lowercased().contains("artist") { return "AchievementPixelArtist" }
        if name.contains("大师") || name.lowercased().contains("master") { return "AchievementPixelMaster" }
        if name.contains("传奇") || name.lowercased().contains("legend") { return "AchievementPixelLegend" }
        if name.contains("连续绘制") { return "AchievementPixelArtist" }
        
        // Social
        if name.contains("社交新手") || name.lowercased().contains("social beginner") { return "AchievementSocialBeginner" }
        if name.contains("蝴蝶") || name.lowercased().contains("butterfly") { return "AchievementSocialButterfly" }
        if name.contains("私信") || name.lowercased().contains("pm") { return "AchievementSocialPM" }
        if name.contains("聊天") || name.lowercased().contains("chat") { return "AchievementSocialExpert" }
        if name.contains("明星") || name.lowercased().contains("star") { return "AchievementSocialStar" }
        
        // Shop
        if name.contains("购物新手") || name.lowercased().contains("shop beginner") { return "AchievementShopBeginner" }
        if name.contains("购物达人") || name.lowercased().contains("shop expert") { return "AchievementShopExpert" }
        if name.contains("土豪") || name.lowercased().contains("tycoon") || name.lowercased().contains("rich") { return "AchievementShopTycoon" }
        
        // Alliance
        if name.contains("联盟新手") { return "AchievementAllianceBeginner" }
        if name.contains("联盟领袖") { return "AchievementAllianceLeader" }
        if name.contains("联盟活跃") || name.contains("活跃分子") { return "AchievementAllianceActive" }
        
        // Special
        if name.contains("早起鸟") { return "AchievementSpecialEarlyBird" }
        if name.contains("夜猫子") { return "AchievementSpecialNightOwl" }
        if name.contains("幸运儿") { return "AchievementSpecialLucky" }
        
        return nil
    }

    private var rarityColor: Color {
        guard let rarity = achievement.metadata?.rarity,
              let rarityEnum = AchievementService.Rarity(rawValue: rarity) else {
            return .blue
        }
        return rarityEnum.color
    }
}
