import SwiftUI

/// P1-1: Upcoming Event Card - Large, prominent card for events not yet started
/// Features: Countdown timer, signup stats, join button
struct UpcomingEventCard: View {
    let event: EventService.Event
    @ObservedObject private var fontManager = FontSizeManager.shared
    @State private var timeRemaining: String = ""
    @State private var timer: Timer?

    var body: some View {
        VStack(alignment: .leading, spacing: AppSpacing.m) {
            // Header: Event Title & Type
            VStack(alignment: .leading, spacing: AppSpacing.xs) {
                Text(event.title)
                    .font(fontManager.scaledFont(.headline).weight(.bold))
                    .foregroundColor(AppColors.textPrimary)
                    .lineLimit(2)

                HStack(spacing: 4) {
                    Image(systemName: eventTypeIcon)
                        .font(fontManager.scaledFont(.caption2))
                    Text(eventTypeName)
                        .font(fontManager.scaledFont(.caption))
                }
                .foregroundColor(AppColors.textSecondary)
            }

            Divider()

            // Countdown Section
            HStack(spacing: AppSpacing.s) {
                Image(systemName: "clock.fill")
                    .font(fontManager.scaledFont(.title3))
                    .foregroundColor(.orange)

                VStack(alignment: .leading, spacing: 2) {
                    Text(NSLocalizedString("event.upcoming.starts_in", comment: "Starts in"))
                        .font(fontManager.scaledFont(.caption2))
                        .foregroundColor(AppColors.textSecondary)

                    Text(timeRemaining)
                        .font(fontManager.scaledFont(.subheadline).weight(.semibold))
                        .foregroundColor(.orange)
                        .monospacedDigit()
                }
            }

            // Signup Stats (P0-1 SignupStats)
            if let signupStats = event.signupStats {
                HStack(spacing: AppSpacing.m) {
                    // Registered participants
                    HStack(spacing: 4) {
                        Image(systemName: "person.3.fill")
                            .font(fontManager.scaledFont(.caption))
                            .foregroundColor(.green)
                        Text("\(signupStats.estimatedParticipants)")
                            .font(fontManager.scaledFont(.subheadline).weight(.medium))
                            .foregroundColor(AppColors.textPrimary)
                    }

                    Spacer()

                    // Join status indicator
                    if event.isParticipant {
                        HStack(spacing: 4) {
                            Image(systemName: "checkmark.circle.fill")
                                .font(fontManager.scaledFont(.caption))
                                .foregroundColor(.green)
                            Text(NSLocalizedString("event.upcoming.joined", comment: "Joined"))
                                .font(fontManager.scaledFont(.caption).weight(.medium))
                                .foregroundColor(.green)
                        }
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(Color.green.opacity(0.1))
                        .cornerRadius(AppRadius.s)
                    }
                }
            }

            // P2-2: Difficulty Rating (compact)
            if let gameplay = event.gameplay {
                DifficultyRatingView(difficulty: gameplay.difficulty, compact: true)
            }

            // Join Button (if not already joined)
            if !event.isParticipant {
                Button(action: {
                    // Join action - would trigger enrollment
                }) {
                    HStack {
                        Image(systemName: "calendar.badge.plus")
                            .font(fontManager.scaledFont(.subheadline).weight(.semibold))
                        Text(NSLocalizedString("event.upcoming.join_now", comment: "Join Now"))
                            .font(fontManager.scaledFont(.subheadline).weight(.semibold))
                    }
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .background(
                        LinearGradient(
                            colors: [AppColors.primary, AppColors.primary.opacity(0.8)],
                            startPoint: .leading,
                            endPoint: .trailing
                        )
                    )
                    .cornerRadius(AppRadius.m)
                }
            }
        }
        .padding(AppSpacing.m)
        .frame(width: 280) // Fixed width for horizontal scroll
        .background(Color(uiColor: .tertiarySystemGroupedBackground))
        .cornerRadius(AppRadius.l)
        .shadow(color: .black.opacity(0.05), radius: 8, x: 0, y: 4)
        .overlay(
            RoundedRectangle(cornerRadius: AppRadius.l)
                .strokeBorder(
                    LinearGradient(
                        colors: [AppColors.primary.opacity(0.3), AppColors.primary.opacity(0.1)],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    ),
                    lineWidth: 1
                )
        )
        .onAppear {
            updateCountdown()
            startTimer()
        }
        .onDisappear {
            timer?.invalidate()
        }
    }

    // MARK: - Helpers

    private var eventTypeIcon: String {
        switch event.type {
        case "flash_war": return "bolt.fill"
        case "rally": return "flag.fill"
        case "treasure_hunt": return "map.fill"
        default: return "star.fill"
        }
    }

    private var eventTypeName: String {
        switch event.type {
        case "flash_war": return NSLocalizedString("event.type.flash_war", comment: "Flash War")
        case "rally": return NSLocalizedString("event.type.rally", comment: "Rally")
        case "treasure_hunt": return NSLocalizedString("event.type.treasure_hunt", comment: "Treasure Hunt")
        default: return event.type
        }
    }

    private func updateCountdown() {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]

        guard let startDate = formatter.date(from: event.startTime) else {
            timeRemaining = "--"
            return
        }

        let now = Date()
        let interval = startDate.timeIntervalSince(now)

        if interval <= 0 {
            timeRemaining = NSLocalizedString("event.upcoming.starting_soon", comment: "Starting soon")
            timer?.invalidate()
            return
        }

        let days = Int(interval) / 86400
        let hours = (Int(interval) % 86400) / 3600
        let minutes = (Int(interval) % 3600) / 60

        if days > 0 {
            timeRemaining = String(format: NSLocalizedString("event.upcoming.days_hours", comment: "%dd %dh"), days, hours)
        } else if hours > 0 {
            timeRemaining = String(format: NSLocalizedString("event.upcoming.hours_minutes", comment: "%dh %dm"), hours, minutes)
        } else {
            timeRemaining = String(format: NSLocalizedString("event.upcoming.minutes", comment: "%d minutes"), minutes)
        }
    }

    private func startTimer() {
        timer = Timer.scheduledTimer(withTimeInterval: 60, repeats: true) { _ in
            updateCountdown()
        }
    }
}

// MARK: - Preview

#Preview {
    ScrollView(.horizontal) {
        HStack(spacing: 16) {
            UpcomingEventCard(event: EventService.Event(
                id: "1",
                title: "Weekend Flash War",
                type: "flash_war",
                status: "published",
                startTime: Calendar.current.date(byAdding: .hour, value: 6, to: Date())!.ISO8601Format(),
                endTime: Calendar.current.date(byAdding: .hour, value: 12, to: Date())!.ISO8601Format(),
                isParticipant: false
            ))

            UpcomingEventCard(event: EventService.Event(
                id: "2",
                title: "City Rally Challenge - Explore & Conquer",
                type: "rally",
                status: "published",
                startTime: Calendar.current.date(byAdding: .day, value: 2, to: Date())!.ISO8601Format(),
                endTime: Calendar.current.date(byAdding: .day, value: 3, to: Date())!.ISO8601Format(),
                isParticipant: true
            ))
        }
        .padding()
    }
}
