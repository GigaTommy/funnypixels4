import SwiftUI

/// 活动参与要求卡片 - 显示活动的参与条件和用户当前状态
struct EventRequirementsCard: View {
    let event: EventService.Event
    @State private var userLevel: Int = 1
    @State private var userAllianceCount: Int = 0
    @ObservedObject private var fontManager = FontSizeManager.shared

    private var hasRequirements: Bool {
        event.config?.requirements != nil
    }

    private var requirements: EventService.EventRequirements? {
        event.config?.requirements
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            // Header
            HStack(spacing: 8) {
                Image(systemName: "checkmark.shield.fill")
                    .font(fontManager.scaledFont(.title3))
                    .foregroundColor(.blue)

                Text(NSLocalizedString("event.requirements.title", comment: "Entry Requirements"))
                    .font(fontManager.scaledFont(.headline))
                    .foregroundColor(AppColors.textPrimary)

                Spacer()
            }

            if hasRequirements {
                VStack(spacing: 12) {
                    // Min Level Requirement
                    if let minLevel = requirements?.minLevel {
                        requirementRow(
                            icon: "star.circle.fill",
                            title: NSLocalizedString("event.requirements.min_level", comment: "Minimum Level"),
                            required: "\(NSLocalizedString("event.requirements.level", comment: "Level")) \(minLevel)",
                            current: "\(NSLocalizedString("event.requirements.your_level", comment: "Your level")): \(userLevel)",
                            isMet: userLevel >= minLevel
                        )
                    }

                    // Min Alliances Requirement
                    if let minAlliances = requirements?.minAlliances {
                        requirementRow(
                            icon: "flag.2.crossed.fill",
                            title: NSLocalizedString("event.requirements.min_alliances", comment: "Alliance Membership"),
                            required: String(format: NSLocalizedString("event.requirements.alliances_count", comment: "At least %d alliance(s)"), minAlliances),
                            current: String(format: NSLocalizedString("event.requirements.your_alliances", comment: "You have %d"), userAllianceCount),
                            isMet: userAllianceCount >= minAlliances
                        )
                    }

                    // Min Participants Info
                    if let minParticipants = requirements?.minParticipants {
                        infoRow(
                            icon: "person.3.fill",
                            title: NSLocalizedString("event.requirements.min_participants", comment: "Minimum Participants"),
                            value: String(format: NSLocalizedString("event.requirements.participants_needed", comment: "%d participants needed to start"), minParticipants)
                        )
                    }
                }

                // Overall Status
                overallStatusView
            } else {
                // No requirements
                HStack {
                    Spacer()
                    VStack(spacing: 8) {
                        Image(systemName: "hand.thumbsup.fill")
                            .font(fontManager.scaledFont(.largeTitle))
                            .foregroundColor(.green.opacity(0.3))
                        Text(NSLocalizedString("event.requirements.none", comment: "No entry requirements - everyone can join!"))
                            .font(fontManager.scaledFont(.caption))
                            .foregroundColor(AppColors.textSecondary)
                            .multilineTextAlignment(.center)
                    }
                    .padding(.vertical, 32)
                    Spacer()
                }
            }
        }
        .padding()
        .background(Color(uiColor: .secondarySystemGroupedBackground))
        .cornerRadius(12)
        .task {
            await loadUserStats()
        }
    }

    private func requirementRow(icon: String, title: String, required: String, current: String, isMet: Bool) -> some View {
        HStack(spacing: 12) {
            // Icon
            ZStack {
                Circle()
                    .fill(isMet ? Color.green.opacity(0.1) : Color.orange.opacity(0.1))
                    .frame(width: 40, height: 40)

                Image(systemName: icon)
                    .font(fontManager.scaledFont(.body))
                    .foregroundColor(isMet ? .green : .orange)
            }

            // Content
            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(fontManager.scaledFont(.subheadline).weight(.medium))
                    .foregroundColor(AppColors.textPrimary)

                HStack(spacing: 8) {
                    Text(required)
                        .font(fontManager.scaledFont(.caption))
                        .foregroundColor(AppColors.textSecondary)

                    Text("•")
                        .font(fontManager.scaledFont(.caption))
                        .foregroundColor(AppColors.textTertiary)

                    Text(current)
                        .font(fontManager.scaledFont(.caption))
                        .foregroundColor(isMet ? .green : .orange)
                }
            }

            Spacer()

            // Status Icon
            Image(systemName: isMet ? "checkmark.circle.fill" : "exclamationmark.circle.fill")
                .font(fontManager.scaledFont(.title3))
                .foregroundColor(isMet ? .green : .orange)
        }
        .padding(12)
        .background(isMet ? Color.green.opacity(0.05) : Color.orange.opacity(0.05))
        .cornerRadius(8)
    }

    private func infoRow(icon: String, title: String, value: String) -> some View {
        HStack(spacing: 12) {
            // Icon
            ZStack {
                Circle()
                    .fill(Color.blue.opacity(0.1))
                    .frame(width: 40, height: 40)

                Image(systemName: icon)
                    .font(fontManager.scaledFont(.body))
                    .foregroundColor(.blue)
            }

            // Content
            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(fontManager.scaledFont(.subheadline).weight(.medium))
                    .foregroundColor(AppColors.textPrimary)

                Text(value)
                    .font(fontManager.scaledFont(.caption))
                    .foregroundColor(AppColors.textSecondary)
            }

            Spacer()

            Image(systemName: "info.circle")
                .font(fontManager.scaledFont(.title3))
                .foregroundColor(.blue)
        }
        .padding(12)
        .background(Color.blue.opacity(0.05))
        .cornerRadius(8)
    }

    private var overallStatusView: some View {
        let allRequirementsMet = checkAllRequirementsMet()

        return HStack(spacing: 12) {
            Image(systemName: allRequirementsMet ? "checkmark.seal.fill" : "exclamationmark.triangle.fill")
                .font(fontManager.scaledFont(.title3))
                .foregroundColor(allRequirementsMet ? .green : .orange)

            Text(allRequirementsMet ?
                 NSLocalizedString("event.requirements.all_met", comment: "You meet all requirements!") :
                 NSLocalizedString("event.requirements.some_not_met", comment: "Some requirements not met"))
                .font(fontManager.scaledFont(.subheadline).weight(.medium))
                .foregroundColor(allRequirementsMet ? .green : .orange)

            Spacer()
        }
        .padding()
        .background(allRequirementsMet ? Color.green.opacity(0.1) : Color.orange.opacity(0.1))
        .cornerRadius(8)
    }

    private func checkAllRequirementsMet() -> Bool {
        guard let requirements = requirements else { return true }

        if let minLevel = requirements.minLevel, userLevel < minLevel {
            return false
        }

        if let minAlliances = requirements.minAlliances, userAllianceCount < minAlliances {
            return false
        }

        return true
    }

    private func loadUserStats() async {
        // Load user level from current user (using rankTier as proxy)
        // TODO: Add actual level field to User model if needed
        await MainActor.run {
            if let currentUser = AuthManager.shared.currentUser {
                // Use rankTier name as a proxy for level (or default to 1)
                // In a real implementation, the backend should provide user.level
                self.userLevel = currentUser.rankTier?.currentPixels ?? 0 > 0 ?
                    min(10, max(1, (currentUser.rankTier?.currentPixels ?? 0) / 1000)) : 1
            } else {
                self.userLevel = 1
            }
        }

        // Load user alliance count
        do {
            let alliances = try await AllianceService.shared.fetchUserAlliances()
            await MainActor.run {
                self.userAllianceCount = alliances.count
            }
        } catch {
            Logger.error("Failed to load user alliances: \(error)")
        }
    }
}

