import Combine
import SwiftUI

/// Achievement unlock toast notification
/// Displays a celebratory banner when user unlocks a new achievement
struct AchievementUnlockToast: View {
    // ✅ 响应式设计：监听字体设置变化
    @ObservedObject private var fontManager = FontSizeManager.shared

    let achievement: AchievementService.Achievement
    @Binding var isPresented: Bool

    @State private var offset: CGFloat = -200
    @State private var scale: CGFloat = 0.8
    @State private var opacity: Double = 0

    var body: some View {
        HStack(spacing: 12) {
            // Trophy icon with glow effect
            ZStack {
                Circle()
                    .fill(rarityColor.opacity(0.2))
                    .frame(width: ResponsiveSize.iconXLarge(scale: fontManager.scale), height: ResponsiveSize.iconXLarge(scale: fontManager.scale))

                Image(systemName: "trophy.fill")
                    .responsiveFont(.title3)
                    .foregroundColor(rarityColor)
            }

            // Achievement info
            VStack(alignment: .leading, spacing: 4) {
                Text(NSLocalizedString("achievement.unlock.title", comment: "🎉 Achievement Unlocked!"))
                    .responsiveFont(.caption, weight: .bold)
                    .foregroundColor(.secondary)

                Text(NSLocalizedString(achievement.name, comment: ""))
                    .responsiveFont(.headline)
                    .foregroundColor(.primary)

                HStack(spacing: 4) {
                    Image(systemName: "star.fill")
                        .responsiveFont(.caption2)
                        .foregroundColor(.orange)
                    Text("+\(achievement.rewardPoints) " + NSLocalizedString("common.points", comment: ""))
                        .responsiveFont(.caption)
                        .foregroundColor(.orange)
                }
            }

            Spacer()
        }
        .padding()
        .background(
            RoundedRectangle(cornerRadius: 16)
                .fill(.ultraThinMaterial)
                .shadow(color: rarityColor.opacity(0.3), radius: 15, x: 0, y: 5)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 16)
                .stroke(rarityColor.opacity(0.5), lineWidth: 2)
        )
        .padding(.horizontal)
        .offset(y: offset)
        .scaleEffect(scale)
        .opacity(opacity)
        .onAppear {
            // ✨ Achievement unlock feedback
            SoundManager.shared.play(.levelUp)
            HapticManager.shared.notification(type: .success)

            // Entrance animation
            withAnimation(.spring(response: 0.6, dampingFraction: 0.7)) {
                offset = 0
                scale = 1.0
                opacity = 1.0
            }

            // Auto-dismiss after 3 seconds
            DispatchQueue.main.asyncAfter(deadline: .now() + 3) {
                dismiss()
            }
        }
        .onTapGesture {
            dismiss()
        }
    }

    private func dismiss() {
        withAnimation(.spring(response: 0.4, dampingFraction: 0.8)) {
            offset = -200
            scale = 0.8
            opacity = 0
        }

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) {
            isPresented = false
        }
    }

    private var rarityColor: Color {
        guard let rarity = achievement.metadata?.rarity,
              let rarityEnum = AchievementService.Rarity(rawValue: rarity) else {
            return .gray
        }
        return rarityEnum.color
    }
}

// MARK: - Notification Extension

extension Notification.Name {
    static let achievementUnlocked = Notification.Name("achievementUnlocked")
}

// MARK: - Preview

#Preview {
    ZStack {
        Color.gray.opacity(0.2).ignoresSafeArea()

        AchievementUnlockToast(
            achievement: AchievementService.Achievement(
                id: 1,
                key: "pixel_artist",
                name: "像素艺术家",
                description: "绘制10个像素",
                iconUrl: nil,
                rewardPoints: 50,
                type: "milestone",
                requirement: 10,
                repeatCycle: nil,
                category: "pixels",
                displayPriority: 80,
                isActive: true,
                metadata: AchievementService.AchievementMetadata(
                    progressUnit: "像素",
                    ctaLabel: nil,
                    ctaLink: nil,
                    rarity: "rare"
                ),
                rewardItems: nil,
                rewardDetails: nil,
                createdAt: nil,
                updatedAt: nil
            ),
            isPresented: .constant(true)
        )
        .padding(.top, 50)
    }
}
