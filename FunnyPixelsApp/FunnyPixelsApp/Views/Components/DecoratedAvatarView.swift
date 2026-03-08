import SwiftUI

/// AvatarView with cosmetic decorations (avatar frame + badge)
/// Wraps the existing AvatarView and adds visual overlays based on equipped cosmetics.
struct DecoratedAvatarView: View {
    // Avatar parameters (forwarded to AvatarView)
    let avatarUrl: String?
    let avatar: String?
    let avatarColor: String?
    let displayName: String
    let flagPatternId: String?
    let patternType: String?
    let unicodeChar: String?
    let size: CGFloat

    // Cosmetic decorations
    let equippedCosmetics: EquippedCosmetics?

    init(
        avatarUrl: String? = nil,
        avatar: String? = nil,
        avatarColor: String? = nil,
        displayName: String,
        flagPatternId: String? = nil,
        patternType: String? = nil,
        unicodeChar: String? = nil,
        size: CGFloat = 40,
        equippedCosmetics: EquippedCosmetics? = nil
    ) {
        self.avatarUrl = avatarUrl
        self.avatar = avatar
        self.avatarColor = avatarColor
        self.displayName = displayName
        self.flagPatternId = flagPatternId
        self.patternType = patternType
        self.unicodeChar = unicodeChar
        self.size = size
        self.equippedCosmetics = equippedCosmetics
    }

    private var hasFrame: Bool {
        equippedCosmetics?.avatarFrame != nil
    }

    private var hasBadge: Bool {
        equippedCosmetics?.badge != nil
    }

    private var frameWidth: CGFloat {
        max(size * 0.06, 2)
    }

    var body: some View {
        ZStack(alignment: .bottomTrailing) {
            // Base avatar
            AvatarView(
                avatarUrl: avatarUrl,
                avatar: avatar,
                avatarColor: avatarColor,
                displayName: displayName,
                flagPatternId: flagPatternId,
                patternType: patternType,
                unicodeChar: unicodeChar,
                size: size
            )

            // Avatar Frame overlay
            if let frame = equippedCosmetics?.avatarFrame {
                frameOverlay(for: frame)
            }

            // Badge overlay
            if let badge = equippedCosmetics?.badge {
                badgeOverlay(for: badge)
            }
        }
        .frame(width: size + (hasFrame ? frameWidth * 2 : 0),
               height: size + (hasFrame ? frameWidth * 2 : 0))
    }

    // MARK: - Frame Overlays

    @ViewBuilder
    private func frameOverlay(for frame: String) -> some View {
        switch frame {
        case "golden":
            Circle()
                .strokeBorder(
                    LinearGradient(
                        colors: [
                            Color(red: 1.0, green: 0.84, blue: 0.0),   // Gold
                            Color(red: 1.0, green: 0.65, blue: 0.0),   // Orange-gold
                            Color(red: 1.0, green: 0.84, blue: 0.0),   // Gold
                            Color(red: 1.0, green: 0.93, blue: 0.55)   // Light gold
                        ],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    ),
                    lineWidth: frameWidth
                )
                .frame(width: size + frameWidth * 2, height: size + frameWidth * 2)
                .shadow(color: Color(red: 1.0, green: 0.84, blue: 0.0).opacity(0.4), radius: 3)
        default:
            // Future frames can be added here
            EmptyView()
        }
    }

    // MARK: - Badge Overlays

    @ViewBuilder
    private func badgeOverlay(for badge: String) -> some View {
        let badgeSize = max(size * 0.32, 14)
        switch badge {
        case "pixel_master":
            ZStack {
                Circle()
                    .fill(Color.black.opacity(0.7))
                    .frame(width: badgeSize, height: badgeSize)
                Image(systemName: "medal.fill")
                    .resizable()
                    .scaledToFit()
                    .foregroundStyle(
                        LinearGradient(
                            colors: [.yellow, .orange],
                            startPoint: .top,
                            endPoint: .bottom
                        )
                    )
                    .frame(width: badgeSize * 0.65, height: badgeSize * 0.65)
            }
            .offset(x: size * 0.3, y: size * 0.3)
        default:
            EmptyView()
        }
    }
}

// MARK: - Previews

#Preview("Golden Frame") {
    DecoratedAvatarView(
        avatarColor: "#4ECDC4",
        displayName: "Test",
        size: 60,
        equippedCosmetics: EquippedCosmetics(avatarFrame: "golden", badge: nil, chatBubble: nil)
    )
    .padding()
}

#Preview("Pixel Master Badge") {
    DecoratedAvatarView(
        avatarColor: "#FF6B6B",
        displayName: "Master",
        size: 60,
        equippedCosmetics: EquippedCosmetics(avatarFrame: nil, badge: "pixel_master", chatBubble: nil)
    )
    .padding()
}

#Preview("Both Decorations") {
    DecoratedAvatarView(
        avatarColor: "#4ECDC4",
        displayName: "VIP",
        size: 80,
        equippedCosmetics: EquippedCosmetics(avatarFrame: "golden", badge: "pixel_master", chatBubble: nil)
    )
    .padding()
}

#Preview("No Decorations") {
    DecoratedAvatarView(
        avatarColor: "#4ECDC4",
        displayName: "Normal",
        size: 60,
        equippedCosmetics: nil
    )
    .padding()
}

#Preview("Size Comparison") {
    VStack(spacing: 20) {
        DecoratedAvatarView(
            avatarColor: "#4ECDC4",
            displayName: "S",
            size: 32,
            equippedCosmetics: EquippedCosmetics(avatarFrame: "golden", badge: "pixel_master", chatBubble: nil)
        )
        DecoratedAvatarView(
            avatarColor: "#4ECDC4",
            displayName: "M",
            size: 44,
            equippedCosmetics: EquippedCosmetics(avatarFrame: "golden", badge: "pixel_master", chatBubble: nil)
        )
        DecoratedAvatarView(
            avatarColor: "#4ECDC4",
            displayName: "L",
            size: 72,
            equippedCosmetics: EquippedCosmetics(avatarFrame: "golden", badge: "pixel_master", chatBubble: nil)
        )
    }
    .padding()
}
