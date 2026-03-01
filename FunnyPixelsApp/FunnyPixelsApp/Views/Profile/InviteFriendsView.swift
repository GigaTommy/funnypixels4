import SwiftUI
import Combine

/// View for sharing invite code and viewing referral stats
struct InviteFriendsView: View {
    @StateObject private var viewModel = InviteFriendsViewModel()
    @Environment(\.dismiss) var dismiss

    var body: some View {
        ScrollView {
            VStack(spacing: 24) {
                // Hero section
                VStack(spacing: 12) {
                    Image(systemName: "gift.fill")
                        .font(.system(size: 48))
                        .foregroundStyle(
                            LinearGradient(
                                colors: [.orange, .pink],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )

                    Text(NSLocalizedString("invite.title", comment: ""))
                        .font(AppTypography.title2())
                        .foregroundColor(AppColors.textPrimary)

                    Text(NSLocalizedString("invite.subtitle", comment: ""))
                        .font(AppTypography.body())
                        .foregroundColor(AppColors.textSecondary)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal)
                }
                .padding(.top, 20)

                // Invite code card
                if let code = viewModel.referralCode {
                    StandardCard(padding: AppSpacing.l) {
                        VStack(spacing: 16) {
                            Text(NSLocalizedString("invite.your_code", comment: ""))
                                .font(AppTypography.caption())
                                .foregroundColor(AppColors.textSecondary)

                            Text(code)
                                .font(.system(size: 32, weight: .bold, design: .monospaced))
                                .foregroundColor(AppColors.primary)
                                .tracking(4)

                            HStack(spacing: 12) {
                                Button(action: {
                                    UIPasteboard.general.string = code
                                    viewModel.showCopied = true
                                    DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
                                        viewModel.showCopied = false
                                    }
                                }) {
                                    Label(
                                        viewModel.showCopied
                                            ? NSLocalizedString("invite.copied", comment: "")
                                            : NSLocalizedString("invite.copy", comment: ""),
                                        systemImage: viewModel.showCopied ? "checkmark" : "doc.on.doc"
                                    )
                                    .font(AppTypography.subheadline())
                                    .frame(maxWidth: .infinity)
                                    .padding(.vertical, 12)
                                    .background(
                                        RoundedRectangle(cornerRadius: 10)
                                            .fill(viewModel.showCopied ? Color.green.opacity(0.15) : AppColors.primary.opacity(0.1))
                                    )
                                    .foregroundColor(viewModel.showCopied ? .green : AppColors.primary)
                                }

                                Button(action: { viewModel.shareCode() }) {
                                    Label(NSLocalizedString("invite.share", comment: ""), systemImage: "square.and.arrow.up")
                                        .font(AppTypography.subheadline())
                                        .frame(maxWidth: .infinity)
                                        .padding(.vertical, 12)
                                        .background(
                                            RoundedRectangle(cornerRadius: 10)
                                                .fill(AppColors.primary)
                                        )
                                        .foregroundColor(.white)
                                }
                            }
                        }
                    }
                } else if viewModel.isLoading {
                    ProgressView()
                        .padding()
                }

                // Rewards info
                StandardCard(padding: AppSpacing.l) {
                    VStack(alignment: .leading, spacing: 12) {
                        Text(NSLocalizedString("invite.rewards_title", comment: ""))
                            .font(AppTypography.headline())
                            .foregroundColor(AppColors.textPrimary)

                        InviteRewardInfoRow(
                            icon: "person.badge.plus",
                            color: .orange,
                            text: String(format: NSLocalizedString("invite.inviter_reward", comment: ""), viewModel.rewardPerInvite)
                        )

                        InviteRewardInfoRow(
                            icon: "person.crop.circle.badge.checkmark",
                            color: .green,
                            text: String(format: NSLocalizedString("invite.invitee_reward", comment: ""), viewModel.inviteeReward)
                        )

                        Divider()

                        HStack {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(NSLocalizedString("invite.stats_invited", comment: ""))
                                    .font(AppTypography.caption())
                                    .foregroundColor(AppColors.textSecondary)
                                Text("\(viewModel.totalInvites)")
                                    .font(AppTypography.title3())
                                    .foregroundColor(AppColors.textPrimary)
                            }

                            Spacer()

                            VStack(alignment: .trailing, spacing: 4) {
                                Text(NSLocalizedString("invite.stats_earned", comment: ""))
                                    .font(AppTypography.caption())
                                    .foregroundColor(AppColors.textSecondary)
                                Text("\(viewModel.totalRewardsEarned) / \(viewModel.maxRewards)")
                                    .font(AppTypography.title3())
                                    .foregroundColor(AppColors.warning)
                            }
                        }
                    }
                }

                // Redeem code section
                StandardCard(padding: AppSpacing.l) {
                    VStack(alignment: .leading, spacing: 12) {
                        Text(NSLocalizedString("invite.redeem_title", comment: ""))
                            .font(AppTypography.headline())
                            .foregroundColor(AppColors.textPrimary)

                        HStack(spacing: 8) {
                            TextField(NSLocalizedString("invite.redeem_placeholder", comment: ""), text: $viewModel.redeemInput)
                                .textFieldStyle(.roundedBorder)
                                .textInputAutocapitalization(.characters)
                                .font(.system(.body, design: .monospaced))

                            Button(action: { viewModel.redeem() }) {
                                if viewModel.isRedeeming {
                                    ProgressView()
                                        .frame(width: 60)
                                } else {
                                    Text(NSLocalizedString("invite.redeem_button", comment: ""))
                                        .font(AppTypography.subheadline())
                                        .frame(width: 60)
                                }
                            }
                            .buttonStyle(.borderedProminent)
                            .disabled(viewModel.redeemInput.count != 8 || viewModel.isRedeeming)
                        }

                        if let message = viewModel.redeemMessage {
                            Text(message)
                                .font(AppTypography.caption())
                                .foregroundColor(viewModel.redeemSuccess ? .green : .red)
                        }
                    }
                }
            }
            .padding()
        }
        .navigationTitle(NSLocalizedString("invite.nav_title", comment: ""))
        .navigationBarTitleDisplayMode(.inline)
        .hideTabBar()
        .task {
            await viewModel.load()
        }
        .sheet(isPresented: $viewModel.showShareSheet) {
            if let shareText = viewModel.shareURL {
                InviteShareSheet(activityItems: [shareText])
            }
        }
    }
}

