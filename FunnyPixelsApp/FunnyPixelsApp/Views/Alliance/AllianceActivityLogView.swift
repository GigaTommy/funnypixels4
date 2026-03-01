import SwiftUI
import Combine

// MARK: - Alliance Activity Log Section

struct AllianceActivityLogSection: View {
    let allianceId: Int
    @StateObject private var viewModel = AllianceActivityLogViewModel()
    @State private var isExpanded = false

    var body: some View {
        VStack(spacing: AppSpacing.m) {
            // Header
            Button(action: {
                withAnimation(.spring(response: 0.3, dampingFraction: 0.7)) {
                    isExpanded.toggle()
                }
            }) {
                HStack {
                    Image(systemName: "clock.arrow.circlepath")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundColor(AppColors.primary)

                    Text(NSLocalizedString("alliance.activity.title", comment: "Recent Activity"))
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundColor(AppColors.textPrimary)

                    Spacer()

                    Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundColor(AppColors.textTertiary)
                }
            }
            .buttonStyle(.plain)

            if isExpanded {
                if viewModel.isLoading {
                    ProgressView()
                        .frame(maxWidth: .infinity)
                        .padding()
                } else if viewModel.activities.isEmpty {
                    Text(NSLocalizedString("alliance.activity.empty", comment: "No recent activity"))
                        .font(AppTypography.caption())
                        .foregroundColor(AppColors.textSecondary)
                        .frame(maxWidth: .infinity)
                        .padding()
                } else {
                    VStack(spacing: 0) {
                        ForEach(viewModel.activities.prefix(10)) { activity in
                            ActivityLogRow(activity: activity)

                            if activity.id != viewModel.activities.prefix(10).last?.id {
                                Divider()
                                    .padding(.leading, 32)
                            }
                        }
                    }
                }
            }
        }
        .padding(AppSpacing.m)
        .background(AppColors.surface)
        .clipShape(RoundedRectangle(cornerRadius: AppRadius.l))
        .modifier(AppShadows.small())
        .task {
            await viewModel.load(allianceId: allianceId)
        }
    }
}

// MARK: - Activity Log Row

struct ActivityLogRow: View {
    let activity: AllianceService.ActivityLogEntry

    var body: some View {
        HStack(spacing: AppSpacing.s) {
            Image(systemName: iconForAction(activity.actionType))
                .font(.system(size: 12))
                .foregroundColor(colorForAction(activity.actionType))
                .frame(width: 24)

            VStack(alignment: .leading, spacing: 2) {
                Text(descriptionForActivity(activity))
                    .font(.system(size: 13))
                    .foregroundColor(AppColors.textPrimary)
                    .lineLimit(1)

                Text(formatDate(activity.createdAt))
                    .font(.system(size: 10))
                    .foregroundColor(AppColors.textTertiary)
            }

            Spacer()
        }
        .padding(.vertical, AppSpacing.s)
    }

    private func iconForAction(_ action: String) -> String {
        switch action {
        case "joined": return "person.badge.plus"
        case "left": return "person.badge.minus"
        case "kicked": return "xmark.circle"
        case "promoted": return "arrow.up.circle"
        case "demoted": return "arrow.down.circle"
        case "transfer": return "crown"
        case "checkin": return "checkmark.circle"
        case "levelup": return "star.fill"
        default: return "circle"
        }
    }

    private func colorForAction(_ action: String) -> Color {
        switch action {
        case "joined": return .green
        case "left", "kicked": return .red
        case "promoted": return .blue
        case "demoted": return .orange
        case "transfer": return .purple
        case "checkin": return AppColors.primary
        case "levelup": return .yellow
        default: return .gray
        }
    }

    private func descriptionForActivity(_ activity: AllianceService.ActivityLogEntry) -> String {
        let name = activity.username ?? "Unknown"
        switch activity.actionType {
        case "joined":
            return String(format: NSLocalizedString("alliance.activity.joined", comment: "%@ joined"), name)
        case "left":
            return String(format: NSLocalizedString("alliance.activity.left", comment: "%@ left"), name)
        case "kicked":
            return String(format: NSLocalizedString("alliance.activity.kicked", comment: "%@ was removed"), name)
        case "promoted":
            return String(format: NSLocalizedString("alliance.activity.promoted", comment: "%@ was promoted"), name)
        case "demoted":
            return String(format: NSLocalizedString("alliance.activity.demoted", comment: "%@ was demoted"), name)
        case "transfer":
            return String(format: NSLocalizedString("alliance.activity.transfer", comment: "%@ became leader"), name)
        case "checkin":
            return String(format: NSLocalizedString("alliance.activity.checkin", comment: "%@ checked in"), name)
        case "levelup":
            return String(format: NSLocalizedString("alliance.activity.levelup", comment: "Alliance leveled up to %@"), activity.detail ?? "?")
        default:
            return "\(name): \(activity.actionType)"
        }
    }

    private func formatDate(_ dateStr: String) -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = formatter.date(from: dateStr) {
            let displayFormatter = RelativeDateTimeFormatter()
            displayFormatter.unitsStyle = .short
            return displayFormatter.localizedString(for: date, relativeTo: Date())
        }
        return dateStr
    }
}

// MARK: - ViewModel

@MainActor
class AllianceActivityLogViewModel: ObservableObject {
    @Published var activities: [AllianceService.ActivityLogEntry] = []
    @Published var isLoading = false

    func load(allianceId: Int) async {
        isLoading = true
        defer { isLoading = false }

        do {
            activities = try await AllianceService.shared.getActivityLog(allianceId: allianceId)
        } catch {
            Logger.error("Failed to load activity log: \(error)")
        }
    }
}
