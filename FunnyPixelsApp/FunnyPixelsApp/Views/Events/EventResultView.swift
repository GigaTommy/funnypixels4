import SwiftUI

/// Event Result View - Shows final rankings and rewards for ended events
struct EventResultView: View {
    @ObservedObject private var fontManager = FontSizeManager.shared
    let eventId: String

    @State private var result: EventService.EventResult?
    @State private var isLoading = true
    @State private var errorMessage: String?

    var body: some View {
        ScrollView {
            if isLoading {
                ProgressView()
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 100)
            } else if let result = result {
                VStack(spacing: 24) {
                    // Header
                    headerSection(result)

                    // Stats
                    statsSection(result)

                    // Rankings
                    rankingsSection(result)

                    // Rewards Config
                    if let rewards = result.rewardsConfig, !rewards.isEmpty {
                        rewardsSection(rewards)
                    }

                    // Share Button
                    shareButton

                    Spacer()
                }
                .padding()
            } else if let error = errorMessage {
                VStack(spacing: 16) {
                    Image(systemName: "exclamationmark.triangle")
                        .font(.system(size: 48))
                        .foregroundColor(.orange)
                    Text(error)
                        .foregroundColor(.secondary)
                        .multilineTextAlignment(.center)
                }
                .padding()
            }
        }
        .background(Color(uiColor: .systemGroupedBackground))
        .navigationTitle(NSLocalizedString("event.result.title", comment: "Event Results"))
        .navigationBarTitleDisplayMode(.inline)
        .hideTabBar()
        .task {
            await loadResult()
        }
    }

    // MARK: - Sections

    private func headerSection(_ result: EventService.EventResult) -> some View {
        VStack(spacing: 12) {
            Image(systemName: "trophy.fill")
                .font(.system(size: 56))
                .foregroundColor(.yellow)

            Text(result.event.title)
                .font(.title2.weight(.bold))
                .multilineTextAlignment(.center)

            HStack(spacing: 16) {
                Label(eventStatusText(result.event.status), systemImage: statusIcon(result.event.status))
                    .font(.caption)
                    .foregroundColor(statusColor(result.event.status))

                if result.settled {
                    Label(NSLocalizedString("event.settled", comment: "Settled"), systemImage: "checkmark.seal.fill")
                        .font(.caption)
                        .foregroundColor(.green)
                }
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 24)
        .background(Color(uiColor: .secondarySystemGroupedBackground))
        .cornerRadius(16)
    }

    private func statsSection(_ result: EventService.EventResult) -> some View {
        HStack(spacing: 16) {
            EventStatBox(
                icon: "person.2.fill",
                value: "\(result.participantCount)",
                label: NSLocalizedString("event.participants", comment: "Participants")
            )

            EventStatBox(
                icon: "square.grid.3x3.fill",
                value: formatNumber(result.totalPixels),
                label: NSLocalizedString("event.total_pixels", comment: "Total Pixels")
            )

            EventStatBox(
                icon: "doc.text.fill",
                value: formatNumber(result.pixelLogCount),
                label: NSLocalizedString("event.pixel_logs", comment: "Pixel Logs")
            )
        }
    }

    private func rankingsSection(_ result: EventService.EventResult) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(NSLocalizedString("event.final_rankings", comment: "Final Rankings"))
                .font(.headline)

            if result.rankings.isEmpty {
                Text(NSLocalizedString("event.no_rankings", comment: "No rankings available"))
                    .foregroundColor(.secondary)
                    .frame(maxWidth: .infinity)
                    .padding()
            } else {
                ForEach(Array(result.rankings.enumerated()), id: \.element.id) { index, alliance in
                    RankingRow(rank: index + 1, alliance: alliance, totalPixels: result.totalPixels)
                }
            }
        }
        .padding()
        .background(Color(uiColor: .secondarySystemGroupedBackground))
        .cornerRadius(12)
    }

    private func rewardsSection(_ rewards: [EventService.RankingRewardTier]) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(NSLocalizedString("event.rewards_config", comment: "Rewards"))
                .font(.headline)

            ForEach(Array(rewards.enumerated()), id: \.offset) { index, tier in
                RewardTierRow(tier: tier)
            }
        }
        .padding()
        .background(Color(uiColor: .secondarySystemGroupedBackground))
        .cornerRadius(12)
    }

    private var shareButton: some View {
        Button(action: shareResult) {
            HStack {
                Image(systemName: "square.and.arrow.up")
                Text(NSLocalizedString("event.result.share", comment: "Share Result"))
            }
            .frame(maxWidth: .infinity)
            .padding()
            .background(Color.blue)
            .foregroundColor(.white)
            .cornerRadius(12)
        }
    }

    // MARK: - Helpers

    private func loadResult() async {
        isLoading = true
        do {
            let result = try await EventService.shared.getEventResult(eventId: eventId)
            await MainActor.run {
                self.result = result
                self.isLoading = false
            }
        } catch {
            await MainActor.run {
                self.errorMessage = error.localizedDescription
                self.isLoading = false
            }
        }
    }

    private func shareResult() {
        guard let result = result else { return }

        let topRankings = result.rankings.prefix(3).enumerated().map { "\($0.offset + 1). \($0.element.name): \(Int($0.element.score * Double(result.totalPixels))) pixels" }.joined(separator: "\n")
        let text = """
        \(result.event.title)
        Total Pixels: \(formatNumber(result.totalPixels))
        Participants: \(result.participantCount)

        Top Rankings:
        \(topRankings)

        Shared via FunnyPixels
        """

        let activityVC = UIActivityViewController(activityItems: [text], applicationActivities: nil)
        if let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
           let rootVC = windowScene.windows.first?.rootViewController {
            rootVC.present(activityVC, animated: true)
        }
    }

    private func formatNumber(_ number: Int) -> String {
        if number >= 1000000 {
            return String(format: "%.1fM", Double(number) / 1000000)
        } else if number >= 1000 {
            return String(format: "%.1fK", Double(number) / 1000)
        }
        return "\(number)"
    }

    private func eventStatusText(_ status: String) -> String {
        switch status {
        case "active": return NSLocalizedString("event.status.active", comment: "Active")
        case "published": return NSLocalizedString("event.status.published", comment: "Published")
        case "ended": return NSLocalizedString("event.status.ended", comment: "Ended")
        default: return status.capitalized
        }
    }

    private func statusIcon(_ status: String) -> String {
        switch status {
        case "active": return "flame.fill"
        case "published": return "megaphone.fill"
        case "ended": return "checkmark.circle.fill"
        default: return "circle"
        }
    }

    private func statusColor(_ status: String) -> Color {
        switch status {
        case "active": return .green
        case "published": return .blue
        case "ended": return .gray
        default: return .orange
        }
    }
}