// MARK: - Subviews

private struct InviteRewardInfoRow: View {
    let icon: String
    let color: Color
    let text: String

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: icon)
                .font(.body)
                .foregroundColor(color)
                .frame(width: 28)

            Text(text)
                .font(AppTypography.body())
                .foregroundColor(AppColors.textPrimary)
        }
    }
}

/// UIActivityViewController wrapper for invite sharing
private struct InviteShareSheet: UIViewControllerRepresentable {
    let activityItems: [Any]

    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: activityItems, applicationActivities: nil)
    }

    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}

// MARK: - ViewModel

@MainActor
class InviteFriendsViewModel: ObservableObject {
    @Published var referralCode: String?
    @Published var isLoading = false
    @Published var showCopied = false
    @Published var totalInvites = 0
    @Published var totalRewardsEarned = 0
    @Published var maxRewards = 500
    @Published var rewardPerInvite = 50
    @Published var inviteeReward = 20

    // Redeem
    @Published var redeemInput = ""
    @Published var isRedeeming = false
    @Published var redeemMessage: String?
    @Published var redeemSuccess = false

    // Share
    @Published var showShareSheet = false
    var shareURL: String?

    func load() async {
        isLoading = true
        defer { isLoading = false }

        do {
            let code = try await ReferralService.shared.getMyCode()
            referralCode = code

            let stats = try await ReferralService.shared.getStats()
            totalInvites = stats.totalInvites
            totalRewardsEarned = stats.totalRewardsEarned
            maxRewards = stats.maxRewards
            rewardPerInvite = stats.rewardPerInvite
            inviteeReward = stats.inviteeReward
        } catch {
            Logger.error("Failed to load referral data: \(error)")
        }
    }

    func shareCode() {
        guard let code = referralCode else { return }
        let message = String(format: NSLocalizedString("invite.share_message", comment: ""), code)
        let link = "https://funnypixels.com/link/invite/\(code)"
        shareURL = "\(message)\n\(link)"
        showShareSheet = true
    }

    func redeem() {
        guard redeemInput.count == 8 else { return }
        isRedeeming = true
        redeemMessage = nil

        Task {
            do {
                let result = try await ReferralService.shared.redeemCode(redeemInput)
                if result.success {
                    redeemSuccess = true
                    let reward = result.inviteeReward ?? 0
                    redeemMessage = String(format: NSLocalizedString("invite.redeem_success", comment: ""), reward)
                    redeemInput = ""
                } else {
                    redeemSuccess = false
                    switch result.error {
                    case "INVALID_CODE":
                        redeemMessage = NSLocalizedString("invite.error_invalid", comment: "")
                    case "SELF_REFERRAL":
                        redeemMessage = NSLocalizedString("invite.error_self", comment: "")
                    case "ALREADY_REFERRED":
                        redeemMessage = NSLocalizedString("invite.error_already", comment: "")
                    default:
                        redeemMessage = NSLocalizedString("invite.error_generic", comment: "")
                    }
                }
            } catch {
                redeemSuccess = false
                redeemMessage = NSLocalizedString("invite.error_generic", comment: "")
            }
            isRedeeming = false
        }
    }
}
