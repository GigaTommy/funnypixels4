import SwiftUI

/// 活动倒计时卡片 - 显示距离活动开始/结束的实时倒计时
struct EventCountdownCard: View {
    let event: EventService.Event
    @State private var timeRemaining: TimeInterval = 0
    @State private var timer: Timer?
    @ObservedObject private var fontManager = FontSizeManager.shared

    private enum CountdownType {
        case toStart
        case toEnd
        case ended
    }

    private var countdownType: CountdownType {
        guard let startDate = parseDate(event.startTime),
              let endDate = parseDate(event.endTime) else {
            return .ended
        }

        let now = Date()
        if now < startDate {
            return .toStart
        } else if now < endDate {
            return .toEnd
        } else {
            return .ended
        }
    }

    private var countdownTitle: String {
        switch countdownType {
        case .toStart:
            return NSLocalizedString("event.countdown.starts_in", comment: "Event starts in")
        case .toEnd:
            return NSLocalizedString("event.countdown.ends_in", comment: "Event ends in")
        case .ended:
            return NSLocalizedString("event.countdown.ended", comment: "Event has ended")
        }
    }

    private var countdownIcon: String {
        switch countdownType {
        case .toStart:
            return "clock.badge.exclamationmark"
        case .toEnd:
            return "hourglass"
        case .ended:
            return "flag.checkered.2.crossed"
        }
    }

    private var countdownColor: Color {
        switch countdownType {
        case .toStart:
            return .blue
        case .toEnd:
            if timeRemaining < 3600 { // Less than 1 hour
                return .red
            } else if timeRemaining < 24 * 3600 { // Less than 1 day
                return .orange
            } else {
                return .green
            }
        case .ended:
            return .gray
        }
    }

    private var formattedTimeRemaining: String {
        if countdownType == .ended {
            return NSLocalizedString("event.countdown.finished", comment: "Finished")
        }

        let days = Int(timeRemaining) / 86400
        let hours = (Int(timeRemaining) % 86400) / 3600
        let minutes = (Int(timeRemaining) % 3600) / 60
        let seconds = Int(timeRemaining) % 60

        if days > 0 {
            return String(format: NSLocalizedString("event.countdown.format.days", comment: "%dd %dh %dm"), days, hours, minutes)
        } else if hours > 0 {
            return String(format: NSLocalizedString("event.countdown.format.hours", comment: "%dh %dm %ds"), hours, minutes, seconds)
        } else if minutes > 0 {
            return String(format: NSLocalizedString("event.countdown.format.minutes", comment: "%dm %ds"), minutes, seconds)
        } else {
            return String(format: NSLocalizedString("event.countdown.format.seconds", comment: "%ds"), seconds)
        }
    }

