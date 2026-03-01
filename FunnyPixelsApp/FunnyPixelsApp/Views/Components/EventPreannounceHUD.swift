import Combine
import SwiftUI

/// Event Preannounce HUD - Displayed in top-left corner of map for upcoming events
/// Shows countdown, participant count, and quick actions
struct EventPreannounceHUD: View {
    let event: EventService.Event
    @State private var timeRemaining = ""
    @State private var showDetail = false
    @State private var timer: Timer?
    @State private var hasPlayedStartSound = false

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Header
            HStack(spacing: 6) {
                Image(systemName: "megaphone.fill")
                    .foregroundColor(.orange)
                Text(NSLocalizedString("event.preannounce.title", comment: "Event Preview"))
                    .font(.caption.weight(.bold))
                    .foregroundColor(.primary)
            }

            // Event Title
            Text(event.title)
                .font(.subheadline.weight(.semibold))
                .foregroundColor(.primary)
                .lineLimit(2)

            // Countdown
            HStack(spacing: 4) {
                Image(systemName: "clock.fill")
                    .font(.caption2)
                    .foregroundColor(.blue)
                Text(countdownLabel)
                    .font(.caption)
                    .foregroundColor(.secondary)
                Text(timeRemaining)
                    .font(.caption.weight(.bold).monospacedDigit())
                    .foregroundColor(isStartingSoon ? .red : .blue)
            }

            // Event Type Badge
            HStack(spacing: 6) {
                Image(systemName: eventIcon)
                    .font(.caption2)
                Text(eventTypeLabel)
                    .font(.caption2)
            }
            .foregroundColor(.secondary)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(Color.gray.opacity(0.1))
            .cornerRadius(4)

            // Action Button
            Button(action: { showDetail = true }) {
                HStack(spacing: 4) {
                    Text(NSLocalizedString("event.preannounce.view_detail", comment: "View Details"))
                        .font(.caption.weight(.medium))
                    Image(systemName: "chevron.right")
                        .font(.caption2)
                }
                .foregroundColor(.blue)
            }
            .padding(.top, 4)
        }
        .padding(12)
        .background(.regularMaterial)
        .cornerRadius(12)
        .shadow(color: .black.opacity(0.1), radius: 8, x: 0, y: 2)
        .frame(maxWidth: 220)
        .onAppear {
            startCountdownTimer()
        }
        .onDisappear {
            timer?.invalidate()
        }
        .sheet(isPresented: $showDetail) {
            NavigationStack {
                EventDetailView(event: event)
                    .navigationBarItems(trailing: Button(NSLocalizedString("common.close", comment: "Close")) {
                        showDetail = false
                    })
            }
        }
    }

    // MARK: - Helpers

    private var countdownLabel: String {
        if isStartingSoon {
            return NSLocalizedString("event.preannounce.starting_soon", comment: "Starting in")
        } else {
            return NSLocalizedString("event.preannounce.starts_in", comment: "Starts in")
        }
    }

    private var isStartingSoon: Bool {
        guard let startDate = parseDate(event.startTime) else { return false }
        return startDate.timeIntervalSinceNow < 3600 // Less than 1 hour
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

    private var eventTypeLabel: String {
        switch event.type {
        case "leaderboard": return NSLocalizedString("event.type.leaderboard", comment: "Leaderboard")
        case "territory_control": return NSLocalizedString("event.type.territory", comment: "Territory War")
        case "cooperation": return NSLocalizedString("event.type.cooperation", comment: "Cooperation")
        case "war": return NSLocalizedString("event.type.war", comment: "Faction War")
        default: return event.type.capitalized
        }
    }

    private func startCountdownTimer() {
        updateTimeRemaining()
        timer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { _ in
            updateTimeRemaining()
        }
    }

    private func updateTimeRemaining() {
        guard let startDate = parseDate(event.startTime) else {
            timeRemaining = "--:--:--"
            return
        }

        let interval = startDate.timeIntervalSinceNow
        if interval <= 0 {
            timeRemaining = NSLocalizedString("event.preannounce.started", comment: "Started!")
            timer?.invalidate()

            // ✨ Event start feedback (only once)
            if !hasPlayedStartSound {
                SoundManager.shared.play(.eventStart)
                HapticManager.shared.notification(type: .success)
                hasPlayedStartSound = true
            }

            return
        }

        // Reset flag when countdown is active
        hasPlayedStartSound = false

        let days = Int(interval) / 86400
        let hours = (Int(interval) % 86400) / 3600
        let minutes = (Int(interval) % 3600) / 60
        let seconds = Int(interval) % 60

        if days > 0 {
            timeRemaining = String(format: "%dd %02d:%02d:%02d", days, hours, minutes, seconds)
        } else {
            timeRemaining = String(format: "%02d:%02d:%02d", hours, minutes, seconds)
        }
    }

    private func parseDate(_ dateString: String) -> Date? {
        let isoFormatter = ISO8601DateFormatter()
        isoFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return isoFormatter.date(from: dateString)
    }
}

// MARK: - Preview

#Preview {
    ZStack {
        Color.gray.opacity(0.3)
            .ignoresSafeArea()

        VStack {
            HStack {
                EventPreannounceHUD(event: EventService.previewEvent())
                .padding()
                Spacer()
            }
            Spacer()
        }
    }
}
