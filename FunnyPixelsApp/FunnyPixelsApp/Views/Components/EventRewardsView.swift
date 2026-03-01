import SwiftUI

struct EventRewardsView: View {
    let event: EventService.Event
    @Environment(\.dismiss) var dismiss
    
    var body: some View {
        NavigationView {
            ScrollView {
                VStack(spacing: 20) {
                    // Header Banner (Optional)
                    if let url = event.bannerUrl, let bannerURL = URL(string: url) {
                        CachedAsyncImage(url: bannerURL) { image in
                            image.resizable().scaledToFill()
                        } placeholder: {
                            Color.gray.opacity(0.3)
                        }
                        .frame(height: 150)
                        .clipped()
                    }
                    
                    VStack(alignment: .leading, spacing: 16) {
                        Text(NSLocalizedString("event.rewards.title", comment: "Event Rewards"))
                            .font(.title2)
                            .fontWeight(.bold)
                        
                        Text(NSLocalizedString("event.rewards.subtitle", comment: "Rewards will be distributed automatically after the event ends."))
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                        
                        Divider()
                        
                        // Rewards List
                        if let rewardsConfig = event.config?.rewardsConfig,
                           let rankingRewards = rewardsConfig.rankingRewards {
                            ForEach(rankingRewards, id: \.rankMin) { tier in
                                rewardTierRow(tier)
                            }
                        } else {
                            // Empty State / Fallback (For Demo if no config)
                            emptyStateView
                        }
                    }
                    .padding()
                }
            }
            .navigationBarTitle(Text(event.title), displayMode: .inline)
            .navigationBarItems(trailing: Button(action: { dismiss() }) {
                Image(systemName: "xmark.circle.fill")
                    .foregroundColor(.gray)
            })
        }
    }
    
    // MARK: - Subviews
    
    private func rewardTierRow(_ tier: EventService.RankingRewardTier) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            // Rank Header
            HStack {
                rankBadge(min: tier.rankMin, max: tier.rankMax)
                
                Text(targetDescription(for: tier.target))
                    .font(.caption)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(Color.blue.opacity(0.1))
                    .foregroundColor(.blue)
                    .cornerRadius(4)
                
                Spacer()
            }
            
            // Rewards Content
            HStack(spacing: 16) {
                // Points
                if let points = tier.rewards.points {
                    rewardItem(icon: "star.fill", value: "\(points)", label: NSLocalizedString("common.points", comment: "Points"), color: .orange)
                }
                
                // Pixels
                if let pixels = tier.rewards.pixels {
                    rewardItem(icon: "drop.fill", value: "\(pixels)", label: NSLocalizedString("common.pixels", comment: "Pixels"), color: .cyan)
                }
                
                // Flag (Exclusive)
                if let flagId = tier.rewards.exclusiveFlag {
                    HStack(spacing: 8) {
                        // In real app, load image from URL or Asset based on ID
                        // For demo, we assume it's an Asset name or generic
                        Image(systemName: "flag.fill")
                            .font(DesignTokens.Typography.title3)
                            .foregroundColor(.purple)
                            .frame(width: 40, height: 40)
                            .background(Color.purple.opacity(0.1))
                            .clipShape(Circle())
                        
                        VStack(alignment: .leading, spacing: 2) {
                            Text(NSLocalizedString("reward.flag", comment: "Exclusive Flag"))
                                .font(.caption)
                                .foregroundColor(.secondary)
                            Text(flagId) // Display ID or Name
                                .font(DesignTokens.Typography.subheadline.weight(.bold))
                        }
                    }
                    .padding(8)
                    .background(Color.purple.opacity(0.05))
                    .cornerRadius(8)
                }
            }
        }
        .padding()
        .background(Color(uiColor: .secondarySystemBackground))
        .cornerRadius(12)
    }
    
    private func rewardItem(icon: String, value: String, label: String, color: Color) -> some View {
        HStack(spacing: 8) {
            Image(systemName: icon)
                .font(DesignTokens.Typography.title3)
                .foregroundColor(color)
            
            VStack(alignment: .leading, spacing: 0) {
                Text(value)
                    .font(DesignTokens.Typography.title3.weight(.bold))
                    .foregroundColor(.primary)
                Text(label)
                    .font(DesignTokens.Typography.caption2)
                    .foregroundColor(.secondary)
            }
        }
    }
    
    private func rankBadge(min: Int, max: Int) -> some View {
        HStack(spacing: 4) {
             if min == 1 && max == 1 {
                 Image(systemName: "trophy.fill")
                     .foregroundColor(.yellow)
                 Text(NSLocalizedString("rank.1st", comment: "1st Place"))
                     .fontWeight(.bold)
             } else if min == 2 && max == 2 {
                 Image(systemName: "trophy.fill")
                     .foregroundColor(.gray)
                 Text(NSLocalizedString("rank.2nd", comment: "2nd Place"))
                     .fontWeight(.bold)
             } else if min == 3 && max == 3 {
                 Image(systemName: "trophy.fill")
                     .foregroundColor(.brown)
                 Text(NSLocalizedString("rank.3rd", comment: "3rd Place"))
                     .fontWeight(.bold)
             } else {
                 Text(min == max ? "\(min)" : "\(min)-\(max)")
                     .font(DesignTokens.Typography.title3.weight(.bold))
                     .padding(.horizontal, 8)
             }
        }
    }
    
    private func targetDescription(for target: String) -> String {
        switch target {
        case "alliance_members": return NSLocalizedString("reward.target.members", comment: "All Members")
        case "alliance_leader": return NSLocalizedString("reward.target.leader", comment: "Leader Only")
        default: return target
        }
    }
    
    private var emptyStateView: some View {
        VStack(spacing: 16) {
            Text(NSLocalizedString("event.rewards.empty", comment: "No rewards configured for this event."))
                .foregroundColor(.secondary)
                .padding()
        }
    }
}
