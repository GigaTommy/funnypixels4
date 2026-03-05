import SwiftUI
import Combine

// MARK: - Alliance Contribution Ranking Section

struct AllianceContributionSection: View {
    @ObservedObject private var fontManager = FontSizeManager.shared
    let allianceId: Int
    @StateObject private var viewModel = AllianceContributionViewModel()

    var body: some View {
        VStack(spacing: 12) {
            // Header
            HStack {
                Image(systemName: "trophy.fill")
                    .responsiveFont(.subheadline, weight: .semibold)
                    .foregroundColor(.orange)

                Text(NSLocalizedString("alliance.contribution.title", comment: "Contribution Ranking"))
                    .responsiveFont(.subheadline, weight: .semibold)
                    .foregroundColor(AppColors.textPrimary)

                Spacer()

                NavigationLink {
                    AllianceContributionFullView(allianceId: allianceId)
                } label: {
                    HStack(spacing: 2) {
                        Text(NSLocalizedString("alliance.contribution.view_all", comment: "View All"))
                            .responsiveFont(.caption2)
                        Image(systemName: "chevron.right")
                            .responsiveFont(.caption2)
                    }
                    .foregroundColor(.secondary)
                }
            }

            if viewModel.isLoading {
                ProgressView()
                    .frame(maxWidth: .infinity)
                    .padding()
            } else if viewModel.contributions.isEmpty {
                Text(NSLocalizedString("alliance.contribution.empty", comment: "No contributions yet"))
                    .responsiveFont(.caption)
                    .foregroundColor(.secondary)
                    .frame(maxWidth: .infinity)
                    .padding()
            } else {
                VStack(spacing: 0) {
                    ForEach(viewModel.contributions.prefix(5)) { entry in
                        ContributionRow(entry: entry)

                        if entry.rank < min(5, viewModel.contributions.count) {
                            Divider()
                                .padding(.leading, 44)
                        }
                    }
                }
            }
        }
        .padding(12)
        .background(AppColors.surface)
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .modifier(AppShadows.small())
        .task {
            await viewModel.load(allianceId: allianceId)
        }
    }
}

// MARK: - Contribution Row

struct ContributionRow: View {
    let entry: AllianceService.ContributionEntry

    var body: some View {
        HStack(spacing: 10) {
            // Rank
            rankBadge(entry.rank)

            // Avatar
            contributionAvatar

            // Name + role
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 4) {
                    Text(entry.displayName ?? entry.username)
                        .responsiveFont(.footnote)
                        .foregroundColor(entry.isCurrentUser ? AppColors.primary : AppColors.textPrimary)
                        .lineLimit(1)

                    if entry.role == "leader" {
                        Image(systemName: "crown.fill")
                            .responsiveFont(.caption2)
                            .foregroundColor(.orange)
                    }
                }

                HStack(spacing: 8) {
                    Label("\(entry.totalPixels)", systemImage: "square.grid.3x3.fill")
                        .responsiveFont(.caption2)
                        .foregroundColor(.secondary)

                    if entry.checkinCount > 0 {
                        Label("\(entry.checkinCount)", systemImage: "calendar.badge.checkmark")
                            .responsiveFont(.caption2)
                            .foregroundColor(.secondary)
                    }
                }
            }

            Spacer()
        }
        .padding(.vertical, 8)
    }

    private var contributionAvatar: some View {
        Group {
            if let avatarUrl = entry.avatarUrl, !avatarUrl.isEmpty,
               let url = URL(string: avatarUrl) {
                AsyncImage(url: url) { image in
                    image.resizable().scaledToFill()
                } placeholder: {
                    initialsView
                }
                .frame(width: 32, height: 32)
                .clipShape(Circle())
            } else {
                initialsView
            }
        }
    }

    private var initialsView: some View {
        let name = entry.displayName ?? entry.username
        let initial = String(name.prefix(1)).uppercased()
        return Text(initial)
            .responsiveFont(.footnote)
            .foregroundColor(.white)
            .frame(width: 32, height: 32)
            .background(Color.blue.opacity(0.6))
            .clipShape(Circle())
    }

    private func rankBadge(_ rank: Int) -> some View {
        Group {
            if rank <= 3 {
                Image(systemName: "medal.fill")
                    .responsiveFont(.subheadline)
                    .foregroundColor(rankColor(rank))
                    .frame(width: 24)
            } else {
                Text("\(rank)")
                    .responsiveFont(.caption)
                    .foregroundColor(.secondary)
                    .frame(width: 24)
            }
        }
    }

    private func rankColor(_ rank: Int) -> Color {
        switch rank {
        case 1: return .yellow
        case 2: return .gray
        case 3: return .orange
        default: return .secondary
        }
    }
}

// MARK: - ViewModel

@MainActor
class AllianceContributionViewModel: ObservableObject {
    @Published var contributions: [AllianceService.ContributionEntry] = []
    @Published var isLoading = false

    func load(allianceId: Int) async {
        isLoading = true
        defer { isLoading = false }

        do {
            contributions = try await AllianceService.shared.getMemberContributions(allianceId: allianceId, limit: 5)
        } catch {
            Logger.error("Failed to load contributions: \(error)")
        }
    }
}
