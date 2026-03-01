import SwiftUI
import Combine

// MARK: - Full-Page Contribution Ranking View

struct AllianceContributionFullView: View {
    let allianceId: Int
    @StateObject private var viewModel = AllianceContributionFullViewModel()

    var body: some View {
        Group {
            if viewModel.isLoading && viewModel.contributions.isEmpty {
                ProgressView()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if let error = viewModel.errorMessage, viewModel.contributions.isEmpty {
                VStack(spacing: 16) {
                    Image(systemName: "exclamationmark.triangle")
                        .font(.system(size: 40))
                        .foregroundColor(.secondary)
                    Text(error)
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                        .multilineTextAlignment(.center)
                    Button(NSLocalizedString("policy.retry", comment: "Retry")) {
                        Task { await viewModel.load(allianceId: allianceId) }
                    }
                    .buttonStyle(.bordered)
                }
                .padding()
            } else if viewModel.contributions.isEmpty {
                VStack(spacing: 12) {
                    Image(systemName: "trophy")
                        .font(.system(size: 40))
                        .foregroundColor(.secondary)
                    Text(NSLocalizedString("alliance.contribution.empty.title", comment: "No Rankings"))
                        .font(.headline)
                        .foregroundColor(.secondary)
                    Text(NSLocalizedString("alliance.contribution.empty.message", comment: "Members have not contributed pixels yet."))
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                        .multilineTextAlignment(.center)
                }
                .padding()
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                List {
                    // Show current user's rank at top if ranked > 3
                    if let currentUser = viewModel.currentUserEntry, currentUser.rank > 3 {
                        Section(header: Text(NSLocalizedString("alliance.contribution.you", comment: "Your Ranking"))) {
                            ContributionRow(entry: currentUser)
                        }
                    }

                    Section(header: Text(NSLocalizedString("alliance.contribution.all", comment: "All Members"))) {
                        ForEach(viewModel.contributions) { entry in
                            ContributionRow(entry: entry)
                        }
                    }
                }
                .listStyle(.insetGrouped)
            }
        }
        .navigationTitle(NSLocalizedString("alliance.contribution.title", comment: "Contribution Ranking"))
        .navigationBarTitleDisplayMode(.inline)
        .hideTabBar()
        .background(AppColors.background)
        .task {
            await viewModel.load(allianceId: allianceId)
        }
        .refreshable {
            await viewModel.load(allianceId: allianceId)
        }
    }
}

// MARK: - ViewModel

@MainActor
class AllianceContributionFullViewModel: ObservableObject {
    @Published var contributions: [AllianceService.ContributionEntry] = []
    @Published var isLoading = false
    @Published var errorMessage: String?

    var currentUserEntry: AllianceService.ContributionEntry? {
        contributions.first(where: { $0.isCurrentUser })
    }

    func load(allianceId: Int) async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        do {
            contributions = try await AllianceService.shared.getMemberContributions(allianceId: allianceId, limit: 100)
        } catch {
            errorMessage = error.localizedDescription
            Logger.error("Failed to load full contributions: \(error)")
        }
    }
}
