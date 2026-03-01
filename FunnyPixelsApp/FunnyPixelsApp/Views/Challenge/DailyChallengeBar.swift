import SwiftUI
import Combine

/// Compact daily challenge progress bar displayed above the drawing control panel
struct DailyChallengeBar: View {
    @StateObject private var viewModel = DailyChallengeViewModel()

    var body: some View {
        if let challenge = viewModel.challenge {
            HStack(spacing: 10) {
                // Challenge icon
                Image(systemName: challengeIcon(challenge.type))
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundColor(challenge.isCompleted == true ? .yellow : .white.opacity(0.8))

                // Title + progress
                VStack(alignment: .leading, spacing: 3) {
                    Text(challenge.title ?? NSLocalizedString("challenge.title", comment: "Daily Challenge"))
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundColor(.white)
                        .lineLimit(1)

                    // Progress bar
                    GeometryReader { geo in
                        ZStack(alignment: .leading) {
                            Capsule()
                                .fill(Color.white.opacity(0.2))
                                .frame(height: 4)
                            Capsule()
                                .fill(challenge.isCompleted == true ? Color.yellow : Color.green)
                                .frame(width: geo.size.width * challenge.progress, height: 4)
                                .animation(.easeInOut(duration: 0.3), value: challenge.progress)
                        }
                    }
                    .frame(height: 4)
                }
                .frame(maxWidth: .infinity)

                // Progress text or claim button
                if challenge.isCompleted == true && challenge.isClaimed != true {
                    Button(action: {
                        Task { await viewModel.claimReward() }
                    }) {
                        Text(NSLocalizedString("challenge.claim", comment: "Claim"))
                            .font(.system(size: 11, weight: .bold))
                            .foregroundColor(.black)
                            .padding(.horizontal, 10)
                            .padding(.vertical, 4)
                            .background(Capsule().fill(Color.yellow))
                    }
                } else if challenge.isClaimed == true {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 16))
                        .foregroundColor(.yellow)
                } else {
                    Text(challenge.progressText)
                        .font(.system(size: 11, weight: .semibold).monospacedDigit())
                        .foregroundColor(.white.opacity(0.7))
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 8)
            .background(
                Capsule()
                    .fill(Color.black.opacity(0.6))
                    .background(
                        Capsule()
                            .fill(.ultraThinMaterial)
                    )
                    .clipShape(Capsule())
            )
            .padding(.horizontal, 20)
        }
    }

    private func challengeIcon(_ type: String?) -> String {
        switch type {
        case "draw_count": return "paintbrush.pointed.fill"
        case "region_draw": return "map.fill"
        case "pattern_draw": return "star.fill"
        default: return "target"
        }
    }
}

// MARK: - ViewModel

@MainActor
class DailyChallengeViewModel: ObservableObject {
    @Published var challenge: ChallengeService.Challenge?

    init() {
        Task { await loadChallenge() }
    }

    func loadChallenge() async {
        do {
            challenge = try await ChallengeService.shared.getTodayChallenge()
        } catch {
            Logger.error("获取每日挑战失败: \(error)")
        }
    }

    func claimReward() async {
        guard let challenge = challenge, challenge.isCompleted == true else { return }
        do {
            let reward = try await ChallengeService.shared.claimReward(challengeId: challenge.id)
            SoundManager.shared.playSuccess()
            // Refresh challenge state
            await loadChallenge()
            Logger.info("每日挑战奖励领取: +\(reward) 积分")
        } catch {
            Logger.error("领取奖励失败: \(error)")
            SoundManager.shared.playFailure()
        }
    }

    func refreshProgress() async {
        await loadChallenge()
    }
}