// MARK: - Supporting Views

private struct EventStatBox: View {
    let icon: String
    let value: String
    let label: String

    var body: some View {
        VStack(spacing: 4) {
            Image(systemName: icon)
                .font(.title3)
                .foregroundColor(.blue)
            Text(value)
                .font(.headline)
            Text(label)
                .font(.caption2)
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 12)
        .background(Color(uiColor: .secondarySystemGroupedBackground))
        .cornerRadius(10)
    }
}

private struct RankingRow: View {
    let rank: Int
    let alliance: TerritoryWarHUD.AllianceScore
    let totalPixels: Int

    var body: some View {
        HStack(spacing: 12) {
            // Rank badge
            ZStack {
                Circle()
                    .fill(rankColor)
                    .frame(width: 32, height: 32)
                Text("\(rank)")
                    .font(.headline)
                    .foregroundColor(.white)
            }

            // Alliance info
            VStack(alignment: .leading, spacing: 2) {
                Text(alliance.name)
                    .font(.subheadline.weight(.medium))
                Text("\(Int(alliance.score * Double(totalPixels))) pixels")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }

            Spacer()

            // Percentage
            Text(String(format: "%.1f%%", alliance.score * 100))
                .font(.subheadline.weight(.semibold))
                .foregroundColor(.secondary)
        }
        .padding(.vertical, 8)
    }

    private var rankColor: Color {
        switch rank {
        case 1: return .yellow
        case 2: return .gray
        case 3: return .orange
        default: return .blue.opacity(0.7)
        }
    }
}

private struct RewardTierRow: View {
    let tier: EventService.RankingRewardTier

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(rankRangeText)
                    .font(.subheadline.weight(.medium))
                Spacer()
                Text(targetText)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }

            HStack(spacing: 12) {
                if let points = tier.rewards.points, points > 0 {
                    Label("\(points)", systemImage: "star.fill")
                        .font(.caption)
                        .foregroundColor(.orange)
                }
                if let pixels = tier.rewards.pixels, pixels > 0 {
                    Label("\(pixels)", systemImage: "square.fill")
                        .font(.caption)
                        .foregroundColor(.blue)
                }
                if let flag = tier.rewards.exclusiveFlag, !flag.isEmpty {
                    Label(flag, systemImage: "flag.fill")
                        .font(.caption)
                        .foregroundColor(.purple)
                }
            }
        }
        .padding()
        .background(Color(uiColor: .tertiarySystemGroupedBackground))
        .cornerRadius(8)
    }

    private var rankRangeText: String {
        if tier.rankMin == tier.rankMax {
            return "Rank \(tier.rankMin)"
        } else {
            return "Rank \(tier.rankMin)-\(tier.rankMax)"
        }
    }

    private var targetText: String {
        switch tier.target {
        case "alliance_members": return NSLocalizedString("event.target.alliance_members", comment: "All Members")
        case "alliance_leader": return NSLocalizedString("event.target.alliance_leader", comment: "Leader Only")
        case "user": return NSLocalizedString("event.target.user", comment: "Individual")
        default: return tier.target
        }
    }
}

// MARK: - Preview

#Preview {
    NavigationStack {
        EventResultView(eventId: "test-event-1")
    }
}