    private var progressValue: Double {
        guard let startDate = parseDate(event.startTime),
              let endDate = parseDate(event.endTime) else {
            return 0
        }

        let totalDuration = endDate.timeIntervalSince(startDate)
        let elapsed = Date().timeIntervalSince(startDate)

        if elapsed < 0 {
            return 0 // Not started
        } else if elapsed > totalDuration {
            return 1 // Ended
        } else {
            return elapsed / totalDuration
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            // Header
            HStack(spacing: 8) {
                Image(systemName: countdownIcon)
                    .font(fontManager.scaledFont(.title3))
                    .foregroundColor(countdownColor)

                Text(countdownTitle)
                    .font(fontManager.scaledFont(.headline))
                    .foregroundColor(AppColors.textPrimary)

                Spacer()
            }

            // Countdown Display
            HStack {
                Spacer()

                Text(formattedTimeRemaining)
                    .font(.system(size: 34, weight: .bold, design: .rounded))
                    .foregroundColor(countdownColor)
                    .monospacedDigit()

                Spacer()
            }
            .padding(.vertical, 8)

            // Progress Bar (only for active events)
            if countdownType == .toEnd {
                VStack(spacing: 8) {
                    ProgressView(value: progressValue)
                        .tint(countdownColor)

                    HStack {
                        Text(formatDate(event.startTime))
                            .font(fontManager.scaledFont(.caption2))
                            .foregroundColor(AppColors.textTertiary)

                        Spacer()

                        Text(formatDate(event.endTime))
                            .font(fontManager.scaledFont(.caption2))
                            .foregroundColor(AppColors.textTertiary)
                    }
                }
            }

            // Status indicators
            HStack(spacing: 16) {
                statusIndicator(
                    icon: "calendar",
                    text: formatShortDate(event.startTime),
                    label: NSLocalizedString("event.countdown.start", comment: "Start")
                )

                Divider()
                    .frame(height: 30)

                statusIndicator(
                    icon: "flag.checkered",
                    text: formatShortDate(event.endTime),
                    label: NSLocalizedString("event.countdown.end", comment: "End")
                )
            }
        }
        .padding()
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(countdownColor.opacity(0.05))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(countdownColor.opacity(0.2), lineWidth: 1)
        )
        .onAppear {
            startTimer()
        }
        .onDisappear {
            timer?.invalidate()
        }
    }

    private func statusIndicator(icon: String, text: String, label: String) -> some View {
        HStack(spacing: 8) {
            Image(systemName: icon)
                .font(fontManager.scaledFont(.caption))
                .foregroundColor(.gray)

            VStack(alignment: .leading, spacing: 2) {
                Text(label)
                    .font(fontManager.scaledFont(.caption2))
                    .foregroundColor(AppColors.textTertiary)
                Text(text)
                    .font(fontManager.scaledFont(.caption))
                    .foregroundColor(AppColors.textSecondary)
            }
        }
    }

    private func startTimer() {
        updateTimeRemaining()
        timer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { _ in
            updateTimeRemaining()
        }
    }

    private func updateTimeRemaining() {
        switch countdownType {
        case .toStart:
            if let startDate = parseDate(event.startTime) {
                timeRemaining = max(0, startDate.timeIntervalSinceNow)
            }
        case .toEnd:
            if let endDate = parseDate(event.endTime) {
                timeRemaining = max(0, endDate.timeIntervalSinceNow)
            }
        case .ended:
            timeRemaining = 0
        }
    }

    private func parseDate(_ dateString: String) -> Date? {
        let isoFormatter = ISO8601DateFormatter()
        isoFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return isoFormatter.date(from: dateString)
    }

    private func formatDate(_ dateString: String) -> String {
        guard let date = parseDate(dateString) else { return dateString }
        let formatter = DateFormatter()
        formatter.dateStyle = .short
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }

    private func formatShortDate(_ dateString: String) -> String {
        guard let date = parseDate(dateString) else { return dateString }
        let formatter = DateFormatter()
        formatter.dateFormat = "MM/dd HH:mm"
        return formatter.string(from: date)
    }
}

// MARK: - Preview
#if DEBUG
struct EventCountdownCard_Previews: PreviewProvider {
    static var previews: some View {
        ScrollView {
            VStack(spacing: 16) {
                // Event starting soon
                EventCountdownCard(
                    event: EventService.Event(
                        id: "1",
                        title: "即将开始的活动",
                        type: "territory_control",
                        status: "published",
                        startTime: ISO8601DateFormatter().string(from: Date().addingTimeInterval(3600)), // 1 hour from now
                        endTime: ISO8601DateFormatter().string(from: Date().addingTimeInterval(7 * 24 * 3600)),
                        bannerUrl: nil,
                        boundary: nil,
                        config: nil,
                        gameplay: nil,
                        isParticipant: false
                    )
                )

                // Active event
                EventCountdownCard(
                    event: EventService.Event(
                        id: "2",
                        title: "进行中的活动",
                        type: "territory_control",
                        status: "active",
                        startTime: ISO8601DateFormatter().string(from: Date().addingTimeInterval(-24 * 3600)), // 1 day ago
                        endTime: ISO8601DateFormatter().string(from: Date().addingTimeInterval(2 * 24 * 3600)), // 2 days from now
                        bannerUrl: nil,
                        boundary: nil,
                        config: nil,
                        gameplay: nil,
                        isParticipant: false
                    )
                )

                // Ending soon
                EventCountdownCard(
                    event: EventService.Event(
                        id: "3",
                        title: "即将结束的活动",
                        type: "territory_control",
                        status: "active",
                        startTime: ISO8601DateFormatter().string(from: Date().addingTimeInterval(-7 * 24 * 3600)),
                        endTime: ISO8601DateFormatter().string(from: Date().addingTimeInterval(1800)), // 30 minutes from now
                        bannerUrl: nil,
                        boundary: nil,
                        config: nil,
                        gameplay: nil,
                        isParticipant: false
                    )
                )

                // Ended event
                EventCountdownCard(
                    event: EventService.Event(
                        id: "4",
                        title: "已结束的活动",
                        type: "territory_control",
                        status: "ended",
                        startTime: ISO8601DateFormatter().string(from: Date().addingTimeInterval(-10 * 24 * 3600)),
                        endTime: ISO8601DateFormatter().string(from: Date().addingTimeInterval(-3 * 24 * 3600)),
                        bannerUrl: nil,
                        boundary: nil,
                        config: nil,
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
