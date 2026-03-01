import SwiftUI
import Combine

// MARK: - Alliance Checkin Section

struct AllianceCheckinSection: View {
    let allianceId: Int
    @StateObject private var viewModel = AllianceCheckinViewModel()

    var body: some View {
        VStack(spacing: 12) {
            // Header
            HStack {
                Image(systemName: "calendar.badge.checkmark")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundColor(AppColors.primary)

                Text(NSLocalizedString("alliance.checkin.title", comment: "Daily Check-in"))
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundColor(AppColors.textPrimary)

                Spacer()

                if viewModel.streak > 0 {
                    HStack(spacing: 2) {
                        Image(systemName: "flame.fill")
                            .font(.system(size: 10))
                            .foregroundColor(.orange)
                        Text("\(viewModel.streak)")
                            .font(.system(size: 11, weight: .bold))
                            .foregroundColor(.orange)
                    }
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(Color.orange.opacity(0.1))
                    .clipShape(Capsule())
                }
            }

            // Checkin button
            Button(action: {
                Task { await viewModel.checkin(allianceId: allianceId) }
            }) {
                HStack(spacing: 6) {
                    if viewModel.isCheckinLoading {
                        ProgressView()
                            .scaleEffect(0.8)
                    } else {
                        Image(systemName: viewModel.hasCheckedIn ? "checkmark.circle.fill" : "hand.tap.fill")
                            .font(.system(size: 16))
                    }
                    Text(viewModel.hasCheckedIn
                         ? NSLocalizedString("alliance.checkin.done", comment: "Checked In")
                         : NSLocalizedString("alliance.checkin.button", comment: "Check In"))
                        .font(.system(size: 14, weight: .semibold))
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 10)
                .background(
                    RoundedRectangle(cornerRadius: 10)
                        .fill(viewModel.hasCheckedIn
                              ? LinearGradient(colors: [Color(.systemGray5), Color(.systemGray5)],
                                               startPoint: .leading, endPoint: .trailing)
                              : LinearGradient(colors: [AppColors.primary, AppColors.primary.opacity(0.8)],
                                               startPoint: .leading, endPoint: .trailing))
                )
                .foregroundColor(viewModel.hasCheckedIn ? .secondary : .white)
                .clipShape(RoundedRectangle(cornerRadius: 10))
            }
            .disabled(viewModel.hasCheckedIn || viewModel.isCheckinLoading)

            // Exp earned toast
            if let expEarned = viewModel.expEarned {
                HStack(spacing: 4) {
                    Image(systemName: "star.fill")
                        .font(.system(size: 12))
                        .foregroundColor(.yellow)
                    Text("+\(expEarned) EXP")
                        .font(.system(size: 13, weight: .bold))
                        .foregroundColor(.orange)
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .background(Color.orange.opacity(0.1))
                .clipShape(Capsule())
                .transition(.scale(scale: 0.5).combined(with: .opacity))
            }

            // Checked-in members
            if !viewModel.checkedInMembers.isEmpty {
                VStack(alignment: .leading, spacing: 6) {
                    Text(String(format: NSLocalizedString("alliance.checkin.today_count", comment: "Today: %d checked in"),
                                viewModel.todayCount))
                        .font(.system(size: 11))
                        .foregroundColor(.secondary)

                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: -6) {
                            ForEach(viewModel.checkedInMembers.prefix(20)) { member in
                                checkinMemberAvatar(member)
                            }
                            if viewModel.checkedInMembers.count > 20 {
                                Text("+\(viewModel.checkedInMembers.count - 20)")
                                    .font(.system(size: 9, weight: .bold))
                                    .foregroundColor(.white)
                                    .frame(width: 28, height: 28)
                                    .background(Color.gray)
                                    .clipShape(Circle())
                                    .overlay(Circle().stroke(Color.white, lineWidth: 1.5))
                            }
                        }
                    }
                }
            }
        }
        .padding(12)
        .background(AppColors.surface)
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .modifier(AppShadows.small())
        .toast(isPresented: Binding(
            get: { viewModel.errorMessage != nil },
            set: { if !$0 { viewModel.errorMessage = nil } }
        ), message: viewModel.errorMessage ?? "", style: .error)
        .task {
            await viewModel.loadCheckinStatus(allianceId: allianceId)
        }
    }

    private func checkinMemberAvatar(_ member: AllianceService.CheckinMember) -> some View {
        Group {
            if let avatarUrl = member.avatarUrl, !avatarUrl.isEmpty,
               let url = URL(string: avatarUrl) {
                AsyncImage(url: url) { image in
                    image.resizable().scaledToFill()
                } placeholder: {
                    initialsAvatar(member)
                }
                .frame(width: 28, height: 28)
                .clipShape(Circle())
                .overlay(Circle().stroke(Color.white, lineWidth: 1.5))
            } else {
                initialsAvatar(member)
            }
        }
    }

    private func initialsAvatar(_ member: AllianceService.CheckinMember) -> some View {
        let name = member.displayName ?? member.username
        let initial = String(name.prefix(1)).uppercased()
        return Text(initial)
            .font(.system(size: 11, weight: .bold))
            .foregroundColor(.white)
            .frame(width: 28, height: 28)
            .background(Color.blue.opacity(0.6))
            .clipShape(Circle())
            .overlay(Circle().stroke(Color.white, lineWidth: 1.5))
    }
}

// MARK: - ViewModel

@MainActor
class AllianceCheckinViewModel: ObservableObject {
    @Published var hasCheckedIn = false
    @Published var streak = 0
    @Published var todayCount = 0
    @Published var checkedInMembers: [AllianceService.CheckinMember] = []
    @Published var isCheckinLoading = false
    @Published var expEarned: Int?
    @Published var errorMessage: String?

    private let service = AllianceService.shared

    func loadCheckinStatus(allianceId: Int) async {
        do {
            let status = try await service.getCheckinStatus(allianceId: allianceId)
            hasCheckedIn = status.hasCheckedIn
            streak = status.streak
            todayCount = status.todayCount
            checkedInMembers = status.checkedInMembers
        } catch {
            Logger.error("Failed to load checkin status: \(error)")
        }
    }

    func checkin(allianceId: Int) async {
        guard !hasCheckedIn, !isCheckinLoading else { return }
        isCheckinLoading = true
        defer { isCheckinLoading = false }

        do {
            let result = try await service.checkin(allianceId: allianceId)
            HapticManager.shared.notification(type: .success)
            SoundManager.shared.playSuccess()
            withAnimation(.spring(response: 0.3, dampingFraction: 0.6)) {
                hasCheckedIn = true
                expEarned = result.expEarned
                todayCount = result.todayCheckins
                streak += 1
            }
            // Re-fetch to get updated member list
            await loadCheckinStatus(allianceId: allianceId)
        } catch {
            errorMessage = error.localizedDescription
            HapticManager.shared.notification(type: .error)
            Logger.error("Checkin failed: \(error)")
        }
    }
}