// MARK: - Preview
#if DEBUG
struct EventRequirementsCard_Previews: PreviewProvider {
    static var previews: some View {
        ScrollView {
            VStack(spacing: 16) {
                // With requirements
                EventRequirementsCard(
                    event: EventService.Event(
                        id: "1",
                        title: "高级赛事",
                        type: "territory_control",
                        status: "published",
                        startTime: "2026-02-23T00:00:00Z",
                        endTime: "2026-03-02T00:00:00Z",
                        bannerUrl: nil,
                        boundary: nil,
                        config: EventService.EventConfig(
                            area: nil,
                            areaSize: nil,
                            requirements: EventService.EventRequirements(
                                minLevel: 5,
                                minAlliances: 1,
                                minParticipants: 10
                            ),
                            rules: nil,
                            rewards: nil,
                            rewardsConfig: nil
                        ),
                        gameplay: nil,
                        isParticipant: false
                    )
                )

                // No requirements
                EventRequirementsCard(
                    event: EventService.Event(
                        id: "2",
                        title: "新手友好赛事",
                        type: "territory_control",
                        status: "published",
                        startTime: "2026-02-23T00:00:00Z",
                        endTime: "2026-03-02T00:00:00Z",
                        bannerUrl: nil,
                        boundary: nil,
                        config: EventService.EventConfig(
                            area: nil,
                            areaSize: nil,
                            requirements: nil,
                            rules: nil,
                            rewards: nil,
                            rewardsConfig: nil
                        ),
                        gameplay: nil,
                        isParticipant: false
                    )
                )
            }
            .padding()
        }
        .background(Color(uiColor: .systemGroupedBackground))
    }
}
#endif
