import SwiftUI
import Combine

/// Event card for list display
struct EventCardView: View {
    let event: EventService.UserEvent
    var showJoinedDate: Bool = false
    @ObservedObject private var fontManager = FontSizeManager.shared

    var body: some View {
        HStack(spacing: AppSpacing.m) {
            // Banner thumbnail
            if let bannerUrl = event.bannerUrl, let url = URL(string: bannerUrl) {
                AsyncImage(url: url) { image in
                    image
                        .resizable()
                        .aspectRatio(contentMode: .fill)
                } placeholder: {
                    Rectangle()
                        .fill(LinearGradient(
                            colors: gradientColors,
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        ))
                }
                .frame(width: 80, height: 60)
                .clipShape(RoundedRectangle(cornerRadius: AppRadius.m))
            } else {
                Rectangle()
                    .fill(LinearGradient(
                        colors: gradientColors,
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    ))
                    .frame(width: 80, height: 60)
                    .clipShape(RoundedRectangle(cornerRadius: AppRadius.m))
                    .overlay {
                        Image(systemName: eventIcon)
                            .foregroundColor(.white.opacity(0.8))
                            .font(fontManager.scaledFont(.title2))
                    }
            }

            // Event info
            VStack(alignment: .leading, spacing: AppSpacing.xs) {
                HStack {
                    Text(event.title)
                        .font(fontManager.scaledFont(.headline))
                        .foregroundColor(AppColors.textPrimary)
                        .lineLimit(1)

                    Spacer()

                    statusBadge
                }

                HStack(spacing: AppSpacing.s) {
                    Label(eventTypeLabel, systemImage: eventIcon)
                        .font(fontManager.scaledFont(.caption))
                        .foregroundColor(AppColors.textSecondary)

                    Spacer()

                    Text(formatTimeRange)
                        .font(fontManager.scaledFont(.caption2))
                        .foregroundColor(AppColors.textSecondary)
                }

                if showJoinedDate, let joinedAt = event.joinedAt {
                    Text("\(NSLocalizedString("event.joined_at", comment: "Joined")): \(formatDate(joinedAt))")
                        .font(fontManager.scaledFont(.caption2))
                        .foregroundColor(AppColors.textSecondary)
                }
            }
        }
        .padding(AppSpacing.m)
        .background(Color(uiColor: .secondarySystemGroupedBackground))
        .cornerRadius(AppRadius.l)
    }

    // MARK: - Helpers

    private var statusBadge: some View {
        Text(statusText)
            .font(fontManager.scaledFont(.caption2).weight(.medium))
            .padding(.horizontal, AppSpacing.s)
            .padding(.vertical, 2)
            .background(statusColor)
            .foregroundColor(.white)
            .cornerRadius(AppRadius.s)
    }

    private var statusText: String {
        switch event.status {
        case "active": return NSLocalizedString("event.status.active", comment: "In Progress")
        case "published": return NSLocalizedString("event.status.published", comment: "Upcoming")
        case "ended": return NSLocalizedString("event.status.ended", comment: "Ended")
        case "draft": return NSLocalizedString("event.status.draft", comment: "Draft")
        default: return event.status.capitalized
        }
    }

    private var statusColor: Color {
        switch event.status {
        case "active": return .green
        case "published": return .blue
        case "ended": return .gray
        default: return .orange
        }
    }

    private var eventTypeLabel: String {
        switch event.type {
        case "leaderboard": return NSLocalizedString("event.type.leaderboard", comment: "Leaderboard")
        case "territory_control": return NSLocalizedString("event.type.territory", comment: "Territory War")
        case "cooperation": return NSLocalizedString("event.type.cooperation", comment: "Cooperation")
        case "war": return NSLocalizedString("event.type.war", comment: "Faction War")
        default: return event.type.capitalized
        }
    }

    private var eventIcon: String {
        switch event.type {
        case "leaderboard": return "chart.bar.fill"
        case "territory_control": return "flag.2.crossed.fill"
        case "cooperation": return "person.3.fill"
        case "war": return "shield.lefthalf.filled"
        default: return "star.fill"
        }
    }

    private var gradientColors: [Color] {
        switch event.type {
        case "leaderboard": return [.blue, .purple]
        case "territory_control": return [.red, .orange]
        case "cooperation": return [.green, .teal]
        case "war": return [.indigo, .pink]
        default: return [.blue, .cyan]
        }
    }

    private var formatTimeRange: String {
        let start = formatShortDate(event.startTime)
        let end = formatShortDate(event.endTime)
        return "\(start) - \(end)"
    }

    private func formatShortDate(_ dateString: String) -> String {
        let isoFormatter = ISO8601DateFormatter()
        isoFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = isoFormatter.date(from: dateString) {
            let formatter = DateFormatter()
            formatter.dateFormat = "M/d"
            return formatter.string(from: date)
        }
        return dateString.prefix(10).description
    }

    private func formatDate(_ dateString: String) -> String {
        let isoFormatter = ISO8601DateFormatter()
        isoFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = isoFormatter.date(from: dateString) {
            let formatter = DateFormatter()
            formatter.dateStyle = .short
            formatter.timeStyle = .short
            return formatter.string(from: date)
        }
        return dateString
    }
}

// MARK: - Preview

#Preview {
    VStack(spacing: 16) {
        EventCardView(event: EventService.UserEvent(
            id: "1",
            title: "Territory War Season 1",
            type: "territory_control",
            status: "active",
            startTime: "2024-01-15T10:00:00.000Z",
            endTime: "2024-01-22T18:00:00.000Z",
            bannerUrl: nil,
            joinedAt: "2024-01-15T12:30:00.000Z",
            participantType: "alliance"
        ), showJoinedDate: true)

        EventCardView(event: EventService.UserEvent(
            id: "2",
            title: "Leaderboard Sprint",
            type: "leaderboard",
            status: "published",
            startTime: "2024-02-01T00:00:00.000Z",
            endTime: "2024-02-07T23:59:59.000Z",
            bannerUrl: nil,
            joinedAt: nil,
            participantType: nil
        ))

        EventCardView(event: EventService.UserEvent(
            id: "3",
            title: "Cooperation Challenge",
            type: "cooperation",
            status: "ended",
            startTime: "2024-01-01T00:00:00.000Z",
            endTime: "2024-01-07T23:59:59.000Z",
            bannerUrl: nil,
            joinedAt: "2024-01-02T08:00:00.000Z",
            participantType: "user"
        ), showJoinedDate: true)
    }
    .padding()
    .background(Color(uiColor: .systemGroupedBackground))
}
